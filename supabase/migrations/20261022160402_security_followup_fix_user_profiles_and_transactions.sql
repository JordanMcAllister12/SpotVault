/*
# Security Follow-Up: Fix user_profiles RLS, sv_transactions user access, accomplishment_evidence

## Summary

This migration fixes critical RLS policy issues discovered in the final security follow-up audit:

1. **user_profiles**: The Phase 3 fix created new restrictive policies (user_profiles_*) but
   failed to drop the old permissive policies (profiles_select_all, profiles_insert_self,
   profiles_update_self). PostgreSQL OR's permissive policies together, so the old USING(true)
   policies override the new auth.uid()-based ones. This means ANY user (including anon) can
   read, insert, and update ANY user's profile — including the primary_role column, which
   edge functions use for entitlement checks. This is the root cause of the paid-content
   entitlement bypass.

2. **sv_transactions**: Only has staff SELECT policies. Regular users cannot see their own
   transaction history — the billing portal feature is broken. Add a user-own SELECT policy.

3. **accomplishment_evidence**: Has fully permissive policies (USING(true), WITH CHECK(true))
   for anon+authenticated on all CRUD operations. Lock this down to authenticated-only with
   ownership checks via the parent profile_accomplishment record.

4. **user_profiles column grants**: Revoke UPDATE on sensitive columns (primary_role,
   is_verified, is_test_account, sv_user_id) from authenticated. These must only
   be set by staff via SECURITY DEFINER functions.

## Changes

### user_profiles
- Drop old permissive policies: profiles_select_all, profiles_insert_self, profiles_update_self
- Revoke ALL privileges from anon role (user_profiles requires authentication)
- Revoke UPDATE on sensitive columns from authenticated (primary_role, is_verified,
  is_test_account, sv_user_id) — these are staff-managed fields

### sv_transactions
- Add user_select_own_transactions policy: users can SELECT their own transactions (user_id is uuid)
- Grant SELECT to authenticated

### accomplishment_evidence
- Drop old permissive policies
- Revoke ALL from anon
- Add authenticated SELECT/INSERT/UPDATE/DELETE with ownership via parent profile_accomplishment

## Security
- Closes the user_profiles RLS bypass that allowed any user to set primary_role='superuser'
- Closes the accomplishment_evidence open-access vulnerability
- Fixes billing portal by allowing users to see their own transactions
- Protects sensitive user_profiles columns from self-modification
*/

-- ──────────────────────────────────────────────────────────
-- 1. Fix user_profiles: drop old permissive policies
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select_all" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.user_profiles;

-- Revoke ALL privileges from anon — user_profiles requires authentication
REVOKE ALL PRIVILEGES ON public.user_profiles FROM anon;

-- Revoke UPDATE on sensitive columns from authenticated
-- These columns are staff-managed and must not be user-editable
REVOKE UPDATE (primary_role, is_verified, is_test_account, sv_user_id) ON public.user_profiles FROM authenticated;

-- The restrictive policies (user_profiles_select_self, user_profiles_insert_self,
-- user_profiles_update_self, user_profiles_delete_self) are already in place
-- and will now be the ONLY policies since we dropped the old permissive ones.

-- ──────────────────────────────────────────────────────────
-- 2. Fix sv_transactions: add user-own SELECT policy
-- ──────────────────────────────────────────────────────────

GRANT SELECT ON public.sv_transactions TO authenticated;

DROP POLICY IF EXISTS "user_select_own_transactions" ON public.sv_transactions;
CREATE POLICY "user_select_own_transactions" ON public.sv_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 3. Fix accomplishment_evidence: lock down permissive policies
-- ──────────────────────────────────────────────────────────

-- Drop old permissive policies
DROP POLICY IF EXISTS "evidence_select_all" ON public.accomplishment_evidence;
DROP POLICY IF EXISTS "evidence_insert_self" ON public.accomplishment_evidence;
DROP POLICY IF EXISTS "evidence_update_self" ON public.accomplishment_evidence;
DROP POLICY IF EXISTS "evidence_delete_self" ON public.accomplishment_evidence;

-- Revoke ALL from anon
REVOKE ALL PRIVILEGES ON public.accomplishment_evidence FROM anon;

-- Grant CRUD to authenticated only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accomplishment_evidence TO authenticated;

-- SELECT: visible if the parent profile_accomplishment belongs to the user OR user is staff
DROP POLICY IF EXISTS "evidence_select_visible" ON public.accomplishment_evidence;
CREATE POLICY "evidence_select_visible" ON public.accomplishment_evidence
  FOR SELECT TO authenticated
  USING (
    public.sv_is_staff_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.profile_accomplishments a
      WHERE a.id = accomplishment_evidence.accomplishment_id
      AND a.user_id = auth.uid()::text
    )
  );

-- INSERT: only the accomplishment owner or staff
DROP POLICY IF EXISTS "evidence_insert_owner" ON public.accomplishment_evidence;
CREATE POLICY "evidence_insert_owner" ON public.accomplishment_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sv_is_staff_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.profile_accomplishments a
      WHERE a.id = accomplishment_evidence.accomplishment_id
      AND a.user_id = auth.uid()::text
    )
  );

-- UPDATE: only the accomplishment owner or staff
DROP POLICY IF EXISTS "evidence_update_owner" ON public.accomplishment_evidence;
CREATE POLICY "evidence_update_owner" ON public.accomplishment_evidence
  FOR UPDATE TO authenticated
  USING (
    public.sv_is_staff_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.profile_accomplishments a
      WHERE a.id = accomplishment_evidence.accomplishment_id
      AND a.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    public.sv_is_staff_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.profile_accomplishments a
      WHERE a.id = accomplishment_evidence.accomplishment_id
      AND a.user_id = auth.uid()::text
    )
  );

-- DELETE: only the accomplishment owner or staff
DROP POLICY IF EXISTS "evidence_delete_owner" ON public.accomplishment_evidence;
CREATE POLICY "evidence_delete_owner" ON public.accomplishment_evidence
  FOR DELETE TO authenticated
  USING (
    public.sv_is_staff_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.profile_accomplishments a
      WHERE a.id = accomplishment_evidence.accomplishment_id
      AND a.user_id = auth.uid()::text
    )
  );
