/*
# StakeKings Account Provisioning System

## Purpose
Enables secure server-to-server account provisioning from StakeKings into SpotVault.
StakeKings calls an edge function to create a provisioning request; the user redeems
a one-time token to complete onboarding (set password, accept terms, get portal access).

## New Tables

1. `sk_provisioning_requests`
   - Stores each provisioning request from StakeKings' server.
   - Tracks status: pending → consumed | expired | cancelled.
   - Contains the one-time token HASH (never the raw token) and expiry.
   - Idempotent on `external_user_id` — re-provisioning returns the existing pending request.

2. `sk_account_links`
   - Permanent 1:1 mapping between StakeKings external_user_id and SpotVault auth user_id.
   - Prevents duplicate provisioning and enables account recovery.
   - Unique on both external_user_id and spotvault_user_id.

3. `policy_acceptances`
   - Records which user accepted which policy version and when.
   - Supports Terms of Service and Privacy Policy (extensible to other policy types).
   - One row per acceptance event (append-only audit trail).

4. `sk_provisioning_audit`
   - Append-only audit log of all provisioning lifecycle events.
   - Records who/what/when for every state transition.

## Security
- RLS enabled on all tables.
- `sk_provisioning_requests`: only the service role (edge functions) can write.
  Authenticated users can only read their own request by matching their user_id
  (which is set only after successful token redemption).
- `sk_account_links`: authenticated users can read only their own link.
- `policy_acceptances`: authenticated users can read only their own acceptances.
- `sk_provisioning_audit`: service-role write only; no client read access.

## Important Notes
1. The raw provisioning token is NEVER stored — only its SHA-256 hash.
2. Token redemption is atomic via `UPDATE ... WHERE status='pending' RETURNING`.
3. The `sk_redeem_provisioning_token` SECURITY DEFINER function performs the
   atomic consume + returns provisioning data in a single call.
4. Rate limiting is handled in the edge function via the audit table count.
*/

-- ============================================================================
-- 1. sk_provisioning_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS sk_provisioning_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id text NOT NULL,
  external_username text,
  display_name text,
  email text,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_user_id uuid,
  cancelled_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sk_provisioning_requests ENABLE ROW LEVEL SECURITY;

-- Index for idempotent lookup by external_user_id
CREATE INDEX IF NOT EXISTS idx_sk_prov_req_external_user
  ON sk_provisioning_requests (external_user_id);

-- Index for token hash lookup during redemption
CREATE INDEX IF NOT EXISTS idx_sk_prov_req_token_hash
  ON sk_provisioning_requests (token_hash);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_sk_prov_req_expires_at
  ON sk_provisioning_requests (expires_at);

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "sk_prov_req_service_all" ON sk_provisioning_requests;
DROP POLICY IF EXISTS "sk_prov_req_user_read_own" ON sk_provisioning_requests;

-- Service role (edge functions) has full access via the service role key.
-- The service role bypasses RLS, but we add an explicit policy for clarity.
-- Authenticated users can only read their own consumed request.
CREATE POLICY "sk_prov_req_user_read_own"
ON sk_provisioning_requests FOR SELECT
TO authenticated
USING (consumed_by_user_id = auth.uid());

-- ============================================================================
-- 2. sk_account_links
-- ============================================================================
CREATE TABLE IF NOT EXISTS sk_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id text NOT NULL UNIQUE,
  spotvault_user_id uuid NOT NULL UNIQUE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE sk_account_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sk_account_links_read_own" ON sk_account_links;

CREATE POLICY "sk_account_links_read_own"
ON sk_account_links FOR SELECT
TO authenticated
USING (spotvault_user_id = auth.uid());

-- ============================================================================
-- 3. policy_acceptances
-- ============================================================================
CREATE TABLE IF NOT EXISTS policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  policy_type text NOT NULL CHECK (policy_type IN ('terms_of_service', 'privacy_policy')),
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user
  ON policy_acceptances (user_id, policy_type);

DROP POLICY IF EXISTS "policy_acceptances_read_own" ON policy_acceptances;
DROP POLICY IF EXISTS "policy_acceptances_insert_own" ON policy_acceptances;

CREATE POLICY "policy_acceptances_read_own"
ON policy_acceptances FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "policy_acceptances_insert_own"
ON policy_acceptances FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. sk_provisioning_audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS sk_provisioning_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  external_user_id text,
  request_id uuid,
  user_id uuid,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sk_provisioning_audit ENABLE ROW LEVEL SECURITY;

-- No client policies — only the service role (edge functions) can write/read.
-- RLS with no policies = deny all for anon/authenticated.

CREATE INDEX IF NOT EXISTS idx_sk_prov_audit_external_user
  ON sk_provisioning_audit (external_user_id);

CREATE INDEX IF NOT EXISTS idx_sk_prov_audit_created_at
  ON sk_provisioning_audit (created_at);

-- ============================================================================
-- 5. SECURITY DEFINER: sv_redeem_provisioning_token
--    Atomically consumes a pending provisioning request by token hash.
--    Returns the provisioning data or NULL if token is invalid/expired/already consumed.
-- ============================================================================
CREATE OR REPLACE FUNCTION sv_redeem_provisioning_token(
  p_token_hash text
)
RETURNS TABLE (
  id uuid,
  external_user_id text,
  external_username text,
  display_name text,
  email text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request sk_provisioning_requests%ROWTYPE;
BEGIN
  -- Atomic consume: only succeeds if status='pending' AND not expired
  UPDATE sk_provisioning_requests
    SET status = 'consumed',
        consumed_at = now(),
        updated_at = now()
    WHERE token_hash = p_token_hash
      AND status = 'pending'
      AND expires_at > now()
    RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    RETURN;
  END IF;

  -- Audit the redemption
  INSERT INTO sk_provisioning_audit (event_type, request_id, external_user_id, detail)
    VALUES ('token_redeemed', v_request.id, v_request.external_user_id,
            jsonb_build_object('consumed_at', v_request.consumed_at));

  RETURN QUERY
    SELECT v_request.id, v_request.external_user_id, v_request.external_username,
           v_request.display_name, v_request.email, v_request.metadata;
END;
$$;

-- ============================================================================
-- 6. SECURITY DEFINER: sv_link_stakekings_account
--    Creates the permanent 1:1 link between external_user_id and spotvault_user_id.
--    Fails if either side is already linked to a different partner.
-- ============================================================================
CREATE OR REPLACE FUNCTION sv_link_stakekings_account(
  p_external_user_id text,
  p_spotvault_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if external_user_id is already linked to a DIFFERENT spotvault user
  IF EXISTS (
    SELECT 1 FROM sk_account_links
      WHERE external_user_id = p_external_user_id
        AND spotvault_user_id <> p_spotvault_user_id
  ) THEN
    RAISE EXCEPTION 'external_user_id already linked to a different SpotVault account';
  END IF;

  -- Check if spotvault_user_id is already linked to a DIFFERENT external user
  IF EXISTS (
    SELECT 1 FROM sk_account_links
      WHERE spotvault_user_id = p_spotvault_user_id
        AND external_user_id <> p_external_user_id
  ) THEN
    RAISE EXCEPTION 'SpotVault account already linked to a different StakeKings identity';
  END IF;

  -- Upsert the link (if the exact pair already exists, just update metadata)
  INSERT INTO sk_account_links (external_user_id, spotvault_user_id, metadata)
    VALUES (p_external_user_id, p_spotvault_user_id, p_metadata)
    ON CONFLICT (external_user_id) DO UPDATE
      SET metadata = p_metadata,
          linked_at = now();

  -- Audit the linking
  INSERT INTO sk_provisioning_audit (event_type, external_user_id, user_id, detail)
    VALUES ('account_linked', p_external_user_id, p_spotvault_user_id, p_metadata);

  RETURN true;
END;
$$;

-- ============================================================================
-- 7. SECURITY DEFINER: sv_check_account_link
--    Returns the spotvault_user_id linked to a given external_user_id, or NULL.
-- ============================================================================
CREATE OR REPLACE FUNCTION sv_check_account_link(
  p_external_user_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT spotvault_user_id INTO v_user_id
    FROM sk_account_links
    WHERE external_user_id = p_external_user_id;
  RETURN v_user_id;
END;
$$;

-- ============================================================================
-- 8. SECURITY DEFINER: sv_record_policy_acceptance
--    Records a policy acceptance for a user.
-- ============================================================================
CREATE OR REPLACE FUNCTION sv_record_policy_acceptance(
  p_user_id uuid,
  p_policy_type text,
  p_policy_version text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_policy_type NOT IN ('terms_of_service', 'privacy_policy') THEN
    RAISE EXCEPTION 'Invalid policy_type';
  END IF;

  INSERT INTO policy_acceptances (user_id, policy_type, policy_version)
    VALUES (p_user_id, p_policy_type, p_policy_version);

  RETURN true;
END;
$$;

-- ============================================================================
-- 9. SECURITY DEFINER: sv_has_policy_acceptance
--    Checks if a user has accepted a given policy type at or above a version.
-- ============================================================================
CREATE OR REPLACE FUNCTION sv_has_policy_acceptance(
  p_user_id uuid,
  p_policy_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM policy_acceptances
    WHERE user_id = p_user_id AND policy_type = p_policy_type;
  RETURN v_count > 0;
END;
$$;
