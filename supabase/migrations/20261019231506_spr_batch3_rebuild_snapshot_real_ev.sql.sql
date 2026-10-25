/*
# SPR Batch 3: Update rebuild_analytics_snapshot for Real EV and Tournament Metrics

## Purpose
Replace hardcoded `evBb100: 0`, `roi: 0`, `itm: 0` in rebuild_analytics_snapshot
with real values computed from:
1. `allin_ev_bb` column on poker_hand_records (populated by parseHandHistory + allInEv.ts)
2. `sv_tournament_results` table (manually entered tournament results)

## Changes
- Added accumulator variables for all-in EV: v_allin_ev_total, v_allin_ev_eligible
- In the hand loop: accumulate allin_ev_bb when allin_ev_eligible is true
- In summary output: evBb100 computed from real EV when eligible hands exist
- Added tournament metrics subquery from sv_tournament_results for ROI/ITM
- tournament_analysis now includes real roi, itm, allinEvEligible, allinEvTotal

## Security
- No RLS changes. Function is SECURITY DEFINER with fixed search_path.
*/

CREATE OR REPLACE FUNCTION rebuild_analytics_snapshot(p_user_id uuid, p_mode text DEFAULT 'mtt')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_total_hands int := 0;
  v_hero_name text;
  v_actions jsonb;
  v_saw_flop boolean; v_saw_turn boolean; v_saw_river boolean; v_showdown boolean;
  v_pot_type text; v_position text; v_hero_cards text;
  v_board_class text; v_played_at timestamptz; v_site text;
  v_pot numeric; v_blinds text; v_big_blind numeric;
  v_tourn_id text; v_net_result numeric; v_bb_won numeric;
  v_buyin numeric;
  v_hands_with_result int := 0; v_hands_without_bb int := 0;
  v_bb_won_total numeric := 0; v_profit numeric := 0;
  v_vpip_count int := 0; v_pfr_count int := 0;
  v_3bet_count int := 0; v_3bet_opp_count int := 0;
  v_cbet_flop_count int := 0; v_cbet_flop_opp_count int := 0;
  v_barrel_turn_count int := 0; v_barrel_turn_opp_count int := 0;
  v_barrel_river_count int := 0; v_barrel_river_opp_count int := 0;
  v_showdown_count int := 0; v_wtsd_count int := 0; v_wsd_count int := 0; v_wwsf_count int := 0;
  v_saw_flop_count int := 0; v_saw_turn_count int := 0; v_saw_river_count int := 0;
  v_biggest_win numeric := 0; v_biggest_loss numeric := 0;
  v_pot_total numeric := 0; v_hands_with_pot int := 0;
  v_days text[] := '{}'; v_sites text[] := '{}';
  v_tournament_ids text[] := '{}';
  v_source_files text[] := '{}';
  v_sh_map jsonb := '{}'::jsonb; v_sh_key text; v_sh_val jsonb; v_sh_array jsonb := '[]'::jsonb;
  v_board_map jsonb := '{}'::jsonb; v_board_key text; v_board_val jsonb; v_board_array jsonb := '[]'::jsonb;
  v_position_map jsonb := '{}'::jsonb; v_pos_key text; v_pos_val jsonb; v_pos_array jsonb := '[]'::jsonb;
  v_pot_unopened int := 0; v_pot_limped int := 0; v_pot_srp int := 0; v_pot_3bet int := 0; v_pot_4bet_plus int := 0;
  v_cbet_srp_count int := 0; v_cbet_srp_opp_count int := 0;
  v_cbet_3bet_count int := 0; v_cbet_3bet_opp_count int := 0;
  v_cbet_4bet_plus_count int := 0; v_cbet_4bet_plus_opp_count int := 0;
  v_double_barrel_opp_count int := 0;
  v_graph_series jsonb := '[]'::jsonb;
  v_tournament_entries int := 0; v_tournament_events int := 0;
  v_tourn_buyin_map jsonb := '{}'::jsonb; v_tourn_file_map jsonb := '{}'::jsonb;
  v_tourn_name text; v_is_satellite boolean; v_is_bounty boolean;
  v_abi numeric := 0;
  r_bb100 numeric := 0; r_vpip numeric := 0; r_pfr numeric := 0; r_3bet numeric := 0;
  r_cbet_flop numeric := 0; r_barrel_turn numeric := 0; r_barrel_river numeric := 0;
  r_wtsd numeric := 0; r_wsd numeric := 0; r_wwsf numeric := 0;
  r_avg_pot numeric := 0; r_fold_to_3bet numeric := 0; r_4bet numeric := 0; r_fold_to_4bet numeric := 0;
  r_squeeze numeric := 0; r_limp numeric := 0; r_limp_fold numeric := 0;
  r_steal numeric := 0; r_fold_to_steal numeric := 0; r_fold_to_flop_cbet numeric := 0;
  r_flop_checkraise numeric := 0; r_fold_to_turn_barrel numeric := 0; r_fold_to_river_barrel numeric := 0;
  r_cbet_srp numeric := 0; r_cbet_3bet numeric := 0; r_cbet_4bet_plus numeric := 0;
  v_flop_board text; v_turn_board text; v_river_board text;
  v_hero_allin_preflop boolean; v_hero_allin_postflop boolean;
  v_hand jsonb;
  v_starting_hand text;
  v_sh_obj jsonb;
  v_board_obj jsonb;
  v_pos_obj jsonb;
  v_board_suit_texture text; v_board_high_card text; v_board_is_paired boolean;
  v_board_is_trips boolean; v_board_connectivity text;
  v_board_level text; v_board_family text;
  v_board_paired_structure text; v_board_suited_relationship text;
  v_hand_blinds text; v_hand_bb numeric;
  -- All-in EV accumulators
  v_allin_ev_total numeric := 0;
  v_allin_ev_eligible int := 0;
  v_hand_allin_ev numeric;
  v_hand_allin_eligible boolean;
  v_ev_bb100 numeric := 0;
  -- Tournament results variables
  v_tourn_count int := 0;
  v_tourn_total_buyins numeric := 0;
  v_tourn_total_payout numeric := 0;
  v_tourn_total_cost numeric := 0;
  v_tourn_net_profit numeric := 0;
  v_tourn_roi numeric := 0;
  v_tourn_itm numeric := 0;
  v_tourn_itm_count int := 0;
  v_tourn_abi numeric := 0;
BEGIN
  FOR v_hand IN
    SELECT * FROM poker_hand_records
    WHERE user_id = p_user_id AND game_mode = p_mode
    AND hand_hash NOT LIKE '%-unknown-%'
    AND hand_hash NOT LIKE 'summary-%'
    ORDER BY played_at ASC, created_at ASC
  LOOP
    v_total_hands := v_total_hands + 1;
    v_hero_name := v_hand.hero_name;
    v_actions := v_hand.action_sequence;
    v_saw_flop := COALESCE(v_hand.saw_flop, false);
    v_saw_turn := COALESCE(v_hand.saw_turn, false);
    v_saw_river := COALESCE(v_hand.saw_river, false);
    v_showdown := COALESCE(v_hand.showdown, false);
    v_pot_type := v_hand.pot_type;
    v_position := v_hand.position;
    v_hero_cards := v_hand.hero_cards;
    v_board_class := v_hand.board_class;
    v_played_at := v_hand.played_at;
    v_site := v_hand.site;
    v_pot := v_hand.pot_amount;
    v_blinds := v_hand.blinds;
    v_tourn_id := v_hand.tournament_id;
    v_buyin := v_hand.buy_in;

    -- Track distinct tournament IDs and source files
    IF v_tourn_id IS NOT NULL THEN
      v_tournament_ids := array_append(v_tournament_ids, v_tourn_id);
      IF v_buyin IS NOT NULL AND (v_tourn_buyin_map->v_tourn_id) IS NULL THEN
        v_tourn_name := substring(v_hand.raw_hand_text from 'Tournament\s+#\S+,\s*(.*?)\s+Hold''em');
        v_is_satellite := v_tourn_name ~* '(to\s+\$?\d[\d,.]*(?:M|K)?\s*(?:GGMillion|Main\s+Event))|(\d+\s+Seats)|(MEGA\s+to)|(Deadline\s+to)|(Seat\s+Pass)|(Phase\s+\d)';
        v_is_bounty := v_tourn_name ~* '(Bounty\s+Hunters\s+Series)|(Cash\s+Drop)';
        IF NOT (v_is_satellite OR v_is_bounty) THEN
          v_tourn_buyin_map := jsonb_set(v_tourn_buyin_map, ARRAY[v_tourn_id], to_jsonb(v_buyin));
        END IF;
      END IF;
      IF v_hand.source_file_name IS NOT NULL THEN
        v_tourn_file_map := jsonb_set(v_tourn_file_map, ARRAY[v_tourn_id],
          to_jsonb(COALESCE((v_tourn_file_map->>v_tourn_id)::int, 0) + 1));
      END IF;
    END IF;
    IF v_hand.source_file_name IS NOT NULL THEN
      v_source_files := array_append(v_source_files, v_hand.source_file_name);
    END IF;

    -- BB and profit
    v_bb_won := v_hand.bb_won;
    v_net_result := v_hand.net_result;
    IF v_bb_won IS NOT NULL THEN
      v_bb_won_total := v_bb_won_total + v_bb_won;
      v_profit := v_profit + COALESCE(v_net_result, 0);
      v_hands_with_result := v_hands_with_result + 1;
      IF v_bb_won > v_biggest_win THEN v_biggest_win := v_bb_won; END IF;
      IF v_bb_won < v_biggest_loss THEN v_biggest_loss := v_bb_won; END IF;
    ELSE
      v_hands_without_bb := v_hands_without_bb + 1;
    END IF;

    -- All-in EV accumulation
    v_hand_allin_ev := v_hand.allin_ev_bb;
    v_hand_allin_eligible := COALESCE(v_hand.allin_ev_eligible, false);
    IF v_hand_allin_eligible AND v_hand_allin_ev IS NOT NULL THEN
      v_allin_ev_total := v_allin_ev_total + v_hand_allin_ev;
      v_allin_ev_eligible := v_allin_ev_eligible + 1;
    END IF;

    -- Days and sites
    IF v_played_at IS NOT NULL THEN
      v_days := array_append(v_days, substring(v_played_at::text, 1, 10));
    END IF;
    IF v_site IS NOT NULL THEN
      v_sites := array_append(v_sites, v_site);
    END IF;

    -- Pot tracking
    IF v_pot IS NOT NULL AND v_pot > 0 THEN
      v_pot_total := v_pot_total + v_pot;
      v_hands_with_pot := v_hands_with_pot + 1;
    END IF;

    -- VPIP/PFR
    IF v_actions ? 'vpip' AND (v_actions->>'vpip')::boolean THEN v_vpip_count := v_vpip_count + 1; END IF;
    IF v_actions ? 'pfr' AND (v_actions->>'pfr')::boolean THEN v_pfr_count := v_pfr_count + 1; END IF;
    IF v_actions ? 'three_bet' AND (v_actions->>'three_bet')::boolean THEN v_3bet_count := v_3bet_count + 1; END IF;
    IF v_actions ? 'three_bet_opp' AND (v_actions->>'three_bet_opp')::boolean THEN v_3bet_opp_count := v_3bet_opp_count + 1; END IF;
    IF v_actions ? 'cbet_flop' AND (v_actions->>'cbet_flop')::boolean THEN v_cbet_flop_count := v_cbet_flop_count + 1; END IF;
    IF v_actions ? 'cbet_flop_opp' AND (v_actions->>'cbet_flop_opp')::boolean THEN v_cbet_flop_opp_count := v_cbet_flop_opp_count + 1; END IF;
    IF v_actions ? 'barrel_turn' AND (v_actions->>'barrel_turn')::boolean THEN v_barrel_turn_count := v_barrel_turn_count + 1; END IF;
    IF v_actions ? 'barrel_turn_opp' AND (v_actions->>'barrel_turn_opp')::boolean THEN v_barrel_turn_opp_count := v_barrel_turn_opp_count + 1; END IF;
    IF v_actions ? 'barrel_river' AND (v_actions->>'barrel_river')::boolean THEN v_barrel_river_count := v_barrel_river_count + 1; END IF;
    IF v_actions ? 'barrel_river_opp' AND (v_actions->>'barrel_river_opp')::boolean THEN v_barrel_river_opp_count := v_barrel_river_opp_count + 1; END IF;
    IF v_actions ? 'cbet_srp' AND (v_actions->>'cbet_srp')::boolean THEN v_cbet_srp_count := v_cbet_srp_count + 1; END IF;
    IF v_actions ? 'cbet_srp_opp' AND (v_actions->>'cbet_srp_opp')::boolean THEN v_cbet_srp_opp_count := v_cbet_srp_opp_count + 1; END IF;
    IF v_actions ? 'cbet_3bet' AND (v_actions->>'cbet_3bet')::boolean THEN v_cbet_3bet_count := v_cbet_3bet_count + 1; END IF;
    IF v_actions ? 'cbet_3bet_opp' AND (v_actions->>'cbet_3bet_opp')::boolean THEN v_cbet_3bet_opp_count := v_cbet_3bet_opp_count + 1; END IF;
    IF v_actions ? 'cbet_4bet_plus' AND (v_actions->>'cbet_4bet_plus')::boolean THEN v_cbet_4bet_plus_count := v_cbet_4bet_plus_count + 1; END IF;
    IF v_actions ? 'cbet_4bet_plus_opp' AND (v_actions->>'cbet_4bet_plus_opp')::boolean THEN v_cbet_4bet_plus_opp_count := v_cbet_4bet_plus_opp_count + 1; END IF;

    IF v_saw_flop THEN v_saw_flop_count := v_saw_flop_count + 1; END IF;
    IF v_saw_turn THEN v_saw_turn_count := v_saw_turn_count + 1; END IF;
    IF v_saw_river THEN v_saw_river_count := v_saw_river_count + 1; END IF;
    IF v_showdown THEN v_showdown_count := v_showdown_count + 1; END IF;
    IF v_actions ? 'wtsd' AND (v_actions->>'wtsd')::boolean THEN v_wtsd_count := v_wtsd_count + 1; END IF;
    IF v_actions ? 'wsd' AND (v_actions->>'wsd')::boolean THEN v_wsd_count := v_wsd_count + 1; END IF;
    IF v_actions ? 'wwsf' AND (v_actions->>'wwsf')::boolean THEN v_wwsf_count := v_wwsf_count + 1; END IF;

    -- Pot type
    IF v_pot_type = 'unopened' THEN v_pot_unopened := v_pot_unopened + 1;
    ELSIF v_pot_type = 'limped' THEN v_pot_limped := v_pot_limped + 1;
    ELSIF v_pot_type = 'srp' THEN v_pot_srp := v_pot_srp + 1;
    ELSIF v_pot_type = '3bet' THEN v_pot_3bet := v_pot_3bet + 1;
    ELSIF v_pot_type = '4bet+' THEN v_pot_4bet_plus := v_pot_4bet_plus + 1;
    END IF;

    -- Starting hand
    v_starting_hand := v_hero_cards;
    IF v_starting_hand IS NOT NULL AND v_starting_hand != '' THEN
      v_sh_key := v_starting_hand;
      v_sh_val := v_sh_map->v_sh_key;
      IF v_sh_val IS NULL THEN
        v_sh_obj := jsonb_build_object('hand', v_sh_key, 'hands', 1, 'bbWon', COALESCE(v_bb_won, 0), 'vpip', 0, 'pfr', 0, 'wins', CASE WHEN v_bb_won > 0 THEN 1 ELSE 0 END);
        v_sh_map := jsonb_set(v_sh_map, ARRAY[v_sh_key], v_sh_obj);
      ELSE
        v_sh_obj := jsonb_build_object('hand', v_sh_key, 'hands', (v_sh_val->>'hands')::int + 1, 'bbWon', (v_sh_val->>'bbWon')::numeric + COALESCE(v_bb_won, 0), 'vpip', 0, 'pfr', 0, 'wins', (v_sh_val->>'wins')::int + CASE WHEN v_bb_won > 0 THEN 1 ELSE 0 END);
        v_sh_map := jsonb_set(v_sh_map, ARRAY[v_sh_key], v_sh_obj);
      END IF;
    END IF;

    -- Position
    IF v_position IS NOT NULL AND v_position != '' THEN
      v_pos_key := v_position;
      v_pos_val := v_position_map->v_pos_key;
      IF v_pos_val IS NULL THEN
        v_pos_obj := jsonb_build_object('position', v_pos_key, 'hands', 1, 'bbWon', COALESCE(v_bb_won, 0), 'vpip', 0, 'pfr', 0, 'wins', CASE WHEN v_bb_won > 0 THEN 1 ELSE 0 END);
        v_position_map := jsonb_set(v_position_map, ARRAY[v_pos_key], v_pos_obj);
      ELSE
        v_pos_obj := jsonb_build_object('position', v_pos_key, 'hands', (v_pos_val->>'hands')::int + 1, 'bbWon', (v_pos_val->>'bbWon')::numeric + COALESCE(v_bb_won, 0), 'vpip', 0, 'pfr', 0, 'wins', (v_pos_val->>'wins')::int + CASE WHEN v_bb_won > 0 THEN 1 ELSE 0 END);
        v_position_map := jsonb_set(v_position_map, ARRAY[v_pos_key], v_pos_obj);
      END IF;
    END IF;

    -- Board class
    IF v_board_class IS NOT NULL AND v_board_class != '' THEN
      v_board_key := v_board_class;
      v_board_val := v_board_map->v_board_key;
      IF v_board_val IS NULL THEN
        v_board_obj := jsonb_build_object('board_class', v_board_key, 'hands', 1, 'bbWon', COALESCE(v_bb_won, 0));
        v_board_map := jsonb_set(v_board_map, ARRAY[v_board_key], v_board_obj);
      ELSE
        v_board_obj := jsonb_build_object('board_class', v_board_key, 'hands', (v_board_val->>'hands')::int + 1, 'bbWon', (v_board_val->>'bbWon')::numeric + COALESCE(v_bb_won, 0));
        v_board_map := jsonb_set(v_board_map, ARRAY[v_board_key], v_board_obj);
      END IF;
    END IF;

    -- Graph series point
    v_graph_series := v_graph_series || jsonb_build_array(jsonb_build_object('hand', v_total_hands, 'bbWon', round(v_bb_won_total * 100) / 100, 'profit', round(v_profit)));

  END LOOP;

  -- Compute rates
  r_bb100 := CASE WHEN v_total_hands > 0 THEN (v_bb_won_total / v_total_hands) * 100 ELSE 0 END;
  r_vpip := CASE WHEN v_total_hands > 0 THEN (v_vpip_count::numeric / v_total_hands) * 100 ELSE 0 END;
  r_pfr := CASE WHEN v_total_hands > 0 THEN (v_pfr_count::numeric / v_total_hands) * 100 ELSE 0 END;
  r_3bet := CASE WHEN v_3bet_opp_count > 0 THEN (v_3bet_count::numeric / v_3bet_opp_count) * 100 ELSE 0 END;
  r_cbet_flop := CASE WHEN v_cbet_flop_opp_count > 0 THEN (v_cbet_flop_count::numeric / v_cbet_flop_opp_count) * 100 ELSE 0 END;
  r_barrel_turn := CASE WHEN v_barrel_turn_opp_count > 0 THEN (v_barrel_turn_count::numeric / v_barrel_turn_opp_count) * 100 ELSE 0 END;
  r_barrel_river := CASE WHEN v_barrel_river_opp_count > 0 THEN (v_barrel_river_count::numeric / v_barrel_river_opp_count) * 100 ELSE 0 END;
  r_wtsd := CASE WHEN v_total_hands > 0 THEN (v_wtsd_count::numeric / v_total_hands) * 100 ELSE 0 END;
  r_wsd := CASE WHEN v_wtsd_count > 0 THEN (v_wsd_count::numeric / v_wtsd_count) * 100 ELSE 0 END;
  r_wwsf := CASE WHEN v_saw_flop_count > 0 THEN (v_wwsf_count::numeric / v_saw_flop_count) * 100 ELSE 0 END;
  r_avg_pot := CASE WHEN v_hands_with_pot > 0 THEN v_pot_total / v_hands_with_pot ELSE 0 END;
  r_cbet_srp := CASE WHEN v_cbet_srp_opp_count > 0 THEN (v_cbet_srp_count::numeric / v_cbet_srp_opp_count) * 100 ELSE 0 END;
  r_cbet_3bet := CASE WHEN v_cbet_3bet_opp_count > 0 THEN (v_cbet_3bet_count::numeric / v_cbet_3bet_opp_count) * 100 ELSE 0 END;
  r_cbet_4bet_plus := CASE WHEN v_cbet_4bet_plus_opp_count > 0 THEN (v_cbet_4bet_plus_count::numeric / v_cbet_4bet_plus_opp_count) * 100 ELSE 0 END;

  -- Tournament entries
  v_tournament_entries := COALESCE(array_length(v_tournament_ids, 1), 0);
  SELECT count(DISTINCT k) INTO v_tournament_events FROM jsonb_object_keys(v_tourn_buyin_map) AS k;

  -- ABI from buy-in map
  IF v_tournament_events > 0 THEN
    SELECT avg((value)::numeric) INTO v_abi FROM jsonb_each_text(v_tourn_buyin_map);
  END IF;

  -- All-in EV bb100
  v_ev_bb100 := CASE WHEN v_allin_ev_eligible > 0 AND v_total_hands > 0
    THEN round((v_allin_ev_total / v_total_hands) * 100 * 1000) / 1000 ELSE 0 END;

  -- Tournament results metrics from sv_tournament_results
  SELECT
    COUNT(*),
    COALESCE(SUM(buy_in), 0),
    COALESCE(SUM(payout), 0),
    COALESCE(SUM(buy_in + entry_fee), 0)
  INTO v_tourn_count, v_tourn_total_buyins, v_tourn_total_payout, v_tourn_total_cost
  FROM sv_tournament_results
  WHERE user_id = p_user_id AND buy_in > 0;

  IF v_tourn_count > 0 THEN
    v_tourn_net_profit := v_tourn_total_payout - v_tourn_total_cost;
    v_tourn_roi := CASE WHEN v_tourn_total_cost > 0
      THEN round(((v_tourn_net_profit / v_tourn_total_cost) * 100) * 10) / 10 ELSE 0 END;
    SELECT count(*) INTO v_tourn_itm_count
    FROM sv_tournament_results
    WHERE user_id = p_user_id AND buy_in > 0 AND payout > 0;
    v_tourn_itm := CASE WHEN v_tourn_count > 0
      THEN round(((v_tourn_itm_count::numeric / v_tourn_count) * 100) * 10) / 10 ELSE 0 END;
    v_tourn_abi := CASE WHEN v_tourn_count > 0
      THEN v_tourn_total_buyins / v_tourn_count ELSE 0 END;
    -- Use tournament results ABI if hand-based ABI is 0
    IF v_abi = 0 AND v_tourn_abi > 0 THEN v_abi := v_tourn_abi; END IF;
    -- Use tournament results count if higher
    IF v_tourn_count > v_tournament_entries THEN
      v_tournament_entries := v_tourn_count;
      v_tournament_events := v_tourn_count;
    END IF;
  END IF;

  -- Build starting hands array
  FOR v_sh_key, v_sh_val IN SELECT key, value FROM jsonb_each(v_sh_map)
  LOOP
    v_sh_array := v_sh_array || jsonb_build_object(
      'hand', v_sh_key,
      'hands', (v_sh_val->>'hands')::int,
      'bbWon', round((v_sh_val->>'bbWon')::numeric * 100) / 100,
      'bb100', CASE WHEN (v_sh_val->>'hands')::int > 0 THEN round(((v_sh_val->>'bbWon')::numeric / (v_sh_val->>'hands')::int) * 100 * 10) / 10 ELSE NULL END
    );
  END LOOP;

  -- Build board analysis array
  FOR v_board_key, v_board_val IN SELECT key, value FROM jsonb_each(v_board_map)
  LOOP
    v_board_array := v_board_array || jsonb_build_object(
      'board_class', v_board_key,
      'hands', (v_board_val->>'hands')::int,
      'bbWon', round((v_board_val->>'bbWon')::numeric * 100) / 100,
      'bb100', CASE WHEN (v_board_val->>'hands')::int > 0 THEN round(((v_board_val->>'bbWon')::numeric / (v_board_val->>'hands')::int) * 100 * 10) / 10 ELSE NULL END
    );
  END LOOP;

  -- Build position analysis array
  FOR v_pos_key, v_pos_val IN SELECT key, value FROM jsonb_each(v_position_map)
  LOOP
    v_pos_array := v_pos_array || jsonb_build_object(
      'position', v_pos_key,
      'hands', (v_pos_val->>'hands')::int,
      'bbWon', round((v_pos_val->>'bbWon')::numeric * 100) / 100,
      'bb100', CASE WHEN (v_pos_val->>'hands')::int > 0 THEN round(((v_pos_val->>'bbWon')::numeric / (v_pos_val->>'hands')::int) * 100 * 10) / 10 ELSE NULL END
    );
  END LOOP;

  v_snapshot := jsonb_build_object(
    'summary', jsonb_build_object(
      'hands', v_total_hands,
      'profit', round(v_profit),
      'bbWon', round(v_bb_won_total * 100) / 100,
      'bb100', round(r_bb100 * 1000) / 1000,
      'evBb100', v_ev_bb100,
      'allinEvEligible', v_allin_ev_eligible,
      'allinEvTotal', round(v_allin_ev_total * 1000) / 1000,
      'vpip', round(r_vpip * 10) / 10,
      'pfr', round(r_pfr * 10) / 10,
      'threeBet', round(r_3bet * 10) / 10,
      'cbetFlop', round(r_cbet_flop * 10) / 10,
      'barrelTurn', round(r_barrel_turn * 10) / 10,
      'barrelRiver', round(r_barrel_river * 10) / 10,
      'wtsd', round(r_wtsd * 10) / 10,
      'wsd', round(r_wsd * 10) / 10,
      'wwsf', round(r_wwsf * 10) / 10,
      'roi', COALESCE(v_tourn_roi, 0),
      'abi', v_abi,
      'itm', COALESCE(v_tourn_itm, 0),
      'tournamentEntries', v_tournament_entries,
      'tournamentEvents', v_tournament_events,
      'reEntries', v_tournament_entries - v_tournament_events,
      'activeDays', COALESCE(array_length(v_days, 1), 0),
      'spi', -1,
      'avgPot', round(r_avg_pot * 10) / 10,
      'sites', COALESCE(array_length(v_sites, 1), 0),
      'foldTo3bet', 0, 'fourBet', 0, 'foldTo4bet', 0,
      'squeeze', 0, 'limp', 0, 'limpFold', 0,
      'steal', 0, 'foldToSteal', 0,
      'foldToFlopCbet', 0, 'checkRaiseFlop', 0,
      'foldToTurnBarrel', 0, 'foldToRiverBarrel', 0,
      'unopened', CASE WHEN v_total_hands > 0 THEN round((v_pot_unopened::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
      'limped', CASE WHEN v_total_hands > 0 THEN round((v_pot_limped::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
      'srp', CASE WHEN v_total_hands > 0 THEN round((v_pot_srp::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
      '3bet', CASE WHEN v_total_hands > 0 THEN round((v_pot_3bet::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
      '4bet_plus', CASE WHEN v_total_hands > 0 THEN round((v_pot_4bet_plus::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
      'vpipCount', v_vpip_count, 'pfrCount', v_pfr_count,
      'threeBetCount', v_3bet_count, 'threeBetOppCount', v_3bet_opp_count,
      'cbetFlopCount', v_cbet_flop_count, 'cbetFlopOppCount', v_cbet_flop_opp_count,
      'barrelTurnCount', v_barrel_turn_count, 'barrelTurnOppCount', v_barrel_turn_opp_count,
      'barrelRiverCount', v_barrel_river_count, 'barrelRiverOppCount', v_barrel_river_opp_count,
      'wtsdCount', v_wtsd_count, 'wsdCount', v_wsd_count, 'wwsfCount', v_wwsf_count,
      'showdownCount', v_showdown_count,
      'sawFlopCount', v_saw_flop_count, 'sawTurnCount', v_saw_turn_count, 'sawRiverCount', v_saw_river_count,
      'handsWithResult', v_hands_with_result, 'handsWithoutBB', v_hands_without_bb,
      'biggestWin', round(v_biggest_win * 100) / 100, 'biggestLoss', round(v_biggest_loss * 100) / 100
    ),
    'flop_analysis', jsonb_build_object(
      'sawFlopCount', v_saw_flop_count,
      'cbetFlop', r_cbet_flop, 'cbetFlopCount', v_cbet_flop_count, 'cbetFlopOppCount', v_cbet_flop_opp_count,
      'wwsf', r_wwsf, 'wwsfCount', v_wwsf_count,
      'cbet_srp', r_cbet_srp, 'cbet_3bet', r_cbet_3bet, 'cbet_4bet_plus', r_cbet_4bet_plus
    ),
    'turn_analysis', jsonb_build_object(
      'sawTurnCount', v_saw_turn_count,
      'barrelTurn', r_barrel_turn, 'barrelTurnCount', v_barrel_turn_count, 'barrelTurnOppCount', v_barrel_turn_opp_count,
      'doubleBarrelOppCount', v_double_barrel_opp_count
    ),
    'river_analysis', jsonb_build_object(
      'sawRiverCount', v_saw_river_count,
      'barrelRiver', r_barrel_river, 'barrelRiverCount', v_barrel_river_count, 'barrelRiverOppCount', v_barrel_river_opp_count,
      'showdownCount', v_showdown_count, 'wsdCount', v_wsd_count,
      'wsd', r_wsd, 'wtsd', r_wtsd, 'wtsdCount', v_wtsd_count
    ),
    'starting_hands', COALESCE(v_sh_array, '[]'::jsonb),
    'board_analysis', COALESCE(v_board_array, '[]'::jsonb),
    'position_analysis', COALESCE(v_pos_array, '[]'::jsonb),
    'preflop_analysis', jsonb_build_object(
      'vpip', r_vpip, 'pfr', r_pfr, 'threeBet', r_3bet,
      'vpipCount', v_vpip_count, 'pfrCount', v_pfr_count,
      'threeBetCount', v_3bet_count, 'threeBetOppCount', v_3bet_opp_count
    ),
    'postflop_analysis', jsonb_build_object(
      'cbetFlop', r_cbet_flop, 'barrelTurn', r_barrel_turn, 'barrelRiver', r_barrel_river,
      'cbetFlopCount', v_cbet_flop_count, 'cbetFlopOppCount', v_cbet_flop_opp_count,
      'barrelTurnCount', v_barrel_turn_count, 'barrelTurnOppCount', v_barrel_turn_opp_count,
      'barrelRiverCount', v_barrel_river_count, 'barrelRiverOppCount', v_barrel_river_opp_count
    ),
    'tournament_analysis', jsonb_build_object(
      'roi', COALESCE(v_tourn_roi, 0),
      'abi', v_abi,
      'itm', COALESCE(v_tourn_itm, 0),
      'tournamentCount', v_tournament_entries,
      'tournamentEvents', v_tournament_events,
      'tournamentEntries', v_tournament_entries,
      'reEntries', v_tournament_entries - v_tournament_events,
      'profit', round(v_profit),
      'biggestWin', round(v_biggest_win * 100) / 100,
      'biggestLoss', round(v_biggest_loss * 100) / 100,
      'allinEvEligible', v_allin_ev_eligible,
      'allinEvTotal', round(v_allin_ev_total * 1000) / 1000,
      'tournamentResultsCount', v_tourn_count,
      'tournamentNetProfit', round(v_tourn_net_profit * 100) / 100
    ),
    'graph_series', v_graph_series,
    'computed_at', now()
  );

  -- Upsert snapshot
  INSERT INTO poker_analytics_snapshots (user_id, mode, summary, calculated_at)
  VALUES (p_user_id, p_mode, v_snapshot, now())
  ON CONFLICT (user_id, mode) DO UPDATE SET
    summary = EXCLUDED.summary,
    calculated_at = now();

  RETURN v_snapshot;
END;
$$;