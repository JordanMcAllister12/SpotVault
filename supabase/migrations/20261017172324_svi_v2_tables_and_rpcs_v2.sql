/*
# SVI v2 — Create tables and supporting RPCs (fix: DROP functions before recreating)
*/

-- ============ Weight configuration table ============
CREATE TABLE IF NOT EXISTS sv_svi_weights (
  factor_key text PRIMARY KEY,
  weight double precision NOT NULL DEFAULT 0,
  label text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 99,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sv_svi_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_weights" ON sv_svi_weights;
CREATE POLICY "anon_read_weights" ON sv_svi_weights FOR SELECT
  TO anon, authenticated USING (true);

INSERT INTO sv_svi_weights (factor_key, weight, label, description, display_order) VALUES
  ('bb100_percentile',     0.25, 'Raw BB/100',      'Percentile rank of chip BB/100 across eligible players', 1),
  ('ev_luck_percentile',   0.20, 'EV / Luck',       'How much of BB/100 is skill vs all-in luck', 2),
  ('abi_percentile',       0.20, 'Stake Level',     'Log-normalized Average Buy-In percentile', 3),
  ('roi_percentile',       0.12, 'Tournament ROI',  'Return on investment across tournaments', 4),
  ('sample_percentile',    0.08, 'Sample Size',     'Adequacy of hand sample beyond the minimum', 5),
  ('consistency_percentile',0.06, 'Consistency',    'Low variance in per-tournament BB/100', 6),
  ('final_tables_percentile',0.04, 'Final Tables',  'Frequency of deep tournament runs', 7),
  ('largest_score_percentile',0.03, 'Largest Score','Single largest cash relative to peers', 8),
  ('community_percentile', 0.02, 'Community',       'Engagement in SpotVault community features', 9),
  ('reserve_percentile',   0.00, 'Reserve',         'Reserved for future factors', 10)
ON CONFLICT (factor_key) DO UPDATE SET
  weight = EXCLUDED.weight,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ============ Per-user factor detail table ============
CREATE TABLE IF NOT EXISTS sv_svi_factors (
  user_id text NOT NULL,
  factor_key text NOT NULL,
  raw_value double precision DEFAULT 0,
  percentile double precision DEFAULT 0,
  detail jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, factor_key)
);

ALTER TABLE sv_svi_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_factors" ON sv_svi_factors;
CREATE POLICY "select_own_factors" ON sv_svi_factors FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

-- ============ Add factor columns to eligibility table ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'bb100_percentile_v2') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN bb100_percentile_v2 double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'ev_luck_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN ev_luck_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'roi_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN roi_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'sample_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN sample_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'consistency_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN consistency_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'final_tables_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN final_tables_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'largest_score_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN largest_score_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'community_percentile') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN community_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_eligibility' AND column_name = 'factor_detail') THEN
    ALTER TABLE sv_svi_eligibility ADD COLUMN factor_detail jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============ Add factor columns to snapshots table ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'bb100_percentile_v2') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN bb100_percentile_v2 double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'ev_luck_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN ev_luck_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'roi_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN roi_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'sample_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN sample_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'consistency_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN consistency_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'final_tables_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN final_tables_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'largest_score_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN largest_score_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'community_percentile') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN community_percentile double precision DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_svi_snapshots' AND column_name = 'factor_detail') THEN
    ALTER TABLE sv_svi_snapshots ADD COLUMN factor_detail jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============ Drop and recreate functions with new signatures ============
DROP FUNCTION IF EXISTS sv_svi_get_user(text);
DROP FUNCTION IF EXISTS sv_svi_get_leaderboard(integer, integer, text);
DROP FUNCTION IF EXISTS sv_svi_create_snapshot(text);

CREATE FUNCTION public.sv_svi_get_user(p_user_id text)
RETURNS TABLE(
  user_id text, opted_in boolean, eligible_hands integer, eligible_tournaments integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  abi_percentile double precision, bb100_percentile double precision,
  composite_rating double precision, svi_score double precision,
  overall_rank integer, total_eligible integer, method_version text, calculated_at timestamptz,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id, opted_in, eligible_hands, eligible_tournaments,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, svi_score, overall_rank, total_eligible,
    method_version, calculated_at,
    bb100_percentile_v2, ev_luck_percentile, roi_percentile,
    sample_percentile, consistency_percentile, final_tables_percentile,
    largest_score_percentile, community_percentile, factor_detail
  FROM sv_svi_eligibility WHERE user_id = p_user_id;
$function$;

CREATE FUNCTION public.sv_svi_get_leaderboard(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'svi'
)
RETURNS TABLE(
  user_id text, svi_score double precision, overall_rank integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  eligible_hands integer, total_eligible integer,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id, svi_score, overall_rank, abi, bb100, adjusted_bb100,
    eligible_hands, total_eligible,
    bb100_percentile_v2, ev_luck_percentile, roi_percentile,
    sample_percentile, consistency_percentile, final_tables_percentile,
    largest_score_percentile, community_percentile, factor_detail
  FROM sv_svi_eligibility
  WHERE opted_in = true AND eligible_hands > 0
  ORDER BY
    CASE WHEN p_sort_by = 'abi' THEN abi END DESC,
    CASE WHEN p_sort_by = 'bb100' THEN adjusted_bb100 END DESC,
    CASE WHEN p_sort_by NOT IN ('abi', 'bb100') THEN svi_score END DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

CREATE FUNCTION public.sv_svi_create_snapshot(p_user_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  INSERT INTO sv_svi_snapshots (
    user_id, svi_score, overall_rank, total_eligible,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, method_version, snapshot_at,
    bb100_percentile_v2, ev_luck_percentile, roi_percentile,
    sample_percentile, consistency_percentile, final_tables_percentile,
    largest_score_percentile, community_percentile, factor_detail
  )
  SELECT user_id, svi_score, overall_rank, total_eligible,
    abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
    composite_rating, method_version, now(),
    bb100_percentile_v2, ev_luck_percentile, roi_percentile,
    sample_percentile, consistency_percentile, final_tables_percentile,
    largest_score_percentile, community_percentile, factor_detail
  FROM sv_svi_eligibility
  WHERE user_id = p_user_id AND eligible_hands > 0;
$function$;

-- ============ New RPC: get weight configuration ============
CREATE OR REPLACE FUNCTION public.sv_svi_get_weights()
RETURNS TABLE(factor_key text, weight double precision, label text, description text, display_order int)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT factor_key, weight, label, description, display_order
  FROM sv_svi_weights
  ORDER BY display_order;
$function$;

-- ============ New RPC: get division for ABI ============
CREATE OR REPLACE FUNCTION public.sv_svi_get_division(p_abi double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_abi < 5 THEN 'recruit'
    WHEN p_abi < 10 THEN 'bronze'
    WHEN p_abi < 20 THEN 'silver'
    WHEN p_abi < 40 THEN 'gold'
    WHEN p_abi < 60 THEN 'platinum'
    WHEN p_abi < 80 THEN 'emerald'
    WHEN p_abi < 100 THEN 'sapphire'
    WHEN p_abi < 200 THEN 'ruby'
    WHEN p_abi < 500 THEN 'diamond'
    ELSE 'onyx'
  END;
$function$;

-- ============ New RPC: leaderboard by division ============
CREATE OR REPLACE FUNCTION public.sv_svi_get_division_leaderboard(
  p_division text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id text, svi_score double precision, overall_rank integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  eligible_hands integer, total_eligible integer,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb, division_rank integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH div AS (
    SELECT
      e.*,
      sv_svi_get_division(e.abi) AS division_name,
      RANK() OVER (PARTITION BY sv_svi_get_division(e.abi) ORDER BY e.svi_score DESC) AS div_rank
    FROM sv_svi_eligibility e
    WHERE e.opted_in = true AND e.eligible_hands > 0
  )
  SELECT
    user_id, svi_score, overall_rank, abi, bb100, adjusted_bb100,
    eligible_hands, total_eligible,
    bb100_percentile_v2, ev_luck_percentile, roi_percentile,
    sample_percentile, consistency_percentile, final_tables_percentile,
    largest_score_percentile, community_percentile, factor_detail,
    div_rank
  FROM div
  WHERE division_name = p_division
  ORDER BY div_rank
  LIMIT p_limit OFFSET p_offset;
$function$;

GRANT EXECUTE ON FUNCTION sv_svi_get_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_get_leaderboard(integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_create_snapshot(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_get_weights() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_get_division(double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_get_division_leaderboard(text, integer, integer) TO anon, authenticated;
