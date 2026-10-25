/*
# SVI v2 — Fix variable name typo (v_pop_bb100_std → v_pop_bb100_stddev)
*/
CREATE OR REPLACE FUNCTION public.sv_svi_calculate_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_method_version text := 'svi_v2_10factor';
  v_min_hands int := 5000;
  v_min_tournaments int := 20;
  v_bb100_shrinkage_k int := 2000;
  v_total_eligible int;
  v_pop_bb100_mean double precision;
  v_pop_bb100_stddev double precision;

  w_bb100 double precision;
  w_ev_luck double precision;
  w_abi double precision;
  w_roi double precision;
  w_sample double precision;
  w_consistency double precision;
  w_final_tables double precision;
  w_largest_score double precision;
  w_community double precision;
  w_sum double precision;
BEGIN
  SELECT COALESCE(SUM(weight), 1.0) INTO w_sum FROM sv_svi_weights;

  SELECT weight INTO w_bb100 FROM sv_svi_weights WHERE factor_key = 'bb100_percentile';
  SELECT weight INTO w_ev_luck FROM sv_svi_weights WHERE factor_key = 'ev_luck_percentile';
  SELECT weight INTO w_abi FROM sv_svi_weights WHERE factor_key = 'abi_percentile';
  SELECT weight INTO w_roi FROM sv_svi_weights WHERE factor_key = 'roi_percentile';
  SELECT weight INTO w_sample FROM sv_svi_weights WHERE factor_key = 'sample_percentile';
  SELECT weight INTO w_consistency FROM sv_svi_weights WHERE factor_key = 'consistency_percentile';
  SELECT weight INTO w_final_tables FROM sv_svi_weights WHERE factor_key = 'final_tables_percentile';
  SELECT weight INTO w_largest_score FROM sv_svi_weights WHERE factor_key = 'largest_score_percentile';
  SELECT weight INTO w_community FROM sv_svi_weights WHERE factor_key = 'community_percentile';

  IF w_sum = 0 THEN w_sum := 1.0; END IF;
  w_bb100 := COALESCE(w_bb100, 0) / w_sum;
  w_ev_luck := COALESCE(w_ev_luck, 0) / w_sum;
  w_abi := COALESCE(w_abi, 0) / w_sum;
  w_roi := COALESCE(w_roi, 0) / w_sum;
  w_sample := COALESCE(w_sample, 0) / w_sum;
  w_consistency := COALESCE(w_consistency, 0) / w_sum;
  w_final_tables := COALESCE(w_final_tables, 0) / w_sum;
  w_largest_score := COALESCE(w_largest_score, 0) / w_sum;
  w_community := COALESCE(w_community, 0) / w_sum;

  CREATE TEMP TABLE IF NOT EXISTS _svi_raw AS
  WITH latest_snapshots AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      source_hand_count,
      (summary->>'bb100')::float AS bb100,
      (summary->>'evBb100')::float AS ev_bb100,
      (summary->>'hands')::int AS hands,
      (summary->>'biggestWin')::float AS biggest_win,
      (tournament_analysis->>'abi')::float AS abi,
      (tournament_analysis->>'roi')::float AS roi,
      (tournament_analysis->>'profit')::float AS profit,
      (tournament_analysis->>'biggestWin')::float AS t_biggest_win,
      (tournament_analysis->>'tournamentEntries')::int AS entries,
      (tournament_analysis->>'tournamentEvents')::int AS events
    FROM poker_analytics_snapshots
    WHERE mode = 'mtt'
    ORDER BY user_id, calculated_at DESC
  ),
  tournament_stats AS (
    SELECT
      user_id,
      COUNT(DISTINCT tournament_id) AS distinct_tournaments,
      COUNT(DISTINCT tournament_id) FILTER (WHERE net_result > 0) AS profitable_tournaments,
      MAX(net_result) AS largest_score,
      STDDEV(per_tournament_bb) AS bb100_tournament_stddev,
      AVG(per_tournament_bb) AS avg_tournament_bb
    FROM (
      SELECT
        user_id, tournament_id, net_result,
        SUM(bb_won) OVER (PARTITION BY user_id, tournament_id) AS per_tournament_bb
      FROM poker_hand_records
      WHERE buy_in IS NOT NULL AND buy_in > 0
        AND tournament_id IS NOT NULL AND tournament_id <> ''
    ) t
    GROUP BY user_id
  ),
  community_stats AS (
    SELECT author_id AS user_id, COUNT(*) AS message_count
    FROM network_chat_messages
    WHERE moderation_status = 'visible'
    GROUP BY author_id
  )
  SELECT
    ls.user_id,
    ls.hands,
    ls.bb100,
    COALESCE(ls.ev_bb100, 0) AS ev_bb100,
    ls.abi,
    COALESCE(ls.roi, 0) AS roi,
    COALESCE(ls.profit, 0) AS profit,
    COALESCE(ls.biggest_win, ls.t_biggest_win, 0) AS biggest_win,
    COALESCE(ts.distinct_tournaments, ls.events, 0) AS distinct_tournaments,
    COALESCE(ts.profitable_tournaments, 0) AS profitable_tournaments,
    COALESCE(ts.largest_score, 0) AS largest_score,
    COALESCE(ts.bb100_tournament_stddev, 0) AS bb100_tournament_stddev,
    COALESCE(ts.avg_tournament_bb, ls.bb100) AS avg_tournament_bb,
    COALESCE(cs.message_count, 0) AS community_messages
  FROM latest_snapshots ls
  LEFT JOIN tournament_stats ts ON ts.user_id = ls.user_id
  LEFT JOIN community_stats cs ON cs.user_id = ls.user_id
  WHERE ls.hands >= v_min_hands
    AND COALESCE(ts.distinct_tournaments, ls.events, 0) >= v_min_tournaments
    AND ls.bb100 IS NOT NULL
    AND ls.abi IS NOT NULL AND ls.abi > 0;

  SELECT COUNT(*), COALESCE(AVG(bb100), 0), COALESCE(STDDEV(bb100), 0)
  INTO v_total_eligible, v_pop_bb100_mean, v_pop_bb100_stddev
  FROM _svi_raw;

  IF v_total_eligible = 0 THEN
    UPDATE sv_svi_eligibility SET
      eligible_hands = 0, eligible_tournaments = 0, svi_score = 0,
      overall_rank = 0, total_eligible = 0, calculated_at = now();
    DROP TABLE IF EXISTS _svi_raw;
    RETURN;
  END IF;

  IF v_pop_bb100_stddev = 0 OR v_pop_bb100_stddev IS NULL THEN
    v_pop_bb100_stddev := 1.0;
  END IF;

  INSERT INTO sv_svi_eligibility (
    user_id, opted_in, eligible_hands, eligible_tournaments,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, svi_score, overall_rank, total_eligible,
    method_version, calculated_at, updated_at,
    bb100_percentile_v2, ev_luck_percentile, roi_percentile,
    sample_percentile, consistency_percentile, final_tables_percentile,
    largest_score_percentile, community_percentile, factor_detail
  )
  WITH adjusted AS (
    SELECT
      r.*,
      (v_bb100_shrinkage_k * v_pop_bb100_mean + r.hands * r.bb100) / (v_bb100_shrinkage_k + r.hands) AS adjusted_bb100,
      LN(r.abi) AS log_abi,
      r.ev_bb100 AS ev_component,
      LEAST(1.0, LN(GREATEST(r.hands, 1)) / LN(50000)) AS sample_ratio,
      CASE
        WHEN r.avg_tournament_bb = 0 OR r.bb100_tournament_stddev IS NULL THEN 0
        ELSE 1.0 / (1.0 + r.bb100_tournament_stddev / NULLIF(ABS(r.avg_tournament_bb), 0))
      END AS consistency_raw,
      CASE WHEN r.distinct_tournaments > 0
        THEN r.profitable_tournaments::float / r.distinct_tournaments
        ELSE 0 END AS final_table_ratio
    FROM _svi_raw r
  ),
  percentiled AS (
    SELECT
      a.user_id, a.hands, a.bb100, a.ev_bb100, a.abi, a.roi, a.profit,
      a.biggest_win, a.largest_score, a.distinct_tournaments,
      a.profitable_tournaments, a.community_messages,
      a.adjusted_bb100,
      (CUME_DIST() OVER (ORDER BY a.adjusted_bb100)) * 100 AS bb100_pct,
      CASE WHEN MAX(a.ev_component) OVER () = 0 AND MIN(a.ev_component) OVER () = 0
        THEN 50.0
        ELSE (CUME_DIST() OVER (ORDER BY a.ev_component)) * 100
      END AS ev_luck_pct,
      (CUME_DIST() OVER (ORDER BY a.log_abi)) * 100 AS abi_pct,
      (CUME_DIST() OVER (ORDER BY a.roi)) * 100 AS roi_pct,
      (CUME_DIST() OVER (ORDER BY a.sample_ratio)) * 100 AS sample_pct,
      (CUME_DIST() OVER (ORDER BY a.consistency_raw)) * 100 AS consistency_pct,
      (CUME_DIST() OVER (ORDER BY a.final_table_ratio)) * 100 AS final_tables_pct,
      (CUME_DIST() OVER (ORDER BY a.largest_score)) * 100 AS largest_score_pct,
      (CUME_DIST() OVER (ORDER BY a.community_messages)) * 100 AS community_pct
    FROM adjusted a
  ),
  composited AS (
    SELECT
      p.*,
      (p.bb100_pct * w_bb100 +
       p.ev_luck_pct * w_ev_luck +
       p.abi_pct * w_abi +
       p.roi_pct * w_roi +
       p.sample_pct * w_sample +
       p.consistency_pct * w_consistency +
       p.final_tables_pct * w_final_tables +
       p.largest_score_pct * w_largest_score +
       p.community_pct * w_community
      ) AS composite_rating,
      RANK() OVER (ORDER BY (
        p.bb100_pct * w_bb100 +
       p.ev_luck_pct * w_ev_luck +
       p.abi_pct * w_abi +
       p.roi_pct * w_roi +
       p.sample_pct * w_sample +
       p.consistency_pct * w_consistency +
       p.final_tables_pct * w_final_tables +
       p.largest_score_pct * w_largest_score +
       p.community_pct * w_community
      ) DESC) AS rnk
    FROM percentiled p
  )
  SELECT
    c.user_id,
    COALESCE(e.opted_in, false),
    c.hands,
    c.distinct_tournaments,
    c.abi,
    c.bb100,
    c.adjusted_bb100,
    c.abi_pct,
    c.bb100_pct,
    c.composite_rating,
    CASE
      WHEN v_total_eligible = 1 THEN 100.0
      ELSE 1 + 99.0 * (v_total_eligible - c.rnk) / (v_total_eligible - 1)
    END,
    c.rnk,
    v_total_eligible,
    v_method_version,
    now(),
    now(),
    c.bb100_pct,
    c.ev_luck_pct,
    c.roi_pct,
    c.sample_pct,
    c.consistency_pct,
    c.final_tables_pct,
    c.largest_score_pct,
    c.community_pct,
    jsonb_build_object(
      'bb100', jsonb_build_object('raw', c.bb100, 'adjusted', c.adjusted_bb100, 'percentile', c.bb100_pct, 'weight', w_bb100),
      'ev_luck', jsonb_build_object('ev_bb100', c.ev_bb100, 'percentile', c.ev_luck_pct, 'weight', w_ev_luck),
      'abi', jsonb_build_object('raw', c.abi, 'percentile', c.abi_pct, 'weight', w_abi),
      'roi', jsonb_build_object('raw', c.roi, 'percentile', c.roi_pct, 'weight', w_roi),
      'sample', jsonb_build_object('hands', c.hands, 'percentile', c.sample_pct, 'weight', w_sample),
      'consistency', jsonb_build_object('percentile', c.consistency_pct, 'weight', w_consistency),
      'final_tables', jsonb_build_object('profitable', c.profitable_tournaments, 'total', c.distinct_tournaments, 'percentile', c.final_tables_pct, 'weight', w_final_tables),
      'largest_score', jsonb_build_object('raw', c.largest_score, 'percentile', c.largest_score_pct, 'weight', w_largest_score),
      'community', jsonb_build_object('messages', c.community_messages, 'percentile', c.community_pct, 'weight', w_community),
      'total_eligible', v_total_eligible,
      'method_version', v_method_version
    )
  FROM composited c
  LEFT JOIN sv_svi_eligibility e ON e.user_id = c.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    eligible_hands = EXCLUDED.eligible_hands,
    eligible_tournaments = EXCLUDED.eligible_tournaments,
    abi = EXCLUDED.abi,
    bb100 = EXCLUDED.bb100,
    adjusted_bb100 = EXCLUDED.adjusted_bb100,
    abi_percentile = EXCLUDED.abi_percentile,
    bb100_percentile = EXCLUDED.bb100_percentile,
    composite_rating = EXCLUDED.composite_rating,
    svi_score = EXCLUDED.svi_score,
    overall_rank = EXCLUDED.overall_rank,
    total_eligible = EXCLUDED.total_eligible,
    method_version = EXCLUDED.method_version,
    calculated_at = now(),
    updated_at = now(),
    bb100_percentile_v2 = EXCLUDED.bb100_percentile_v2,
    ev_luck_percentile = EXCLUDED.ev_luck_percentile,
    roi_percentile = EXCLUDED.roi_percentile,
    sample_percentile = EXCLUDED.sample_percentile,
    consistency_percentile = EXCLUDED.consistency_percentile,
    final_tables_percentile = EXCLUDED.final_tables_percentile,
    largest_score_percentile = EXCLUDED.largest_score_percentile,
    community_percentile = EXCLUDED.community_percentile,
    factor_detail = EXCLUDED.factor_detail;

  UPDATE sv_svi_eligibility
  SET eligible_hands = 0, eligible_tournaments = 0, svi_score = 0,
      overall_rank = 0, total_eligible = 0, calculated_at = now()
  WHERE user_id NOT IN (SELECT user_id FROM _svi_raw);

  INSERT INTO sv_svi_eligibility (user_id, opted_in, eligible_hands, eligible_tournaments, calculated_at)
  SELECT DISTINCT ls.user_id, false, 0, 0, now()
  FROM (
    SELECT DISTINCT ON (user_id) user_id
    FROM poker_analytics_snapshots WHERE mode = 'mtt'
    ORDER BY user_id, calculated_at DESC
  ) ls
  WHERE ls.user_id NOT IN (SELECT user_id FROM sv_svi_eligibility)
  ON CONFLICT (user_id) DO NOTHING;

  DROP TABLE IF EXISTS _svi_raw;
END;
$function$;
