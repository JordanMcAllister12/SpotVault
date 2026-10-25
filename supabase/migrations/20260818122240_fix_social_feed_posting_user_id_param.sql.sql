/*
# Fix Social Feed posting: accept optional user_id parameter

## Summary
The `sv_can_post_community()` function uses `auth.uid()` to check permissions,
but the app uses `persistSession: false` with no Supabase Auth session — so
`auth.uid()` is always NULL and the function always returns false, blocking
all Social Feed posting including superusers.

## Fix
Add an optional `p_user_id` parameter. When `auth.uid()` is NULL (no session),
fall back to `p_user_id`. This lets the frontend pass the account ID directly.

## Security
- SECURITY DEFINER, search_path locked to public.
- The caller still needs the anon key to reach the function; the user_id is
  only used for read-only permission checks (no data mutation).
*/

CREATE OR REPLACE FUNCTION public.sv_can_post_community(p_user_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH effective_user AS (
    SELECT COALESCE(auth.uid()::text, p_user_id) AS uid
  )
  SELECT
    -- Superusers, staff, admins, and owners can always post
    EXISTS (
      SELECT 1 FROM sv_roles r, effective_user e
      WHERE r.user_id = e.uid::uuid
      AND r.role IN ('staff', 'superuser', 'admin', 'owner')
      AND r.status = 'active'
    )
    -- Active paid membership in community_entitlements
    OR EXISTS (
      SELECT 1 FROM community_entitlements ce, effective_user e
      WHERE ce.user_id = e.uid
      AND ce.is_paid_member = true
    )
    -- Active non-expired, non-revoked entitlement in sv_entitlements
    OR EXISTS (
      SELECT 1 FROM sv_entitlements en, effective_user e
      WHERE en.user_id = e.uid::uuid
      AND en.revoked_at IS NULL
      AND (en.expires_at IS NULL OR en.expires_at > now())
    );
$function$;
