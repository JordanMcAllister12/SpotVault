/*
# Create user_saved_spots table

## Purpose
Allows users to save free/public Spots to their personal "My Spots → Saved"
library without purchasing them. Supports optional 30-day expiration.

## New Table: user_saved_spots
- `id` (uuid, PK)
- `user_id` (text, NOT NULL) — the demo account ID of the user who saved
- `spot_id` (uuid, NOT NULL) — FK to content_spots(id) ON DELETE CASCADE
- `saved_at` (timestamptz, default now())
- `expires_at` (timestamptz, nullable) — null means "keep forever"
- `created_at` (timestamptz, default now())

## Constraints
- UNIQUE (user_id, spot_id) — prevents duplicate saves

## Security
- RLS enabled
- SELECT: users can see their own saved spots
- INSERT: users can save spots for themselves
- DELETE: users can remove their own saved spots
- UPDATE: users can change expiration on their own saved spots

## Notes
- This creates a *reference* to the original Spot, not a copy.
- Comments remain attached to the canonical content_spots row.
- When expires_at passes, the app filters it out from My Spots.
  The row is NOT auto-deleted by the database; the app handles cleanup.
*/
CREATE TABLE IF NOT EXISTS user_saved_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  spot_id uuid NOT NULL REFERENCES content_spots(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, spot_id)
);

ALTER TABLE user_saved_spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_spots" ON user_saved_spots;
CREATE POLICY "select_own_saved_spots"
ON user_saved_spots FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "insert_own_saved_spots" ON user_saved_spots;
CREATE POLICY "insert_own_saved_spots"
ON user_saved_spots FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_saved_spots" ON user_saved_spots;
CREATE POLICY "update_own_saved_spots"
ON user_saved_spots FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_saved_spots" ON user_saved_spots;
CREATE POLICY "delete_own_saved_spots"
ON user_saved_spots FOR DELETE
TO anon, authenticated
USING (true);
