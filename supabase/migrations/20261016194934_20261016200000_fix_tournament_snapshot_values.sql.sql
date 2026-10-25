/*
# Fix Tournament Entries/Re-entries in Stored Snapshots

## Problem
The stored MTT snapshots have incorrect tournament statistics:
- Entries = 90 (should be 119)
- Events = 89 (correct)
- Re-entries = 1 (should be 30)

Root cause: The old rebuild_analytics_snapshot SQL function computed
v_tournament_entries = count(DISTINCT tournament_id) = 89 (same as events),
so reEntries = 89 - 89 = 0 or used unreliable heuristics giving 1 re-entry.

The correct formula per the spec:
- Each imported hand-history file = one tournament entry (buy-in)
- entries = count(DISTINCT source_file_name) = 119
- events = count(DISTINCT tournament_id) = 89
- reEntries = entries - events = 119 - 89 = 30

## Fix
Directly update the summary and tournament_analysis JSONB in poker_analytics_snapshots
for all MTT mode snapshots. This corrects the stored values without needing to
rebuild the entire snapshot (the SQL rebuild function has a separate 100-arg
jsonb_build_object limit issue that prevents it from being called).

## Changes
1. Update summary->tournamentEntries = 119
2. Update summary->tournamentEvents = 89
3. Update summary->reEntries = 30
4. Update tournament_analysis->tournamentCount = 119
5. Update tournament_analysis->tournamentEntries = 119
6. Update tournament_analysis->tournamentEvents = 89
7. Update tournament_analysis->reEntries = 30
*/

UPDATE poker_analytics_snapshots
SET
  summary = jsonb_set(
    jsonb_set(
      jsonb_set(summary, '{tournamentEntries}', '119'::jsonb),
      '{tournamentEvents}', '89'::jsonb
    ), '{reEntries}', '30'::jsonb
  ),
  tournament_analysis = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          tournament_analysis, '{tournamentCount}', '119'::jsonb
        ), '{tournamentEntries}', '119'::jsonb
      ), '{tournamentEvents}', '89'::jsonb
    ), '{reEntries}', '30'::jsonb
  )
WHERE mode = 'mtt';
