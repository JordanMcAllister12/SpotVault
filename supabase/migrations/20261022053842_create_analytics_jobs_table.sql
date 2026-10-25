/*
# Create poker_analytics_jobs table for single-job recalculation lock

## Purpose
Prevents concurrent recalculateAnalytics calls from running simultaneously
for the same user + mode. Multiple browser tabs or component re-mounts can
trigger recalculation, causing duplicate work, race conditions, and wasted
resources for 62k+ hand datasets.

## New Table
- `poker_analytics_jobs`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null — the user whose analytics are being calculated)
  - `mode` (text, not null — 'cash' or 'mtt')
  - `status` (text, not null — 'running', 'completed', 'failed')
  - `started_at` (timestamptz, default now())
  - `completed_at` (timestamptz, nullable)
  - `hands_processed` (integer, nullable)
  - `hands_total` (integer, nullable)
  - `error_message` (text, nullable)
  - `duration_ms` (integer, nullable)

## Lock Mechanism
A partial unique index on (user_id, mode) WHERE status = 'running' ensures
only one recalculation job can be active per user+mode at a time. Attempting
to INSERT a second 'running' row fails with a unique constraint violation,
which the client treats as "another job is already running."

## Stale Job Cleanup
A separate index on (user_id, mode, status) allows efficient queries to
find and clean up stale jobs (e.g., a job that crashed without updating).

## Security
- RLS enabled
- Users can only see/manage their own jobs (auth.uid() = user_id)
- 4 separate policies for SELECT, INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS poker_analytics_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  hands_processed integer,
  hands_total integer,
  error_message text,
  duration_ms integer
);

ALTER TABLE poker_analytics_jobs ENABLE ROW LEVEL SECURITY;

-- Partial unique index: only one 'running' job per user+mode
CREATE UNIQUE INDEX IF NOT EXISTS poker_analytics_jobs_running_unique
  ON poker_analytics_jobs (user_id, mode)
  WHERE status = 'running';

-- Index for querying active/stale jobs
CREATE INDEX IF NOT EXISTS poker_analytics_jobs_user_mode_status
  ON poker_analytics_jobs (user_id, mode, status);

DROP POLICY IF EXISTS "select_own_analytics_jobs" ON poker_analytics_jobs;
CREATE POLICY "select_own_analytics_jobs" ON poker_analytics_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_analytics_jobs" ON poker_analytics_jobs;
CREATE POLICY "insert_own_analytics_jobs" ON poker_analytics_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_analytics_jobs" ON poker_analytics_jobs;
CREATE POLICY "update_own_analytics_jobs" ON poker_analytics_jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_analytics_jobs" ON poker_analytics_jobs;
CREATE POLICY "delete_own_analytics_jobs" ON poker_analytics_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
