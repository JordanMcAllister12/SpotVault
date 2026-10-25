-- Allow anon (unauthenticated) users to read visible community feed messages
CREATE POLICY "network_chat_select_anon"
  ON network_chat_messages
  FOR SELECT
  TO anon
  USING (moderation_status = 'visible');
