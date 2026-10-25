/*
# Peak6 Poker Power Setup

1. Set cover image on "Knowing When to Fold" spot for the Poker Power icon display.
2. Ensure Peak6account has an active portal membership in custom_portal_memberships
   for the poker-power portal so sv_get_accessible_custom_portals returns it on login.
*/

-- Set the cover image for "Knowing When to Fold" spot
UPDATE public.content_spots
SET cover_image_url = '/assets/portals/poker-power/image copy 8.png',
    updated_at = now()
WHERE id = '2c0256e6-213b-457b-b1d6-0f72ee7f725b';

-- Ensure Peak6account has a poker-power custom portal membership
DO $$
DECLARE
  v_user_id uuid;
  v_portal_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'peak6@spotvault.app';
  IF v_user_id IS NULL THEN RAISE NOTICE 'Peak6 user not found, skipping portal membership'; RETURN; END IF;

  SELECT id INTO v_portal_id FROM public.custom_portals WHERE slug = 'poker-power';
  IF v_portal_id IS NULL THEN RAISE NOTICE 'Poker Power portal not found, skipping'; RETURN; END IF;

  INSERT INTO public.custom_portal_memberships (
    user_id, portal_id, status, membership_tier, access_starts_at, access_expires_at,
    entitlement_package, created_at
  )
  VALUES (
    v_user_id, v_portal_id, 'active', 'full',
    now(), now() + interval '100 years',
    jsonb_build_object('full_access', true, 'lounge', true, 'community', true),
    now()
  )
  ON CONFLICT (user_id, portal_id) DO UPDATE SET
    status = 'active',
    access_expires_at = now() + interval '100 years';
END $$;

-- Also ensure Jordan (founder) has poker-power membership
DO $$
DECLARE
  v_jordan uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
  v_portal_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM public.custom_portals WHERE slug = 'poker-power';
  IF v_portal_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.custom_portal_memberships (
    user_id, portal_id, status, membership_tier, access_starts_at, access_expires_at,
    entitlement_package, created_at
  )
  VALUES (
    v_jordan, v_portal_id, 'active', 'full',
    now(), now() + interval '100 years',
    jsonb_build_object('full_access', true, 'lounge', true, 'community', true),
    now()
  )
  ON CONFLICT (user_id, portal_id) DO UPDATE SET
    status = 'active',
    access_expires_at = now() + interval '100 years';
END $$;
