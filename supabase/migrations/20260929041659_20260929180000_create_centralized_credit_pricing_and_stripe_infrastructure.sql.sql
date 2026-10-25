-- ============================================================================
-- Centralized credit pricing + Stripe webhook infrastructure
-- ============================================================================

-- 1. Centralized credit pricing in app_settings
INSERT INTO app_settings (key, value)
VALUES (
  'credit_pricing',
  jsonb_build_object(
    'usd_per_credit', 0.10,
    'credits_per_usd', 10,
    'stripe_cents_per_credit', 10,
    'min_purchase_credits', 1,
    'max_purchase_credits', 100000,
    'currency', 'USD',
    'updated_at', now()
  )
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value;

-- 2. Stripe webhook event log — idempotency table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  sv_transaction_id text,
  payload jsonb,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'ignored')),
  error_message text
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_stripe_events_staff" ON stripe_webhook_events FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

-- 3. Stripe checkout sessions
CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE NOT NULL,
  user_id text NOT NULL,
  purchase_type text NOT NULL CHECK (purchase_type IN ('credits', 'membership')),
  credit_quantity integer,
  membership_tier text,
  stripe_price_id text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  attribution_id text,
  deal_id text,
  group_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_checkout_sessions" ON stripe_checkout_sessions FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

-- 4. Stripe customer mapping
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id text UNIQUE NOT NULL,
  user_id text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_stripe_customer" ON stripe_customers FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

-- 5. Refund/reversal columns on sv_transactions
ALTER TABLE sv_transactions
  ADD COLUMN IF NOT EXISTS refund_for_transaction_id text,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_stripe_id text;

-- 6. Ensure membership tier prices are correct
UPDATE membership_tiers SET monthly_price_cents = 999 WHERE id = 'core';
UPDATE membership_tiers SET monthly_price_cents = 2999 WHERE id = 'elite';
UPDATE membership_tiers SET monthly_price_cents = 9999 WHERE id = 'pro';
UPDATE membership_tiers SET monthly_price_cents = 0 WHERE id = 'free';

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_user_id ON stripe_checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_sv_transactions_refund_for ON sv_transactions(refund_for_transaction_id);
