/*
# Create Lounge Membership and Invite Code System

1. New Tables
- `lounge_memberships` — tracks which lounges each user has joined.
  - user_id (uuid, references auth.users)
  - lounge_slug (text, references lounge_configs.slug)
  - status (text: 'active', 'pending', 'revoked')
  - joined_at (timestamptz)
  - favorite (boolean, for quick-access pinning)
- `lounge_invite_codes` — invite codes that grant lounge membership on redemption.
  - code (text, unique)
  - lounge_slug (text, references lounge_configs.slug)
  - created_by (uuid, references auth.users)
  - active (boolean)
  - max_uses (int, null = unlimited)
  - uses (int, default 0)
  - expires_at (timestamptz, nullable)
  - created_at (timestamptz)

2. Security
- RLS enabled on both tables.
- lounge_memberships: users can read/update/delete their own memberships; inserts allowed for own user_id.
- lounge_invite_codes: staff-only read/write via sv_is_staff_or_admin() check.
- `sv_redeem_lounge_code` SECURITY DEFINER function validates a code, checks expiry/usage, creates membership if not already present, increments uses, and returns the lounge slug + name.

3. Important Notes
- Mirrors the existing `custom_portal_access_codes` + `sv_redeem_portal_code` pattern.
- Free users can join lounges — no membership-tier gating at the DB level.
- Multiple lounge memberships per user are supported.
- The unique constraint on (user_id, lounge_slug) prevents duplicate memberships.
*/

CREATE TABLE IF NOT EXISTS lounge_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lounge_slug text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  favorite boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, lounge_slug)
);

ALTER TABLE lounge_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lounge_memberships" ON lounge_memberships;
CREATE POLICY "select_own_lounge_memberships"
  ON lounge_memberships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lounge_memberships" ON lounge_memberships;
CREATE POLICY "insert_own_lounge_memberships"
  ON lounge_memberships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lounge_memberships" ON lounge_memberships;
CREATE POLICY "update_own_lounge_memberships"
  ON lounge_memberships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lounge_memberships" ON lounge_memberships;
CREATE POLICY "delete_own_lounge_memberships"
  ON lounge_memberships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lounge_memberships_user ON lounge_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_lounge_memberships_slug ON lounge_memberships(lounge_slug);

CREATE TABLE IF NOT EXISTS lounge_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  lounge_slug text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lounge_invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_lounge_invite_codes" ON lounge_invite_codes;
CREATE POLICY "staff_read_lounge_invite_codes"
  ON lounge_invite_codes FOR SELECT
  TO authenticated
  USING (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_lounge_invite_codes" ON lounge_invite_codes;
CREATE POLICY "staff_insert_lounge_invite_codes"
  ON lounge_invite_codes FOR INSERT
  TO authenticated
  WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_lounge_invite_codes" ON lounge_invite_codes;
CREATE POLICY "staff_update_lounge_invite_codes"
  ON lounge_invite_codes FOR UPDATE
  TO authenticated
  USING (sv_is_staff_or_admin())
  WITH CHECK (sv_is_staff_or_admin());

CREATE INDEX IF NOT EXISTS idx_lounge_invite_codes_slug ON lounge_invite_codes(lounge_slug);

-- Redemption function: validates a lounge invite code and creates membership
CREATE OR REPLACE FUNCTION sv_redeem_lounge_code(p_code text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record lounge_invite_codes%ROWTYPE;
  v_user uuid;
  v_lounge_name text;
  v_existing lounge_memberships%ROWTYPE;
BEGIN
  v_user := COALESCE(p_user_id, auth.uid());
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_record
  FROM lounge_invite_codes
  WHERE LOWER(code) = LOWER(p_code) AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive code');
  END IF;

  IF v_record.expires_at IS NOT NULL AND v_record.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has expired');
  END IF;

  IF v_record.max_uses IS NOT NULL AND v_record.uses >= v_record.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has reached its usage limit');
  END IF;

  SELECT * INTO v_existing
  FROM lounge_memberships
  WHERE user_id = v_user AND lounge_slug = v_record.lounge_slug;

  IF FOUND THEN
    SELECT name INTO v_lounge_name FROM lounge_configs WHERE slug = v_record.lounge_slug;
    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'lounge_slug', v_record.lounge_slug,
      'lounge_name', COALESCE(v_lounge_name, v_record.lounge_slug)
    );
  END IF;

  INSERT INTO lounge_memberships (user_id, lounge_slug, status)
  VALUES (v_user, v_record.lounge_slug, 'active');

  UPDATE lounge_invite_codes SET uses = uses + 1 WHERE id = v_record.id;

  SELECT name INTO v_lounge_name FROM lounge_configs WHERE slug = v_record.lounge_slug;

  RETURN jsonb_build_object(
    'success', true,
    'already_member', false,
    'lounge_slug', v_record.lounge_slug,
    'lounge_name', COALESCE(v_lounge_name, v_record.lounge_slug)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sv_redeem_lounge_code(text, uuid) TO anon, authenticated;

-- Ensure lounge_configs is readable by all
DROP POLICY IF EXISTS "anon_read_lounge_configs" ON lounge_configs;
CREATE POLICY "anon_read_lounge_configs"
  ON lounge_configs FOR SELECT
  TO anon, authenticated
  USING (true);
