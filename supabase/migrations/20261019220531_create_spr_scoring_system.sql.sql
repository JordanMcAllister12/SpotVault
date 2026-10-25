/*
# SpotVault Player Rating (SPR) — Schema & Scoring RPC

## Purpose
Build the database foundation for the adaptive tournament poker player rating system.
SPR evaluates players across five weighted performance categories and produces a global percentile rank.

## New Tables

### `sv_spr_scores`
Per-user SPR calculation result. One row per user per model version.
- `user_id` (uuid, PK)
- `spr_score` (numeric, 0–100)
- `percentile` (numeric, 0–100)
- `qualification_status` (text) — 'official' | 'provisional' | 'unqualified'
- Component scores: `stack_depth_score`, `allin_adjusted_score`, `competition_strength_score`, `itm_score`, `profit_roi_score`
- Raw metrics: `valid_hands`, `tournament_entries`, `verified_abi`, `estimated_pool`, `confidence_level`
- `model_version`, `benchmark_version`, `calculated_at`

### `sv_spr_component_detail`
Per-user per-component breakdown for the expandable UI.
- PK (user_id, component_key)

### `sv_spr_history`
Time-series of SPR scores for tracking progression.

### `sv_spr_benchmark_snapshots`
Versioned population benchmark data for self-learning calibration.

### `sv_spr_competition_pools`
Buy-in tier definitions for competition grouping.

### `sv_spr_weights`
Fixed scoring weights, queryable for UI display.

## RPCs
- `sv_spr_calculate(p_user_id)` — computes SPR from analytics snapshot + hand records
- `sv_spr_get_user(p_user_id)` — returns current SPR with component detail
- `sv_spr_get_weights()` — returns weight configuration
- `sv_spr_get_pool_label(p_pool_key)` — returns pool display label
- `sv_spr_classify_pool(p_abi)` — immutable ABI → pool key mapping

## Security
- RLS on all tables.
- SPR scores publicly readable (leaderboard/display).
- Component detail and history owner-scoped.
- Only SECURITY DEFINER RPCs write scores.
*/

-- ============================================================
-- Competition pool definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_spr_competition_pools (
  pool_key text PRIMARY KEY,
  label text NOT NULL,
  min_abi numeric NOT NULL DEFAULT 0,
  max_abi numeric NOT NULL,
  display_order int NOT NULL DEFAULT 0
);

INSERT INTO sv_spr_competition_pools (pool_key, label, min_abi, max_abi, display_order) VALUES
  ('micro', 'Micro', 0, 5, 1),
  ('low', 'Low', 5, 20, 2),
  ('small', 'Small', 20, 50, 3),
  ('mid', 'Mid', 50, 100, 4),
  ('high', 'High', 100, 250, 5),
  ('elite', 'Elite', 250, 500, 6),
  ('super_high', 'Super High', 500, 999999, 7)
ON CONFLICT (pool_key) DO UPDATE SET
  label = EXCLUDED.label,
  min_abi = EXCLUDED.min_abi,
  max_abi = EXCLUDED.max_abi,
  display_order = EXCLUDED.display_order;

-- ============================================================
-- SPR scores (one row per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_spr_scores (
  user_id uuid PRIMARY KEY,
  spr_score numeric NOT NULL DEFAULT 0,
  percentile numeric NOT NULL DEFAULT 0,
  qualification_status text NOT NULL DEFAULT 'unqualified',
  stack_depth_score numeric NOT NULL DEFAULT 0,
  allin_adjusted_score numeric NOT NULL DEFAULT 0,
  competition_strength_score numeric NOT NULL DEFAULT 0,
  itm_score numeric NOT NULL DEFAULT 0,
  profit_roi_score numeric NOT NULL DEFAULT 0,
  valid_hands int NOT NULL DEFAULT 0,
  tournament_entries int NOT NULL DEFAULT 0,
  verified_abi numeric NOT NULL DEFAULT 0,
  estimated_pool text,
  confidence_level numeric NOT NULL DEFAULT 0,
  model_version text NOT NULL DEFAULT 'spr_v1',
  benchmark_version text,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_spr_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spr_scores_public_read" ON sv_spr_scores;
CREATE POLICY "spr_scores_public_read" ON sv_spr_scores FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- Component detail (per-user per-component)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_spr_component_detail (
  user_id uuid NOT NULL,
  component_key text NOT NULL,
  weight numeric NOT NULL,
  raw_value numeric NOT NULL DEFAULT 0,
  normalized_score numeric NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, component_key)
);

ALTER TABLE sv_spr_component_detail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spr_detail_owner_read" ON sv_spr_component_detail;
CREATE POLICY "spr_detail_owner_read" ON sv_spr_component_detail FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SPR history (time-series)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_spr_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  spr_score numeric NOT NULL DEFAULT 0,
  percentile numeric NOT NULL DEFAULT 0,
  qualification_status text NOT NULL DEFAULT 'unqualified',
  model_version text NOT NULL DEFAULT 'spr_v1',
  benchmark_version text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_spr_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spr_history_owner_read" ON sv_spr_history;
CREATE POLICY "spr_history_owner_read" ON sv_spr_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_spr_history_user ON sv_spr_history(user_id, recorded_at DESC);

-- ============================================================
-- Benchmark snapshots (population calibration)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_spr_benchmark_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  pool text NOT NULL DEFAULT 'global',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualified_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_spr_benchmark_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spr_benchmarks_public_read" ON sv_spr_benchmark_snapshots;
CREATE POLICY "spr_benchmarks_public_read" ON sv_spr_benchmark_snapshots FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- SPR Weights configuration (fixed, queryable)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_spr_weights (
  component_key text PRIMARY KEY,
  weight numeric NOT NULL,
  label text NOT NULL
);

INSERT INTO sv_spr_weights (component_key, weight, label) VALUES
  ('stack_depth', 0.25, 'Stack-Depth BB/100'),
  ('allin_adjusted', 0.20, 'All-In Adjusted BB/100'),
  ('competition_strength', 0.25, 'ABI / Competition Strength'),
  ('itm', 0.10, 'ITM Percentage'),
  ('profit_roi', 0.20, 'Profit + ROI')
ON CONFLICT (component_key) DO UPDATE SET
  weight = EXCLUDED.weight,
  label = EXCLUDED.label;

ALTER TABLE sv_spr_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spr_weights_public_read" ON sv_spr_weights;
CREATE POLICY "spr_weights_public_read" ON sv_spr_weights FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- Helper: classify ABI into competition pool
-- ============================================================
CREATE OR REPLACE FUNCTION sv_spr_classify_pool(p_abi numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pool_key FROM sv_spr_competition_pools
  WHERE p_abi >= min_abi AND p_abi < max_abi
  ORDER BY display_order
  LIMIT 1;
$$;

-- ============================================================
-- SPR calculation RPC (SECURITY DEFINER — server-side computation)
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
  v_stack_depth_score numeric := 50;
  v_allin_score numeric := 50;
  v_competition_score numeric := 50;
  v_itm_score numeric := 50;
  v_profit_roi_score numeric := 50;
  v_spr numeric;
  v_status text := 'unqualified';
  v_confidence numeric := 0;
  v_pool text;
  v_count int;
  v_percentile numeric := 0;
BEGIN
  -- Fetch latest MTT analytics snapshot
  SELECT s.summary INTO v_snapshot
  FROM poker_analytics_snapshots s
  WHERE s.user_id = p_user_id AND s.mode = 'mtt'
  ORDER BY s.calculated_at DESC
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    INSERT INTO sv_spr_scores (user_id, spr_score, percentile, qualification_status,
      stack_depth_score, allin_adjusted_score, competition_strength_score,
      itm_score, profit_roi_score, valid_hands, tournament_entries,
      verified_abi, confidence_level, model_version, calculated_at)
    VALUES (p_user_id, 0, 0, 'unqualified', 0, 0, 0, 0, 0, 0, 0, 0, 0, 'spr_v1', now())
    ON CONFLICT (user_id) DO UPDATE SET
      spr_score = 0, percentile = 0, qualification_status = 'unqualified',
      stack_depth_score = 0, allin_adjusted_score = 0, competition_strength_score = 0,
      itm_score = 0, profit_roi_score = 0, valid_hands = 0, tournament_entries = 0,
      verified_abi = 0, confidence_level = 0, calculated_at = now();
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

  -- Qualification: 10,000 hands AND 100 tournament entries
  IF v_valid_hands >= 10000 AND v_tournament_entries >= 100 THEN
    v_status := 'official';
    v_confidence := LEAST(1.0, (v_valid_hands::numeric / 50000) + 0.3);
  ELSIF v_valid_hands >= 1000 THEN
    v_status := 'provisional';
    v_confidence := LEAST(0.5, v_valid_hands::numeric / 10000);
  ELSE
    v_status := 'unqualified';
    v_confidence := 0;
  END IF;

  -- Component 1: Stack-Depth BB/100 (25%)
  IF v_bb100 IS NOT NULL AND v_bb100 != 0 THEN
    v_stack_depth_score := GREATEST(0, LEAST(100, 50 + (v_bb100 * 4)));
  END IF;

  -- Component 2: All-In Adjusted BB/100 (20%)
  IF v_ev_bb100 IS NOT NULL AND v_ev_bb100 != 0 THEN
    v_allin_score := GREATEST(0, LEAST(100, 50 + (v_ev_bb100 * 4)));
  ELSE
    v_allin_score := GREATEST(0, LEAST(100, 50 + (v_bb100 * 3.6)));
  END IF;

  -- Component 3: Competition Strength / ABI (25%)
  IF v_abi IS NOT NULL AND v_abi > 0 THEN
    v_competition_score := GREATEST(0, LEAST(100, (LN(v_abi) / LN(1000)) * 100));
  END IF;
  v_pool := sv_spr_classify_pool(v_abi);

  -- Component 4: ITM Percentage (10%)
  IF v_itm IS NOT NULL AND v_itm > 0 THEN
    v_itm_score := GREATEST(0, LEAST(100, (v_itm - 5) * 5 + 25));
  END IF;

  -- Component 5: Profit + ROI (20%)
  IF v_roi IS NOT NULL AND v_roi != 0 THEN
    v_profit_roi_score := GREATEST(0, LEAST(100, 50 + (v_roi * 0.4)));
  ELSIF v_profit IS NOT NULL AND v_profit != 0 THEN
    v_profit_roi_score := GREATEST(0, LEAST(100, 50 + (LN(GREATEST(1, v_profit + 1)) / LN(100000)) * 50));
  END IF;

  -- Composite SPR
  v_spr := 0.25 * v_stack_depth_score
         + 0.20 * v_allin_score
         + 0.25 * v_competition_score
         + 0.10 * v_itm_score
         + 0.20 * v_profit_roi_score;
  v_spr := GREATEST(0, LEAST(100, v_spr));

  -- Percentile among qualified players
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
  END IF;

  -- Persist score
  INSERT INTO sv_spr_scores (user_id, spr_score, percentile, qualification_status,
    stack_depth_score, allin_adjusted_score, competition_strength_score,
    itm_score, profit_roi_score, valid_hands, tournament_entries,
    verified_abi, estimated_pool, confidence_level, model_version, calculated_at)
  VALUES (p_user_id, v_spr, v_percentile, v_status,
    v_stack_depth_score, v_allin_score, v_competition_score,
    v_itm_score, v_profit_roi_score, v_valid_hands, v_tournament_entries,
    v_abi, v_pool, v_confidence, 'spr_v1', now())
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
    calculated_at = now();

  -- Persist component detail
  INSERT INTO sv_spr_component_detail (user_id, component_key, weight, raw_value, normalized_score, detail)
  VALUES
    (p_user_id, 'stack_depth', 0.25, v_bb100, v_stack_depth_score,
     jsonb_build_object('label', 'Stack-Depth BB/100', 'raw_label', 'bb/100')),
    (p_user_id, 'allin_adjusted', 0.20, COALESCE(v_ev_bb100, v_bb100), v_allin_score,
     jsonb_build_object('label', 'All-In Adjusted BB/100', 'note',
       CASE WHEN v_ev_bb100 = 0 THEN 'EV data not yet available — using raw bb/100 with uncertainty discount' ELSE NULL END)),
    (p_user_id, 'competition_strength', 0.25, v_abi, v_competition_score,
     jsonb_build_object('label', 'ABI / Competition Strength', 'pool', v_pool)),
    (p_user_id, 'itm', 0.10, v_itm, v_itm_score,
     jsonb_build_object('label', 'ITM Percentage', 'note',
       CASE WHEN v_itm = 0 THEN 'Tournament finish data not yet available — neutral default' ELSE NULL END)),
    (p_user_id, 'profit_roi', 0.20, COALESCE(v_roi, v_profit), v_profit_roi_score,
     jsonb_build_object('label', 'Profit + ROI', 'note',
       CASE WHEN v_roi = 0 THEN 'ROI not yet computed — using profit as proxy' ELSE NULL END))
  ON CONFLICT (user_id, component_key) DO UPDATE SET
    weight = EXCLUDED.weight,
    raw_value = EXCLUDED.raw_value,
    normalized_score = EXCLUDED.normalized_score,
    detail = EXCLUDED.detail;

  -- Record history
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
    'components', jsonb_build_object(
      'stack_depth', v_stack_depth_score,
      'allin_adjusted', v_allin_score,
      'competition_strength', v_competition_score,
      'itm', v_itm_score,
      'profit_roi', v_profit_roi_score
    )
  );
END;
$$;

-- ============================================================
-- Get user SPR (public read RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_spr_get_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score record;
  v_components jsonb;
BEGIN
  SELECT * INTO v_score FROM sv_spr_scores WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'unqualified', 'reason', 'no_data');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', component_key,
    'weight', weight,
    'raw_value', raw_value,
    'score', normalized_score,
    'detail', detail
  )), '[]'::jsonb) INTO v_components
  FROM sv_spr_component_detail
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'status', v_score.qualification_status,
    'spr_score', v_score.spr_score,
    'percentile', v_score.percentile,
    'valid_hands', v_score.valid_hands,
    'tournament_entries', v_score.tournament_entries,
    'verified_abi', v_score.verified_abi,
    'estimated_pool', v_score.estimated_pool,
    'confidence', v_score.confidence_level,
    'model_version', v_score.model_version,
    'calculated_at', v_score.calculated_at,
    'components', v_components
  );
END;
$$;

-- ============================================================
-- Get SPR weights (public)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_spr_get_weights()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'key', component_key,
    'weight', weight,
    'label', label
  ) ORDER BY weight DESC)
  FROM sv_spr_weights;
$$;

-- ============================================================
-- Get competition pool label
-- ============================================================
CREATE OR REPLACE FUNCTION sv_spr_get_pool_label(p_pool_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT label FROM sv_spr_competition_pools WHERE pool_key = $1;
$$;