/*
# SVI Phase 5 fix: resolve ambiguous column references in sv_svi_get_user_rank

The RETURN TABLE column names (svi_score, overall_rank, total_eligible) shadowed
the table columns of the same name in PL/pgSQL, causing "ambiguous column reference"
errors. Fixed by prefixing all column references with the table alias.
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

  RETURN QUERY
  SELECT
    v_div AS division,
    v_div_rank AS division_rank,
    v_div_total AS total_in_division,
    sv_svi_rank_key(v_div_rank::double precision / GREATEST(1, v_div_total)::double precision * 100.0) AS rank_key,
    v_svi,
    v_overall,
    v_total;
END;
$$;
