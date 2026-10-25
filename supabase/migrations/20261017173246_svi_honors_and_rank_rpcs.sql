/*
# SVI Phase 5: Honors Table + Rank & Honor RPCs

## Purpose
Adds the earned-honors tracking table and server-side RPCs to:
1. Evaluate and award honors based on snapshot history (consecutive #1 streaks, top-10% streaks, commander rank achievement).
2. Retrieve a user's earned honors.
3. Retrieve a user's military rank within their ABI division (division, division_rank, total_in_division, rank_key).

## New Tables
- `sv_svi_honors` — records each earned honor per user.
  - `id` (uuid PK)
  - `user_id` (text, not null) — references the player's account
  - `honor_key` (text, not null) — one of: division_vanguard, division_commander, elite_veteran, global_vanguard
  - `awarded_at` (timestamptz, default now())
  - Unique constraint on (user_id, honor_key) so each honor is awarded once.

## New RPCs (SECURITY DEFINER)
- `sv_svi_evaluate_honors()` — scans all opted-in users' snapshot history and awards any newly-earned honors. Returns count of new awards. Safe to call repeatedly.
- `sv_svi_get_honors(p_user_id text)` — returns honors for a single user.
- `sv_svi_get_user_rank(p_user_id text)` — returns the user's division, division_rank, total_in_division, and computed rank_key (commander/general/colonel/major/captain/lieutenant).

## Security
- RLS enabled on `sv_svi_honors` with anon+authenticated SELECT (honors are public accolades).
- INSERT/UPDATE/DELETE restricted to the SECURITY DEFINER RPC (no direct user writes).
- All RPCs are SECURITY DEFINER so they can read sv_svi_eligibility and sv_svi_snapshots regardless of caller.
*/

-- ── Honors table ──
CREATE TABLE IF NOT EXISTS sv_svi_honors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  honor_key text NOT NULL CHECK (honor_key IN ('division_vanguard','division_commander','elite_veteran','global_vanguard')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, honor_key)
);

ALTER TABLE sv_svi_honors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_honors" ON sv_svi_honors;
CREATE POLICY "anon_read_honors" ON sv_svi_honors FOR SELECT
  TO anon, authenticated USING (true);

-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER RPC writes.

-- ── Helper: compute rank key from percentile ──
CREATE OR REPLACE FUNCTION sv_svi_rank_key(p_pct double precision)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_pct <= 1  THEN 'commander'
    WHEN p_pct <= 5  THEN 'general'
    WHEN p_pct <= 15 THEN 'colonel'
    WHEN p_pct <= 30 THEN 'major'
    WHEN p_pct <= 50 THEN 'captain'
    ELSE 'lieutenant'
  END;
$$;

-- ── RPC: Get user's rank within their division ──
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
BEGIN
  -- Get the user's current SVI data
  SELECT abi, svi_score, overall_rank, total_eligible
    INTO v_abi, v_svi, v_overall, v_total
  FROM sv_svi_eligibility
  WHERE user_id = p_user_id AND opted_in = true;

  IF v_abi IS NULL THEN
    RETURN;
  END IF;

  v_div := sv_svi_get_division(v_abi);

  RETURN QUERY
  SELECT
    v_div AS division,
    (SELECT COUNT(*) + 1 FROM sv_svi_eligibility e
       WHERE e.opted_in = true
         AND sv_svi_get_division(e.abi) = v_div
         AND e.svi_score > v_svi) AS division_rank,
    (SELECT COUNT(*) FROM sv_svi_eligibility e
       WHERE e.opted_in = true
         AND sv_svi_get_division(e.abi) = v_div) AS total_in_division,
    sv_svi_rank_key(
      (SELECT COUNT(*) + 1 FROM sv_svi_eligibility e
         WHERE e.opted_in = true
           AND sv_svi_get_division(e.abi) = v_div
           AND e.svi_score > v_svi)::double precision /
      GREATEST(1, (SELECT COUNT(*) FROM sv_svi_eligibility e
         WHERE e.opted_in = true
           AND sv_svi_get_division(e.abi) = v_div))::double precision * 100.0
    ) AS rank_key,
    v_svi AS svi_score,
    v_overall AS overall_rank,
    v_total AS total_eligible;
END;
$$;

-- ── RPC: Get honors for a user ──
DROP FUNCTION IF EXISTS sv_svi_get_honors(text);
CREATE OR REPLACE FUNCTION sv_svi_get_honors(p_user_id text)
RETURNS TABLE (
  honor_key text,
  awarded_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT h.honor_key, h.awarded_at
  FROM sv_svi_honors h
  WHERE h.user_id = p_user_id
  ORDER BY h.awarded_at DESC;
END;
$$;

-- ── RPC: Evaluate and award honors for all opted-in users ──
DROP FUNCTION IF EXISTS sv_svi_evaluate_honors();
CREATE OR REPLACE FUNCTION sv_svi_evaluate_honors()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_awards integer := 0;
  v_user text;
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
BEGIN
  -- Iterate over all opted-in users
  FOR v_user IN
    SELECT user_id FROM sv_svi_eligibility WHERE opted_in = true
  LOOP
    -- Current rank info
    SELECT abi INTO v_div FROM sv_svi_eligibility WHERE user_id = v_user;
    v_div := sv_svi_get_division(v_div);

    SELECT COUNT(*) + 1 INTO v_div_rank
    FROM sv_svi_eligibility e
    WHERE e.opted_in = true
      AND sv_svi_get_division(e.abi) = v_div
      AND e.svi_score > (SELECT svi_score FROM sv_svi_eligibility WHERE user_id = v_user);

    SELECT COUNT(*) INTO v_div_total
    FROM sv_svi_eligibility e
    WHERE e.opted_in = true
      AND sv_svi_get_division(e.abi) = v_div;

    SELECT overall_rank, total_eligible INTO v_overall_rank, v_total_eligible
    FROM sv_svi_eligibility WHERE user_id = v_user;

    -- ── Division Commander: current rank is commander (top 1% of division) ──
    IF v_div_total > 0 AND v_div_rank <= GREATEST(1, CEIL(v_div_total::numeric * 0.01)) THEN
      INSERT INTO sv_svi_honors (user_id, honor_key)
      VALUES (v_user, 'division_commander')
      ON CONFLICT (user_id, honor_key) DO NOTHING;
      GET DIAGNOSTICS v_new_awards = ROW_COUNT;
    END IF;

    -- ── Snapshot-based honors: check consecutive days at #1 or top 10% ──
    -- Division Vanguard: #1 in division for 7+ consecutive snapshot days
    SELECT COUNT(*) INTO v_snap_count
    FROM sv_svi_snapshots
    WHERE user_id = v_user;

    IF v_snap_count >= 7 THEN
      -- Check if user was #1 in their division for the last 7+ snapshots
      SELECT COUNT(*) INTO v_div1_days
      FROM sv_svi_snapshots s
      WHERE s.user_id = v_user
        AND s.overall_rank = 1
        AND s.snapshot_at >= now() - interval '60 days'
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

      -- Global Vanguard: #1 globally for 7+ consecutive snapshots
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

    -- Elite Veteran: top 10% globally for 30+ consecutive snapshot days
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
