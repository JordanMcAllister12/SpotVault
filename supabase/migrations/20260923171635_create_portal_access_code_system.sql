-- ============================================================
-- Portal Access Code System — reusable infrastructure for
-- custom partner/community portals (e.g. Manitoba Poker Network)
-- Uses custom_portal_* prefix to avoid conflicts with existing tables.
-- ============================================================

-- 1. Custom portals registry
CREATE TABLE IF NOT EXISTS public.custom_portals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  name          text NOT NULL,
  base_portal   text NOT NULL DEFAULT 'PLAYER',
  active        boolean NOT NULL DEFAULT true,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_portals_slug_unique UNIQUE (slug)
);

-- 2. Portal access codes
CREATE TABLE IF NOT EXISTS public.custom_portal_access_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id           uuid NOT NULL REFERENCES public.custom_portals(id) ON DELETE CASCADE,
  code                text NOT NULL,
  code_hash           text NOT NULL,
  active              boolean NOT NULL DEFAULT true,
  valid_from          timestamptz,
  valid_until         timestamptz,
  redemption_limit    integer,
  redemption_count    integer NOT NULL DEFAULT 0,
  access_duration_months integer NOT NULL DEFAULT 6,
  membership_tier     text NOT NULL DEFAULT 'full',
  credit_grant       integer NOT NULL DEFAULT 0,
  entitlement_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_users_only     boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  CONSTRAINT custom_portal_access_codes_hash_unique UNIQUE (code_hash)
);

-- 3. Custom portal memberships (separate from existing portal_memberships)
CREATE TABLE IF NOT EXISTS public.custom_portal_memberships (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  portal_id           uuid NOT NULL REFERENCES public.custom_portals(id) ON DELETE CASCADE,
  source_code         text,
  redeemed_at         timestamptz NOT NULL DEFAULT now(),
  access_starts_at    timestamptz NOT NULL DEFAULT now(),
  access_expires_at   timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'active',
  membership_tier     text NOT NULL DEFAULT 'full',
  entitlement_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_portal_memberships_user_portal_unique UNIQUE (user_id, portal_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_portal_access_codes_portal ON public.custom_portal_access_codes(portal_id);
CREATE INDEX IF NOT EXISTS idx_custom_portal_memberships_user ON public.custom_portal_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_portal_memberships_portal ON public.custom_portal_memberships(portal_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.custom_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_portal_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_portal_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_active_custom_portals" ON public.custom_portals
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "staff_manage_custom_portals" ON public.custom_portals
  FOR ALL TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

CREATE POLICY "staff_manage_access_codes" ON public.custom_portal_access_codes
  FOR ALL TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

CREATE POLICY "read_own_custom_memberships" ON public.custom_portal_memberships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "staff_read_all_custom_memberships" ON public.custom_portal_memberships
  FOR SELECT TO authenticated
  USING (public.sv_is_staff_or_admin());

-- ============================================================
-- Redemption function (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sv_redeem_portal_code(
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_code_hash   text := lower(trim(p_code));
  v_access_code public.custom_portal_access_codes;
  v_portal      public.custom_portals;
  v_existing    public.custom_portal_memberships;
  v_expires_at  timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_access_code
  FROM public.custom_portal_access_codes
  WHERE code_hash = v_code_hash AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired code');
  END IF;

  IF v_access_code.valid_from IS NOT NULL AND now() < v_access_code.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code is not yet active');
  END IF;
  IF v_access_code.valid_until IS NOT NULL AND now() > v_access_code.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code has expired');
  END IF;

  IF v_access_code.redemption_limit IS NOT NULL AND v_access_code.redemption_count >= v_access_code.redemption_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code has reached its redemption limit');
  END IF;

  SELECT * INTO v_portal FROM public.custom_portals WHERE id = v_access_code.portal_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Portal is not active');
  END IF;

  SELECT * INTO v_existing
  FROM public.custom_portal_memberships
  WHERE user_id = v_user_id AND portal_id = v_portal.id;

  IF FOUND THEN
    IF v_existing.status = 'active' AND v_existing.access_expires_at > now() THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'You already have access to ' || v_portal.name,
        'already_member', true,
        'portal_slug', v_portal.slug,
        'portal_name', v_portal.name
      );
    END IF;
    v_expires_at := now() + (v_access_code.access_duration_months || ' months')::interval;
    UPDATE public.custom_portal_memberships
    SET status = 'active',
        access_starts_at = now(),
        access_expires_at = v_expires_at,
        source_code = v_access_code.code,
        membership_tier = v_access_code.membership_tier,
        entitlement_package = v_access_code.entitlement_package
    WHERE id = v_existing.id;
  ELSE
    v_expires_at := now() + (v_access_code.access_duration_months || ' months')::interval;
    INSERT INTO public.custom_portal_memberships (
      user_id, portal_id, source_code, redeemed_at,
      access_starts_at, access_expires_at, status,
      membership_tier, entitlement_package
    ) VALUES (
      v_user_id, v_portal.id, v_access_code.code, now(),
      now(), v_expires_at, 'active',
      v_access_code.membership_tier, v_access_code.entitlement_package
    );
  END IF;

  UPDATE public.custom_portal_access_codes
  SET redemption_count = redemption_count + 1
  WHERE id = v_access_code.id;

  RETURN jsonb_build_object(
    'ok', true,
    'portal_slug', v_portal.slug,
    'portal_name', v_portal.name,
    'portal_id', v_portal.id::text,
    'base_portal', v_portal.base_portal,
    'access_expires_at', v_expires_at,
    'config', v_portal.config
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_redeem_portal_code TO authenticated;

-- ============================================================
-- Get current user's active custom portal memberships
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_get_my_portal_memberships()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'portal_id', pm.portal_id::text,
    'portal_slug', cp.slug,
    'portal_name', cp.name,
    'base_portal', cp.base_portal,
    'config', cp.config,
    'status', pm.status,
    'access_expires_at', pm.access_expires_at,
    'membership_tier', pm.membership_tier,
    'entitlement_package', pm.entitlement_package
  )), '[]'::jsonb)
  FROM public.custom_portal_memberships pm
  JOIN public.custom_portals cp ON cp.id = pm.portal_id
  WHERE pm.user_id = auth.uid()
    AND pm.status = 'active'
    AND pm.access_expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.sv_get_my_portal_memberships() TO authenticated;

-- ============================================================
-- Staff function: get all portal members for a given portal
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_get_portal_members(p_portal_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', pm.user_id::text,
    'source_code', pm.source_code,
    'redeemed_at', pm.redeemed_at,
    'access_expires_at', pm.access_expires_at,
    'status', pm.status,
    'membership_tier', pm.membership_tier
  )), '[]'::jsonb)
  FROM public.custom_portal_memberships pm
  WHERE pm.portal_id = p_portal_id;
$$;

GRANT EXECUTE ON FUNCTION public.sv_get_portal_members(uuid) TO authenticated;

-- ============================================================
-- Seed: Manitoba Poker Network portal + access code
-- ============================================================
INSERT INTO public.custom_portals (slug, name, base_portal, active, config)
VALUES (
  'manitoba-poker-network',
  'Manitoba Poker Network',
  'PLAYER',
  true,
  jsonb_build_object(
    'backgrounds', jsonb_build_object(
      'lounge', '/assets/portals/manitoba-lounge.webp',
      'community', '/assets/portals/manitoba-community.webp'
    ),
    'logo', '/assets/portals/manitoba-logo.svg',
    'communityId', 'manitoba',
    'themeOverrides', jsonb_build_object()
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  base_portal = EXCLUDED.base_portal,
  active = EXCLUDED.active,
  config = EXCLUDED.config,
  updated_at = now();

INSERT INTO public.custom_portal_access_codes (
  portal_id, code, code_hash, active,
  access_duration_months, membership_tier, credit_grant,
  entitlement_package, new_users_only
)
SELECT
  cp.id,
  'MBPoker2026',
  'mbpoker2026',
  true,
  6,
  'full',
  0,
  jsonb_build_object(
    'solver', true,
    'analytics', true,
    'content', true,
    'community', true,
    'multiSpot', true
  ),
  false
FROM public.custom_portals cp
WHERE cp.slug = 'manitoba-poker-network'
ON CONFLICT (code_hash) DO UPDATE SET
  active = true,
  access_duration_months = 6,
  membership_tier = 'full',
  entitlement_package = EXCLUDED.entitlement_package;
