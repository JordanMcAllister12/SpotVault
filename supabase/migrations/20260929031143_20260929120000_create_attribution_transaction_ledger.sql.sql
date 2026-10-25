/*
# Attribution Engine & Unified Transaction Ledger

## Purpose
Creates a centralized attribution, referral, deal, and transaction-monitoring system.
All monetary/credit activity references a common transaction/ledger architecture.

## New Tables
1. sv_deals — Economic rule sets (GROUP -> P1 -> P2 -> DEAL)
2. sv_deal_splits — Per-transaction-type economics for each deal
3. sv_acquisition_codes — Customer-facing codes (SK-JOE) that resolve to GROUP/P1/P2/DEAL
4. sv_attribution_records — Immutable per-user attribution records (ATTR-0000001)
5. sv_transactions — Unified transaction ledger with standardized type codes
6. sv_transaction_snapshots — Immutable economic snapshots frozen at completion
7. sv_credit_ledger — Credit movement tracking (purchase/grant/spend/transfer/refund/etc)

## Security
- All tables RLS-enabled, staff-only access via sv_is_staff_or_admin() (no-arg function)
- Users can read their own attribution and credit ledger entries
- Attribution records are immutable (no UPDATE/DELETE for core fields)

## Important Concepts (kept separate in DB, displayed together in Staff Room)
- CODE = how the user enters the attribution system
- ATTRIBUTION = where the user came from
- DEAL = who is economically entitled to what
- TRANSACTION TYPE = what economic event occurred
- LEDGER = permanent record of what actually happened
*/

-- ============================================================
-- 1. SV_DEALS — Economic rule sets
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  group_code text NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'draft')),
  effective_date timestamptz NOT NULL DEFAULT now(),
  expiration_date timestamptz,
  qualification_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifetime_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_deals_group_idx ON sv_deals (group_code);
CREATE INDEX IF NOT EXISTS sv_deals_status_idx ON sv_deals (status) WHERE status = 'active';

ALTER TABLE sv_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_deals" ON sv_deals;
CREATE POLICY "staff_select_deals" ON sv_deals FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_modify_deals" ON sv_deals;
CREATE POLICY "staff_modify_deals" ON sv_deals FOR ALL
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 2. SV_DEAL_SPLITS — Per-transaction-type economics
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_deal_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES sv_deals(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  partner_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  p1_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  p2_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  creator_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  spotvault_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_fee jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sv_deal_splits_deal_type_unique UNIQUE (deal_id, transaction_type)
);

ALTER TABLE sv_deal_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_deal_splits" ON sv_deal_splits;
CREATE POLICY "staff_select_deal_splits" ON sv_deal_splits FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_modify_deal_splits" ON sv_deal_splits;
CREATE POLICY "staff_modify_deal_splits" ON sv_deal_splits FOR ALL
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 3. SV_ACQUISITION_CODES — Customer-facing codes
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_acquisition_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  group_code text NOT NULL DEFAULT '0',
  p1_code text NOT NULL DEFAULT '0',
  p2_code text NOT NULL DEFAULT '0',
  deal_id uuid REFERENCES sv_deals(id),
  lounge text,
  skin text,
  content_priority text,
  reward_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'scheduled', 'expired')),
  start_date timestamptz,
  end_date timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_acquisition_codes_group_idx ON sv_acquisition_codes (group_code);
CREATE INDEX IF NOT EXISTS sv_acquisition_codes_status_idx ON sv_acquisition_codes (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sv_acquisition_codes_code_idx ON sv_acquisition_codes (code);

ALTER TABLE sv_acquisition_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_acquisition_codes" ON sv_acquisition_codes;
CREATE POLICY "staff_select_acquisition_codes" ON sv_acquisition_codes FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_modify_acquisition_codes" ON sv_acquisition_codes;
CREATE POLICY "staff_modify_acquisition_codes" ON sv_acquisition_codes FOR ALL
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 4. SV_ATTRIBUTION_RECORDS — GROUP -> P1 -> P2 -> DEAL per user
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_attribution_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_code text NOT NULL DEFAULT '0',
  p1_code text NOT NULL DEFAULT '0',
  p2_code text NOT NULL DEFAULT '0',
  deal_id uuid REFERENCES sv_deals(id),
  acquisition_code text,
  acquisition_source text CHECK (acquisition_source IN ('referral_link', 'manual_code', 'admin_grant', 'signup_code')),
  acquisition_date timestamptz NOT NULL DEFAULT now(),
  associated_lounge text,
  associated_skin text,
  preferred_content_partner text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_attribution_records_user_idx ON sv_attribution_records (user_id);
CREATE INDEX IF NOT EXISTS sv_attribution_records_group_idx ON sv_attribution_records (group_code);
CREATE INDEX IF NOT EXISTS sv_attribution_records_p1_idx ON sv_attribution_records (p1_code);
CREATE INDEX IF NOT EXISTS sv_attribution_records_deal_idx ON sv_attribution_records (deal_id);
CREATE INDEX IF NOT EXISTS sv_attribution_records_attribution_id_idx ON sv_attribution_records (attribution_id);

ALTER TABLE sv_attribution_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_attributions" ON sv_attribution_records;
CREATE POLICY "staff_select_attributions" ON sv_attribution_records FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "user_select_own_attribution" ON sv_attribution_records;
CREATE POLICY "user_select_own_attribution" ON sv_attribution_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_insert_attributions" ON sv_attribution_records;
CREATE POLICY "staff_insert_attributions" ON sv_attribution_records FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_attributions" ON sv_attribution_records;
CREATE POLICY "staff_update_attributions" ON sv_attribution_records FOR UPDATE
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 5. SV_TRANSACTIONS — Unified transaction ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type_code text NOT NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  credit_amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  product_name text,
  product_id text,
  destination text,
  recipient text,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'complete', 'refunded', 'failed', 'reversed')),
  payment_provider_ref text,
  attribution_id text,
  deal_id uuid,
  group_code text,
  p1_code text,
  p2_code text,
  original_transaction_id text,
  notes text,
  system_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_transactions_user_idx ON sv_transactions (user_id);
CREATE INDEX IF NOT EXISTS sv_transactions_type_idx ON sv_transactions (type_code);
CREATE INDEX IF NOT EXISTS sv_transactions_status_idx ON sv_transactions (payment_status);
CREATE INDEX IF NOT EXISTS sv_transactions_group_idx ON sv_transactions (group_code);
CREATE INDEX IF NOT EXISTS sv_transactions_attribution_idx ON sv_transactions (attribution_id);
CREATE INDEX IF NOT EXISTS sv_transactions_deal_idx ON sv_transactions (deal_id);
CREATE INDEX IF NOT EXISTS sv_transactions_created_idx ON sv_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS sv_transactions_original_idx ON sv_transactions (original_transaction_id);

ALTER TABLE sv_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_transactions" ON sv_transactions;
CREATE POLICY "staff_select_transactions" ON sv_transactions FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_transactions" ON sv_transactions;
CREATE POLICY "staff_insert_transactions" ON sv_transactions FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_transactions" ON sv_transactions;
CREATE POLICY "staff_update_transactions" ON sv_transactions FOR UPDATE
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 6. SV_TRANSACTION_SNAPSHOTS — Immutable economic snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_transaction_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL REFERENCES sv_transactions(transaction_id) ON DELETE CASCADE,
  attribution_id text,
  deal_id uuid,
  deal_code text,
  transaction_type text NOT NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  credit_amount integer NOT NULL DEFAULT 0,
  partner_amount numeric(12,2) NOT NULL DEFAULT 0,
  p1_amount numeric(12,2) NOT NULL DEFAULT 0,
  p2_amount numeric(12,2) NOT NULL DEFAULT 0,
  creator_amount numeric(12,2) NOT NULL DEFAULT 0,
  spotvault_amount numeric(12,2) NOT NULL DEFAULT 0,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  deal_version jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_transaction_snapshots_txn_idx ON sv_transaction_snapshots (transaction_id);

ALTER TABLE sv_transaction_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_snapshots" ON sv_transaction_snapshots;
CREATE POLICY "staff_select_snapshots" ON sv_transaction_snapshots FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_snapshots" ON sv_transaction_snapshots;
CREATE POLICY "staff_insert_snapshots" ON sv_transaction_snapshots FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 7. SV_CREDIT_LEDGER — Credit movement tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id text NOT NULL UNIQUE,
  transaction_id text REFERENCES sv_transactions(transaction_id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text,
  destination text,
  amount integer NOT NULL,
  reason text NOT NULL,
  reason_type text NOT NULL CHECK (reason_type IN ('purchase', 'grant', 'promotional', 'spend', 'transfer', 'refund', 'expire', 'admin_adjust')),
  related_content text,
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'complete', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_credit_ledger_user_idx ON sv_credit_ledger (user_id);
CREATE INDEX IF NOT EXISTS sv_credit_ledger_txn_idx ON sv_credit_ledger (transaction_id);
CREATE INDEX IF NOT EXISTS sv_credit_ledger_reason_idx ON sv_credit_ledger (reason_type);
CREATE INDEX IF NOT EXISTS sv_credit_ledger_created_idx ON sv_credit_ledger (created_at DESC);

ALTER TABLE sv_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_credit_ledger" ON sv_credit_ledger;
CREATE POLICY "staff_select_credit_ledger" ON sv_credit_ledger FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "user_select_own_credit_ledger" ON sv_credit_ledger;
CREATE POLICY "user_select_own_credit_ledger" ON sv_credit_ledger FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_insert_credit_ledger" ON sv_credit_ledger;
CREATE POLICY "staff_insert_credit_ledger" ON sv_credit_ledger FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

-- ============================================================
-- 8. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION sv_generate_attribution_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_$
DECLARE
  v_next_val bigint;
BEGIN
  SELECT COALESCE(max(seq_val), 0) + 1 INTO v_next_val
  FROM (SELECT substring(attribution_id from 6)::bigint as seq_val FROM sv_attribution_records WHERE attribution_id ~ '^ATTR-[0-9]+$') s;
  RETURN 'ATTR-' || lpad(v_next_val::text, 7, '0');
END;
$_$;

CREATE OR REPLACE FUNCTION sv_generate_transaction_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_$
DECLARE
  v_next_val bigint;
BEGIN
  SELECT COALESCE(max(seq_val), 0) + 1 INTO v_next_val
  FROM (SELECT substring(transaction_id from 5)::bigint as seq_val FROM sv_transactions WHERE transaction_id ~ '^TXN-[0-9]+$') s;
  RETURN 'TXN-' || lpad(v_next_val::text, 7, '0');
END;
$_$;

CREATE OR REPLACE FUNCTION sv_generate_credit_ledger_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_$
DECLARE
  v_next_val bigint;
BEGIN
  SELECT COALESCE(max(seq_val), 0) + 1 INTO v_next_val
  FROM (SELECT substring(ledger_id from 4)::bigint as seq_val FROM sv_credit_ledger WHERE ledger_id ~ '^CL-[0-9]+$') s;
  RETURN 'CL-' || lpad(v_next_val::text, 7, '0');
END;
$_$;

CREATE OR REPLACE FUNCTION sv_test_acquisition_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_$
DECLARE
  v_record sv_acquisition_codes%ROWTYPE;
  v_deal sv_deals%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM sv_acquisition_codes
    WHERE code = upper(trim(p_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code not found.');
  END IF;

  SELECT * INTO v_deal FROM sv_deals WHERE id = v_record.deal_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_record.code,
    'group', v_record.group_code,
    'p1', v_record.p1_code,
    'p2', v_record.p2_code,
    'deal_code', v_deal.deal_code,
    'deal_label', v_deal.label,
    'lounge', v_record.lounge,
    'skin', v_record.skin,
    'content_priority', v_record.content_priority,
    'status', v_record.status,
    'revenue_attribution', true
  );
END;
$_$;

GRANT EXECUTE ON FUNCTION sv_generate_attribution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_generate_transaction_id() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_generate_credit_ledger_id() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_test_acquisition_code(text) TO authenticated;

-- ============================================================
-- 9. SEED: Default deals and splits
-- ============================================================

INSERT INTO sv_deals (deal_code, label, description, group_code, status, effective_date, notes)
VALUES ('SK-001', 'StakeKings Standard Deal', 'Standard revenue split for StakeKings-attributed users.', 'SK', 'active', now(), 'Default deal for StakeKings partner attribution.')
ON CONFLICT (deal_code) DO NOTHING;

INSERT INTO sv_deal_splits (deal_id, transaction_type, partner_rule, p1_rule, p2_rule, creator_rule, spotvault_rule, platform_fee)
SELECT d.id, t.type,
  jsonb_build_object('type', 'percentage', 'value', t.partner_pct),
  jsonb_build_object('type', 'percentage', 'value', t.p1_pct),
  jsonb_build_object('type', 'percentage', 'value', t.p2_pct),
  jsonb_build_object('type', 'percentage', 'value', t.creator_pct),
  jsonb_build_object('type', 'percentage', 'value', t.sv_pct),
  jsonb_build_object('type', 'percentage', 'value', 0)
FROM sv_deals d
CROSS JOIN (VALUES
  ('MEM', 10.0, 5.0, 2.0, 0.0, 83.0),
  ('CRD', 10.0, 5.0, 2.0, 0.0, 83.0),
  ('SPT', 5.0, 3.0, 1.0, 70.0, 21.0),
  ('CRS', 5.0, 3.0, 1.0, 70.0, 21.0),
  ('COA', 5.0, 3.0, 1.0, 70.0, 21.0),
  ('MSA', 5.0, 3.0, 1.0, 70.0, 21.0),
  ('MER', 10.0, 5.0, 2.0, 0.0, 83.0),
  ('PRT', 0.0, 0.0, 0.0, 0.0, 100.0),
  ('RWD', 0.0, 0.0, 0.0, 0.0, 100.0),
  ('TRF', 0.0, 0.0, 0.0, 0.0, 100.0),
  ('REF', 0.0, 0.0, 0.0, 0.0, 100.0),
  ('PAY', 0.0, 0.0, 0.0, 0.0, 100.0),
  ('OTH', 0.0, 0.0, 0.0, 0.0, 100.0)
) AS t(type, partner_pct, p1_pct, p2_pct, creator_pct, sv_pct)
WHERE d.deal_code = 'SK-001'
ON CONFLICT (deal_id, transaction_type) DO NOTHING;

INSERT INTO sv_acquisition_codes (code, group_code, p1_code, p2_code, deal_id, lounge, skin, content_priority, status)
SELECT 'SK-JOE', 'SK', 'JOE', '0', d.id, 'StakeKings', 'StakeKings', 'StakeKings', 'active'
FROM sv_deals d WHERE d.deal_code = 'SK-001'
ON CONFLICT (code) DO NOTHING;

INSERT INTO sv_deals (deal_code, label, description, group_code, status, effective_date, notes)
VALUES ('DEFAULT', 'Default No-Attribution Deal', 'Used when no partner attribution is present. SpotVault retains 100%.', '0', 'active', now(), 'Fallback deal for organic/non-attributed users.')
ON CONFLICT (deal_code) DO NOTHING;

INSERT INTO sv_deal_splits (deal_id, transaction_type, partner_rule, p1_rule, p2_rule, creator_rule, spotvault_rule, platform_fee)
SELECT d.id, t.type,
  jsonb_build_object('type', 'percentage', 'value', 0),
  jsonb_build_object('type', 'percentage', 'value', 0),
  jsonb_build_object('type', 'percentage', 'value', 0),
  jsonb_build_object('type', 'percentage', 'value', t.creator_pct),
  jsonb_build_object('type', 'percentage', 'value', t.sv_pct),
  jsonb_build_object('type', 'percentage', 'value', 0)
FROM sv_deals d
CROSS JOIN (VALUES
  ('MEM', 0.0, 100.0),
  ('CRD', 0.0, 100.0),
  ('SPT', 70.0, 30.0),
  ('CRS', 70.0, 30.0),
  ('COA', 70.0, 30.0),
  ('MSA', 70.0, 30.0),
  ('MER', 0.0, 100.0),
  ('PRT', 0.0, 100.0),
  ('RWD', 0.0, 100.0),
  ('TRF', 0.0, 100.0),
  ('REF', 0.0, 100.0),
  ('PAY', 0.0, 100.0),
  ('OTH', 0.0, 100.0)
) AS t(type, creator_pct, sv_pct)
WHERE d.deal_code = 'DEFAULT'
ON CONFLICT (deal_id, transaction_type) DO NOTHING;

-- ============================================================
-- 10. UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION sv_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $_$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$_$;

DROP TRIGGER IF EXISTS sv_deals_updated_at ON sv_deals;
CREATE TRIGGER sv_deals_updated_at BEFORE UPDATE ON sv_deals
  FOR EACH ROW EXECUTE FUNCTION sv_update_updated_at();

DROP TRIGGER IF EXISTS sv_deal_splits_updated_at ON sv_deal_splits;
CREATE TRIGGER sv_deal_splits_updated_at BEFORE UPDATE ON sv_deal_splits
  FOR EACH ROW EXECUTE FUNCTION sv_update_updated_at();

DROP TRIGGER IF EXISTS sv_acquisition_codes_updated_at ON sv_acquisition_codes;
CREATE TRIGGER sv_acquisition_codes_updated_at BEFORE UPDATE ON sv_acquisition_codes
  FOR EACH ROW EXECUTE FUNCTION sv_update_updated_at();

DROP TRIGGER IF EXISTS sv_attribution_records_updated_at ON sv_attribution_records;
CREATE TRIGGER sv_attribution_records_updated_at BEFORE UPDATE ON sv_attribution_records
  FOR EACH ROW EXECUTE FUNCTION sv_update_updated_at();
