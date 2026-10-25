/*
# Create Coaching Progress Tracker

1. Purpose
   Longitudinal coaching development tracker for Student Center.
   Stores immutable analytics snapshots, uploaded graph screenshots, coach targets,
   and comments — all scoped to a coaching relationship (workspace_key + player_id + coach_id).

2. New Tables
   - coaching_progress_profiles: one per coaching relationship, stores coaching start date
   - coaching_progress_snapshots: frozen analytics snapshots (baseline + checkpoints)
   - coaching_progress_images: uploaded graph screenshots attached to snapshots
   - coaching_progress_targets: coach-defined metric targets for the student
   - coaching_progress_comments: per-snapshot student/coach notes

3. Security
   - RLS enabled on all tables.
   - Anon + authenticated CRUD (demo app with no real auth screen).
   - Snapshots are immutable: UPDATE/DELETE policies are NOT granted, preserving historical accuracy.

4. Notes
   - analytics_snapshot is a JSONB column storing the full metrics at capture time.
   - marker_position stores 0-100 percentage for the coaching-start overlay on uploaded graphs.
   - marker_type: 'exact' (from hand data), 'estimated' (system guess), 'manual' (user adjusted).
*/

-- ── Profiles ──
CREATE TABLE IF NOT EXISTS coaching_progress_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_key text NOT NULL,
  player_id text NOT NULL,
  coach_id text,
  coaching_start_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_progress_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coaching_progress_profiles_lookup
  ON coaching_progress_profiles (workspace_key, player_id);

DROP POLICY IF EXISTS "anon_select_progress_profiles" ON coaching_progress_profiles;
CREATE POLICY "anon_select_progress_profiles" ON coaching_progress_profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_progress_profiles" ON coaching_progress_profiles;
CREATE POLICY "anon_insert_progress_profiles" ON coaching_progress_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_progress_profiles" ON coaching_progress_profiles;
CREATE POLICY "anon_update_progress_profiles" ON coaching_progress_profiles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Snapshots (immutable) ──
CREATE TABLE IF NOT EXISTS coaching_progress_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES coaching_progress_profiles(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL DEFAULT 'checkpoint',
  captured_at timestamptz DEFAULT now(),
  total_hands integer DEFAULT 0,
  total_games integer DEFAULT 0,
  analytics_snapshot jsonb NOT NULL DEFAULT '{}',
  student_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_progress_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coaching_progress_snapshots_profile_idx
  ON coaching_progress_snapshots (profile_id, captured_at);

DROP POLICY IF EXISTS "anon_select_progress_snapshots" ON coaching_progress_snapshots;
CREATE POLICY "anon_select_progress_snapshots" ON coaching_progress_snapshots
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_progress_snapshots" ON coaching_progress_snapshots;
CREATE POLICY "anon_insert_progress_snapshots" ON coaching_progress_snapshots
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Intentionally NO UPDATE or DELETE policies — snapshots are immutable.

-- ── Images ──
CREATE TABLE IF NOT EXISTS coaching_progress_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES coaching_progress_snapshots(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  marker_position numeric DEFAULT 50,
  marker_type text DEFAULT 'estimated',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_progress_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coaching_progress_images_snapshot_idx
  ON coaching_progress_images (snapshot_id);

DROP POLICY IF EXISTS "anon_select_progress_images" ON coaching_progress_images;
CREATE POLICY "anon_select_progress_images" ON coaching_progress_images
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_progress_images" ON coaching_progress_images;
CREATE POLICY "anon_insert_progress_images" ON coaching_progress_images
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_progress_images" ON coaching_progress_images;
CREATE POLICY "anon_update_progress_images" ON coaching_progress_images
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Targets ──
CREATE TABLE IF NOT EXISTS coaching_progress_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES coaching_progress_profiles(id) ON DELETE CASCADE,
  metric text NOT NULL,
  target_min numeric,
  target_max numeric,
  target_direction text DEFAULT 'any',
  coach_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_progress_targets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coaching_progress_targets_profile_idx
  ON coaching_progress_targets (profile_id);

DROP POLICY IF EXISTS "anon_select_progress_targets" ON coaching_progress_targets;
CREATE POLICY "anon_select_progress_targets" ON coaching_progress_targets
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_progress_targets" ON coaching_progress_targets;
CREATE POLICY "anon_insert_progress_targets" ON coaching_progress_targets
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_progress_targets" ON coaching_progress_targets;
CREATE POLICY "anon_update_progress_targets" ON coaching_progress_targets
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_progress_targets" ON coaching_progress_targets;
CREATE POLICY "anon_delete_progress_targets" ON coaching_progress_targets
  FOR DELETE TO anon, authenticated USING (true);

-- ── Comments ──
CREATE TABLE IF NOT EXISTS coaching_progress_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES coaching_progress_snapshots(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  author_role text NOT NULL DEFAULT 'student',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_progress_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coaching_progress_comments_snapshot_idx
  ON coaching_progress_comments (snapshot_id, created_at);

DROP POLICY IF EXISTS "anon_select_progress_comments" ON coaching_progress_comments;
CREATE POLICY "anon_select_progress_comments" ON coaching_progress_comments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_progress_comments" ON coaching_progress_comments;
CREATE POLICY "anon_insert_progress_comments" ON coaching_progress_comments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
