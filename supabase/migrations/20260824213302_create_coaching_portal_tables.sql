/*
# Coaching Portal — Profile Builder, Results Gallery, Reviews, Homework

## Purpose
Extends the existing coaching infrastructure to support the redesigned Coaching Portal:
coach profile/ad builder, results/credentials gallery, student reviews, coaching impact
snapshots, and student homework assignments.

## 1. Extended `coach_listings` table (ALTER)
Adds columns to support the full coach profile/ad builder:
- `real_name` — optional real name (separate from display name)
- `profile_photo_url` — URL to uploaded profile photo
- `poker_usernames` — JSONB array of {site, username} objects
- `primary_games` — text[] of game types (MTT, Cash, Spin & Go, etc.)
- `timezone` — coach's timezone string
- `min_session_length` — minimum session length in minutes
- `package_pricing` — JSONB array of {name, sessions, price} objects
- `custom_pricing` — boolean toggle for "Contact for custom pricing"
- `coaching_description` — large text field for the coaching description
- `coaching_includes` — text[] of structured coaching offerings (hand review, GTO, etc.)
- `available_for_coaching` — boolean ON/OFF toggle (hides from marketplace when OFF)
- `profile_completion_pct` — integer 0-100, computed/updated by the app
- `profile_views` — integer counter for profile page views
- `currency` — currency code for rates (USD, EUR, etc.)

## 2. New Table: `coach_result_images`
Image/media gallery for coaches to upload results screenshots (SharkScope, Hendon Mob, etc.)
- `id` — UUID PK
- `coach_account_id` — text, links to coach's account
- `image_url` — URL to uploaded image
- `caption` — optional caption/label
- `image_type` — category (sharkscope, hendon_mob, tournament_win, etc.)
- `sort_order` — integer for reordering
- `is_featured` — boolean for featured image
- `created_at` — timestamp

## 3. New Table: `coach_reviews`
Student reviews of coaching sessions
- `id` — UUID PK
- `coach_account_id` — text
- `student_account_id` — text
- `booking_id` — optional UUID FK to bookings
- `overall_rating` — 1-5 stars
- `strategy_knowledge` — optional 1-5
- `communication` — optional 1-5
- `preparation` — optional 1-5
- `value` — optional 1-5
- `professionalism` — optional 1-5
- `written_review` — text
- `coach_response` — optional text (coach can respond but NOT delete)
- `is_verified_student` — boolean (true if from completed booking)
- `created_at` — timestamp
- `coach_response_at` — timestamp

## 4. New Table: `coach_impact_snapshots`
Aggregated coaching impact metrics for the coach dashboard
- `id` — UUID PK
- `coach_account_id` — text
- `snapshot_date` — date
- `active_students` — integer
- `avg_spi_improvement` — numeric
- `avg_roi_improvement` — numeric
- `avg_bb100_improvement` — numeric
- `pct_students_improved` — numeric (0-100)
- `total_hours_coached` — numeric
- `monthly_revenue` — numeric
- `created_at` — timestamp

## 5. New Table: `student_homework`
Homework/assignments assigned by coach to students
- `id` — UUID PK
- `coach_account_id` — text
- `student_account_id` — text
- `assignment_type` — text (hand, spot, course, video, quiz, solver_exercise, notes, analytics_review)
- `resource_id` — optional text (e.g. hand_id for hands)
- `title` — text
- `description` — optional text
- `status` — text (assigned, started, completed)
- `due_date` — optional date
- `created_at` — timestamp
- `started_at` — optional timestamp
- `completed_at` — optional timestamp

## Security
All tables use the demo-auth pattern (account_id text, no auth.users FK).
RLS enabled on all new tables with open anon/authenticated access since
the app uses demo auth. The coach_account_id column serves as ownership
filtering in the application layer.
*/

-- ── 1. Extend coach_listings ──
ALTER TABLE coach_listings
  ADD COLUMN IF NOT EXISTS real_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_photo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS poker_usernames jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_games text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS min_session_length integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS package_pricing jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_pricing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS coaching_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS coaching_includes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS available_for_coaching boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_completion_pct integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

-- ── 2. coach_result_images ──
CREATE TABLE IF NOT EXISTS coach_result_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_account_id text NOT NULL,
  image_url text NOT NULL,
  caption text DEFAULT '',
  image_type text DEFAULT 'other',
  sort_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coach_result_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_result_images" ON coach_result_images;
CREATE POLICY "anon_select_result_images" ON coach_result_images FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_result_images" ON coach_result_images;
CREATE POLICY "anon_insert_result_images" ON coach_result_images FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_result_images" ON coach_result_images;
CREATE POLICY "anon_update_result_images" ON coach_result_images FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_result_images" ON coach_result_images;
CREATE POLICY "anon_delete_result_images" ON coach_result_images FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_result_images_coach ON coach_result_images(coach_account_id, sort_order);

-- ── 3. coach_reviews ──
CREATE TABLE IF NOT EXISTS coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_account_id text NOT NULL,
  student_account_id text NOT NULL,
  booking_id uuid,
  overall_rating integer NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strategy_knowledge integer CHECK (strategy_knowledge IS NULL OR (strategy_knowledge >= 1 AND strategy_knowledge <= 5)),
  communication integer CHECK (communication IS NULL OR (communication >= 1 AND communication <= 5)),
  preparation integer CHECK (preparation IS NULL OR (preparation >= 1 AND preparation <= 5)),
  value integer CHECK (value IS NULL OR (value >= 1 AND value <= 5)),
  professionalism integer CHECK (professionalism IS NULL OR (professionalism >= 1 AND professionalism <= 5)),
  written_review text DEFAULT '',
  coach_response text DEFAULT '',
  is_verified_student boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  coach_response_at timestamptz
);
ALTER TABLE coach_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_reviews" ON coach_reviews;
CREATE POLICY "anon_select_reviews" ON coach_reviews FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reviews" ON coach_reviews;
CREATE POLICY "anon_insert_reviews" ON coach_reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reviews" ON coach_reviews;
CREATE POLICY "anon_update_reviews" ON coach_reviews FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reviews" ON coach_reviews;
CREATE POLICY "anon_delete_reviews" ON coach_reviews FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_reviews_coach ON coach_reviews(coach_account_id, created_at DESC);

-- ── 4. coach_impact_snapshots ──
CREATE TABLE IF NOT EXISTS coach_impact_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_account_id text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  active_students integer DEFAULT 0,
  avg_spi_improvement numeric DEFAULT 0,
  avg_roi_improvement numeric DEFAULT 0,
  avg_bb100_improvement numeric DEFAULT 0,
  pct_students_improved numeric DEFAULT 0,
  total_hours_coached numeric DEFAULT 0,
  monthly_revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coach_impact_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_impact" ON coach_impact_snapshots;
CREATE POLICY "anon_select_impact" ON coach_impact_snapshots FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_impact" ON coach_impact_snapshots;
CREATE POLICY "anon_insert_impact" ON coach_impact_snapshots FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_impact" ON coach_impact_snapshots;
CREATE POLICY "anon_update_impact" ON coach_impact_snapshots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_impact" ON coach_impact_snapshots;
CREATE POLICY "anon_delete_impact" ON coach_impact_snapshots FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_impact_coach ON coach_impact_snapshots(coach_account_id, snapshot_date DESC);

-- ── 5. student_homework ──
CREATE TABLE IF NOT EXISTS student_homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_account_id text NOT NULL,
  student_account_id text NOT NULL,
  assignment_type text NOT NULL DEFAULT 'notes',
  resource_id text DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'assigned',
  due_date date,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
ALTER TABLE student_homework ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_homework" ON student_homework;
CREATE POLICY "anon_select_homework" ON student_homework FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_homework" ON student_homework;
CREATE POLICY "anon_insert_homework" ON student_homework FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_homework" ON student_homework;
CREATE POLICY "anon_update_homework" ON student_homework FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_homework" ON student_homework;
CREATE POLICY "anon_delete_homework" ON student_homework FOR DELETE
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_homework_student ON student_homework(student_account_id, status);
CREATE INDEX IF NOT EXISTS idx_homework_coach ON student_homework(coach_account_id, created_at DESC);
