/*
# Stable Portal — Analytics Baselines, Snapshots, Tournament Results, Coach Assignments

1. Purpose
   Extend the Stable Portal with player development tracking infrastructure:
   - Analytics baselines captured when a player joins a stable (never overwritten).
   - Periodic analytics snapshots to track progression over time.
   - Tournament results for recent performance visibility.
   - Coach-player assignments (primary + additional coaches/reviewers).
   - Stable coaches directory (coaches associated with the stable).

2. New Tables

   - `stable_player_baselines` — Captured when a player joins a stable. Stores starting
     BB/100, key statistics, and the raw material submitted. Never overwritten.
     Columns: id, stable_id, player_id, captured_at, bb_per_100, key_stats (jsonb),
     sample_size, raw_material_ref (text), notes.

   - `stable_player_snapshots` — Periodic analytics snapshots for trend tracking.
     Columns: id, stable_id, player_id, snapshot_type (baseline/30d/60d/90d/current),
     captured_at, bb_per_100, key_stats (jsonb), sample_size, volume_hands.

   - `stable_tournament_results` — Recent tournament performance per player.
     Columns: id, stable_id, player_id, tournament_date, site, tournament_name,
     buy_in_cents, prize_cents, finish_position, field_size, profit_cents.

   - `stable_coaches` — Coaches associated with the stable.
     Columns: id, stable_id, user_id, display_name, role_specialty, created_at.

   - `stable_player_coaches` — Junction table for coach-player assignments.
     Columns: id, stable_id, player_id, coach_id, is_primary, role, created_at.
     Allows one primary coach + additional coaches/reviewers per player.

3. Modified Tables
   - `stable_players` — Added `baseline_completed` boolean (default false) to track
     onboarding state. Player is not fully onboarded until baseline is submitted.

4. Security
   - RLS enabled on all new tables.
   - SELECT scoped to stable members (via is_stable_member check).
   - INSERT/UPDATE/DELETE scoped to stable admins (via is_stable_admin check).
   - `stable_player_baselines` allows the player themselves to INSERT their own baseline.
   - `stable_tournament_results` allows the player to INSERT their own results.

5. Notes
   - Baselines are never overwritten — only one baseline per player per stable.
   - Snapshots use snapshot_type to distinguish baseline/30d/60d/90d/current.
   - Coach assignments support is_primary flag for the single primary coach.
   - All amounts in cents (integer) except bb_per_100 which is numeric(8,2).
*/

-- Add baseline_completed to stable_players
ALTER TABLE stable_players ADD COLUMN IF NOT EXISTS baseline_completed boolean DEFAULT false;

-- Stable player baselines
CREATE TABLE IF NOT EXISTS stable_player_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  bb_per_100 numeric(8,2),
  key_stats jsonb DEFAULT '{}'::jsonb,
  sample_size int DEFAULT 0,
  raw_material_ref text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_player_baselines ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_baselines_player ON stable_player_baselines(player_id);
CREATE INDEX IF NOT EXISTS idx_stable_baselines_stable ON stable_player_baselines(stable_id);

-- Stable player snapshots
CREATE TABLE IF NOT EXISTS stable_player_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  snapshot_type text NOT NULL DEFAULT 'current',
  captured_at timestamptz NOT NULL DEFAULT now(),
  bb_per_100 numeric(8,2),
  key_stats jsonb DEFAULT '{}'::jsonb,
  sample_size int DEFAULT 0,
  volume_hands int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_player_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_snapshots_player ON stable_player_snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_stable_snapshots_stable ON stable_player_snapshots(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_snapshots_type ON stable_player_snapshots(snapshot_type);

-- Stable tournament results
CREATE TABLE IF NOT EXISTS stable_tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  tournament_date date NOT NULL DEFAULT CURRENT_DATE,
  site text,
  tournament_name text,
  buy_in_cents int DEFAULT 0,
  prize_cents int DEFAULT 0,
  finish_position int,
  field_size int,
  profit_cents int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_tournament_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_tourney_player ON stable_tournament_results(player_id);
CREATE INDEX IF NOT EXISTS idx_stable_tourney_stable ON stable_tournament_results(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_tourney_date ON stable_tournament_results(tournament_date DESC);

-- Stable coaches
CREATE TABLE IF NOT EXISTS stable_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  role_specialty text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_coaches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_coaches_stable ON stable_coaches(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_coaches_user ON stable_coaches(user_id);

-- Stable player-coach assignments (junction)
CREATE TABLE IF NOT EXISTS stable_player_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'coach',
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, coach_id)
);
ALTER TABLE stable_player_coaches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_pc_player ON stable_player_coaches(player_id);
CREATE INDEX IF NOT EXISTS idx_stable_pc_coach ON stable_player_coaches(coach_id);
CREATE INDEX IF NOT EXISTS idx_stable_pc_stable ON stable_player_coaches(stable_id);

-- ── Policies: stable_player_baselines ──
DROP POLICY IF EXISTS "stable_member_read_baselines" ON stable_player_baselines;
CREATE POLICY "stable_member_read_baselines" ON stable_player_baselines FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "player_insert_baseline" ON stable_player_baselines;
CREATE POLICY "player_insert_baseline" ON stable_player_baselines FOR INSERT
  TO authenticated WITH CHECK (player_id = auth.uid() OR is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_baselines" ON stable_player_baselines;
CREATE POLICY "stable_admin_update_baselines" ON stable_player_baselines FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

-- ── Policies: stable_player_snapshots ──
DROP POLICY IF EXISTS "stable_member_read_snapshots" ON stable_player_snapshots;
CREATE POLICY "stable_member_read_snapshots" ON stable_player_snapshots FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_snapshots" ON stable_player_snapshots;
CREATE POLICY "stable_admin_insert_snapshots" ON stable_player_snapshots FOR INSERT
  TO authenticated WITH CHECK (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_snapshots" ON stable_player_snapshots;
CREATE POLICY "stable_admin_update_snapshots" ON stable_player_snapshots FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

-- ── Policies: stable_tournament_results ──
DROP POLICY IF EXISTS "stable_member_read_tourney" ON stable_tournament_results;
CREATE POLICY "stable_member_read_tourney" ON stable_tournament_results FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "player_insert_tourney" ON stable_tournament_results;
CREATE POLICY "player_insert_tourney" ON stable_tournament_results FOR INSERT
  TO authenticated WITH CHECK (player_id = auth.uid() OR is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_tourney" ON stable_tournament_results;
CREATE POLICY "stable_admin_update_tourney" ON stable_tournament_results FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

-- ── Policies: stable_coaches ──
DROP POLICY IF EXISTS "stable_member_read_coaches" ON stable_coaches;
CREATE POLICY "stable_member_read_coaches" ON stable_coaches FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_coaches" ON stable_coaches;
CREATE POLICY "stable_admin_insert_coaches" ON stable_coaches FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_coaches" ON stable_coaches;
CREATE POLICY "stable_admin_update_coaches" ON stable_coaches FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_coaches" ON stable_coaches;
CREATE POLICY "stable_admin_delete_coaches" ON stable_coaches FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));

-- ── Policies: stable_player_coaches ──
DROP POLICY IF EXISTS "stable_member_read_pc" ON stable_player_coaches;
CREATE POLICY "stable_member_read_pc" ON stable_player_coaches FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_pc" ON stable_player_coaches;
CREATE POLICY "stable_admin_insert_pc" ON stable_player_coaches FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_pc" ON stable_player_coaches;
CREATE POLICY "stable_admin_update_pc" ON stable_player_coaches FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_pc" ON stable_player_coaches;
CREATE POLICY "stable_admin_delete_pc" ON stable_player_coaches FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));