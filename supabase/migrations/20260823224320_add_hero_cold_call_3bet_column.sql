/* Track cold-calling a 3-bet separately from flat-calling after Hero's open. */
ALTER TABLE poker_hand_records
ADD COLUMN IF NOT EXISTS hero_cold_call_3bet boolean DEFAULT false;

UPDATE poker_hand_records
SET hero_cold_call_3bet = false
WHERE hero_cold_call_3bet IS NULL;
