/*
# Create private Student SyncShare workspace

1. New Tables
- `student_coach_connections` stores the player's primary coach and supports future multiple coach relationships.
- `syncshare_submissions` stores private player-to-coach submissions and the shared SpotVault object reference, metadata, routing status, and timestamps.
- `syncshare_feedback` stores coach feedback attached to a submission.
- `syncshare_assignments` stores coach-to-player study work and its completion status.

2. Demo Data
- Seeds Jordan McAllister's primary connection to Kevin Martin.
- Seeds three awaiting-review hands, one tournament submission, one coach feedback item, and one assignment for the demo workspace.

3. Security
- Enables row-level security on every table.
- The current app has no sign-in screen, so access is limited to the private demo workspace key used by this app and is available to the anon client. These rows are not published to community, marketplace, or public-feed tables.

4. Important Notes
- `source_object_id` and `source_object_type` reference existing SpotVault content without duplicating the underlying object.
- `coach_id` is stored independently so a player can later have multiple coach connections.
- All timestamps are stored in UTC and displayed in the portal's presentation format.
*/

CREATE TABLE IF NOT EXISTS student_coach_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_key text NOT NULL DEFAULT 'player-demo-jordan',
  player_id text NOT NULL,
  coach_id text NOT NULL,
  coach_name text NOT NULL,
  coach_role text NOT NULL DEFAULT 'Primary Poker Coach',
  status text NOT NULL DEFAULT 'active',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS syncshare_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_key text NOT NULL DEFAULT 'player-demo-jordan',
  player_id text NOT NULL,
  coach_id text NOT NULL,
  connection_id uuid REFERENCES student_coach_connections(id),
  title text NOT NULL,
  question text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal',
  category text NOT NULL,
  source_object_type text,
  source_object_id text,
  source_name text,
  content_url text,
  status text NOT NULL DEFAULT 'awaiting_review',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS syncshare_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_key text NOT NULL DEFAULT 'player-demo-jordan',
  submission_id uuid REFERENCES syncshare_submissions(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  coach_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS syncshare_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_key text NOT NULL DEFAULT 'player-demo-jordan',
  player_id text NOT NULL,
  coach_id text NOT NULL,
  title text NOT NULL,
  assignment_type text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'assigned',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syncshare_submissions_workspace_idx ON syncshare_submissions(workspace_key, submitted_at DESC);
CREATE INDEX IF NOT EXISTS syncshare_feedback_submission_idx ON syncshare_feedback(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS syncshare_assignments_workspace_idx ON syncshare_assignments(workspace_key, created_at DESC);

ALTER TABLE student_coach_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE syncshare_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE syncshare_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE syncshare_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_read_connections" ON student_coach_connections;
DROP POLICY IF EXISTS "demo_insert_connections" ON student_coach_connections;
DROP POLICY IF EXISTS "demo_update_connections" ON student_coach_connections;
DROP POLICY IF EXISTS "demo_delete_connections" ON student_coach_connections;
CREATE POLICY "demo_read_connections" ON student_coach_connections FOR SELECT TO anon, authenticated USING (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_insert_connections" ON student_coach_connections FOR INSERT TO anon, authenticated WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_update_connections" ON student_coach_connections FOR UPDATE TO anon, authenticated USING (workspace_key = 'player-demo-jordan') WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_delete_connections" ON student_coach_connections FOR DELETE TO anon, authenticated USING (workspace_key = 'player-demo-jordan');

DROP POLICY IF EXISTS "demo_read_submissions" ON syncshare_submissions;
DROP POLICY IF EXISTS "demo_insert_submissions" ON syncshare_submissions;
DROP POLICY IF EXISTS "demo_update_submissions" ON syncshare_submissions;
DROP POLICY IF EXISTS "demo_delete_submissions" ON syncshare_submissions;
CREATE POLICY "demo_read_submissions" ON syncshare_submissions FOR SELECT TO anon, authenticated USING (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_insert_submissions" ON syncshare_submissions FOR INSERT TO anon, authenticated WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_update_submissions" ON syncshare_submissions FOR UPDATE TO anon, authenticated USING (workspace_key = 'player-demo-jordan') WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_delete_submissions" ON syncshare_submissions FOR DELETE TO anon, authenticated USING (workspace_key = 'player-demo-jordan');

DROP POLICY IF EXISTS "demo_read_feedback" ON syncshare_feedback;
DROP POLICY IF EXISTS "demo_insert_feedback" ON syncshare_feedback;
DROP POLICY IF EXISTS "demo_update_feedback" ON syncshare_feedback;
DROP POLICY IF EXISTS "demo_delete_feedback" ON syncshare_feedback;
CREATE POLICY "demo_read_feedback" ON syncshare_feedback FOR SELECT TO anon, authenticated USING (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_insert_feedback" ON syncshare_feedback FOR INSERT TO anon, authenticated WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_update_feedback" ON syncshare_feedback FOR UPDATE TO anon, authenticated USING (workspace_key = 'player-demo-jordan') WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_delete_feedback" ON syncshare_feedback FOR DELETE TO anon, authenticated USING (workspace_key = 'player-demo-jordan');

DROP POLICY IF EXISTS "demo_read_assignments" ON syncshare_assignments;
DROP POLICY IF EXISTS "demo_insert_assignments" ON syncshare_assignments;
DROP POLICY IF EXISTS "demo_update_assignments" ON syncshare_assignments;
DROP POLICY IF EXISTS "demo_delete_assignments" ON syncshare_assignments;
CREATE POLICY "demo_read_assignments" ON syncshare_assignments FOR SELECT TO anon, authenticated USING (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_insert_assignments" ON syncshare_assignments FOR INSERT TO anon, authenticated WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_update_assignments" ON syncshare_assignments FOR UPDATE TO anon, authenticated USING (workspace_key = 'player-demo-jordan') WITH CHECK (workspace_key = 'player-demo-jordan');
CREATE POLICY "demo_delete_assignments" ON syncshare_assignments FOR DELETE TO anon, authenticated USING (workspace_key = 'player-demo-jordan');

INSERT INTO student_coach_connections (workspace_key, player_id, coach_id, coach_name, coach_role, status, is_primary)
SELECT 'player-demo-jordan', 'stu-jordan', 'coach-kevin-martin', 'Kevin Martin', 'Primary Poker Coach', 'active', true
WHERE NOT EXISTS (SELECT 1 FROM student_coach_connections WHERE workspace_key = 'player-demo-jordan' AND player_id = 'stu-jordan' AND is_primary = true);

INSERT INTO syncshare_submissions (workspace_key, player_id, coach_id, title, question, priority, category, source_object_type, source_object_id, source_name, status, submitted_at)
SELECT * FROM (VALUES
  ('player-demo-jordan','stu-jordan','coach-kevin-martin','BTN vs BB 3-Bet Pot','Should I continue barreling this paired turn?','review_soon','hands','hand','h1','BTN vs BB 3-bet pot, paired turn','awaiting_review',now() - interval '2 days'),
  ('player-demo-jordan','stu-jordan','coach-kevin-martin','SB vs BB River Bluff','Can you review my river sizing?','normal','hands','hand','h2','SB vs BB river bluff spot','awaiting_review',now() - interval '3 days'),
  ('player-demo-jordan','stu-jordan','coach-kevin-martin','Final Table ICM Fold','Was this fold too tight with 18bb?','urgent','hands','hand','h3','Final table ICM fold','awaiting_review',now() - interval '5 days'),
  ('player-demo-jordan','stu-jordan','coach-kevin-martin','$525 High Roller — Tournament Review','Please review my tournament decisions from the final two tables.','review_soon','tournaments','tournament','tournament-525-high-roller','$525 High Roller tournament summary','awaiting_review',now() - interval '1 day'),
  ('player-demo-jordan','stu-jordan','coach-kevin-martin','Turn Aggression Report','Sharing the latest analytics view before our next session.','normal','analytics','analytics','analytics-jordan-august','Performance analytics report','reviewed',now() - interval '8 days')
) AS seeded(workspace_key, player_id, coach_id, title, question, priority, category, source_object_type, source_object_id, source_name, status, submitted_at)
WHERE NOT EXISTS (SELECT 1 FROM syncshare_submissions WHERE workspace_key = 'player-demo-jordan');

INSERT INTO syncshare_feedback (workspace_key, submission_id, player_id, coach_id, body)
SELECT 'player-demo-jordan', s.id, 'stu-jordan', 'coach-kevin-martin', 'Good hand to study. Your preflop plan is sound; the key adjustment is defending more often on paired turns when the BB range is capped.'
FROM syncshare_submissions s
WHERE s.workspace_key = 'player-demo-jordan' AND s.title = 'BTN vs BB 3-Bet Pot'
AND NOT EXISTS (SELECT 1 FROM syncshare_feedback WHERE workspace_key = 'player-demo-jordan');

INSERT INTO syncshare_assignments (workspace_key, player_id, coach_id, title, assignment_type, instructions, status, due_at)
SELECT 'player-demo-jordan', 'stu-jordan', 'coach-kevin-martin', 'Review these 20 BTN vs BB hands', 'hand_history', 'Focus on 3-bet pots and mark every turn decision that feels unclear.', 'assigned', now() + interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM syncshare_assignments WHERE workspace_key = 'player-demo-jordan');