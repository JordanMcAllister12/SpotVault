/*
# Create Saved Tournaments table

1. New Tables
- `sv_saved_tournaments`
  - `id` uuid PK — unique tournament repository ID
  - `user_id` uuid NOT NULL DEFAULT auth.uid() — owner
  - `name` text — user-defined display name
  - `site` text — parsed poker site (e.g. PokerStars, GGPoker)
  - `tournament_name` text — parsed tournament name
  - `tournament_id` text — parsed tournament ID
  - `buy_in` text — parsed buy-in string
  - `played_at` timestamptz — parsed or upload date
  - `hand_count` integer DEFAULT 0 — number of parsed hands
  - `raw_hh_text` text NOT NULL — complete original tournament HH text
  - `parsed_hands` jsonb — array of parsed hand metadata (hand_id, played_at, etc.)
  - `source_file_name` text — original uploaded filename if available
  - `created_at` timestamptz DEFAULT now()

2. Security
- Enable RLS on `sv_saved_tournaments`.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- 4 separate policies for SELECT, INSERT, UPDATE, DELETE.
- user_id defaults to auth.uid() so inserts that omit it still succeed.

3. Notes
- This stores complete tournament HH files as user data (not app assets).
- The original HH text is preserved in raw_hh_text and is always retrievable.
- Deleting a saved tournament does NOT affect sv_saved_hands or poker_hand_records.
*/

CREATE TABLE IF NOT EXISTS sv_saved_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Tournament',
  site text,
  tournament_name text,
  tournament_id text,
  buy_in text,
  played_at timestamptz,
  hand_count integer NOT NULL DEFAULT 0,
  raw_hh_text text NOT NULL,
  parsed_hands jsonb DEFAULT '[]'::jsonb,
  source_file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_saved_tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_tournaments" ON sv_saved_tournaments;
CREATE POLICY "select_own_saved_tournaments"
ON sv_saved_tournaments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_tournaments" ON sv_saved_tournaments;
CREATE POLICY "insert_own_saved_tournaments"
ON sv_saved_tournaments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_tournaments" ON sv_saved_tournaments;
CREATE POLICY "update_own_saved_tournaments"
ON sv_saved_tournaments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_tournaments" ON sv_saved_tournaments;
CREATE POLICY "delete_own_saved_tournaments"
ON sv_saved_tournaments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_tournaments_user_id ON sv_saved_tournaments(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_tournaments_created_at ON sv_saved_tournaments(created_at DESC);
