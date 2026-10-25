/*
# Seed Demo Activity for StakeKings Tyler (v3)

Creates realistic demo activity across SpotVault:
1. Community feed posts
2. Player Lounge messages
3. Network chat messages
4. Industry Wire posts
5. Inbox welcome message
6. Saved community posts
*/

-- 1. Community feed posts by Tyler
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO community_posts (author_id, body, is_sponsored, moderation_status, created_at)
  VALUES
    (v_user_id, 'Excited to be on SpotVault! StakeKings is committed to building the best poker development platform. Looking forward to engaging with the community and hearing feedback from players.', false, 'visible', now() - interval '3 days'),
    (v_user_id, 'Just reviewed some incredible hand histories from the WSOP Main Event. The level of play this year is remarkable. What hands have stood out to you all?', false, 'visible', now() - interval '2 days'),
    (v_user_id, 'StakeKings is expanding our player development program. We are now offering structured coaching paths through SpotVault with analytics tracking. If you are interested in joining the program, reach out!', false, 'visible', now() - interval '1 day'),
    (v_user_id, 'Pro tip: Use the Hand History Replayer to review your biggest pots — both won and lost. The patterns you find in your own play are more valuable than any solver output. Study your own leaks first.', false, 'visible', now() - interval '6 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created community posts';
END $$;

-- 2. Player Lounge messages
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  INSERT INTO poker_lounge_messages (author_id, author_name, author_role, body, stakes_level, poker_format, community_scope, created_at)
  VALUES
    (v_user_id, 'StakeKings Tyler', 'StakeKings • CEO', 'Anyone watching the high roller final table? Incredible river call by the chip leader.', 'high', 'mtt', 'spotvault', now() - interval '2 days'),
    (v_user_id, 'StakeKings Tyler', 'StakeKings • CEO', 'StakeKings is looking for feedback on what features you want most for tournament prep. Drop your thoughts below.', 'high', 'mtt', 'stakekings', now() - interval '1 day'),
    (v_user_id, 'StakeKings Tyler', 'StakeKings • CEO', 'Just had a great session reviewing hand ranges with the SpotVault solver. The preflop matrix tool is a game changer for study.', 'medium', 'cash', 'spotvault', now() - interval '4 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created lounge messages';
END $$;

-- 3. Network chat messages by Tyler
DO $$
DECLARE v_user_id uuid; v_user_id_text text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  v_user_id_text := v_user_id::text;
  INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, moderation_status, created_at)
  VALUES
    (v_user_id_text, 'StakeKings Tyler', 'STAKEKINGS • CEO', 'Welcome to the SpotVault network! StakeKings is proud to partner with this platform to bring you the best poker development tools.', false, 'visible', now() - interval '3 days'),
    (v_user_id_text, 'StakeKings Tyler', 'STAKEKINGS • CEO', 'Reminder: Q3 StakeKings staking applications are now open. Apply through the StakeKings Portal on SpotVault.', true, 'visible', now() - interval '1 day'),
    (v_user_id_text, 'StakeKings Tyler', 'STAKEKINGS • CEO', 'Great discussion in the community feed today. Love seeing players engage with the hand analysis tools.', false, 'visible', now() - interval '5 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created network chat messages';
END $$;

-- 4. Industry Wire posts by Tyler
DO $$
BEGIN
  INSERT INTO industry_wire_posts (source_name, source_handle, content_type, title, body, is_promoted, is_featured, author_role, created_at)
  VALUES
    ('StakeKings', '@StakeKings', 'NEWS', 'StakeKings Partners with SpotVault for Player Development',
      'StakeKings is proud to announce a partnership with SpotVault to provide structured player development tools, hand analysis, and coaching services to our staked players.',
      true, true, 'StakeKings • CEO', now() - interval '2 days'),
    ('StakeKings', '@StakeKings', 'ANNOUNCEMENT', 'Q3 Staking Applications Now Open',
      'Applications for Q3 StakeKings staking program are now open. Players can apply through the StakeKings Portal on SpotVault. We are looking for tournament and cash game specialists.',
      false, false, 'StakeKings • CEO', now() - interval '12 hours')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Created industry wire posts';
END $$;

-- 5. Inbox welcome message (conversation between Jordan and Tyler)
DO $$
DECLARE v_tyler_id uuid; v_jordan_id text := '17ca0743-ccdb-4d43-ab24-f84aa2821170'; v_conversation_id uuid;
BEGIN
  SELECT id INTO v_tyler_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_tyler_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;

  -- Check if conversation already exists
  SELECT id INTO v_conversation_id FROM user_inbox_conversations
  WHERE (participant_a_id = v_jordan_id AND participant_b_id = v_tyler_id::text)
     OR (participant_a_id = v_tyler_id::text AND participant_b_id = v_jordan_id);

  -- Create conversation if it doesn't exist
  IF v_conversation_id IS NULL THEN
    INSERT INTO user_inbox_conversations (participant_a_id, participant_b_id, last_message_preview, last_message_at, created_at)
    VALUES (v_jordan_id, v_tyler_id::text, 'Welcome to SpotVault! Your StakeKings executive account is ready.', now() - interval '3 days', now() - interval '3 days')
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Add welcome message from Jordan if not already present
  IF v_conversation_id IS NOT NULL THEN
    INSERT INTO user_inbox_messages (conversation_id, sender_id, body, read, created_at)
    SELECT v_conversation_id, v_jordan_id,
      'Welcome to SpotVault, Tyler! Your StakeKings executive account is ready. You have full access to all portals, the StakeKings Portal, community features, and study tools. Please change your temporary password on first login. Reach out if you need anything.',
      false, now() - interval '3 days'
    WHERE NOT EXISTS (SELECT 1 FROM user_inbox_messages m WHERE m.conversation_id = v_conversation_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Created inbox welcome message';
END $$;

-- 6. Save community posts to Tyler's saved posts
DO $$
DECLARE v_user_id uuid; v_user_id_text text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'StakeKingsTyler@spotvault.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Auth user not found'; END IF;
  v_user_id_text := v_user_id::text;

  INSERT INTO sv_saved_community_posts (user_id, post_id, saved_at)
  SELECT v_user_id_text, p.id, now() - interval '1 day'
  FROM community_posts p
  WHERE p.author_id = v_user_id
  AND NOT EXISTS (SELECT 1 FROM sv_saved_community_posts s WHERE s.user_id = v_user_id_text AND s.post_id = p.id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Saved community posts';
END $$;
