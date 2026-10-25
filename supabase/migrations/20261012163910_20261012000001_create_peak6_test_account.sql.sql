-- Create PEAK6 test account with Poker Power portal access
-- Standard user, no admin privileges, auto-redirects to Poker Power portal

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'peak6@spotvault.app';
  v_password text := 'Pokerpower1!';
  v_hash text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'PEAK6 user already exists, updating password';
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;
    RETURN;
  END IF;

  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false)
  );

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'sub', v_user_id::text,
    'email', v_email,
    'email_verified', true,
    'phone_verified', false
  )
  WHERE id = v_user_id;
END $$;

-- ── User profile ──────────────────────────────────────────────
DO $$
DECLARE
  v_user_id text;
BEGIN
  SELECT id::text INTO v_user_id FROM auth.users WHERE email = 'peak6@spotvault.app';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'PEAK6 auth user not found'; END IF;

  INSERT INTO public.user_profiles (
    user_id, username, display_name, bio, primary_role, poker_role, title,
    privacy_mode, is_verified, is_discoverable
  )
  VALUES (
    v_user_id,
    'Peak6account',
    'PEAK6 Test Account',
    'Poker Power community test account',
    'player',
    'Player',
    '',
    'public',
    false,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    primary_role = EXCLUDED.primary_role,
    poker_role = EXCLUDED.poker_role,
    updated_at = now();
END $$;

-- ── Player role grant ─────────────────────────────────────────
DO $$
DECLARE
  v_user_id uuid;
  v_jordan uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'peak6@spotvault.app';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'PEAK6 user not found'; END IF;

  INSERT INTO public.sv_roles (user_id, role, status, approved_by, created_at)
  VALUES (v_user_id, 'player', 'active', v_jordan, now())
  ON CONFLICT (user_id, role) DO UPDATE SET status = 'active';
END $$;

-- ── Portal access (player only) ───────────────────────────────
DO $$
DECLARE
  v_user_id uuid;
  v_jordan uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'peak6@spotvault.app';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'PEAK6 user not found'; END IF;

  INSERT INTO public.sv_portal_access (user_id, portal_type, status, approved_by, created_at)
  VALUES (v_user_id, 'player', 'active', v_jordan, now())
  ON CONFLICT (user_id, portal_type) DO UPDATE SET status = 'active';
END $$;

-- ── Community entitlements ────────────────────────────────────
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'peak6@spotvault.app';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'PEAK6 user not found'; END IF;

  INSERT INTO public.community_entitlements (
    user_id, tier, is_paid_member, privileges, priority_weight, created_at, updated_at
  )
  VALUES (
    v_user_id,
    'member',
    true,
    jsonb_build_object(
      'can_post_community', true,
      'can_access_lounge', true,
      'can_access_solver', false,
      'can_access_analytics', false
    ),
    50,
    now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    is_paid_member = EXCLUDED.is_paid_member,
    privileges = EXCLUDED.privileges,
    updated_at = now();
END $$;

-- ── SV entitlements ───────────────────────────────────────────
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'peak6@spotvault.app';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'PEAK6 user not found'; END IF;

  INSERT INTO public.sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, granted_at, metadata)
  VALUES (
    v_user_id,
    'platform',
    gen_random_uuid(),
    'subscription',
    'admin_grant',
    now(),
    jsonb_build_object('granted_by', 'system', 'reason', 'poker_power_test_account')
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ── Password recovery credential ──────────────────────────────
DO $$
BEGIN
  DELETE FROM public.password_recovery_credentials WHERE username = 'peak6account';
  INSERT INTO public.password_recovery_credentials (username, temp_password, consumed, created_at)
  VALUES ('peak6account', 'Pokerpower1!', false, now());
END $$;
