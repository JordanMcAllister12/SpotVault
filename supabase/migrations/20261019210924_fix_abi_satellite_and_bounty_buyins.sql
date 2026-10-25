/*
# Fix ABI: Satellite and Bounty-Target Buy-In Correction

## Problem
The ABI (Average Buy-In) is overstated at ~$105 vs expected ~$75.

## Root Causes
1. Satellite tournaments ("to 1M GGMillion", "EXPRESS to 10K Bracelet Pass")
   have the TARGET event's buy-in amount in the hand header, not what the
   player paid. The $1,050 is the GGMillion buy-in, not the satellite entry cost.
2. "Cash Drop" / "Bounty Hunters Series" tournaments embed the bounty target
   ($10,000) in the name, not the buy-in. These were already NULL'd by a
   prior migration but the ABI calculation excluded them from the denominator.
3. countTournamentEntries() summed one buy-in per tournament (not per entry),
   and used tournaments-with-buyin as the denominator instead of total entries.

## Fix
1. Set buy_in = NULL for satellite tournaments where the $ amount is the
   target event cost, not the player's entry cost.
2. The client-side ABI calculation has been fixed to:
   - Sum buy-in per entry (source file × tournament buy-in)
   - Use total entries as denominator (including NULL-buyin entries at $0)
   - Detect satellite/bounty patterns and exclude their buy-in from numerator
*/
-- Set buy_in = NULL for satellite tournaments where $ amount is target, not entry cost
UPDATE poker_hand_records
SET buy_in = NULL
WHERE buy_in IS NOT NULL
  AND tournament_id IS NOT NULL
  AND raw_hand_text IS NOT NULL
  AND raw_hand_text ~* 'Tournament\s+#\S+,\s*\$[\d,]+(?:\.\d+)?\s+(?:MEGA\s+to|Deadline\s+to|EXPRESS\s+to)';

-- Also null any "Phase" satellite entries
UPDATE poker_hand_records
SET buy_in = NULL
WHERE buy_in IS NOT NULL
  AND tournament_id IS NOT NULL
  AND raw_hand_text IS NOT NULL
  AND raw_hand_text ~* 'Tournament\s+#\S+,\s*(?:.*?\s+)?Phase\s+\d';
