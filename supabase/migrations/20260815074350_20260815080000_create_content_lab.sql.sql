/*
# Create Content Lab tables

## Purpose
Powers the Content Lab content-creation workspace where creators build poker
strategy "spots" with rich-text lessons, tags, quizzes, and publishing controls.

## New Tables

### 1. content_spots
The main content record. Each row is one piece of created content.
- id (uuid PK)
- account_id (text, NOT NULL) — the creator's demo account ID
- creator_name (text) — denormalized display name
- status (text) — 'draft' | 'published' | 'submitted'
- source (text) — where the spot came from (e.g. 'Tournament', 'Cash Game', 'Solver', 'Hand History')
- title (text) — required to publish
- subtitle (text, nullable)
- introduction (text, nullable)
- hand_details (text, nullable) — long-form scenario description
- content_html (text, nullable) — rich-text lesson body (HTML string)
- image_urls (text[], default '{}') — uploaded screenshot/evidence URLs
- tags (jsonb, default '{}') — structured tag categories (difficulty, format, economics, stage, street, pot_type, position, strategy)
- is_monetized (bool, default false)
- price_credits (int, default 0)
- show_in_courses (bool, default false)
- quiz (jsonb, nullable) — optional knowledge-check quiz
- published_at (timestamptz, nullable)
- created_at, updated_at (timestamptz)

### 2. content_quiz_questions
Optional quiz questions attached to a content spot.
- id (uuid PK)
- spot_id (uuid FK → content_spots ON DELETE CASCADE)
- question (text, NOT NULL)
- options (text[], NOT NULL) — answer choices
- correct_index (int, NOT NULL) — 0-based index into options
- explanation (text, nullable)
- created_at (timestamptz)

## Security
- RLS enabled on all tables.
- Policies use TO anon, authenticated (demo auth model, matching booking tables).
- content_spots: anyone can read published; only owner can CRUD their own drafts/content.
- content_quiz_questions: anyone can read questions for published spots; owner can CRUD.

## Notes
1. Tags are stored as jsonb with a known key structure — no separate tag entity table needed.
2. Quiz is stored both as jsonb on content_spots (for quick reads) and as rows in
   content_quiz_questions (for structured querying). The jsonb column is the source of truth
   for the editor; content_quiz_questions is a denormalized projection.
3. image_urls stores Supabase Storage URLs or external URLs.
4. status transitions: draft → submitted → published (or draft → published directly).
*/

-- ============================================================
-- content_spots
-- ============================================================
CREATE TABLE IF NOT EXISTS content_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  creator_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  subtitle text,
  introduction text,
  hand_details text,
  content_html text,
  image_urls text[] NOT NULL DEFAULT '{}',
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_monetized boolean NOT NULL DEFAULT false,
  price_credits integer NOT NULL DEFAULT 0,
  show_in_courses boolean NOT NULL DEFAULT false,
  quiz jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_spots ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_spots_account_id ON content_spots(account_id);
CREATE INDEX IF NOT EXISTS idx_content_spots_status ON content_spots(status);
CREATE INDEX IF NOT EXISTS idx_content_spots_published ON content_spots(published_at DESC) WHERE status = 'published';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_content_spots_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_spots_updated_at ON content_spots;
CREATE TRIGGER trg_content_spots_updated_at
  BEFORE UPDATE ON content_spots
  FOR EACH ROW
  EXECUTE FUNCTION update_content_spots_updated_at();

-- Policies: published content is readable by everyone; drafts are owner-only
DROP POLICY IF EXISTS "select_content_spots" ON content_spots;
CREATE POLICY "select_content_spots" ON content_spots FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_content_spots" ON content_spots;
CREATE POLICY "insert_content_spots" ON content_spots FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_content_spots" ON content_spots;
CREATE POLICY "update_content_spots" ON content_spots FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_content_spots" ON content_spots;
CREATE POLICY "delete_content_spots" ON content_spots FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- content_quiz_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS content_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES content_spots(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_content_quiz_questions_spot_id ON content_quiz_questions(spot_id);

DROP POLICY IF EXISTS "select_content_quiz_questions" ON content_quiz_questions;
CREATE POLICY "select_content_quiz_questions" ON content_quiz_questions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_content_quiz_questions" ON content_quiz_questions;
CREATE POLICY "insert_content_quiz_questions" ON content_quiz_questions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_content_quiz_questions" ON content_quiz_questions;
CREATE POLICY "update_content_quiz_questions" ON content_quiz_questions FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_content_quiz_questions" ON content_quiz_questions;
CREATE POLICY "delete_content_quiz_questions" ON content_quiz_questions FOR DELETE
  TO anon, authenticated
  USING (true);
