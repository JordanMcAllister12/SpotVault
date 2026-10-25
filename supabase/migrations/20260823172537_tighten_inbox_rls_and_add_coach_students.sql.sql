/*
# Tighten inbox RLS + add coach-students helper

1. Purpose
   - The user_inbox_conversations and user_inbox_messages tables have wide-open RLS (USING true).
   - Tighten to participant-scoped access before wiring coach-student chat.
   - Add sv_get_coach_students() so coaches can list their real coach_student relationships.

2. RLS changes
   - user_inbox_conversations: only participants can SELECT/UPDATE
   - user_inbox_messages: only conversation participants can SELECT; only senders can INSERT

3. New Functions
   - sv_get_coach_students() — returns active coach_student relationships for the calling user
   - Columns: student_id, student_name, student_username, student_email, status, created_at
*/

-- Tighten user_inbox_conversations RLS
DROP POLICY IF EXISTS "user_inbox_conversations_select_all" ON user_inbox_conversations;
DROP POLICY IF EXISTS "user_inbox_conversations_update_all" ON user_inbox_conversations;
DROP POLICY IF EXISTS "user_inbox_conversations_insert_all" ON user_inbox_conversations;

CREATE POLICY "user_inbox_conversations_select_participants"
  ON user_inbox_conversations FOR SELECT
  TO authenticated
  USING (
    participant_a_id = auth.uid()::text OR participant_b_id = auth.uid()::text
  );

CREATE POLICY "user_inbox_conversations_insert_participants"
  ON user_inbox_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_a_id = auth.uid()::text OR participant_b_id = auth.uid()::text
  );

CREATE POLICY "user_inbox_conversations_update_participants"
  ON user_inbox_conversations FOR UPDATE
  TO authenticated
  USING (
    participant_a_id = auth.uid()::text OR participant_b_id = auth.uid()::text
  );

-- Tighten user_inbox_messages RLS
DROP POLICY IF EXISTS "user_inbox_messages_select_all" ON user_inbox_messages;
DROP POLICY IF EXISTS "user_inbox_messages_insert_all" ON user_inbox_messages;
DROP POLICY IF EXISTS "user_inbox_messages_update_all" ON user_inbox_messages;

CREATE POLICY "user_inbox_messages_select_participants"
  ON user_inbox_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_inbox_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_a_id = auth.uid()::text OR c.participant_b_id = auth.uid()::text)
    )
  );

CREATE POLICY "user_inbox_messages_insert_senders"
  ON user_inbox_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text AND
    EXISTS (
      SELECT 1 FROM user_inbox_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_a_id = auth.uid()::text OR c.participant_b_id = auth.uid()::text)
    )
  );

CREATE POLICY "user_inbox_messages_update_participants"
  ON user_inbox_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_inbox_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_a_id = auth.uid()::text OR c.participant_b_id = auth.uid()::text)
    )
  );

-- Helper: find or create a 1:1 conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  other_user_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  me text := auth.uid()::text;
BEGIN
  IF me IS NULL OR other_user_id IS NULL OR me = other_user_id THEN
    RAISE EXCEPTION 'Invalid conversation parameters';
  END IF;

  SELECT id INTO conv_id
  FROM user_inbox_conversations
  WHERE (participant_a_id = me AND participant_b_id = other_user_id)
     OR (participant_a_id = other_user_id AND participant_b_id = me)
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO user_inbox_conversations (participant_a_id, participant_b_id)
    VALUES (me, other_user_id)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(text) TO authenticated;

-- Helper: list coach's active students with profile info
CREATE OR REPLACE FUNCTION public.sv_get_coach_students()
RETURNS TABLE (
  student_id text,
  student_name text,
  student_username text,
  student_email text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.metadata->>'student_id' AS student_id,
    p.display_name AS student_name,
    p.username AS student_username,
    u.email AS student_email,
    r.status AS status,
    r.created_at AS created_at
  FROM sv_relationships r
  LEFT JOIN user_profiles p ON p.user_id::text = r.metadata->>'student_id'
  LEFT JOIN auth.users u ON u.id::text = r.metadata->>'student_id'
  WHERE r.type = 'coach_student'
    AND r.metadata->>'coach_id' = auth.uid()::text
    AND r.status IN ('active', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_get_coach_students() TO authenticated;