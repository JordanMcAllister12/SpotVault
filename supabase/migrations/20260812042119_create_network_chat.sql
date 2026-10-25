/*
# Network Chat — Shared Community Center Chat

## Purpose
A single universal chat room ("SpotVault Network Chat") shared by every portal.
All approved members participate in one conversation. Sponsored placements
appear occasionally within the stream and are clearly labeled.

## New Tables

### network_chat_messages
- `id` (uuid, PK)
- `author_id` (text) — the SpotVault account id of the sender
- `author_name` (text) — display name at time of sending
- `author_avatar` (text, nullable) — avatar URL or identifier
- `author_role` (text) — PLAYER / PRO / COACH / MEDIA / CREATOR / BUSINESS / INVESTOR
- `body` (text, nullable) — message text (null for sponsored-only messages)
- `is_sponsored` (boolean, default false) — marks sponsored placements
- `sponsor_name` (text, nullable) — sponsor display name
- `sponsor_title` (text, nullable) — sponsored content title
- `sponsor_cta_label` (text, nullable) — call-to-action button text
- `sponsor_cta_url` (text, nullable) — call-to-action URL
- `attachment_type` (text, nullable) — 'image' | 'link' | 'hh' | 'spot' | 'video' | 'event' | 'profile'
- `attachment_url` (text, nullable) — URL or reference for the attachment
- `attachment_label` (text, nullable) — display label for the attachment
- `reply_to` (uuid, nullable) — FK to network_chat_messages.id for threaded replies
- `created_at` (timestamptz, default now())

### network_chat_reactions
- `id` (uuid, PK)
- `message_id` (uuid, FK to network_chat_messages, ON DELETE CASCADE)
- `user_id` (text) — account id of the reactor
- `emoji` (text) — the reaction emoji character
- `created_at` (timestamptz, default now())
- UNIQUE constraint on (message_id, user_id, emoji) to prevent duplicate reactions

## Security
- RLS enabled on both tables.
- This app uses demo accounts (no real auth), so policies use `TO anon, authenticated`
  to allow the anon-key frontend to read and write.
- All data is intentionally shared/public (one universal chat room), so `USING (true)`
  is appropriate and documented here.

## Important Notes
1. network_chat_messages supports both user messages and sponsored placements
   in a single table, distinguished by `is_sponsored`.
2. Sponsored message frequency is controlled at the application layer, not by the schema.
3. The `adFree` entitlement is also an application-layer concept (not stored here yet);
   when implemented it will live on a profiles/entitlements table.
4. `networkChatApproved` is an application-layer entitlement concept; when persisted
   it will live on a profiles/entitlements table. For now the demo uses the account's
   role/homePortal to determine approval.
*/

CREATE TABLE IF NOT EXISTS network_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id text NOT NULL,
  author_name text NOT NULL,
  author_avatar text,
  author_role text NOT NULL DEFAULT 'PLAYER',
  body text,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_name text,
  sponsor_title text,
  sponsor_cta_label text,
  sponsor_cta_url text,
  attachment_type text,
  attachment_url text,
  attachment_label text,
  reply_to uuid REFERENCES network_chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE network_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_chat_messages" ON network_chat_messages;
CREATE POLICY "anon_select_chat_messages"
ON network_chat_messages FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_chat_messages" ON network_chat_messages;
CREATE POLICY "anon_insert_chat_messages"
ON network_chat_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_chat_messages" ON network_chat_messages;
CREATE POLICY "anon_update_chat_messages"
ON network_chat_messages FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_chat_messages" ON network_chat_messages;
CREATE POLICY "anon_delete_chat_messages"
ON network_chat_messages FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS network_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES network_chat_messages(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE network_chat_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reactions" ON network_chat_reactions;
CREATE POLICY "anon_select_reactions"
ON network_chat_reactions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reactions" ON network_chat_reactions;
CREATE POLICY "anon_insert_reactions"
ON network_chat_reactions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reactions" ON network_chat_reactions;
CREATE POLICY "anon_delete_reactions"
ON network_chat_reactions FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON network_chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id ON network_chat_reactions (message_id);
