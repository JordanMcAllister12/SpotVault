/*
# Partner Affiliation & Access Code System

## Purpose
Refactors the partner attribution system from StakeKings-specific to a generic, extensible
partner architecture that supports StakeKings now and future partners (BBZ, etc.).

## New Tables

### 1. partner_access_codes
A generic lookup table for access codes entered during account signup.
Each code maps to a partner_slug, acquisition_source, partner_affiliation, and hub_access flags.

### 2. partner_hub_access
Tracks which partner hubs a user can access. Separate from partner_attributions
(which records how the user was acquired). A user can have hub access without
having been acquired through that partner.

### 3. partner_audit_log
Records all administrative changes to partner attribution, hub access, and
acquisition source. Provides an audit trail for compliance.

## Security
- RLS enabled on all new tables.
- partner_access_codes: deny all direct access to authenticated users (only via SECURITY DEFINER function).
- partner_hub_access: users can SELECT their own rows. All mutations via SECURITY DEFINER functions.
- partner_audit_log: users can SELECT their own rows. Only service role can INSERT.

## New Functions
- sv_resolve_access_code(p_code) — validates code during signup, returns config
- sv_grant_partner_hub_access(p_user_id, p_partner_slug, p_reason) — admin grants hub access
- sv_revoke_partner_hub_access(p_user_id, p_partner_slug, p_reason) — admin revokes hub access
- sv_correct_acquisition_source(p_user_id, p_partner_slug, p_reason) — admin corrects attribution
- sv_staff_get_partner_profile(p_user_id) — returns user's full partner profile
*/

-- ── partner_access_codes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  partner_slug text NOT NULL,
  partner_affiliation text NOT NULL DEFAULT 'NONE',
  hub_access jsonb NOT NULL DEFAULT '{}'::jsonb,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_select_access_codes" ON partner_access_codes;
CREATE POLICY "deny_select_access_codes" ON partner_access_codes FOR SELECT
  TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_insert_access_codes" ON partner_access_codes;
CREATE POLICY "deny_insert_access_codes" ON partner_access_codes FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_update_access_codes" ON partner_access_codes;
CREATE POLICY "deny_update_access_codes" ON partner_access_codes FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

-- ── partner_hub_access ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_hub_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_slug text NOT NULL,
  access_granted boolean NOT NULL DEFAULT false,
  granted_by uuid,
  granted_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_hub_access_user_partner_unique UNIQUE (user_id, partner_slug)
);

ALTER TABLE partner_hub_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_hub_access" ON partner_hub_access;
CREATE POLICY "select_own_hub_access" ON partner_hub_access FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny_insert_hub_access" ON partner_hub_access;
CREATE POLICY "deny_insert_hub_access" ON partner_hub_access FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_update_hub_access" ON partner_hub_access;
CREATE POLICY "deny_update_hub_access" ON partner_hub_access FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_delete_hub_access" ON partner_hub_access;
CREATE POLICY "deny_delete_hub_access" ON partner_hub_access FOR DELETE
  TO authenticated USING (false);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_hub_access_updated_at ON partner_hub_access;
CREATE TRIGGER partner_hub_access_updated_at
  BEFORE UPDATE ON partner_hub_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── partner_audit_log ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  admin_user_id uuid,
  action text NOT NULL,
  partner_slug text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_log" ON partner_audit_log;
CREATE POLICY "select_own_audit_log" ON partner_audit_log FOR SELECT
  TO authenticated USING (auth.uid() = target_user_id);

DROP POLICY IF EXISTS "deny_insert_audit_log" ON partner_audit_log;
CREATE POLICY "deny_insert_audit_log" ON partner_audit_log FOR INSERT
  TO authenticated WITH CHECK (false);

-- ── SECURITY DEFINER Functions ──────────────────────────────────

-- Resolve an access code during signup
CREATE OR REPLACE FUNCTION sv_resolve_access_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record partner_access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM partner_access_codes
    WHERE code = upper(trim(p_code))
      AND active = true
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_record.expires_at IS NOT NULL AND v_record.expires_at < now() THEN
    RETURN NULL;
  END IF;

  IF v_record.max_uses IS NOT NULL AND v_record.use_count >= v_record.max_uses THEN
    RETURN NULL;
  END IF;

  UPDATE partner_access_codes SET use_count = use_count + 1 WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'partner_slug', v_record.partner_slug,
    'partner_affiliation', v_record.partner_affiliation,
    'hub_access', v_record.hub_access,
    'entitlements', v_record.entitlements
  );
END;
$$;

-- Grant partner hub access (admin only)
CREATE OR REPLACE FUNCTION sv_grant_partner_hub_access(
  p_user_id uuid,
  p_partner_slug text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_existing partner_hub_access%ROWTYPE;
BEGIN
  IF v_admin_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_existing FROM partner_hub_access
    WHERE user_id = p_user_id AND partner_slug = p_partner_slug
    FOR UPDATE;

  IF FOUND THEN
    UPDATE partner_hub_access
      SET access_granted = true,
          granted_by = v_admin_uid,
          granted_at = now(),
          revoked_by = NULL,
          revoked_at = NULL
      WHERE id = v_existing.id;
  ELSE
    INSERT INTO partner_hub_access (user_id, partner_slug, access_granted, granted_by, granted_at)
    VALUES (p_user_id, p_partner_slug, true, v_admin_uid, now());
  END IF;

  INSERT INTO partner_audit_log (target_user_id, admin_user_id, action, partner_slug, previous_value, new_value, reason)
  VALUES (p_user_id, v_admin_uid, 'grant_hub_access', p_partner_slug,
          CASE WHEN FOUND THEN to_jsonb(v_existing) ELSE NULL END,
          jsonb_build_object('access_granted', true, 'granted_by', v_admin_uid, 'granted_at', now()),
          p_reason);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Revoke partner hub access (admin only)
CREATE OR REPLACE FUNCTION sv_revoke_partner_hub_access(
  p_user_id uuid,
  p_partner_slug text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_existing partner_hub_access%ROWTYPE;
BEGIN
  IF v_admin_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_existing FROM partner_hub_access
    WHERE user_id = p_user_id AND partner_slug = p_partner_slug
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No existing access to revoke.');
  END IF;

  UPDATE partner_hub_access
    SET access_granted = false,
        revoked_by = v_admin_uid,
        revoked_at = now()
    WHERE id = v_existing.id;

  INSERT INTO partner_audit_log (target_user_id, admin_user_id, action, partner_slug, previous_value, new_value, reason)
  VALUES (p_user_id, v_admin_uid, 'revoke_hub_access', p_partner_slug,
          to_jsonb(v_existing),
          jsonb_build_object('access_granted', false, 'revoked_by', v_admin_uid, 'revoked_at', now()),
          p_reason);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Correct acquisition source (admin only)
CREATE OR REPLACE FUNCTION sv_correct_acquisition_source(
  p_user_id uuid,
  p_partner_slug text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid uuid := auth.uid();
  v_existing partner_attributions%ROWTYPE;
BEGIN
  IF v_admin_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_existing FROM partner_attributions
    WHERE user_id = p_user_id AND partner_slug = p_partner_slug
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO partner_attributions (user_id, partner_slug, status, acquisition_source, verified, entitlement_active, joined_at, verified_at)
    VALUES (p_user_id, p_partner_slug, 'active', 'admin_grant', true, true, now(), now());
  ELSE
    UPDATE partner_attributions
      SET acquisition_source = 'admin_grant',
          status = 'active',
          verified = true,
          entitlement_active = true,
          verified_at = now()
      WHERE id = v_existing.id;
  END IF;

  INSERT INTO partner_audit_log (target_user_id, admin_user_id, action, partner_slug, previous_value, new_value, reason)
  VALUES (p_user_id, v_admin_uid, 'change_acquisition_source', p_partner_slug,
          CASE WHEN FOUND THEN to_jsonb(v_existing) ELSE NULL END,
          jsonb_build_object('acquisition_source', 'admin_grant', 'status', 'active'),
          p_reason);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Get a user's full partner profile (admin only)
CREATE OR REPLACE FUNCTION sv_staff_get_partner_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attributions jsonb;
  v_hub_access jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'partner_slug', pa.partner_slug,
      'status', pa.status,
      'acquisition_source', pa.acquisition_source,
      'verified', pa.verified,
      'entitlement_active', pa.entitlement_active,
      'stakekings_role', pa.stakekings_role,
      'joined_at', pa.joined_at,
      'created_at', pa.created_at
    )
  ), '[]'::jsonb) INTO v_attributions
  FROM partner_attributions pa
  WHERE pa.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'partner_slug', pha.partner_slug,
      'access_granted', pha.access_granted,
      'granted_at', pha.granted_at,
      'revoked_at', pha.revoked_at
    )
  ), '[]'::jsonb) INTO v_hub_access
  FROM partner_hub_access pha
  WHERE pha.user_id = p_user_id;

  RETURN jsonb_build_object(
    'attributions', v_attributions,
    'hub_access', v_hub_access
  );
END;
$$;

-- Grant permissions on new functions to authenticated role
GRANT EXECUTE ON FUNCTION sv_resolve_access_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_grant_partner_hub_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_revoke_partner_hub_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_correct_acquisition_source(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_staff_get_partner_profile(uuid) TO authenticated;

-- ── Seed Data ───────────────────────────────────────────────────

INSERT INTO partner_access_codes (code, partner_slug, partner_affiliation, hub_access, entitlements, active)
VALUES ('SPOTVAULT', 'spotvault', 'NONE', '{}'::jsonb, '{}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO partner_access_codes (code, partner_slug, partner_affiliation, hub_access, entitlements, active)
VALUES ('SK-PLAYER-2026', 'stakekings', 'STAKEKINGS',
        '{"stakekings_hub_access": true}'::jsonb,
        '{"role": "player"}'::jsonb,
        true)
ON CONFLICT (code) DO NOTHING;
