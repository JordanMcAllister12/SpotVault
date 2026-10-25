/*
# Restore Demo Analytics Sentinel (`__demo__`)

## Problem
The platform-wide demo analytics sentinel (`user_id = '__demo__'`) is missing
from `poker_analytics_snapshots` and `poker_hand_records`. When a user with no
imported hands opens Analytics, the frontend calls `loadDemoSnapshot(mode)`
which queries `poker_analytics_snapshots WHERE user_id = '__demo__'`. With no
row returned, the demo dataset never appears and the user sees an empty
Analytics screen.

## Root Cause
A prior migration (`20261005025247`) copied Jordan's snapshot to `__demo__`,
but the row was subsequently lost (a later recalculation for Jordan's real
UUID overwrote/moved the data, or the migration timed out after commit
without the row persisting). The `__demo__` sentinel is currently absent from
all three demo tables.

## Fix
Copy Jordan McAllister's (UUID `17ca0743-ccdb-4d43-ab24-f84aa2821170`)
current MTT analytics snapshot, import batch, and hand records to the
`__demo__` sentinel user_id. Jordan's originals are preserved (COPY, not MOVE).
This is the same authorized dataset referenced by the original 7,028-hand demo
seeding (now grown to 8,145 hands via subsequent imports).

## Tables Modified
- `poker_analytics_snapshots` — INSERT one row with `user_id = '__demo__'`, mode = 'mtt'
- `poker_import_batches` — INSERT one row with `user_id = '__demo__'`
- `poker_hand_records` — INSERT all of Jordan's MTT hand records with `user_id = '__demo__'`

## Security
- No RLS or policy changes. `poker_analytics_snapshots` already has permissive
  SELECT for `anon, authenticated` (world-readable by design for the demo
  sentinel). `poker_hand_records` and `poker_import_batches` likewise have
  existing broad SELECT policies.

## Idempotency
- All INSERTs use `ON CONFLICT DO NOTHING` against existing unique constraints:
  - `poker_analytics_snapshots(user_id, mode)`
  - `poker_hand_records(user_id, hand_hash)`
  - `poker_import_batches` has no unique constraint on `(user_id, mode)`, so a
    `WHERE NOT EXISTS` guard is used instead.
*/

-- 1. Copy the analytics snapshot (summary, graph, position analysis, etc.)
INSERT INTO poker_analytics_snapshots (
  user_id, mode, calculated_at, source_hand_count, source_imported_at,
  summary, position_analysis, preflop_analysis, postflop_analysis,
  board_analysis, tournament_analysis, graph_series, flop_analysis,
  turn_analysis, river_analysis, starting_hands, filters, sanity_checks,
  previous_summary, previous_hand_count
)
SELECT
  '__demo__', mode, calculated_at, source_hand_count, source_imported_at,
  summary, position_analysis, preflop_analysis, postflop_analysis,
  board_analysis, tournament_analysis, graph_series, flop_analysis,
  turn_analysis, river_analysis, starting_hands, filters, sanity_checks,
  previous_summary, previous_hand_count
FROM poker_analytics_snapshots
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND mode = 'mtt'
ON CONFLICT (user_id, mode) DO NOTHING;

-- 2. Copy the import batch (for import history display)
INSERT INTO poker_import_batches (
  user_id, imported_at, file_count, hand_count, imported_count,
  duplicate_count, error_count, tournament_count, elapsed_ms,
  source_types, status, error_summary, mode, summary_count, import_type
)
SELECT
  '__demo__', imported_at, file_count, hand_count, imported_count,
  duplicate_count, error_count, tournament_count, elapsed_ms,
  source_types, status, error_summary, mode, summary_count, import_type
FROM poker_import_batches
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND mode = 'mtt'
  AND NOT EXISTS (
    SELECT 1 FROM poker_import_batches d
    WHERE d.user_id = '__demo__' AND d.mode = 'mtt'
  );

-- 3. Copy all MTT hand records (for HandAnalyzer and TournamentLibraryTab)
INSERT INTO poker_hand_records (
  user_id, hand_hash, source_file_name, site, played_at, game_mode,
  tournament_id, pot_amount, bb_won, position, created_at, hero_name,
  hero_seat, blinds, stack_size, hero_cards, board, action_sequence,
  net_result, showdown, saw_flop, saw_turn, saw_river, parser_status,
  import_batch_id, hand_id, raw_hand_text, pot_type, is_3bet_pot,
  is_4bet_pot, street_reached, hero_allin_preflop, hero_allin_postflop,
  hero_preflop_action, hero_faced_3bet, hero_cbet_flop, faced_cbet_flop,
  hero_barrel_turn, hero_barrel_river, hero_checkraise, flop_high_card,
  flop_is_paired, flop_is_trips, flop_suit_texture, flop_connectivity,
  board_class, starting_hand_class, effective_stack_bb, hero_flat_3bet,
  hero_cold_call_3bet, buy_in, flop_broadway_heavy, flop_low_board,
  flop_wheel_heavy, flop_texture, allin_ev_bb, allin_ev_eligible
)
SELECT
  '__demo__', hand_hash, source_file_name, site, played_at, game_mode,
  tournament_id, pot_amount, bb_won, position, created_at, hero_name,
  hero_seat, blinds, stack_size, hero_cards, board, action_sequence,
  net_result, showdown, saw_flop, saw_turn, saw_river, parser_status,
  import_batch_id, hand_id, raw_hand_text, pot_type, is_3bet_pot,
  is_4bet_pot, street_reached, hero_allin_preflop, hero_allin_postflop,
  hero_preflop_action, hero_faced_3bet, hero_cbet_flop, faced_cbet_flop,
  hero_barrel_turn, hero_barrel_river, hero_checkraise, flop_high_card,
  flop_is_paired, flop_is_trips, flop_suit_texture, flop_connectivity,
  board_class, starting_hand_class, effective_stack_bb, hero_flat_3bet,
  hero_cold_call_3bet, buy_in, flop_broadway_heavy, flop_low_board,
  flop_wheel_heavy, flop_texture, allin_ev_bb, allin_ev_eligible
FROM poker_hand_records
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND game_mode = 'mtt'
ON CONFLICT (user_id, hand_hash) DO NOTHING;
