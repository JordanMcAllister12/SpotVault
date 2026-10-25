/*
# Create sv_workspace_hand_queue table

1. New Tables
- `sv_workspace_hand_queue` — a per-user persistent queue of hand IDs sent from
  the Hand Analyzer to the Hand Review Workspace. Each row represents one hand
  the user wants to review in the Workspace. Duplicates are prevented by a
  unique constraint on (user_id, hand_id). Rows are ordered by `sort_order`
  then `created_at`, so the Workspace can present them in the order the user
  queued them.
  Columns:
  - `id` (uuid, PK)
  - `user_id` (uuid, owner, NOT NULL, DEFAULT auth.uid())
  - `hand_id` (text, the poker_hand_records.hand_id value)
  - `sort_order` (int, defaults to 0; higher = later in queue)
  - `consumed` (bool, default false; set true once the Workspace opens it)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `sv_workspace_hand_queue`.
- Grant SELECT, INSERT, UPDATE, DELETE to `authenticated` only.
- Four owner-scoped policies (select/insert/update/delete) using auth.uid().
- user_id defaults to auth.uid() so inserts that omit it still satisfy WITH CHECK.
*/

CREATE TABLE IF NOT EXISTS sv_workspace_hand_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  hand_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hand_id)
);

ALTER TABLE sv_workspace_hand_queue ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sv_workspace_hand_queue TO authenticated;

DROP POLICY IF EXISTS "select_own_workspace_queue" ON sv_workspace_hand_queue;
CREATE POLICY "select_own_workspace_queue"
  ON sv_workspace_hand_queue FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_workspace_queue" ON sv_workspace_hand_queue;
CREATE POLICY "insert_own_workspace_queue"
  ON sv_workspace_hand_queue FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_workspace_queue" ON sv_workspace_hand_queue;
CREATE POLICY "update_own_workspace_queue"
  ON sv_workspace_hand_queue FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_workspace_queue" ON sv_workspace_hand_queue;
CREATE POLICY "delete_own_workspace_queue"
  ON sv_workspace_hand_queue FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
