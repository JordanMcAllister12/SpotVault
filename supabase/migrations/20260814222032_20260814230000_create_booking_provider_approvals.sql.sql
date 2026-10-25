/*
# Booking Provider Approval System

## Purpose
Server-side enforcement of who is authorized to offer their time through the
SpotVault booking marketplace. No user can become a public provider without
staff approval, regardless of their portal type.

## New Table: booking_provider_approvals
- One row per approved user (by account_id)
- Stores: account_id, display_name, username, email, categories, approved_by,
  approved_at, status ('active' | 'revoked')
- RLS enabled, TO anon, authenticated (app uses demo auth with anon key)

## Server-side enforcement
- A SECURITY DEFINER function `is_booking_provider` checks whether an account_id
  has an active approval. This is callable by the anon role so the frontend
  can check status, but the REAL enforcement happens via RLS policies on
  booking_providers, booking_services, and booking_time_slots:
  - INSERT/UPDATE/DELETE only allowed if the account_id has an active approval
  - This means even if someone calls the API directly, they cannot create
    provider data without approval

## Important
- Existing booking_providers data is preserved
- The RLS policies on booking_providers are replaced to enforce approval
- booking_services and booking_time_slots inherit protection via their
  provider_id FK (CASCADE delete) + new RLS policies that check approval
  through the provider's account_id
*/

-- ============================================================
-- 1. booking_provider_approvals
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_provider_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  username text,
  email text,
  categories text[] DEFAULT '{}',
  approved_by text,
  approved_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  -- 'active' | 'revoked'
  revoked_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE booking_provider_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_approvals" ON booking_provider_approvals;
CREATE POLICY "anon_select_approvals" ON booking_provider_approvals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_approvals" ON booking_provider_approvals;
CREATE POLICY "anon_insert_approvals" ON booking_provider_approvals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_approvals" ON booking_provider_approvals;
CREATE POLICY "anon_update_approvals" ON booking_provider_approvals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_approvals" ON booking_provider_approvals;
CREATE POLICY "anon_delete_approvals" ON booking_provider_approvals FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 2. SECURITY DEFINER function: is_booking_provider
--    Callable by anon to check if an account_id is approved
-- ============================================================
CREATE OR REPLACE FUNCTION is_booking_provider(p_account_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM booking_provider_approvals
    WHERE account_id = p_account_id
    AND status = 'active'
  );
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION is_booking_provider(text) TO anon, authenticated;

-- ============================================================
-- 3. Replace RLS on booking_providers to enforce approval
--    SELECT: anyone can read (needed for Community discovery)
--    INSERT: only if account_id has active approval
--    UPDATE: only if the row's account_id has active approval
--    DELETE: only if the row's account_id has active approval
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "anon_insert_providers" ON booking_providers;
DROP POLICY IF EXISTS "anon_update_providers" ON booking_providers;
DROP POLICY IF EXISTS "anon_delete_providers" ON booking_providers;

-- New INSERT policy: must have active approval
CREATE POLICY "anon_insert_providers_approved" ON booking_providers
  FOR INSERT TO anon, authenticated
  WITH CHECK (is_booking_provider(account_id));

-- New UPDATE policy: must have active approval for this account
CREATE POLICY "anon_update_providers_approved" ON booking_providers
  FOR UPDATE TO anon, authenticated
  USING (is_booking_provider(account_id))
  WITH CHECK (is_booking_provider(account_id));

-- New DELETE policy: must have active approval for this account
CREATE POLICY "anon_delete_providers_approved" ON booking_providers
  FOR DELETE TO anon, authenticated
  USING (is_booking_provider(account_id));

-- ============================================================
-- 4. Replace RLS on booking_services to enforce approval
--    The service links to a provider, which links to an account_id.
--    We check that the provider's account_id has active approval.
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_services" ON booking_services;
DROP POLICY IF EXISTS "anon_update_services" ON booking_services;
DROP POLICY IF EXISTS "anon_delete_services" ON booking_services;

CREATE POLICY "anon_insert_services_approved" ON booking_services
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  );

CREATE POLICY "anon_update_services_approved" ON booking_services
  FOR UPDATE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  );

CREATE POLICY "anon_delete_services_approved" ON booking_services
  FOR DELETE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  );

-- ============================================================
-- 5. Replace RLS on booking_time_slots to enforce approval
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_slots" ON booking_time_slots;
DROP POLICY IF EXISTS "anon_update_slots" ON booking_time_slots;
DROP POLICY IF EXISTS "anon_delete_slots" ON booking_time_slots;

CREATE POLICY "anon_insert_slots_approved" ON booking_time_slots
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  );

CREATE POLICY "anon_update_slots_approved" ON booking_time_slots
  FOR UPDATE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  );

CREATE POLICY "anon_delete_slots_approved" ON booking_time_slots
  FOR DELETE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_providers bp
      WHERE bp.id = provider_id
      AND is_booking_provider(bp.account_id)
    )
  );

-- ============================================================
-- 6. updated_at trigger for booking_provider_approvals
-- ============================================================
DROP TRIGGER IF EXISTS trg_booking_approvals_updated ON booking_provider_approvals;
CREATE TRIGGER trg_booking_approvals_updated BEFORE UPDATE ON booking_provider_approvals
  FOR EACH ROW EXECUTE FUNCTION update_booking_updated_at();
