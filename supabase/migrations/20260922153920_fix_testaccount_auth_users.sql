/*
# Fix Testaccount1 and Testaccount2 login

## Root Cause
The auth.users entries for testaccount1@spotvault.com and testaccount2@spotvault.com
were deleted (likely by the clean_fake_data migration), but their user_profiles
entries remained. The sv_resolve_login_email RPC does an INNER JOIN between
auth.users and user_profiles, so the orphaned profiles can't resolve to an email,
causing "Invalid username, email, or password" at login.

## Fix
Recreate the auth.users entries with the original password (VaultReview27!)
and link them to the existing user_profiles entries by updating the profile
user_id to match the new auth user id.
*/

-- ============================================================
-- ACCOUNT 1: Testaccount1
-- ============================================================

DO $$
DECLARE 
  v_user_id uuid; 
  v_email text := 'testaccount1@spotvault.com'; 
  v_password text := 'VaultReview27!'; 
  v_hash text;
  v_old_profile_user_id text;
BEGIN
  -- Check if auth user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Testaccount1 auth user already exists (id=%)', v_user_id;
  ELSE
    -- Create the auth user
    v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false))
    RETURNING id INTO v_user_id;
    
    -- Update raw_user_meta_data with the new user id
    UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false)
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Created Testaccount1 auth user (id=%), password=%', v_user_id, v_password;
  END IF;

  -- Link the existing profile to the new auth user id
  -- The old profile has user_id = '93f046c8-3a5e-450b-8198-19936d18d8f8'
  -- We need to update it to the new auth user id
  SELECT user_id INTO v_old_profile_user_id FROM user_profiles WHERE username = 'Testaccount1';
  IF v_old_profile_user_id IS NOT NULL AND v_old_profile_user_id != v_user_id::text THEN
    -- Delete the old orphaned profile and create a new one linked to the new auth user
    DELETE FROM user_profiles WHERE user_id = v_old_profile_user_id;
    INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
    VALUES (v_user_id::text, 'Test Account 1', 'Testaccount1',
      'External review test account for SpotVault platform evaluation.',
      'Player', 'player', 'public', jsonb_build_object())
    ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
    RAISE NOTICE 'Relinked Testaccount1 profile from % to %', v_old_profile_user_id, v_user_id;
  ELSIF v_old_profile_user_id IS NULL THEN
    -- No profile exists at all, create one
    INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
    VALUES (v_user_id::text, 'Test Account 1', 'Testaccount1',
      'External review test account for SpotVault platform evaluation.',
      'Player', 'player', 'public', jsonb_build_object())
    ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
    RAISE NOTICE 'Created Testaccount1 profile (id=%)', v_user_id;
  ELSE
    RAISE NOTICE 'Testaccount1 profile already linked to correct auth user';
  END IF;

  -- Ensure portal access
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
  VALUES (v_user_id, 'player', 'active', NULL, now(), NULL)
  ON CONFLICT DO NOTHING;

  -- Ensure community entitlements
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

  -- Ensure SV entitlement
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
  VALUES (v_user_id, 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL,
    jsonb_build_object('description', 'External review access for Testaccount1'))
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- ACCOUNT 2: Testaccount2
-- ============================================================

DO $$
DECLARE 
  v_user_id uuid; 
  v_email text := 'testaccount2@spotvault.com'; 
  v_password text := 'VaultReview27!'; 
  v_hash text;
  v_old_profile_user_id text;
BEGIN
  -- Check if auth user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Testaccount2 auth user already exists (id=%)', v_user_id;
  ELSE
    -- Create the auth user
    v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false))
    RETURNING id INTO v_user_id;
    
    -- Update raw_user_meta_data with the new user id
    UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false)
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Created Testaccount2 auth user (id=%), password=%', v_user_id, v_password;
  END IF;

  -- Link the existing profile to the new auth user id
  SELECT user_id INTO v_old_profile_user_id FROM user_profiles WHERE username = 'Testaccount2';
  IF v_old_profile_user_id IS NOT NULL AND v_old_profile_user_id != v_user_id::text THEN
    DELETE FROM user_profiles WHERE user_id = v_old_profile_user_id;
    INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
    VALUES (v_user_id::text, 'Test Account 2', 'Testaccount2',
      'External review test account for SpotVault platform evaluation.',
      'Player', 'player', 'public', jsonb_build_object())
    ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
    RAISE NOTICE 'Relinked Testaccount2 profile from % to %', v_old_profile_user_id, v_user_id;
  ELSIF v_old_profile_user_id IS NULL THEN
    INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
    VALUES (v_user_id::text, 'Test Account 2', 'Testaccount2',
      'External review test account for SpotVault platform evaluation.',
      'Player', 'player', 'public', jsonb_build_object())
    ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
    RAISE NOTICE 'Created Testaccount2 profile (id=%)', v_user_id;
  ELSE
    RAISE NOTICE 'Testaccount2 profile already linked to correct auth user';
  END IF;

  -- Ensure portal access
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
  VALUES (v_user_id, 'player', 'active', NULL, now(), NULL)
  ON CONFLICT DO NOTHING;

  -- Ensure community entitlements
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

  -- Ensure SV entitlement
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
  VALUES (v_user_id, 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL,
    jsonb_build_object('description', 'External review access for Testaccount2'))
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE v_count int;
BEGIN
  -- Verify auth users exist
  SELECT count(*) INTO v_count FROM auth.users 
  WHERE email IN ('testaccount1@spotvault.com', 'testaccount2@spotvault.com');
  IF v_count != 2 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 2 auth users, found %', v_count;
  END IF;
  
  -- Verify profiles are linked
  SELECT count(*) INTO v_count FROM user_profiles up
  JOIN auth.users au ON au.id::text = up.user_id
  WHERE up.username IN ('Testaccount1', 'Testaccount2');
  IF v_count != 2 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 2 linked profiles, found %', v_count;
  END IF;
  
  -- Verify no staff/admin roles
  SELECT count(*) INTO v_count FROM sv_roles r
  JOIN auth.users u ON u.id = r.user_id
  WHERE u.email IN ('testaccount1@spotvault.com', 'testaccount2@spotvault.com')
  AND r.role IN ('staff', 'superuser');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: Review account has staff/superuser role';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: Both test accounts have auth users, linked profiles, and no staff roles';
END $$;
