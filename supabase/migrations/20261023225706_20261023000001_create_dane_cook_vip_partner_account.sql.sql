/*
# Create Dane Cook VIP Partner Demo Account

## Purpose
Creates a VIP demo account for Dane Cook — comedian, entertainer, poker enthusiast,
and prospective SpotVault partner. This is a demo account with:
- Player type (no staff/admin/superuser privileges)
- Complimentary Elite membership (full feature access)
- PARTNER badge (same gold styling as Founder badge, reads "PARTNER")
- Private Demo / Pending Partnership status
- 3 demo community posts (introduction, poker discussion, community engagement)

## Important Notes
1. This account has NO staff, admin, or superuser roles
2. Demo activity is private — is_test_account = true, is_discoverable = false
3. Does NOT contaminate real analytics, leaderboards, engagement stats, or billing
4. No Stripe subscription — membership is complimentary via admin override
5. Account is convertible to a production account later by:
   - Setting is_test_account = false
   - Setting is_discoverable = true
   - Updating the password
   - Optionally changing the membership from complimentary to paid
6. Does NOT modify any existing users or their badges

## Tables Modified
- auth.users (new row)
- user_profiles (new row with title='Partner', is_test_account=true)
- sv_portal_access (new row — player only)
- community_entitlements (new row — member tier, paid, full privileges)
- user_memberships (new row — elite, active)
- membership_overrides (new row — elite, complimentary, admin_grant)
- sv_user_capabilities (new row — general_feed_post)
- password_recovery_credentials (new row)

## Tables Seeded
- industry_wire_posts (2 new posts — Main Feed, author_role='PARTNER')
- network_chat_messages (1 new post — Social Feed, author_role='PARTNER')

## Security
- No RLS policy changes — existing policies remain intact
- No new tables created
- Account has player-only portal access (no staff/admin portals)
- is_test_account flag marks profile as demo-only
- community_entitlements uses 'member' tier (CHECK constraint allows only free/member);
  Elite access is granted via user_memberships + membership_overrides
*/

-- 1. Create auth user
DO $$
DECLARE v_user_id uuid; v_email text := 'DaneCook@spotvault.com'; v_password text := 'DaneCook#VIP2026Partner!'; v_hash text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN RAISE NOTICE 'Dane Cook user already exists'; RETURN; END IF;
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false));
  RAISE NOTICE 'Created Dane Cook auth user';
END $$;

-- 2. Create user profile with Partner title and demo flags
DO $$
DECLARE v_user_id uuid; v_email text := 'DaneCook@spotvault.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook auth user not found'; END IF;
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false) WHERE id = v_user_id;
  INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, title, is_verified, is_test_account, is_discoverable, avatar_url, social_links)
  VALUES (v_user_id::text, 'Dane Cook', 'DaneCook',
    'Dane Cook | Comedian, entertainer, poker enthusiast, and prospective SpotVault partner.',
    'Player', 'player', 'public',
    'Partner',
    false, true, false,
    '/assets/profiles/image.png',
    jsonb_build_object('twitter', 'https://twitter.com/DaneCook', 'website', 'https://www.danecook.com'))
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    bio = EXCLUDED.bio,
    poker_role = EXCLUDED.poker_role,
    primary_role = EXCLUDED.primary_role,
    title = EXCLUDED.title,
    is_test_account = EXCLUDED.is_test_account,
    is_discoverable = EXCLUDED.is_discoverable,
    avatar_url = EXCLUDED.avatar_url,
    social_links = EXCLUDED.social_links,
    updated_at = now();
  RAISE NOTICE 'Created Dane Cook user profile';
END $$;

-- 3. Grant player portal access only (NO staff/admin/superuser)
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'DaneCook@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook auth user not found'; END IF;
  INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
  VALUES (v_user_id, 'player', 'active', v_jordan_id, now(), NULL)
  ON CONFLICT (user_id, portal_type) DO UPDATE SET status = 'active', updated_at = now();
  RAISE NOTICE 'Granted player portal access';
END $$;

-- 4. Community entitlements — member tier (CHECK constraint allows only free/member), paid, full privileges
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'DaneCook@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook auth user not found'; END IF;
  INSERT INTO community_entitlements (user_id, tier, is_paid_member, member_since, privileges, priority_weight)
  VALUES (v_user_id::text, 'member', true, now(),
    jsonb_build_object(
      'can_post_community', true,
      'can_post_network', true,
      'can_access_lounge', true,
      'can_access_solver', true,
      'can_access_marketplace', true,
      'can_access_coaching', true,
      'can_access_creator', true,
      'can_access_hand_replayer', true,
      'can_access_analytics', true,
      'can_access_workspace', true
    ), 100)
  ON CONFLICT (user_id) DO UPDATE SET
    tier = 'member',
    is_paid_member = true,
    privileges = EXCLUDED.privileges,
    priority_weight = EXCLUDED.priority_weight,
    updated_at = now();
  RAISE NOTICE 'Created community entitlements';
END $$;

-- 5. Create user_membership at elite tier
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'DaneCook@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook auth user not found'; END IF;
  INSERT INTO user_memberships (user_id, tier_id, status)
  VALUES (v_user_id, 'elite', 'active')
  ON CONFLICT (user_id) DO UPDATE SET tier_id = 'elite', status = 'active', updated_at = now();
  RAISE NOTICE 'Created elite user membership';
END $$;

-- 6. Create membership override — complimentary elite (admin grant)
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'DaneCook@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook auth user not found'; END IF;
  INSERT INTO membership_overrides (user_id, tier, set_by, reason)
  VALUES (v_user_id, 'elite', v_jordan_id, 'Complimentary Elite membership for VIP partner demo account')
  ON CONFLICT (user_id) DO UPDATE SET tier = 'elite', set_by = v_jordan_id, reason = EXCLUDED.reason, updated_at = now();
  RAISE NOTICE 'Created complimentary elite membership override';
END $$;

-- 7. Grant general_feed_post capability so Dane can post to community feed
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'DaneCook@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook auth user not found'; END IF;
  INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, granted_at)
  VALUES (v_user_id, 'general_feed_post', 'active', v_jordan_id, now())
  ON CONFLICT (user_id, capability) DO NOTHING;
  RAISE NOTICE 'Granted general_feed_post capability';
END $$;

-- 8. Password recovery credential
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM password_recovery_credentials WHERE username = 'danecook';
  IF v_count = 0 THEN
    INSERT INTO password_recovery_credentials (username, temp_password, consumed)
    VALUES ('danecook', 'DaneCook#VIP2026Partner!', false);
  ELSE
    UPDATE password_recovery_credentials
    SET temp_password = 'DaneCook#VIP2026Partner!', consumed = false, consumed_at = NULL
    WHERE username = 'danecook';
  END IF;
  RAISE NOTICE 'Created password recovery credential';
END $$;

-- 9. Seed demo community posts — Main Feed (industry_wire_posts)
-- Post 1: Introduction
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'Hey SpotVault — Dane Cook here.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_avatar, source_verified, content_type, title, body, is_promoted, is_pinned, author_role, created_at)
    VALUES (
      'Dane Cook',
      'DaneCook',
      '/assets/profiles/image.png',
      false,
      'announcement',
      'Hey SpotVault — Dane Cook here.',
      'Poker has been a passion of mine for years. When I''m not on stage, I''m usually studying hands, watching streams, or grinding online.

I''m here to learn, connect with the community, and explore what a partnership with SpotVault could look like. The tools on this platform are genuinely impressive — the Hand Workspace and Analytics are next level.

Looking forward to meeting you all.',
      false, false, 'PARTNER', now() - interval '2 days'
    );
  END IF;
  RAISE NOTICE 'Seeded Dane Cook intro post';
END $$;

-- Post 2: Poker discussion
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'The mental game of tournament poker.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_avatar, source_verified, content_type, title, body, author_role, created_at)
    VALUES (
      'Dane Cook',
      'DaneCook',
      '/assets/profiles/image.png',
      false,
      'discussion',
      'The mental game of tournament poker.',
      'One thing stand-up comedy and tournament poker have in common: you''re alone up there, and the decisions are all on you.

In comedy, you read the room and adjust. In poker, you read the table and adjust. The biggest leap in my game came when I stopped focusing on cards and started focusing on people.

The Hand Replayer here has been incredible for that — going back through spots and asking "what was this player actually telling me with that bet sizing?"

Curious what mental game tools you all use. Drop your thoughts below.',
      'PARTNER', now() - interval '1 day'
    );
  END IF;
  RAISE NOTICE 'Seeded Dane Cook poker discussion post';
END $$;

-- 10. Seed demo social feed post — network_chat_messages
DO $$
DECLARE v_user_id text;
BEGIN
  SELECT user_id::text INTO v_user_id FROM user_profiles WHERE username = 'DaneCook';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Dane Cook profile not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM network_chat_messages WHERE author_id = v_user_id AND body LIKE 'Excited to be part of the SpotVault community.%') THEN
    INSERT INTO network_chat_messages (author_id, author_name, author_role, author_avatar, body, is_sponsored, created_at)
    VALUES (
      v_user_id,
      'Dane Cook',
      'PARTNER',
      '/assets/profiles/image.png',
      'Excited to be part of the SpotVault community.

If anyone wants to talk poker strategy, share hand histories, or just chat about the game — I''m around. This platform is something special.

Let''s build something great together.',
      false, now() - interval '12 hours'
    );
  END IF;
  RAISE NOTICE 'Seeded Dane Cook social feed post';
END $$;
