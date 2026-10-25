-- =====================================================
-- CHAT RLS HARDENING
-- Replace permissive USING(true) policies with ownership checks
-- =====================================================

-- Drop all existing permissive policies on network_chat_messages
DROP POLICY IF EXISTS "anon_select_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "anon_insert_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "anon_update_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "anon_delete_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "network_chat_select_anon" ON network_chat_messages;

-- Drop all existing permissive policies on network_chat_reactions
DROP POLICY IF EXISTS "anon_select_chat_reactions" ON network_chat_reactions;
DROP POLICY IF EXISTS "anon_insert_chat_reactions" ON network_chat_reactions;
DROP POLICY IF EXISTS "anon_delete_chat_reactions" ON network_chat_reactions;

-- ===== network_chat_messages: SELECT =====
-- Authenticated users see visible messages; anon sees only non-hidden
CREATE POLICY "chat_messages_select_auth"
  ON network_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "chat_messages_select_anon"
  ON network_chat_messages FOR SELECT
  TO anon
  USING (moderation_status = 'visible' OR moderation_status IS NULL);

-- ===== network_chat_messages: INSERT =====
-- Only authenticated users can insert, and only as themselves
CREATE POLICY "chat_messages_insert_auth"
  ON network_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

-- ===== network_chat_messages: UPDATE =====
-- Users can only update their own messages (edit)
CREATE POLICY "chat_messages_update_own"
  ON network_chat_messages FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid()::text)
  WITH CHECK (author_id = auth.uid()::text);

-- ===== network_chat_messages: DELETE =====
-- Users can only delete their own messages
CREATE POLICY "chat_messages_delete_own"
  ON network_chat_messages FOR DELETE
  TO authenticated
  USING (author_id = auth.uid()::text);

-- ===== network_chat_reactions: SELECT =====
CREATE POLICY "chat_reactions_select_all"
  ON network_chat_reactions FOR SELECT
  TO anon, authenticated
  USING (true);

-- ===== network_chat_reactions: INSERT =====
-- Only authenticated users can react, and only as themselves
CREATE POLICY "chat_reactions_insert_auth"
  ON network_chat_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- ===== network_chat_reactions: DELETE =====
-- Users can only delete their own reactions
CREATE POLICY "chat_reactions_delete_own"
  ON network_chat_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ===== network_chat_reactions: UPDATE =====
CREATE POLICY "chat_reactions_update_own"
  ON network_chat_reactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
