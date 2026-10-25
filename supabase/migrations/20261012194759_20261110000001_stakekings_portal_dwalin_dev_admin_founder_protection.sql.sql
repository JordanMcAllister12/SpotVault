/*
# StakeKings Custom Portal, Dwalin Developer Admin, Founder Protection, Spot Difficulty Corrections

## Summary
1. Adds StakeKings as a proper entry in `custom_portals` so it appears in the Custom portal directory.
2. Grants the founder a `custom_portal_memberships` row for StakeKings.
3. Updates `sv_roles` CHECK constraint to include `developer_admin`.
4. Creates the Dwalin developer account in `auth.users` (all NULL fields set to defaults, phone=NULL to avoid unique constraint conflict).
5. Inserts Dwalin's profile, roles (developer_admin + player), and portal access (player + staff).
6. Updates `sv_is_staff_or_admin()` to recognize `developer_admin`.
7. Creates SECURITY DEFINER founder-protection functions: sv_admin_update_user_status, sv_admin_delete_user, sv_admin_grant_role.
8. Corrects difficulty values on 5 content_spots.
9. Updates Poker Power portal config lounge name to "Poker Power Lounge".

## Security
- sv_admin_* functions are SECURITY DEFINER with SET search_path = public, EXECUTE granted to authenticated only.
- Founder (superuser) accounts protected: developer_admin cannot delete/suspend/demote/modify them.
- Developer_admin cannot promote itself or create superusers.
- Column-level REVOKE UPDATE on sv_roles from authenticated.
*/

-- ============================================================
-- 1. ADD STAKEKINGS TO custom_portals
-- ============================================================
INSERT INTO custom_portals (slug, name, base_portal, active, category, config)
VALUES (
  'stakekings',
  'StakeKings',
  'PLAYER',
  true,
  'partner',
  jsonb_build_object(
    'lounge', jsonb_build_object('name', 'StakeKings Lounge', 'channel', 'community'),
    'backgrounds', jsonb_build_object('lounge', '', 'community', ''),
    'communityId', 'stakekings',
    'themeOverrides', jsonb_build_object('text', '#f5f5f5', 'accent', '#ff6b35', 'surface', '#1a1a2e')
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  active = true,
  category = EXCLUDED.category,
  config = EXCLUDED.config,
  updated_at = now();

-- ============================================================
-- 2. GRANT FOUNDER StakeKings CUSTOM_PORTAL_MEMBERSHIP
-- ============================================================
INSERT INTO custom_portal_memberships (user_id, portal_id, status, source_code, membership_tier, access_starts_at, access_expires_at, entitlement_package)
SELECT
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  cp.id,
  'active',
  'founder_demo',
  'full',
  now(),
  now() + interval '100 years',
  jsonb_build_object('solver', true, 'content', true, 'analytics', true, 'community', true, 'multiSpot', true)
FROM custom_portals cp
WHERE cp.slug = 'stakekings'
ON CONFLICT (user_id, portal_id) DO UPDATE SET
  status = 'active',
  membership_tier = 'full',
  access_expires_at = now() + interval '100 years',
  redeemed_at = now();

-- ============================================================
-- 3. UPDATE sv_roles CHECK CONSTRAINT to include developer_admin
-- ============================================================
DO $$ BEGIN
  ALTER TABLE sv_roles DROP CONSTRAINT IF EXISTS sv_roles_role_check;
END $$;

DO $$ BEGIN
  ALTER TABLE sv_roles ADD CONSTRAINT sv_roles_role_check
    CHECK (role IN ('player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff', 'superuser', 'admin', 'owner', 'moderator', 'universal_access', 'developer_admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. CREATE DWALIN DEVELOPER ACCOUNT in auth.users
-- ============================================================
DO $$
DECLARE
  v_dwalin_id uuid := gen_random_uuid();
  v_founder_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  -- Insert auth.users row with phone=NULL (empty string violates unique constraint)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone,
    phone_change,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_dwalin_id,
    'authenticated',
    'authenticated',
    'dwalin@spotvault.app',
    crypt('Dwalin1!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    NULL,
    '',
    now(),
    now(),
    NULL,
    '{}'::jsonb,
    jsonb_build_object('username', 'dwalin_dev', 'display_name', 'Dwalin')
  )
  ON CONFLICT (id) DO NOTHING;

  -- user_profiles
  INSERT INTO user_profiles (user_id, username, display_name, primary_role, poker_role, privacy_mode)
  VALUES (v_dwalin_id::text, 'dwalin_dev', 'Dwalin', 'player', '', 'public')
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    updated_at = now();

  -- sv_roles: developer_admin (primary) + player (base)
  INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at)
  VALUES
    (v_dwalin_id, 'developer_admin', 'active', v_founder_id, now()),
    (v_dwalin_id, 'player', 'active', v_founder_id, now())
  ON CONFLICT (user_id, role) DO UPDATE SET
    status = 'active',
    approved_by = v_founder_id,
    approved_at = now(),
    updated_at = now();

  -- sv_portal_access: player (base) + staff (for Staff Room access)
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
  VALUES
    (v_dwalin_id, 'player', 'active', v_founder_id, now()),
    (v_dwalin_id, 'staff', 'active', v_founder_id, now())
  ON CONFLICT (user_id, portal_type) DO UPDATE SET
    status = 'active',
    approved_by = v_founder_id,
    approved_at = now(),
    updated_at = now();

  -- lounge_memberships: default SpotVault (is_default=false, no auto-redirect)
  INSERT INTO lounge_memberships (user_id, lounge_slug, status, role, is_default, favorite)
  VALUES (v_dwalin_id, 'spotvault', 'active', 'member', false, false)
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- 5. UPDATE sv_is_staff_or_admin() to recognize developer_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_is_staff_or_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'developer_admin')
    AND status = 'active'
  );
END;
$$;

-- ============================================================
-- 6. FOUNDER PROTECTION: sv_admin_update_user_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_admin_update_user_status(p_target_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_is_superuser boolean;
  v_target_is_superuser boolean;
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'revoked', 'pending') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = auth.uid() AND role = 'superuser' AND status = 'active'
  ) INTO v_caller_is_superuser;

  SELECT EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = p_target_id AND role = 'superuser' AND status = 'active'
  ) INTO v_target_is_superuser;

  IF v_target_is_superuser AND NOT v_caller_is_superuser THEN
    RAISE EXCEPTION 'Cannot modify a superuser account';
  END IF;

  IF p_status IN ('suspended', 'revoked') AND NOT v_caller_is_superuser THEN
    IF EXISTS (SELECT 1 FROM sv_roles WHERE user_id = p_target_id AND role = 'developer_admin' AND status = 'active') THEN
      RAISE EXCEPTION 'Only the founder can suspend a developer admin';
    END IF;
  END IF;

  UPDATE sv_roles SET status = p_status, updated_at = now() WHERE user_id = p_target_id;

  IF p_status IN ('suspended', 'revoked') THEN
    UPDATE sv_portal_access SET status = p_status, updated_at = now() WHERE user_id = p_target_id;
  ELSIF p_status = 'active' THEN
    UPDATE sv_portal_access SET status = 'active', updated_at = now() WHERE user_id = p_target_id;
  END IF;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'role_revoked', p_target_id, jsonb_build_object('new_status', p_status));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sv_admin_update_user_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.sv_admin_update_user_status(uuid, text) TO authenticated;

-- ============================================================
-- 7. FOUNDER PROTECTION: sv_admin_delete_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_admin_delete_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_is_superuser boolean;
  v_target_is_superuser boolean;
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = auth.uid() AND role = 'superuser' AND status = 'active'
  ) INTO v_caller_is_superuser;

  SELECT EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = p_target_id AND role = 'superuser' AND status = 'active'
  ) INTO v_target_is_superuser;

  IF v_target_is_superuser AND NOT v_caller_is_superuser THEN
    RAISE EXCEPTION 'Cannot delete a superuser account';
  END IF;

  IF NOT v_caller_is_superuser AND EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = p_target_id AND role = 'developer_admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only the founder can delete a developer admin';
  END IF;

  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  DELETE FROM sv_roles WHERE user_id = p_target_id;
  DELETE FROM auth.users WHERE id = p_target_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'role_revoked', p_target_id, jsonb_build_object('action', 'deleted'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sv_admin_delete_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sv_admin_delete_user(uuid) TO authenticated;

-- ============================================================
-- 8. FOUNDER PROTECTION: sv_admin_grant_role
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_admin_grant_role(p_target_id uuid, p_role text, p_action text DEFAULT 'grant')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_is_superuser boolean;
  v_target_is_superuser boolean;
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff', 'superuser', 'admin', 'owner', 'moderator', 'universal_access', 'developer_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_action NOT IN ('grant', 'revoke') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = auth.uid() AND role = 'superuser' AND status = 'active'
  ) INTO v_caller_is_superuser;

  IF p_role IN ('superuser', 'owner') AND NOT v_caller_is_superuser THEN
    RAISE EXCEPTION 'Only the founder can grant superuser access';
  END IF;

  IF p_role = 'superuser' AND p_target_id = auth.uid() AND NOT v_caller_is_superuser THEN
    RAISE EXCEPTION 'Cannot promote yourself to superuser';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM sv_roles WHERE user_id = p_target_id AND role = 'superuser' AND status = 'active'
  ) INTO v_target_is_superuser;

  IF v_target_is_superuser AND NOT v_caller_is_superuser THEN
    RAISE EXCEPTION 'Cannot modify roles on a superuser account';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at)
    VALUES (p_target_id, p_role, 'active', auth.uid(), now())
    ON CONFLICT (user_id, role) DO UPDATE
      SET status = 'active', approved_by = auth.uid(), approved_at = now(), updated_at = now();

    IF p_role IN ('staff', 'developer_admin') THEN
      INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
      VALUES (p_target_id, 'staff', 'active', auth.uid(), now())
      ON CONFLICT (user_id, portal_type) DO UPDATE
        SET status = 'active', approved_by = auth.uid(), approved_at = now(), updated_at = now();
    END IF;
  ELSE
    UPDATE sv_roles SET status = 'revoked', updated_at = now()
    WHERE user_id = p_target_id AND role = p_role;

    IF p_role IN ('staff', 'developer_admin') THEN
      UPDATE sv_portal_access SET status = 'revoked', updated_at = now()
      WHERE user_id = p_target_id AND portal_type = 'staff';
    END IF;
  END IF;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_action = 'grant' THEN 'role_granted' ELSE 'role_revoked' END, p_target_id, jsonb_build_object('role', p_role));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sv_admin_grant_role(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.sv_admin_grant_role(uuid, text, text) TO authenticated;

-- ============================================================
-- 9. COLUMN-LEVEL REVOKE on sv_roles
-- ============================================================
REVOKE UPDATE ON sv_roles FROM authenticated;

-- ============================================================
-- 10. CORRECT SPOT DIFFICULTY VALUES
-- ============================================================
UPDATE content_spots SET difficulty = 'beginner', updated_at = now()
WHERE title ILIKE 'Knowing When to Fold%' AND difficulty = 'easy';

UPDATE content_spots SET difficulty = 'advanced', updated_at = now()
WHERE title ILIKE 'Interesting River Decision%' AND difficulty IS DISTINCT FROM 'advanced';

UPDATE content_spots SET difficulty = 'advanced', updated_at = now()
WHERE title ILIKE 'Heads up Spot%' AND difficulty IS DISTINCT FROM 'advanced';

UPDATE content_spots SET difficulty = 'advanced', updated_at = now()
WHERE title ILIKE 'The Difference Between Good%Great%';

UPDATE content_spots SET difficulty = 'advanced', updated_at = now()
WHERE title ILIKE 'Foxen in the Hen House%';

-- ============================================================
-- 11. UPDATE POKER POWER LOUNGE CONFIG NAME
-- ============================================================
UPDATE custom_portals
SET config = jsonb_set(config, '{lounge,name}', '"Poker Power Lounge"'),
    updated_at = now()
WHERE slug = 'poker-power';
