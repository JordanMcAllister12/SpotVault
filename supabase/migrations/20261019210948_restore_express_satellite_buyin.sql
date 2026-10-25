/*
# Restore Bracelet Pass buy-in

The "1,200 EXPRESS to 10K Bracelet Pass" is a DIRECT satellite — the player
paid $1,200 to enter. Unlike "MEGA to" / "Deadline to" GGMillion feeders where
the $1,050 is the target event cost, "EXPRESS" satellites have a real entry fee.

The prior migration over-corrected by nulling all "EXPRESS to" buy-ins.
Restore buy_in for this specific tournament from the raw hand text.
*/
UPDATE poker_hand_records
SET buy_in = 1200
WHERE tournament_id = '296221859'
  AND buy_in IS NULL
  AND raw_hand_text ILIKE '%EXPRESS to $10K Bracelet Pass%';
