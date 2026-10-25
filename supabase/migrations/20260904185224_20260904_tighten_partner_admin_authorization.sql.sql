/*
# Add superuser authorization check to partner admin functions

The SECURITY DEFINER functions for granting/revoking partner hub access and
correcting acquisition source previously only checked that the caller was
authenticated (auth.uid() IS NOT NULL). This meant ANY authenticated user
could call them, not just admins.

This migration adds a check that the caller has a 'superuser' role in
user_profiles before allowing the operation.
*/

-- Helper: check if the current caller is a superuser
CREATE OR REPLACE FUNCTION sv_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM user_profiles WHERE id = auth.uid();
  RETURN v_role = 'superuser';
END;
$$;

GRANT EXECUTE ON FUNCTION sv_is_admin() TO authenticated;

-- Patch sv_grant_partner_hub_access to require admin
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
  IF NOT sv_is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
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

-- Patch sv_revoke_partner_hub_access to require admin
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
  IF NOT sv_is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
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

-- Patch sv_correct_acquisition_source to require admin
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
  IF NOT sv_is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
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
