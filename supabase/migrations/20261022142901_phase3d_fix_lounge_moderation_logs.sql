-- Fix lounge_moderation_logs: revoke anon, drop remaining permissive policy
REVOKE SELECT, INSERT, UPDATE, DELETE ON lounge_moderation_logs FROM anon;

DROP POLICY IF EXISTS "select_moderation_logs" ON lounge_moderation_logs;

CREATE POLICY "modlog_select_own_final" ON lounge_moderation_logs FOR SELECT TO authenticated
  USING (auth.uid() = moderator_id);
