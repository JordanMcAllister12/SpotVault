/*
# Create lounge_read_state table for group chat unread tracking

## What this does
Creates a new table `lounge_read_state` that stores the timestamp of the last
message a user read in each lounge group chat. This enables accurate unread
counts per group conversation.

## New Tables
- `lounge_read_state`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null — references auth.users)
  - `lounge_slug` (text, not null — which lounge the read state is for)
  - `last_read_at` (timestamptz — timestamp of last read message)
  - `updated_at` (timestamptz, default now())
  - Unique constraint on (user_id, lounge_slug)

## Security
- RLS enabled on lounge_read_state.
- Users can only SELECT, INSERT, and UPDATE their own read state.
- 4 separate policies: select, insert, update, delete — all scoped to auth.uid() = user_id.
*/

CREATE TABLE IF NOT EXISTS lounge_read_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lounge_slug text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lounge_slug)
);

ALTER TABLE lounge_read_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lounge_read_state" ON lounge_read_state;
CREATE POLICY "select_own_lounge_read_state"
ON lounge_read_state FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lounge_read_state" ON lounge_read_state;
CREATE POLICY "insert_own_lounge_read_state"
ON lounge_read_state FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lounge_read_state" ON lounge_read_state;
CREATE POLICY "update_own_lounge_read_state"
ON lounge_read_state FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lounge_read_state" ON lounge_read_state;
CREATE POLICY "delete_own_lounge_read_state"
ON lounge_read_state FOR DELETE
TO authenticated USING (auth.uid() = user_id);
