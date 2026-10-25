/*
# Add raw_hand_text column to poker_hand_records

1. Changes
- Add `raw_hand_text` (text, nullable) column to `poker_hand_records`.
  This stores the original raw hand history block text for each hand,
  enabling a clean re-import/re-parse pipeline that recomputes all
  analytics from the original source data without relying on
  previously stored normalized values.

2. Security
- No RLS policy changes. The column inherits existing table-level RLS.
- No new tables.

3. Notes
- The column is nullable so existing rows are not affected.
- New imports will populate this column; old rows will have NULL
  and will be excluded from the raw rebuild (or re-imported).
*/

ALTER TABLE poker_hand_records
  ADD COLUMN IF NOT EXISTS raw_hand_text text;
