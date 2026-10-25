/*
# Fix Social Feed posting: handle text (non-UUID) user IDs

## Summary
The app uses text-based account IDs like 'acc-jordan', not UUIDs.
The `sv_roles.user_id` column is UUID, but `community_entitlements.user_id`
is text. The previous version of `sv_can_post_community` tried to cast
p_user_id to UUID, which fails for text IDs.

## Fix
- Check `community_entitlements` with the raw text user_id (no cast).
- Check `sv_roles` only if p_user_id is a valid UUID (using a regex check).
- Check `sv_entitlements` only if p_user_id is a valid UUID.

## Security
- SECURITY DEFINER, search_path locked to public.
- Read-only permission check; no data mutation.
*/

CREATE OR REPLACE FUNCTION public.sv_can_post_community(p_user_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH effective_user AS (
    SELECT COALESCE(auth.uid()::text, p_user_id) AS uid
  ),
  uuid_check AS (
    SELECT (SELECT uid FROM effective_user) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AS is_uuid
  )
  SELECT
    -- Superusers, staff, admins, and owners can always post (only if UUID)
    (SELECT is_uuid FROM uuid_check) AND EXISTS (
      SELECT 1 FROM sv_roles r
      WHERE r.user_id = (SELECT uid FROM effective_user)::uuid
      AND r.role IN ('staff', 'superuser', 'admin', 'owner')
      AND r.status = 'active'
    )
    -- Active paid membership in community_entitlements (text user_id, no cast)
    OR EXISTS (
      SELECT 1 FROM community_entitlements ce
      WHERE ce.user_id = (SELECT uid FROM effective_user)
      AND ce.is_paid_member = true
    )
    -- Active non-expired, non-revoked entitlement in sv_entitlements (only if UUID)
    OR (SELECT is_uuid FROM uuid_check) AND EXISTS (
      SELECT 1 FROM sv_entitlements en
      WHERE en.user_id = (SELECT uid FROM effective_user)::uuid
      AND en.revoked_at IS NULL
      AND (en.expires_at IS NULL OR en.expires_at > now())
    );
$function$;
