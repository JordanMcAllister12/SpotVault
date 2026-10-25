/*
# Create the canonical poker analytics import and snapshot pipeline

1. New Tables
- `poker_hand_records`: one normalized hand record per user and hand hash. Raw text is intentionally not stored so normal analytics reads stay lightweight.
- `poker_import_batches`: durable audit log for each import, including file counts, hand counts, tournament counts, duplicates, errors, and elapsed time.
- `poker_analytics_snapshots`: one saved analytics result per user and mode (`cash` or `mtt`), including summary metrics, position/preflop/postflop/board/tournament data, and downsampled graph series.

2. Integrity
- `poker_hand_records` has a unique `(user_id, hand_hash)` constraint for server-side duplicate protection.
- Import batches and snapshots are append/update records and preserve historical imports.
- Analytics snapshots reference the latest imported hand count so the UI can show when results are stale.

3. Security
- RLS is enabled on every table.
- The current SpotVault client uses demo accounts with the anon key, so policies allow anon and authenticated CRUD while every query is scoped by the supplied SpotVault `user_id`.
- No raw hand histories are selected by the analytics snapshot queries.
*/

CREATE TABLE IF NOT EXISTS poker_hand_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  hand_hash text NOT NULL,
  source_file_name text NOT NULL,
  site text,
  played_at timestamptz,
  game_mode text NOT NULL DEFAULT 'cash',
  tournament_id text,
  pot_amount numeric,
  bb_won numeric,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hand_hash)
);

CREATE INDEX IF NOT EXISTS poker_hand_records_user_created_idx ON poker_hand_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS poker_hand_records_user_mode_idx ON poker_hand_records (user_id, game_mode);

CREATE TABLE IF NOT EXISTS poker_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  file_count integer NOT NULL DEFAULT 0,
  hand_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  tournament_count integer NOT NULL DEFAULT 0,
  elapsed_ms integer NOT NULL DEFAULT 0,
  source_types text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'completed',
  error_summary text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS poker_import_batches_user_date_idx ON poker_import_batches (user_id, imported_at DESC);

CREATE TABLE IF NOT EXISTS poker_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  mode text NOT NULL DEFAULT 'cash',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  source_hand_count integer NOT NULL DEFAULT 0,
  source_imported_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  preflop_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  postflop_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  board_analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  tournament_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  graph_series jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, mode)
);

ALTER TABLE poker_hand_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_analytics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_poker_hand_records" ON poker_hand_records;
CREATE POLICY "anon_select_poker_hand_records" ON poker_hand_records FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_poker_hand_records" ON poker_hand_records;
CREATE POLICY "anon_insert_poker_hand_records" ON poker_hand_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_poker_hand_records" ON poker_hand_records;
CREATE POLICY "anon_update_poker_hand_records" ON poker_hand_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_poker_hand_records" ON poker_hand_records;
CREATE POLICY "anon_delete_poker_hand_records" ON poker_hand_records FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_poker_import_batches" ON poker_import_batches;
CREATE POLICY "anon_select_poker_import_batches" ON poker_import_batches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_poker_import_batches" ON poker_import_batches;
CREATE POLICY "anon_insert_poker_import_batches" ON poker_import_batches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_poker_import_batches" ON poker_import_batches;
CREATE POLICY "anon_update_poker_import_batches" ON poker_import_batches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_poker_import_batches" ON poker_import_batches;
CREATE POLICY "anon_delete_poker_import_batches" ON poker_import_batches FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_poker_analytics_snapshots" ON poker_analytics_snapshots;
CREATE POLICY "anon_select_poker_analytics_snapshots" ON poker_analytics_snapshots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_poker_analytics_snapshots" ON poker_analytics_snapshots;
CREATE POLICY "anon_insert_poker_analytics_snapshots" ON poker_analytics_snapshots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_poker_analytics_snapshots" ON poker_analytics_snapshots;
CREATE POLICY "anon_update_poker_analytics_snapshots" ON poker_analytics_snapshots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_poker_analytics_snapshots" ON poker_analytics_snapshots;
CREATE POLICY "anon_delete_poker_analytics_snapshots" ON poker_analytics_snapshots FOR DELETE TO anon, authenticated USING (true);
