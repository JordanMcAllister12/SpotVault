/*
# Create Partner Attribution & Entitlement System

## Purpose
Creates a reusable partner attribution system that tracks which strategic partner
(e.g., StakeKings) a SpotVault user is associated with. This is separate from the
user's role (Player, Coach, etc.) — a user can be a Player AND a StakeKings member.

## New Tables

### `partner_attributions`
Tracks the association between a SpotVault user and a strategic partner.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, NOT NULL) — the SpotVault user
- `partner_slug` (text, NOT NULL) — e.g., 'stakekings' (reusable for future partners)
- `status` (text, NOT NULL DEFAULT 'pending') — 'pending', 'verified', 'active', 'inactive', 'revoked'
- `referral_code` (text, nullable) — the code the user entered or was attributed via link
- `acquisition_source` (text, nullable) — 'referral_link', 'manual_code', 'admin_grant'
- `verified` (boolean, NOT NULL DEFAULT false) — whether the partner access is verified
- `entitlement_active` (boolean, NOT NULL DEFAULT false) — whether the entitlement is currently active
- `joined_at` (timestamptz, nullable) — when the user was associated with the partner
- `verified_at` (timestamptz, nullable) — when verification was completed
- `metadata` (jsonb, DEFAULT '{}') — extensible partner-specific data
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

Unique constraint on (user_id, partner_slug) — one attribution per partner per user.

### `partner_referral_codes`
Stores referral/access codes for partners. These are the codes users enter
during verification or that are embedded in referral links.
- `id` (uuid, primary key)
- `partner_slug` (text, NOT NULL) — which partner this code belongs to
- `code` (text, NOT NULL, UNIQUE) — the actual referral code
- `label` (text, nullable) — human-readable label (e.g., "Tyler's Affiliate Link")
- `max_uses` (integer, nullable) — NULL = unlimited
- `use_count` (integer, NOT NULL DEFAULT 0)
- `active` (boolean, NOT NULL DEFAULT true)
- `expires_at` (timestamptz, nullable)
- `created_at` (timestamptz, DEFAULT now())

### `partner_referral_links`
Tracks referral links for partners. These are pre-generated URLs that
partners (e.g., Tyler/StakeKings) can send to potential users.
- `id` (uuid, primary key)
- `partner_slug` (text, NOT NULL)
- `link_token` (text, NOT NULL, UNIQUE) — the unique token in the URL
- `label` (text, nullable) — who this link belongs to
- `max_uses` (integer, nullable) — NULL = unlimited
- `use_count` (integer, NOT NULL DEFAULT 0)
- `active` (boolean, NOT NULL DEFAULT true)
- `expires_at` (timestamptz, nullable)
- `created_at` (timestamptz, DEFAULT now())

## Security
- RLS enabled on all tables
- Users can read and manage their own partner attributions
- Referral codes and links are readable by authenticated users (needed for verification)
- Only service role can create/manage referral codes and links (admin function)
- Users can INSERT their own attribution row (self-service verification)
- Users can UPDATE their own attribution's verification fields

## Important Notes
1. The system is designed to be reusable for future partners — `partner_slug` is
   a generic text field, not hardcoded to 'stakekings'
2. Partner access is separate from user roles — no changes to existing role/portal system
3. The unique constraint on (user_id, partner_slug) prevents duplicate attributions
4. `acquisition_source` tracks HOW the user was attributed (link vs manual code vs admin)
5. `entitlement_active` is separate from `verified` — an admin can revoke entitlement
   without removing the verification record
*/

-- ============================================================
-- 1. PARTNER ATTRIBUTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_slug text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'active', 'inactive', 'revoked')),
  referral_code text,
  acquisition_source text CHECK (acquisition_source IN ('referral_link', 'manual_code', 'admin_grant')),
  verified boolean NOT NULL DEFAULT false,
  entitlement_active boolean NOT NULL DEFAULT false,
  joined_at timestamptz,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_attributions_user_partner_uniq
  ON partner_attributions (user_id, partner_slug);

CREATE INDEX IF NOT EXISTS partner_attributions_partner_idx
  ON partner_attributions (partner_slug);

CREATE INDEX IF NOT EXISTS partner_attributions_user_idx
  ON partner_attributions (user_id);

ALTER TABLE partner_attributions ENABLE ROW LEVEL SECURITY;

-- Users can read their own attributions
DROP POLICY IF EXISTS "select_own_attributions" ON partner_attributions;
CREATE POLICY "select_own_attributions"
ON partner_attributions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

-- Users can insert their own attribution (self-service verification)
DROP POLICY IF EXISTS "insert_own_attributions" ON partner_attributions;
CREATE POLICY "insert_own_attributions"
ON partner_attributions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own attribution (for verification flow)
DROP POLICY IF EXISTS "update_own_attributions" ON partner_attributions;
CREATE POLICY "update_own_attributions"
ON partner_attributions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No DELETE policy for users — only service role can remove attributions (admin revocation)

-- ============================================================
-- 2. PARTNER REFERRAL CODES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_slug text NOT NULL,
  code text NOT NULL UNIQUE,
  label text,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_referral_codes_partner_idx
  ON partner_referral_codes (partner_slug);

CREATE INDEX IF NOT EXISTS partner_referral_codes_active_idx
  ON partner_referral_codes (partner_slug) WHERE active = true;

ALTER TABLE partner_referral_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active referral codes (needed for verification)
DROP POLICY IF EXISTS "select_active_referral_codes" ON partner_referral_codes;
CREATE POLICY "select_active_referral_codes"
ON partner_referral_codes FOR SELECT
TO authenticated USING (active = true);

-- Only service role can insert/update/delete referral codes (admin function)
-- No INSERT/UPDATE/DELETE policies for authenticated = service role only

-- ============================================================
-- 3. PARTNER REFERRAL LINKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_slug text NOT NULL,
  link_token text NOT NULL UNIQUE,
  label text,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_referral_links_partner_idx
  ON partner_referral_links (partner_slug);

CREATE INDEX IF NOT EXISTS partner_referral_links_token_idx
  ON partner_referral_links (link_token) WHERE active = true;

ALTER TABLE partner_referral_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active referral links (needed for signup attribution)
DROP POLICY IF EXISTS "select_active_referral_links" ON partner_referral_links;
CREATE POLICY "select_active_referral_links"
ON partner_referral_links FOR SELECT
TO authenticated USING (active = true);

-- Only service role can insert/update/delete referral links (admin function)

-- ============================================================
-- 4. HELPER: Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_attributions_updated_at ON partner_attributions;
CREATE TRIGGER partner_attributions_updated_at
  BEFORE UPDATE ON partner_attributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. HELPER: Increment referral code use count
-- ============================================================

CREATE OR REPLACE FUNCTION increment_referral_code_use(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record RECORD;
BEGIN
  SELECT * INTO code_record
  FROM partner_referral_codes
  WHERE code = p_code AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF code_record.expires_at IS NOT NULL AND code_record.expires_at < now() THEN
    RETURN false;
  END IF;

  IF code_record.max_uses IS NOT NULL AND code_record.use_count >= code_record.max_uses THEN
    RETURN false;
  END IF;

  UPDATE partner_referral_codes
  SET use_count = use_count + 1
  WHERE code = p_code;

  RETURN true;
END;
$$;

-- ============================================================
-- 6. HELPER: Increment referral link use count
-- ============================================================

CREATE OR REPLACE FUNCTION increment_referral_link_use(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  link_record RECORD;
BEGIN
  SELECT * INTO link_record
  FROM partner_referral_links
  WHERE link_token = p_token AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF link_record.expires_at IS NOT NULL AND link_record.expires_at < now() THEN
    RETURN false;
  END IF;

  IF link_record.max_uses IS NOT NULL AND link_record.use_count >= link_record.max_uses THEN
    RETURN false;
  END IF;

  UPDATE partner_referral_links
  SET use_count = use_count + 1
  WHERE link_token = p_token;

  RETURN true;
END;
$$;

-- ============================================================
-- 7. SEED: Insert a default StakeKings referral code
-- ============================================================

INSERT INTO partner_referral_codes (partner_slug, code, label, active)
VALUES ('stakekings', 'SK-SPOTVAULT-2026', 'StakeKings x SpotVault Access Code', true)
ON CONFLICT (code) DO NOTHING;
