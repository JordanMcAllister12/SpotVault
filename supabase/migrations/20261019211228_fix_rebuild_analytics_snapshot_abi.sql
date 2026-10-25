/*
# Fix rebuild_analytics_snapshot: compute ABI instead of hardcoding 0

The SQL function rebuild_analytics_snapshot hardcodes abi=0 in tournament_analysis.
This update adds proper ABI computation:
- Track buy-in per tournament and file count per tournament
- Detect satellite/bounty patterns and exclude their buy-in
- ABI = sum(buy_in × file_count) / total_entries
*/
CREATE OR REPLACE FUNCTION rebuild_analytics_snapshot(p_user_id text, p_mode text)
RETURNS jsonb AS $$
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
  v_cbet_4bet_count int := 0; v_cbet_4bet_opp_count int := 0;
  v_fold_to_3bet_count int := 0; v_fold_to_3bet_opp_count int := 0;
  v_4bet_count int := 0; v_4bet_opp_count int := 0;
  v_fold_to_4bet_count int := 0; v_fold_to_4bet_opp_count int := 0;
  v_squeeze_count int := 0; v_squeeze_opp_count int := 0;
  v_limp_count int := 0; v_limp_opp_count int := 0;
  v_limp_fold_count int := 0; v_limp_fold_opp_count int := 0;
  v_steal_count int := 0; v_steal_opp_count int := 0;
  v_fold_to_steal_count int := 0; v_fold_to_steal_opp_count int := 0;
  v_fold_to_flop_cbet_count int := 0; v_fold_to_flop_cbet_opp_count int := 0;
  v_call_flop_cbet_count int := 0; v_call_flop_cbet_opp_count int := 0;
  v_raise_flop_cbet_count int := 0; v_raise_flop_cbet_opp_count int := 0;
  v_flop_cbet_success_count int := 0; v_flop_cbet_success_opp_count int := 0;
  v_flop_checkraise_count int := 0; v_flop_checkraise_opp_count int := 0;
  v_bet_when_checked_to_count int := 0; v_bet_when_checked_to_opp_count int := 0;
  v_flop_aggression_count int := 0; v_flop_aggression_opp_count int := 0;
  v_flop_donk_bet_count int := 0; v_flop_donk_bet_opp_count int := 0;
  v_fold_to_turn_barrel_count int := 0; v_fold_to_turn_barrel_opp_count int := 0;
  v_call_turn_barrel_count int := 0; v_call_turn_barrel_opp_count int := 0;
  v_raise_turn_barrel_count int := 0; v_raise_turn_barrel_opp_count int := 0;
  v_turn_barrel_success_count int := 0; v_turn_barrel_success_opp_count int := 0;
  v_delayed_cbet_count int := 0; v_delayed_cbet_opp_count int := 0;
  v_turn_checkraise_count int := 0; v_turn_checkraise_opp_count int := 0;
  v_turn_aggression_count int := 0; v_turn_aggression_opp_count int := 0;
  v_turn_probe_count int := 0; v_turn_probe_opp_count int := 0;
  v_turn_bet_when_checked_to_count int := 0; v_turn_bet_when_checked_to_opp_count int := 0;
  v_double_barrel_opp_count int := 0;
  v_fold_to_river_barrel_count int := 0; v_fold_to_river_barrel_opp_count int := 0;
  v_call_river_barrel_count int := 0; v_call_river_barrel_opp_count int := 0;
  v_raise_river_barrel_count int := 0; v_raise_river_barrel_opp_count int := 0;
  v_river_bet_count int := 0; v_river_bet_opp_count int := 0;
  v_river_checkraise_count int := 0; v_river_checkraise_opp_count int := 0;
  v_river_aggression_count int := 0; v_river_aggression_opp_count int := 0;
  v_river_bet_success_count int := 0; v_river_bet_success_opp_count int := 0;
  v_river_bet_when_checked_to_count int := 0; v_river_bet_when_checked_to_opp_count int := 0;
  v_cum_bb numeric := 0; v_cum_showdown numeric := 0; v_cum_non_showdown numeric := 0;
  v_graph_series jsonb := '[]'::jsonb; v_graph_step int;
  v_tournament_entries int := 0; v_tournament_events int := 0;
  v_abi numeric := 0; v_total_buyin numeric := 0;
  v_tourn_buyin_map jsonb := '{}'::jsonb;
  v_tourn_file_map jsonb := '{}'::jsonb;
  v_tourn_name text; v_is_satellite boolean; v_is_bounty boolean;
  r_vpip numeric; r_pfr numeric; r_3bet numeric;
  r_cbet_flop numeric; r_barrel_turn numeric; r_barrel_river numeric;
  r_wtsd numeric; r_wsd numeric; r_wwsf numeric;
  r_bb100 numeric; r_avg_pot numeric;
  r_fold_to_3bet numeric; r_4bet numeric; r_fold_to_4bet numeric;
  r_squeeze numeric; r_limp numeric; r_limp_fold numeric;
  r_steal numeric; r_fold_to_steal numeric;
  r_fold_to_flop_cbet numeric; r_call_flop_cbet numeric; r_raise_flop_cbet numeric;
  r_flop_cbet_success numeric; r_flop_checkraise numeric;
  r_bet_when_checked_to numeric; r_flop_aggression numeric; r_flop_donk_bet numeric;
  r_fold_to_turn_barrel numeric; r_call_turn_barrel numeric; r_raise_turn_barrel numeric;
  r_turn_barrel_success numeric; r_delayed_cbet numeric; r_turn_checkraise numeric;
  r_turn_aggression numeric; r_turn_probe numeric; r_turn_bet_when_checked_to numeric;
  r_fold_to_river_barrel numeric; r_call_river_barrel numeric; r_raise_river_barrel numeric;
  r_river_bet numeric; r_river_checkraise numeric; r_river_aggression numeric;
  r_river_bet_success numeric; r_river_bet_when_checked_to numeric;
  r_cbet_srp numeric; r_cbet_3bet numeric; r_cbet_4bet_plus numeric;
  v_pct_div numeric;
  v_pf_actions jsonb; v_hero_pf jsonb;
  v_hero_flop jsonb; v_hero_turn jsonb; v_hero_river jsonb;
  v_flop_actions jsonb; v_turn_actions jsonb; v_river_actions jsonb;
  v_last_raiser text; v_hero_is_aggressor boolean;
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
      -- Track buy-in per tournament (first non-null)
      IF v_buyin IS NOT NULL AND (v_tourn_buyin_map->v_tourn_id) IS NULL THEN
        -- Extract tournament name for satellite/bounty detection
        v_tourn_name := substring(v_hand.raw_hand_text from 'Tournament\s+#\S+,\s*(.*?)\s+Hold''em');
        v_is_satellite := v_tourn_name ~* '(to\s+\$?\d[\d,.]*(?:M|K)?\s*(?:GGMillion|Main\s+Event))|(\d+\s+Seats)|(MEGA\s+to)|(Deadline\s+to)|(Seat\s+Pass)|(Phase\s+\d)';
        v_is_bounty := v_tourn_name ~* '(Bounty\s+Hunters\s+Series)|(Cash\s+Drop)';
        IF NOT (v_is_satellite OR v_is_bounty) THEN
          v_tourn_buyin_map := jsonb_set(v_tourn_buyin_map, ARRAY[v_tourn_id], to_jsonb(v_buyin));
        END IF;
      END IF;
      -- Track file count per tournament
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

    -- Days and sites
    IF v_played_at IS NOT NULL THEN
      v_days := array_append(v_days, substring(v_played_at::text, 1, 10));
    END IF;
    IF v_site IS NOT NULL THEN
      v_sites := array_append(v_sites, v_site);
    END IF;

    -- Pot
    IF v_pot IS NOT NULL THEN
      v_pot_total := v_pot_total + v_pot;
      v_hands_with_pot := v_hands_with_pot + 1;
    END IF;

    -- Position
    IF v_position IS NOT NULL THEN
      v_pos_obj := v_position_map->v_position;
      IF v_pos_obj IS NULL THEN
        v_position_map := jsonb_set(v_position_map, ARRAY[v_position],
          jsonb_build_object('hands', 1, 'bbWon', COALESCE(v_bb_won, 0), 'profit', COALESCE(v_net_result, 0)));
      ELSE
        v_position_map := jsonb_set(v_position_map, ARRAY[v_position],
          jsonb_build_object(
            'hands', (v_pos_obj->>'hands')::int + 1,
            'bbWon', (v_pos_obj->>'bbWon')::numeric + COALESCE(v_bb_won, 0),
            'profit', (v_pos_obj->>'profit')::numeric + COALESCE(v_net_result, 0)
          ));
      END IF;
    END IF;

    -- Saw flop/turn/river
    IF v_saw_flop THEN v_saw_flop_count := v_saw_flop_count + 1; END IF;
    IF v_saw_turn THEN v_saw_turn_count := v_saw_turn_count + 1; END IF;
    IF v_saw_river THEN v_saw_river_count := v_saw_river_count + 1; END IF;

    -- Pot type
    IF v_pot_type = 'unopened' THEN v_pot_unopened := v_pot_unopened + 1;
    ELSIF v_pot_type = 'limped' THEN v_pot_limped := v_pot_limped + 1;
    ELSIF v_pot_type = 'srp' THEN v_pot_srp := v_pot_srp + 1;
    ELSIF v_pot_type = '3bet' THEN v_pot_3bet := v_pot_3bet + 1;
    ELSIF v_pot_type = '4bet_plus' THEN v_pot_4bet_plus := v_pot_4bet_plus + 1;
    END IF;

    -- Preflop stats
    v_pf_actions := v_actions->'preflop';
    v_hero_pf := v_actions->'hero_preflop';
    IF v_hero_pf IS NOT NULL THEN
      IF (v_hero_pf->>'vpip')::boolean THEN v_vpip_count := v_vpip_count + 1; END IF;
      IF (v_hero_pf->>'pfr')::boolean THEN v_pfr_count := v_pfr_count + 1; END IF;
      IF (v_hero_pf->>'three_bet_opportunity')::boolean THEN v_3bet_opp_count := v_3bet_opp_count + 1; END IF;
      IF (v_hero_pf->>'three_bet')::boolean THEN v_3bet_count := v_3bet_count + 1; END IF;
      IF (v_hero_pf->>'fold_to_3bet_opportunity')::boolean THEN v_fold_to_3bet_opp_count := v_fold_to_3bet_opp_count + 1; END IF;
      IF (v_hero_pf->>'fold_to_3bet')::boolean THEN v_fold_to_3bet_count := v_fold_to_3bet_count + 1; END IF;
      IF (v_hero_pf->>'four_bet_opportunity')::boolean THEN v_4bet_opp_count := v_4bet_opp_count + 1; END IF;
      IF (v_hero_pf->>'four_bet')::boolean THEN v_4bet_count := v_4bet_count + 1; END IF;
      IF (v_hero_pf->>'fold_to_4bet_opportunity')::boolean THEN v_fold_to_4bet_opp_count := v_fold_to_4bet_opp_count + 1; END IF;
      IF (v_hero_pf->>'fold_to_4bet')::boolean THEN v_fold_to_4bet_count := v_fold_to_4bet_count + 1; END IF;
      IF (v_hero_pf->>'squeeze_opportunity')::boolean THEN v_squeeze_opp_count := v_squeeze_opp_count + 1; END IF;
      IF (v_hero_pf->>'squeeze')::boolean THEN v_squeeze_count := v_squeeze_count + 1; END IF;
      IF (v_hero_pf->>'limp_opportunity')::boolean THEN v_limp_opp_count := v_limp_opp_count + 1; END IF;
      IF (v_hero_pf->>'limp')::boolean THEN v_limp_count := v_limp_count + 1; END IF;
      IF (v_hero_pf->>'limp_fold_opportunity')::boolean THEN v_limp_fold_opp_count := v_limp_fold_opp_count + 1; END IF;
      IF (v_hero_pf->>'limp_fold')::boolean THEN v_limp_fold_count := v_limp_fold_count + 1; END IF;
      IF (v_hero_pf->>'steal_opportunity')::boolean THEN v_steal_opp_count := v_steal_opp_count + 1; END IF;
      IF (v_hero_pf->>'steal')::boolean THEN v_steal_count := v_steal_count + 1; END IF;
      IF (v_hero_pf->>'fold_to_steal_opportunity')::boolean THEN v_fold_to_steal_opp_count := v_fold_to_steal_opp_count + 1; END IF;
      IF (v_hero_pf->>'fold_to_steal')::boolean THEN v_fold_to_steal_count := v_fold_to_steal_count + 1; END IF;
    END IF;

    -- Flop stats
    v_hero_flop := v_actions->'hero_flop';
    v_flop_actions := v_actions->'flop_actions';
    v_flop_board := v_hand.board;
    IF v_saw_flop AND v_hero_flop IS NOT NULL THEN
      IF (v_hero_flop->>'cbet_opportunity')::boolean THEN v_cbet_flop_opp_count := v_cbet_flop_opp_count + 1; END IF;
      IF (v_hero_flop->>'cbet')::boolean THEN v_cbet_flop_count := v_cbet_flop_count + 1; END IF;
      IF (v_hero_flop->>'faced_cbet_opportunity')::boolean THEN
        v_fold_to_flop_cbet_opp_count := v_fold_to_flop_cbet_opp_count + 1;
        v_call_flop_cbet_opp_count := v_call_flop_cbet_opp_count + 1;
        v_raise_flop_cbet_opp_count := v_raise_flop_cbet_opp_count + 1;
      END IF;
      IF (v_hero_flop->>'fold_to_cbet')::boolean THEN v_fold_to_flop_cbet_count := v_fold_to_flop_cbet_count + 1; END IF;
      IF (v_hero_flop->>'call_cbet')::boolean THEN v_call_flop_cbet_count := v_call_flop_cbet_count + 1; END IF;
      IF (v_hero_flop->>'raise_cbet')::boolean THEN v_raise_flop_cbet_count := v_raise_flop_cbet_count + 1; END IF;
      IF (v_hero_flop->>'cbet_success_opportunity')::boolean THEN v_flop_cbet_success_opp_count := v_flop_cbet_success_opp_count + 1; END IF;
      IF (v_hero_flop->>'cbet_success')::boolean THEN v_flop_cbet_success_count := v_flop_cbet_success_count + 1; END IF;
      IF (v_hero_flop->>'checkraise_opportunity')::boolean THEN v_flop_checkraise_opp_count := v_flop_checkraise_opp_count + 1; END IF;
      IF (v_hero_flop->>'checkraise')::boolean THEN v_flop_checkraise_count := v_flop_checkraise_count + 1; END IF;
      IF (v_hero_flop->>'bet_when_checked_to_opportunity')::boolean THEN v_bet_when_checked_to_opp_count := v_bet_when_checked_to_opp_count + 1; END IF;
      IF (v_hero_flop->>'bet_when_checked_to')::boolean THEN v_bet_when_checked_to_count := v_bet_when_checked_to_count + 1; END IF;
      IF (v_hero_flop->>'aggression_opportunity')::boolean THEN v_flop_aggression_opp_count := v_flop_aggression_opp_count + 1; END IF;
      IF (v_hero_flop->>'aggression')::boolean THEN v_flop_aggression_count := v_flop_aggression_count + 1; END IF;
      IF (v_hero_flop->>'donk_bet_opportunity')::boolean THEN v_flop_donk_bet_opp_count := v_flop_donk_bet_opp_count + 1; END IF;
      IF (v_hero_flop->>'donk_bet')::boolean THEN v_flop_donk_bet_count := v_flop_donk_bet_count + 1; END IF;
    END IF;

    -- Turn stats
    v_hero_turn := v_actions->'hero_turn';
    IF v_saw_turn AND v_hero_turn IS NOT NULL THEN
      IF (v_hero_turn->>'barrel_opportunity')::boolean THEN
        v_barrel_turn_opp_count := v_barrel_turn_opp_count + 1;
        v_double_barrel_opp_count := v_double_barrel_opp_count + 1;
      END IF;
      IF (v_hero_turn->>'barrel')::boolean THEN v_barrel_turn_count := v_barrel_turn_count + 1; END IF;
      IF (v_hero_turn->>'faced_barrel_opportunity')::boolean THEN
        v_fold_to_turn_barrel_opp_count := v_fold_to_turn_barrel_opp_count + 1;
        v_call_turn_barrel_opp_count := v_call_turn_barrel_opp_count + 1;
        v_raise_turn_barrel_opp_count := v_raise_turn_barrel_opp_count + 1;
      END IF;
      IF (v_hero_turn->>'fold_to_barrel')::boolean THEN v_fold_to_turn_barrel_count := v_fold_to_turn_barrel_count + 1; END IF;
      IF (v_hero_turn->>'call_barrel')::boolean THEN v_call_turn_barrel_count := v_call_turn_barrel_count + 1; END IF;
      IF (v_hero_turn->>'raise_barrel')::boolean THEN v_raise_turn_barrel_count := v_raise_turn_barrel_count + 1; END IF;
      IF (v_hero_turn->>'barrel_success_opportunity')::boolean THEN v_turn_barrel_success_opp_count := v_turn_barrel_success_opp_count + 1; END IF;
      IF (v_hero_turn->>'barrel_success')::boolean THEN v_turn_barrel_success_count := v_turn_barrel_success_count + 1; END IF;
      IF (v_hero_turn->>'delayed_cbet_opportunity')::boolean THEN v_delayed_cbet_opp_count := v_delayed_cbet_opp_count + 1; END IF;
      IF (v_hero_turn->>'delayed_cbet')::boolean THEN v_delayed_cbet_count := v_delayed_cbet_count + 1; END IF;
      IF (v_hero_turn->>'checkraise_opportunity')::boolean THEN v_turn_checkraise_opp_count := v_turn_checkraise_opp_count + 1; END IF;
      IF (v_hero_turn->>'checkraise')::boolean THEN v_turn_checkraise_count := v_turn_checkraise_count + 1; END IF;
      IF (v_hero_turn->>'aggression_opportunity')::boolean THEN v_turn_aggression_opp_count := v_turn_aggression_opp_count + 1; END IF;
      IF (v_hero_turn->>'aggression')::boolean THEN v_turn_aggression_count := v_turn_aggression_count + 1; END IF;
      IF (v_hero_turn->>'probe_opportunity')::boolean THEN v_turn_probe_opp_count := v_turn_probe_opp_count + 1; END IF;
      IF (v_hero_turn->>'probe')::boolean THEN v_turn_probe_count := v_turn_probe_count + 1; END IF;
      IF (v_hero_turn->>'bet_when_checked_to_opportunity')::boolean THEN v_turn_bet_when_checked_to_opp_count := v_turn_bet_when_checked_to_opp_count + 1; END IF;
      IF (v_hero_turn->>'bet_when_checked_to')::boolean THEN v_turn_bet_when_checked_to_count := v_turn_bet_when_checked_to_count + 1; END IF;
    END IF;

    -- River stats
    v_hero_river := v_actions->'hero_river';
    IF v_saw_river AND v_hero_river IS NOT NULL THEN
      IF (v_hero_river->>'barrel_opportunity')::boolean THEN v_barrel_river_opp_count := v_barrel_river_opp_count + 1; END IF;
      IF (v_hero_river->>'barrel')::boolean THEN v_barrel_river_count := v_barrel_river_count + 1; END IF;
      IF (v_hero_river->>'faced_barrel_opportunity')::boolean THEN
        v_fold_to_river_barrel_opp_count := v_fold_to_river_barrel_opp_count + 1;
        v_call_river_barrel_opp_count := v_call_river_barrel_opp_count + 1;
        v_raise_river_barrel_opp_count := v_raise_river_barrel_opp_count + 1;
      END IF;
      IF (v_hero_river->>'fold_to_barrel')::boolean THEN v_fold_to_river_barrel_count := v_fold_to_river_barrel_count + 1; END IF;
      IF (v_hero_river->>'call_barrel')::boolean THEN v_call_river_barrel_count := v_call_river_barrel_count + 1; END IF;
      IF (v_hero_river->>'raise_barrel')::boolean THEN v_raise_river_barrel_count := v_raise_river_barrel_count + 1; END IF;
      IF (v_hero_river->>'bet_opportunity')::boolean THEN v_river_bet_opp_count := v_river_bet_opp_count + 1; END IF;
      IF (v_hero_river->>'bet')::boolean THEN v_river_bet_count := v_river_bet_count + 1; END IF;
      IF (v_hero_river->>'checkraise_opportunity')::boolean THEN v_river_checkraise_opp_count := v_river_checkraise_opp_count + 1; END IF;
      IF (v_hero_river->>'checkraise')::boolean THEN v_river_checkraise_count := v_river_checkraise_count + 1; END IF;
      IF (v_hero_river->>'aggression_opportunity')::boolean THEN v_river_aggression_opp_count := v_river_aggression_opp_count + 1; END IF;
      IF (v_hero_river->>'aggression')::boolean THEN v_river_aggression_count := v_river_aggression_count + 1; END IF;
      IF (v_hero_river->>'bet_success_opportunity')::boolean THEN v_river_bet_success_opp_count := v_river_bet_success_opp_count + 1; END IF;
      IF (v_hero_river->>'bet_success')::boolean THEN v_river_bet_success_count := v_river_bet_success_count + 1; END IF;
      IF (v_hero_river->>'bet_when_checked_to_opportunity')::boolean THEN v_river_bet_when_checked_to_opp_count := v_river_bet_when_checked_to_opp_count + 1; END IF;
      IF (v_hero_river->>'bet_when_checked_to')::boolean THEN v_river_bet_when_checked_to_count := v_river_bet_when_checked_to_count + 1; END IF;
    END IF;

    -- Showdown / WTSD / WSD / WWSF
    IF v_showdown THEN v_showdown_count := v_showdown_count + 1; END IF;
    IF v_saw_flop AND v_showdown THEN v_wtsd_count := v_wtsd_count + 1; END IF;
    IF v_showdown AND v_bb_won > 0 THEN v_wsd_count := v_wsd_count + 1; END IF;
    IF v_saw_flop AND v_bb_won > 0 THEN v_wwsf_count := v_wwsf_count + 1; END IF;

    -- Starting hand
    v_starting_hand := v_hand.starting_hand_class;
    IF v_starting_hand IS NOT NULL AND v_starting_hand != '' THEN
      v_sh_obj := v_sh_map->v_starting_hand;
      IF v_sh_obj IS NULL THEN
        v_sh_map := jsonb_set(v_sh_map, ARRAY[v_starting_hand],
          jsonb_build_object('hand', v_starting_hand, 'hands', 1, 'bb_won', COALESCE(v_bb_won, 0)));
      ELSE
        v_sh_map := jsonb_set(v_sh_map, ARRAY[v_starting_hand],
          jsonb_build_object(
            'hand', v_starting_hand,
            'hands', (v_sh_obj->>'hands')::int + 1,
            'bb_won', (v_sh_obj->>'bb_won')::numeric + COALESCE(v_bb_won, 0)
          ));
      END IF;
    END IF;

    -- Board analysis
    IF v_board_class IS NOT NULL AND v_saw_flop THEN
      v_board_obj := v_board_map->v_board_class;
      IF v_board_obj IS NULL THEN
        v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class],
          jsonb_build_object(
            'board_class', v_board_class, 'hands', 1, 'bbWon', COALESCE(v_bb_won, 0),
            'cbetCount', 0, 'cbetOpp', 0, 'sawFlop', 0, 'showdownCount', 0,
            'wsdCount', 0, 'wwsfCount', 0, 'wtsdCount', 0,
            'suitTexture', v_hand.flop_suit_texture,
            'structuralTags', '[]'::jsonb, 'pairedStructure', '',
            'suitedRelationship', '', 'isPaired', false, 'isTrips', false,
            'level', '', 'family', '',
            'potTypes', '{}'::jsonb, 'positions', '{}'::jsonb
          ));
        v_board_obj := v_board_map->v_board_class;
      END IF;
      v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class, 'hands'],
        to_jsonb((v_board_obj->>'hands')::int + 1));
      v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class, 'bbWon'],
        to_jsonb((v_board_obj->>'bbWon')::numeric + COALESCE(v_bb_won, 0)));
      v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class, 'sawFlop'],
        to_jsonb((v_board_obj->>'sawFlop')::int + 1));
      IF v_showdown THEN
        v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class, 'showdownCount'],
          to_jsonb((v_board_obj->>'showdownCount')::int + 1));
        IF v_bb_won > 0 THEN
          v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class, 'wsdCount'],
            to_jsonb((v_board_obj->>'wsdCount')::int + 1));
        END IF;
      END IF;
      IF v_saw_flop AND v_bb_won > 0 THEN
        v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class, 'wwsfCount'],
          to_jsonb((v_board_obj->>'wwsfCount')::int + 1));
      END IF;
    END IF;

    -- C-bet by pot type
    IF v_hero_flop IS NOT NULL AND (v_hero_flop->>'cbet')::boolean THEN
      IF v_pot_type = 'srp' THEN v_cbet_srp_count := v_cbet_srp_count + 1;
      ELSIF v_pot_type = '3bet' THEN v_cbet_3bet_count := v_cbet_3bet_count + 1;
      ELSIF v_pot_type = '4bet_plus' THEN v_cbet_4bet_count := v_cbet_4bet_count + 1;
      END IF;
    END IF;
    IF v_hero_flop IS NOT NULL AND (v_hero_flop->>'cbet_opportunity')::boolean THEN
      IF v_pot_type = 'srp' THEN v_cbet_srp_opp_count := v_cbet_srp_opp_count + 1;
      ELSIF v_pot_type = '3bet' THEN v_cbet_3bet_opp_count := v_cbet_3bet_opp_count + 1;
      ELSIF v_pot_type = '4bet_plus' THEN v_cbet_4bet_opp_count := v_cbet_4bet_opp_count + 1;
      END IF;
    END IF;

    -- Graph series
    IF v_bb_won IS NOT NULL THEN
      v_cum_bb := v_cum_bb + v_bb_won;
      IF v_showdown THEN v_cum_showdown := v_cum_showdown + v_bb_won;
      ELSE v_cum_non_showdown := v_cum_non_showdown + v_bb_won;
      END IF;
    END IF;
    v_graph_step := CASE WHEN v_total_hands % greatest(1, v_total_hands / 200) = 0 OR v_total_hands = 1 THEN 1 ELSE 0 END;
    IF v_graph_step = 1 THEN
      v_graph_series := v_graph_series || jsonb_build_array(
        jsonb_build_object('index', v_total_hands, 'profit', round(v_cum_bb * 100) / 100,
          'showdown', round(v_cum_showdown * 100) / 100, 'non_showdown', round(v_cum_non_showdown * 100) / 100)
      );
    END IF;
  END LOOP;

  -- Compute rates
  r_vpip := CASE WHEN v_total_hands > 0 THEN (v_vpip_count::numeric / v_total_hands) * 100 ELSE 0 END;
  r_pfr := CASE WHEN v_total_hands > 0 THEN (v_pfr_count::numeric / v_total_hands) * 100 ELSE 0 END;
  r_3bet := CASE WHEN v_3bet_opp_count > 0 THEN (v_3bet_count::numeric / v_3bet_opp_count) * 100 ELSE 0 END;
  r_cbet_flop := CASE WHEN v_cbet_flop_opp_count > 0 THEN (v_cbet_flop_count::numeric / v_cbet_flop_opp_count) * 100 ELSE 0 END;
  r_barrel_turn := CASE WHEN v_barrel_turn_opp_count > 0 THEN (v_barrel_turn_count::numeric / v_barrel_turn_opp_count) * 100 ELSE 0 END;
  r_barrel_river := CASE WHEN v_barrel_river_opp_count > 0 THEN (v_barrel_river_count::numeric / v_barrel_river_opp_count) * 100 ELSE 0 END;
  r_wtsd := CASE WHEN v_saw_flop_count > 0 THEN (v_wtsd_count::numeric / v_saw_flop_count) * 100 ELSE 0 END;
  r_wsd := CASE WHEN v_showdown_count > 0 THEN (v_wsd_count::numeric / v_showdown_count) * 100 ELSE 0 END;
  r_wwsf := CASE WHEN v_saw_flop_count > 0 THEN (v_wwsf_count::numeric / v_saw_flop_count) * 100 ELSE 0 END;
  r_bb100 := CASE WHEN v_hands_with_result > 0 THEN (v_bb_won_total / v_hands_with_result) * 100 ELSE 0 END;
  r_avg_pot := CASE WHEN v_hands_with_pot > 0 THEN v_pot_total / v_hands_with_pot ELSE 0 END;
  r_fold_to_3bet := CASE WHEN v_fold_to_3bet_opp_count > 0 THEN (v_fold_to_3bet_count::numeric / v_fold_to_3bet_opp_count) * 100 ELSE 0 END;
  r_4bet := CASE WHEN v_4bet_opp_count > 0 THEN (v_4bet_count::numeric / v_4bet_opp_count) * 100 ELSE 0 END;
  r_fold_to_4bet := CASE WHEN v_fold_to_4bet_opp_count > 0 THEN (v_fold_to_4bet_count::numeric / v_fold_to_4bet_opp_count) * 100 ELSE 0 END;
  r_squeeze := CASE WHEN v_squeeze_opp_count > 0 THEN (v_squeeze_count::numeric / v_squeeze_opp_count) * 100 ELSE 0 END;
  r_limp := CASE WHEN v_limp_opp_count > 0 THEN (v_limp_count::numeric / v_limp_opp_count) * 100 ELSE 0 END;
  r_limp_fold := CASE WHEN v_limp_fold_opp_count > 0 THEN (v_limp_fold_count::numeric / v_limp_fold_opp_count) * 100 ELSE 0 END;
  r_steal := CASE WHEN v_steal_opp_count > 0 THEN (v_steal_count::numeric / v_steal_opp_count) * 100 ELSE 0 END;
  r_fold_to_steal := CASE WHEN v_fold_to_steal_opp_count > 0 THEN (v_fold_to_steal_count::numeric / v_fold_to_steal_opp_count) * 100 ELSE 0 END;
  r_fold_to_flop_cbet := CASE WHEN v_fold_to_flop_cbet_opp_count > 0 THEN (v_fold_to_flop_cbet_count::numeric / v_fold_to_flop_cbet_opp_count) * 100 ELSE 0 END;
  r_call_flop_cbet := CASE WHEN v_call_flop_cbet_opp_count > 0 THEN (v_call_flop_cbet_count::numeric / v_call_flop_cbet_opp_count) * 100 ELSE 0 END;
  r_raise_flop_cbet := CASE WHEN v_raise_flop_cbet_opp_count > 0 THEN (v_raise_flop_cbet_count::numeric / v_raise_flop_cbet_opp_count) * 100 ELSE 0 END;
  r_flop_cbet_success := CASE WHEN v_flop_cbet_success_opp_count > 0 THEN (v_flop_cbet_success_count::numeric / v_flop_cbet_success_opp_count) * 100 ELSE 0 END;
  r_flop_checkraise := CASE WHEN v_flop_checkraise_opp_count > 0 THEN (v_flop_checkraise_count::numeric / v_flop_checkraise_opp_count) * 100 ELSE 0 END;
  r_bet_when_checked_to := CASE WHEN v_bet_when_checked_to_opp_count > 0 THEN (v_bet_when_checked_to_count::numeric / v_bet_when_checked_to_opp_count) * 100 ELSE 0 END;
  r_flop_aggression := CASE WHEN v_flop_aggression_opp_count > 0 THEN (v_flop_aggression_count::numeric / v_flop_aggression_opp_count) * 100 ELSE 0 END;
  r_flop_donk_bet := CASE WHEN v_flop_donk_bet_opp_count > 0 THEN (v_flop_donk_bet_count::numeric / v_flop_donk_bet_opp_count) * 100 ELSE 0 END;
  r_fold_to_turn_barrel := CASE WHEN v_fold_to_turn_barrel_opp_count > 0 THEN (v_fold_to_turn_barrel_count::numeric / v_fold_to_turn_barrel_opp_count) * 100 ELSE 0 END;
  r_call_turn_barrel := CASE WHEN v_call_turn_barrel_opp_count > 0 THEN (v_call_turn_barrel_count::numeric / v_call_turn_barrel_opp_count) * 100 ELSE 0 END;
  r_raise_turn_barrel := CASE WHEN v_raise_turn_barrel_opp_count > 0 THEN (v_raise_turn_barrel_count::numeric / v_raise_turn_barrel_opp_count) * 100 ELSE 0 END;
  r_turn_barrel_success := CASE WHEN v_turn_barrel_success_opp_count > 0 THEN (v_turn_barrel_success_count::numeric / v_turn_barrel_success_opp_count) * 100 ELSE 0 END;
  r_delayed_cbet := CASE WHEN v_delayed_cbet_opp_count > 0 THEN (v_delayed_cbet_count::numeric / v_delayed_cbet_opp_count) * 100 ELSE 0 END;
  r_turn_checkraise := CASE WHEN v_turn_checkraise_opp_count > 0 THEN (v_turn_checkraise_count::numeric / v_turn_checkraise_opp_count) * 100 ELSE 0 END;
  r_turn_aggression := CASE WHEN v_turn_aggression_opp_count > 0 THEN (v_turn_aggression_count::numeric / v_turn_aggression_opp_count) * 100 ELSE 0 END;
  r_turn_probe := CASE WHEN v_turn_probe_opp_count > 0 THEN (v_turn_probe_count::numeric / v_turn_probe_opp_count) * 100 ELSE 0 END;
  r_turn_bet_when_checked_to := CASE WHEN v_turn_bet_when_checked_to_opp_count > 0 THEN (v_turn_bet_when_checked_to_count::numeric / v_turn_bet_when_checked_to_opp_count) * 100 ELSE 0 END;
  r_fold_to_river_barrel := CASE WHEN v_fold_to_river_barrel_opp_count > 0 THEN (v_fold_to_river_barrel_count::numeric / v_fold_to_river_barrel_opp_count) * 100 ELSE 0 END;
  r_call_river_barrel := CASE WHEN v_call_river_barrel_opp_count > 0 THEN (v_call_river_barrel_count::numeric / v_call_river_barrel_opp_count) * 100 ELSE 0 END;
  r_raise_river_barrel := CASE WHEN v_raise_river_barrel_opp_count > 0 THEN (v_raise_river_barrel_count::numeric / v_raise_river_barrel_opp_count) * 100 ELSE 0 END;
  r_river_bet := CASE WHEN v_river_bet_opp_count > 0 THEN (v_river_bet_count::numeric / v_river_bet_opp_count) * 100 ELSE 0 END;
  r_river_checkraise := CASE WHEN v_river_checkraise_opp_count > 0 THEN (v_river_checkraise_count::numeric / v_river_checkraise_opp_count) * 100 ELSE 0 END;
  r_river_aggression := CASE WHEN v_river_aggression_opp_count > 0 THEN (v_river_aggression_count::numeric / v_river_aggression_opp_count) * 100 ELSE 0 END;
  r_river_bet_success := CASE WHEN v_river_bet_success_opp_count > 0 THEN (v_river_bet_success_count::numeric / v_river_bet_success_opp_count) * 100 ELSE 0 END;
  r_river_bet_when_checked_to := CASE WHEN v_river_bet_when_checked_to_opp_count > 0 THEN (v_river_bet_when_checked_to_count::numeric / v_river_bet_when_checked_to_opp_count) * 100 ELSE 0 END;
  r_cbet_srp := CASE WHEN v_cbet_srp_opp_count > 0 THEN (v_cbet_srp_count::numeric / v_cbet_srp_opp_count) * 100 ELSE 0 END;
  r_cbet_3bet := CASE WHEN v_cbet_3bet_opp_count > 0 THEN (v_cbet_3bet_count::numeric / v_cbet_3bet_opp_count) * 100 ELSE 0 END;
  r_cbet_4bet_plus := CASE WHEN v_cbet_4bet_opp_count > 0 THEN (v_cbet_4bet_count::numeric / v_cbet_4bet_opp_count) * 100 ELSE 0 END;

  -- Compute tournament entries/events and ABI
  v_tournament_entries := array_length(v_source_files, 1);
  v_tournament_events := array_length(array(SELECT DISTINCT unnest(v_tournament_ids)), 1);

  -- Compute ABI: sum(buy_in * file_count per tournament) / total_entries
  SELECT COALESCE(sum((b.value::text)::numeric * COALESCE((f.value::text)::int, 1)), 0)
  INTO v_total_buyin
  FROM jsonb_each(v_tourn_buyin_map) b
  JOIN jsonb_each(v_tourn_file_map) f ON b.key = f.key;

  IF v_tournament_entries > 0 AND v_total_buyin > 0 THEN
    v_abi := round((v_total_buyin / v_tournament_entries) * 100) / 100;
  ELSE
    v_abi := 0;
  END IF;

  -- Build starting hands array
  FOR v_sh_key, v_sh_val IN SELECT key, value FROM jsonb_each(v_sh_map)
  LOOP
    v_sh_array := v_sh_array || jsonb_build_object(
      'hand', v_sh_key,
      'hands', (v_sh_val->>'hands')::int,
      'bb_won', round((v_sh_val->>'bbWon')::numeric * 100) / 100,
      'bb100', CASE WHEN (v_sh_val->>'hands')::int > 0 THEN round(((v_sh_val->>'bbWon')::numeric / (v_sh_val->>'hands')::int) * 100 * 10) / 10 ELSE NULL END
    );
  END LOOP;
  v_sh_array := (SELECT jsonb_agg(elem ORDER BY (elem->>'hands')::int DESC) FROM jsonb_array_elements(v_sh_array) elem LIMIT 169);

  -- Build position array
  FOR v_pos_key, v_pos_val IN SELECT key, value FROM jsonb_each(v_position_map)
  LOOP
    v_pos_array := v_pos_array || jsonb_build_object(
      'position', v_pos_key,
      'hands', (v_pos_val->>'hands')::int,
      'bb100', CASE WHEN (v_pos_val->>'hands')::int > 0 THEN round(((v_pos_val->>'bbWon')::numeric / (v_pos_val->>'hands')::int) * 100 * 10) / 10 ELSE 0 END,
      'profit', round((v_pos_val->>'profit')::numeric),
      'bbWon', round((v_pos_val->>'bbWon')::numeric * 100) / 100
    );
  END LOOP;

  -- Build board analysis array
  FOR v_board_key, v_board_val IN SELECT key, value FROM jsonb_each(v_board_map)
  LOOP
    v_board_array := v_board_array || jsonb_build_object(
      'board_class', v_board_key,
      'hands', (v_board_val->>'hands')::int,
      'bb_won', round((v_board_val->>'bbWon')::numeric * 100) / 100,
      'bb100', CASE WHEN (v_board_val->>'hands')::int > 0 THEN round(((v_board_val->>'bbWon')::numeric / (v_board_val->>'hands')::int) * 100 * 10) / 10 ELSE NULL END
    );
  END LOOP;

  v_snapshot := jsonb_build_object(
    'summary', jsonb_build_object(
      'hands', v_total_hands,
      'profit', round(v_profit),
      'bbWon', round(v_bb_won_total * 100) / 100,
      'bb100', round(r_bb100 * 1000) / 1000,
      'evBb100', 0,
      'vpip', round(r_vpip * 10) / 10,
      'pfr', round(r_pfr * 10) / 10,
      'threeBet', round(r_3bet * 10) / 10,
      'cbetFlop', round(r_cbet_flop * 10) / 10,
      'barrelTurn', round(r_barrel_turn * 10) / 10,
      'barrelRiver', round(r_barrel_river * 10) / 10,
      'wtsd', round(r_wtsd * 10) / 10,
      'wsd', round(r_wsd * 10) / 10,
      'wwsf', round(r_wwsf * 10) / 10,
      'roi', 0,
      'abi', v_abi,
      'itm', 0,
      'tournamentEntries', v_tournament_entries,
      'tournamentEvents', v_tournament_events,
      'reEntries', v_tournament_entries - v_tournament_events,
      'activeDays', 0,
      'spi', -1,
      'avgPot', round(r_avg_pot * 10) / 10,
      'sites', 0,
      'foldTo3bet', r_fold_to_3bet,
      'fourBet', r_4bet,
      'foldTo4bet', r_fold_to_4bet,
      'squeeze', r_squeeze,
      'limp', r_limp,
      'limpFold', r_limp_fold,
      'steal', r_steal,
      'foldToSteal', r_fold_to_steal,
      'foldToFlopCbet', r_fold_to_flop_cbet,
      'checkRaiseFlop', r_flop_checkraise,
      'foldToTurnBarrel', r_fold_to_turn_barrel,
      'foldToRiverBarrel', r_fold_to_river_barrel,
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
      'roi', 0, 'abi', v_abi, 'itm', 0,
      'tournamentCount', v_tournament_entries,
      'tournamentEvents', v_tournament_events,
      'tournamentEntries', v_tournament_entries,
      'reEntries', v_tournament_entries - v_tournament_events,
      'profit', round(v_profit),
      'biggestWin', round(v_biggest_win * 100) / 100,
      'biggestLoss', round(v_biggest_loss * 100) / 100
    ),
    'graph_series', v_graph_series,
    'filters', jsonb_build_object('integrityOk', true, 'pctIntegrityOk', true, 'sanityOk', true),
    'sanity_checks', jsonb_build_array(
      jsonb_build_object('name', 'PFR <= VPIP', 'pass', v_pfr_count <= v_vpip_count, 'detail', 'PFR=' || v_pfr_count || ', VPIP=' || v_vpip_count),
      jsonb_build_object('name', '3-Bet <= Opportunities', 'pass', v_3bet_count <= v_3bet_opp_count, 'detail', '3bet=' || v_3bet_count || ', opp=' || v_3bet_opp_count),
      jsonb_build_object('name', 'Showdown <= SawFlop', 'pass', v_showdown_count <= v_saw_flop_count, 'detail', 'SD=' || v_showdown_count || ', sawFlop=' || v_saw_flop_count),
      jsonb_build_object('name', 'SD wins <= Showdowns', 'pass', v_wsd_count <= v_showdown_count, 'detail', 'W$SD=' || v_wsd_count || ', SD=' || v_showdown_count)
    )
  );

  -- Fix activeDays and sites
  v_snapshot := jsonb_set(v_snapshot, '{summary,activeDays}',
    (SELECT count(DISTINCT d) FROM unnest(v_days) AS d)
  );
  v_snapshot := jsonb_set(v_snapshot, '{summary,sites}',
    (SELECT count(DISTINCT s) FROM unnest(v_sites) AS s)
  );

  -- Upsert snapshot
  INSERT INTO poker_analytics_snapshots (
    user_id, mode, calculated_at, source_hand_count, source_imported_at,
    summary, position_analysis, preflop_analysis, postflop_analysis,
    board_analysis, tournament_analysis, graph_series,
    flop_analysis, turn_analysis, river_analysis,
    starting_hands, filters, sanity_checks
  ) VALUES (
    p_user_id, p_mode, now(), v_total_hands, now(),
    v_snapshot->'summary', v_snapshot->'position_analysis', v_snapshot->'preflop_analysis', v_snapshot->'postflop_analysis',
    v_snapshot->'board_analysis', v_snapshot->'tournament_analysis', v_snapshot->'graph_series',
    v_snapshot->'flop_analysis', v_snapshot->'turn_analysis', v_snapshot->'river_analysis',
    v_snapshot->'starting_hands', v_snapshot->'filters', v_snapshot->'sanity_checks'
  )
  ON CONFLICT (user_id, mode) DO UPDATE SET
    calculated_at = now(),
    source_hand_count = v_total_hands,
    source_imported_at = now(),
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
    starting_hands = EXCLUDED.starting_hands,
    filters = EXCLUDED.filters,
    sanity_checks = EXCLUDED.sanity_checks;

  RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;
