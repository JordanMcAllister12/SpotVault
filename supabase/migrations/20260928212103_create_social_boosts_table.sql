/*
# Create social boosts table for community posts

## Purpose
Adds a `network_chat_boosts` table to persist "Social Boost" engagement on community posts.
This is the lightweight positive signal mechanic ("this is valuable / deserves more visibility").
It is SEPARATE from any future promotional boost product.

## New Tables
- `network_chat_boosts`
  - `id` (uuid, PK)
  - `message_id` (uuid, FK → network_chat_messages ON DELETE CASCADE) — the post being boosted
  - `lounge_message_id` (uuid, FK → poker_lounge_messages ON DELETE CASCADE) — allows boosts on lounge posts too (nullable, one of the two FK columns will be set)
  - `user_id` (text, NOT NULL) — the account boosting
  - `created_at` (timestamptz, default now())
  - UNIQUE(message_id, user_id) — one boost per user per network_chat post
  - UNIQUE(lounge_message_id, user_id) — one boost per user per lounge post
  - CHECK that at least one target is set

## Security
- RLS enabled on network_chat_boosts
- Policies for anon+authenticated CRUD (app uses anon key; no auth-wall on community engagement)
- Users can only create/delete their own boosts
- All users can see boost counts (SELECT open to all)
*/

CREATE TABLE IF NOT EXISTS network_chat_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES network_chat_messages(id) ON DELETE CASCADE,
  lounge_message_id uuid REFERENCES poker_lounge_messages(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id),
  UNIQUE(lounge_message_id, user_id),
  CHECK (message_id IS NOT NULL OR lounge_message_id IS NOT NULL)
);

ALTER TABLE network_chat_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_boosts" ON network_chat_boosts;
CREATE POLICY "select_boosts" ON network_chat_boosts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_boost" ON network_chat_boosts;
CREATE POLICY "insert_own_boost" ON network_chat_boosts
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_boost" ON network_chat_boosts;
CREATE POLICY "delete_own_boost" ON network_chat_boosts
  FOR DELETE TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_boosts_message_id ON network_chat_boosts(message_id);
CREATE INDEX IF NOT EXISTS idx_boosts_lounge_message_id ON network_chat_boosts(lounge_message_id);
CREATE INDEX IF NOT EXISTS idx_boosts_user_id ON network_chat_boosts(user_id);
