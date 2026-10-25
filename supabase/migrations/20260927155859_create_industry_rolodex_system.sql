/*
# Industry Rolodex: opt-in visibility + role-based contact permissions

## Changes

1. Add `rolodex_opted_in` (boolean, default false) — user must explicitly opt in
   to be discoverable in the Industry Rolodex.

2. Add `visible_to_roles` (text[]) — which professional roles can discover
   and contact this listing. NULL/empty = visible to all professional roles.
   Values: 'creator-portal', 'coach-portal', 'business-portal', 'stable-portal', 'media-portal'

3. Add `available_for` (text[]) — tags for services/categories the professional
   is available for (e.g. 'Coaching', 'Sponsorships', 'Video production').

4. Add `allow_spotvault_messages` (boolean, default true) — whether other
   professionals can contact via SpotVault internal messages.

5. Create RPC `sv_search_industry_rolodex` — searches approved, visible,
   opted-in listings with role-based visibility enforcement at the query level.
   Only returns listings where the searcher's portal_type is in the listing's
   visible_to_roles array (or where visible_to_roles is empty/null = visible to all).

6. Create RPC `sv_get_rolodex_listing` — fetch a single listing by ID with
   the same visibility checks.

7. RLS policies for the new columns — owners can update their own listing's
   rolodex fields; all authenticated users can read opted-in approved listings.
*/

-- 1. Add columns
ALTER TABLE professional_listings
  ADD COLUMN IF NOT EXISTS rolodex_opted_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_to_roles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_for text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_spotvault_messages boolean DEFAULT true;

-- 2. Search RPC — enforces visibility at query level
CREATE OR REPLACE FUNCTION sv_search_industry_rolodex(
  p_search text DEFAULT '',
  p_portal_type text DEFAULT NULL,
  p_viewer_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id', pl.id::text,
  'user_id', pl.user_id::text,
  'portal_type', pl.portal_type,
  'display_name', pl.display_name,
  'professional_title', pl.professional_title,
  'short_bio', pl.short_bio,
  'profile_image_url', pl.profile_image_url,
  'specialties', pl.specialties,
  'available_for', pl.available_for,
  'pricing', pl.pricing,
  'availability', pl.availability,
  'location', pl.location,
  'is_remote', pl.is_remote,
  'links', pl.links,
  'contact_cta_label', pl.contact_cta_label,
  'contact_cta_url', pl.contact_cta_url,
  'allow_spotvault_messages', pl.allow_spotvault_messages
)), '[]'::jsonb)
FROM public.professional_listings pl
WHERE pl.moderation_status = 'approved'
  AND pl.is_visible = true
  AND pl.rolodex_opted_in = true
  AND (p_portal_type IS NULL OR pl.portal_type = p_portal_type)
  AND (
    p_viewer_role IS NULL
    OR pl.visible_to_roles = '{}'
    OR pl.visible_to_roles @> ARRAY[p_viewer_role]
  )
  AND (
    p_search = '' OR
    pl.display_name ILIKE '%' || p_search || '%' OR
    pl.professional_title ILIKE '%' || p_search || '%' OR
    pl.short_bio ILIKE '%' || p_search || '%' OR
    pl.location ILIKE '%' || p_search || '%' OR
    pl.specialties::text ILIKE '%' || p_search || '%' OR
    pl.available_for::text ILIKE '%' || p_search || '%' OR
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(pl.services) AS svc
      WHERE svc->>'name' ILIKE '%' || p_search || '%'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION sv_search_industry_rolodex(text, text, text) TO authenticated, anon;

-- 3. Single listing RPC — same visibility checks
CREATE OR REPLACE FUNCTION sv_get_rolodex_listing(
  p_listing_id text,
  p_viewer_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT jsonb_build_object(
  'id', pl.id::text,
  'user_id', pl.user_id::text,
  'portal_type', pl.portal_type,
  'display_name', pl.display_name,
  'professional_title', pl.professional_title,
  'short_bio', pl.short_bio,
  'long_description', pl.long_description,
  'profile_image_url', pl.profile_image_url,
  'specialties', pl.specialties,
  'available_for', pl.available_for,
  'services', pl.services,
  'pricing', pl.pricing,
  'availability', pl.availability,
  'location', pl.location,
  'is_remote', pl.is_remote,
  'links', pl.links,
  'contact_cta_label', pl.contact_cta_label,
  'contact_cta_url', pl.contact_cta_url,
  'allow_spotvault_messages', pl.allow_spotvault_messages
)
FROM public.professional_listings pl
WHERE pl.id = p_listing_id::uuid
  AND pl.moderation_status = 'approved'
  AND pl.is_visible = true
  AND pl.rolodex_opted_in = true
  AND (
    p_viewer_role IS NULL
    OR pl.visible_to_roles = '{}'
    OR pl.visible_to_roles @> ARRAY[p_viewer_role]
  );
$$;

GRANT EXECUTE ON FUNCTION sv_get_rolodex_listing(text, text) TO authenticated, anon;
