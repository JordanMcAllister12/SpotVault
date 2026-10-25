/*
# Create account-level membership system

1. membership_tiers — defines the membership tiers (FREE, CORE, ELITE, PRO)
2. user_memberships — tracks which user has which membership tier
3. Update portal_catalog with correct pricing and 'live' status
*/

-- Membership tiers table
CREATE TABLE IF NOT EXISTS membership_tiers (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_membership_tiers" ON membership_tiers;
CREATE POLICY "read_membership_tiers"
ON membership_tiers FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "staff_write_membership_tiers" ON membership_tiers;
CREATE POLICY "staff_write_membership_tiers"
ON membership_tiers FOR ALL
TO authenticated
USING (public.sv_is_staff_or_admin())
WITH CHECK (public.sv_is_staff_or_admin());

-- Seed the membership tiers
INSERT INTO membership_tiers (id, name, monthly_price_cents, description, features, sort_order) VALUES
  ('free', 'Free', 0, 'The default SpotVault experience with access to the Player Portal.', '["Player Portal access","Basic hand history review","Community feed access","Public content browsing"]'::jsonb, 0),
  ('core', 'Core', 999, 'Enhanced analytics and study tools for serious players.', '["Everything in Free","Advanced hand history analysis","Board analysis","Position analytics","Save up to 500 hands","Community posting"]'::jsonb, 1),
  ('elite', 'Elite', 2999, 'Professional-grade tools for dedicated players and coaches.', '["Everything in Core","Solver access","Preflop reference ranges","Save up to 5,000 hands","HH Jukebox","Spot sharing"]'::jsonb, 2),
  ('pro', 'Pro', 9999, 'Full access to all SpotVault professional tools and features.', '["Everything in Elite","Unlimited hand storage","Priority solver jobs","Advanced exports","Early access features","Pro badge"]'::jsonb, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- User memberships table (one per account)
CREATE TABLE IF NOT EXISTS user_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id text NOT NULL REFERENCES membership_tiers(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_membership" ON user_memberships;
CREATE POLICY "read_own_membership"
ON user_memberships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_membership" ON user_memberships;
CREATE POLICY "insert_own_membership"
ON user_memberships FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_membership" ON user_memberships;
CREATE POLICY "update_own_membership"
ON user_memberships FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_read_memberships" ON user_memberships;
CREATE POLICY "staff_read_memberships"
ON user_memberships FOR SELECT
TO authenticated
USING (public.sv_is_staff_or_admin());

-- Auto-grant free membership + player portal to new users
CREATE OR REPLACE FUNCTION public.auto_grant_new_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  INSERT INTO user_memberships (user_id, tier_id, status)
  VALUES (v_user_id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO portal_memberships (user_id, portal_id, status, membership_type)
  VALUES (v_user_id, 'player', 'subscribed', 'free')
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_grant_new_user() TO authenticated;

-- Add per_user_price_cents to portal_catalog
ALTER TABLE portal_catalog ADD COLUMN IF NOT EXISTS per_user_price_cents integer DEFAULT 0;

-- Update portal_catalog with correct pricing and 'live' status
UPDATE portal_catalog SET
  monthly_price_cents = 5000,
  status = 'live',
  description = 'Professional creator profile, content publishing, content management, spot/content creation tools, marketplace selling tools, and creator services.',
  features = '["Professional creator profile","Content publishing","Content management","Spot/content creation tools","Marketplace selling tools","Creator services"]'::jsonb
WHERE id = 'creator';

UPDATE portal_catalog SET
  monthly_price_cents = 5000,
  status = 'live',
  description = 'Professional coaching profile, coaching services/rates, student management, booking/service tools, student communication, Sync Share, hand-history sharing, analysis/workspace sharing.',
  features = '["Professional coaching profile","Coaching services and rates","Student management","Booking and service tools","Student communication","Sync Share","Hand-history sharing","Analysis and workspace sharing"]'::jsonb
WHERE id = 'coach';

UPDATE portal_catalog SET
  monthly_price_cents = 50000,
  per_user_price_cents = 3000,
  status = 'live',
  description = 'Stable management environment, player roster management, player analytics, player development tools, study functionality, solver-related functionality, internal communication, stable administration.',
  features = '["Stable management environment","Player roster management","Player analytics","Player development tools","Study functionality","Solver-related functionality","Internal communication","Stable administration","Management and oversight tools"]'::jsonb
WHERE id = 'stable';

UPDATE portal_catalog SET
  monthly_price_cents = 5000,
  status = 'live',
  description = 'Professional business profile, business/service listings, marketplace presence, booking/meeting functionality, business management tools, industry visibility.',
  features = '["Professional business profile","Business and service listings","Marketplace presence","Booking and meeting functionality","Business management tools","Industry visibility"]'::jsonb
WHERE id = 'business';

UPDATE portal_catalog SET
  monthly_price_cents = 5000,
  status = 'live',
  description = 'Professional media profile, publishing tools, content management, media/content distribution, industry visibility.',
  features = '["Professional media profile","Publishing tools","Content management","Media and content distribution","Industry visibility"]'::jsonb
WHERE id = 'media';

-- Ensure player portal exists in catalog
INSERT INTO portal_catalog (id, name, hub_id, monthly_price_cents, status, description, features, sort_order)
VALUES ('player', 'Player Portal', 'PLAYER', 0, 'live', 'The default SpotVault environment. Free for every registered account.', '["Player Portal access","Basic hand history review","Community feed","Public content browsing"]'::jsonb, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  hub_id = EXCLUDED.hub_id,
  monthly_price_cents = 0,
  status = 'live',
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  sort_order = 0;
