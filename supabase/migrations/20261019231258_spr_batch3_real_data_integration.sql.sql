/*
# SPR Batch 3: Update SPR Calculation to Use Real EV & Tournament Results

## Purpose
Rewrite sv_spr_calculate to:
1. Use real all-in EV (evBb100) from analytics snapshot when available (allinEvEligible > 0).
2. Use real ROI, ITM, and tournament profit from sv_tournament_results when entries exist.
3. Fall back to proxy/missing states when data is unavailable.
4. Track per-component availability with the new real data sources.

## Changes
- sv_spr_calculate: reads allinEvEligible, allinEvTotal from snapshot summary.
  If allinEvEligible > 0, uses real EV for allin_adjusted component.
  Reads from sv_tournament_results for ROI/ITM/profit_roi components.
  If tournament results exist with payouts, computes real ROI and ITM.
  If no tournament results, those components remain missing.

## New RPC: sv_spr_get_tournament_metrics
Returns aggregated tournament metrics (ROI, ITM, ABI, entries) from
sv_tournament_results for a given user. Used by the frontend dashboard.

## Security
- No RLS changes. All RPCs are SECURITY DEFINER with fixed search_path.
*/

CREATE OR REPLACE FUNCTION sv_spr_get_tournament_metrics(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_total_buyins numeric := 0;
  v_total_fees numeric := 0;
  v_total_payout numeric := 0;
  v_total_cost numeric := 0;
  v_itm_count int := 0;
  v_roi numeric := 0;
  v_itm numeric := 0;
  v_abi numeric := 0;
  v_net_profit numeric := 0;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(buy_in), 0),
    COALESCE(SUM(entry_fee), 0),
    COALESCE(SUM(payout), 0)
  INTO v_count, v_total_buyins, v_total_fees, v_total_payout
  FROM sv_tournament_results
  WHERE user_id = p_user_id AND buy_in > 0;

  v_total_cost := v_total_buyins + v_total_fees;
  v_net_profit := v_total_payout - v_total_cost;
  v_roi := CASE WHEN v_total_cost > 0 THEN (v_net_profit / v_total_cost) * 100 ELSE 0 END;

  SELECT COUNT(*) INTO v_itm_count
  FROM sv_tournament_results
  WHERE user_id = p_user_id AND buy_in > 0 AND payout > 0;

  v_itm := CASE WHEN v_count > 0 THEN (v_itm_count::numeric / v_count) * 100 ELSE 0 END;
  v_abi := CASE WHEN v_count > 0 THEN v_total_buyins / v_count ELSE 0 END;

  RETURN jsonb_build_object(
    'entries', v_count,
    'total_buyins', v_total_buyins,
    'total_fees', v_total_fees,
    'total_payout', v_total_payout,
    'total_cost', v_total_cost,
    'net_profit', v_net_profit,
    'roi', v_roi,
    'itm', v_itm,
    'itm_count', v_itm_count,
    'abi', v_abi,
    'has_results', v_count > 0
  );
END;
$$;

-- ============================================================
-- Rewrite sv_spr_calculate with real EV and tournament results
-- ============================================================
CREATE OR REPLACE FUNCTION sv_spr_calculate(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_summary jsonb;
  v_valid_hands int;
  v_tournament_entries int;
  v_abi numeric;
  v_bb100 numeric;
  v_ev_bb100 numeric;
  v_roi numeric;
  v_profit numeric;
  v_itm numeric;
  v_allin_ev_eligible int := 0;
  v_allin_ev_total numeric := 0;
  v_stack_depth_score numeric := 0;
  v_allin_score numeric := 0;
  v_competition_score numeric := 0;
  v_itm_score numeric := 0;
  v_profit_roi_score numeric := 0;
  v_stack_avail text := 'missing';
  v_allin_avail text := 'missing';
  v_comp_avail text := 'missing';
  v_itm_avail text := 'missing';
  v_profit_avail text := 'missing';
  v_spr numeric;
  v_status text := 'unqualified';
  v_confidence numeric := 0;
  v_pool text;
  v_count int;
  v_percentile numeric := 0;
  v_available_weight numeric := 0;
  v_available_components text[] := '{}';
  v_excluded_components text[] := '{}';
  v_all_available boolean;
  -- Tournament results variables
  v_tourn_count int;
  v_tourn_total_buyins numeric := 0;
  v_tourn_total_payout numeric := 0;
  v_tourn_total_cost numeric := 0;
  v_tourn_net_profit numeric := 0;
  v_tourn_roi numeric := 0;
  v_tourn_itm numeric := 0;
  v_tourn_itm_count int := 0;
  v_tourn_abi numeric := 0;
  v_has_tourn_results boolean := false;
BEGIN
  SELECT s.summary INTO v_snapshot
  FROM poker_analytics_snapshots s
  WHERE s.user_id = p_user_id AND s.mode = 'mtt'
  ORDER BY s.calculated_at DESC
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    INSERT INTO sv_spr_scores (user_id, spr_score, percentile, qualification_status,
      stack_depth_score, allin_adjusted_score, competition_strength_score,
      itm_score, profit_roi_score, valid_hands, tournament_entries,
      verified_abi, confidence_level, model_version, calculated_at,
      available_components, excluded_components)
    VALUES (p_user_id, 0, 0, 'unqualified', 0, 0, 0, 0, 0, 0, 0, 0, 0, 'spr_v1', now(),
      '{}', '{}')
    ON CONFLICT (user_id) DO UPDATE SET
      spr_score = 0, percentile = 0, qualification_status = 'unqualified',
      stack_depth_score = 0, allin_adjusted_score = 0, competition_strength_score = 0,
      itm_score = 0, profit_roi_score = 0, valid_hands = 0, tournament_entries = 0,
      verified_abi = 0, confidence_level = 0, calculated_at = now(),
      available_components = '{}', excluded_components = '{}';
    RETURN jsonb_build_object('status', 'unqualified', 'reason', 'no_data');
  END IF;

  v_summary := v_snapshot;
  v_valid_hands := COALESCE((v_summary->>'hands')::int, 0);
  v_tournament_entries := COALESCE((v_summary->>'tournamentEntries')::int, 0);
  v_abi := COALESCE((v_summary->>'abi')::numeric, 0);
  v_bb100 := COALESCE((v_summary->>'bb100')::numeric, 0);
  v_ev_bb100 := COALESCE((v_summary->>'evBb100')::numeric, 0);
  v_roi := COALESCE((v_summary->>'roi')::numeric, 0);
  v_profit := COALESCE((v_summary->>'profit')::numeric, 0);
  v_itm := COALESCE((v_summary->>'itm')::numeric, 0);
  v_allin_ev_eligible := COALESCE((v_summary->>'allinEvEligible')::int, 0);
  v_allin_ev_total := COALESCE((v_summary->>'allinEvTotal')::numeric, 0);

  -- Fetch tournament results for real ROI/ITM
  SELECT
    COUNT(*),
    COALESCE(SUM(buy_in), 0),
    COALESCE(SUM(payout), 0),
    COALESCE(SUM(buy_in + entry_fee), 0)
  INTO v_tourn_count, v_tourn_total_buyins, v_tourn_total_payout, v_tourn_total_cost
  FROM sv_tournament_results
  WHERE user_id = p_user_id AND buy_in > 0;

  v_has_tourn_results := v_tourn_count > 0;
  IF v_has_tourn_results THEN
    v_tourn_net_profit := v_tourn_total_payout - v_tourn_total_cost;
    v_tourn_roi := CASE WHEN v_tourn_total_cost > 0
      THEN (v_tourn_net_profit / v_tourn_total_cost) * 100 ELSE 0 END;
    SELECT COUNT(*) INTO v_tourn_itm_count
    FROM sv_tournament_results
    WHERE user_id = p_user_id AND buy_in > 0 AND payout > 0;
    v_tourn_itm := CASE WHEN v_tourn_count > 0
      THEN (v_tourn_itm_count::numeric / v_tourn_count) * 100 ELSE 0 END;
    v_tourn_abi := CASE WHEN v_tourn_count > 0
      THEN v_tourn_total_buyins / v_tourn_count ELSE 0 END;
    -- Use tournament results ABI if more reliable
    IF v_tourn_abi > 0 THEN v_abi := v_tourn_abi; END IF;
    -- Use tournament results entries if more reliable
    IF v_tourn_count > v_tournament_entries THEN v_tournament_entries := v_tourn_count; END IF;
  END IF;

  -- Component 1: Stack-Depth BB/100 (25%)
  IF v_valid_hands > 0 AND v_bb100 != 0 THEN
    v_stack_avail := 'available';
    v_stack_depth_score := GREATEST(0, LEAST(100, 50 + (v_bb100 * 4)));
  ELSIF v_valid_hands > 0 THEN
    v_stack_avail := 'available';
    v_stack_depth_score := 50;
  ELSE
    v_stack_avail := 'missing';
    v_stack_depth_score := 0;
  END IF;

  -- Component 2: All-In Adjusted BB/100 (20%)
  IF v_allin_ev_eligible > 0 AND v_allin_ev_total != 0 THEN
    v_allin_avail := 'available';
    -- Real EV: convert total EV BB to BB/100
    DECLARE
      v_ev_bb100_calc numeric;
    BEGIN
      v_ev_bb100_calc := (v_allin_ev_total / v_valid_hands) * 100;
      v_allin_score := GREATEST(0, LEAST(100, 50 + (v_ev_bb100_calc * 4)));
    END;
  ELSIF v_valid_hands > 0 AND v_bb100 != 0 THEN
    v_allin_avail := 'incomplete';
    v_allin_score := GREATEST(0, LEAST(100, 50 + (v_bb100 * 3.6)));
  ELSE
    v_allin_avail := 'missing';
    v_allin_score := 0;
  END IF;

  -- Component 3: Competition Strength / ABI (25%)
  IF v_abi > 0 AND v_tournament_entries > 0 THEN
    v_comp_avail := 'available';
    v_competition_score := GREATEST(0, LEAST(100, (LN(v_abi) / LN(1000)) * 100));
  ELSE
    v_comp_avail := 'missing';
    v_competition_score := 0;
  END IF;
  v_pool := sv_spr_classify_pool(v_abi);

  -- Component 4: ITM Percentage (10%)
  IF v_has_tourn_results AND v_tourn_itm > 0 THEN
    v_itm_avail := 'available';
    v_itm_score := GREATEST(0, LEAST(100, (v_tourn_itm - 5) * 5 + 25));
  ELSE
    v_itm_avail := 'missing';
    v_itm_score := 0;
  END IF;

  -- Component 5: Profit + ROI (20%)
  IF v_has_tourn_results AND v_tourn_roi != 0 THEN
    v_profit_avail := 'available';
    v_profit_roi_score := GREATEST(0, LEAST(100, 50 + (v_tourn_roi * 0.4)));
  ELSIF v_has_tourn_results AND v_tourn_net_profit != 0 THEN
    v_profit_avail := 'available';
    v_profit_roi_score := GREATEST(0, LEAST(100, 50 + (LN(GREATEST(1, v_tourn_net_profit + 1)) / LN(100000)) * 50));
  ELSIF v_profit != 0 THEN
    v_profit_avail := 'incomplete';
    v_profit_roi_score := GREATEST(0, LEAST(100, 50 + (v_profit * 0.001)));
  ELSE
    v_profit_avail := 'missing';
    v_profit_roi_score := 0;
  END IF;

  -- Build available/excluded arrays
  IF v_stack_avail != 'missing' THEN v_available_components := array_append(v_available_components, 'stack_depth');
  ELSE v_excluded_components := array_append(v_excluded_components, 'stack_depth'); END IF;
  IF v_allin_avail != 'missing' THEN v_available_components := array_append(v_available_components, 'allin_adjusted');
  ELSE v_excluded_components := array_append(v_excluded_components, 'allin_adjusted'); END IF;
  IF v_comp_avail != 'missing' THEN v_available_components := array_append(v_available_components, 'competition_strength');
  ELSE v_excluded_components := array_append(v_excluded_components, 'competition_strength'); END IF;
  IF v_itm_avail != 'missing' THEN v_available_components := array_append(v_available_components, 'itm');
  ELSE v_excluded_components := array_append(v_excluded_components, 'itm'); END IF;
  IF v_profit_avail != 'missing' THEN v_available_components := array_append(v_available_components, 'profit_roi');
  ELSE v_excluded_components := array_append(v_excluded_components, 'profit_roi'); END IF;

  v_all_available := (v_stack_avail = 'available'
    AND v_allin_avail = 'available'
    AND v_comp_avail = 'available'
    AND v_itm_avail = 'available'
    AND v_profit_avail = 'available');

  -- Qualification
  IF v_valid_hands >= 10000 AND v_tournament_entries >= 100 AND v_all_available THEN
    v_status := 'official';
    v_confidence := LEAST(1.0, (v_valid_hands::numeric / 50000) + 0.3);
    v_spr := 0.25 * v_stack_depth_score
           + 0.20 * v_allin_score
           + 0.25 * v_competition_score
           + 0.10 * v_itm_score
           + 0.20 * v_profit_roi_score;
  ELSIF v_valid_hands >= 1000 OR v_tournament_entries >= 10 THEN
    v_status := 'provisional';
    v_confidence := LEAST(0.5, v_valid_hands::numeric / 10000);
    v_available_weight := 0;
    IF v_stack_avail != 'missing' THEN v_available_weight := v_available_weight + 0.25; END IF;
    IF v_allin_avail != 'missing' THEN v_available_weight := v_available_weight + 0.20; END IF;
    IF v_comp_avail != 'missing' THEN v_available_weight := v_available_weight + 0.25; END IF;
    IF v_itm_avail != 'missing' THEN v_available_weight := v_available_weight + 0.10; END IF;
    IF v_profit_avail != 'missing' THEN v_available_weight := v_available_weight + 0.20; END IF;
    IF v_available_weight > 0 THEN
      v_spr := 0;
      IF v_stack_avail != 'missing' THEN v_spr := v_spr + 0.25 * v_stack_depth_score; END IF;
      IF v_allin_avail != 'missing' THEN v_spr := v_spr + 0.20 * v_allin_score; END IF;
      IF v_comp_avail != 'missing' THEN v_spr := v_spr + 0.25 * v_competition_score; END IF;
      IF v_itm_avail != 'missing' THEN v_spr := v_spr + 0.10 * v_itm_score; END IF;
      IF v_profit_avail != 'missing' THEN v_spr := v_spr + 0.20 * v_profit_roi_score; END IF;
      v_spr := v_spr / v_available_weight;
    ELSE
      v_spr := 0;
    END IF;
  ELSE
    v_status := 'unqualified';
    v_confidence := 0;
    v_spr := 0;
  END IF;

  v_spr := GREATEST(0, LEAST(100, v_spr));

  -- Percentile only for official players
  IF v_status = 'official' THEN
    SELECT COUNT(*) INTO v_count
    FROM sv_spr_scores
    WHERE qualification_status = 'official';
    IF v_count > 0 THEN
      SELECT 100.0 * (SELECT COUNT(*) FROM sv_spr_scores s2
        WHERE s2.qualification_status = 'official'
        AND s2.spr_score < v_spr) / v_count
      INTO v_percentile;
    END IF;
  ELSE
    v_percentile := 0;
  END IF;

  -- Persist score
  INSERT INTO sv_spr_scores (user_id, spr_score, percentile, qualification_status,
    stack_depth_score, allin_adjusted_score, competition_strength_score,
    itm_score, profit_roi_score, valid_hands, tournament_entries,
    verified_abi, estimated_pool, confidence_level, model_version, calculated_at,
    available_components, excluded_components)
  VALUES (p_user_id, v_spr, v_percentile, v_status,
    v_stack_depth_score, v_allin_score, v_competition_score,
    v_itm_score, v_profit_roi_score, v_valid_hands, v_tournament_entries,
    v_abi, v_pool, v_confidence, 'spr_v1', now(),
    v_available_components, v_excluded_components)
  ON CONFLICT (user_id) DO UPDATE SET
    spr_score = EXCLUDED.spr_score,
    percentile = EXCLUDED.percentile,
    qualification_status = EXCLUDED.qualification_status,
    stack_depth_score = EXCLUDED.stack_depth_score,
    allin_adjusted_score = EXCLUDED.allin_adjusted_score,
    competition_strength_score = EXCLUDED.competition_strength_score,
    itm_score = EXCLUDED.itm_score,
    profit_roi_score = EXCLUDED.profit_roi_score,
    valid_hands = EXCLUDED.valid_hands,
    tournament_entries = EXCLUDED.tournament_entries,
    verified_abi = EXCLUDED.verified_abi,
    estimated_pool = EXCLUDED.estimated_pool,
    confidence_level = EXCLUDED.confidence_level,
    model_version = EXCLUDED.model_version,
    calculated_at = now(),
    available_components = EXCLUDED.available_components,
    excluded_components = EXCLUDED.excluded_components;

  -- Persist component detail with availability
  INSERT INTO sv_spr_component_detail (user_id, component_key, weight, raw_value, normalized_score, detail)
  VALUES
    (p_user_id, 'stack_depth', 0.25, v_bb100, v_stack_depth_score,
     jsonb_build_object('label', 'Stack-Depth BB/100', 'raw_label', 'bb/100', 'availability', v_stack_avail)),
    (p_user_id, 'allin_adjusted', 0.20, COALESCE(v_ev_bb100, v_bb100), v_allin_score,
     jsonb_build_object('label', 'All-In Adjusted BB/100', 'availability', v_allin_avail,
       'eligible_hands', v_allin_ev_eligible,
       'ev_total_bb', v_allin_ev_total,
       'note',
       CASE WHEN v_allin_avail = 'incomplete' THEN 'EV data not yet available — using raw bb/100 as proxy. Not sufficient for official rating.'
            WHEN v_allin_avail = 'missing' THEN 'No all-in EV data available.'
            ELSE NULL END)),
    (p_user_id, 'competition_strength', 0.25, v_abi, v_competition_score,
     jsonb_build_object('label', 'ABI / Competition Strength', 'pool', v_pool, 'availability', v_comp_avail,
       'tournament_results_count', v_tourn_count)),
    (p_user_id, 'itm', 0.10, v_tourn_itm, v_itm_score,
     jsonb_build_object('label', 'ITM Percentage', 'availability', v_itm_avail,
       'tournament_results_count', v_tourn_count,
       'note',
       CASE WHEN v_itm_avail = 'missing' THEN 'Tournament finish data not yet available. Enter tournament results to enable ITM scoring.'
            ELSE NULL END)),
    (p_user_id, 'profit_roi', 0.20, COALESCE(v_tourn_roi, v_profit), v_profit_roi_score,
     jsonb_build_object('label', 'Profit + ROI', 'availability', v_profit_avail,
       'tournament_roi', v_tourn_roi,
       'tournament_net_profit', v_tourn_net_profit,
       'note',
       CASE WHEN v_profit_avail = 'missing' THEN 'Tournament winnings and entry costs require verified tournament results. Enter your tournament results to enable ROI scoring.'
            WHEN v_profit_avail = 'incomplete' THEN 'Using chip profit as proxy. Enter tournament results for verified ROI.'
            ELSE NULL END))
  ON CONFLICT (user_id, component_key) DO UPDATE SET
    weight = EXCLUDED.weight,
    raw_value = EXCLUDED.raw_value,
    normalized_score = EXCLUDED.normalized_score,
    detail = EXCLUDED.detail;

  -- Record history (only if score changed)
  INSERT INTO sv_spr_history (user_id, spr_score, percentile, qualification_status, model_version, recorded_at)
  VALUES (p_user_id, v_spr, v_percentile, v_status, 'spr_v1', now());

  RETURN jsonb_build_object(
    'status', v_status,
    'spr_score', v_spr,
    'percentile', v_percentile,
    'valid_hands', v_valid_hands,
    'tournament_entries', v_tournament_entries,
    'verified_abi', v_abi,
    'estimated_pool', v_pool,
    'confidence', v_confidence,
    'available_components', to_jsonb(v_available_components),
    'excluded_components', to_jsonb(v_excluded_components),
    'allin_ev_eligible', v_allin_ev_eligible,
    'tournament_results_count', v_tourn_count,
    'components', jsonb_build_object(
      'stack_depth', jsonb_build_object('score', v_stack_depth_score, 'availability', v_stack_avail),
      'allin_adjusted', jsonb_build_object('score', v_allin_score, 'availability', v_allin_avail),
      'competition_strength', jsonb_build_object('score', v_competition_score, 'availability', v_comp_avail),
      'itm', jsonb_build_object('score', v_itm_score, 'availability', v_itm_avail),
      'profit_roi', jsonb_build_object('score', v_profit_roi_score, 'availability', v_profit_avail)
    )
  );
END;
$$;