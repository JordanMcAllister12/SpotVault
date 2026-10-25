/*
# Add hero_flat_3bet column to poker_hand_records

1. Changes
- Add `hero_flat_3bet` boolean column to `poker_hand_records` table.
- This column tracks whether Hero flat-called a 3-bet preflop
  (faced a 3-bet and called instead of folding or 4-betting).
- Default is false for all existing rows.
- Backfill existing rows to false.

2. Security
- No RLS or policy changes — the table already has RLS enabled
  with existing owner-scoped policies.

3. Notes
- This column is used by the Hand Analyzer "Flat 3-Bet" filter.
- It is computed during import via computeDerivedFields.
- Existing hands will need re-import to populate this field,
  but the column defaults to false so queries work immediately.
*/

ALTER TABLE poker_hand_records
ADD COLUMN IF NOT EXISTS hero_flat_3bet boolean DEFAULT false;

-- Backfill: ensure all existing rows have false (not null)
UPDATE poker_hand_records
SET hero_flat_3bet = false
WHERE hero_flat_3bet IS NULL;
