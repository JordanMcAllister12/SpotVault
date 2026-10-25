/*
# Automated Membership Gate Lifecycle

## Overview
Extends the four-gate membership system (Player/Core/Pro/Elite) with automatic
subscription lifecycle management driven by Stripe webhook events and scheduled
reconciliation — not user logins or admin console access.

## New Tables
### `membership_lifecycle_audit`
Immutable audit log of every membership change. Has a unique index on
(stripe_event_id, action) for idempotency — duplicate webhook events are
silently ignored.

### `membership_scheduled_changes`
Pending tier transitions that take effect at a future date — typically a
downgrade when a user cancels at period end.

## Modified Tables
### `user_memberships` — 9 new columns
- current_period_start, cancel_at_period_end, canceled_at, previous_tier_id
- stripe_price_id, stripe_customer_id, subscription_status
- last_reconciliation_at, renewal_count

## New Functions
1. `sv_apply_membership_lifecycle` — single entry point for all membership
   changes from webhooks/reconciliation. Same-tier renewal increments
   renewal_count without changing tier_id (gate retained). Idempotent.
2. `sv_schedule_membership_change` — queues a future tier transition.
3. `sv_reconcile_memberships` — scans for expired/past-due/scheduled changes.
4. `sv_get_membership_lifecycle` — returns full lifecycle state for the UI.
5. `sv_admin_clear_override_audited` — clears an admin override with audit log.
6. `sv_admin_override_membership_audited` — sets admin override with audit log.

## Security
- RLS enabled on both new tables, users can SELECT their own rows.
- All functions are SECURITY DEFINER with fixed search_path.

## Critical
1. Same-tier renewal retains the same gate — renewal_count increments, tier_id
   stays unchanged.
2. Idempotent — (stripe_event_id, action) uniqueness prevents duplicates.
3. Reconciliation grace periods: 1h for canceled-at-period-end, 24h for
   missing renewal, 7d for past_due.
*/

-- ─── user_memberships: add lifecycle columns ────────────────────────────────

ALTER TABLE user_memberships
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_tier_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_reconciliation_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0;

-- ─── membership_lifecycle_audit ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membership_lifecycle_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  old_tier text,
  new_tier text,
  old_status text,
  new_status text,
  stripe_event_id text,
  stripe_subscription_id text,
  reason text,
  source text NOT NULL DEFAULT 'webhook',
  actor_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_audit_user_id ON membership_lifecycle_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_audit_event_id ON membership_lifecycle_audit (stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_audit_event_action ON membership_lifecycle_audit (stripe_event_id, action) WHERE stripe_event_id IS NOT NULL;

ALTER TABLE membership_lifecycle_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lifecycle_audit" ON membership_lifecycle_audit;
CREATE POLICY "select_own_lifecycle_audit"
  ON membership_lifecycle_audit FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ─── membership_scheduled_changes ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membership_scheduled_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_tier text NOT NULL,
  to_tier text NOT NULL,
  action text NOT NULL,
  effective_at timestamptz NOT NULL,
  stripe_subscription_id text,
  stripe_event_id text,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_changes_pending ON membership_scheduled_changes (status, effective_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_changes_user ON membership_scheduled_changes (user_id);

ALTER TABLE membership_scheduled_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scheduled_changes" ON membership_scheduled_changes;
CREATE POLICY "select_own_scheduled_changes"
  ON membership_scheduled_changes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ─── sv_apply_membership_lifecycle ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sv_apply_membership_lifecycle(
  p_user_id uuid,
  p_tier text,
  p_status text DEFAULT 'active',
  p_action text DEFAULT 'renewal',
  p_stripe_event_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_price_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT false,
  p_reason text DEFAULT NULL,
  p_source text DEFAULT 'webhook',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_tier text;
  v_old_status text;
  v_new_tier text;
  v_renewal_count integer;
  v_is_same_tier boolean;
  v_normalized_tier text;
BEGIN
  v_normalized_tier := CASE WHEN p_tier = 'player' THEN 'free' ELSE p_tier END;

  SELECT tier_id, status, renewal_count INTO v_old_tier, v_old_status, v_renewal_count
  FROM user_memberships WHERE user_id = p_user_id;

  v_is_same_tier := (v_old_tier = v_normalized_tier);

  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM membership_lifecycle_audit
      WHERE stripe_event_id = p_stripe_event_id AND action = p_action
    ) THEN
      RETURN COALESCE(v_old_tier, v_normalized_tier);
    END IF;
  END IF;

  IF v_is_same_tier AND p_action = 'renewal' THEN
    v_renewal_count := COALESCE(v_renewal_count, 0) + 1;
  ELSIF NOT v_is_same_tier THEN
    v_renewal_count := 0;
  ELSE
    v_renewal_count := COALESCE(v_renewal_count, 0);
  END IF;

  v_new_tier := v_normalized_tier;

  INSERT INTO user_memberships (
    user_id, tier_id, status, stripe_subscription_id, stripe_price_id,
    stripe_customer_id, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, subscription_status, renewal_count,
    updated_at
  ) VALUES (
    p_user_id, v_new_tier, p_status, p_stripe_subscription_id, p_stripe_price_id,
    p_stripe_customer_id, p_period_start, p_period_end,
    p_cancel_at_period_end,
    CASE WHEN p_cancel_at_period_end THEN COALESCE(
      (SELECT canceled_at FROM user_memberships WHERE user_id = p_user_id),
      now()
    ) END,
    p_status, v_renewal_count, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = EXCLUDED.tier_id,
    status = EXCLUDED.status,
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_memberships.stripe_subscription_id),
    stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, user_memberships.stripe_price_id),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_memberships.stripe_customer_id),
    current_period_start = COALESCE(EXCLUDED.current_period_start, user_memberships.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, user_memberships.current_period_end),
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    canceled_at = CASE
      WHEN EXCLUDED.cancel_at_period_end THEN COALESCE(user_memberships.canceled_at, now())
      WHEN p_action = 'canceled' THEN now()
      ELSE user_memberships.canceled_at
    END,
    subscription_status = EXCLUDED.subscription_status,
    renewal_count = EXCLUDED.renewal_count,
    updated_at = now()
  ;

  INSERT INTO membership_lifecycle_audit (
    user_id, action, old_tier, new_tier, old_status, new_status,
    stripe_event_id, stripe_subscription_id, reason, source, actor_id, metadata
  ) VALUES (
    p_user_id, p_action, v_old_tier, v_new_tier, v_old_status, p_status,
    p_stripe_event_id, p_stripe_subscription_id, p_reason, p_source, p_actor_id, p_metadata
  )
  ON CONFLICT DO NOTHING;

  RETURN v_new_tier;
END;
$function$;

-- ─── sv_schedule_membership_change ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sv_schedule_membership_change(
  p_user_id uuid,
  p_from_tier text,
  p_to_tier text,
  p_action text,
  p_effective_at timestamptz,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_event_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  UPDATE membership_scheduled_changes
    SET status = 'superseded', processed_at = now()
    WHERE user_id = p_user_id AND status = 'pending';

  INSERT INTO membership_scheduled_changes (
    user_id, from_tier, to_tier, action, effective_at,
    stripe_subscription_id, stripe_event_id, metadata
  ) VALUES (
    p_user_id, p_from_tier, p_to_tier, p_action, p_effective_at,
    p_stripe_subscription_id, p_stripe_event_id, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ─── sv_reconcile_memberships ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sv_reconcile_memberships()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_expired_count integer := 0;
  v_downgrade_count integer := 0;
  v_past_due_count integer := 0;
  v_rec record;
BEGIN
  -- 1. Process scheduled downgrades whose effective_at has passed
  FOR v_rec IN
    SELECT id, user_id, from_tier, to_tier, action, stripe_subscription_id
    FROM membership_scheduled_changes
    WHERE status = 'pending' AND effective_at <= now()
    ORDER BY effective_at ASC
  LOOP
    PERFORM sv_apply_membership_lifecycle(
      p_user_id := v_rec.user_id,
      p_tier := v_rec.to_tier,
      p_status := CASE WHEN v_rec.to_tier = 'free' THEN 'canceled' ELSE 'active' END,
      p_action := v_rec.action,
      p_stripe_subscription_id := v_rec.stripe_subscription_id,
      p_reason := 'Scheduled change applied by reconciliation',
      p_source := 'reconciliation',
      p_metadata := jsonb_build_object('scheduled_change_id', v_rec.id)
    );

    UPDATE membership_scheduled_changes
      SET status = 'processed', processed_at = now()
      WHERE id = v_rec.id;

    v_downgrade_count := v_downgrade_count + 1;
  END LOOP;

  -- 2. Expire canceled-at-period-end memberships past their period_end + 1h
  FOR v_rec IN
    SELECT user_id, tier_id, stripe_subscription_id
    FROM user_memberships
    WHERE status = 'active'
      AND current_period_end IS NOT NULL
      AND current_period_end < (now() - interval '1 hour')
      AND cancel_at_period_end = true
  LOOP
    PERFORM sv_apply_membership_lifecycle(
      p_user_id := v_rec.user_id,
      p_tier := 'free',
      p_status := 'canceled',
      p_action := 'expired_canceled',
      p_stripe_subscription_id := v_rec.stripe_subscription_id,
      p_reason := 'Subscription period ended after cancel-at-period-end',
      p_source := 'reconciliation'
    );
    v_expired_count := v_expired_count + 1;
  END LOOP;

  -- 3. Expire active memberships with no renewal webhook after 24h grace
  FOR v_rec IN
    SELECT user_id, tier_id, stripe_subscription_id
    FROM user_memberships
    WHERE status = 'active'
      AND current_period_end IS NOT NULL
      AND current_period_end < (now() - interval '24 hours')
      AND cancel_at_period_end = false
  LOOP
    PERFORM sv_apply_membership_lifecycle(
      p_user_id := v_rec.user_id,
      p_tier := 'free',
      p_status := 'expired',
      p_action := 'expired_no_renewal',
      p_stripe_subscription_id := v_rec.stripe_subscription_id,
      p_reason := 'No renewal webhook received within 24h grace period',
      p_source := 'reconciliation'
    );
    v_expired_count := v_expired_count + 1;
  END LOOP;

  -- 4. Downgrade past_due memberships older than 7 days
  FOR v_rec IN
    SELECT user_id, tier_id, stripe_subscription_id
    FROM user_memberships
    WHERE subscription_status = 'past_due'
      AND current_period_end IS NOT NULL
      AND current_period_end < (now() - interval '7 days')
  LOOP
    PERFORM sv_apply_membership_lifecycle(
      p_user_id := v_rec.user_id,
      p_tier := 'free',
      p_status := 'past_due',
      p_action := 'past_due_expired',
      p_stripe_subscription_id := v_rec.stripe_subscription_id,
      p_reason := 'Past-due subscription exceeded 7-day dunning grace period',
      p_source := 'reconciliation'
    );
    v_past_due_count := v_past_due_count + 1;
  END LOOP;

  UPDATE user_memberships SET last_reconciliation_at = now()
    WHERE last_reconciliation_at IS NULL
       OR last_reconciliation_at < (now() - interval '1 hour');

  RETURN jsonb_build_object(
    'downgrades_applied', v_downgrade_count,
    'expired', v_expired_count,
    'past_due_expired', v_past_due_count
  );
END;
$function$;

-- ─── sv_get_membership_lifecycle ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sv_get_membership_lifecycle(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_membership record;
  v_override text;
  v_effective text;
  v_scheduled record;
  v_audit jsonb;
BEGIN
  v_effective := sv_resolve_effective_membership(p_user_id);

  SELECT tier INTO v_override FROM membership_overrides WHERE user_id = p_user_id;

  SELECT * INTO v_membership FROM user_memberships WHERE user_id = p_user_id LIMIT 1;

  SELECT * INTO v_scheduled FROM membership_scheduled_changes
    WHERE user_id = p_user_id AND status = 'pending'
    ORDER BY effective_at ASC LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action', action,
      'old_tier', old_tier,
      'new_tier', new_tier,
      'source', source,
      'reason', reason,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb) INTO v_audit
  FROM (
    SELECT * FROM membership_lifecycle_audit
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'effective_tier', v_effective,
    'override_tier', v_override,
    'purchased_tier', v_membership.tier_id,
    'membership_status', v_membership.status,
    'subscription_status', v_membership.subscription_status,
    'stripe_subscription_id', v_membership.stripe_subscription_id,
    'stripe_price_id', v_membership.stripe_price_id,
    'current_period_start', v_membership.current_period_start,
    'current_period_end', v_membership.current_period_end,
    'cancel_at_period_end', v_membership.cancel_at_period_end,
    'canceled_at', v_membership.canceled_at,
    'renewal_count', v_membership.renewal_count,
    'previous_tier_id', v_membership.previous_tier_id,
    'scheduled_change', CASE WHEN v_scheduled IS NOT NULL THEN
      jsonb_build_object(
        'action', v_scheduled.action,
        'from_tier', v_scheduled.from_tier,
        'to_tier', v_scheduled.to_tier,
        'effective_at', v_scheduled.effective_at,
        'status', v_scheduled.status
      )
    ELSE NULL END,
    'audit_log', v_audit
  );
END;
$function$;

-- ─── sv_admin_clear_override_audited ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sv_admin_clear_override_audited(
  p_user_id uuid,
  p_cleared_by uuid,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_old text;
BEGIN
  SELECT tier INTO v_old FROM membership_overrides WHERE user_id = p_user_id;

  DELETE FROM membership_overrides WHERE user_id = p_user_id;

  IF v_old IS NOT NULL THEN
    INSERT INTO membership_lifecycle_audit (
      user_id, action, old_tier, new_tier, source, actor_id, reason
    ) VALUES (
      p_user_id, 'override_cleared', v_old, NULL, 'admin', p_cleared_by, p_reason
    );
  END IF;
END;
$function$;

-- ─── sv_admin_override_membership_audited ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.sv_admin_override_membership_audited(
  p_target_user_id uuid,
  p_tier text,
  p_set_by uuid,
  p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_old text;
BEGIN
  IF p_tier NOT IN ('free','core','pro','elite') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  SELECT tier INTO v_old FROM membership_overrides WHERE user_id = p_target_user_id;

  INSERT INTO membership_overrides (user_id, tier, set_by, reason, updated_at)
  VALUES (p_target_user_id, p_tier, p_set_by, p_reason, now())
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    set_by = EXCLUDED.set_by,
    reason = EXCLUDED.reason,
    updated_at = now();

  INSERT INTO membership_lifecycle_audit (
    user_id, action, old_tier, new_tier, source, actor_id, reason
  ) VALUES (
    p_target_user_id, 'admin_override', v_old, p_tier, 'admin', p_set_by, p_reason
  ) ON CONFLICT DO NOTHING;

  RETURN true;
END;
$function$;

-- ─── Grants ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION sv_apply_membership_lifecycle TO authenticated;
GRANT EXECUTE ON FUNCTION sv_schedule_membership_change TO authenticated;
GRANT EXECUTE ON FUNCTION sv_reconcile_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION sv_get_membership_lifecycle TO authenticated;
GRANT EXECUTE ON FUNCTION sv_admin_clear_override_audited TO authenticated;
GRANT EXECUTE ON FUNCTION sv_admin_override_membership_audited TO authenticated;
