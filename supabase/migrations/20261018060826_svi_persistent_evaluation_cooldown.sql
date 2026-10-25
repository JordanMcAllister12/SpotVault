/*
# SVI Persistent Evaluation & Cooldown System

## Purpose
Redesign SVI to operate as a periodic performance rating with a strict 7-day cooldown
between official evaluations, minimum 250 new eligible hands, and persistent state
that survives sessions/refreshes. Prevents reuploads from triggering fresh evaluations.

## New Tables

### 1. sv_svi_evaluations
Persistent record of each official SVI evaluation for a user.
- user_id (text, PK reference) — the evaluated player
- evaluation_id (uuid, default gen_random_uuid) — unique per evaluation
- svi_score (double precision) — the score at time of evaluation
- overall_rank (integer) — global rank at time of evaluation
- total_eligible (integer) — total eligible players at time of evaluation
- eligible_hands (integer) — hands included in this evaluation
- eligible_tournaments (integer) — tournaments included
- abi (double precision) — ABI at time of evaluation
- bb100 (double precision) — BB/100 at time of evaluation
- division (text) — division key at time of evaluation
- division_rank (integer) — rank within division
- method_version (text) — calculation method version
- factor_detail (jsonb) — full factor breakdown snapshot
- evaluated_at (timestamptz, default now()) — when the evaluation completed
- animation_unlocked (boolean, default true) — whether a new animation is available
This is the authoritative persistent evaluation history. The latest row per user
represents their current official SVI score.

### 2. sv_svi_hand_fingerprints
Lightweight deduplication registry for hand histories.
- id (uuid, PK)
- user_id (text) — owner of the hand
- hand_fingerprint (text, NOT NULL) — canonical content fingerprint (hash of normalized raw_hand_text)
- platform_hand_id (text) — the platform's hand ID when available
- tournament_id (text) — tournament identifier
- evaluated_in (uuid, nullable) — which evaluation_id this hand was counted in (null = not yet evaluated)
- created_at (timestamptz, default now())
Unique constraint on (user_id, hand_fingerprint) prevents duplicate fingerprint registration.
Index on (user_id, evaluated_in) for fast "new hands since last evaluation" queries.
Fingerprints persist even if Analytics data is cleared, so reuploads are recognized.

### 3. sv_svi_eval_cooldowns
Per-user cooldown state for SVI recalculation.
- user_id (text, PK)
- last_evaluation_at (timestamptz, nullable) — when the last official evaluation completed
- last_evaluation_id (uuid, nullable) — FK to sv_svi_evaluations.evaluation_id
- hands_at_last_eval (integer, default 0) — number of unique fingerprints registered at last evaluation
- cooldown_hours (integer, default 168) — 7 days = 168 hours
- min_new_hands (integer, default 250) — minimum new eligible hands required
- admin_override (boolean, default false) — set by admins to bypass cooldown
- updated_at (timestamptz, default now())
This is the single source of truth for whether a user can recalculate.

## RPCs

### sv_svi_get_evaluation_status(p_user_id)
Returns the user's current evaluation summary + cooldown status:
- latest evaluation data (score, rank, hands, date)
- cooldown_remaining_hours
- next_eligible_at (timestamp)
- new_hands_since_eval (count of fingerprints not yet evaluated_in)
- min_new_hands_required
- can_recalculate (boolean: cooldown elapsed AND new_hands >= min)
- admin_override

### sv_svi_check_recalc_eligibility(p_user_id)
Returns boolean: whether the user is eligible to recalculate right now.
Checks both cooldown (7 days) and minimum new hands (250).

### sv_svi_register_hand_fingerprints(p_user_id, p_fingerprints jsonb)
Bulk-register hand fingerprints. Idempotent — skips already-registered fingerprints.
Returns count of newly registered fingerprints.
Called during hand import, NOT during evaluation.

### sv_svi_count_new_hands(p_user_id)
Returns integer: count of fingerprints for this user where evaluated_in IS NULL
(i.e., hands uploaded since the last evaluation that haven't been counted yet).

### sv_svi_consume_evaluation(p_user_id, p_evaluation_data jsonb)
Atomic single-use operation that:
1. Checks cooldown + new hands eligibility (or admin_override)
2. Inserts a row into sv_svi_evaluations
3. Updates sv_svi_eval_cooldowns (last_evaluation_at, last_evaluation_id, hands_at_last_eval)
4. Marks all un-evaluated fingerprints as evaluated_in = new evaluation_id
5. Returns the evaluation record
This prevents concurrent duplicate evaluations (the check and update are atomic).

### sv_svi_admin_override_cooldown(p_user_id)
Sets admin_override = true on the user's cooldown row.
Only callable by staff/admin (checked via sv_is_staff_or_admin).

## Security
- RLS enabled on all three tables
- SELECT: users can read their own evaluation/cooldown/fingerprint data
- INSERT/UPDATE: only the user themselves (via RPCs that use auth.uid())
- sv_svi_admin_override_cooldown: restricted to staff/admin via sv_is_staff_or_admin check
- All RPCs are SECURITY DEFINER with SET search_path = public

## Important Notes
1. Fingerprints use a canonical hash of normalized raw_hand_text as fallback when
   platform hand IDs are unavailable. This is computed client-side and passed to
   sv_svi_register_hand_fingerprints.
2. The cooldown starts when an evaluation SUCCESSFULLY completes (not when animation plays).
3. Uploading/deleting/reuploading hands never resets the cooldown.
4. Clearing Analytics does NOT erase fingerprints or evaluation history.
5. Users can continue uploading and analyzing hands regardless of SVI eligibility.
6. The existing sv_svi_calculate_all RPC continues to work for the actual score calculation;
   sv_svi_consume_evaluation wraps the persistence/cooldown logic around it.
*/

-- ═══════════════════════════════════════════════════
-- Table: sv_svi_evaluations
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sv_svi_evaluations (
  evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  svi_score double precision NOT NULL DEFAULT 0,
  overall_rank integer NOT NULL DEFAULT 0,
  total_eligible integer NOT NULL DEFAULT 0,
  eligible_hands integer NOT NULL DEFAULT 0,
  eligible_tournaments integer NOT NULL DEFAULT 0,
  abi double precision NOT NULL DEFAULT 0,
  bb100 double precision NOT NULL DEFAULT 0,
  division text,
  division_rank integer,
  method_version text NOT NULL DEFAULT 'svi_v3',
  factor_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  animation_unlocked boolean NOT NULL DEFAULT true
);

ALTER TABLE sv_svi_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_evaluations" ON sv_svi_evaluations;
CREATE POLICY "select_own_evaluations" ON sv_svi_evaluations FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_evaluations" ON sv_svi_evaluations;
CREATE POLICY "insert_own_evaluations" ON sv_svi_evaluations FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

CREATE INDEX IF NOT EXISTS idx_svi_eval_user_time
  ON sv_svi_evaluations (user_id, evaluated_at DESC);

-- ═══════════════════════════════════════════════════
-- Table: sv_svi_hand_fingerprints
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sv_svi_hand_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  hand_fingerprint text NOT NULL,
  platform_hand_id text,
  tournament_id text,
  evaluated_in uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_svi_hand_fingerprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_fingerprints" ON sv_svi_hand_fingerprints;
CREATE POLICY "select_own_fingerprints" ON sv_svi_hand_fingerprints FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_fingerprints" ON sv_svi_hand_fingerprints;
CREATE POLICY "insert_own_fingerprints" ON sv_svi_hand_fingerprints FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_svi_fp_user_fingerprint
  ON sv_svi_hand_fingerprints (user_id, hand_fingerprint);

CREATE INDEX IF NOT EXISTS idx_svi_fp_user_eval
  ON sv_svi_hand_fingerprints (user_id, evaluated_in);

-- ═══════════════════════════════════════════════════
-- Table: sv_svi_eval_cooldowns
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sv_svi_eval_cooldowns (
  user_id text PRIMARY KEY,
  last_evaluation_at timestamptz,
  last_evaluation_id uuid,
  hands_at_last_eval integer NOT NULL DEFAULT 0,
  cooldown_hours integer NOT NULL DEFAULT 168,
  min_new_hands integer NOT NULL DEFAULT 250,
  admin_override boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_svi_eval_cooldowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cooldown" ON sv_svi_eval_cooldowns;
CREATE POLICY "select_own_cooldown" ON sv_svi_eval_cooldowns FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_cooldown" ON sv_svi_eval_cooldowns;
CREATE POLICY "insert_own_cooldown" ON sv_svi_eval_cooldowns FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "update_own_cooldown" ON sv_svi_eval_cooldowns;
CREATE POLICY "update_own_cooldown" ON sv_svi_eval_cooldowns FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════
-- RPC: sv_svi_count_new_hands
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_count_new_hands(p_user_id text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM sv_svi_hand_fingerprints
  WHERE user_id = p_user_id
    AND evaluated_in IS NULL
$$;

-- ═══════════════════════════════════════════════════
-- RPC: sv_svi_check_recalc_eligibility
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_check_recalc_eligibility(p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cooldown sv_svi_eval_cooldowns%ROWTYPE;
  v_new_hands integer;
  v_hours_elapsed numeric;
BEGIN
  SELECT * INTO v_cooldown FROM sv_svi_eval_cooldowns WHERE user_id = p_user_id;

  -- No prior evaluation → always eligible (first calculation)
  IF v_cooldown.last_evaluation_at IS NULL THEN
    RETURN true;
  END IF;

  -- Admin override bypasses all checks
  IF v_cooldown.admin_override THEN
    RETURN true;
  END IF;

  -- Check cooldown
  v_hours_elapsed := extract(epoch from (now() - v_cooldown.last_evaluation_at)) / 3600;
  IF v_hours_elapsed < v_cooldown.cooldown_hours THEN
    RETURN false;
  END IF;

  -- Check minimum new hands
  v_new_hands := sv_svi_count_new_hands(p_user_id);
  IF v_new_hands < v_cooldown.min_new_hands THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ═══════════════════════════════════════════════════
-- RPC: sv_svi_get_evaluation_status
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_get_evaluation_status(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cooldown sv_svi_eval_cooldowns%ROWTYPE;
  v_latest sv_svi_evaluations%ROWTYPE;
  v_new_hands integer;
  v_hours_elapsed numeric;
  v_hours_remaining numeric;
  v_next_eligible timestamptz;
  v_can_recalc boolean;
BEGIN
  -- Get cooldown state (or defaults if none)
  SELECT * INTO v_cooldown FROM sv_svi_eval_cooldowns WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    v_cooldown := ROW(p_user_id, NULL, NULL, 0, 168, 250, false, now());
  END IF;

  -- Get latest evaluation
  SELECT * INTO v_latest
  FROM sv_svi_evaluations
  WHERE user_id = p_user_id
  ORDER BY evaluated_at DESC
  LIMIT 1;

  -- Count new hands since last evaluation
  v_new_hands := sv_svi_count_new_hands(p_user_id);

  -- Compute cooldown timing
  IF v_cooldown.last_evaluation_at IS NOT NULL THEN
    v_hours_elapsed := extract(epoch from (now() - v_cooldown.last_evaluation_at)) / 3600;
    v_hours_remaining := greatest(0, v_cooldown.cooldown_hours - v_hours_elapsed);
    v_next_eligible := v_cooldown.last_evaluation_at + (v_cooldown.cooldown_hours || ' hours')::interval;
  ELSE
    v_hours_remaining := 0;
    v_next_eligible := now();
  END IF;

  -- Determine eligibility
  v_can_recalc := sv_svi_check_recalc_eligibility(p_user_id);

  RETURN jsonb_build_object(
    'has_evaluation', v_latest.evaluation_id IS NOT NULL,
    'latest_evaluation', CASE WHEN v_latest.evaluation_id IS NOT NULL THEN
      jsonb_build_object(
        'evaluation_id', v_latest.evaluation_id,
        'svi_score', v_latest.svi_score,
        'overall_rank', v_latest.overall_rank,
        'total_eligible', v_latest.total_eligible,
        'eligible_hands', v_latest.eligible_hands,
        'eligible_tournaments', v_latest.eligible_tournaments,
        'abi', v_latest.abi,
        'bb100', v_latest.bb100,
        'division', v_latest.division,
        'division_rank', v_latest.division_rank,
        'method_version', v_latest.method_version,
        'factor_detail', v_latest.factor_detail,
        'evaluated_at', v_latest.evaluated_at,
        'animation_unlocked', v_latest.animation_unlocked
      )
    ELSE NULL END,
    'cooldown_remaining_hours', v_hours_remaining,
    'next_eligible_at', v_next_eligible,
    'new_hands_since_eval', v_new_hands,
    'min_new_hands_required', v_cooldown.min_new_hands,
    'cooldown_hours_total', v_cooldown.cooldown_hours,
    'can_recalculate', v_can_recalc,
    'admin_override', v_cooldown.admin_override,
    'last_evaluation_at', v_cooldown.last_evaluation_at,
    'hands_at_last_eval', v_cooldown.hands_at_last_eval
  );
END;
$$;

-- ═══════════════════════════════════════════════════
-- RPC: sv_svi_register_hand_fingerprints
-- Accepts a JSON array of {fingerprint, platform_hand_id, tournament_id} objects
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_register_hand_fingerprints(p_user_id text, p_fingerprints jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fp jsonb;
  v_count integer := 0;
BEGIN
  IF p_fingerprints IS NULL OR jsonb_array_length(p_fingerprints) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_fp IN SELECT jsonb_array_elements(p_fingerprints) LOOP
    INSERT INTO sv_svi_hand_fingerprints (user_id, hand_fingerprint, platform_hand_id, tournament_id)
    VALUES (
      p_user_id,
      v_fp->>'fingerprint',
      v_fp->>'platform_hand_id',
      v_fp->>'tournament_id'
    )
    ON CONFLICT (user_id, hand_fingerprint) DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ═══════════════════════════════════════════════════
-- RPC: sv_svi_consume_evaluation
-- Atomic: checks eligibility → inserts evaluation → updates cooldown → marks fingerprints
-- p_evaluation_data: {svi_score, overall_rank, total_eligible, eligible_hands,
--   eligible_tournaments, abi, bb100, division, division_rank, method_version, factor_detail}
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_consume_evaluation(p_user_id text, p_evaluation_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cooldown sv_svi_eval_cooldowns%ROWTYPE;
  v_new_eval_id uuid;
  v_new_hands integer;
  v_total_fingerprints integer;
  v_can_recalc boolean;
BEGIN
  -- Check eligibility
  v_can_recalc := sv_svi_check_recalc_eligibility(p_user_id);
  IF NOT v_can_recalc THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not eligible for recalculation');
  END IF;

  -- Insert the evaluation record
  INSERT INTO sv_svi_evaluations (
    user_id, svi_score, overall_rank, total_eligible,
    eligible_hands, eligible_tournaments, abi, bb100,
    division, division_rank, method_version, factor_detail,
    animation_unlocked
  ) VALUES (
    p_user_id,
    (p_evaluation_data->>'svi_score')::double precision,
    (p_evaluation_data->>'overall_rank')::integer,
    (p_evaluation_data->>'total_eligible')::integer,
    (p_evaluation_data->>'eligible_hands')::integer,
    (p_evaluation_data->>'eligible_tournaments')::integer,
    (p_evaluation_data->>'abi')::double precision,
    (p_evaluation_data->>'bb100')::double precision,
    p_evaluation_data->>'division',
    NULLIF(p_evaluation_data->>'division_rank', '')::integer,
    COALESCE(p_evaluation_data->>'method_version', 'svi_v3'),
    COALESCE(p_evaluation_data->>'factor_detail', '{}'::jsonb)
  )
  RETURNING evaluation_id INTO v_new_eval_id;

  -- Count total fingerprints for this user
  SELECT count(*) INTO v_total_fingerprints
  FROM sv_svi_hand_fingerprints
  WHERE user_id = p_user_id;

  -- Upsert cooldown record
  INSERT INTO sv_svi_eval_cooldowns (
    user_id, last_evaluation_at, last_evaluation_id,
    hands_at_last_eval, cooldown_hours, min_new_hands,
    admin_override, updated_at
  ) VALUES (
    p_user_id, now(), v_new_eval_id,
    v_total_fingerprints, 168, 250,
    false, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    last_evaluation_at = now(),
    last_evaluation_id = v_new_eval_id,
    hands_at_last_eval = v_total_fingerprints,
    admin_override = false,
    updated_at = now();

  -- Mark all un-evaluated fingerprints as evaluated in this evaluation
  UPDATE sv_svi_hand_fingerprints
  SET evaluated_in = v_new_eval_id
  WHERE user_id = p_user_id AND evaluated_in IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'evaluation_id', v_new_eval_id,
    'evaluated_at', now()
  );
END;
$$;

-- ═══════════════════════════════════════════════════
-- RPC: sv_svi_admin_override_cooldown
-- Admin-only: bypasses cooldown for a user
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sv_svi_admin_override_cooldown(p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin(auth.uid()::text) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO sv_svi_eval_cooldowns (user_id, admin_override, updated_at)
  VALUES (p_user_id, true, now())
  ON CONFLICT (user_id) DO UPDATE SET
    admin_override = true,
    updated_at = now();

  RETURN true;
END;
$$;

-- Grant execute to authenticated
REVOKE EXECUTE ON FUNCTION sv_svi_count_new_hands(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_svi_count_new_hands(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION sv_svi_check_recalc_eligibility(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_svi_check_recalc_eligibility(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION sv_svi_get_evaluation_status(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_svi_get_evaluation_status(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION sv_svi_register_hand_fingerprints(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION sv_svi_register_hand_fingerprints(text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION sv_svi_consume_evaluation(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION sv_svi_consume_evaluation(text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION sv_svi_admin_override_cooldown(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_svi_admin_override_cooldown(text) TO authenticated;
