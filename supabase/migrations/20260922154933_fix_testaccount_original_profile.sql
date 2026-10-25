-- Fix the original testaccount@spotvault.com (without "1") to have a profile, role, and portal access
-- This account existed in auth.users but had no profile, role, or portal access linked

DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'testaccount@spotvault.com';
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'testaccount@spotvault.com not found in auth.users — skipping';
    RETURN;
  END IF;

  -- Create profile
  INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
  VALUES (v_user_id::text, 'Test Account', 'testaccount',
    'External review test account for SpotVault platform evaluation.',
    'Player', 'player', 'public', jsonb_build_object())
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, updated_at = now();

  -- Create role
  INSERT INTO sv_roles (user_id, role, status)
  VALUES (v_user_id, 'player', 'active')
  ON CONFLICT DO NOTHING;

  -- Create portal access
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_at)
  VALUES (v_user_id, 'player', 'active', now())
  ON CONFLICT DO NOTHING;

  -- Create community entitlements
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

  RAISE NOTICE 'Fixed testaccount@spotvault.com profile, role, and portal access';
END $$;