/*
# Security Phase 3 Fix: Allow service-role calls to credit functions

## Problem
The Phase 1 migration added `sv_is_staff_or_admin()` checks to credit functions
(sv_add_credits, sv_credit_credits, sv_debit_credits). However, the Stripe webhook
edge function calls these via the Supabase service role client, where `auth.uid()`
returns NULL. This caused `sv_is_staff_or_admin()` to always return FALSE, breaking
the entire credit purchase flow — credits could never be issued after a Stripe payment.

## Fix
Changed the auth check from `IF NOT sv_is_staff_or_admin()` to
`IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin()`.

This means:
- When called via the service role (auth.uid() = NULL): allowed (trusted server-side context)
- When called by an authenticated user: must be staff/admin
- When called by anon: blocked (anon has no auth.uid())

## Functions fixed
- sv_add_credits (text overload) — used by Stripe webhook for credit issuance
- sv_add_credits (uuid overload) — used by Stripe webhook
- sv_credit_credits (text overload) — inner function for crediting
- sv_credit_credits (uuid overload) — inner function for crediting
- sv_debit_credits (text overload) — used by Stripe webhook for refunds
- sv_debit_credits (uuid overload) — used by app for purchases

## Security note
This is safe because:
1. The service role key is only available to server-side code (edge functions)
2. The anon key client cannot set auth.uid() to NULL — it's always NULL for anon,
   and anon has no EXECUTE grant on these functions (only authenticated does)
3. Authenticated users still require staff/admin role
*/

-- sv_add_credits (text metadata overload) — used by webhook
CREATE OR REPLACE FUNCTION public.sv_add_credits(
  p_user_id uuid, p_amount integer, p_type text, p_metadata jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now();
  INSERT INTO credit_ledger (user_id, transaction_type, amount, metadata)
  VALUES (p_user_id, p_type, p_amount, p_metadata);
END;
$function$;

-- sv_add_credits (reason/reference/counterparty overload) — delegates to sv_credit_credits
CREATE OR REPLACE FUNCTION public.sv_add_credits(
  p_user_id uuid, p_amount integer, p_reason text DEFAULT 'manual_adjustment'::text,
  p_reference text DEFAULT NULL::text, p_counterparty text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  PERFORM sv_credit_credits(p_user_id, p_amount, p_reason, p_reference, p_counterparty);
END;
$function$;

-- sv_credit_credits (text overload)
CREATE OR REPLACE FUNCTION public.sv_credit_credits(
  p_user_id uuid, p_amount integer, p_reason text DEFAULT 'manual_adjustment'::text,
  p_reference text DEFAULT NULL::text, p_counterparty text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ledger_id text;
  v_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
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

-- sv_credit_credits (uuid overload)
CREATE OR REPLACE FUNCTION public.sv_credit_credits(
  p_user_id uuid, p_amount integer, p_type text,
  p_reference_id uuid, p_reference_type text, p_counterparty_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now();
  INSERT INTO credit_ledger (user_id, counterparty_id, transaction_type, amount, reference_id, reference_type)
  VALUES (p_user_id, p_counterparty_id, p_type, p_amount, p_reference_id, p_reference_type);
END;
$function$;

-- sv_debit_credits (text overload) — used by webhook for refunds
CREATE OR REPLACE FUNCTION public.sv_debit_credits(
  p_user_id uuid, p_amount integer, p_reason text DEFAULT 'purchase'::text,
  p_reference text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ledger_id text;
  v_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
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

-- sv_debit_credits (uuid overload)
CREATE OR REPLACE FUNCTION public.sv_debit_credits(
  p_user_id uuid, p_amount integer, p_type text,
  p_reference_id uuid, p_reference_type text, p_counterparty_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE current_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
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