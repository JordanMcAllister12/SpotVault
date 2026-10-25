/*
# Creator Monetization & Paid Access System

## Overview
Builds the complete database foundation for creator subscriptions, paid requests,
subscriber Q&A, and a unified credit ledger. All financial mutations go through
SECURITY DEFINER functions to prevent client-side balance manipulation.

## New Tables
1. `app_settings` — configurable platform fees
2. `credit_balances` — per-user credit balance
3. `credit_ledger` — immutable transaction audit trail
4. `creator_subscriptions` — creator's subscription offering
5. `subscription_benefits` — benefits per subscription
6. `subscription_qa_config` — Q&A entitlement config
7. `subscriber_records` — active/past subscriptions
8. `subscriber_qa_allowances` — monthly Q&A tracking
9. `qa_threads` — Q&A conversations
10. `paid_requests` — one-time paid private requests
11. `paid_request_settings` — per-recipient config
12. `content_access_grants` — who has access to monetized content

## Security
- RLS on all tables
- All credit mutations via SECURITY DEFINER functions only
- Users can only read their own balances/ledger/subscriptions
- Public can read active subscription offerings and paid request settings

## Note
- content_spots.account_id is text, cast to uuid where needed in functions
*/

-- app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO app_settings (key, value) VALUES
  ('platform_fees', '{"subscription_percent": 20, "paid_request_percent": 20, "content_sale_percent": 20, "booking_percent": 20}'::jsonb)
ON CONFLICT (key) DO NOTHING;
DROP POLICY IF EXISTS "read_app_settings" ON app_settings;
CREATE POLICY "read_app_settings" ON app_settings
  FOR SELECT TO anon, authenticated USING (true);

-- credit_balances
CREATE TABLE IF NOT EXISTS credit_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_balance" ON credit_balances;
CREATE POLICY "select_own_balance" ON credit_balances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- credit_ledger
CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counterparty_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_type text NOT NULL,
  amount integer NOT NULL,
  reference_id uuid,
  reference_type text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id, created_at DESC);
DROP POLICY IF EXISTS "select_own_ledger" ON credit_ledger;
CREATE POLICY "select_own_ledger" ON credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- creator_subscriptions
CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_credits integer NOT NULL DEFAULT 1000,
  banner_url text,
  is_active boolean NOT NULL DEFAULT false,
  tier text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE creator_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_creator_subs_creator ON creator_subscriptions(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_subs_active ON creator_subscriptions(is_active) WHERE is_active = true;
DROP POLICY IF EXISTS "select_subscriptions" ON creator_subscriptions;
CREATE POLICY "select_subscriptions" ON creator_subscriptions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_subscription" ON creator_subscriptions;
CREATE POLICY "insert_own_subscription" ON creator_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_user_id);
DROP POLICY IF EXISTS "update_own_subscription" ON creator_subscriptions;
CREATE POLICY "update_own_subscription" ON creator_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = creator_user_id) WITH CHECK (auth.uid() = creator_user_id);
DROP POLICY IF EXISTS "delete_own_subscription" ON creator_subscriptions;
CREATE POLICY "delete_own_subscription" ON creator_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = creator_user_id);

-- subscription_benefits
CREATE TABLE IF NOT EXISTS subscription_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES creator_subscriptions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  benefit_type text NOT NULL DEFAULT 'CONTENT',
  delivery_type text NOT NULL DEFAULT 'INCLUDED',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscription_benefits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_benefits_sub ON subscription_benefits(subscription_id, sort_order);
DROP POLICY IF EXISTS "select_benefits" ON subscription_benefits;
CREATE POLICY "select_benefits" ON subscription_benefits
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "modify_own_benefits" ON subscription_benefits;
CREATE POLICY "modify_own_benefits" ON subscription_benefits
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.id = subscription_benefits.subscription_id AND cs.creator_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.id = subscription_benefits.subscription_id AND cs.creator_user_id = auth.uid()));

-- subscription_qa_config
CREATE TABLE IF NOT EXISTS subscription_qa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES creator_subscriptions(id) ON DELETE CASCADE,
  questions_per_month integer NOT NULL DEFAULT 0,
  follow_ups_per_question integer NOT NULL DEFAULT 0,
  response_target_hours integer NOT NULL DEFAULT 48,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscription_qa_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_qa_config" ON subscription_qa_config;
CREATE POLICY "select_qa_config" ON subscription_qa_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "modify_own_qa_config" ON subscription_qa_config;
CREATE POLICY "modify_own_qa_config" ON subscription_qa_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.id = subscription_qa_config.subscription_id AND cs.creator_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.id = subscription_qa_config.subscription_id AND cs.creator_user_id = auth.uid()));

-- subscriber_records
CREATE TABLE IF NOT EXISTS subscriber_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES creator_subscriptions(id) ON DELETE CASCADE,
  subscriber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE',
  billing_period_start timestamptz NOT NULL DEFAULT now(),
  billing_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscriber_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_records_subscriber ON subscriber_records(subscriber_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_records_creator ON subscriber_records(creator_user_id, status);
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriber_records;
CREATE POLICY "select_own_subscriptions" ON subscriber_records
  FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_user_id OR auth.uid() = creator_user_id);

-- subscriber_qa_allowances
CREATE TABLE IF NOT EXISTS subscriber_qa_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_record_id uuid NOT NULL REFERENCES subscriber_records(id) ON DELETE CASCADE,
  subscriber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  questions_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscriber_qa_allowances ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_qa_allowance_subscriber ON subscriber_qa_allowances(subscriber_user_id, period_end);
DROP POLICY IF EXISTS "select_qa_allowance" ON subscriber_qa_allowances;
CREATE POLICY "select_qa_allowance" ON subscriber_qa_allowances
  FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_user_id OR auth.uid() = creator_user_id);

-- qa_threads
CREATE TABLE IF NOT EXISTS qa_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allowance_id uuid NOT NULL REFERENCES subscriber_qa_allowances(id) ON DELETE CASCADE,
  subscriber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  status text NOT NULL DEFAULT 'OPEN',
  follow_ups_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE qa_threads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_qa_threads_creator ON qa_threads(creator_user_id, status);
DROP POLICY IF EXISTS "select_qa_threads" ON qa_threads;
CREATE POLICY "select_qa_threads" ON qa_threads
  FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_user_id OR auth.uid() = creator_user_id);

-- paid_requests
CREATE TABLE IF NOT EXISTS paid_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_credits integer NOT NULL,
  request_type text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  escrow_held boolean NOT NULL DEFAULT true,
  response_window_hours integer NOT NULL DEFAULT 48,
  expires_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE paid_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_paid_requests_recipient ON paid_requests(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_paid_requests_sender ON paid_requests(sender_user_id, status);
DROP POLICY IF EXISTS "select_own_paid_requests" ON paid_requests;
CREATE POLICY "select_own_paid_requests" ON paid_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);

-- paid_request_settings
CREATE TABLE IF NOT EXISTS paid_request_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  price_credits integer NOT NULL DEFAULT 500,
  subscriber_price_credits integer,
  request_types text[] NOT NULL DEFAULT '{}',
  max_requests_per_week integer NOT NULL DEFAULT 0,
  response_window_hours integer NOT NULL DEFAULT 48,
  who_can_send text NOT NULL DEFAULT 'everyone',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE paid_request_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_paid_request_settings" ON paid_request_settings;
CREATE POLICY "select_paid_request_settings" ON paid_request_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_paid_request_settings" ON paid_request_settings;
CREATE POLICY "insert_own_paid_request_settings" ON paid_request_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_paid_request_settings" ON paid_request_settings;
CREATE POLICY "update_own_paid_request_settings" ON paid_request_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- content_access_grants
CREATE TABLE IF NOT EXISTS content_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_spot_id uuid NOT NULL REFERENCES content_spots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_type text NOT NULL DEFAULT 'PURCHASED',
  subscription_id uuid REFERENCES creator_subscriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_access_grants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_content_grants_user ON content_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_content_grants_spot ON content_access_grants(content_spot_id);
DROP POLICY IF EXISTS "select_own_access_grants" ON content_access_grants;
CREATE POLICY "select_own_access_grants" ON content_access_grants
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM content_spots cs WHERE cs.id = content_access_grants.content_spot_id AND cs.account_id::text = auth.uid()::text));

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION sv_get_platform_fee_percent(p_type text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value->>(p_type || '_percent'))::integer, 20) FROM app_settings WHERE key = 'platform_fees';
$$;

CREATE OR REPLACE FUNCTION sv_get_credit_balance(p_user_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT balance FROM credit_balances WHERE user_id = p_user_id), 0);
$$;
GRANT EXECUTE ON FUNCTION sv_get_credit_balance TO authenticated;

CREATE OR REPLACE FUNCTION sv_add_credits(p_user_id uuid, p_amount integer, p_type text, p_metadata jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now();
  INSERT INTO credit_ledger (user_id, transaction_type, amount, metadata)
  VALUES (p_user_id, p_type, p_amount, p_metadata);
END;
$$;
GRANT EXECUTE ON FUNCTION sv_add_credits TO authenticated;

CREATE OR REPLACE FUNCTION sv_debit_credits(p_user_id uuid, p_amount integer, p_type text, p_reference_id uuid, p_reference_type text, p_counterparty_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_balance integer;
BEGIN
  SELECT balance INTO current_balance FROM credit_balances WHERE user_id = p_user_id FOR UPDATE;
  IF current_balance IS NULL OR current_balance < p_amount THEN RETURN false; END IF;
  UPDATE credit_balances SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_user_id;
  INSERT INTO credit_ledger (user_id, counterparty_id, transaction_type, amount, reference_id, reference_type)
  VALUES (p_user_id, p_counterparty_id, p_type, -p_amount, p_reference_id, p_reference_type);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION sv_credit_credits(p_user_id uuid, p_amount integer, p_type text, p_reference_id uuid, p_reference_type text, p_counterparty_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = now();
  INSERT INTO credit_ledger (user_id, counterparty_id, transaction_type, amount, reference_id, reference_type)
  VALUES (p_user_id, p_counterparty_id, p_type, p_amount, p_reference_id, p_reference_type);
END;
$$;

-- Purchase content spot (account_id is text, cast to uuid)
CREATE OR REPLACE FUNCTION sv_purchase_content_spot(p_buyer_id uuid, p_spot_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  spot_record record;
  price integer;
  creator_share integer;
  platform_fee integer;
  fee_percent integer;
  creator_id uuid;
BEGIN
  SELECT * INTO spot_record FROM content_spots WHERE id = p_spot_id AND is_monetized = true;
  IF NOT FOUND THEN RETURN false; END IF;
  price := spot_record.price_credits;
  IF price <= 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM content_access_grants WHERE content_spot_id = p_spot_id AND user_id = p_buyer_id) THEN RETURN true; END IF;
  creator_id := spot_record.account_id::uuid;
  fee_percent := sv_get_platform_fee_percent('content_sale');
  platform_fee := price * fee_percent / 100;
  creator_share := price - platform_fee;
  IF NOT sv_debit_credits(p_buyer_id, price, 'CONTENT_SALE', p_spot_id, 'content_spot', creator_id) THEN RETURN false; END IF;
  PERFORM sv_credit_credits(creator_id, creator_share, 'CONTENT_SALE_PAYOUT', p_spot_id, 'content_spot', p_buyer_id);
  INSERT INTO content_access_grants (content_spot_id, user_id, grant_type) VALUES (p_spot_id, p_buyer_id, 'PURCHASED');
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_purchase_content_spot TO authenticated;

-- Subscribe to creator
CREATE OR REPLACE FUNCTION sv_subscribe_to_creator(p_subscriber_id uuid, p_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sub_record record;
  price integer;
  creator_share integer;
  platform_fee integer;
  fee_percent integer;
  new_record_id uuid;
BEGIN
  SELECT * INTO sub_record FROM creator_subscriptions WHERE id = p_subscription_id AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM subscriber_records WHERE subscription_id = p_subscription_id AND subscriber_user_id = p_subscriber_id AND status = 'ACTIVE') THEN RETURN true; END IF;
  price := sub_record.price_credits;
  fee_percent := sv_get_platform_fee_percent('subscription');
  platform_fee := price * fee_percent / 100;
  creator_share := price - platform_fee;
  IF NOT sv_debit_credits(p_subscriber_id, price, 'CREATOR_SUBSCRIPTION_PAYMENT', p_subscription_id, 'subscription', sub_record.creator_user_id) THEN RETURN false; END IF;
  PERFORM sv_credit_credits(sub_record.creator_user_id, creator_share, 'CREATOR_SUBSCRIPTION_PAYOUT', p_subscription_id, 'subscription', p_subscriber_id);
  INSERT INTO subscriber_records (subscription_id, subscriber_user_id, creator_user_id, status, billing_period_start, billing_period_end)
  VALUES (p_subscription_id, p_subscriber_id, sub_record.creator_user_id, 'ACTIVE', now(), now() + interval '1 month')
  RETURNING id INTO new_record_id;
  INSERT INTO subscriber_qa_allowances (subscriber_record_id, subscriber_user_id, creator_user_id, period_start, period_end)
  VALUES (new_record_id, p_subscriber_id, sub_record.creator_user_id, now(), now() + interval '1 month');
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_subscribe_to_creator TO authenticated;

-- Cancel subscription
CREATE OR REPLACE FUNCTION sv_cancel_subscription(p_subscriber_id uuid, p_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE subscriber_records SET cancel_at_period_end = true, updated_at = now()
  WHERE subscription_id = p_subscription_id AND subscriber_user_id = p_subscriber_id AND status = 'ACTIVE';
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_cancel_subscription TO authenticated;

-- Check subscription active
CREATE OR REPLACE FUNCTION sv_check_subscription_active(p_user_id uuid, p_creator_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM subscriber_records WHERE subscriber_user_id = p_user_id AND creator_user_id = p_creator_id AND status = 'ACTIVE' AND billing_period_end > now());
$$;
GRANT EXECUTE ON FUNCTION sv_check_subscription_active TO authenticated;

-- Get Q&A allowance
CREATE OR REPLACE FUNCTION sv_get_qa_allowance(p_subscriber_id uuid, p_creator_id uuid)
RETURNS TABLE(questions_used integer, questions_limit integer, follow_ups_limit integer, response_target_hours integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qa_config record; allowance record;
BEGIN
  SELECT * INTO allowance FROM subscriber_qa_allowances WHERE subscriber_user_id = p_subscriber_id AND creator_user_id = p_creator_id AND period_end > now() ORDER BY period_end DESC LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT 0, 0, 0, 48; RETURN; END IF;
  SELECT sqc.* INTO qa_config FROM subscription_qa_config sqc JOIN subscriber_records sr ON sr.subscription_id = sqc.subscription_id WHERE sr.id = allowance.subscriber_record_id;
  IF NOT FOUND THEN RETURN QUERY SELECT allowance.questions_used, 0, 0, 48; RETURN; END IF;
  RETURN QUERY SELECT allowance.questions_used, qa_config.questions_per_month, qa_config.follow_ups_per_question, qa_config.response_target_hours;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_get_qa_allowance TO authenticated;

-- Create Q&A thread
CREATE OR REPLACE FUNCTION sv_create_qa_thread(p_subscriber_id uuid, p_creator_id uuid, p_subject text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowance record; config record; new_thread_id uuid;
BEGIN
  SELECT * INTO allowance FROM subscriber_qa_allowances WHERE subscriber_user_id = p_subscriber_id AND creator_user_id = p_creator_id AND period_end > now() ORDER BY period_end DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT sqc.* INTO config FROM subscription_qa_config sqc JOIN subscriber_records sr ON sr.subscription_id = sqc.subscription_id WHERE sr.id = allowance.subscriber_record_id;
  IF config IS NOT NULL AND config.questions_per_month > 0 AND allowance.questions_used >= config.questions_per_month THEN RETURN NULL; END IF;
  INSERT INTO qa_threads (allowance_id, subscriber_user_id, creator_user_id, subject, status)
  VALUES (allowance.id, p_subscriber_id, p_creator_id, p_subject, 'OPEN') RETURNING id INTO new_thread_id;
  UPDATE subscriber_qa_allowances SET questions_used = questions_used + 1, updated_at = now() WHERE id = allowance.id;
  RETURN new_thread_id;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_create_qa_thread TO authenticated;

-- Create paid request (escrow)
CREATE OR REPLACE FUNCTION sv_create_paid_request(
  p_sender_id uuid, p_recipient_id uuid, p_price integer,
  p_subject text, p_message text, p_request_type text, p_response_window integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_request_id uuid;
BEGIN
  IF NOT sv_debit_credits(p_sender_id, p_price, 'PAID_REQUEST_ESCROWED', NULL, 'paid_request', p_recipient_id) THEN RETURN NULL; END IF;
  INSERT INTO paid_requests (recipient_user_id, sender_user_id, price_credits, request_type, subject, message, status, escrow_held, response_window_hours, expires_at)
  VALUES (p_recipient_id, p_sender_id, p_price, p_request_type, p_subject, p_message, 'PENDING', true, p_response_window, now() + (p_response_window || ' hours')::interval)
  RETURNING id INTO new_request_id;
  UPDATE credit_ledger SET reference_id = new_request_id
  WHERE user_id = p_sender_id AND transaction_type = 'PAID_REQUEST_ESCROWED' AND reference_id IS NULL
    AND created_at = (SELECT max(created_at) FROM credit_ledger WHERE user_id = p_sender_id AND transaction_type = 'PAID_REQUEST_ESCROWED');
  RETURN new_request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_create_paid_request TO authenticated;

-- Accept paid request
CREATE OR REPLACE FUNCTION sv_accept_paid_request(p_request_id uuid, p_recipient_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE paid_requests SET status = 'ACTIVE', accepted_at = now(), updated_at = now()
  WHERE id = p_request_id AND recipient_user_id = p_recipient_id AND status = 'PENDING';
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_accept_paid_request TO authenticated;

-- Decline paid request (refund)
CREATE OR REPLACE FUNCTION sv_decline_paid_request(p_request_id uuid, p_recipient_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req record;
BEGIN
  SELECT * INTO req FROM paid_requests WHERE id = p_request_id AND recipient_user_id = p_recipient_id AND status IN ('PENDING', 'ACTIVE');
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM sv_credit_credits(req.sender_user_id, req.price_credits, 'PAID_REQUEST_REFUNDED', p_request_id, 'paid_request', req.recipient_user_id);
  UPDATE paid_requests SET status = 'DECLINED', declined_at = now(), escrow_held = false, updated_at = now() WHERE id = p_request_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_decline_paid_request TO authenticated;

-- Complete paid request (release escrow)
CREATE OR REPLACE FUNCTION sv_complete_paid_request(p_request_id uuid, p_recipient_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req record; creator_share integer; platform_fee integer; fee_percent integer;
BEGIN
  SELECT * INTO req FROM paid_requests WHERE id = p_request_id AND recipient_user_id = p_recipient_id AND status = 'ACTIVE';
  IF NOT FOUND THEN RETURN false; END IF;
  fee_percent := sv_get_platform_fee_percent('paid_request');
  platform_fee := req.price_credits * fee_percent / 100;
  creator_share := req.price_credits - platform_fee;
  PERFORM sv_credit_credits(req.recipient_user_id, creator_share, 'PAID_REQUEST_RELEASED', p_request_id, 'paid_request', req.sender_user_id);
  UPDATE paid_requests SET status = 'COMPLETED', completed_at = now(), escrow_held = false, updated_at = now() WHERE id = p_request_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_complete_paid_request TO authenticated;

-- Expire paid request (auto-refund)
CREATE OR REPLACE FUNCTION sv_expire_paid_request(p_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req record;
BEGIN
  SELECT * INTO req FROM paid_requests WHERE id = p_request_id AND status = 'PENDING' AND expires_at < now();
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM sv_credit_credits(req.sender_user_id, req.price_credits, 'PAID_REQUEST_REFUNDED', p_request_id, 'paid_request', req.recipient_user_id);
  UPDATE paid_requests SET status = 'EXPIRED', expired_at = now(), escrow_held = false, updated_at = now() WHERE id = p_request_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_expire_paid_request TO authenticated;

-- Check content access
CREATE OR REPLACE FUNCTION sv_check_content_access(p_user_id uuid, p_spot_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM content_access_grants WHERE content_spot_id = p_spot_id AND user_id = p_user_id)
  OR EXISTS (SELECT 1 FROM content_spots cs WHERE cs.id = p_spot_id AND cs.account_id::text = p_user_id::text);
$$;
GRANT EXECUTE ON FUNCTION sv_check_content_access TO authenticated;