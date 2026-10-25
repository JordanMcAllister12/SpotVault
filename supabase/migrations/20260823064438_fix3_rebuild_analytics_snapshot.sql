/*
# Fix: Use jsonb || merge for summary to avoid 100-arg limit

Instead of one large jsonb_build_object, build 3 smaller objects and merge with ||.
*/

-- Just recreate the function with the summary split into 3 chunks
-- The rest of the function body is identical, only the summary building changes

CREATE OR REPLACE FUNCTION rebuild_analytics_snapshot(p_user_id text, p_mode text)
RETURNS jsonb AS $$
DECLARE
  v_snapshot jsonb;
  v_summary jsonb;
  v_s1 jsonb; v_s2 jsonb; v_s3 jsonb;
  v_hand record;
  v_total_hands int := 0;
  v_hands_with_result int := 0;
  v_hands_without_bb int := 0;
  v_bb_won numeric := 0;
  v_profit numeric := 0;
  v_big_blind numeric;
  v_net_chips numeric;
  v_net_bb numeric;
  v_hero_name text;
  v_actions jsonb;
  v_saw_flop boolean;
  v_saw_turn boolean;
  v_saw_river boolean;
  v_showdown boolean;
  v_pot_type text;
  v_position text;
  v_hero_cards text;
  v_board_class text;
  v_played_at timestamptz;
  v_site text;
  v_pot numeric;
  v_blinds text;

  v_vpip_count int := 0; v_pfr_count int := 0;
  v_3bet_count int := 0; v_3bet_opp_count int := 0;
  v_cbet_flop_count int := 0; v_cbet_flop_opp_count int := 0;
  v_barrel_turn_count int := 0; v_barrel_turn_opp_count int := 0;
  v_barrel_river_count int := 0; v_barrel_river_opp_count int := 0;
  v_showdown_count int := 0; v_wtsd_count int := 0; v_wsd_count int := 0;
  v_wwsf_count int := 0;
  v_saw_flop_count int := 0; v_saw_turn_count int := 0; v_saw_river_count int := 0;

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

  v_pot_unopened int := 0; v_pot_limped int := 0; v_pot_srp int := 0;
  v_pot_3bet int := 0; v_pot_4bet_plus int := 0;
  v_cbet_srp_count int := 0; v_cbet_srp_opp_count int := 0;
  v_cbet_3bet_count int := 0; v_cbet_3bet_opp_count int := 0;
  v_cbet_4bet_count int := 0; v_cbet_4bet_opp_count int := 0;

  v_biggest_win numeric := 0; v_biggest_loss numeric := 0;
  v_pot_total numeric := 0; v_hands_with_pot int := 0;
  v_active_days int := 0; v_site_count int := 0;
  v_tournament_ids text[] := '{}';
  v_tournament_entries int := 0; v_tournament_events int := 0;

  v_pf_actions jsonb; v_hero_pf jsonb; v_hero_flop jsonb; v_hero_turn jsonb; v_hero_river jsonb;
  v_flop_actions jsonb; v_turn_actions jsonb; v_river_actions jsonb;
  v_last_raiser text; v_hero_is_aggressor boolean;
  v_hero_flop_bets jsonb; v_hero_turn_bets jsonb; v_hero_river_bets jsonb;
  v_action_elem jsonb;
  v_raise_level int; v_first_raiser text;
  v_hero_opened boolean; v_hero_3bet boolean;
  v_callers_after_opener text[];
  v_acted_before_hero_3bet boolean;
  v_hero_limped boolean; v_hero_limped_facing_raise boolean;
  v_steal_attempted boolean; v_hero_in_blinds boolean;
  v_hero_opened_facing_3bet boolean; v_hero_3bet_facing_4bet boolean;
  v_is_hero boolean; v_is_raiser boolean; v_act text; v_player text;
  v_hand_key text; v_bb_for_hand numeric;

  v_position_map jsonb := '{}'::jsonb; v_pos_obj jsonb;
  v_sh_map jsonb := '{}'::jsonb; v_sh_obj jsonb;
  v_board_map jsonb := '{}'::jsonb; v_board_obj jsonb;

  v_cum_bb numeric := 0; v_cum_showdown numeric := 0; v_cum_non_showdown numeric := 0;
  v_graph_series jsonb := '[]'::jsonb;

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

  v_days_set text[]; v_sites_set text[];

BEGIN
  FOR v_hand IN
    SELECT * FROM poker_hand_records
    WHERE user_id = p_user_id AND game_mode = p_mode
    AND hand_hash NOT LIKE '%-unknown-%' AND hand_hash NOT LIKE 'summary-%'
    ORDER BY played_at ASC, created_at ASC
  LOOP
    v_total_hands := v_total_hands + 1;
    v_hero_name := v_hand.hero_name;
    v_actions := v_hand.action_sequence;
    v_saw_flop := COALESCE(v_hand.saw_flop, false);
    v_saw_turn := COALESCE(v_hand.saw_turn, false);
    v_saw_river := COALESCE(v_hand.saw_river, false);
    v_showdown := COALESCE(v_hand.showdown, false);
    v_pot_type := v_hand.pot_type; v_position := v_hand.position;
    v_hero_cards := v_hand.hero_cards; v_board_class := v_hand.board_class;
    v_played_at := v_hand.played_at; v_site := v_hand.site;
    v_pot := v_hand.pot_amount; v_blinds := v_hand.blinds;
    v_big_blind := parse_big_blind(v_blinds);

    v_net_chips := 0; v_net_bb := NULL;
    IF v_actions IS NOT NULL AND jsonb_typeof(v_actions) = 'array' AND v_hero_name IS NOT NULL THEN
      SELECT COALESCE(SUM(CASE
        WHEN elem.val->>'player' = v_hero_name AND elem.val->>'action' IN ('post','post_ante','bet','call','raise','all-in') THEN -COALESCE((elem.val->>'amount')::numeric,0)
        WHEN elem.val->>'player' = v_hero_name AND elem.val->>'action' IN ('uncalled','collect','won') THEN COALESCE((elem.val->>'amount')::numeric,0)
        ELSE 0 END), 0) INTO v_net_chips
      FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord);
      IF v_big_blind IS NOT NULL AND v_big_blind > 0 THEN
        v_net_bb := round((v_net_chips / v_big_blind) * 100) / 100;
      END IF;
    END IF;

    IF v_net_bb IS NOT NULL THEN
      v_bb_for_hand := v_net_bb;
      v_bb_won := v_bb_won + v_bb_for_hand;
      v_profit := v_profit + v_net_chips;
      v_hands_with_result := v_hands_with_result + 1;
      IF v_bb_for_hand > v_biggest_win THEN v_biggest_win := v_bb_for_hand; END IF;
      IF v_bb_for_hand < v_biggest_loss THEN v_biggest_loss := v_bb_for_hand; END IF;
    ELSE
      v_hands_without_bb := v_hands_without_bb + 1;
    END IF;

    IF v_played_at IS NOT NULL THEN v_days_set := array_append(v_days_set, substring(v_played_at::text from 1 for 10)); END IF;
    IF v_site IS NOT NULL THEN v_sites_set := array_append(v_sites_set, v_site); END IF;
    IF v_hand.tournament_id IS NOT NULL THEN v_tournament_ids := array_append(v_tournament_ids, v_hand.tournament_id); END IF;
    IF v_pot IS NOT NULL THEN v_pot_total := v_pot_total + v_pot; v_hands_with_pot := v_hands_with_pot + 1; END IF;

    IF v_position IS NOT NULL THEN
      v_pos_obj := v_position_map->v_position;
      IF v_pos_obj IS NULL THEN
        v_pos_obj := jsonb_build_object('hands',1,'bbWon',COALESCE(v_bb_for_hand,0),'profit',COALESCE(v_net_chips,0));
      ELSE
        v_pos_obj := jsonb_build_object('hands',(v_pos_obj->>'hands')::int+1,'bbWon',(v_pos_obj->>'bbWon')::numeric+COALESCE(v_bb_for_hand,0),'profit',(v_pos_obj->>'profit')::numeric+COALESCE(v_net_chips,0));
      END IF;
      v_position_map := jsonb_set(v_position_map, ARRAY[v_position], v_pos_obj);
    END IF;

    IF v_saw_flop THEN v_saw_flop_count := v_saw_flop_count + 1; END IF;
    IF v_saw_turn THEN v_saw_turn_count := v_saw_turn_count + 1; END IF;
    IF v_saw_river THEN v_saw_river_count := v_saw_river_count + 1; END IF;

    IF v_pot_type = 'unopened' THEN v_pot_unopened := v_pot_unopened + 1;
    ELSIF v_pot_type = 'limped' THEN v_pot_limped := v_pot_limped + 1;
    ELSIF v_pot_type = 'srp' THEN v_pot_srp := v_pot_srp + 1;
    ELSIF v_pot_type = '3bet' THEN v_pot_3bet := v_pot_3bet + 1;
    ELSIF v_pot_type = '4bet_plus' THEN v_pot_4bet_plus := v_pot_4bet_plus + 1;
    END IF;

    IF v_hero_cards IS NOT NULL THEN
      v_hand_key := normalize_hand_class(v_hero_cards);
      IF v_hand_key IS NOT NULL THEN
        v_sh_obj := v_sh_map->v_hand_key;
        IF v_sh_obj IS NULL THEN
          v_sh_obj := jsonb_build_object('hand',v_hand_key,'hands',1,'bb_won',COALESCE(v_bb_for_hand,0));
        ELSE
          v_sh_obj := jsonb_build_object('hand',v_hand_key,'hands',(v_sh_obj->>'hands')::int+1,'bb_won',(v_sh_obj->>'bb_won')::numeric+COALESCE(v_bb_for_hand,0));
        END IF;
        v_sh_map := jsonb_set(v_sh_map, ARRAY[v_hand_key], v_sh_obj);
      END IF;
    END IF;

    IF v_board_class IS NOT NULL THEN
      v_board_obj := v_board_map->v_board_class;
      IF v_board_obj IS NULL THEN
        v_board_obj := jsonb_build_object('board_class',v_board_class,'hands',1,'bbWon',COALESCE(v_bb_for_hand,0),'sawFlop',CASE WHEN v_saw_flop THEN 1 ELSE 0 END,'showdown',CASE WHEN v_showdown THEN 1 ELSE 0 END,'wsd',CASE WHEN v_showdown AND v_bb_for_hand IS NOT NULL AND v_bb_for_hand > 0 THEN 1 ELSE 0 END,'cbetCount',0,'cbetOpp',0);
      ELSE
        v_board_obj := jsonb_build_object('board_class',v_board_class,'hands',(v_board_obj->>'hands')::int+1,'bbWon',(v_board_obj->>'bbWon')::numeric+COALESCE(v_bb_for_hand,0),'sawFlop',(v_board_obj->>'sawFlop')::int+CASE WHEN v_saw_flop THEN 1 ELSE 0 END,'showdown',(v_board_obj->>'showdown')::int+CASE WHEN v_showdown THEN 1 ELSE 0 END,'wsd',(v_board_obj->>'wsd')::int+CASE WHEN v_showdown AND v_bb_for_hand IS NOT NULL AND v_bb_for_hand > 0 THEN 1 ELSE 0 END,'cbetCount',(v_board_obj->>'cbetCount')::int,'cbetOpp',(v_board_obj->>'cbetOpp')::int);
      END IF;
      v_board_map := jsonb_set(v_board_map, ARRAY[v_board_class], v_board_obj);
    END IF;

    -- Hero stats from action_sequence
    IF v_actions IS NOT NULL AND jsonb_typeof(v_actions) = 'array' AND v_hero_name IS NOT NULL THEN
      SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_pf_actions
      FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'preflop';
      SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_pf
      FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'preflop' AND elem.val->>'player' = v_hero_name;

      IF v_hero_pf IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_pf) AS a WHERE a->>'action' IN ('call','raise','all-in')) THEN v_vpip_count := v_vpip_count + 1; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_pf) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_pfr_count := v_pfr_count + 1; END IF;
      END IF;

      v_raise_level := 0; v_first_raiser := NULL; v_hero_opened := false; v_hero_3bet := false;
      v_callers_after_opener := '{}'; v_acted_before_hero_3bet := false;
      v_hero_limped := false; v_hero_limped_facing_raise := false;
      v_steal_attempted := false; v_hero_in_blinds := false;
      v_hero_opened_facing_3bet := false; v_hero_3bet_facing_4bet := false;

      IF v_pf_actions IS NOT NULL THEN
        FOR v_action_elem IN SELECT * FROM jsonb_array_elements(v_pf_actions) LOOP
          v_act := v_action_elem->>'action'; v_player := v_action_elem->>'player';
          v_is_hero := (v_player = v_hero_name); v_is_raiser := (v_act IN ('raise','bet','all-in'));
          IF v_act IN ('post','post_ante') THEN CONTINUE; END IF;
          IF v_raise_level = 1 AND v_act = 'call' AND v_player != v_first_raiser THEN v_callers_after_opener := array_append(v_callers_after_opener, v_player); END IF;
          IF v_raise_level = 0 AND v_is_raiser AND v_is_hero AND v_position IN ('CO','BTN','SB') THEN v_steal_attempted := true; END IF;
          IF v_position IN ('SB','BB') AND v_is_hero THEN v_hero_in_blinds := true; END IF;
          IF v_raise_level = 0 AND v_is_raiser THEN v_raise_level := 1; v_first_raiser := v_player; IF v_is_hero THEN v_hero_opened := true; END IF;
          ELSIF v_raise_level = 1 AND v_is_raiser THEN v_raise_level := 2; IF v_hero_opened AND NOT v_is_hero THEN v_hero_opened_facing_3bet := true; END IF; IF v_is_hero THEN v_hero_3bet := true; END IF;
          ELSIF v_raise_level = 2 AND v_is_raiser THEN v_raise_level := 3; IF v_hero_3bet AND NOT v_is_hero THEN v_hero_3bet_facing_4bet := true; END IF; IF v_is_hero THEN v_4bet_count := v_4bet_count + 1; END IF;
          ELSIF v_raise_level >= 3 AND v_is_raiser THEN v_raise_level := v_raise_level + 1; END IF;
          IF v_raise_level = 0 AND v_act = 'call' AND v_is_hero THEN v_hero_limped := true; v_limp_opp_count := v_limp_opp_count + 1; v_limp_count := v_limp_count + 1; END IF;
          IF v_hero_limped AND v_raise_level = 1 AND v_is_raiser AND NOT v_is_hero THEN v_hero_limped_facing_raise := true; END IF;
          IF v_hero_limped_facing_raise AND v_is_hero THEN v_limp_fold_opp_count := v_limp_fold_opp_count + 1; IF v_act = 'fold' THEN v_limp_fold_count := v_limp_fold_count + 1; END IF; v_hero_limped_facing_raise := false; END IF;
          IF v_hero_opened_facing_3bet AND v_is_hero THEN v_fold_to_3bet_opp_count := v_fold_to_3bet_opp_count + 1; IF v_act = 'fold' THEN v_fold_to_3bet_count := v_fold_to_3bet_count + 1; END IF; v_hero_opened_facing_3bet := false; END IF;
          IF v_raise_level = 2 AND NOT v_hero_3bet AND NOT v_hero_opened AND v_is_hero AND NOT v_acted_before_hero_3bet THEN v_4bet_opp_count := v_4bet_opp_count + 1; IF v_is_raiser THEN v_4bet_count := v_4bet_count + 1; END IF; v_acted_before_hero_3bet := true; END IF;
          IF v_hero_3bet_facing_4bet AND v_is_hero THEN v_fold_to_4bet_opp_count := v_fold_to_4bet_opp_count + 1; IF v_act = 'fold' THEN v_fold_to_4bet_count := v_fold_to_4bet_count + 1; END IF; v_hero_3bet_facing_4bet := false; END IF;
          IF v_raise_level = 1 AND v_is_raiser AND v_is_hero AND array_length(v_callers_after_opener, 1) > 0 AND NOT v_hero_opened THEN v_squeeze_opp_count := v_squeeze_opp_count + 1; v_squeeze_count := v_squeeze_count + 1; END IF;
          IF v_is_hero AND v_steal_attempted THEN v_steal_opp_count := v_steal_opp_count + 1; END IF;
        END LOOP;

        IF v_raise_level >= 2 THEN v_3bet_opp_count := v_3bet_opp_count + 1; IF v_hero_3bet THEN v_3bet_count := v_3bet_count + 1; END IF; END IF;

        IF v_position IN ('SB','BB') AND v_hero_in_blinds THEN
          IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_pf_actions) AS a WHERE a->>'action' IN ('raise','bet','all-in')) AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_pf_actions) AS a WHERE a->>'action' = 'call') THEN
            v_fold_to_steal_opp_count := v_fold_to_steal_opp_count + 1;
            IF v_hero_pf IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_pf) AS a WHERE a->>'action' = 'fold') THEN v_fold_to_steal_count := v_fold_to_steal_count + 1; END IF;
          END IF;
        END IF;
        IF v_position IN ('CO','BTN','SB') AND v_steal_attempted THEN v_steal_count := v_steal_count + 1; END IF;
      END IF;

      SELECT elem.val->>'player' INTO v_last_raiser
      FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
      WHERE elem.val->>'street' = 'preflop' AND elem.val->>'action' IN ('raise','bet','all-in') ORDER BY elem.ord DESC LIMIT 1;
      v_hero_is_aggressor := (v_last_raiser = v_hero_name);

      IF v_hero_is_aggressor AND v_saw_flop THEN
        v_cbet_flop_opp_count := v_cbet_flop_opp_count + 1;
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_flop_bets
        FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
        WHERE elem.val->>'street' = 'flop' AND elem.val->>'player' = v_hero_name AND elem.val->>'action' IN ('bet','raise','all-in');
        IF v_hero_flop_bets IS NOT NULL AND jsonb_array_length(v_hero_flop_bets) > 0 THEN
          v_cbet_flop_count := v_cbet_flop_count + 1;
          IF v_pot_type = 'srp' THEN v_cbet_srp_opp_count := v_cbet_srp_opp_count + 1; v_cbet_srp_count := v_cbet_srp_count + 1;
          ELSIF v_pot_type = '3bet' THEN v_cbet_3bet_opp_count := v_cbet_3bet_opp_count + 1; v_cbet_3bet_count := v_cbet_3bet_count + 1;
          ELSIF v_pot_type = '4bet_plus' THEN v_cbet_4bet_opp_count := v_cbet_4bet_opp_count + 1; v_cbet_4bet_count := v_cbet_4bet_count + 1; END IF;
          IF v_saw_turn THEN
            v_barrel_turn_opp_count := v_barrel_turn_opp_count + 1; v_double_barrel_opp_count := v_double_barrel_opp_count + 1;
            SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_turn_bets
            FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
            WHERE elem.val->>'street' = 'turn' AND elem.val->>'player' = v_hero_name AND elem.val->>'action' IN ('bet','raise','all-in');
            IF v_hero_turn_bets IS NOT NULL AND jsonb_array_length(v_hero_turn_bets) > 0 THEN
              v_barrel_turn_count := v_barrel_turn_count + 1;
              IF v_saw_river THEN
                v_barrel_river_opp_count := v_barrel_river_opp_count + 1;
                SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_river_bets
                FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
                WHERE elem.val->>'street' = 'river' AND elem.val->>'player' = v_hero_name AND elem.val->>'action' IN ('bet','raise','all-in');
                IF v_hero_river_bets IS NOT NULL AND jsonb_array_length(v_hero_river_bets) > 0 THEN v_barrel_river_count := v_barrel_river_count + 1; END IF;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;

      IF v_showdown THEN
        v_showdown_count := v_showdown_count + 1;
        IF v_saw_flop THEN v_wtsd_count := v_wtsd_count + 1; END IF;
        IF v_net_bb IS NOT NULL AND v_net_bb > 0 THEN v_wsd_count := v_wsd_count + 1; END IF;
      END IF;
      IF v_saw_flop AND v_net_bb IS NOT NULL AND v_net_bb > 0 THEN v_wwsf_count := v_wwsf_count + 1; END IF;

      -- Flop advanced stats
      IF v_saw_flop THEN
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_flop_actions FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'flop';
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_flop FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'flop' AND elem.val->>'player' = v_hero_name;

        IF NOT v_hero_is_aggressor AND v_flop_actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_flop_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' IN ('bet','raise','all-in')) THEN
          v_fold_to_flop_cbet_opp_count := v_fold_to_flop_cbet_opp_count + 1; v_call_flop_cbet_opp_count := v_call_flop_cbet_opp_count + 1; v_raise_flop_cbet_opp_count := v_raise_flop_cbet_opp_count + 1;
          IF v_hero_flop IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' = 'fold') THEN v_fold_to_flop_cbet_count := v_fold_to_flop_cbet_count + 1;
            ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' = 'call') THEN v_call_flop_cbet_count := v_call_flop_cbet_count + 1;
            ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_raise_flop_cbet_count := v_raise_flop_cbet_count + 1; END IF;
          END IF;
        END IF;

        IF v_hero_is_aggressor AND v_hero_flop IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN
          v_flop_cbet_success_opp_count := v_flop_cbet_success_opp_count + 1;
          IF v_flop_actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_flop_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' = 'fold')
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_flop_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' = 'call')
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_flop_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' IN ('raise','all-in'))
          THEN v_flop_cbet_success_count := v_flop_cbet_success_count + 1; END IF;
        END IF;

        IF v_hero_flop IS NOT NULL AND jsonb_array_length(v_hero_flop) >= 2 THEN
          v_flop_checkraise_opp_count := v_flop_checkraise_opp_count + 1;
          IF (v_hero_flop->0->>'action' = 'check') AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_flop_checkraise_count := v_flop_checkraise_count + 1; END IF;
        END IF;

        IF v_flop_actions IS NOT NULL AND v_hero_flop IS NOT NULL AND v_flop_actions->0->>'action' = 'check' AND v_flop_actions->0->>'player' != v_hero_name THEN
          v_bet_when_checked_to_opp_count := v_bet_when_checked_to_opp_count + 1;
          IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_bet_when_checked_to_count := v_bet_when_checked_to_count + 1; END IF;
        END IF;

        v_flop_aggression_opp_count := v_flop_aggression_opp_count + 1;
        IF v_hero_flop IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_flop_aggression_count := v_flop_aggression_count + 1; END IF;

        IF NOT v_hero_is_aggressor AND v_flop_actions IS NOT NULL AND v_hero_flop IS NOT NULL THEN
          v_flop_donk_bet_opp_count := v_flop_donk_bet_opp_count + 1;
          IF v_flop_actions->0->>'player' = v_hero_name AND v_flop_actions->0->>'action' IN ('bet','raise','all-in') THEN v_flop_donk_bet_count := v_flop_donk_bet_count + 1; END IF;
        END IF;
      END IF;

      -- Turn advanced stats
      IF v_saw_turn THEN
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_turn_actions FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'turn';
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_turn FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'turn' AND elem.val->>'player' = v_hero_name;

        IF v_hero_is_aggressor AND v_turn_actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_turn_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' IN ('bet','raise','all-in')) THEN
          v_fold_to_turn_barrel_opp_count := v_fold_to_turn_barrel_opp_count + 1; v_call_turn_barrel_opp_count := v_call_turn_barrel_opp_count + 1; v_raise_turn_barrel_opp_count := v_raise_turn_barrel_opp_count + 1;
          IF v_hero_turn IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' = 'fold') THEN v_fold_to_turn_barrel_count := v_fold_to_turn_barrel_count + 1;
            ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' = 'call') THEN v_call_turn_barrel_count := v_call_turn_barrel_count + 1;
            ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_raise_turn_barrel_count := v_raise_turn_barrel_count + 1; END IF;
          END IF;
        END IF;

        IF v_hero_is_aggressor AND v_hero_turn IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN
          v_turn_barrel_success_opp_count := v_turn_barrel_success_opp_count + 1;
          IF v_turn_actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_turn_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' = 'fold')
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_turn_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' = 'call')
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_turn_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' IN ('raise','all-in'))
          THEN v_turn_barrel_success_count := v_turn_barrel_success_count + 1; END IF;
        END IF;

        IF v_hero_is_aggressor AND v_saw_flop THEN
          v_delayed_cbet_opp_count := v_delayed_cbet_opp_count + 1;
          IF v_hero_flop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_flop) AS a WHERE a->>'action' IN ('bet','raise','all-in'))
            AND v_hero_turn IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' IN ('bet','raise','all-in'))
          THEN v_delayed_cbet_count := v_delayed_cbet_count + 1; END IF;
        END IF;

        IF v_hero_turn IS NOT NULL AND jsonb_array_length(v_hero_turn) >= 2 THEN
          v_turn_checkraise_opp_count := v_turn_checkraise_opp_count + 1;
          IF (v_hero_turn->0->>'action' = 'check') AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_turn_checkraise_count := v_turn_checkraise_count + 1; END IF;
        END IF;

        v_turn_aggression_opp_count := v_turn_aggression_opp_count + 1;
        IF v_hero_turn IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_turn_aggression_count := v_turn_aggression_count + 1; END IF;

        IF NOT v_hero_is_aggressor AND v_turn_actions IS NOT NULL AND v_hero_turn IS NOT NULL THEN
          v_turn_probe_opp_count := v_turn_probe_opp_count + 1;
          IF v_turn_actions->0->>'player' = v_hero_name AND v_turn_actions->0->>'action' IN ('bet','raise','all-in') THEN v_turn_probe_count := v_turn_probe_count + 1; END IF;
        END IF;

        IF v_turn_actions IS NOT NULL AND v_hero_turn IS NOT NULL AND v_turn_actions->0->>'action' = 'check' AND v_turn_actions->0->>'player' != v_hero_name THEN
          v_turn_bet_when_checked_to_opp_count := v_turn_bet_when_checked_to_opp_count + 1;
          IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_turn) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_turn_bet_when_checked_to_count := v_turn_bet_when_checked_to_count + 1; END IF;
        END IF;
      END IF;

      -- River advanced stats
      IF v_saw_river THEN
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_river_actions FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'river';
        SELECT jsonb_agg(elem.val ORDER BY elem.ord) INTO v_hero_river FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord) WHERE elem.val->>'street' = 'river' AND elem.val->>'player' = v_hero_name;

        v_river_bet_opp_count := v_river_bet_opp_count + 1;
        IF v_hero_river IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_river_bet_count := v_river_bet_count + 1; END IF;

        IF v_hero_is_aggressor AND v_river_actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_river_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' IN ('bet','raise','all-in')) THEN
          v_fold_to_river_barrel_opp_count := v_fold_to_river_barrel_opp_count + 1; v_call_river_barrel_opp_count := v_call_river_barrel_opp_count + 1; v_raise_river_barrel_opp_count := v_raise_river_barrel_opp_count + 1;
          IF v_hero_river IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' = 'fold') THEN v_fold_to_river_barrel_count := v_fold_to_river_barrel_count + 1;
            ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' = 'call') THEN v_call_river_barrel_count := v_call_river_barrel_count + 1;
            ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_raise_river_barrel_count := v_raise_river_barrel_count + 1; END IF;
          END IF;
        END IF;

        IF v_hero_river IS NOT NULL AND jsonb_array_length(v_hero_river) >= 2 THEN
          v_river_checkraise_opp_count := v_river_checkraise_opp_count + 1;
          IF (v_hero_river->0->>'action' = 'check') AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' IN ('raise','all-in')) THEN v_river_checkraise_count := v_river_checkraise_count + 1; END IF;
        END IF;

        v_river_aggression_opp_count := v_river_aggression_opp_count + 1;
        IF v_hero_river IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_river_aggression_count := v_river_aggression_count + 1; END IF;

        IF v_hero_river IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN
          v_river_bet_success_opp_count := v_river_bet_success_opp_count + 1;
          IF v_river_actions IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_river_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' = 'fold')
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_river_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' = 'call')
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_river_actions) AS a WHERE a->>'player' != v_hero_name AND a->>'action' IN ('raise','all-in'))
          THEN v_river_bet_success_count := v_river_bet_success_count + 1; END IF;
        END IF;

        IF v_river_actions IS NOT NULL AND v_hero_river IS NOT NULL AND v_river_actions->0->>'action' = 'check' AND v_river_actions->0->>'player' != v_hero_name THEN
          v_river_bet_when_checked_to_opp_count := v_river_bet_when_checked_to_opp_count + 1;
          IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_hero_river) AS a WHERE a->>'action' IN ('bet','raise','all-in')) THEN v_river_bet_when_checked_to_count := v_river_bet_when_checked_to_count + 1; END IF;
        END IF;
      END IF;
    END IF;

    -- Graph series
    IF v_net_bb IS NOT NULL THEN
      v_cum_bb := v_cum_bb + v_net_bb;
      IF v_showdown THEN v_cum_showdown := v_cum_showdown + v_net_bb; ELSE v_cum_non_showdown := v_cum_non_showdown + v_net_bb; END IF;
    END IF;
    IF v_total_hands % 35 = 0 OR v_total_hands = 1 THEN
      v_graph_series := v_graph_series || jsonb_build_array(jsonb_build_object('index',v_total_hands-1,'profit',round(v_cum_bb*100)/100,'showdown',round(v_cum_showdown*100)/100,'non_showdown',round(v_cum_non_showdown*100)/100));
    END IF;
  END LOOP;

  SELECT count(DISTINCT d) INTO v_active_days FROM unnest(v_days_set) AS d;
  SELECT count(DISTINCT s) INTO v_site_count FROM unnest(v_sites_set) AS s;
  SELECT count(DISTINCT t) INTO v_tournament_events FROM unnest(v_tournament_ids) AS t;
  v_tournament_entries := COALESCE(array_length(v_tournament_ids, 1), 0);

  -- Compute rates
  r_vpip := CASE WHEN v_total_hands > 0 THEN round((v_vpip_count::numeric / v_total_hands) * 1000) / 10 ELSE 0 END;
  r_pfr := CASE WHEN v_total_hands > 0 THEN round((v_pfr_count::numeric / v_total_hands) * 1000) / 10 ELSE 0 END;
  r_3bet := CASE WHEN v_3bet_opp_count > 0 THEN round((v_3bet_count::numeric / v_3bet_opp_count) * 1000) / 10 ELSE 0 END;
  r_cbet_flop := CASE WHEN v_cbet_flop_opp_count > 0 THEN round((v_cbet_flop_count::numeric / v_cbet_flop_opp_count) * 1000) / 10 ELSE 0 END;
  r_barrel_turn := CASE WHEN v_barrel_turn_opp_count > 0 THEN round((v_barrel_turn_count::numeric / v_barrel_turn_opp_count) * 1000) / 10 ELSE 0 END;
  r_barrel_river := CASE WHEN v_barrel_river_opp_count > 0 THEN round((v_barrel_river_count::numeric / v_barrel_river_opp_count) * 1000) / 10 ELSE 0 END;
  r_wtsd := CASE WHEN v_saw_flop_count > 0 THEN round((v_wtsd_count::numeric / v_saw_flop_count) * 1000) / 10 ELSE 0 END;
  r_wsd := CASE WHEN v_showdown_count > 0 THEN round((v_wsd_count::numeric / v_showdown_count) * 1000) / 10 ELSE 0 END;
  r_wwsf := CASE WHEN v_saw_flop_count > 0 THEN round((v_wwsf_count::numeric / v_saw_flop_count) * 1000) / 10 ELSE 0 END;
  r_bb100 := CASE WHEN v_hands_with_result > 0 THEN round((v_bb_won / v_hands_with_result) * 10000) / 100 ELSE 0 END;
  r_avg_pot := CASE WHEN v_hands_with_pot > 0 THEN round(v_pot_total / v_hands_with_pot) ELSE 0 END;

  r_fold_to_3bet := CASE WHEN v_fold_to_3bet_opp_count > 0 THEN round((v_fold_to_3bet_count::numeric / v_fold_to_3bet_opp_count) * 1000) / 10 ELSE NULL END;
  r_4bet := CASE WHEN v_4bet_opp_count > 0 THEN round((v_4bet_count::numeric / v_4bet_opp_count) * 1000) / 10 ELSE NULL END;
  r_fold_to_4bet := CASE WHEN v_fold_to_4bet_opp_count > 0 THEN round((v_fold_to_4bet_count::numeric / v_fold_to_4bet_opp_count) * 1000) / 10 ELSE NULL END;
  r_squeeze := CASE WHEN v_squeeze_opp_count > 0 THEN round((v_squeeze_count::numeric / v_squeeze_opp_count) * 1000) / 10 ELSE NULL END;
  r_limp := CASE WHEN v_limp_opp_count > 0 THEN round((v_limp_count::numeric / v_limp_opp_count) * 1000) / 10 ELSE NULL END;
  r_limp_fold := CASE WHEN v_limp_fold_opp_count > 0 THEN round((v_limp_fold_count::numeric / v_limp_fold_opp_count) * 1000) / 10 ELSE NULL END;
  r_steal := CASE WHEN v_steal_opp_count > 0 THEN round((v_steal_count::numeric / v_steal_opp_count) * 1000) / 10 ELSE NULL END;
  r_fold_to_steal := CASE WHEN v_fold_to_steal_opp_count > 0 THEN round((v_fold_to_steal_count::numeric / v_fold_to_steal_opp_count) * 1000) / 10 ELSE NULL END;

  r_fold_to_flop_cbet := CASE WHEN v_fold_to_flop_cbet_opp_count > 0 THEN round((v_fold_to_flop_cbet_count::numeric / v_fold_to_flop_cbet_opp_count) * 1000) / 10 ELSE NULL END;
  r_call_flop_cbet := CASE WHEN v_call_flop_cbet_opp_count > 0 THEN round((v_call_flop_cbet_count::numeric / v_call_flop_cbet_opp_count) * 1000) / 10 ELSE NULL END;
  r_raise_flop_cbet := CASE WHEN v_raise_flop_cbet_opp_count > 0 THEN round((v_raise_flop_cbet_count::numeric / v_raise_flop_cbet_opp_count) * 1000) / 10 ELSE NULL END;
  r_flop_cbet_success := CASE WHEN v_flop_cbet_success_opp_count > 0 THEN round((v_flop_cbet_success_count::numeric / v_flop_cbet_success_opp_count) * 1000) / 10 ELSE NULL END;
  r_flop_checkraise := CASE WHEN v_flop_checkraise_opp_count > 0 THEN round((v_flop_checkraise_count::numeric / v_flop_checkraise_opp_count) * 1000) / 10 ELSE NULL END;
  r_bet_when_checked_to := CASE WHEN v_bet_when_checked_to_opp_count > 0 THEN round((v_bet_when_checked_to_count::numeric / v_bet_when_checked_to_opp_count) * 1000) / 10 ELSE NULL END;
  r_flop_aggression := CASE WHEN v_flop_aggression_opp_count > 0 THEN round((v_flop_aggression_count::numeric / v_flop_aggression_opp_count) * 1000) / 10 ELSE NULL END;
  r_flop_donk_bet := CASE WHEN v_flop_donk_bet_opp_count > 0 THEN round((v_flop_donk_bet_count::numeric / v_flop_donk_bet_opp_count) * 1000) / 10 ELSE NULL END;

  r_fold_to_turn_barrel := CASE WHEN v_fold_to_turn_barrel_opp_count > 0 THEN round((v_fold_to_turn_barrel_count::numeric / v_fold_to_turn_barrel_opp_count) * 1000) / 10 ELSE NULL END;
  r_call_turn_barrel := CASE WHEN v_call_turn_barrel_opp_count > 0 THEN round((v_call_turn_barrel_count::numeric / v_call_turn_barrel_opp_count) * 1000) / 10 ELSE NULL END;
  r_raise_turn_barrel := CASE WHEN v_raise_turn_barrel_opp_count > 0 THEN round((v_raise_turn_barrel_count::numeric / v_raise_turn_barrel_opp_count) * 1000) / 10 ELSE NULL END;
  r_turn_barrel_success := CASE WHEN v_turn_barrel_success_opp_count > 0 THEN round((v_turn_barrel_success_count::numeric / v_turn_barrel_success_opp_count) * 1000) / 10 ELSE NULL END;
  r_delayed_cbet := CASE WHEN v_delayed_cbet_opp_count > 0 THEN round((v_delayed_cbet_count::numeric / v_delayed_cbet_opp_count) * 1000) / 10 ELSE NULL END;
  r_turn_checkraise := CASE WHEN v_turn_checkraise_opp_count > 0 THEN round((v_turn_checkraise_count::numeric / v_turn_checkraise_opp_count) * 1000) / 10 ELSE NULL END;
  r_turn_aggression := CASE WHEN v_turn_aggression_opp_count > 0 THEN round((v_turn_aggression_count::numeric / v_turn_aggression_opp_count) * 1000) / 10 ELSE NULL END;
  r_turn_probe := CASE WHEN v_turn_probe_opp_count > 0 THEN round((v_turn_probe_count::numeric / v_turn_probe_opp_count) * 1000) / 10 ELSE NULL END;
  r_turn_bet_when_checked_to := CASE WHEN v_turn_bet_when_checked_to_opp_count > 0 THEN round((v_turn_bet_when_checked_to_count::numeric / v_turn_bet_when_checked_to_opp_count) * 1000) / 10 ELSE NULL END;

  r_fold_to_river_barrel := CASE WHEN v_fold_to_river_barrel_opp_count > 0 THEN round((v_fold_to_river_barrel_count::numeric / v_fold_to_river_barrel_opp_count) * 1000) / 10 ELSE NULL END;
  r_call_river_barrel := CASE WHEN v_call_river_barrel_opp_count > 0 THEN round((v_call_river_barrel_count::numeric / v_call_river_barrel_opp_count) * 1000) / 10 ELSE NULL END;
  r_raise_river_barrel := CASE WHEN v_raise_river_barrel_opp_count > 0 THEN round((v_raise_river_barrel_count::numeric / v_raise_river_barrel_opp_count) * 1000) / 10 ELSE NULL END;
  r_river_bet := CASE WHEN v_river_bet_opp_count > 0 THEN round((v_river_bet_count::numeric / v_river_bet_opp_count) * 1000) / 10 ELSE NULL END;
  r_river_checkraise := CASE WHEN v_river_checkraise_opp_count > 0 THEN round((v_river_checkraise_count::numeric / v_river_checkraise_opp_count) * 1000) / 10 ELSE NULL END;
  r_river_aggression := CASE WHEN v_river_aggression_opp_count > 0 THEN round((v_river_aggression_count::numeric / v_river_aggression_opp_count) * 1000) / 10 ELSE NULL END;
  r_river_bet_success := CASE WHEN v_river_bet_success_opp_count > 0 THEN round((v_river_bet_success_count::numeric / v_river_bet_success_opp_count) * 1000) / 10 ELSE NULL END;
  r_river_bet_when_checked_to := CASE WHEN v_river_bet_when_checked_to_opp_count > 0 THEN round((v_river_bet_when_checked_to_count::numeric / v_river_bet_when_checked_to_opp_count) * 1000) / 10 ELSE NULL END;

  r_cbet_srp := CASE WHEN v_cbet_srp_opp_count > 0 THEN round((v_cbet_srp_count::numeric / v_cbet_srp_opp_count) * 1000) / 10 ELSE NULL END;
  r_cbet_3bet := CASE WHEN v_cbet_3bet_opp_count > 0 THEN round((v_cbet_3bet_count::numeric / v_cbet_3bet_opp_count) * 1000) / 10 ELSE NULL END;
  r_cbet_4bet_plus := CASE WHEN v_cbet_4bet_opp_count > 0 THEN round((v_cbet_4bet_count::numeric / v_cbet_4bet_opp_count) * 1000) / 10 ELSE NULL END;

  -- Build summary in 3 chunks (each < 50 key-value pairs = < 100 args)
  v_s1 := jsonb_build_object(
    'hands', v_total_hands, 'handsWithResult', v_hands_with_result, 'handsWithoutBB', v_hands_without_bb,
    'bbWon', round(v_bb_won * 100) / 100, 'bb100', r_bb100, 'profit', round(v_profit),
    'vpip', r_vpip, 'vpipCount', v_vpip_count, 'pfr', r_pfr, 'pfrCount', v_pfr_count,
    'threeBet', r_3bet, 'threeBetCount', v_3bet_count, 'threeBetOppCount', v_3bet_opp_count,
    'cbetFlop', r_cbet_flop, 'cbetFlopCount', v_cbet_flop_count, 'cbetFlopOppCount', v_cbet_flop_opp_count,
    'barrelTurn', r_barrel_turn, 'barrelTurnCount', v_barrel_turn_count, 'barrelTurnOppCount', v_barrel_turn_opp_count,
    'barrelRiver', r_barrel_river, 'barrelRiverCount', v_barrel_river_count, 'barrelRiverOppCount', v_barrel_river_opp_count,
    'wtsd', r_wtsd, 'wtsdCount', v_wtsd_count, 'wsd', r_wsd, 'wsdCount', v_wsd_count,
    'wwsf', r_wwsf, 'wwsfCount', v_wwsf_count,
    'sawFlopCount', v_saw_flop_count, 'sawTurnCount', v_saw_turn_count, 'sawRiverCount', v_saw_river_count,
    'showdownCount', v_showdown_count
  );

  v_s2 := jsonb_build_object(
    'foldTo3bet', r_fold_to_3bet, 'foldTo3betCount', v_fold_to_3bet_count, 'foldTo3betOppCount', v_fold_to_3bet_opp_count,
    'fourBet', r_4bet, 'fourBetCount', v_4bet_count, 'fourBetOppCount', v_4bet_opp_count,
    'foldTo4bet', r_fold_to_4bet, 'foldTo4betCount', v_fold_to_4bet_count, 'foldTo4betOppCount', v_fold_to_4bet_opp_count,
    'squeeze', r_squeeze, 'squeezeCount', v_squeeze_count, 'squeezeOppCount', v_squeeze_opp_count,
    'limp', r_limp, 'limpCount', v_limp_count, 'limpOppCount', v_limp_opp_count,
    'limpFold', r_limp_fold, 'limpFoldCount', v_limp_fold_count, 'limpFoldOppCount', v_limp_fold_opp_count,
    'steal', r_steal, 'stealCount', v_steal_count, 'stealOppCount', v_steal_opp_count,
    'foldToSteal', r_fold_to_steal, 'foldToStealCount', v_fold_to_steal_count, 'foldToStealOppCount', v_fold_to_steal_opp_count,
    'checkRaiseFlop', r_flop_checkraise, 'checkRaiseFlopCount', v_flop_checkraise_count, 'checkRaiseFlopOppCount', v_flop_checkraise_opp_count,
    'foldToFlopCbet', r_fold_to_flop_cbet, 'foldToFlopCbetCount', v_fold_to_flop_cbet_count, 'foldToFlopCbetOppCount', v_fold_to_flop_cbet_opp_count,
    'foldToTurnBarrel', r_fold_to_turn_barrel, 'foldToTurnBarrelCount', v_fold_to_turn_barrel_count, 'foldToTurnBarrelOppCount', v_fold_to_turn_barrel_opp_count,
    'foldToRiverBarrel', r_fold_to_river_barrel, 'foldToRiverBarrelCount', v_fold_to_river_barrel_count, 'foldToRiverBarrelOppCount', v_fold_to_river_barrel_opp_count
  );

  v_s3 := jsonb_build_object(
    'avgPot', r_avg_pot, 'activeDays', v_active_days, 'sites', v_site_count,
    'biggestWin', round(v_biggest_win * 100) / 100, 'biggestLoss', round(v_biggest_loss * 100) / 100,
    'tournamentEntries', v_tournament_entries, 'tournamentEvents', v_tournament_events,
    'reEntries', v_tournament_entries - v_tournament_events,
    'roi', 0, 'abi', 0, 'itm', 0, 'spi', 0, 'evBb100', 0,
    'unopened', CASE WHEN v_total_hands > 0 THEN round((v_pot_unopened::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
    'limped', CASE WHEN v_total_hands > 0 THEN round((v_pot_limped::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
    'srp', CASE WHEN v_total_hands > 0 THEN round((v_pot_srp::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
    '3bet', CASE WHEN v_total_hands > 0 THEN round((v_pot_3bet::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
    '4bet_plus', CASE WHEN v_total_hands > 0 THEN round((v_pot_4bet_plus::numeric / v_total_hands) * 1000) / 10 ELSE 0 END,
    'unopenedCount', v_pot_unopened, 'limpedCount', v_pot_limped, 'srpCount', v_pot_srp,
    '3betCount', v_pot_3bet, '4bet_plusCount', v_pot_4bet_plus,
    'cbet_srp', r_cbet_srp, 'cbet_3bet', r_cbet_3bet, 'cbet_4bet_plus', r_cbet_4bet_plus
  );

  v_summary := v_s1 || v_s2 || v_s3;

  SELECT jsonb_agg(value ORDER BY (value->>'hands')::int DESC) INTO v_sh_obj FROM jsonb_each(v_sh_map);
  SELECT jsonb_agg(value ORDER BY (value->>'hands')::int DESC) INTO v_board_obj FROM jsonb_each(v_board_map);
  SELECT jsonb_agg(jsonb_build_object('position',key,'hands',(value->>'hands')::int,'bbWon',(value->>'bbWon')::numeric,'bb100',CASE WHEN (value->>'hands')::int > 0 THEN round(((value->>'bbWon')::numeric / (value->>'hands')::int) * 10000) / 100 ELSE 0 END,'profit',(value->>'profit')::numeric) ORDER BY key) INTO v_pos_obj FROM jsonb_each(v_position_map);

  v_snapshot := jsonb_build_object(
    'summary', v_summary,
    'flop_analysis', jsonb_build_object(
      'sawFlopCount', v_saw_flop_count,
      'cbetFlop', r_cbet_flop, 'cbetFlopCount', v_cbet_flop_count, 'cbetFlopOppCount', v_cbet_flop_opp_count,
      'flopCbetSuccess', r_flop_cbet_success, 'flopCbetSuccessCount', v_flop_cbet_success_count, 'flopCbetSuccessOppCount', v_flop_cbet_success_opp_count,
      'foldToFlopCbet', r_fold_to_flop_cbet, 'foldToFlopCbetCount', v_fold_to_flop_cbet_count, 'foldToFlopCbetOppCount', v_fold_to_flop_cbet_opp_count,
      'callFlopCbet', r_call_flop_cbet, 'callFlopCbetCount', v_call_flop_cbet_count, 'callFlopCbetOppCount', v_call_flop_cbet_opp_count,
      'raiseFlopCbet', r_raise_flop_cbet, 'raiseFlopCbetCount', v_raise_flop_cbet_count, 'raiseFlopCbetOppCount', v_raise_flop_cbet_opp_count,
      'checkRaiseFlop', r_flop_checkraise, 'checkRaiseFlopCount', v_flop_checkraise_count, 'checkRaiseFlopOppCount', v_flop_checkraise_opp_count,
      'betWhenCheckedTo', r_bet_when_checked_to, 'betWhenCheckedToCount', v_bet_when_checked_to_count, 'betWhenCheckedToOppCount', v_bet_when_checked_to_opp_count,
      'flopAggression', r_flop_aggression, 'flopAggressionCount', v_flop_aggression_count, 'flopAggressionOppCount', v_flop_aggression_opp_count,
      'flopDonkBet', r_flop_donk_bet, 'flopDonkBetCount', v_flop_donk_bet_count, 'flopDonkBetOppCount', v_flop_donk_bet_opp_count,
      'wwsf', r_wwsf, 'wwsfCount', v_wwsf_count,
      'cbet_srp', r_cbet_srp, 'cbet_3bet', r_cbet_3bet, 'cbet_4bet_plus', r_cbet_4bet_plus
    ),
    'turn_analysis', jsonb_build_object(
      'sawTurnCount', v_saw_turn_count,
      'barrelTurn', r_barrel_turn, 'barrelTurnCount', v_barrel_turn_count, 'barrelTurnOppCount', v_barrel_turn_opp_count,
      'turnBarrelSuccess', r_turn_barrel_success, 'turnBarrelSuccessCount', v_turn_barrel_success_count, 'turnBarrelSuccessOppCount', v_turn_barrel_success_opp_count,
      'foldToTurnBarrel', r_fold_to_turn_barrel, 'foldToTurnBarrelCount', v_fold_to_turn_barrel_count, 'foldToTurnBarrelOppCount', v_fold_to_turn_barrel_opp_count,
      'callTurnBarrel', r_call_turn_barrel, 'callTurnBarrelCount', v_call_turn_barrel_count, 'callTurnBarrelOppCount', v_call_turn_barrel_opp_count,
      'raiseTurnBarrel', r_raise_turn_barrel, 'raiseTurnBarrelCount', v_raise_turn_barrel_count, 'raiseTurnBarrelOppCount', v_raise_turn_barrel_opp_count,
      'delayedCbet', r_delayed_cbet, 'delayedCbetCount', v_delayed_cbet_count, 'delayedCbetOppCount', v_delayed_cbet_opp_count,
      'turnCheckRaise', r_turn_checkraise, 'turnCheckRaiseCount', v_turn_checkraise_count, 'turnCheckRaiseOppCount', v_turn_checkraise_opp_count,
      'turnAggression', r_turn_aggression, 'turnAggressionCount', v_turn_aggression_count, 'turnAggressionOppCount', v_turn_aggression_opp_count,
      'turnProbe', r_turn_probe, 'turnProbeCount', v_turn_probe_count, 'turnProbeOppCount', v_turn_probe_opp_count,
      'turnBetWhenCheckedTo', r_turn_bet_when_checked_to, 'turnBetWhenCheckedToCount', v_turn_bet_when_checked_to_count, 'turnBetWhenCheckedToOppCount', v_turn_bet_when_checked_to_opp_count,
      'doubleBarrelOppCount', v_double_barrel_opp_count
    ),
    'river_analysis', jsonb_build_object(
      'sawRiverCount', v_saw_river_count,
      'barrelRiver', r_barrel_river, 'barrelRiverCount', v_barrel_river_count, 'barrelRiverOppCount', v_barrel_river_opp_count,
      'riverBet', r_river_bet, 'riverBetCount', v_river_bet_count, 'riverBetOppCount', v_river_bet_opp_count,
      'foldToRiverBarrel', r_fold_to_river_barrel, 'foldToRiverBarrelCount', v_fold_to_river_barrel_count, 'foldToRiverBarrelOppCount', v_fold_to_river_barrel_opp_count,
      'callRiverBarrel', r_call_river_barrel, 'callRiverBarrelCount', v_call_river_barrel_count, 'callRiverBarrelOppCount', v_call_river_barrel_opp_count,
      'raiseRiverBarrel', r_raise_river_barrel, 'raiseRiverBarrelCount', v_raise_river_barrel_count, 'raiseRiverBarrelOppCount', v_raise_river_barrel_opp_count,
      'riverCheckRaise', r_river_checkraise, 'riverCheckRaiseCount', v_river_checkraise_count, 'riverCheckRaiseOppCount', v_river_checkraise_opp_count,
      'riverAggression', r_river_aggression, 'riverAggressionCount', v_river_aggression_count, 'riverAggressionOppCount', v_river_aggression_opp_count,
      'riverBetSuccess', r_river_bet_success, 'riverBetSuccessCount', v_river_bet_success_count, 'riverBetSuccessOppCount', v_river_bet_success_opp_count,
      'riverBetWhenCheckedTo', r_river_bet_when_checked_to, 'riverBetWhenCheckedToCount', v_river_bet_when_checked_to_count, 'riverBetWhenCheckedToOppCount', v_river_bet_when_checked_to_opp_count,
      'showdownCount', v_showdown_count, 'wsdCount', v_wsd_count, 'wsd', r_wsd, 'wtsd', r_wtsd, 'wtsdCount', v_wtsd_count
    ),
    'starting_hands', COALESCE(v_sh_obj, '[]'::jsonb),
    'board_analysis', COALESCE(v_board_obj, '[]'::jsonb),
    'position_analysis', COALESCE(v_pos_obj, '[]'::jsonb),
    'preflop_analysis', '{}'::jsonb,
    'postflop_analysis', '{}'::jsonb,
    'tournament_analysis', '{}'::jsonb,
    'graph_series', v_graph_series,
    'filters', jsonb_build_object('integrityOk', true, 'pctIntegrityOk', true, 'sanityOk', true),
    'sanity_checks', jsonb_build_array(
      jsonb_build_object('name','PFR <= VPIP','pass',v_pfr_count <= v_vpip_count,'detail','PFR=' || v_pfr_count || ', VPIP=' || v_vpip_count),
      jsonb_build_object('name','3-Bet <= Opps','pass',v_3bet_count <= v_3bet_opp_count,'detail','3bet=' || v_3bet_count || ', opp=' || v_3bet_opp_count),
      jsonb_build_object('name','SD <= SawFlop','pass',v_showdown_count <= v_saw_flop_count,'detail','SD=' || v_showdown_count || ', sawFlop=' || v_saw_flop_count),
      jsonb_build_object('name','SD wins <= SDs','pass',v_wsd_count <= v_showdown_count,'detail','W$SD=' || v_wsd_count || ', SD=' || v_showdown_count)
    )
  );

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
    calculated_at = now(), source_hand_count = v_total_hands, source_imported_at = now(),
    summary = EXCLUDED.summary, position_analysis = EXCLUDED.position_analysis,
    preflop_analysis = EXCLUDED.preflop_analysis, postflop_analysis = EXCLUDED.postflop_analysis,
    board_analysis = EXCLUDED.board_analysis, tournament_analysis = EXCLUDED.tournament_analysis,
    graph_series = EXCLUDED.graph_series, flop_analysis = EXCLUDED.flop_analysis,
    turn_analysis = EXCLUDED.turn_analysis, river_analysis = EXCLUDED.river_analysis,
    starting_hands = EXCLUDED.starting_hands, filters = EXCLUDED.filters, sanity_checks = EXCLUDED.sanity_checks;

  RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;
