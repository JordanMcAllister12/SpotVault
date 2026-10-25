/*
# SVI Phase 5 fix: correct rank percentile formula

The rank_key was computed as (rank / total * 100), which gives 100% for
rank 1 of 1 — making the only player in a division a Lieutenant instead of
Commander. Fixed to use CDF-style: (rank - 1) / GREATEST(1, total - 1) * 100,
so rank 1 → 0th percentile (top) → Commander, and last rank → 100th → Lieutenant.
*/

DROP FUNCTION IF EXISTS sv_svi_get_user_rank(text);
CREATE OR REPLACE FUNCTION sv_svi_get_user_rank(p_user_id text)
RETURNS TABLE (
  division text,
  division_rank integer,
  total_in_division integer,
  rank_key text,
  svi_score double precision,
  overall_rank integer,
  total_eligible integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abi double precision;
  v_div text;
  v_svi double precision;
  v_overall integer;
  v_total integer;
  v_div_rank integer;
  v_div_total integer;
  v_pct double precision;
BEGIN
  SELECT e.abi, e.svi_score, e.overall_rank, e.total_eligible
    INTO v_abi, v_svi, v_overall, v_total
  FROM sv_svi_eligibility e
  WHERE e.user_id = p_user_id AND e.opted_in = true;

  IF v_abi IS NULL THEN
    RETURN;
  END IF;

  v_div := sv_svi_get_division(v_abi);

  SELECT COUNT(*) + 1 INTO v_div_rank
  FROM sv_svi_eligibility e
  WHERE e.opted_in = true
    AND sv_svi_get_division(e.abi) = v_div
    AND e.svi_score > v_svi;

  SELECT COUNT(*) INTO v_div_total
  FROM sv_svi_eligibility e
  WHERE e.opted_in = true
    AND sv_svi_get_division(e.abi) = v_div;

  v_pct := (v_div_rank - 1)::double precision / GREATEST(1, v_div_total - 1)::double precision * 100.0;

  RETURN QUERY
  SELECT
    v_div AS division,
    v_div_rank AS division_rank,
    v_div_total AS total_in_division,
    sv_svi_rank_key(v_pct) AS rank_key,
    v_svi,
    v_overall,
    v_total;
END;
$$;
