/*
# Create sv_hand_pack_entries table

## Purpose
Store the ordered hand references + creator notes that make up a Hand Pack
(a curated collection of canonical hands published as creator content).

## New Table: sv_hand_pack_entries
- content_spot_id is uuid matching content_spots.id type
- Stores REFERENCES to canonical hands (hand_id + hand_user_id), NOT full copies
- Display metadata cached from poker_hand_records for list rendering

## Security
- RLS enabled, owner-scoped through content_spots ownership check
- content_spots.account_id is text, auth.uid() is uuid → cast auth.uid()::text
*/

CREATE TABLE IF NOT EXISTS sv_hand_pack_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_spot_id uuid NOT NULL,
  hand_id text NOT NULL,
  hand_user_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  creator_note text NOT NULL DEFAULT '',
  hero_cards text,
  board text,
  blinds text,
  net_result numeric,
  pot_amount numeric,
  position text,
  played_at timestamptz,
  tournament_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_hand_pack_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_hand_pack_entries" ON sv_hand_pack_entries;
CREATE POLICY "select_hand_pack_entries"
ON sv_hand_pack_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_hand_pack_entries.content_spot_id
    AND (content_spots.account_id = auth.uid()::text OR content_spots.status = 'published')
  )
);

DROP POLICY IF EXISTS "insert_hand_pack_entries" ON sv_hand_pack_entries;
CREATE POLICY "insert_hand_pack_entries"
ON sv_hand_pack_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_hand_pack_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "update_hand_pack_entries" ON sv_hand_pack_entries;
CREATE POLICY "update_hand_pack_entries"
ON sv_hand_pack_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_hand_pack_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "delete_hand_pack_entries" ON sv_hand_pack_entries;
CREATE POLICY "delete_hand_pack_entries"
ON sv_hand_pack_entries FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_hand_pack_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);

CREATE INDEX IF NOT EXISTS idx_hand_pack_entries_spot
ON sv_hand_pack_entries(content_spot_id, sort_order);
