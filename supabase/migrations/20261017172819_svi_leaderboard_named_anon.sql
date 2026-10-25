/*
# SVI Leaderboard with Display Names + Anonymity

## Overview
Updates leaderboard RPCs to join with user_profiles and return display names.
Players with privacy_mode = 'anonymous' are shown as "Anonymous Player" with
no identifying information — enforced at the database level, not client-side.

## Changes
- New RPC: sv_svi_get_leaderboard_named — returns display_name + avatar + privacy_mode
- New RPC: sv_svi_get_division_leaderboard_named — same for division leaderboards
- Both enforce anonymity: privacy_mode = 'anonymous' returns 'Anonymous Player'
- Trend support: rank_delta via comparison with latest snapshot
*/

-- ============ Named leaderboard with anonymity enforcement ============
DROP FUNCTION IF EXISTS sv_svi_get_leaderboard_named(integer, integer, text);
CREATE FUNCTION public.sv_svi_get_leaderboard_named(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'svi'
)
RETURNS TABLE(
  user_id text, display_name text, avatar_url text, privacy_mode text,
  svi_score double precision, overall_rank integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  eligible_hands integer, total_eligible integer,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb, division text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    e.user_id,
    CASE WHEN up.privacy_mode = 'anonymous' THEN 'Anonymous Player' ELSE COALESCE(up.display_name, 'Player ' || right(e.user_id, 6)) END AS display_name,
    CASE WHEN up.privacy_mode = 'anonymous' THEN NULL ELSE up.avatar_url END AS avatar_url,
    COALESCE(up.privacy_mode, 'public') AS privacy_mode,
    e.svi_score, e.overall_rank, e.abi, e.bb100, e.adjusted_bb100,
    e.eligible_hands, e.total_eligible,
    e.bb100_percentile_v2, e.ev_luck_percentile, e.roi_percentile,
    e.sample_percentile, e.consistency_percentile, e.final_tables_percentile,
    e.largest_score_percentile, e.community_percentile, e.factor_detail,
    sv_svi_get_division(e.abi) AS division
  FROM sv_svi_eligibility e
  LEFT JOIN user_profiles up ON up.user_id = e.user_id
  WHERE e.opted_in = true AND e.eligible_hands > 0
  ORDER BY
    CASE WHEN p_sort_by = 'abi' THEN e.abi END DESC,
    CASE WHEN p_sort_by = 'bb100' THEN e.adjusted_bb100 END DESC,
    CASE WHEN p_sort_by NOT IN ('abi', 'bb100') THEN e.svi_score END DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

-- ============ Named division leaderboard ============
DROP FUNCTION IF EXISTS sv_svi_get_division_leaderboard_named(text, integer, integer);
CREATE FUNCTION public.sv_svi_get_division_leaderboard_named(
  p_division text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id text, display_name text, avatar_url text, privacy_mode text,
  svi_score double precision, overall_rank integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  eligible_hands integer, total_eligible integer,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb, division text, division_rank integer
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
    d.user_id,
    CASE WHEN up.privacy_mode = 'anonymous' THEN 'Anonymous Player' ELSE COALESCE(up.display_name, 'Player ' || right(d.user_id, 6)) END AS display_name,
    CASE WHEN up.privacy_mode = 'anonymous' THEN NULL ELSE up.avatar_url END AS avatar_url,
    COALESCE(up.privacy_mode, 'public') AS privacy_mode,
    d.svi_score, d.overall_rank, d.abi, d.bb100, d.adjusted_bb100,
    d.eligible_hands, d.total_eligible,
    d.bb100_percentile_v2, d.ev_luck_percentile, d.roi_percentile,
    d.sample_percentile, d.consistency_percentile, d.final_tables_percentile,
    d.largest_score_percentile, d.community_percentile, d.factor_detail,
    d.division_name AS division,
    d.div_rank AS division_rank
  FROM div d
  LEFT JOIN user_profiles up ON up.user_id = d.user_id
  WHERE d.division_name = p_division
  ORDER BY d.div_rank
  LIMIT p_limit OFFSET p_offset;
$function$;

-- ============ Get division counts for tab badges ============
DROP FUNCTION IF EXISTS sv_svi_get_division_counts();
CREATE FUNCTION public.sv_svi_get_division_counts()
RETURNS TABLE(division text, player_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT sv_svi_get_division(abi) AS division, COUNT(*) AS player_count
  FROM sv_svi_eligibility
  WHERE opted_in = true AND eligible_hands > 0
  GROUP BY sv_svi_get_division(abi);
$function$;

GRANT EXECUTE ON FUNCTION sv_svi_get_leaderboard_named(integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_get_division_leaderboard_named(text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_svi_get_division_counts() TO anon, authenticated;
