/*
# Add buy_in column to poker_hand_records

1. Changes
- Add `buy_in` (numeric, nullable) column to `poker_hand_records`.
  This stores the tournament buy-in amount parsed from the hand history header
  (e.g. $55, $215, $109). Used to calculate AVG BUY-IN (ABI) in analytics.
2. Security
- No RLS or policy changes — the column inherits the table's existing RLS.
3. Notes
- Nullable because cash-game hands have no buy-in.
- Existing rows will have NULL buy_in; they will be backfilled on next import/recalculation.
*/

ALTER TABLE poker_hand_records
  ADD COLUMN IF NOT EXISTS buy_in numeric;
