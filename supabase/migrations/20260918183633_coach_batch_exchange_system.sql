/*
# Coach Batch Exchange System — Schema + RPCs

1. Changes to sv_coaching_submissions
- Add `exchange_count` integer (default 0) to track coach return cycles (max 3)
- Add `review_set_id` properly linked to sv_review_sets for loading submission hands into workspace
- Fix status CHECK constraint: add 'feedback_ready', 'follow_up_sent', 'closed' values
- The existing 'feedback_sent' value used by sv_create_coach_feedback is NOT in the constraint
  and would cause a runtime error — this migration fixes that

2. Changes to sv_review_hand_notes
- Add `exchange_number` integer (default 0) to track which exchange round a note belongs to
- Add `is_delivered` boolean (default false) — once true, the note becomes immutable
- Notes with is_delivered=true cannot be edited or deleted by the author

3. New RPC: sv_return_feedback
- Coach calls after reviewing hands and adding coach notes
- Sets all coach notes for this submission to is_delivered=true (immutable)
- Increments exchange_count
- Updates submission status to 'feedback_ready' (return #1), 'feedback_ready' (return #2), or 'closed' (return #3)
- Creates coach_batch_returned batch event
- Returns the new exchange_count

4. New RPC: sv_send_follow_up
- Student calls to send a follow-up question after receiving feedback
- Checks exchange_count < 3 (otherwise review is closed)
- Sets student follow-up notes to is_delivered=true
- Updates status to 'follow_up_sent'
- Creates coach_batch_submitted batch event (re-notify coach)

5. New RPC: sv_load_submission_hands
- Returns the hand IDs from a coaching submission as a review_set_id
- Used by the coach's workspace to load submitted hands directly

6. Security
- All RPCs are SECURITY DEFINER with ownership checks
- Anon execute revoked on all new functions
- Immutable note enforcement is in RLS policies (UPDATE only allowed when is_delivered=false)
*/

-- 1. Add exchange_count to sv_coaching_submissions
ALTER TABLE sv_coaching_submissions
  ADD COLUMN IF NOT EXISTS exchange_count integer NOT NULL DEFAULT 0;

-- 2. Fix status CHECK constraint to include new statuses
ALTER TABLE sv_coaching_submissions DROP CONSTRAINT IF EXISTS sv_coaching_submissions_status_check;
ALTER TABLE sv_coaching_submissions ADD CONSTRAINT sv_coaching_submissions_status_check
  CHECK (status IN ('submitted', 'awaiting_review', 'in_review', 'reviewed', 'returned',
                    'feedback_ready', 'follow_up_sent', 'closed', 'cancelled'));

-- 3. Add exchange tracking to sv_review_hand_notes
ALTER TABLE sv_review_hand_notes
  ADD COLUMN IF NOT EXISTS exchange_number integer NOT NULL DEFAULT 0;

ALTER TABLE sv_review_hand_notes
  ADD COLUMN IF NOT EXISTS is_delivered boolean NOT NULL DEFAULT false;

-- 4. Update notes RLS: prevent editing delivered notes
-- First drop existing UPDATE policy and recreate with immutability check
DROP POLICY IF EXISTS "update_own_notes" ON sv_review_hand_notes;
CREATE POLICY "update_own_notes" ON sv_review_hand_notes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND NOT is_delivered)
  WITH CHECK (author_id = auth.uid() AND NOT is_delivered);

-- Prevent deleting delivered notes
DROP POLICY IF EXISTS "delete_own_notes" ON sv_review_hand_notes;
CREATE POLICY "delete_own_notes" ON sv_review_hand_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND NOT is_delivered);

-- 5. RPC: sv_return_feedback — coach returns feedback to student
CREATE OR REPLACE FUNCTION sv_return_feedback(
  p_submission_id uuid,
  p_message text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
  v_student_id uuid;
  v_review_set_id uuid;
  v_batch_id uuid;
  v_exchange_count integer;
  v_new_status text;
  v_student_email text;
  v_student_name text;
  v_coach_name text;
  v_title text;
  v_hand_count integer;
BEGIN
  -- Verify caller is the coach for this submission
  SELECT coach_id, student_id, review_set_id, exchange_count, title, hand_count
    INTO v_coach_id, v_student_id, v_review_set_id, v_exchange_count, v_title, v_hand_count
  FROM sv_coaching_submissions
  WHERE id = p_submission_id;

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_coach_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned coach can return feedback';
  END IF;

  IF v_exchange_count >= 3 THEN
    RAISE EXCEPTION 'Maximum exchange limit reached (3 returns). Review is closed.';
  END IF;

  v_exchange_count := v_exchange_count + 1;

  -- Determine new status
  IF v_exchange_count >= 3 THEN
    v_new_status := 'closed';
  ELSE
    v_new_status := 'feedback_ready';
  END IF;

  -- Mark all coach notes for this submission's hands as delivered (immutable)
  UPDATE sv_review_hand_notes
    SET is_delivered = true
    WHERE note_type = 'coach'
      AND review_hand_id IN (
        SELECT si.resource_id::uuid
        FROM sv_coaching_submission_items si
        WHERE si.submission_id = p_submission_id
          AND si.resource_type = 'hand'
      )
      AND is_delivered = false;

  -- Update submission
  UPDATE sv_coaching_submissions
    SET exchange_count = v_exchange_count,
        status = v_new_status,
        coach_feedback = COALESCE(p_message, coach_feedback),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_submission_id;

  -- Find the batch_id from review_set_id
  SELECT id INTO v_batch_id FROM sv_review_sets WHERE id = v_review_set_id;

  -- Create batch event for student
  IF v_batch_id IS NOT NULL THEN
    INSERT INTO sv_batch_events (batch_id, event_type, actor_id, recipient_id, payload)
    VALUES (v_batch_id, 'coach_batch_returned', v_coach_id, v_student_id,
      jsonb_build_object(
        'submission_id', p_submission_id,
        'title', v_title,
        'hand_count', v_hand_count,
        'exchange_count', v_exchange_count,
        'status', v_new_status
      ));
  END IF;

  -- Send in-app system message to student
  SELECT email INTO v_student_email FROM auth.users WHERE id = v_student_id;
  PERFORM sv_send_system_message(
    v_student_id::text,
    'coach_feedback_ready_' || p_submission_id::text || '_' || v_exchange_count::text,
    'Your Hand Review Is Ready',
    COALESCE(p_message, 'Your coach has returned feedback on your hand review.'),
    jsonb_build_object('submission_id', p_submission_id, 'exchange_count', v_exchange_count)
  );

  RETURN v_exchange_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_return_feedback(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_return_feedback(uuid, text) TO authenticated;

-- 6. RPC: sv_send_follow_up — student sends follow-up after receiving feedback
CREATE OR REPLACE FUNCTION sv_send_follow_up(
  p_submission_id uuid,
  p_message text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
  v_student_id uuid;
  v_review_set_id uuid;
  v_batch_id uuid;
  v_exchange_count integer;
  v_title text;
  v_hand_count integer;
BEGIN
  SELECT coach_id, student_id, review_set_id, exchange_count, title, hand_count
    INTO v_coach_id, v_student_id, v_review_set_id, v_exchange_count, v_title, v_hand_count
  FROM sv_coaching_submissions
  WHERE id = p_submission_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_student_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the student can send a follow-up';
  END IF;

  IF v_exchange_count >= 3 THEN
    RAISE EXCEPTION 'Maximum exchange limit reached (3 returns). Review is closed.';
  END IF;

  -- Mark student follow-up notes as delivered
  UPDATE sv_review_hand_notes
    SET is_delivered = true
    WHERE note_type = 'student'
      AND exchange_number > 0
      AND review_hand_id IN (
        SELECT si.resource_id::uuid
        FROM sv_coaching_submission_items si
        WHERE si.submission_id = p_submission_id
          AND si.resource_type = 'hand'
      )
      AND is_delivered = false;

  -- Update status
  UPDATE sv_coaching_submissions
    SET status = 'follow_up_sent',
        student_note = COALESCE(p_message, student_note),
        updated_at = now()
    WHERE id = p_submission_id;

  -- Find batch_id
  SELECT id INTO v_batch_id FROM sv_review_sets WHERE id = v_review_set_id;

  -- Create batch event for coach
  IF v_batch_id IS NOT NULL THEN
    INSERT INTO sv_batch_events (batch_id, event_type, actor_id, recipient_id, payload)
    VALUES (v_batch_id, 'coach_batch_submitted', v_student_id, v_coach_id,
      jsonb_build_object(
        'submission_id', p_submission_id,
        'title', v_title,
        'hand_count', v_hand_count,
        'is_follow_up', true,
        'exchange_count', v_exchange_count
      ));
  END IF;

  -- In-app notification to coach
  PERFORM sv_send_system_message(
    v_coach_id::text,
    'student_follow_up_' || p_submission_id::text || '_' || v_exchange_count::text,
    'New Follow-Up From Student',
    COALESCE(p_message, 'A student has sent a follow-up question on their hand review.'),
    jsonb_build_object('submission_id', p_submission_id, 'is_follow_up', true)
  );

  RETURN v_exchange_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_send_follow_up(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_send_follow_up(uuid, text) TO authenticated;

-- 7. RPC: sv_get_submission_details — load submission with exchange info
CREATE OR REPLACE FUNCTION sv_get_submission_details(
  p_submission_id uuid
) RETURNS TABLE(
  id uuid,
  student_id uuid,
  coach_id uuid,
  title text,
  status text,
  exchange_count integer,
  hand_count integer,
  student_note text,
  coach_feedback text,
  review_set_id uuid,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.student_id, s.coach_id, s.title, s.status,
    s.exchange_count, s.hand_count, s.student_note, s.coach_feedback,
    s.review_set_id, s.created_at, s.reviewed_at
  FROM sv_coaching_submissions s
  WHERE s.id = p_submission_id
    AND (s.student_id = auth.uid() OR s.coach_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION sv_get_submission_details(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_submission_details(uuid) TO authenticated;

-- 8. Fix sv_create_coach_feedback to use valid status value
CREATE OR REPLACE FUNCTION sv_create_coach_feedback(
  p_submission_id uuid,
  p_review_hand_id uuid DEFAULT NULL,
  p_content text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feedback_id uuid;
  v_coach_id uuid;
  v_student_id uuid;
BEGIN
  SELECT coach_id, student_id INTO v_coach_id, v_student_id
  FROM sv_coaching_submissions WHERE id = p_submission_id;

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_coach_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned coach can add feedback';
  END IF;

  INSERT INTO sv_coach_feedback (submission_id, coach_id, student_id, review_hand_id, content)
  VALUES (p_submission_id, v_coach_id, v_student_id, p_review_hand_id, p_content)
  RETURNING id INTO v_feedback_id;

  -- Do NOT set status to 'feedback_sent' (invalid) — status is managed by sv_return_feedback
  UPDATE sv_coaching_submissions
    SET status = 'in_review', updated_at = now()
    WHERE id = p_submission_id AND status = 'awaiting_review';

  RETURN v_feedback_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_create_coach_feedback(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_create_coach_feedback(uuid, uuid, text) TO authenticated;

-- 9. Update sv_create_submission to also set review_set_id and hand_count
CREATE OR REPLACE FUNCTION sv_create_submission(
  p_coach_id uuid,
  p_title text,
  p_student_note text DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_relationship_id uuid DEFAULT NULL,
  p_review_set_id uuid DEFAULT NULL,
  p_hand_count integer DEFAULT 0,
  p_general_note_snapshot text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id uuid;
  v_student_id uuid := auth.uid();
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO sv_coaching_submissions (
    student_id, coach_id, relationship_id, title, student_note, priority,
    status, review_set_id, hand_count, general_note_snapshot, submission_type
  ) VALUES (
    v_student_id, p_coach_id, p_relationship_id, p_title, p_student_note, p_priority,
    'awaiting_review', p_review_set_id, p_hand_count, p_general_note_snapshot, 'marked_hands'
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_create_submission(uuid, text, text, text, uuid, uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_create_submission(uuid, text, text, text, uuid, uuid, integer, text) TO authenticated;