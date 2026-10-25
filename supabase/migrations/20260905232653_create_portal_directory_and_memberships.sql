/*
# Portal Directory and Membership System

1. New Tables
- portal_catalog: Configurable directory of available portals (partner + general)
- portal_memberships: User membership in a specific portal

2. Security
- portal_catalog: Public read for live/coming_soon rows. Staff read all + write.
- portal_memberships: Owner-scoped CRUD (authenticated, auth.uid() = user_id).
*/

CREATE TABLE IF NOT EXISTS portal_catalog (
  id text PRIMARY KEY,
  portal_type text NOT NULL DEFAULT 'general' CHECK (portal_type IN ('general', 'partner')),
  hub_id text,
  name text NOT NULL,
  operator text NOT NULL DEFAULT '',
  logo_url text,
  cover_url text,
  description text NOT NULL DEFAULT '',
  monthly_price_cents integer,
  annual_price_cents integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'coming_soon', 'live', 'private')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  stripe_product_id text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_portal_catalog" ON portal_catalog;
CREATE POLICY "public_read_portal_catalog" ON portal_catalog FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public' AND status IN ('live', 'coming_soon'));

DROP POLICY IF EXISTS "staff_read_all_portal_catalog" ON portal_catalog;
CREATE POLICY "staff_read_all_portal_catalog" ON portal_catalog FOR SELECT
  TO authenticated
  USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_portal_catalog" ON portal_catalog;
CREATE POLICY "staff_insert_portal_catalog" ON portal_catalog FOR INSERT
  TO authenticated
  WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_portal_catalog" ON portal_catalog;
CREATE POLICY "staff_update_portal_catalog" ON portal_catalog FOR UPDATE
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_delete_portal_catalog" ON portal_catalog;
CREATE POLICY "staff_delete_portal_catalog" ON portal_catalog FOR DELETE
  TO authenticated
  USING (public.sv_is_staff_or_admin());

CREATE TABLE IF NOT EXISTS portal_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_id text NOT NULL REFERENCES portal_catalog(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'invited', 'cancelled', 'past_due', 'staff_access')),
  membership_type text NOT NULL DEFAULT 'free' CHECK (membership_type IN ('free', 'paid_monthly', 'paid_annual', 'invite_only', 'complimentary', 'partner_granted')),
  stripe_subscription_id text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, portal_id)
);

ALTER TABLE portal_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_memberships" ON portal_memberships;
CREATE POLICY "select_own_memberships" ON portal_memberships FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_memberships" ON portal_memberships;
CREATE POLICY "insert_own_memberships" ON portal_memberships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_memberships" ON portal_memberships;
CREATE POLICY "update_own_memberships" ON portal_memberships FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_memberships" ON portal_memberships;
CREATE POLICY "delete_own_memberships" ON portal_memberships FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

INSERT INTO portal_catalog (id, portal_type, hub_id, name, operator, description, monthly_price_cents, features, status, sort_order)
VALUES
  ('stakekings', 'partner', 'STAKEKINGS_PLAYER', 'StakeKings Player Development', 'StakeKings', 'A dedicated player-development environment powered by StakeKings and SpotVault.', 0, '["Tournament hand analysis","Staking management","Performance tracking","Community access"]'::jsonb, 'coming_soon', 1),
  ('coach', 'general', 'COACH', 'Coach Portal', 'SpotVault', 'Workspace for coaches to manage students, analyze hands, organize content, schedule sessions and build their coaching business.', 5000, '["Student management","Hand review tools","Content publishing","Session scheduling","Booking marketplace"]'::jsonb, 'coming_soon', 2),
  ('creator', 'general', 'CREATOR', 'Creator Portal', 'SpotVault', 'Create and sell poker content. Publish courses, hand packs, and videos to the SpotVault marketplace.', 5000, '["Content publishing","Revenue dashboard","Audience tools","Marketplace access","Media management"]'::jsonb, 'coming_soon', 3),
  ('business', 'general', 'BUSINESS', 'Business Portal', 'SpotVault', 'Manage your poker business with CRM tools, campaign management, and industry directory access.', 5000, '["CRM dashboard","Campaign management","Industry directory","Business profile","Lead tracking"]'::jsonb, 'coming_soon', 4),
  ('media', 'general', 'MEDIA', 'Media Portal', 'SpotVault', 'Poker media workspace for journalists, broadcasters, and content curators.', 5000, '["Media management","Content scheduling","Press credentials","Event coverage","Distribution tools"]'::jsonb, 'coming_soon', 5),
  ('stable', 'general', 'STABLE', 'Stable Portal', 'SpotVault', 'Manage your poker stable with player tracking, staking management, and analytics.', 50000, '["Player management","Staking tracking","Profit sharing","Performance analytics","Coach assignment"]'::jsonb, 'coming_soon', 6)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sv_staff_list_memberships()
RETURNS TABLE (
  user_id uuid,
  portal_id text,
  status text,
  membership_type text,
  joined_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY SELECT user_id, portal_id, status, membership_type, joined_at, expires_at FROM portal_memberships ORDER BY joined_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_staff_list_memberships() TO authenticated;
