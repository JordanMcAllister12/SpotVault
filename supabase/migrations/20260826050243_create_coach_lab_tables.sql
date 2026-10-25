/*
# Coach Lab — Lessons, Review Sets, Student Submissions

## Purpose
Creates the database tables that power the Coach Lab workspace: a multi-panel
environment where coaches review student-submitted hands, build structured
lessons, attach notes and reference screenshots to individual hands, and
run review sessions with students.

## 1. New Table: `coach_lab_lessons`
Represents a lesson, review set, or student submission collection.
- `id` — UUID PK
- `coach_account_id` — text, the coach who owns this lesson
- `student_account_id` — optional text, the student (for submissions)
- `title` — text, lesson/submission title
- `description` — optional text, lesson summary or student's general note
- `collection_type` — text: 'lesson' | 'submission' | 'review_set'
- `status` — text: 'draft' | 'active' | 'archived' | 'needs_review' | 'in_review' | 'reviewed'
- `tags` — text[], optional category tags
- `student_note` — optional text, student's overall question/note
- `created_at` — timestamp
- `updated_at` — timestamp

## 2. New Table: `coach_lab_hands`
Individual hands within a lesson/submission, with ordering and per-hand notes.
- `id` — UUID PK
- `lesson_id` — UUID FK to coach_lab_lessons (CASCADE on delete)
- `hand_id` — text, references the poker_hand_records hand_id
- `title` — optional text, display title for this hand in the lesson
- `sort_order` — integer, manual ordering
- `review_status` — text: 'needs_review' | 'in_review' | 'reviewed' | 'follow_up'
- `student_preflop_note` — optional text
- `student_flop_note` — optional text
- `student_turn_note` — optional text
- `student_river_note` — optional text
- `student_general_note` — optional text
- `coach_note` — optional text, coach's teaching notes for this hand
- `created_at` — timestamp
- `updated_at` — timestamp

## 3. New Table: `coach_lab_hand_images`
Reference images/screenshots attached to a specific hand within a lesson.
- `id` — UUID PK
- `lab_hand_id` — UUID FK to coach_lab_hands (CASCADE on delete)
- `image_url` — text, URL to the uploaded image
- `caption` — optional text, image caption
- `sort_order` — integer
- `created_at` — timestamp

## Security
All tables use the demo-auth pattern (account_id text, no auth.users FK).
RLS enabled on all tables with open anon/authenticated CRUD access since
the app uses demo auth. The coach_account_id column serves as ownership
filtering in the application layer.
*/

-- ── 1. coach_lab_lessons ──
CREATE TABLE IF NOT EXISTS coach_lab_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_account_id text NOT NULL,
  student_account_id text DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  collection_type text NOT NULL DEFAULT 'lesson',
  status text NOT NULL DEFAULT 'draft',
  tags text[] DEFAULT '{}'::text[],
  student_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coach_lab_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_lab_lessons" ON coach_lab_lessons;
CREATE POLICY "anon_select_lab_lessons" ON coach_lab_lessons FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lab_lessons" ON coach_lab_lessons;
CREATE POLICY "anon_insert_lab_lessons" ON coach_lab_lessons FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_lab_lessons" ON coach_lab_lessons;
CREATE POLICY "anon_update_lab_lessons" ON coach_lab_lessons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lab_lessons" ON coach_lab_lessons;
CREATE POLICY "anon_delete_lab_lessons" ON coach_lab_lessons FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_lab_lessons_coach ON coach_lab_lessons(coach_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_lessons_type ON coach_lab_lessons(collection_type, status);

-- ── 2. coach_lab_hands ──
CREATE TABLE IF NOT EXISTS coach_lab_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES coach_lab_lessons(id) ON DELETE CASCADE,
  hand_id text NOT NULL DEFAULT '',
  title text DEFAULT '',
  sort_order integer DEFAULT 0,
  review_status text NOT NULL DEFAULT 'needs_review',
  student_preflop_note text DEFAULT '',
  student_flop_note text DEFAULT '',
  student_turn_note text DEFAULT '',
  student_river_note text DEFAULT '',
  student_general_note text DEFAULT '',
  coach_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coach_lab_hands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_lab_hands" ON coach_lab_hands;
CREATE POLICY "anon_select_lab_hands" ON coach_lab_hands FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lab_hands" ON coach_lab_hands;
CREATE POLICY "anon_insert_lab_hands" ON coach_lab_hands FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_lab_hands" ON coach_lab_hands;
CREATE POLICY "anon_update_lab_hands" ON coach_lab_hands FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lab_hands" ON coach_lab_hands;
CREATE POLICY "anon_delete_lab_hands" ON coach_lab_hands FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_lab_hands_lesson ON coach_lab_hands(lesson_id, sort_order);

-- ── 3. coach_lab_hand_images ──
CREATE TABLE IF NOT EXISTS coach_lab_hand_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_hand_id uuid NOT NULL REFERENCES coach_lab_hands(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coach_lab_hand_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_lab_images" ON coach_lab_hand_images;
CREATE POLICY "anon_select_lab_images" ON coach_lab_hand_images FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lab_images" ON coach_lab_hand_images;
CREATE POLICY "anon_insert_lab_images" ON coach_lab_hand_images FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_lab_images" ON coach_lab_hand_images;
CREATE POLICY "anon_update_lab_images" ON coach_lab_hand_images FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lab_images" ON coach_lab_hand_images;
CREATE POLICY "anon_delete_lab_images" ON coach_lab_hand_images FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_lab_images_hand ON coach_lab_hand_images(lab_hand_id, sort_order);