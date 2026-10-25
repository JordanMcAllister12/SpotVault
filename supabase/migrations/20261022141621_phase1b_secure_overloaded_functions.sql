/*
# Phase 1b: Add auth checks to overloaded credit/membership/entitlement functions
*/

-- Drop the overloaded sv_grant_entitlement that has a different return type
DROP FUNCTION IF EXISTS public.sv_grant_entitlement(uuid, text, uuid, text, timestamp with time zone, jsonb);

-- sv_add_credits(uuid, integer, text, jsonb) — overloaded version
CREATE OR REPLACE FUNCTION public.sv_add_credits(
  p_user_id uuid, p_amount integer, p_type text, p_metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now();
  INSERT INTO credit_ledger (user_id, transaction_type, amount, metadata)
  VALUES (p_user_id, p_type, p_amount, p_metadata);
END;
$function$;

-- sv_credit_credits(uuid, integer, text, uuid, text, uuid) — overloaded version
CREATE OR REPLACE FUNCTION public.sv_credit_credits(
  p_user_id uuid, p_amount integer, p_type text, p_reference_id uuid, p_reference_type text, p_counterparty_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now();
  INSERT INTO credit_ledger (user_id, counterparty_id, transaction_type, amount, reference_id, reference_type)
  VALUES (p_user_id, p_counterparty_id, p_type, p_amount, p_reference_id, p_reference_type);
END;
$function$;

-- sv_debit_credits(uuid, integer, text, uuid, text, uuid) — overloaded version
CREATE OR REPLACE FUNCTION public.sv_debit_credits(
  p_user_id uuid, p_amount integer, p_type text, p_reference_id uuid, p_reference_type text, p_counterparty_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE current_balance integer;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  SELECT balance INTO current_balance FROM credit_balances WHERE user_id = p_user_id FOR UPDATE;
  IF current_balance IS NULL OR current_balance < p_amount THEN RETURN false; END IF;
  UPDATE credit_balances SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_user_id;
  INSERT INTO credit_ledger (user_id, counterparty_id, transaction_type, amount, reference_id, reference_type)
  VALUES (p_user_id, p_counterparty_id, p_type, -p_amount, p_reference_id, p_reference_type);
  RETURN true;
END;
$function$;

-- sv_admin_override_membership_audited(uuid, text, uuid, text) — overloaded version
CREATE OR REPLACE FUNCTION public.sv_admin_override_membership_audited(
  p_target_user_id uuid, p_tier text, p_set_by uuid, p_reason text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_old text;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  IF p_tier NOT IN ('free','core','pro','elite') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;
  SELECT tier INTO v_old FROM membership_overrides WHERE user_id = p_target_user_id;
  INSERT INTO membership_overrides (user_id, tier, set_by, reason, updated_at)
  VALUES (p_target_user_id, p_tier, p_set_by, p_reason, now())
  ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier, set_by = EXCLUDED.set_by, reason = EXCLUDED.reason, updated_at = now();
  INSERT INTO membership_lifecycle_audit (user_id, action, old_tier, new_tier, source, actor_id, reason)
  VALUES (p_target_user_id, 'admin_override', v_old, p_tier, 'admin', p_set_by, p_reason);
  RETURN true;
END;
$function$;

-- sv_apply_membership_lifecycle — overloaded version with full Stripe params
CREATE OR REPLACE FUNCTION public.sv_apply_membership_lifecycle(
  p_user_id uuid, p_tier text, p_status text DEFAULT 'active'::text,
  p_action text DEFAULT 'renewal'::text,
  p_stripe_event_id text DEFAULT NULL::text,
  p_stripe_subscription_id text DEFAULT NULL::text,
  p_stripe_price_id text DEFAULT NULL::text,
  p_stripe_customer_id text DEFAULT NULL::text,
  p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cancel_at_period_end boolean DEFAULT false,
  p_reason text DEFAULT NULL::text,
  p_source text DEFAULT 'webhook'::text,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_tier text;
  v_old_status text;
  v_normalized_tier text;
  v_renewal_count integer;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  v_normalized_tier := CASE WHEN p_tier = 'player' THEN 'free' ELSE p_tier END;
  SELECT tier_id, status INTO v_old_tier, v_old_status FROM user_memberships WHERE user_id = p_user_id;
  IF p_action IN ('upgrade','downgrade','create') AND v_old_tier IS NULL THEN
    INSERT INTO user_memberships (user_id, tier_id, status)
    VALUES (p_user_id, v_normalized_tier, p_status)
    ON CONFLICT (user_id) DO UPDATE SET tier_id = v_normalized_tier, status = p_status, updated_at = now();
  ELSIF p_action = 'cancel' THEN
    UPDATE user_memberships SET status = 'cancelled', updated_at = now() WHERE user_id = p_user_id;
  ELSIF p_action = 'reactivate' THEN
    UPDATE user_memberships SET status = 'active', updated_at = now() WHERE user_id = p_user_id;
  ELSIF p_action = 'renewal' AND v_old_tier IS NOT NULL THEN
    UPDATE user_memberships SET status = p_status, updated_at = now() WHERE user_id = p_user_id;
  END IF;
  SELECT renewal_count INTO v_renewal_count FROM membership_lifecycle
  WHERE user_id = p_user_id AND action = 'renewal'
  ORDER BY created_at DESC LIMIT 1;
  v_renewal_count := COALESCE(v_renewal_count, 0) + CASE WHEN p_action = 'renewal' THEN 1 ELSE 0 END;
  INSERT INTO membership_lifecycle (
    user_id, action, tier, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, status, renewal_count, actor_id, period_start, period_end,
    cancel_at_period_end, reason, source, metadata
  ) VALUES (
    p_user_id, p_action, v_normalized_tier, p_stripe_customer_id, p_stripe_subscription_id,
    p_stripe_price_id, p_status, v_renewal_count, COALESCE(p_actor_id, auth.uid()),
    p_period_start, p_period_end, p_cancel_at_period_end, p_reason, p_source, p_metadata
  );
  RETURN v_normalized_tier;
END;
$function$;

-- Re-grant EXECUTE to authenticated on recreated functions
GRANT EXECUTE ON FUNCTION sv_add_credits(uuid, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_credit_credits(uuid, integer, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_debit_credits(uuid, integer, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_admin_override_membership_audited(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_apply_membership_lifecycle(uuid, text, text, text, text, text, text, text, timestamp with time zone, timestamp with time zone, boolean, text, text, uuid, jsonb) TO authenticated;
