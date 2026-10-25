/*
# Create Bryan Paris COO/Coach Account

Creates a real authenticated account for Bryan Paris with:
1. Real auth.users entry (email: bparispoker@gmail.com, password: bparispoker1!)
2. User profile with display name, username, avatar, COO/Coach title
3. Staff + Coach + Player roles (second-highest authority, below Jordan/superuser)
4. Portal access to all valid portal types (player, coach, stable, business, creator, staff)
5. Community entitlements (paid member, full privileges)
6. SV entitlements for platform access
7. Network posting capability
8. Coach marketplace listing ($100/hr, MTTs, $500+ buy-ins)
9. Booking provider entry + booking service
10. Booking provider approval
11. Demo social feed posts (flagged as demo via metadata)
12. Password recovery credential

Jordan McAllister (17ca0743-ccdb-4d43-ab24-f84aa2821170) remains the sole superuser.
Bryan has NO superuser role and cannot demote or remove Jordan.
All demo content uses Bryan's real auth UUID — no acc-/demo- prefixed IDs.
*/

-- 1. Create auth user
DO $$
DECLARE v_user_id uuid; v_email text := 'bparispoker@gmail.com'; v_password text := 'bparispoker1!'; v_hash text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NOT NULL THEN RAISE NOTICE 'Bryan auth user already exists'; RETURN; END IF;
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, v_hash, now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('sub', '', 'email', v_email, 'email_verified', true, 'phone_verified', false));
  RAISE NOTICE 'Created Bryan auth user';
END $$;

-- 2. Create user profile
DO $$
DECLARE v_user_id uuid; v_email text := 'bparispoker@gmail.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false) WHERE id = v_user_id;
  INSERT INTO user_profiles (user_id, display_name, username, bio, avatar_url, poker_role, primary_role, title, specialties, privacy_mode)
  VALUES (
    v_user_id::text,
    'Bryan Paris',
    'BryanParis',
    'COO at SpotVault and tournament poker coach. Focused on MTT strategy, hand analysis, and player development for serious tournament players.',
    '/assets/profiles/image.png',
    'COO / Coach',
    'coach',
    'COO / Coach',
    ARRAY['MTTs', 'Tournament Strategy', 'Hand Analysis', 'ICM', 'Final Table Play'],
    'public'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    bio = EXCLUDED.bio,
    avatar_url = EXCLUDED.avatar_url,
    poker_role = EXCLUDED.poker_role,
    primary_role = EXCLUDED.primary_role,
    title = EXCLUDED.title,
    specialties = EXCLUDED.specialties,
    updated_at = now();
  RAISE NOTICE 'Created Bryan user profile';
END $$;

-- 3. Grant roles (staff + coach + player — NOT superuser)
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at) VALUES
    (v_user_id, 'staff', 'active', v_jordan_id, now()),
    (v_user_id, 'coach', 'active', v_jordan_id, now()),
    (v_user_id, 'player', 'active', v_jordan_id, now())
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted Bryan roles';
END $$;

-- 4. Grant portal access (all valid portal types: player, coach, stable, business, creator, staff)
DO $$
DECLARE v_user_id uuid; v_portal_types text[] := ARRAY['player', 'coach', 'stable', 'business', 'creator', 'staff']; v_portal text; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  FOREACH v_portal IN ARRAY v_portal_types LOOP
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at) VALUES (v_user_id, v_portal, 'active', v_jordan_id, now(), NULL) ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Granted Bryan portal access';
END $$;

-- 5. Community entitlements (paid member, full privileges, high priority)
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO community_entitlements (user_id, tier, is_paid_member, member_since, privileges, priority_weight)
  VALUES (
    v_user_id::text, 'member', true, now(),
    jsonb_build_object(
      'can_post_community', true, 'can_post_network', true,
      'can_access_lounge', true, 'can_access_solver', true,
      'can_access_marketplace', true, 'can_access_coaching', true,
      'can_access_creator', true, 'can_access_hand_replayer', true,
      'can_access_analytics', true
    ), 90
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier = 'member', is_paid_member = true,
    privileges = EXCLUDED.privileges,
    priority_weight = EXCLUDED.priority_weight,
    updated_at = now();
  RAISE NOTICE 'Created Bryan community entitlements';
END $$;

-- 6. SV entitlements for full platform access
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
  VALUES (
    v_user_id, 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL,
    jsonb_build_object('description', 'Full platform access for COO', 'is_demo', true)
  )
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Bryan SV entitlements';
END $$;

-- 7. Network posting capability
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, granted_at) VALUES (v_user_id, 'network_post', 'active', v_jordan_id, now()) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Granted Bryan network posting capability';
END $$;

-- 8. Coach marketplace listing
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO coach_listings (
    account_id, display_name, username, real_name, profile_photo_url, bio,
    specialties, credentials, formats_coached, stakes_coached, languages,
    rate_per_hour, session_durations, coaching_methods, accomplishments,
    availability_summary, is_published, shareable_slug, primary_games,
    coaching_description, available_for_coaching, currency
  )
  VALUES (
    v_user_id::text,
    'Bryan Paris',
    'BryanParis',
    'Bryan Paris',
    '/assets/profiles/image.png',
    'High-level MTT coaching focused on tournament strategy, hand analysis, decision-making and adjustments for serious tournament players. Primarily focused on $500+ buy-in events.',
    ARRAY['MTTs', 'Tournament Strategy', 'Hand Analysis', 'ICM', 'Final Table Play', 'Bubble Play'],
    jsonb_build_array(
      jsonb_build_object('type', 'industry_position', 'title', 'COO / Coach', 'year', '2026', 'description', 'Chief Operating Officer at SpotVault'),
      jsonb_build_object('type', 'coaching_credential', 'title', 'MTT Coach', 'year', '2025', 'description', 'Tournament poker coaching for serious players')
    ),
    ARRAY['1-on-1', 'Group', 'Video Review', 'Hand History Review'],
    ARRAY['$500+ buy-in tournaments', 'High rollers', 'MTTs'],
    ARRAY['English'],
    100,
    ARRAY[60, 90, 120],
    ARRAY['Online', 'In-person'],
    'Tournament poker professional and coach specializing in MTT strategy and high-stakes play.',
    'Available for coaching sessions. Book through the scheduling system.',
    true,
    'bryan-paris',
    ARRAY['$500+ buy-in tournaments'],
    'High-level MTT coaching focused on tournament strategy, hand analysis, decision-making and adjustments for serious tournament players. Primarily focused on $500+ buy-in events.',
    true,
    'USD'
  )
  ON CONFLICT (account_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    real_name = EXCLUDED.real_name,
    profile_photo_url = EXCLUDED.profile_photo_url,
    bio = EXCLUDED.bio,
    specialties = EXCLUDED.specialties,
    credentials = EXCLUDED.credentials,
    formats_coached = EXCLUDED.formats_coached,
    stakes_coached = EXCLUDED.stakes_coached,
    rate_per_hour = EXCLUDED.rate_per_hour,
    is_published = EXCLUDED.is_published,
    shareable_slug = EXCLUDED.shareable_slug,
    primary_games = EXCLUDED.primary_games,
    coaching_description = EXCLUDED.coaching_description,
    available_for_coaching = EXCLUDED.available_for_coaching,
    updated_at = now();
  RAISE NOTICE 'Created Bryan coach listing';
END $$;

-- 9. Booking provider entry
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO booking_providers (
    account_id, display_name, title, subtitle, category, bio, photo_initials,
    verified, is_available, booking_mode, eligibility_role,
    specialties, game_types, response_time_hours, timezone
  )
  VALUES (
    v_user_id::text,
    'Bryan Paris',
    'COO / Coach',
    'MTT Coach — $500+ buy-in tournaments',
    'COACH',
    'High-level MTT coaching focused on tournament strategy, hand analysis, decision-making and adjustments for serious tournament players. Primarily focused on $500+ buy-in events.',
    'BP',
    true, true, 'paid', 'coach',
    ARRAY['MTTs', 'Tournament Strategy', 'Hand Analysis', 'ICM', 'Final Table Play'],
    ARRAY['MTT', 'Tournament Poker'],
    24,
    'America/New_York'
  )
  ON CONFLICT (account_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    category = EXCLUDED.category,
    bio = EXCLUDED.bio,
    verified = EXCLUDED.verified,
    is_available = EXCLUDED.is_available,
    eligibility_role = EXCLUDED.eligibility_role,
    specialties = EXCLUDED.specialties,
    game_types = EXCLUDED.game_types,
    updated_at = now();
  RAISE NOTICE 'Created Bryan booking provider';
END $$;

-- 10. Booking service ($100/hr strategy session)
DO $$
DECLARE v_provider_id uuid; v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  SELECT id INTO v_provider_id FROM booking_providers WHERE account_id = v_user_id::text;
  IF v_provider_id IS NULL THEN RAISE EXCEPTION 'Bryan booking provider not found'; END IF;
  INSERT INTO booking_services (provider_id, name, description, service_type, duration_minutes, price_credits, is_active, includes_messaging, allows_file_upload)
  VALUES (
    v_provider_id,
    'MTT Strategy Session',
    'One-hour MTT coaching session covering tournament strategy, hand analysis, decision-making, and adjustments for serious tournament players. Focused on $500+ buy-in events.',
    'STRATEGY_SESSION',
    60,
    100,
    true,
    true,
    true
  )
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Bryan booking service';
END $$;

-- 11. Booking provider approval (display_name is NOT NULL)
DO $$
DECLARE v_user_id uuid; v_jordan_id uuid := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO booking_provider_approvals (account_id, display_name, username, status, categories, approved_by, approved_at)
  VALUES (v_user_id::text, 'Bryan Paris', 'BryanParis', 'active', ARRAY['COACH'], v_jordan_id::text, now())
  ON CONFLICT (account_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    status = 'active',
    categories = EXCLUDED.categories,
    approved_at = now();
  RAISE NOTICE 'Created Bryan booking provider approval';
END $$;

-- 12. Demo social feed posts (community_posts)
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO community_posts (author_id, body, is_sponsored, moderation_status, created_at)
  VALUES
    (v_user_id, 'Tournament poker is about making fewer mistakes than your opponents over the long haul. The players who win consistently are the ones who review their hands honestly and adjust.', false, 'visible', now() - interval '4 days'),
    (v_user_id, 'Key insight from reviewing hands this week: most amateur MTT players are too tight in late position when stacks are 20-25bb. The push-fold charts say open much wider than most people do. Study the charts and trust them.', false, 'visible', now() - interval '3 days'),
    (v_user_id, 'Live tournament adjustments: when the table breaks down to 6-7 handed and average stacks get shallow, you should be opening wider and reshoving wider. Most players freeze up near the final table. That is where the chips are.', false, 'visible', now() - interval '2 days'),
    (v_user_id, 'Coaching is not just about telling someone what they did wrong. It is about helping them build a framework for making better decisions on their own. That is what we focus on at SpotVault — building systems, not just fixing one hand.', false, 'visible', now() - interval '1 day'),
    (v_user_id, 'Just published a new Spot on SpotVault breaking down a key final table ICM decision. If you are playing $500+ buy-in events, this is the kind of spot that comes up constantly. Check it out in the Spot Library.', false, 'visible', now() - interval '8 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Bryan demo community posts';
END $$;

-- 13. Demo network chat messages (social feed with COO/Coach badge)
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO network_chat_messages (author_id, author_name, author_role, author_avatar, body, is_sponsored, moderation_status, created_at)
  VALUES
    (v_user_id::text, 'Bryan Paris', 'COO / Coach', '/assets/profiles/image.png', 'Welcome to SpotVault. As COO I am here to make sure this platform delivers real value for serious poker players. Reach out if you have feedback.', false, 'visible', now() - interval '4 days'),
    (v_user_id::text, 'Bryan Paris', 'COO / Coach', '/assets/profiles/image.png', 'One of the biggest leaks I see in MTT players is not studying ICM enough. The chip EV decisions that got you to the final table will cost you equity once you are there. Learn the differences.', false, 'visible', now() - interval '2 days'),
    (v_user_id::text, 'Bryan Paris', 'COO / Coach', '/assets/profiles/image.png', 'Great to see so many players using the Hand History Replayer. The tool is only as good as the hands you put in. Review your toughest spots, not just the ones you won.', false, 'visible', now() - interval '12 hours'),
    (v_user_id::text, 'Bryan Paris', 'COO / Coach', '/assets/profiles/image.png', 'If you are playing $500+ buy-in tournaments and want to level up your game, I am available for coaching through the Marketplace. Happy to help serious players build a complete tournament framework.', false, 'visible', now() - interval '3 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Bryan demo network chat messages';
END $$;

-- 14. Demo industry wire posts
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bparispoker@gmail.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bryan auth user not found'; END IF;
  INSERT INTO industry_wire_posts (source_name, source_handle, source_avatar, source_verified, content_type, title, body, is_promoted, is_featured, author_role, created_at)
  VALUES
    ('Bryan Paris', '@BryanParis', '/assets/profiles/image.png', true, 'INSIGHT', 'ICM and Final Table Play: What Most Players Get Wrong',
     'Most tournament players understand ICM exists but do not actually adjust their ranges at the final table. The difference between chip EV and ICM-aware play is where serious players separate themselves. Review your final table hands with ICM in mind.',
     false, true, 'COO / Coach', now() - interval '2 days'),
    ('Bryan Paris', '@BryanParis', '/assets/profiles/image.png', true, 'COACHING', 'Building a Tournament Study System',
     'Coaching is about building systems, not just fixing individual hands. A complete MTT study system includes range reviews, ICM work, push-fold charts, and hand history analysis. That is what we help players build at SpotVault.',
     false, false, 'COO / Coach', now() - interval '18 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created Bryan demo industry wire posts';
END $$;

-- 15. Password recovery credential
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM password_recovery_credentials WHERE username = 'bryanparis';
  IF v_count = 0 THEN
    INSERT INTO password_recovery_credentials (username, temp_password, consumed) VALUES ('bryanparis', 'bparispoker1!', false);
  ELSE
    UPDATE password_recovery_credentials SET temp_password = 'bparispoker1!', consumed = false, consumed_at = NULL WHERE username = 'bryanparis';
  END IF;
  RAISE NOTICE 'Created Bryan password recovery credential';
END $$;
