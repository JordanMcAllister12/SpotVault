/*
# Phase 1: Critical Security Lockdown

## Summary
- Revoke ALL SECURITY DEFINER function EXECUTE from anon and PUBLIC
- Re-grant EXECUTE to authenticated for all SECURITY DEFINER functions
- Add internal authorization checks to critically vulnerable functions:
  sv_add_credits, sv_apply_membership_lifecycle,
  sv_admin_override_membership_audited, sv_grant_entitlement,
  sv_credit_credits, sv_debit_credits

## Safety
- No data deleted or modified
- Existing authenticated user workflows preserved
- anon role loses EXECUTE on all SECURITY DEFINER functions
*/

-- ═══════════════════════════════════════════════════════════════
-- Step 1: Revoke anon and PUBLIC EXECUTE on ALL SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', fn.proname, fn.identity_args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', fn.proname, fn.identity_args);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 2: Re-grant EXECUTE to authenticated for all SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.identity_args);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 3: Add internal authorization to critically vulnerable functions
-- ═══════════════════════════════════════════════════════════════

-- sv_add_credits: Require staff/admin
CREATE OR REPLACE FUNCTION public.sv_add_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'manual_adjustment'::text,
  p_reference text DEFAULT NULL::text,
  p_counterparty text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  PERFORM sv_credit_credits(p_user_id, p_amount, p_reason, p_reference, p_counterparty);
END;
$function$;

-- sv_credit_credits: Require staff/admin
CREATE OR REPLACE FUNCTION public.sv_credit_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'manual_adjustment'::text,
  p_reference text DEFAULT NULL::text,
  p_counterparty text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ledger_id text;
  v_balance integer;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  v_ledger_id := sv_generate_credit_ledger_id();
  UPDATE credit_balances
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;
  IF NOT FOUND THEN
    INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now()
    RETURNING balance INTO v_balance;
  END IF;
  INSERT INTO credit_ledger (ledger_id, user_id, amount, reason, reference, counterparty, balance_after)
  VALUES (v_ledger_id, p_user_id, p_amount, p_reason, p_reference, p_counterparty, v_balance);
END;
$function$;

-- sv_debit_credits: Require staff/admin
CREATE OR REPLACE FUNCTION public.sv_debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'purchase'::text,
  p_reference text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ledger_id text;
  v_balance integer;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  SELECT balance INTO v_balance FROM credit_balances WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_balance < p_amount THEN
    RETURN false;
  END IF;
  v_ledger_id := sv_generate_credit_ledger_id();
  UPDATE credit_balances
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;
  INSERT INTO credit_ledger (ledger_id, user_id, amount, reason, reference, balance_after)
  VALUES (v_ledger_id, p_user_id, -p_amount, p_reason, p_reference, v_balance);
  RETURN true;
END;
$function$;

-- sv_apply_membership_lifecycle: Require staff/admin
CREATE OR REPLACE FUNCTION public.sv_apply_membership_lifecycle(
  p_user_id uuid,
  p_action text,
  p_tier text DEFAULT NULL::text,
  p_stripe_customer_id text DEFAULT NULL::text,
  p_stripe_subscription_id text DEFAULT NULL::text,
  p_stripe_price_id text DEFAULT NULL::text,
  p_status text DEFAULT 'active'::text,
  p_renewal_count integer DEFAULT 0,
  p_actor_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  IF p_actor_id IS NULL THEN
    p_actor_id := auth.uid();
  END IF;
  INSERT INTO membership_lifecycle (user_id, action, tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, renewal_count, actor_id)
  VALUES (p_user_id, p_action, p_tier, p_stripe_customer_id, p_stripe_subscription_id, p_stripe_price_id, p_status, p_renewal_count, p_actor_id);
  IF p_action = 'create' OR p_action = 'upgrade' OR p_action = 'downgrade' THEN
    INSERT INTO user_memberships (user_id, tier_id, status)
    VALUES (p_user_id, p_tier, p_status)
    ON CONFLICT (user_id) DO UPDATE SET tier_id = p_tier, status = p_status, updated_at = now();
  ELSIF p_action = 'cancel' THEN
    UPDATE user_memberships SET status = 'cancelled', updated_at = now() WHERE user_id = p_user_id;
  ELSIF p_action = 'reactivate' THEN
    UPDATE user_memberships SET status = 'active', updated_at = now() WHERE user_id = p_user_id;
  END IF;
END;
$function$;

-- sv_admin_override_membership_audited: Require staff/admin
CREATE OR REPLACE FUNCTION public.sv_admin_override_membership_audited(
  p_user_id uuid,
  p_tier text,
  p_reason text DEFAULT 'manual_override'::text,
  p_set_by uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  IF p_set_by IS NULL THEN
    p_set_by := auth.uid();
  END IF;
  INSERT INTO membership_overrides (user_id, tier, reason, set_by)
  VALUES (p_user_id, p_tier, p_reason, p_set_by);
  INSERT INTO user_memberships (user_id, tier_id, status)
  VALUES (p_user_id, p_tier, 'active')
  ON CONFLICT (user_id) DO UPDATE SET tier_id = p_tier, status = 'active', updated_at = now();
  INSERT INTO membership_lifecycle (user_id, action, tier, actor_id)
  VALUES (p_user_id, 'override', p_tier, p_set_by);
END;
$function$;

-- sv_grant_entitlement: Require staff/admin
CREATE OR REPLACE FUNCTION public.sv_grant_entitlement(
  p_user_id uuid,
  p_resource_id uuid,
  p_entitlement_type text,
  p_source text DEFAULT 'manual_grant'::text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  INSERT INTO sv_entitlements (user_id, resource_id, entitlement_type, source)
  VALUES (p_user_id, p_resource_id, p_entitlement_type, p_source)
  ON CONFLICT (user_id, resource_id, entitlement_type) DO NOTHING;
  INSERT INTO entitlement_audit_log (user_id, resource_id, action, actor_id, entitlement_type, source)
  VALUES (p_user_id, p_resource_id, 'grant', auth.uid(), p_entitlement_type, p_source);
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- Step 4: Re-grant on recreated functions (CREATE OR REPLACE drops grants)
-- ═══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION sv_add_credits(uuid, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_credit_credits(uuid, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_debit_credits(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_apply_membership_lifecycle(uuid, text, text, text, text, text, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_admin_override_membership_audited(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_grant_entitlement(uuid, uuid, text, text) TO authenticated;
