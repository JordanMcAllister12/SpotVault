/*
# SVI Recalculation Rules Update — 5-Day Cooldown + 1,000 New Hands

## Purpose
Tighten the recalculation gate from 7 days / 250 hands to 5 days / 1,000 hands
to better reflect meaningful sample-size changes and reduce manipulation surface.

## Changes

### 1. Update default cooldown_hours from 168 → 120 (5 days)
Updates the column default on sv_svi_eval_cooldowns.cooldown_hours so all
NEW cooldown rows get the 5-day default. Existing rows keep their current
value (they were set under the old rule and will expire naturally).

### 2. Update default min_new_hands from 250 → 1000
Updates the column default on sv_svi_eval_cooldowns.min_new_hands so all
NEW cooldown rows require 1,000 new eligible hands. Existing rows keep
their current value.

### 3. Update the fallback defaults in sv_svi_get_evaluation_status
The function constructs a default row with hardcoded 168/250 when no
cooldown row exists yet. Update those to 120/1000 to match.

### 4. Anti-manipulation safeguards (already in place, documented here)
- Hand fingerprints (sv_svi_hand_fingerprints) use a unique index on
  (user_id, hand_fingerprint) so reuploading the same hands never
  increases the new-hands count.
- sv_svi_consume_evaluation atomically checks eligibility, inserts the
  evaluation, updates cooldown, and marks fingerprints as evaluated —
  all in one operation. No race conditions.
- sv_svi_check_recalc_eligibility re-checks cooldown AND new hands at
  call time, not from cached state.

## Security
- No RLS policy changes — existing owner-scoped policies remain correct.
- No new tables or columns — only defaults updated.
*/

-- Update column defaults for new cooldown rows
ALTER TABLE sv_svi_eval_cooldowns
  ALTER COLUMN cooldown_hours SET DEFAULT 120;

ALTER TABLE sv_svi_eval_cooldowns
  ALTER COLUMN min_new_hands SET DEFAULT 1000;

-- Update the fallback defaults inside the evaluation status function
-- The function uses a hardcoded ROW() when no cooldown row exists.
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
    v_cooldown := ROW(p_user_id, NULL, NULL, 0, 120, 1000, false, now());
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
