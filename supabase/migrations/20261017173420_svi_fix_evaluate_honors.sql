/*
# SVI Phase 5 fix: correct division_commander threshold in evaluate_honors

The division_commander check used CEIL(total * 0.01) which returns 0 for small
divisions (total < 100), never awarding the honor. Fixed to use rank_key
function so commander = top 1% CDF percentile, same as sv_svi_get_user_rank.
*/

DROP FUNCTION IF EXISTS sv_svi_evaluate_honors();
CREATE OR REPLACE FUNCTION sv_svi_evaluate_honors()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_awards integer := 0;
  v_user text;
  v_abi double precision;
  v_div text;
  v_div_rank integer;
  v_div_total integer;
  v_overall_rank integer;
  v_total_eligible integer;
  v_snap_count integer;
  v_top1_days integer;
  v_top10pct_days integer;
  v_div1_days integer;
  v_rank_key text;
  v_pct double precision;
BEGIN
  FOR v_user IN
    SELECT user_id FROM sv_svi_eligibility WHERE opted_in = true
  LOOP
    SELECT e.abi INTO v_abi FROM sv_svi_eligibility e WHERE e.user_id = v_user;
    v_div := sv_svi_get_division(v_abi);

    SELECT COUNT(*) + 1 INTO v_div_rank
    FROM sv_svi_eligibility e
    WHERE e.opted_in = true
      AND sv_svi_get_division(e.abi) = v_div
      AND e.svi_score > (SELECT e2.svi_score FROM sv_svi_eligibility e2 WHERE e2.user_id = v_user);

    SELECT COUNT(*) INTO v_div_total
    FROM sv_svi_eligibility e
    WHERE e.opted_in = true
      AND sv_svi_get_division(e.abi) = v_div;

    SELECT e.overall_rank, e.total_eligible INTO v_overall_rank, v_total_eligible
    FROM sv_svi_eligibility e WHERE e.user_id = v_user;

    v_pct := (v_div_rank - 1)::double precision / GREATEST(1, v_div_total - 1)::double precision * 100.0;
    v_rank_key := sv_svi_rank_key(v_pct);

    -- ── Division Commander: current rank is commander (top 1%) ──
    IF v_rank_key = 'commander' THEN
      INSERT INTO sv_svi_honors (user_id, honor_key)
      VALUES (v_user, 'division_commander')
      ON CONFLICT (user_id, honor_key) DO NOTHING;
      GET DIAGNOSTICS v_new_awards = ROW_COUNT;
    END IF;

    -- ── Snapshot-based honors ──
    SELECT COUNT(*) INTO v_snap_count
    FROM sv_svi_snapshots WHERE user_id = v_user;

    IF v_snap_count >= 7 THEN
      -- Division Vanguard: #1 in division for last 7 snapshots
      SELECT COUNT(*) INTO v_div1_days
      FROM sv_svi_snapshots s
      WHERE s.user_id = v_user
        AND s.overall_rank = 1
        AND s.snapshot_at IN (
          SELECT snapshot_at FROM sv_svi_snapshots
          WHERE user_id = v_user
          ORDER BY snapshot_at DESC LIMIT 7
        );

      IF v_div1_days >= 7 THEN
        INSERT INTO sv_svi_honors (user_id, honor_key)
        VALUES (v_user, 'division_vanguard')
        ON CONFLICT (user_id, honor_key) DO NOTHING;
        v_new_awards := v_new_awards + ROW_COUNT;
      END IF;

      -- Global Vanguard: #1 globally for last 7 snapshots
      SELECT COUNT(*) INTO v_top1_days
      FROM sv_svi_snapshots s
      WHERE s.user_id = v_user
        AND s.overall_rank = 1
        AND s.snapshot_at IN (
          SELECT snapshot_at FROM sv_svi_snapshots
          WHERE user_id = v_user
          ORDER BY snapshot_at DESC LIMIT 7
        );

      IF v_top1_days >= 7 THEN
        INSERT INTO sv_svi_honors (user_id, honor_key)
        VALUES (v_user, 'global_vanguard')
        ON CONFLICT (user_id, honor_key) DO NOTHING;
        v_new_awards := v_new_awards + ROW_COUNT;
      END IF;
    END IF;

    -- Elite Veteran: top 10% globally for last 30 snapshots
    IF v_snap_count >= 30 AND v_total_eligible > 0 THEN
      SELECT COUNT(*) INTO v_top10pct_days
      FROM sv_svi_snapshots s
      WHERE s.user_id = v_user
        AND s.overall_rank <= GREATEST(1, CEIL(s.total_eligible::numeric * 0.10))
        AND s.snapshot_at IN (
          SELECT snapshot_at FROM sv_svi_snapshots
          WHERE user_id = v_user
          ORDER BY snapshot_at DESC LIMIT 30
        );

      IF v_top10pct_days >= 30 THEN
        INSERT INTO sv_svi_honors (user_id, honor_key)
        VALUES (v_user, 'elite_veteran')
        ON CONFLICT (user_id, honor_key) DO NOTHING;
        v_new_awards := v_new_awards + ROW_COUNT;
      END IF;
    END IF;
  END LOOP;

  RETURN v_new_awards;
END;
$$;
