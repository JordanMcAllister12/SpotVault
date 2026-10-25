/*
# Create solver_jobs table for SpotVault Solver

1. New Tables
- `solver_jobs` — stores poker solver job configurations and results
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `provider` (text, not null) — which solver provider handled this job (e.g. 'mock', 'deepsolver')
  - `provider_job_id` (text, nullable) — external job ID from the solver provider
  - `game_type` (text, not null) — 'nlhe' for No Limit Hold'em (future-proofed for other games)
  - `format` (text, not null) — 'tournament' or 'cash'
  - `hero_position` (text, not null) — UTG, UTG+1, LJ, HJ, CO, BTN, SB, BB
  - `villain_position` (text, not null) — same options as hero
  - `effective_stack_bb` (numeric, not null) — effective stack in big blinds
  - `pot_size_bb` (numeric, not null) — current pot size in big blinds
  - `board` (jsonb, not null) — array of board cards, e.g. ["Ah", "7d", "2c"]
  - `action_history` (jsonb, not null) — array of action objects describing how the spot was reached
  - `hero_range` (jsonb, not null) — range data for hero (169 hand cells with weights)
  - `villain_range` (jsonb, not null) — range data for villain
  - `tree_settings` (jsonb, not null) — advanced solver settings (bet sizes, raise sizes, etc.)
  - `accuracy_setting` (text, not null default 'standard') — 'fast', 'standard', or 'high'
  - `status` (text, not null default 'draft') — 'draft', 'processing', 'complete', 'failed'
  - `error_message` (text, nullable) — error details if status is 'failed'
  - `result_data` (jsonb, nullable) — normalized solver result (strategy tree, frequencies, EV, equity)
  - `saved_to_library` (boolean, not null default false) — whether the user saved this solve to their vault
  - `library_entry_id` (uuid, nullable) — FK to solver_library_entries if saved
  - `is_favorite` (boolean, not null default false) — user can favorite solves
  - `created_at` (timestamptz, default now())
  - `started_at` (timestamptz, nullable) — when processing began
  - `completed_at` (timestamptz, nullable) — when processing finished
- `solver_library_entries` — saved solver spots in the user's vault
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `solver_job_id` (uuid, nullable, references solver_jobs)
  - `title` (text, not null) — user-provided title
  - `notes` (text, nullable) — user notes
  - `tags` (text[], default '{}') — user tags
  - `category` (text, nullable) — user category
  - `config_snapshot` (jsonb, not null) — the solver configuration at save time
  - `result_reference` (jsonb, nullable) — either full result data, selected nodes, or provider result ID
  - `created_at` (timestamptz, default now())

2. Indexes
- `idx_solver_jobs_user` on solver_jobs(user_id) — user's own solves
- `idx_solver_jobs_status` on solver_jobs(status) — admin monitoring by status
- `idx_solver_jobs_provider` on solver_jobs(provider) — admin monitoring by provider
- `idx_solver_library_user` on solver_library_entries(user_id)

3. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
- user_id defaults to auth.uid() so inserts that omit user_id succeed.
*/

CREATE TABLE IF NOT EXISTS solver_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  provider_job_id text,
  game_type text NOT NULL DEFAULT 'nlhe',
  format text NOT NULL DEFAULT 'tournament',
  hero_position text NOT NULL,
  villain_position text NOT NULL,
  effective_stack_bb numeric NOT NULL,
  pot_size_bb numeric NOT NULL DEFAULT 0,
  board jsonb NOT NULL DEFAULT '[]',
  action_history jsonb NOT NULL DEFAULT '[]',
  hero_range jsonb NOT NULL DEFAULT '{}',
  villain_range jsonb NOT NULL DEFAULT '{}',
  tree_settings jsonb NOT NULL DEFAULT '{}',
  accuracy_setting text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'draft',
  error_message text,
  result_data jsonb,
  saved_to_library boolean NOT NULL DEFAULT false,
  library_entry_id uuid,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE solver_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_solver_jobs" ON solver_jobs;
CREATE POLICY "select_own_solver_jobs" ON solver_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_solver_jobs" ON solver_jobs;
CREATE POLICY "insert_own_solver_jobs" ON solver_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_solver_jobs" ON solver_jobs;
CREATE POLICY "update_own_solver_jobs" ON solver_jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_solver_jobs" ON solver_jobs;
CREATE POLICY "delete_own_solver_jobs" ON solver_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_solver_jobs_user ON solver_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_solver_jobs_status ON solver_jobs(status);
CREATE INDEX IF NOT EXISTS idx_solver_jobs_provider ON solver_jobs(provider);

CREATE TABLE IF NOT EXISTS solver_library_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  solver_job_id uuid REFERENCES solver_jobs(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  category text,
  config_snapshot jsonb NOT NULL DEFAULT '{}',
  result_reference jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE solver_library_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_solver_library" ON solver_library_entries;
CREATE POLICY "select_own_solver_library" ON solver_library_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_solver_library" ON solver_library_entries;
CREATE POLICY "insert_own_solver_library" ON solver_library_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_solver_library" ON solver_library_entries;
CREATE POLICY "update_own_solver_library" ON solver_library_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_solver_library" ON solver_library_entries;
CREATE POLICY "delete_own_solver_library" ON solver_library_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_solver_library_user ON solver_library_entries(user_id);
