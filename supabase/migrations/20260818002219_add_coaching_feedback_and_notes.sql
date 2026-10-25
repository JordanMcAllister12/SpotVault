/*
# Coaching Feedback + Review Set Notes + Hand Note Tags

## Purpose
Adds coach feedback, general review set notes, and hand note tags to the existing
coaching submission system. Adds missing columns to sv_coaching_submissions for
the new submission modal.

## Changes to existing tables
- `sv_coaching_submissions`: ADD columns submission_type, review_set_id,
  general_note_snapshot, hand_count (if not exists)

## New Tables
1. `sv_coach_feedback` — Coach feedback on submissions
2. `sv_review_set_notes` — General notes per review set
3. `sv_hand_note_tags` — Tags on hand notes

## New SECURITY DEFINER Functions
- `sv_create_coach_feedback` — Coach creates feedback on a submission
*/

-- ============================================================
-- 1. Add columns to sv_coaching_submissions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_coaching_submissions' AND column_name = 'submission_type') THEN
    ALTER TABLE sv_coaching_submissions ADD COLUMN submission_type text NOT NULL DEFAULT 'marked_hands';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_coaching_submissions' AND column_name = 'review_set_id') THEN
    ALTER TABLE sv_coaching_submissions ADD COLUMN review_set_id uuid REFERENCES sv_review_sets(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_coaching_submissions' AND column_name = 'general_note_snapshot') THEN
    ALTER TABLE sv_coaching_submissions ADD COLUMN general_note_snapshot text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_coaching_submissions' AND column_name = 'hand_count') THEN
    ALTER TABLE sv_coaching_submissions ADD COLUMN hand_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_coaching_submissions' AND column_name = 'coaching_relationship_id') THEN
    ALTER TABLE sv_coaching_submissions ADD COLUMN coaching_relationship_id uuid;
  END IF;
END $$;

-- Add hand_tags_snapshot to submission items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_coaching_submission_items' AND column_name = 'hand_tags_snapshot') THEN
    ALTER TABLE sv_coaching_submission_items ADD COLUMN hand_tags_snapshot text[];
  END IF;
END $$;

-- ============================================================
-- 2. sv_coach_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_coach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES sv_coaching_submissions(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  student_id uuid NOT NULL,
  review_hand_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_coach_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coach_feedback_sub ON sv_coach_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_coach_feedback_student ON sv_coach_feedback(student_id);

DROP POLICY IF EXISTS "select_coach_feedback" ON sv_coach_feedback;
CREATE POLICY "select_coach_feedback" ON sv_coach_feedback
  FOR SELECT TO authenticated USING (auth.uid() = student_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "insert_coach_feedback" ON sv_coach_feedback;
CREATE POLICY "insert_coach_feedback" ON sv_coach_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = coach_id);

-- ============================================================
-- 3. sv_review_set_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_review_set_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_set_id uuid NOT NULL REFERENCES sv_review_sets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_review_set_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_review_set_notes_set ON sv_review_set_notes(review_set_id);

DROP POLICY IF EXISTS "select_own_review_set_notes" ON sv_review_set_notes;
CREATE POLICY "select_own_review_set_notes" ON sv_review_set_notes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_review_sets rs WHERE rs.id = sv_review_set_notes.review_set_id AND rs.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_review_set_notes" ON sv_review_set_notes;
CREATE POLICY "insert_own_review_set_notes" ON sv_review_set_notes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM sv_review_sets rs WHERE rs.id = sv_review_set_notes.review_set_id AND rs.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_review_set_notes" ON sv_review_set_notes;
CREATE POLICY "update_own_review_set_notes" ON sv_review_set_notes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM sv_review_sets rs WHERE rs.id = sv_review_set_notes.review_set_id AND rs.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sv_review_sets rs WHERE rs.id = sv_review_set_notes.review_set_id AND rs.owner_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_review_set_notes" ON sv_review_set_notes;
CREATE POLICY "delete_own_review_set_notes" ON sv_review_set_notes
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_review_sets rs WHERE rs.id = sv_review_set_notes.review_set_id AND rs.owner_id = auth.uid())
  );

-- ============================================================
-- 4. sv_hand_note_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_hand_note_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_hand_id uuid NOT NULL REFERENCES sv_review_hands(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_hand_id, author_id, tag)
);

ALTER TABLE sv_hand_note_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hand_note_tags_hand ON sv_hand_note_tags(review_hand_id);

DROP POLICY IF EXISTS "select_own_hand_note_tags" ON sv_hand_note_tags;
CREATE POLICY "select_own_hand_note_tags" ON sv_hand_note_tags
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sv_review_hands rh
      JOIN sv_review_sets rs ON rs.id = rh.review_set_id
      WHERE rh.id = sv_hand_note_tags.review_hand_id AND rs.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_hand_note_tags" ON sv_hand_note_tags;
CREATE POLICY "insert_own_hand_note_tags" ON sv_hand_note_tags
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM sv_review_hands rh
      JOIN sv_review_sets rs ON rs.id = rh.review_set_id
      WHERE rh.id = sv_hand_note_tags.review_hand_id AND rs.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_hand_note_tags" ON sv_hand_note_tags;
CREATE POLICY "delete_own_hand_note_tags" ON sv_hand_note_tags
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sv_review_hands rh
      JOIN sv_review_sets rs ON rs.id = rh.review_set_id
      WHERE rh.id = sv_hand_note_tags.review_hand_id AND rs.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 5. SECURITY DEFINER: sv_create_coach_feedback
-- ============================================================
CREATE OR REPLACE FUNCTION sv_create_coach_feedback(
  p_submission_id uuid,
  p_review_hand_id uuid DEFAULT NULL,
  p_content text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coach_id uuid := auth.uid();
  v_submission sv_coaching_submissions%ROWTYPE;
  v_feedback_id uuid;
BEGIN
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_submission FROM sv_coaching_submissions WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_submission.coach_id != v_coach_id THEN
    RAISE EXCEPTION 'You are not the coach for this submission';
  END IF;

  INSERT INTO sv_coach_feedback (
    submission_id, coach_id, student_id, review_hand_id, content
  ) VALUES (
    p_submission_id, v_coach_id, v_submission.student_id, p_review_hand_id, p_content
  ) RETURNING id INTO v_feedback_id;

  UPDATE sv_coaching_submissions
  SET status = 'feedback_sent', coach_feedback = p_content, reviewed_at = now()
  WHERE id = p_submission_id;

  RETURN v_feedback_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_create_coach_feedback FROM anon;
GRANT EXECUTE ON FUNCTION sv_create_coach_feedback TO authenticated;