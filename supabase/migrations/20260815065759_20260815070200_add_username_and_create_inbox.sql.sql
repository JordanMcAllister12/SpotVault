/*
# Add username to user_profiles and create inbox tables

1. Modified Tables
- `user_profiles` — Add username (unique), poker_role columns

2. New Tables
- `user_inbox_conversations` — DM conversations between users (by account_id text)
- `user_inbox_messages` — Messages within conversations

3. Security
- RLS enabled, TO anon, authenticated (demo auth pattern)
*/

-- Add username column to existing user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN username text;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (username);
  END IF;
END $$;

-- Add poker_role column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'poker_role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN poker_role text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add index on user_id for profile lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles (user_id);

-- ============================================================
-- user_inbox_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS user_inbox_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id text NOT NULL,
  participant_b_id text NOT NULL,
  last_message_preview text NOT NULL DEFAULT '',
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_inbox_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_conv" ON user_inbox_conversations;
CREATE POLICY "anon_select_conv" ON user_inbox_conversations FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_conv" ON user_inbox_conversations;
CREATE POLICY "anon_insert_conv" ON user_inbox_conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_conv" ON user_inbox_conversations;
CREATE POLICY "anon_update_conv" ON user_inbox_conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_conv" ON user_inbox_conversations;
CREATE POLICY "anon_delete_conv" ON user_inbox_conversations FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_a ON user_inbox_conversations (participant_a_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_b ON user_inbox_conversations (participant_b_id);

-- ============================================================
-- user_inbox_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS user_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES user_inbox_conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_inbox_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_msgs" ON user_inbox_messages;
CREATE POLICY "anon_select_msgs" ON user_inbox_messages FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_msgs" ON user_inbox_messages;
CREATE POLICY "anon_insert_msgs" ON user_inbox_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_msgs" ON user_inbox_messages;
CREATE POLICY "anon_update_msgs" ON user_inbox_messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_msgs" ON user_inbox_messages;
CREATE POLICY "anon_delete_msgs" ON user_inbox_messages FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_conv ON user_inbox_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_created ON user_inbox_messages (created_at);
