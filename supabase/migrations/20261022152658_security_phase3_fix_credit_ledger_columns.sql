/*
# Security Phase 3 Fix: Repair credit_ledger column references in text overloads

## Problem
The text overloads of sv_credit_credits and sv_debit_credits reference columns
(ledger_id, reason, reference, counterparty, balance_after) that don't exist
on the credit_ledger table. The actual columns are: id, user_id, counterparty_id,
transaction_type, amount, reference_id, reference_type, metadata, created_at.

This was a pre-existing bug — the functions were never callable without error.

## Fix
Rewrote the text overloads to use the correct credit_ledger columns.
Kept the service-role-allow fix from the previous migration (auth.uid() IS NULL bypass).
*/

-- sv_add_credits (text reason/reference/counterparty overload)
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

-- sv_credit_credits (text overload) — fixed to use correct credit_ledger columns
CREATE OR REPLACE FUNCTION public.sv_credit_credits(
  p_user_id uuid, p_amount integer, p_reason text DEFAULT 'manual_adjustment'::text,
  p_reference text DEFAULT NULL::text, p_counterparty text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  UPDATE credit_balances
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;
  IF NOT FOUND THEN
    INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now()
    RETURNING balance INTO v_balance;
  END IF;
  INSERT INTO credit_ledger (user_id, transaction_type, amount, metadata)
  VALUES (p_user_id, p_reason, p_amount, jsonb_build_object('reference', p_reference, 'counterparty', p_counterparty, 'balance_after', v_balance));
END;
$function$;

-- sv_debit_credits (text overload) — fixed to use correct credit_ledger columns
CREATE OR REPLACE FUNCTION public.sv_debit_credits(
  p_user_id uuid, p_amount integer, p_reason text DEFAULT 'purchase'::text,
  p_reference text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  SELECT balance INTO v_balance FROM credit_balances WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_balance < p_amount THEN
    RETURN false;
  END IF;
  UPDATE credit_balances
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;
  INSERT INTO credit_ledger (user_id, transaction_type, amount, metadata)
  VALUES (p_user_id, p_reason, -p_amount, jsonb_build_object('reference', p_reference, 'balance_after', v_balance));
  RETURN true;
END;
$function$;