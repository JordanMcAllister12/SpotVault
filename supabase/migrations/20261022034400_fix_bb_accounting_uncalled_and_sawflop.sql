/*
# Fix BB Accounting: Uncalled Bet Handling + Saw-Flop for Preflop All-Ins

## Root Cause
Two bugs in the hand-level accounting caused massive BB distortion:

### Bug 1: Uncalled bets not subtracted for non-showdown hands (774 hands affected)
In GGPoker hand history format, "Uncalled bet ($X) returned to Hero" and
"Hero collected ($Y) from pot" are ALWAYS separate lines. The collected amount
is just the pot — it never includes the uncalled return. However, the parser
only subtracted uncalled from invested when `showdown=true`, causing non-showdown
winning hands to be recorded as massive losses.

Example: Hero raises all-in to 247,754, everyone folds, uncalled 246,254 returned,
Hero collects 4,600. Old code: invested=247,954 (uncalled not subtracted), net=-243,354.
Correct: invested=1,700 (uncalled subtracted), net=+2,900.

### Bug 2: Preflop all-in hands excluded from saw_flop (221 hands affected)
Hands where hero was all-in preflop and the flop was dealt were marked
saw_flop=false because the parser excluded all-in preflop hands. This inflated
WTSD (denominator too small) and deflated WWSF.

## Changes
1. Recompute net_result and bb_won for ALL hands using the corrected formula
   from action_sequence JSONB (uncalled always subtracted from invested).
2. Update saw_flop, saw_turn, saw_river for hands where hero didn't fold preflop
   but the board was dealt (includes preflop all-ins).
3. Invalidate stale analytics snapshots so the dashboard recalculates.

## Data Safety
- Raw hand text is preserved unchanged.
- Only derived columns (net_result, bb_won, saw_flop, saw_turn, saw_river) are updated.
- Original values are logged in a diagnostic table for audit.
*/

-- Create a diagnostic table to store before/after values for audit
CREATE TABLE IF NOT EXISTS bb_accounting_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_record_id uuid NOT NULL,
  old_bb_won numeric,
  new_bb_won numeric,
  old_net_result numeric,
  new_net_result numeric,
  old_saw_flop boolean,
  new_saw_flop boolean,
  old_saw_turn boolean,
  new_saw_turn boolean,
  old_saw_river boolean,
  new_saw_river boolean,
  corrected_at timestamptz DEFAULT now()
);

-- Recalculate net_result and bb_won for all hands using the corrected formula
-- Formula: invested = antes + SUM(streetCommit) - uncalledTotal (ALWAYS subtract uncalled)
--          netChips = collected - invested
--          netBB = round(netChips / bigBlind, 2)
WITH hand_recalc AS (
  SELECT
    h.id,
    h.hero_name,
    h.blinds,
    h.showdown,
    h.bb_won as old_bb_won,
    h.net_result as old_net_result,
    h.saw_flop as old_saw_flop,
    h.saw_turn as old_saw_turn,
    h.saw_river as old_saw_river,
    h.raw_hand_text,
    h.action_sequence,
    -- Extract big blind from blinds string
    NULLIF(REPLACE(SPLIT_PART(h.blinds, '/', 2), ',', ''), '')::numeric AS big_blind,
    -- Recompute invested, collected, uncalled from action_sequence
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') = 'post'
            THEN COALESCE((elem->>'amount')::numeric, 0)
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') = 'post_ante'
            THEN 0 -- ante tracked separately below
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') = 'call'
            THEN COALESCE((elem->>'amount')::numeric, 0)
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') IN ('bet', 'raise', 'all-in')
            THEN COALESCE((elem->>'amount')::numeric, 0)
          ELSE 0
        END
      ), 0)
      FROM jsonb_array_elements(h.action_sequence) AS elem
    ) AS street_total,
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') = 'post_ante'
            THEN COALESCE((elem->>'amount')::numeric, 0)
          ELSE 0
        END
      ), 0)
      FROM jsonb_array_elements(h.action_sequence) AS elem
    ) AS antes_total,
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') = 'uncalled'
            THEN COALESCE((elem->>'amount')::numeric, 0)
          ELSE 0
        END
      ), 0)
      FROM jsonb_array_elements(h.action_sequence) AS elem
    ) AS uncalled_total,
    (
      SELECT COALESCE(SUM(
        CASE
          WHEN (elem->>'player') = h.hero_name AND (elem->>'action') = 'collect'
            THEN COALESCE((elem->>'amount')::numeric, 0)
          ELSE 0
        END
      ), 0)
      FROM jsonb_array_elements(h.action_sequence) AS elem
    ) AS collected_total
  FROM poker_hand_records h
  WHERE h.action_sequence IS NOT NULL
    AND h.hero_name IS NOT NULL
)
INSERT INTO bb_accounting_audit (hand_record_id, old_bb_won, new_bb_won, old_net_result, new_net_result,
  old_saw_flop, new_saw_flop, old_saw_turn, new_saw_turn, old_saw_river, new_saw_river)
SELECT
  id,
  old_bb_won,
  CASE
    WHEN big_blind IS NOT NULL AND big_blind > 0
      THEN round(((collected_total - (antes_total + street_total - uncalled_total)) / big_blind) * 100) / 100
    ELSE NULL
  END,
  old_net_result,
  collected_total - (antes_total + street_total - uncalled_total),
  old_saw_flop,
  -- New saw_flop: true if flop in raw text AND hero didn't fold preflop
  CASE
    WHEN raw_hand_text ~* '\*\*\* FLOP \*\*\*' AND raw_hand_text !~* (hero_name || '[^\n]*?folds?[^\n]*$')
      THEN true
    ELSE old_saw_flop
  END,
  old_saw_turn,
  CASE
    WHEN raw_hand_text ~* '\*\*\* TURN \*\*\*' AND raw_hand_text !~* (hero_name || '[^\n]*?folds?[^\n]*$')
      THEN true
    ELSE old_saw_turn
  END,
  old_saw_river,
  CASE
    WHEN raw_hand_text ~* '\*\*\* RIVER \*\*\*' AND raw_hand_text !~* (hero_name || '[^\n]*?folds?[^\n]*$')
      THEN true
    ELSE old_saw_river
  END
FROM hand_recalc
WHERE old_bb_won IS NOT NULL OR old_saw_flop = false;

-- Now apply the corrections to poker_hand_records
UPDATE poker_hand_records h
SET
  net_result = a.new_net_result,
  bb_won = a.new_bb_won,
  saw_flop = a.new_saw_flop,
  saw_turn = a.new_saw_turn,
  saw_river = a.new_saw_river,
  street_reached = CASE
    WHEN a.new_saw_river THEN 'river'
    WHEN a.new_saw_turn THEN 'turn'
    WHEN a.new_saw_flop THEN 'flop'
    ELSE 'preflop'
  END
FROM bb_accounting_audit a
WHERE h.id = a.hand_record_id
  AND (
    h.bb_won IS DISTINCT FROM a.new_bb_won
    OR h.saw_flop IS DISTINCT FROM a.new_saw_flop
    OR h.saw_turn IS DISTINCT FROM a.new_saw_turn
    OR h.saw_river IS DISTINCT FROM a.new_saw_river
  );

-- Invalidate stale analytics snapshots so the dashboard recalculates with corrected data
DELETE FROM poker_analytics_snapshots
WHERE user_id IN (
  SELECT DISTINCT user_id FROM poker_hand_records
);