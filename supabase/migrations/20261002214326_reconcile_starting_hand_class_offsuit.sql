/*
# Reconcile starting_hand_class for 7,027 existing hands

## Root Cause
The `normalizeCardSuit()` function in pokerAnalytics.ts only handled unicode suit
symbols (♠♥♦) and defaulted everything else to 'c' (clubs). Since hero_cards are
stored with letter suit codes (h/d/s/c), both cards always got suit 'c', making
the suited/offsuit check always return 'suited'. This caused ALL non-pair hands
to be stored as suited (e.g. KJo stored as KJs).

## Fix
1. Code fix already applied: normalizeCardSuit now handles both letter and unicode suits.
2. This migration reconciles the 7,027 existing records by recomputing
   starting_hand_class from the actual hero_cards values.

## Method
- Extract rank1, suit1, rank2, suit2 from hero_cards (format: "Rs Rs")
- Canonicalize rank order using A>K>Q>J>T>9>8>7>6>5>4>3>2
- If same rank → pair (e.g. "AA")
- If different rank → sort high+low, append 's' if suits match, 'o' if not

## Impact
- 1,644 actually-suited hands: unchanged (already correct as 's')
- 4,968 actually-offsuit hands: changed from 's' to 'o'
- 415 pair hands: unchanged
- No raw_hand_text modifications
- No other analytics fields touched
- No duplicate records created
*/

WITH rank_order AS (
  SELECT unnest(string_to_array('2,3,4,5,6,7,8,9,T,J,Q,K,A', ',')) AS rank,
         generate_series(0, 12) AS idx
),
hands AS (
  SELECT
    id,
    hero_cards,
    upper(substr(hero_cards, 1, 1)) AS r1,
    lower(substr(hero_cards, 2, 1)) AS s1,
    upper(substr(hero_cards, 4, 1)) AS r2,
    lower(substr(hero_cards, 5, 1)) AS s2
  FROM poker_hand_records
  WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
    AND hero_cards IS NOT NULL
    AND length(hero_cards) >= 5
),
recomputed AS (
  SELECT
    h.id,
    CASE
      WHEN h.r1 = h.r2 THEN h.r1 || h.r2
      WHEN ro1.idx >= ro2.idx THEN h.r1 || h.r2 || CASE WHEN h.s1 = h.s2 THEN 's' ELSE 'o' END
      ELSE h.r2 || h.r1 || CASE WHEN h.s1 = h.s2 THEN 's' ELSE 'o' END
    END AS new_class
  FROM hands h
  JOIN rank_order ro1 ON ro1.rank = h.r1
  JOIN rank_order ro2 ON ro2.rank = h.r2
)
UPDATE poker_hand_records p
SET starting_hand_class = r.new_class
FROM recomputed r
WHERE p.id = r.id
  AND p.starting_hand_class IS DISTINCT FROM r.new_class;
