/*
# Create StakeKings Tyler Executive Account (v5)

Creates a privileged Partner Executive / StakeKings Admin account for Tyler Hancock.
Tyler has broad access to all portals and features but is NOT a superuser.
Jordan remains the sole superuser.
*/

-- 1. Create auth user
DO $$
DECLARE v_user_id uuid; v_email text := 'StakeKingsTyler@spotvault.com'; v_password text := 'SK-Tyler#9274Vault'; v_hash text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN RAISE NOTICE 'User exists'; RETURN; END IF;
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false));
  RAISE NOTICE 'Created auth user';
END $$;

-- 2. Create user profile
DO $$
DECLARE v_user_id uuid; v_email text := 'StakeKingsTyler@spotvault.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false) WHERE id = v_user_id;
  INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
  VALUES (v_user_id::text, 'StakeKings Tyler', 'StakeKingsTyler',
    'CEO at StakeKings. Passionate about player development and the poker community.',
    'Executive', 'player', 'public',
    jsonb_build_object('twitter', 'https://twitter.com/StakeKings', 'website', 'https://www.stakekings.com'))
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, bio = EXCLUDED.bio, poker_role = EXCLUDED.poker_role, primary_role = EXCLUDED.primary_role, updated_at = now();
  RAISE NOTICE 'Created user profile';
END $$;

-- 3. Grant staff role
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at) VALUES (v_user_id, 'staff', 'active', v_jordan_id, now()) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted staff role';
END $$;

-- 4. Grant portal access
DO $$
DECLARE v_user_id uuid; v_portal_types text[] := ARRAY['player', 'coach', 'stable', 'business', 'creator', 'staff']; v_portal text; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  FOREACH v_portal IN ARRAY v_portal_types LOOP
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at) VALUES (v_user_id, v_portal, 'active', v_jordan_id, now(), NULL) ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Granted portal access';
END $$;

-- 5. StakeKings partner attribution with manager role
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO partner_attributions (user_id, partner_slug, status, acquisition_source, verified, entitlement_active, stakekings_role, joined_at, verified_at, metadata)
  VALUES (v_user_id, 'stakekings', 'active', 'admin_grant', true, true, 'manager', now(), now(), jsonb_build_object('title', 'CEO', 'display_name', 'StakeKings Tyler'))
  ON CONFLICT (user_id, partner_slug) DO UPDATE SET status = 'active', verified = true, entitlement_active = true, stakekings_role = 'manager', metadata = jsonb_build_object('title', 'CEO', 'display_name', 'StakeKings Tyler'), updated_at = now();
  RAISE NOTICE 'Created StakeKings attribution';
END $$;

-- 6. StakeKings hub access
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO partner_hub_access (user_id, partner_slug, access_granted, granted_by, granted_at) VALUES (v_user_id, 'stakekings', true, v_jordan_id, now()) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted StakeKings hub access';
END $$;

-- 7. Community entitlements (tier=member, paid)
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO community_entitlements (user_id, tier, is_paid_member, member_since, privileges, priority_weight)
  VALUES (v_user_id::text, 'member', true, now(), jsonb_build_object('can_post_community', true, 'can_post_network', true, 'can_access_lounge', true, 'can_access_solver', true, 'can_access_marketplace', true, 'can_access_coaching', true, 'can_access_creator', true, 'can_access_hand_replayer', true, 'can_access_analytics', true), 100)
  ON CONFLICT (user_id) DO UPDATE SET tier = 'member', is_paid_member = true, privileges = EXCLUDED.privileges, priority_weight = EXCLUDED.priority_weight, updated_at = now();
  RAISE NOTICE 'Created community entitlements';
END $$;

-- 8. SV entitlements
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
  VALUES (v_user_id, 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL, jsonb_build_object('description', 'Full platform access for StakeKings executive'))
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created SV entitlements';
END $$;

-- 9. Network posting capability
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, granted_at) VALUES (v_user_id, 'network_post', 'active', v_jordan_id, now()) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted network posting capability';
END $$;

-- 10. Password recovery credential (no unique constraint on username+temp_password, so check first)
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM password_recovery_credentials WHERE username = 'stakekingstyler';
  IF v_count = 0 THEN
    INSERT INTO password_recovery_credentials (username, temp_password, consumed) VALUES ('stakekingstyler', 'SK-Tyler#9274Vault', false);
  ELSE
    UPDATE password_recovery_credentials SET temp_password = 'SK-Tyler#9274Vault', consumed = false, consumed_at = NULL WHERE username = 'stakekingstyler';
  END IF;
  RAISE NOTICE 'Created password recovery credential';
END $$;
