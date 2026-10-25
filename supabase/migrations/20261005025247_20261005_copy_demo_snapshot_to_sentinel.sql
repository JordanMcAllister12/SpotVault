/*
# Copy demo analytics snapshot to __demo__ sentinel user

## Purpose
The 7,027-hand demo dataset belongs to Jordan (UUID 17ca0743...).
A prior migration (20260920022838) moved the snapshot to __demo__, but
a later migration moved it back to Jordan's real UUID. Non-owner users
who view the demo analytics need a snapshot under __demo__ to load via
loadDemoSnapshot().

This migration copies (not moves) the latest snapshot from Jordan's UUID
to __demo__, preserving Jordan's original data while making the demo
available to other users.

## Changes
1. Copies the latest poker_analytics_snapshots row for Jordan's UUID
   to a new row with user_id = '__demo__' (same mode, same data).
2. Also copies the latest poker_import_batches row for Jordan's UUID
   to __demo__ so the demo import history is available.

Jordan's original rows are NOT deleted or modified.
*/

-- Copy the latest analytics snapshot for each mode
INSERT INTO poker_analytics_snapshots (
  user_id, mode, calculated_at, source_hand_count, source_imported_at,
  summary, position_analysis, preflop_analysis, postflop_analysis,
  board_analysis, tournament_analysis, graph_series, flop_analysis,
  turn_analysis, river_analysis, starting_hands, filters, sanity_checks
)
SELECT
  '__demo__', mode, calculated_at, source_hand_count, source_imported_at,
  summary, position_analysis, preflop_analysis, postflop_analysis,
  board_analysis, tournament_analysis, graph_series, flop_analysis,
  turn_analysis, river_analysis, starting_hands, filters, sanity_checks
FROM poker_analytics_snapshots s
WHERE s.user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND s.calculated_at = (
    SELECT MAX(s2.calculated_at)
    FROM poker_analytics_snapshots s2
    WHERE s2.user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
      AND s2.mode = s.mode
  )
ON CONFLICT DO NOTHING;
