/*
# Fix inflated buy_in for "Cash Drop" bounty-target tournaments

## Problem
The buy-in parser regex grabbed the first dollar amount after the tournament ID in the
hand history header, regardless of context. Two "Bounty Hunters Series Cash Drop"
tournaments have "$10,000" in their name, which is the bounty/target prize — NOT the
actual buy-in. This inflated the AVG BUY-IN (ABI) from ~$70 to $270.83.

## Root Cause
GG Poker hand headers for these tournaments look like:
  "Tournament #298987341, $10,000 Bounty Hunters Series Cash Drop Hold'em No Limit"
The $10,000 is the bounty target in the tournament name, not the entry cost.
The actual buy-in is not present in the hand header for these tournaments.

## Fix
1. Set buy_in = NULL for the two affected tournaments (IDs 298987341, 297382430)
   where the dollar amount in the name is a bounty target, not a buy-in.
2. Generalize: set buy_in = NULL for ALL tournament hands where the raw_hand_text
   header contains "$N Bounty Hunters Series" or "$N Cash Drop" pattern, since these
   are bounty targets embedded in the tournament name, not buy-in amounts.

## Safety
- UPDATE only — no schema changes, no data deletion.
- Only touches buy_in column (sets to NULL where it was incorrectly parsed).
- Idempotent: re-running has no effect (rows are already NULL).
- Does NOT affect tournaments with correctly parsed buy-ins.
*/

-- Fix the two known "Cash Drop" tournaments where $10,000 is the bounty target
UPDATE poker_hand_records
SET buy_in = NULL
WHERE tournament_id IN ('298987341', '297382430')
  AND buy_in IS NOT NULL;

-- Generalized fix: any tournament where the first $ amount in the header is
-- immediately followed by "Bounty Hunters Series" or "Cash Drop" — these are
-- bounty targets, not buy-ins. The raw_hand_text pattern is:
--   "Tournament #<id>, $<amount> Bounty Hunters Series Cash Drop ..."
UPDATE poker_hand_records
SET buy_in = NULL
WHERE buy_in IS NOT NULL
  AND tournament_id IS NOT NULL
  AND raw_hand_text IS NOT NULL
  AND raw_hand_text ~ 'Tournament\s+#\S+,\s*\$\d[\d,]*(?:\.\d+)?\s+(?:Bounty\s+Hunters\s+Series|Cash\s+Drop)';
