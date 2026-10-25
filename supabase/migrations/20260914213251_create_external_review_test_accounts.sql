/*
# Create Two External Review Test Accounts

Creates two dedicated external-review accounts for SpotVault platform evaluation.
These accounts have standard player-level access only — NO staff, admin, or
superuser roles. They are intended for temporary/revocable access by external
development agencies and technical reviewers.

## Accounts Created
1. Testaccount1 / VaultReview27! — email: testaccount1@spotvault.com
2. Testaccount2 / VaultReview27! — email: testaccount2@spotvault.com

## Access Granted
- Player portal access only
- Community entitlements (member tier) with standard user privileges
- SV entitlement for platform access
- Standard user-facing features: analytics, HH tools, marketplace, community, spots, etc.

## Access NOT Granted (intentionally excluded)
- NO staff role in sv_roles
- NO superuser role in sv_roles
- NO staff portal access in sv_portal_access
- NO StakeKings partner attribution or hub access
- NO network posting capability (requires staff approval)
- NO booking provider status
- NO creator permissions

## Security
- sv_is_staff_or_admin() returns FALSE for both accounts (no sv_roles entry)
- Direct navigation to staff/admin URLs is blocked server-side because
  all staff functions check sv_is_staff_or_admin() which queries sv_roles
- RLS policies on staff/admin tables require staff/superuser role
- Existing user roles and permissions are NOT modified

## Idempotency
- Each step checks for existing records before inserting
- Safe to re-run
*/

-- ============================================================
-- ACCOUNT 1: Testaccount1
-- ============================================================

-- 1a. Create auth user for Testaccount1
DO $$
DECLARE v_user_id uuid; v_email text := 'testaccount1@spotvault.com'; v_password text := 'VaultReview27!'; v_hash text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN RAISE NOTICE 'Testaccount1 auth user exists'; RETURN; END IF;
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false));
  RAISE NOTICE 'Created Testaccount1 auth user';
END $$;

-- 1b. Create user profile for Testaccount1
DO $$
DECLARE v_user_id uuid; v_email text := 'testaccount1@spotvault.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount1 auth user not found'; END IF;
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false) WHERE id = v_user_id;
  INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
  VALUES (v_user_id::text, 'Test Account 1', 'Testaccount1',
    'External review test account for SpotVault platform evaluation.',
    'Player', 'player', 'public', jsonb_build_object())
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
  RAISE NOTICE 'Created Testaccount1 profile';
END $$;

-- 1c. Grant player portal access for Testaccount1
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount1@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount1 auth user not found'; END IF;
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
  VALUES (v_user_id, 'player', 'active', NULL, now(), NULL)
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted Testaccount1 player portal access';
END $$;

-- 1d. Community entitlements for Testaccount1
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount1@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount1 auth user not found'; END IF;
  INSERT INTO community_entitlements (user_id, tier, is_paid_member, member_since, privileges, priority_weight)
  VALUES (v_user_id::text, 'member', false, now(),
    jsonb_build_object(
      'can_post_community', true,
      'can_post_network', false,
      'can_access_lounge', false,
      'can_access_solver', true,
      'can_access_marketplace', true,
      'can_access_coaching', true,
      'can_access_creator', true,
      'can_access_hand_replayer', true,
      'can_access_analytics', true
    ), 50)
  ON CONFLICT (user_id) DO UPDATE SET tier = 'member', privileges = EXCLUDED.privileges, priority_weight = EXCLUDED.priority_weight, updated_at = now();
  RAISE NOTICE 'Created Testaccount1 community entitlements';
END $$;

-- 1e. SV entitlement for Testaccount1
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount1@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount1 auth user not found'; END IF;
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
  VALUES (v_user_id, 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL,
    jsonb_build_object('description', 'External review access for Testaccount1'))
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Testaccount1 SV entitlement';
END $$;

-- ============================================================
-- ACCOUNT 2: Testaccount2
-- ============================================================

-- 2a. Create auth user for Testaccount2
DO $$
DECLARE v_user_id uuid; v_email text := 'testaccount2@spotvault.com'; v_password text := 'VaultReview27!'; v_hash text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN RAISE NOTICE 'Testaccount2 auth user exists'; RETURN; END IF;
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false));
  RAISE NOTICE 'Created Testaccount2 auth user';
END $$;

-- 2b. Create user profile for Testaccount2
DO $$
DECLARE v_user_id uuid; v_email text := 'testaccount2@spotvault.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount2 auth user not found'; END IF;
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false) WHERE id = v_user_id;
  INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
  VALUES (v_user_id::text, 'Test Account 2', 'Testaccount2',
    'External review test account for SpotVault platform evaluation.',
    'Player', 'player', 'public', jsonb_build_object())
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
  RAISE NOTICE 'Created Testaccount2 profile';
END $$;

-- 2c. Grant player portal access for Testaccount2
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount2@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount2 auth user not found'; END IF;
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
  VALUES (v_user_id, 'player', 'active', NULL, now(), NULL)
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted Testaccount2 player portal access';
END $$;

-- 2d. Community entitlements for Testaccount2
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount2@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount2 auth user not found'; END IF;
  INSERT INTO community_entitlements (user_id, tier, is_paid_member, member_since, privileges, priority_weight)
  VALUES (v_user_id::text, 'member', false, now(),
    jsonb_build_object(
      'can_post_community', true,
      'can_post_network', false,
      'can_access_lounge', false,
      'can_access_solver', true,
      'can_access_marketplace', true,
      'can_access_coaching', true,
      'can_access_creator', true,
      'can_access_hand_replayer', true,
      'can_access_analytics', true
    ), 50)
  ON CONFLICT (user_id) DO UPDATE SET tier = 'member', privileges = EXCLUDED.privileges, priority_weight = EXCLUDED.priority_weight, updated_at = now();
  RAISE NOTICE 'Created Testaccount2 community entitlements';
END $$;

-- 2e. SV entitlement for Testaccount2
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount2@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Testaccount2 auth user not found'; END IF;
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
  VALUES (v_user_id, 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL,
    jsonb_build_object('description', 'External review access for Testaccount2'))
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Testaccount2 SV entitlement';
END $$;

-- ============================================================
-- VERIFICATION: Confirm no staff/admin roles exist for either account
-- ============================================================
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM sv_roles r
  JOIN auth.users u ON u.id = r.user_id
  WHERE u.email IN ('testaccount1@spotvault.com', 'testaccount2@spotvault.com')
  AND r.role IN ('staff', 'superuser');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: Review account has staff/superuser role';
  END IF;
  RAISE NOTICE 'VERIFICATION PASSED: No staff/superuser roles on review accounts';
END $$;
