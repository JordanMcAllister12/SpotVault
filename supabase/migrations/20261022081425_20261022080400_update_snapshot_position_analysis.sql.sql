/*
# Update analytics snapshot position_analysis with corrected positions

## What
Updates the position_analysis JSON column in poker_analytics_snapshots to reflect
the reclassified positions (all 8,145 hands now positioned using actual dealt count).

## Security
No schema changes. Only UPDATE on poker_analytics_snapshots.position_analysis.
*/

UPDATE poker_analytics_snapshots
SET position_analysis = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'position', position,
      'hands', hands,
      'bbWon', bb_won,
      'profit', profit
    ) ORDER BY 
    CASE position
      WHEN 'UTG' THEN 1 WHEN 'UTG+1' THEN 2 WHEN 'UTG+2' THEN 3 WHEN 'UTG+3' THEN 4
      WHEN 'LJ' THEN 5 WHEN 'MP' THEN 6 WHEN 'HJ' THEN 7 WHEN 'CO' THEN 8
      WHEN 'BTN' THEN 9 WHEN 'SB' THEN 10 WHEN 'BB' THEN 11
    END
  )
  FROM (
    SELECT 
      position,
      COUNT(*) as hands,
      COALESCE(SUM(bb_won), 0) as bb_won,
      COALESCE(SUM(net_result), 0) as profit
    FROM poker_hand_records
    WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
      AND position IS NOT NULL AND position != ''
    GROUP BY position
  ) t
)
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND id = '6594c75b-3f3c-4516-a12f-d0d389d8046e';
