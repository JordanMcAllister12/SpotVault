/*
# Phase 4 — Teleport / Coaching Submissions

## Purpose
Creates the durable coaching submission system. Teleport sends resources/references
into a coaching workflow as a submission — the submission itself becomes its own resource.

## New Tables

### sv_coaching_submissions
A durable coaching submission containing references to resources.
- id (uuid, primary key)
- student_id (uuid — the student submitting)
- coach_id (uuid — the coach receiving)
- relationship_id (uuid, nullable — the coach_student relationship)
- title (text, not null)
- student_note (text, nullable)
- coach_feedback (text, nullable)
- status (text: 'submitted' | 'awaiting_review' | 'in_review' | 'reviewed' | 'returned' | 'cancelled')
- priority (text: 'normal' | 'review_soon' | 'urgent')
- submitted_at, reviewed_at, created_at, updated_at

### sv_coaching_submission_items
The individual resources referenced by a submission.
- id (uuid, primary key)
- submission_id (uuid, references sv_coaching_submissions)
- resource_type (text: 'hand' | 'tournament' | 'analytics_report' | 'library_item' | 'spot' | 'video')
- resource_id (uuid — the ID in the source table)
- note (text, nullable — student's note about this item)
- created_at

## Security
- RLS enabled on both tables
- Both student and coach can read submissions and items
- Mutations through SECURITY DEFINER functions
- Direct client writes revoked

## Important Notes
1. The submission references the ORIGINAL resources — no duplicate copies.
2. The submission itself becomes a durable record with its own lifecycle.
3. Historical submissions are preserved even after the coach relationship ends.
4. Source resource deletion should check for active submission references (handled in app logic).
*/

CREATE TABLE IF NOT EXISTS sv_coaching_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid REFERENCES sv_relationships(id) ON DELETE SET NULL,
  title text NOT NULL,
  student_note text,
  coach_feedback text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'awaiting_review', 'in_review', 'reviewed', 'returned', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'review_soon', 'urgent')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_submissions_student_idx ON sv_coaching_submissions (student_id, status);
CREATE INDEX IF NOT EXISTS sv_submissions_coach_idx ON sv_coaching_submissions (coach_id, status);

ALTER TABLE sv_coaching_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_submissions_select_participants" ON sv_coaching_submissions;
CREATE POLICY "sv_submissions_select_participants" ON sv_coaching_submissions FOR SELECT
  TO authenticated USING (student_id = auth.uid() OR coach_id = auth.uid());

REVOKE INSERT ON sv_coaching_submissions FROM anon, authenticated;
REVOKE UPDATE ON sv_coaching_submissions FROM anon, authenticated;
REVOKE DELETE ON sv_coaching_submissions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS sv_coaching_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES sv_coaching_submissions(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_submission_items_idx ON sv_coaching_submission_items (submission_id);
CREATE INDEX IF NOT EXISTS sv_submission_items_resource_idx ON sv_coaching_submission_items (resource_type, resource_id);

ALTER TABLE sv_coaching_submission_items ENABLE ROW LEVEL SECURITY;

-- Both student and coach (via submission) can read items
DROP POLICY IF EXISTS "sv_submission_items_select" ON sv_coaching_submission_items;
CREATE POLICY "sv_submission_items_select" ON sv_coaching_submission_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sv_coaching_submissions
      WHERE sv_coaching_submissions.id = sv_coaching_submission_items.submission_id
      AND (sv_coaching_submissions.student_id = auth.uid() OR sv_coaching_submissions.coach_id = auth.uid())
    )
  );

REVOKE INSERT ON sv_coaching_submission_items FROM anon, authenticated;
REVOKE UPDATE ON sv_coaching_submission_items FROM anon, authenticated;
REVOKE DELETE ON sv_coaching_submission_items FROM anon, authenticated;

-- ============================================================
-- SECURITY DEFINER: Create Coaching Submission (Teleport)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_create_submission(
  p_coach_id uuid,
  p_title text,
  p_student_note text DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_relationship_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_priority NOT IN ('normal', 'review_soon', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  INSERT INTO sv_coaching_submissions (
    student_id, coach_id, relationship_id, title, student_note, priority, status
  )
  VALUES (
    auth.uid(), p_coach_id, p_relationship_id, p_title, p_student_note, p_priority, 'awaiting_review'
  )
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'submission_created', p_coach_id,
    jsonb_build_object('submission_id', v_id, 'title', p_title));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_create_submission(uuid, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_create_submission(uuid, text, text, text, uuid) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: Add Submission Item
-- ============================================================
CREATE OR REPLACE FUNCTION sv_add_submission_item(
  p_submission_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_student_id uuid;
BEGIN
  SELECT student_id INTO v_student_id FROM sv_coaching_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF auth.uid() != v_student_id THEN RAISE EXCEPTION 'Not authorized: only the student can add items'; END IF;

  INSERT INTO sv_coaching_submission_items (submission_id, resource_type, resource_id, note)
  VALUES (p_submission_id, p_resource_type, p_resource_id, p_note)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_add_submission_item(uuid, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_add_submission_item(uuid, text, uuid, text) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: Update Submission Status (Coach)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_update_submission_status(
  p_submission_id uuid,
  p_status text,
  p_coach_feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  IF p_status NOT IN ('submitted', 'awaiting_review', 'in_review', 'reviewed', 'returned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT coach_id INTO v_coach_id FROM sv_coaching_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF auth.uid() != v_coach_id THEN RAISE EXCEPTION 'Not authorized: only the coach can update status'; END IF;

  UPDATE sv_coaching_submissions
  SET status = p_status,
      coach_feedback = COALESCE(p_coach_feedback, coach_feedback),
      reviewed_at = CASE WHEN p_status IN ('reviewed', 'returned') THEN now() ELSE reviewed_at END,
      updated_at = now()
  WHERE id = p_submission_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_update_submission_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_update_submission_status(uuid, text, text) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: Get My Submissions
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_submissions(p_role text DEFAULT NULL)
RETURNS TABLE (
  id uuid, student_id uuid, coach_id uuid, relationship_id uuid,
  title text, student_note text, coach_feedback text, status text,
  priority text, submitted_at timestamptz, reviewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, student_id, coach_id, relationship_id, title, student_note, coach_feedback,
         status, priority, submitted_at, reviewed_at
  FROM sv_coaching_submissions
  WHERE (p_role IS NULL OR
         (p_role = 'student' AND student_id = auth.uid()) OR
         (p_role = 'coach' AND coach_id = auth.uid()))
  AND (student_id = auth.uid() OR coach_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_submissions(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_submissions(text) TO authenticated;