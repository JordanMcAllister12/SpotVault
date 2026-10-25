/*
# Add StakeKings staff management functions

## Purpose
Creates SECURITY DEFINER functions that allow SpotVault staff to:
1. Search for a user by username to resolve their auth UID
2. Grant StakeKings manager access to a user
3. Remove StakeKings manager access from a user
4. List all current StakeKings managers

These functions bypass the column-level REVOKE on stakekings_role
so only staff (via SECURITY DEFINER) can set the manager role.

## New Functions
- `sv_staff_search_user_by_username(p_username text)` — returns user_id, email, username, display_name
- `sv_grant_stakekings_manager(p_user_id uuid)` — grants stakekings_access=true, stakekings_role='manager'
- `sv_revoke_stakekings_manager(p_user_id uuid)` — sets stakekings_role='player' (keeps access)
- `sv_list_stakekings_managers()` — returns all users with stakekings_role='manager'

## Security
- All functions check that the CALLER has an active 'staff' role in sv_roles
- SECURITY DEFINER runs with the database owner's privileges, bypassing the
  column-level REVOKE on stakekings_role
- Search_path set to public to prevent path injection
- EXECUTE revoked from anon, granted to authenticated

## Important Notes
1. Only staff can call these functions — the staff role check is enforced inside each function
2. Granting manager access does NOT change the user's SpotVault roles or portal access
3. Revoking manager access sets role back to 'player' but keeps stakekings_access=true
4. The user must already have a partner_attributions row for stakekings
*/
-- ============================================================
-- 1. Staff search user by username
-- ============================================================
CREATE OR REPLACE FUNCTION sv_staff_search_user_by_username(p_username text)
RETURNS TABLE (
  user_id uuid,
  email text,
  username text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff role required';
  END IF;

  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.email,
    up.username,
    up.display_name
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.user_id = au.id::text
  WHERE up.username ILIKE p_username
     OR au.email ILIKE p_username;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_staff_search_user_by_username(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_staff_search_user_by_username(text) TO authenticated;

-- ============================================================
-- 2. Grant StakeKings manager access
-- ============================================================
CREATE OR REPLACE FUNCTION sv_grant_stakekings_manager(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff role required';
  END IF;

  -- Upsert the attribution with manager role
  INSERT INTO partner_attributions (
    user_id, partner_slug, status, acquisition_source,
    verified, entitlement_active, stakekings_role,
    joined_at, verified_at
  )
  VALUES (
    p_user_id, 'stakekings', 'active', 'admin_grant',
    true, true, 'manager',
    now(), now()
  )
  ON CONFLICT (user_id, partner_slug) DO UPDATE
    SET status = 'active',
        verified = true,
        entitlement_active = true,
        stakekings_role = 'manager',
        acquisition_source = COALESCE(partner_attributions.acquisition_source, 'admin_grant'),
        verified_at = COALESCE(partner_attributions.verified_at, now()),
        updated_at = now();

  -- Audit
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'entitlement_granted', p_user_id,
    jsonb_build_object('partner', 'stakekings', 'role', 'manager'));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_grant_stakekings_manager(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_grant_stakekings_manager(uuid) TO authenticated;

-- ============================================================
-- 3. Revoke StakeKings manager access (demote to player)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_revoke_stakekings_manager(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff role required';
  END IF;

  UPDATE partner_attributions
  SET stakekings_role = 'player',
      updated_at = now()
  WHERE user_id = p_user_id AND partner_slug = 'stakekings';

  -- Audit
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'entitlement_revoked', p_user_id,
    jsonb_build_object('partner', 'stakekings', 'action', 'demoted_to_player'));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_stakekings_manager(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_stakekings_manager(uuid) TO authenticated;

-- ============================================================
-- 4. List all StakeKings managers
-- ============================================================
CREATE OR REPLACE FUNCTION sv_list_stakekings_managers()
RETURNS TABLE (
  user_id uuid,
  email text,
  username text,
  display_name text,
  stakekings_role text,
  stakekings_test_override boolean,
  granted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff role required';
  END IF;

  RETURN QUERY
  SELECT
    pa.user_id,
    au.email,
    up.username,
    up.display_name,
    pa.stakekings_role,
    COALESCE(pa.stakekings_test_override, false),
    pa.verified_at
  FROM partner_attributions pa
  JOIN auth.users au ON au.id = pa.user_id
  LEFT JOIN user_profiles up ON up.user_id = au.id::text
  WHERE pa.partner_slug = 'stakekings'
    AND pa.stakekings_role = 'manager'
    AND pa.entitlement_active = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_list_stakekings_managers() FROM anon;
GRANT EXECUTE ON FUNCTION sv_list_stakekings_managers() TO authenticated;
