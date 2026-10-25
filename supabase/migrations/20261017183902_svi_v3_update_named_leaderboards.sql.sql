/*
# SVI V3 — Update _named leaderboard functions to use reveal_completed

The _named variants used opted_in = true as the participation gate.
Per the new spec, participation begins after first voluntary calculation
(reveal_completed = true). Also add username to the return columns.
*/

DROP FUNCTION IF EXISTS public.sv_svi_get_leaderboard_named(integer, integer, text);

CREATE OR REPLACE FUNCTION public.sv_svi_get_leaderboard_named(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'svi'
)
RETURNS TABLE(
  user_id text,
  display_name text,
  avatar_url text,
  privacy_mode text,
  svi_score double precision,
  overall_rank integer,
  abi double precision,
  bb100 double precision,
  adjusted_bb100 double precision,
  eligible_hands integer,
  total_eligible integer,
  bb100_percentile_v2 double precision,
  ev_luck_percentile double precision,
  roi_percentile double precision,
  sample_percentile double precision,
  consistency_percentile double precision,
  final_tables_percentile double precision,
  largest_score_percentile double precision,
  community_percentile double precision,
  factor_detail jsonb,
  division text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  e.user_id,
  CASE WHEN COALESCE(up.privacy_mode, 'public') = 'anonymous' THEN 'Anonymous Player' ELSE COALESCE(up.display_name, 'Player ' || right(e.user_id, 6)) END AS display_name,
  CASE WHEN COALESCE(up.privacy_mode, 'public') = 'anonymous' THEN NULL ELSE up.avatar_url END AS avatar_url,
  COALESCE(up.privacy_mode, 'public') AS privacy_mode,
  e.svi_score, e.overall_rank, e.abi, e.bb100, e.adjusted_bb100,
  e.eligible_hands, e.total_eligible,
  e.bb100_percentile_v2, e.ev_luck_percentile, e.roi_percentile,
  e.sample_percentile, e.consistency_percentile, e.final_tables_percentile,
  e.largest_score_percentile, e.community_percentile, e.factor_detail,
  sv_svi_get_division(e.abi) AS division
FROM sv_svi_eligibility e
LEFT JOIN user_profiles up ON up.user_id = e.user_id
WHERE e.reveal_completed = true AND e.eligible_hands > 0
ORDER BY
  CASE WHEN p_sort_by = 'abi' THEN e.abi END DESC,
  CASE WHEN p_sort_by = 'bb100' THEN e.adjusted_bb100 END DESC,
  CASE WHEN p_sort_by NOT IN ('abi', 'bb100') THEN e.svi_score END DESC
LIMIT p_limit OFFSET p_offset;
$function$;

DROP FUNCTION IF EXISTS public.sv_svi_get_division_leaderboard_named(text, integer, integer);

CREATE OR REPLACE FUNCTION public.sv_svi_get_division_leaderboard_named(
  p_division text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id text,
  display_name text,
  avatar_url text,
  privacy_mode text,
  svi_score double precision,
  overall_rank integer,
  abi double precision,
  bb100 double precision,
  adjusted_bb100 double precision,
  eligible_hands integer,
  total_eligible integer,
  bb100_percentile_v2 double precision,
  ev_luck_percentile double precision,
  roi_percentile double precision,
  sample_percentile double precision,
  consistency_percentile double precision,
  final_tables_percentile double precision,
  largest_score_percentile double precision,
  community_percentile double precision,
  factor_detail jsonb,
  division text,
  division_rank integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH div AS (
  SELECT
    e.*,
    CASE WHEN COALESCE(up.privacy_mode, 'public') = 'anonymous' THEN 'Anonymous Player' ELSE COALESCE(up.display_name, 'Player ' || right(e.user_id, 6)) END AS display_name,
    CASE WHEN COALESCE(up.privacy_mode, 'public') = 'anonymous' THEN NULL ELSE up.avatar_url END AS avatar_url,
    COALESCE(up.privacy_mode, 'public') AS privacy_mode,
    sv_svi_get_division(e.abi) AS division_name,
    RANK() OVER (PARTITION BY sv_svi_get_division(e.abi) ORDER BY e.svi_score DESC) AS div_rank
  FROM sv_svi_eligibility e
  LEFT JOIN user_profiles up ON up.user_id = e.user_id
  WHERE e.reveal_completed = true AND e.eligible_hands > 0
)
SELECT
  user_id, display_name, avatar_url, privacy_mode,
  svi_score, overall_rank, abi, bb100, adjusted_bb100,
  eligible_hands, total_eligible,
  bb100_percentile_v2, ev_luck_percentile, roi_percentile,
  sample_percentile, consistency_percentile, final_tables_percentile,
  largest_score_percentile, community_percentile, factor_detail,
  division_name, div_rank
FROM div
WHERE division_name = p_division
ORDER BY div_rank
LIMIT p_limit OFFSET p_offset;
$function$;

GRANT EXECUTE ON FUNCTION public.sv_svi_get_leaderboard_named(integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_svi_get_division_leaderboard_named(text, integer, integer) TO anon, authenticated;
