/*
# Mystery Vault, Announcements, and Player Progression infrastructure

1. New Tables
- `mystery_vault_rewards` — reward inventory with retail value, actual cost, quantity, rarity, probability weight, category, active status
- `mystery_vault_distribution` — reward distribution log with recipient, reward, source, status, staff adjustment tracking
- `mystery_vault_config` — single-row config table for distribution rate (0-100%)
- `mystery_vault_audit` — immutable audit trail for inventory changes, probability changes, reversals
- `player_progression` — per-user XP, level (1-100), prestige class, lifetime XP
- `staff_announcements` — announcements with title, rich-text body, image, status, pinned, author, publish date

2. Security
- RLS enabled on all tables
- Staff check uses sv_is_staff_or_admin() function (existing)
- SELECT policies for authenticated users on distribution log (own rows) and announcements (published only)
- Owner-scoped SELECT on player_progression
*/

-- Mystery Vault reward inventory
CREATE TABLE IF NOT EXISTS mystery_vault_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'custom',
  retail_value numeric(10,2) NOT NULL DEFAULT 0,
  actual_cost numeric(10,2) NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  unlimited_inventory boolean NOT NULL DEFAULT false,
  rarity text NOT NULL DEFAULT 'common',
  probability_weight integer NOT NULL DEFAULT 100,
  eligibility_restrictions jsonb DEFAULT '{}',
  expiration_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mystery_vault_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_rewards" ON mystery_vault_rewards;
CREATE POLICY "staff_select_rewards" ON mystery_vault_rewards FOR SELECT
  TO authenticated USING (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_rewards" ON mystery_vault_rewards;
CREATE POLICY "staff_insert_rewards" ON mystery_vault_rewards FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_rewards" ON mystery_vault_rewards;
CREATE POLICY "staff_update_rewards" ON mystery_vault_rewards FOR UPDATE
  TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_delete_rewards" ON mystery_vault_rewards;
CREATE POLICY "staff_delete_rewards" ON mystery_vault_rewards FOR DELETE
  TO authenticated USING (sv_is_staff_or_admin());

-- Mystery Vault distribution log
CREATE TABLE IF NOT EXISTS mystery_vault_distribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_name text,
  reward_id uuid REFERENCES mystery_vault_rewards(id) ON DELETE SET NULL,
  reward_name text NOT NULL,
  retail_value numeric(10,2) NOT NULL DEFAULT 0,
  actual_cost numeric(10,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'awarded',
  staff_adjustment text,
  distributed_at timestamptz DEFAULT now(),
  redeemed_at timestamptz
);

ALTER TABLE mystery_vault_distribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_distribution" ON mystery_vault_distribution;
CREATE POLICY "staff_select_distribution" ON mystery_vault_distribution FOR SELECT
  TO authenticated USING (sv_is_staff_or_admin() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "staff_insert_distribution" ON mystery_vault_distribution;
CREATE POLICY "staff_insert_distribution" ON mystery_vault_distribution FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_distribution" ON mystery_vault_distribution;
CREATE POLICY "staff_update_distribution" ON mystery_vault_distribution FOR UPDATE
  TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());

-- Mystery Vault config (single row)
CREATE TABLE IF NOT EXISTS mystery_vault_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_rate integer NOT NULL DEFAULT 50,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE mystery_vault_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed_select_config" ON mystery_vault_config;
CREATE POLICY "authed_select_config" ON mystery_vault_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_update_config" ON mystery_vault_config;
CREATE POLICY "staff_update_config" ON mystery_vault_config FOR UPDATE
  TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_config" ON mystery_vault_config;
CREATE POLICY "staff_insert_config" ON mystery_vault_config FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

INSERT INTO mystery_vault_config (id, distribution_rate)
VALUES ('00000000-0000-0000-0000-000000000001', 50)
ON CONFLICT (id) DO NOTHING;

-- Mystery Vault audit trail (immutable)
CREATE TABLE IF NOT EXISTS mystery_vault_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  staff_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mystery_vault_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_audit" ON mystery_vault_audit;
CREATE POLICY "staff_select_audit" ON mystery_vault_audit FOR SELECT
  TO authenticated USING (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_audit" ON mystery_vault_audit;
CREATE POLICY "staff_insert_audit" ON mystery_vault_audit FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

-- Player progression (XP, levels 1-100, prestige classes)
CREATE TABLE IF NOT EXISTS player_progression (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp bigint NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  prestige_class text NOT NULL DEFAULT 'bronze',
  lifetime_xp bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE player_progression ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_progression" ON player_progression;
CREATE POLICY "select_own_progression" ON player_progression FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_progression" ON player_progression;
CREATE POLICY "insert_own_progression" ON player_progression FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_progression" ON player_progression;
CREATE POLICY "update_own_progression" ON player_progression FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_select_progression" ON player_progression;
CREATE POLICY "staff_select_progression" ON player_progression FOR SELECT
  TO authenticated USING (sv_is_staff_or_admin());

-- Staff announcements
CREATE TABLE IF NOT EXISTS staff_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body_html text,
  image_url text,
  status text NOT NULL DEFAULT 'draft',
  is_pinned boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_announcements" ON staff_announcements;
CREATE POLICY "public_select_announcements" ON staff_announcements FOR SELECT
  TO authenticated USING (status = 'published');

DROP POLICY IF EXISTS "staff_select_announcements" ON staff_announcements;
CREATE POLICY "staff_select_announcements" ON staff_announcements FOR SELECT
  TO authenticated USING (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_announcements" ON staff_announcements;
CREATE POLICY "staff_insert_announcements" ON staff_announcements FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_announcements" ON staff_announcements;
CREATE POLICY "staff_update_announcements" ON staff_announcements FOR UPDATE
  TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_delete_announcements" ON staff_announcements;
CREATE POLICY "staff_delete_announcements" ON staff_announcements FOR DELETE
  TO authenticated USING (sv_is_staff_or_admin());

CREATE INDEX IF NOT EXISTS idx_mvd_recipient ON mystery_vault_distribution(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mvd_distributed_at ON mystery_vault_distribution(distributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_status ON staff_announcements(status);
CREATE INDEX IF NOT EXISTS idx_sa_published_at ON staff_announcements(published_at DESC);
