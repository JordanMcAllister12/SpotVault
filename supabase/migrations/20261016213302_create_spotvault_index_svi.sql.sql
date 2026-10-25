/*
# Create SpotVault Index (SVI) — Sitewide Player Ranking System

## Overview
Implements a competitive player ranking system that combines BB/100 performance (60%) with Average Buy-In (40%) to produce a 1-100 score for each eligible player.

## New Tables
1. `sv_svi_eligibility` — Per-user SVI opt-in, eligibility status, and computed scores
2. `sv_svi_snapshots` — Historical SVI snapshots for trend analysis

## RPC Functions
1. `sv_svi_calculate_all()` — Recalculates SVI for all eligible users from analytics snapshots
2. `sv_svi_get_user(p_user_id)` — Returns current SVI data for a user
3. `sv_svi_get_leaderboard(p_limit, p_offset, p_sort_by)` — Returns sorted leaderboard of opted-in eligible players
4. `sv_svi_get_snapshots(p_user_id, p_limit)` — Returns historical snapshots
5. `sv_svi_create_snapshot(p_user_id)` — Saves current SVI data as a historical snapshot

## Security
- RLS enabled on both tables
- Users can read/update their own eligibility data
- Leaderboard data (opted-in users only) is accessible via SECURITY DEFINER RPC
- All calculation functions are SECURITY DEFINER

## Important Notes
1. Eligibility: 1000+ tournament hands, 20+ distinct tournaments with valid buy-in
2. BB/100 adjusted via shrinkage toward population mean
3. ABI log-normalized before percentile calculation
4. SVI = 1 + 99 * (N - R) / (N - 1)
5. Single eligible player gets provisional score of 100
*/

-- ════════════════════════════════════════════════════════════════
-- 1. ELIGIBILITY TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sv_svi_eligibility (
  user_id text PRIMARY KEY,
  opted_in boolean NOT NULL DEFAULT false,
  eligible_hands integer NOT NULL DEFAULT 0,
  eligible_tournaments integer NOT NULL DEFAULT 0,
  abi double precision NOT NULL DEFAULT 0,
  bb100 double precision NOT NULL DEFAULT 0,
  adjusted_bb100 double precision NOT NULL DEFAULT 0,
  abi_percentile double precision NOT NULL DEFAULT 0,
  bb100_percentile double precision NOT NULL DEFAULT 0,
  composite_rating double precision NOT NULL DEFAULT 0,
  svi_score double precision NOT NULL DEFAULT 0,
  overall_rank integer NOT NULL DEFAULT 0,
  total_eligible integer NOT NULL DEFAULT 0,
  method_version text NOT NULL DEFAULT 'svi_v1_60_40',
  calculated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sv_svi_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svi_select_own" ON sv_svi_eligibility;
CREATE POLICY "svi_select_own" ON sv_svi_eligibility FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "svi_update_own" ON sv_svi_eligibility;
CREATE POLICY "svi_update_own" ON sv_svi_eligibility
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- ════════════════════════════════════════════════════════════════
-- 2. SNAPSHOTS TABLE
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sv_svi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  svi_score double precision NOT NULL DEFAULT 0,
  overall_rank integer NOT NULL DEFAULT 0,
  total_eligible integer NOT NULL DEFAULT 0,
  abi double precision NOT NULL DEFAULT 0,
  bb100 double precision NOT NULL DEFAULT 0,
  adjusted_bb100 double precision NOT NULL DEFAULT 0,
  abi_percentile double precision NOT NULL DEFAULT 0,
  bb100_percentile double precision NOT NULL DEFAULT 0,
  composite_rating double precision NOT NULL DEFAULT 0,
  method_version text NOT NULL DEFAULT 'svi_v1_60_40',
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_svi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svi_snapshots_select_own" ON sv_svi_snapshots;
CREATE POLICY "svi_snapshots_select_own" ON sv_svi_snapshots FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "svi_snapshots_insert_own" ON sv_svi_snapshots;
CREATE POLICY "svi_snapshots_insert_own" ON sv_svi_snapshots FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX IF NOT EXISTS idx_svi_snapshots_user_time ON sv_svi_snapshots (user_id, snapshot_at DESC);

-- ════════════════════════════════════════════════════════════════
-- 3. CALCULATION FUNCTION (SECURITY DEFINER)
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_calculate_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method_version text := 'svi_v1_60_40';
  v_min_hands int := 1000;
  v_min_tournaments int := 20;
  v_bb100_shrinkage_k int := 2000;
  v_total_eligible int;
  v_pop_bb100_mean double precision;
  v_pop_bb100_std double precision;
BEGIN
  -- Step 1: Gather raw stats from latest analytics snapshots per user
  CREATE TEMP TABLE IF NOT EXISTS _svi_raw AS
  WITH latest_snapshots AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      source_hand_count,
      (summary->>'bb100')::float AS bb100,
      (summary->>'hands')::int AS hands,
      (tournament_analysis->>'abi')::float AS abi,
      (tournament_analysis->>'tournamentEntries')::int AS entries,
      (tournament_analysis->>'tournamentEvents')::int AS events
    FROM poker_analytics_snapshots
    WHERE mode = 'mtt'
    ORDER BY user_id, calculated_at DESC
  ),
  tournament_counts AS (
    SELECT user_id, COUNT(DISTINCT tournament_id) AS distinct_tournaments
    FROM poker_hand_records
    WHERE buy_in IS NOT NULL AND buy_in > 0
      AND tournament_id IS NOT NULL AND tournament_id <> ''
    GROUP BY user_id
  )
  SELECT
    ls.user_id,
    ls.hands,
    ls.bb100,
    ls.abi,
    COALESCE(tc.distinct_tournaments, ls.events) AS distinct_tournaments
  FROM latest_snapshots ls
  LEFT JOIN tournament_counts tc ON tc.user_id = ls.user_id
  WHERE ls.hands >= v_min_hands
    AND COALESCE(tc.distinct_tournaments, ls.events) >= v_min_tournaments
    AND ls.bb100 IS NOT NULL
    AND ls.abi IS NOT NULL AND ls.abi > 0;

  -- Step 2: Population statistics for shrinkage
  SELECT COUNT(*), COALESCE(AVG(bb100), 0), COALESCE(STDDEV(bb100), 0)
  INTO v_total_eligible, v_pop_bb100_mean, v_pop_bb100_std
  FROM _svi_raw;

  IF v_total_eligible = 0 THEN
    UPDATE sv_svi_eligibility SET eligible_hands = 0, eligible_tournaments = 0, svi_score = 0, overall_rank = 0, total_eligible = 0, calculated_at = now();
    DROP TABLE IF EXISTS _svi_raw;
    RETURN;
  END IF;

  IF v_pop_bb100_std = 0 OR v_pop_bb100_std IS NULL THEN
    v_pop_bb100_std := 1.0;
  END IF;

  -- Step 3-6: Compute adjusted BB/100, percentiles, composite, rank, SVI in one pass
  INSERT INTO sv_svi_eligibility (
    user_id, opted_in, eligible_hands, eligible_tournaments,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, svi_score, overall_rank, total_eligible,
    method_version, calculated_at, updated_at
  )
  WITH adjusted AS (
    SELECT
      r.user_id, r.hands, r.bb100, r.abi, r.distinct_tournaments,
      (v_bb100_shrinkage_k * v_pop_bb100_mean + r.hands * r.bb100) / (v_bb100_shrinkage_k + r.hands) AS adjusted_bb100,
      LN(r.abi) AS log_abi
    FROM _svi_raw r
  ),
  percentiled AS (
    SELECT
      a.user_id, a.hands, a.bb100, a.abi, a.distinct_tournaments, a.adjusted_bb100,
      (CUME_DIST() OVER (ORDER BY a.adjusted_bb100)) * 100 AS bb100_percentile,
      (CUME_DIST() OVER (ORDER BY a.log_abi)) * 100 AS abi_percentile
    FROM adjusted a
  ),
  composited AS (
    SELECT
      p.*,
      (p.bb100_percentile * 0.60 + p.abi_percentile * 0.40) AS composite_rating,
      RANK() OVER (ORDER BY (p.bb100_percentile * 0.60 + p.abi_percentile * 0.40) DESC) AS rnk
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
    c.abi_percentile,
    c.bb100_percentile,
    c.composite_rating,
    CASE
      WHEN v_total_eligible = 1 THEN 100.0
      ELSE 1 + 99.0 * (v_total_eligible - c.rnk) / (v_total_eligible - 1)
    END,
    c.rnk,
    v_total_eligible,
    v_method_version,
    now(),
    now()
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
    updated_at = now();

  -- Mark users no longer eligible as unranked
  UPDATE sv_svi_eligibility
  SET eligible_hands = 0, eligible_tournaments = 0, svi_score = 0, overall_rank = 0, total_eligible = 0, calculated_at = now()
  WHERE user_id NOT IN (SELECT user_id FROM _svi_raw);

  -- Upsert users with snapshots but insufficient data (show as unranked)
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
$$;

GRANT EXECUTE ON FUNCTION sv_svi_calculate_all() TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- 4. GET USER SVI DATA
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_get_user(p_user_id text)
RETURNS TABLE (
  user_id text, opted_in boolean, eligible_hands integer,
  eligible_tournaments integer, abi double precision, bb100 double precision,
  adjusted_bb100 double precision, abi_percentile double precision,
  bb100_percentile double precision, composite_rating double precision,
  svi_score double precision, overall_rank integer, total_eligible integer,
  method_version text, calculated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_id, opted_in, eligible_hands, eligible_tournaments,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, svi_score, overall_rank, total_eligible,
    method_version, calculated_at
  FROM sv_svi_eligibility WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION sv_svi_get_user(text) TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- 5. GET LEADERBOARD (opted-in only)
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_get_leaderboard(p_limit int DEFAULT 50, p_offset int DEFAULT 0, p_sort_by text DEFAULT 'svi')
RETURNS TABLE (
  user_id text, svi_score double precision, overall_rank integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  eligible_hands integer, total_eligible integer
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_id, svi_score, overall_rank, abi, bb100, adjusted_bb100, eligible_hands, total_eligible
  FROM sv_svi_eligibility
  WHERE opted_in = true AND eligible_hands > 0
  ORDER BY
    CASE WHEN p_sort_by = 'abi' THEN abi END DESC,
    CASE WHEN p_sort_by = 'bb100' THEN adjusted_bb100 END DESC,
    CASE WHEN p_sort_by NOT IN ('abi', 'bb100') THEN svi_score END DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sv_svi_get_leaderboard(int, int, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- 6. GET HISTORICAL SNAPSHOTS
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_get_snapshots(p_user_id text, p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid, svi_score double precision, overall_rank integer,
  total_eligible integer, abi double precision, bb100 double precision,
  adjusted_bb100 double precision, abi_percentile double precision,
  bb100_percentile double precision, composite_rating double precision,
  method_version text, snapshot_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, svi_score, overall_rank, total_eligible, abi, bb100,
    adjusted_bb100, abi_percentile, bb100_percentile, composite_rating,
    method_version, snapshot_at
  FROM sv_svi_snapshots WHERE user_id = p_user_id
  ORDER BY snapshot_at DESC LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION sv_svi_get_snapshots(text, int) TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- 7. SNAPSHOT CREATION
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_create_snapshot(p_user_id text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO sv_svi_snapshots (
    user_id, svi_score, overall_rank, total_eligible,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, method_version, snapshot_at
  )
  SELECT user_id, svi_score, overall_rank, total_eligible,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, method_version, now()
  FROM sv_svi_eligibility
  WHERE user_id = p_user_id AND eligible_hands > 0;
$$;

GRANT EXECUTE ON FUNCTION sv_svi_create_snapshot(text) TO authenticated;
