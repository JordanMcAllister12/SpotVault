/*
# Correct tournament participation counts from imported hand records

1. Purpose
- Reconcile stored MTT analytics snapshots with the actual imported hand-history records.
- Keep unique tournaments, total entries, and re-entries as separate statistics.

2. Definitions
- `tournamentEvents`: count of distinct non-empty `tournament_id` values.
- `tournamentEntries`: count of distinct non-empty `source_file_name` values, where each imported source file represents one recorded entry.
- `reEntries`: `tournamentEntries - tournamentEvents`, never below zero.
- `tournamentCount`: the unique tournament event count, not the entry count.

3. Data preservation
- No hand records are inserted, deleted, or modified.
- The existing hand total, tournament hand associations, and other analytics values are preserved.
- Snapshot JSON fields are updated only for participation-count keys.

4. Verification basis
- Counts are calculated directly from `poker_hand_records` for each MTT user.
- The current imported dataset therefore derives its displayed values from actual records rather than hardcoded targets.
*/

WITH participation AS (
  SELECT
    user_id,
    COUNT(DISTINCT tournament_id) FILTER (WHERE tournament_id IS NOT NULL AND tournament_id <> '')::int AS tournament_events,
    COUNT(DISTINCT source_file_name) FILTER (WHERE source_file_name IS NOT NULL AND source_file_name <> '')::int AS tournament_entries
  FROM poker_hand_records
  WHERE game_mode = 'mtt'
  GROUP BY user_id
)
UPDATE poker_analytics_snapshots snapshot
SET
  summary = jsonb_set(
    jsonb_set(
      jsonb_set(snapshot.summary, '{tournamentEntries}', to_jsonb(participation.tournament_entries)),
      '{tournamentEvents}', to_jsonb(participation.tournament_events)
    ),
    '{reEntries}', to_jsonb(GREATEST(0, participation.tournament_entries - participation.tournament_events))
  ),
  tournament_analysis = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(snapshot.tournament_analysis, '{tournamentCount}', to_jsonb(participation.tournament_events)),
        '{tournamentEntries}', to_jsonb(participation.tournament_entries)
      ),
      '{tournamentEvents}', to_jsonb(participation.tournament_events)
    ),
    '{reEntries}', to_jsonb(GREATEST(0, participation.tournament_entries - participation.tournament_events))
  )
FROM participation
WHERE snapshot.user_id = participation.user_id
  AND snapshot.mode = 'mtt';