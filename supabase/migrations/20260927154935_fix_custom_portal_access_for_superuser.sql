/*
# Fix Custom Portal Access for Superuser/Staff

## Problem
The existing RPC `sv_get_my_portal_memberships` only returns portals where the
current user has an active membership row in `custom_portal_memberships`. For
superusers and staff who need to QA all custom portals, this returns empty
because no membership rows exist for them. Additionally, StakeKings Player
Academy was never added to the `custom_portals` table — it was handled through
a separate legacy code path.

## Changes

1. Insert StakeKings Player Academy into `custom_portals` table
   - slug: `stakekings-player-academy`
   - base_portal: `STAKEKINGS_PLAYER`
   - category: `partner`
   - active: true

2. Create new RPC `sv_get_accessible_custom_portals`
   - Returns ALL active custom portals for staff/superusers (bypasses membership check)
   - Returns only membership-granted portals for normal users
   - Returns the same shape as `sv_get_my_portal_memberships` so the frontend
     can consume it without changes

3. Keep existing `sv_get_my_portal_memberships` unchanged for backward compatibility

## Security
- The new RPC uses `sv_is_staff_or_admin()` to determine access level
- No RLS changes needed — this is a SECURITY DEFINER function with explicit checks
*/

-- 1. Add StakeKings Player Academy to custom_portals (idempotent)
INSERT INTO custom_portals (slug, name, base_portal, active, category, config)
SELECT 'stakekings-player-academy', 'StakeKings Player Academy', 'STAKEKINGS_PLAYER', true, 'partner', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM custom_portals WHERE slug = 'stakekings-player-academy'
);

-- 2. Create new RPC that returns all active portals for staff/superusers,
--    and membership-granted portals for normal users
CREATE OR REPLACE FUNCTION sv_get_accessible_custom_portals()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'portal_id', cp.id::text,
  'portal_slug', cp.slug,
  'portal_name', cp.name,
  'base_portal', cp.base_portal,
  'config', cp.config,
  'status', COALESCE(pm.status, 'active'),
  'access_expires_at', COALESCE(pm.access_expires_at, now() + interval '100 years'),
  'membership_tier', COALESCE(pm.membership_tier, 'full'),
  'entitlement_package', COALESCE(pm.entitlement_package, '{}'::jsonb),
  'category', cp.category
)), '[]'::jsonb)
FROM public.custom_portals cp
LEFT JOIN public.custom_portal_memberships pm
  ON pm.portal_id = cp.id
  AND pm.user_id = auth.uid()
  AND pm.status = 'active'
  AND pm.access_expires_at > now()
WHERE cp.active = true
  AND (
    -- Staff/superusers see ALL active custom portals
    public.sv_is_staff_or_admin()
    -- Normal users only see portals they have active memberships for
    OR pm.portal_id IS NOT NULL
  );
$$;

-- Grant execute to authenticated and anon (anon will get empty list since auth.uid() is null)
GRANT EXECUTE ON FUNCTION sv_get_accessible_custom_portals() TO authenticated, anon;
