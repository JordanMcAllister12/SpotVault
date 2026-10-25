/*
# Create hand bookmark system for HH Replayer SAVED tab

## Purpose
Users can privately bookmark poker hands they want to revisit later.
This is a lightweight reference table — it does NOT duplicate the underlying
poker_hand_records. Removing a bookmark never deletes the canonical hand.

## New Tables

### sv_saved_hands
A simple join table linking a user to a poker hand record by (user_id, hand_id).
- `id` — uuid PK
- `user_id` — text, the authenticated user's auth.uid() (matches poker_hand_records.user_id)
- `hand_id` — text, the hand identifier (matches poker_hand_records.hand_id)
- `hand_user_id` — text, the owner of the hand record (for cross-user sharing scenarios; defaults to same as user_id for self-bookmarks)
- `saved_at` — timestamp
- UNIQUE(user_id, hand_id, hand_user_id) — prevents duplicate bookmarks

## Security
- RLS enabled, authenticated-only.
- Users can only see/manage their own bookmarks (user_id = auth.uid()::text).
- No anon access — bookmarks are private.

## Notes
- The hand record itself is NOT copied. This is a reference only.
- Deleting a bookmark does not affect poker_hand_records.
- The hand remains accessible through the HH Replayer regardless of bookmark state.
*/

CREATE TABLE IF NOT EXISTS sv_saved_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  hand_id text NOT NULL,
  hand_user_id text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hand_id, hand_user_id)
);

ALTER TABLE sv_saved_hands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_hands" ON sv_saved_hands;
CREATE POLICY "select_own_saved_hands"
  ON sv_saved_hands FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "insert_own_saved_hands" ON sv_saved_hands;
CREATE POLICY "insert_own_saved_hands"
  ON sv_saved_hands FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "delete_own_saved_hands" ON sv_saved_hands;
CREATE POLICY "delete_own_saved_hands"
  ON sv_saved_hands FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE INDEX IF NOT EXISTS idx_sv_saved_hands_user
  ON sv_saved_hands (user_id, saved_at DESC);
