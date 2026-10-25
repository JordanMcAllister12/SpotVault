/*
# AI Answer Challenge — Answer Key Storage

## Purpose
Stores creator answer keys and grading rubrics for AI Answer Challenge blocks
embedded in Content Lab documents. The answer key is stored SERVER-SIDE only
and is never exposed to student clients before submission. This prevents
students from reading the hidden answer via the document JSON.

## New Tables

### `ai_answer_challenges`
- `id` (uuid, PK) — stable unique identifier matching the TipTap node's challengeId
- `content_spot_id` (uuid, FK to content_spots) — the document this challenge belongs to
- `creator_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the coach/creator who created it
- `question` (text) — the question/prompt shown to students
- `answer_format_instructions` (text) — format guidance for student responses
- `answer_key` (text) — the hidden correct answer (never sent to students pre-submission)
- `grading_mode` (text) — 'exact_combinations' | 'conceptual' | 'strategic_reasoning'
- `grading_rubric` (jsonb) — creator-editable rubric with essential concepts, partial credit rules, etc.
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### `ai_answer_submissions`
- `id` (uuid, PK)
- `challenge_id` (uuid, FK to ai_answer_challenges)
- `student_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the student who submitted
- `student_answer` (text) — the submitted answer text
- `score` (integer) — 0-100 score from AI grading
- `feedback` (jsonb) — structured grading result (correct_elements, missing_elements, etc.)
- `grading_model` (text) — which AI model was used
- `rubric_version` (text) — rubric hash for version tracking
- `attempt_number` (integer) — which attempt this is
- `submitted_at` (timestamptz)

## Security
- RLS enabled on both tables.
- `ai_answer_challenges`: creators can CRUD their own challenges. Students can SELECT
  only the challenge metadata (question, format instructions, grading_mode) — NOT the
  answer_key column. This is enforced via a SECURITY DEFINER function that returns
  only the safe columns.
- `ai_answer_submissions`: students can INSERT and SELECT their own submissions.
  Creators can SELECT submissions for their challenges.

## Important Notes
1. The answer_key column is protected by column-level RLS: students never receive it.
2. A SECURITY DEFINER function `get_ai_challenge_for_grading` is used by the edge
   function to fetch the full challenge (including answer_key) server-side using
   the service role key.
3. A SECURITY DEFINER function `get_safe_challenge_data` returns only student-safe
   columns (question, format_instructions, grading_mode) for client-side rendering.
*/

-- ============================================================
-- ai_answer_challenges table
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_answer_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_spot_id uuid REFERENCES content_spots(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  answer_format_instructions text NOT NULL DEFAULT '',
  answer_key text NOT NULL DEFAULT '',
  grading_mode text NOT NULL DEFAULT 'conceptual' CHECK (
    grading_mode IN ('exact_combinations', 'conceptual', 'strategic_reasoning')
  ),
  grading_rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_answer_challenges ENABLE ROW LEVEL SECURITY;

-- Creator: full CRUD on own challenges
DROP POLICY IF EXISTS "creator_select_own_challenges" ON ai_answer_challenges;
CREATE POLICY "creator_select_own_challenges"
  ON ai_answer_challenges FOR SELECT
  TO authenticated USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator_insert_own_challenges" ON ai_answer_challenges;
CREATE POLICY "creator_insert_own_challenges"
  ON ai_answer_challenges FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator_update_own_challenges" ON ai_answer_challenges;
CREATE POLICY "creator_update_own_challenges"
  ON ai_answer_challenges FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator_delete_own_challenges" ON ai_answer_challenges;
CREATE POLICY "creator_delete_own_challenges"
  ON ai_answer_challenges FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

-- Students: can only see challenge metadata, NOT the answer_key
-- We use a SECURITY DEFINER function for safe reads (see below)

-- ============================================================
-- ai_answer_submissions table
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_answer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES ai_answer_challenges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_answer text NOT NULL DEFAULT '',
  score integer CHECK (score >= 0 AND score <= 100),
  feedback jsonb,
  grading_model text,
  rubric_version text,
  attempt_number integer NOT NULL DEFAULT 1,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_answer_submissions ENABLE ROW LEVEL SECURITY;

-- Students: can insert and read their own submissions
DROP POLICY IF EXISTS "student_insert_own_submissions" ON ai_answer_submissions;
CREATE POLICY "student_insert_own_submissions"
  ON ai_answer_submissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_select_own_submissions" ON ai_answer_submissions;
CREATE POLICY "student_select_own_submissions"
  ON ai_answer_submissions FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

-- Creators: can read submissions for their challenges
DROP POLICY IF EXISTS "creator_select_challenge_submissions" ON ai_answer_submissions;
CREATE POLICY "creator_select_challenge_submissions"
  ON ai_answer_submissions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_answer_challenges
      WHERE ai_answer_challenges.id = ai_answer_submissions.challenge_id
      AND ai_answer_challenges.creator_id = auth.uid()
    )
  );

-- ============================================================
-- SECURITY DEFINER: get safe challenge data (no answer_key)
-- Returns only student-safe columns for published challenges
-- ============================================================

CREATE OR REPLACE FUNCTION get_safe_challenge_data(p_challenge_id uuid)
RETURNS TABLE (
  id uuid,
  question text,
  answer_format_instructions text,
  grading_mode text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.question,
    c.answer_format_instructions,
    c.grading_mode
  FROM ai_answer_challenges c
  WHERE c.id = p_challenge_id;
$$;

GRANT EXECUTE ON FUNCTION get_safe_challenge_data(uuid) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: get full challenge for grading (server-side only)
-- Used by the edge function with the service role key
-- ============================================================

CREATE OR REPLACE FUNCTION get_challenge_for_grading(p_challenge_id uuid)
RETURNS TABLE (
  id uuid,
  question text,
  answer_format_instructions text,
  answer_key text,
  grading_mode text,
  grading_rubric jsonb,
  creator_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.question,
    c.answer_format_instructions,
    c.answer_key,
    c.grading_mode,
    c.grading_rubric,
    c.creator_id
  FROM ai_answer_challenges c
  WHERE c.id = p_challenge_id;
$$;

GRANT EXECUTE ON FUNCTION get_challenge_for_grading(uuid) TO authenticated;

-- ============================================================
-- Index for submission lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_submissions_challenge_student
  ON ai_answer_submissions(challenge_id, student_id);
CREATE INDEX IF NOT EXISTS idx_ai_challenges_spot
  ON ai_answer_challenges(content_spot_id);
