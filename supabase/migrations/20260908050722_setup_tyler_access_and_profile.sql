/*
# Set Up Tyler's Profile, Roles, and Access

Tyler's auth user was created via the Supabase admin API (edge function).
This migration creates:
1. User profile (display_name, username, StakeKings identity)
2. Staff role in sv_roles (NOT superuser)
3. Portal access to all portal types
4. StakeKings partner attribution with manager role
5. StakeKings hub access
6. Community entitlements (paid member)
7. SV entitlements for full platform access
8. Network posting capability
9. Password recovery credential (forces password reset on first login)
10. Demo activity (community posts, lounge messages, network chat, industry wire, inbox, saved posts)
*/

-- 1. Create user profile
INSERT INTO user_profiles (user_id, display_name, username, bio, poker_role, primary_role, privacy_mode, social_links)
VALUES (
  '3f968934-e5d9-4e2c-989b-23a12f2fc2ef',
  'StakeKings Tyler',
  'StakeKingsTyler',
  'CEO at StakeKings. Passionate about player development and the poker community.',
  'Executive',
  'player',
  'public',
  jsonb_build_object('twitter', 'https://twitter.com/StakeKings', 'website', 'https://www.stakekings.com')
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  bio = EXCLUDED.bio,
  poker_role = EXCLUDED.poker_role,
  primary_role = EXCLUDED.primary_role,
  updated_at = now();

-- 2. Grant staff role (NOT superuser)
INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at)
VALUES ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'staff', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now())
ON CONFLICT DO NOTHING;

-- 3. Grant portal access (allowed: player, coach, stable, business, creator, staff)
INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
VALUES
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'player', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'coach', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'stable', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'business', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'creator', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'staff', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL)
ON CONFLICT DO NOTHING;

-- 4. StakeKings partner attribution with manager role
INSERT INTO partner_attributions (user_id, partner_slug, status, acquisition_source, verified, entitlement_active, stakekings_role, joined_at, verified_at, metadata)
VALUES (
  '3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'stakekings', 'active', 'admin_grant',
  true, true, 'manager', now(), now(),
  jsonb_build_object('title', 'CEO', 'display_name', 'StakeKings Tyler')
)
ON CONFLICT (user_id, partner_slug) DO UPDATE SET
  status = 'active', verified = true, entitlement_active = true,
  stakekings_role = 'manager',
  metadata = jsonb_build_object('title', 'CEO', 'display_name', 'StakeKings Tyler'),
  updated_at = now();

-- 5. StakeKings hub access
INSERT INTO partner_hub_access (user_id, partner_slug, access_granted, granted_by, granted_at)
VALUES ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'stakekings', true, '17ca0743-ccdb-4d43-ab24-f84aa2821170', now())
ON CONFLICT DO NOTHING;

-- 6. Community entitlements (tier=member, paid)
INSERT INTO community_entitlements (user_id, tier, is_paid_member, member_since, privileges, priority_weight)
VALUES (
  '3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'member', true, now(),
  jsonb_build_object(
    'can_post_community', true, 'can_post_network', true,
    'can_access_lounge', true, 'can_access_solver', true,
    'can_access_marketplace', true, 'can_access_coaching', true,
    'can_access_creator', true, 'can_access_hand_replayer', true,
    'can_access_analytics', true
  ), 100
)
ON CONFLICT (user_id) DO UPDATE SET
  tier = 'member', is_paid_member = true,
  privileges = EXCLUDED.privileges,
  priority_weight = EXCLUDED.priority_weight,
  updated_at = now();

-- 7. SV entitlements for full platform access
INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, expires_at, metadata)
VALUES (
  '3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'platform', gen_random_uuid(), 'subscription', 'admin_grant', NULL,
  jsonb_build_object('description', 'Full platform access for StakeKings executive')
)
ON CONFLICT DO NOTHING;

-- 8. Network posting capability
INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, granted_at)
VALUES ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'network_post', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now())
ON CONFLICT DO NOTHING;

-- 9. Password recovery credential (forces password reset on first login)
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM password_recovery_credentials WHERE username = 'stakekingstyler';
  IF v_count = 0 THEN
    INSERT INTO password_recovery_credentials (username, temp_password, consumed) VALUES ('stakekingstyler', 'SK-Tyler#9274Vault', false);
  ELSE
    UPDATE password_recovery_credentials SET temp_password = 'SK-Tyler#9274Vault', consumed = false, consumed_at = NULL WHERE username = 'stakekingstyler';
  END IF;
END $$;

-- 10. Community feed posts by Tyler
INSERT INTO community_posts (author_id, body, is_sponsored, moderation_status, created_at)
VALUES
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'Excited to be on SpotVault! StakeKings is committed to building the best poker development platform. Looking forward to engaging with the community and hearing feedback from players.', false, 'visible', now() - interval '3 days'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'Just reviewed some incredible hand histories from the WSOP Main Event. The level of play this year is remarkable. What hands have stood out to you all?', false, 'visible', now() - interval '2 days'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings is expanding our player development program. We are now offering structured coaching paths through SpotVault with analytics tracking. If you are interested in joining the program, reach out!', false, 'visible', now() - interval '1 day'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'Pro tip: Use the Hand History Replayer to review your biggest pots — both won and lost. The patterns you find in your own play are more valuable than any solver output. Study your own leaks first.', false, 'visible', now() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- 11. Player Lounge messages
INSERT INTO poker_lounge_messages (author_id, author_name, author_role, body, stakes_level, poker_format, community_scope, created_at)
VALUES
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings Tyler', 'StakeKings • CEO', 'Anyone watching the high roller final table? Incredible river call by the chip leader.', 'high', 'mtt', 'spotvault', now() - interval '2 days'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings Tyler', 'StakeKings • CEO', 'StakeKings is looking for feedback on what features you want most for tournament prep. Drop your thoughts below.', 'high', 'mtt', 'stakekings', now() - interval '1 day'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings Tyler', 'StakeKings • CEO', 'Just had a great session reviewing hand ranges with the SpotVault solver. The preflop matrix tool is a game changer for study.', 'medium', 'cash', 'spotvault', now() - interval '4 hours')
ON CONFLICT DO NOTHING;

-- 12. Network chat messages
INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, moderation_status, created_at)
VALUES
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings Tyler', 'STAKEKINGS • CEO', 'Welcome to the SpotVault network! StakeKings is proud to partner with this platform to bring you the best poker development tools.', false, 'visible', now() - interval '3 days'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings Tyler', 'STAKEKINGS • CEO', 'Reminder: Q3 StakeKings staking applications are now open. Apply through the StakeKings Portal on SpotVault.', true, 'visible', now() - interval '1 day'),
  ('3f968934-e5d9-4e2c-989b-23a12f2fc2ef', 'StakeKings Tyler', 'STAKEKINGS • CEO', 'Great discussion in the community feed today. Love seeing players engage with the hand analysis tools.', false, 'visible', now() - interval '5 hours')
ON CONFLICT DO NOTHING;

-- 13. Industry Wire posts
INSERT INTO industry_wire_posts (source_name, source_handle, content_type, title, body, is_promoted, is_featured, author_role, created_at)
VALUES
  ('StakeKings', '@StakeKings', 'NEWS', 'StakeKings Partners with SpotVault for Player Development',
    'StakeKings is proud to announce a partnership with SpotVault to provide structured player development tools, hand analysis, and coaching services to our staked players.',
    true, true, 'StakeKings • CEO', now() - interval '2 days'),
  ('StakeKings', '@StakeKings', 'ANNOUNCEMENT', 'Q3 Staking Applications Now Open',
    'Applications for Q3 StakeKings staking program are now open. Players can apply through the StakeKings Portal on SpotVault. We are looking for tournament and cash game specialists.',
    false, false, 'StakeKings • CEO', now() - interval '12 hours')
ON CONFLICT DO NOTHING;

-- 14. Inbox welcome message (conversation between Jordan and Tyler)
DO $$
DECLARE v_conversation_id uuid;
  v_tyler_id text := '3f968934-e5d9-4e2c-989b-23a12f2fc2ef';
  v_jordan_id text := '17ca0743-ccdb-4d43-ab24-f84aa2821170';
BEGIN
  SELECT id INTO v_conversation_id FROM user_inbox_conversations
  WHERE (participant_a_id = v_jordan_id AND participant_b_id = v_tyler_id)
     OR (participant_a_id = v_tyler_id AND participant_b_id = v_jordan_id);

  IF v_conversation_id IS NULL THEN
    INSERT INTO user_inbox_conversations (participant_a_id, participant_b_id, last_message_preview, last_message_at, created_at)
    VALUES (v_jordan_id, v_tyler_id, 'Welcome to SpotVault! Your StakeKings executive account is ready.', now() - interval '3 days', now() - interval '3 days')
    RETURNING id INTO v_conversation_id;
  END IF;

  IF v_conversation_id IS NOT NULL THEN
    INSERT INTO user_inbox_messages (conversation_id, sender_id, body, read, created_at)
    SELECT v_conversation_id, v_jordan_id,
      'Welcome to SpotVault, Tyler! Your StakeKings executive account is ready. You have full access to all portals, the StakeKings Portal, community features, and study tools. Please change your temporary password on first login. Reach out if you need anything.',
      false, now() - interval '3 days'
    WHERE NOT EXISTS (SELECT 1 FROM user_inbox_messages m WHERE m.conversation_id = v_conversation_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 15. Save community posts to Tyler's saved posts
INSERT INTO sv_saved_community_posts (user_id, post_id, saved_at)
SELECT '3f968934-e5d9-4e2c-989b-23a12f2fc2ef', p.id, now() - interval '1 day'
FROM community_posts p
WHERE p.author_id = '3f968934-e5d9-4e2c-989b-23a12f2fc2ef'
AND NOT EXISTS (SELECT 1 FROM sv_saved_community_posts s WHERE s.user_id = '3f968934-e5d9-4e2c-989b-23a12f2fc2ef' AND s.post_id = p.id)
ON CONFLICT DO NOTHING;
