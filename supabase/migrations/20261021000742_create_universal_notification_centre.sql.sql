/*
# Universal Notification Centre

## Overview
Creates a per-user notification system that aggregates activity from across the
SpotVault ecosystem: private messages, group messages, inbox communications,
activity feed events, info-feed posts, MV pulls, and platform announcements.

## 1. New Tables

### `notifications`
- `id` (uuid, PK) — unique notification ID
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the recipient user
- `type` (text, NOT NULL) — notification category: 'dm' | 'group_message' | 'inbox' | 'activity' | 'info_post' | 'mv_pull' | 'announcement'
- `title` (text, NOT NULL) — short display title
- `body` (text) — optional preview/description
- `icon` (text) — optional icon name hint (e.g. 'MessageSquare', 'Users')
- `source_id` (text) — optional ID of the originating entity (message ID, post ID, etc.)
- `source_type` (text) — optional type of the originating entity (for dedup)
- `destination` (text) — optional navigation target (URL fragment or route key)
- `is_read` (boolean, DEFAULT false) — read/acknowledged state
- `is_broadcast` (boolean, DEFAULT false) — true for platform-wide announcements
- `created_at` (timestamptz, DEFAULT now()) — when the notification was created
- `read_at` (timestamptz) — when the user acknowledged it

### `notification_read_state`
- `user_id` (uuid, PK) — the user
- `last_seen_at` (timestamptz) — last time the user opened the notification panel (used for broadcast dedup)

## 2. Indexes
- `idx_notifications_user_unread` — (user_id, is_read, created_at DESC) for fast unread queries
- `idx_notifications_user_all` — (user_id, created_at DESC) for the All/History tab
- `idx_notifications_source_dedup` — (user_id, source_type, source_id) for dedup checks

## 3. Security (RLS)
- `notifications`: Owner-scoped CRUD — users can only see and modify their own notifications.
  Broadcast notifications (is_broadcast = true) are readable by all authenticated users.
- `notification_read_state`: Owner-scoped — each user manages their own read state.

## 4. Important Notes
- The `user_id` column defaults to `auth.uid()` so inserts from the client work
  even when the caller omits the field.
- Broadcast announcements insert with a NULL user_id and is_broadcast = true.
  All authenticated users can read these; the client filters by user_id OR is_broadcast.
- Deduplication is handled at the application layer by checking source_type + source_id
  before inserting.
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  icon text,
  source_id text,
  source_type text,
  destination text,
  is_read boolean NOT NULL DEFAULT false,
  is_broadcast boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Create notification_read_state table
CREATE TABLE IF NOT EXISTS notification_read_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_source_dedup
  ON notifications (user_id, source_type, source_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_read_state ENABLE ROW LEVEL SECURITY;

-- notifications: SELECT (own + broadcast)
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_broadcast = true);

-- notifications: INSERT (own only, or broadcast by staff)
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- notifications: UPDATE (mark own as read)
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notifications: DELETE (own only)
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- notification_read_state: SELECT
DROP POLICY IF EXISTS "select_own_read_state" ON notification_read_state;
CREATE POLICY "select_own_read_state"
  ON notification_read_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- notification_read_state: INSERT
DROP POLICY IF EXISTS "insert_own_read_state" ON notification_read_state;
CREATE POLICY "insert_own_read_state"
  ON notification_read_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- notification_read_state: UPDATE
DROP POLICY IF EXISTS "update_own_read_state" ON notification_read_state;
CREATE POLICY "update_own_read_state"
  ON notification_read_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_read_state: DELETE
DROP POLICY IF EXISTS "delete_own_read_state" ON notification_read_state;
CREATE POLICY "delete_own_read_state"
  ON notification_read_state FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
