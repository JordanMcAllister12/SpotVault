/*
# SVI V3 — Reveal State, Score Concealment, Factor Rankings

## Summary
Adds server-side reveal state tracking, conceals SVI score before first reveal,
adds individual factor ranking RPC, and exposes privacy_mode through the user
SVI query. Replaces the old opt-out model with an anonymous-display model.

## Changes

### 1. New column: sv_svi_eligibility.reveal_completed
- boolean, default false
- Tracks whether the player has completed the cinematic SVI reveal experience
- Score is concealed until this is true

### 2. Existing opted_in users stay opted_in
- All existing users who have a score get opted_in=true

### 3. New function: sv_svi_reveal_score
- Sets reveal_completed = true for a user
- Returns the full SVI user data row with reveal_completed

### 4. Modified function: sv_svi_get_user (return type changes)
- When reveal_completed = false AND svi_score > 0, returns svi_score = 0 and
  overall_rank = 0 in the result set, concealing the score
- Now returns reveal_completed boolean column

### 5. New function: sv_svi_get_factor_rank
- Returns the player's rank and total eligible count for a single factor

### 6. Reset: Set reveal_completed = false for all existing users

### Security
- Functions are SECURITY DEFINER, callable by anon and authenticated
*/

-- 1. Add reveal_completed column
ALTER TABLE sv_svi_eligibility
  ADD COLUMN IF NOT EXISTS reveal_completed boolean NOT NULL DEFAULT false;

-- 2. Ensure existing scored users stay opted_in
UPDATE sv_svi_eligibility
SET opted_in = true
WHERE eligible_hands > 0 AND svi_score > 0;

-- 3. Reset reveal state for all users (one-time)
UPDATE sv_svi_eligibility
SET reveal_completed = false;

-- 4. Drop old sv_svi_get_user to change return type
DROP FUNCTION IF EXISTS public.sv_svi_get_user(text);

-- 5. Recreate sv_svi_get_user with reveal_completed column and score concealment
CREATE OR REPLACE FUNCTION public.sv_svi_get_user(p_user_id text)
RETURNS TABLE(
  user_id text, opted_in boolean, eligible_hands integer, eligible_tournaments integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  abi_percentile double precision, bb100_percentile double precision,
  composite_rating double precision, svi_score double precision, overall_rank integer,
  total_eligible integer, method_version text, calculated_at timestamptz,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb, reveal_completed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id, opted_in, eligible_hands, eligible_tournaments,
  abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
  composite_rating,
  CASE WHEN reveal_completed THEN svi_score ELSE 0 END,
  CASE WHEN reveal_completed THEN overall_rank ELSE 0 END,
  total_eligible,
  method_version, calculated_at,
  bb100_percentile_v2, ev_luck_percentile, roi_percentile,
  sample_percentile, consistency_percentile, final_tables_percentile,
  largest_score_percentile, community_percentile, factor_detail,
  reveal_completed
  FROM sv_svi_eligibility WHERE user_id = p_user_id;
$function$;

-- 6. New function: sv_svi_reveal_score
CREATE OR REPLACE FUNCTION public.sv_svi_reveal_score(p_user_id text)
RETURNS TABLE(
  user_id text, opted_in boolean, eligible_hands integer, eligible_tournaments integer,
  abi double precision, bb100 double precision, adjusted_bb100 double precision,
  abi_percentile double precision, bb100_percentile double precision,
  composite_rating double precision, svi_score double precision, overall_rank integer,
  total_eligible integer, method_version text, calculated_at timestamptz,
  bb100_percentile_v2 double precision, ev_luck_percentile double precision,
  roi_percentile double precision, sample_percentile double precision,
  consistency_percentile double precision, final_tables_percentile double precision,
  largest_score_percentile double precision, community_percentile double precision,
  factor_detail jsonb, reveal_completed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE sv_svi_eligibility
  SET reveal_completed = true, updated_at = now()
  WHERE user_id = p_user_id;

  SELECT user_id, opted_in, eligible_hands, eligible_tournaments,
  abi, bb100, adjusted_bb100, abi_percentile, bb100_percentile,
  composite_rating, svi_score, overall_rank, total_eligible,
  method_version, calculated_at,
  bb100_percentile_v2, ev_luck_percentile, roi_percentile,
  sample_percentile, consistency_percentile, final_tables_percentile,
  largest_score_percentile, community_percentile, factor_detail,
  reveal_completed
  FROM sv_svi_eligibility WHERE user_id = p_user_id;
$function$;

-- 7. New function: sv_svi_get_factor_rank
CREATE OR REPLACE FUNCTION public.sv_svi_get_factor_rank(p_user_id text, p_factor_key text)
RETURNS TABLE(rank integer, total integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT
      user_id,
      CASE p_factor_key
        WHEN 'bb100_percentile' THEN bb100_percentile_v2
        WHEN 'ev_luck_percentile' THEN ev_luck_percentile
        WHEN 'abi_percentile' THEN abi_percentile
        WHEN 'roi_percentile' THEN roi_percentile
        WHEN 'sample_percentile' THEN sample_percentile
        WHEN 'consistency_percentile' THEN consistency_percentile
        WHEN 'final_tables_percentile' THEN final_tables_percentile
        WHEN 'largest_score_percentile' THEN largest_score_percentile
        WHEN 'community_percentile' THEN community_percentile
        ELSE 0
      END AS factor_value,
      RANK() OVER (ORDER BY
        CASE p_factor_key
          WHEN 'bb100_percentile' THEN bb100_percentile_v2
          WHEN 'ev_luck_percentile' THEN ev_luck_percentile
          WHEN 'abi_percentile' THEN abi_percentile
          WHEN 'roi_percentile' THEN roi_percentile
          WHEN 'sample_percentile' THEN sample_percentile
          WHEN 'consistency_percentile' THEN consistency_percentile
          WHEN 'final_tables_percentile' THEN final_tables_percentile
          WHEN 'largest_score_percentile' THEN largest_score_percentile
          WHEN 'community_percentile' THEN community_percentile
          ELSE 0
        END DESC
      ) AS rnk
    FROM sv_svi_eligibility
    WHERE eligible_hands > 0
  )
  SELECT
    COALESCE((SELECT rnk FROM ranked WHERE user_id = p_user_id), 0)::integer AS rank,
    COUNT(*)::integer AS total
  FROM ranked;
$function$;

-- Grant execute on all functions
GRANT EXECUTE ON FUNCTION public.sv_svi_get_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_svi_reveal_score(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_svi_get_factor_rank(text, text) TO anon, authenticated;
