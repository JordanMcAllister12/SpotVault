/*
# Seed Bryan Paris demo analytics snapshot

Bryan Paris (uuid d421b1bd-f8c6-4cd0-b68f-40ae275e99ba) has no analytics data,
causing the Analytics view to show empty state when he logs in.

This inserts a pre-built MTT analytics snapshot with realistic stats for a
high-volume MTT player/coach — consistent with Bryan's COO/Coach profile and
$10M+ in career cashes.

Also fixes coach_listings: ensures is_published = true and available_for_coaching = true
so Bryan's listing appears in the coaching marketplace.
*/

-- Upsert Bryan's MTT analytics snapshot
INSERT INTO poker_analytics_snapshots (
  user_id, mode, calculated_at, source_hand_count, source_imported_at,
  summary, position_analysis, preflop_analysis, postflop_analysis,
  board_analysis, tournament_analysis, graph_series,
  flop_analysis, turn_analysis, river_analysis, starting_hands, filters
)
VALUES (
  'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
  'mtt',
  now(),
  4847,
  now() - interval '2 days',
  -- summary
  '{
    "total_hands": 4847,
    "total_profit_bb": 1284.5,
    "bb_per_100": 26.5,
    "vpip": 23.4,
    "pfr": 19.8,
    "af": 3.2,
    "three_bet_pct": 8.7,
    "fold_to_3bet_pct": 54.2,
    "cbet_flop_pct": 68.1,
    "fold_to_cbet_pct": 41.3,
    "wtsd_pct": 26.8,
    "wmsd_pct": 54.4,
    "avg_pot_won_bb": 12.4,
    "session_count": 94,
    "avg_stack_start_bb": 42.8,
    "net_result_bb": 1284.5
  }'::jsonb,
  -- position_analysis
  '[
    {"position": "BTN", "hands": 712, "bb_won": 348.2, "bb100": 48.9, "vpip": 38.2, "pfr": 32.1},
    {"position": "CO",  "hands": 614, "bb_won": 247.6, "bb100": 40.3, "vpip": 28.4, "pfr": 24.7},
    {"position": "MP",  "hands": 591, "bb_won": 182.3, "bb100": 30.8, "vpip": 20.1, "pfr": 17.2},
    {"position": "UTG", "hands": 548, "bb_won": 98.4,  "bb100": 17.9, "vpip": 14.6, "pfr": 12.8},
    {"position": "SB",  "hands": 724, "bb_won": 174.1, "bb100": 24.0, "vpip": 26.3, "pfr": 20.4},
    {"position": "BB",  "hands": 731, "bb_won": 233.9, "bb100": 32.0, "vpip": 31.2, "pfr": 14.6},
    {"position": "HJ",  "hands": 572, "bb_won": 156.8, "bb100": 27.4, "vpip": 18.7, "pfr": 15.9},
    {"position": "LJ",  "hands": 355, "bb_won": -156.8,"bb100": -44.2,"vpip": 13.8, "pfr": 11.6}
  ]'::jsonb,
  -- preflop_analysis
  '{
    "vpip": 23.4, "pfr": 19.8, "three_bet_pct": 8.7, "four_bet_pct": 2.1,
    "fold_to_3bet_pct": 54.2, "fold_to_4bet_pct": 68.3,
    "steal_pct": 42.6, "fold_to_steal_bb": 61.4, "fold_to_steal_sb": 72.8,
    "limp_pct": 1.8, "iso_pct": 4.3, "open_raise_pct": 18.2,
    "cold_call_pct": 3.6, "squeeze_pct": 3.1
  }'::jsonb,
  -- postflop_analysis
  '{
    "cbet_flop_pct": 68.1, "cbet_turn_pct": 52.4, "cbet_river_pct": 44.7,
    "fold_to_cbet_flop_pct": 41.3, "fold_to_cbet_turn_pct": 36.8,
    "check_raise_flop_pct": 8.2, "check_raise_turn_pct": 6.4,
    "donk_pct": 3.1, "probe_pct": 14.8, "af": 3.2,
    "wtsd_pct": 26.8, "wmsd_pct": 54.4
  }'::jsonb,
  -- board_analysis
  '[
    {"texture": "Dry Paired",    "hands": 412, "bb100": 38.2},
    {"texture": "Dry Unpaired",  "hands": 698, "bb100": 31.6},
    {"texture": "Wet Connected", "hands": 524, "bb100": 18.4},
    {"texture": "Monotone",      "hands": 184, "bb100": 22.1},
    {"texture": "Two-Tone Dry",  "hands": 376, "bb100": 28.7},
    {"texture": "Two-Tone Wet",  "hands": 298, "bb100": 14.3}
  ]'::jsonb,
  -- tournament_analysis
  '{
    "tournaments_played": 94, "itm_pct": 34.2, "final_table_pct": 12.8,
    "avg_finish_pct": 28.4, "best_finish": 1, "wins": 3,
    "avg_buy_in": 840, "total_invested": 78960, "total_cashed": 143280,
    "roi_pct": 81.4, "early_bust_pct": 21.3, "late_bust_pct": 44.7
  }'::jsonb,
  -- graph_series (94 tournaments, cumulative profit in buy-ins)
  (
    SELECT jsonb_agg(jsonb_build_object(
      'index', gs.i,
      'profit', ROUND((gs.i * 1.81 + (random() * 6 - 1.8))::numeric, 2)
    ) ORDER BY gs.i)
    FROM generate_series(1, 94) as gs(i)
  ),
  -- flop_analysis
  '{
    "cbet_pct": 68.1, "check_pct": 31.9, "fold_pct": 18.4,
    "call_pct": 42.6, "raise_pct": 14.8, "check_raise_pct": 8.2,
    "oop_cbet_pct": 54.3, "ip_cbet_pct": 74.2, "draw_pct": 28.6
  }'::jsonb,
  -- turn_analysis
  '{
    "cbet_pct": 52.4, "check_pct": 47.6, "fold_pct": 22.1,
    "call_pct": 38.4, "raise_pct": 11.4, "check_raise_pct": 6.4,
    "barrel_pct": 52.4, "give_up_pct": 47.6
  }'::jsonb,
  -- river_analysis
  '{
    "bet_pct": 44.7, "check_pct": 55.3, "fold_pct": 28.6,
    "call_pct": 32.1, "raise_pct": 4.8, "bluff_pct": 18.2,
    "value_bet_pct": 26.5
  }'::jsonb,
  -- starting_hands (sample of key hands)
  '[
    {"hand": "AA",  "hands": 48,  "bb_won": 184.2, "bb100": 383.8},
    {"hand": "KK",  "hands": 52,  "bb_won": 162.4, "bb100": 312.3},
    {"hand": "QQ",  "hands": 49,  "bb_won": 98.6,  "bb100": 201.2},
    {"hand": "JJ",  "hands": 47,  "bb_won": 42.8,  "bb100": 91.1},
    {"hand": "TT",  "hands": 51,  "bb_won": 28.4,  "bb100": 55.7},
    {"hand": "AKs", "hands": 62,  "bb_won": 96.3,  "bb100": 155.3},
    {"hand": "AKo", "hands": 184, "bb_won": 248.6, "bb100": 135.1},
    {"hand": "AQs", "hands": 58,  "bb_won": 48.2,  "bb100": 83.1},
    {"hand": "AQo", "hands": 172, "bb_won": 84.6,  "bb100": 49.2},
    {"hand": "KQs", "hands": 54,  "bb_won": 32.4,  "bb100": 60.0},
    {"hand": "72o", "hands": 84,  "bb_won": -48.6, "bb100": -57.9}
  ]'::jsonb,
  -- filters
  '{}'::jsonb
)
ON CONFLICT (user_id, mode) DO UPDATE SET
  calculated_at = EXCLUDED.calculated_at,
  source_hand_count = EXCLUDED.source_hand_count,
  summary = EXCLUDED.summary,
  position_analysis = EXCLUDED.position_analysis,
  preflop_analysis = EXCLUDED.preflop_analysis,
  postflop_analysis = EXCLUDED.postflop_analysis,
  board_analysis = EXCLUDED.board_analysis,
  tournament_analysis = EXCLUDED.tournament_analysis,
  graph_series = EXCLUDED.graph_series,
  flop_analysis = EXCLUDED.flop_analysis,
  turn_analysis = EXCLUDED.turn_analysis,
  river_analysis = EXCLUDED.river_analysis,
  starting_hands = EXCLUDED.starting_hands;

-- Seed a matching import_batches row so Analytics shows an import history
INSERT INTO poker_import_batches (user_id, imported_at, file_count, hand_count, imported_count, duplicate_count, error_count, tournament_count, elapsed_ms)
VALUES ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', now() - interval '2 days', 12, 4847, 4847, 184, 0, 94, 18420)
ON CONFLICT DO NOTHING;

-- Ensure Bryan's coach listing is published and available
UPDATE coach_listings
SET is_published = true, available_for_coaching = true,
    profile_photo_url = '/assets/profiles/image copy.png'
WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
