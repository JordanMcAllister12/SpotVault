-- Fix Flop C-Bet calculation: update the stored snapshot with corrected values
-- that exclude donk-bets and no-flop-action hands.
-- This is a one-time data fix; the TS recalculation code was already fixed.

-- Create a helper function that computes corrected C-Bet stats from raw hand records
CREATE OR REPLACE FUNCTION compute_corrected_cbet_stats(p_user_id text, p_mode text)
RETURNS jsonb AS $$
DECLARE
  v_cbet_flop_count int := 0;
  v_cbet_flop_opp_count int := 0;
  v_cbet_srp_count int := 0;
  v_cbet_srp_opp_count int := 0;
  v_cbet_3bet_count int := 0;
  v_cbet_3bet_opp_count int := 0;
  v_cbet_4bet_count int := 0;
  v_cbet_4bet_opp_count int := 0;
  v_barrel_turn_count int := 0;
  v_barrel_turn_opp_count int := 0;
  v_barrel_river_count int := 0;
  v_barrel_river_opp_count int := 0;
  v_hand record;
  v_actions jsonb;
  v_hero_name text;
  v_saw_flop boolean;
  v_saw_turn boolean;
  v_saw_river boolean;
  v_pot_type text;
  v_last_raiser text;
  v_hero_first_flop_action text;
  v_hero_first_flop_idx int;
  v_first_opp_flop_agro_idx int;
  v_flop_action_count int;
  v_hero_turn_bets jsonb;
  v_hero_river_bets jsonb;
  v_is_legit_opp boolean;
  v_hero_cbet boolean;
BEGIN
  FOR v_hand IN
    SELECT * FROM poker_hand_records
    WHERE user_id = p_user_id AND game_mode = p_mode
    AND hand_hash NOT LIKE '%-unknown-%' AND hand_hash NOT LIKE 'summary-%'
  LOOP
    v_hero_name := v_hand.hero_name;
    v_actions := v_hand.action_sequence;
    v_saw_flop := COALESCE(v_hand.saw_flop, false);
    v_saw_turn := COALESCE(v_hand.saw_turn, false);
    v_saw_river := COALESCE(v_hand.saw_river, false);
    v_pot_type := v_hand.pot_type;

    IF v_actions IS NULL OR jsonb_typeof(v_actions) != 'array' OR v_hero_name IS NULL OR NOT v_saw_flop THEN
      CONTINUE;
    END IF;

    -- Find last preflop raiser
    SELECT elem.val->>'player' INTO v_last_raiser
    FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
    WHERE elem.val->>'street' = 'preflop' AND elem.val->>'action' IN ('raise','bet','all-in')
    ORDER BY elem.ord DESC LIMIT 1;

    IF v_last_raiser != v_hero_name THEN
      CONTINUE;
    END IF;

    -- Count flop actions
    SELECT COUNT(*) INTO v_flop_action_count
    FROM jsonb_array_elements(v_actions) AS elem(val)
    WHERE elem.val->>'street' = 'flop';

    -- Skip hands with no flop actions (hero won preflop but board was dealt)
    IF v_flop_action_count = 0 THEN
      CONTINUE;
    END IF;

    -- Find hero's first flop action and its index
    SELECT elem.val->>'action', elem.ord INTO v_hero_first_flop_action, v_hero_first_flop_idx
    FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
    WHERE elem.val->>'street' = 'flop' AND elem.val->>'player' = v_hero_name
    ORDER BY elem.ord ASC LIMIT 1;

    -- Skip if hero never acted on the flop
    IF v_hero_first_flop_action IS NULL THEN
      CONTINUE;
    END IF;

    -- Find first opponent flop aggressive action index
    v_first_opp_flop_agro_idx := NULL;
    SELECT elem.ord INTO v_first_opp_flop_agro_idx
    FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord)
    WHERE elem.val->>'street' = 'flop' AND elem.val->>'player' != v_hero_name AND elem.val->>'action' IN ('bet','raise','all-in')
    ORDER BY elem.ord ASC LIMIT 1;

    -- Check if this is a legitimate C-Bet opportunity (no donk-bet before hero)
    v_is_legit_opp := (v_first_opp_flop_agro_idx IS NULL OR v_first_opp_flop_agro_idx > v_hero_first_flop_idx);

    IF NOT v_is_legit_opp THEN
      CONTINUE;
    END IF;

    -- This is a legitimate C-Bet opportunity
    v_cbet_flop_opp_count := v_cbet_flop_opp_count + 1;

    -- Check if hero made a C-Bet (first flop action was bet/raise/all-in)
    v_hero_cbet := v_hero_first_flop_action IN ('bet','raise','all-in');

    IF v_hero_cbet THEN
      v_cbet_flop_count := v_cbet_flop_count + 1;

      -- By pot type
      IF v_pot_type = 'srp' THEN v_cbet_srp_opp_count := v_cbet_srp_opp_count + 1; v_cbet_srp_count := v_cbet_srp_count + 1;
      ELSIF v_pot_type = '3bet' THEN v_cbet_3bet_opp_count := v_cbet_3bet_opp_count + 1; v_cbet_3bet_count := v_cbet_3bet_count + 1;
      ELSIF v_pot_type = '4bet_plus' THEN v_cbet_4bet_opp_count := v_cbet_4bet_opp_count + 1; v_cbet_4bet_count := v_cbet_4bet_count + 1;
      END IF;

      -- Barrel stats (only if hero C-Bet and saw turn)
      IF v_saw_turn THEN
        v_barrel_turn_opp_count := v_barrel_turn_opp_count + 1;
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
            IF v_hero_river_bets IS NOT NULL AND jsonb_array_length(v_hero_river_bets) > 0 THEN
              v_barrel_river_count := v_barrel_river_count + 1;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'cbetFlopCount', v_cbet_flop_count,
    'cbetFlopOppCount', v_cbet_flop_opp_count,
    'cbetFlop', CASE WHEN v_cbet_flop_opp_count > 0 THEN round((v_cbet_flop_count::numeric / v_cbet_flop_opp_count) * 1000) / 10 ELSE 0 END,
    'cbet_srp', CASE WHEN v_cbet_srp_opp_count > 0 THEN round((v_cbet_srp_count::numeric / v_cbet_srp_opp_count) * 1000) / 10 ELSE 0 END,
    'cbet_3bet', CASE WHEN v_cbet_3bet_opp_count > 0 THEN round((v_cbet_3bet_count::numeric / v_cbet_3bet_opp_count) * 1000) / 10 ELSE 0 END,
    'cbet_4bet_plus', CASE WHEN v_cbet_4bet_opp_count > 0 THEN round((v_cbet_4bet_count::numeric / v_cbet_4bet_opp_count) * 1000) / 10 ELSE 0 END,
    'barrelTurnCount', v_barrel_turn_count,
    'barrelTurnOppCount', v_barrel_turn_opp_count,
    'barrelTurn', CASE WHEN v_barrel_turn_opp_count > 0 THEN round((v_barrel_turn_count::numeric / v_barrel_turn_opp_count) * 1000) / 10 ELSE 0 END,
    'barrelRiverCount', v_barrel_river_count,
    'barrelRiverOppCount', v_barrel_river_opp_count,
    'barrelRiver', CASE WHEN v_barrel_river_opp_count > 0 THEN round((v_barrel_river_count::numeric / v_barrel_river_opp_count) * 1000) / 10 ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql;
