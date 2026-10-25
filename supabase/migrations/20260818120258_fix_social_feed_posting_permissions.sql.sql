/*
# Fix Social Feed posting permissions + add superuser override

## Summary
Updates the `sv_can_post_community` function so that the Social Feed
(formerly "Everyone Feed" / "Community Feed") requires an active paid
subscription (Core or Elite) OR a staff/superuser role — not just any
authenticated user. This enforces the business rule that only paying
subscribers can post to the Social Feed.

## Changes
1. `sv_can_post_community()` — rewritten to check:
   - Superuser / staff / admin / owner role (always allowed)
   - Active paid membership in `community_entitlements` (is_paid_member = true)
   - Active entitlement in `sv_entitlements` that is not expired or revoked
2. No new tables or columns.

## Security
- SECURITY DEFINER functions, search_path locked to public.
- No RLS policy changes.
*/

CREATE OR REPLACE FUNCTION public.sv_can_post_community()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  -- Superusers, staff, admins, and owners can always post
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  )
  -- Active paid membership in community_entitlements
  OR EXISTS (
    SELECT 1 FROM community_entitlements
    WHERE user_id = auth.uid()::text
    AND is_paid_member = true
  )
  -- Active non-expired, non-revoked entitlement in sv_entitlements
  OR EXISTS (
    SELECT 1 FROM sv_entitlements
    WHERE user_id = auth.uid()
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
$function$;
