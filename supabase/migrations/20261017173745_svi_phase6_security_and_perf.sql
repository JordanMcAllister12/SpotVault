/*
# SVI Phase 6: Security hardening — fix mutable search_path + restrict mutation RPCs

## Changes
1. Fix `function_search_path_mutable` warnings on `sv_svi_get_division` and `sv_svi_rank_key`
   by adding `SET search_path = public` to both functions.
2. Revoke EXECUTE on `sv_svi_calculate_all` and `sv_svi_create_snapshot` from the `anon` role
   so unauthenticated users cannot trigger SVI recalculations or snapshots.
   These remain callable by `authenticated` users (the app has sign-in).
3. Add performance indexes on sv_svi_eligibility for the division-ranking queries that
   scan all opted-in users grouped by ABI division.

## Security Impact
- Immutable search_path prevents search-path injection on the two helper functions.
- Revoking anon EXECUTE on mutation RPCs prevents unauthenticated abuse.
*/

-- ── Fix mutable search_path on helper functions ──
DROP FUNCTION IF EXISTS sv_svi_get_division(double precision);
CREATE OR REPLACE FUNCTION sv_svi_get_division(p_abi double precision)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
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

DROP FUNCTION IF EXISTS sv_svi_rank_key(double precision);
CREATE OR REPLACE FUNCTION sv_svi_rank_key(p_pct double precision)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
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

-- ── Revoke anon EXECUTE on mutation RPCs ──
REVOKE EXECUTE ON FUNCTION sv_svi_calculate_all() FROM anon;
REVOKE EXECUTE ON FUNCTION sv_svi_create_snapshot(text) FROM anon;
REVOKE EXECUTE ON FUNCTION sv_svi_evaluate_honors() FROM anon;

-- ── Performance indexes for division leaderboard queries ──
CREATE INDEX IF NOT EXISTS idx_svi_eligibility_opted_in_abi
  ON sv_svi_eligibility (opted_in, abi);

CREATE INDEX IF NOT EXISTS idx_svi_eligibility_opted_in_svi
  ON sv_svi_eligibility (opted_in, svi_score DESC);

CREATE INDEX IF NOT EXISTS idx_svi_snapshots_user_time
  ON sv_svi_snapshots (user_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_svi_honors_user
  ON sv_svi_honors (user_id);
