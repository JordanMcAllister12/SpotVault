/*
# Configure Bryan Paris as Real SpotVault Executive / Coach Account

## Purpose
Completes Bryan Paris's canonical SpotVault account configuration:
1. Adds 'media' to sv_portal_access CHECK constraint so media portal access can be granted
2. Grants Bryan media portal access (he already has player, coach, stable, business, creator, staff)
3. Creates portal_memberships for all live portals (player=free, others=complimentary)
4. Creates a poker_resumes entry so Bryan appears in the People directory (Poker Pros)
5. Updates Bryan's profile photo path to the new canonical photo across all surfaces
6. Ensures password recovery credential is consumed (no forced reset)
7. Grants general_feed_post capability and creator permissions
8. Sets user_membership to pro tier

Bryan's canonical UUID: d421b1bd-f8c6-4cd0-b68f-40ae275e99ba
Jordan's UUID: 17ca0743-ccdb-4d43-ab24-f84aa2821170 (unchanged)

## Security
- No RLS changes — existing policies remain intact
- No new tables
- sv_portal_access CHECK constraint widened to include 'media'
*/

-- 1. Add 'media' to sv_portal_access CHECK constraint
ALTER TABLE sv_portal_access DROP CONSTRAINT IF EXISTS sv_portal_access_portal_type_check;
ALTER TABLE sv_portal_access ADD CONSTRAINT sv_portal_access_portal_type_check
  CHECK (portal_type = ANY (ARRAY['player', 'coach', 'stable', 'business', 'creator', 'staff', 'media']));

-- 2. Grant Bryan media portal access
INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at, expires_at)
VALUES ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'media', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now(), NULL)
ON CONFLICT (user_id, portal_type) DO UPDATE SET
  status = 'active',
  approved_by = EXCLUDED.approved_by,
  approved_at = EXCLUDED.approved_at,
  updated_at = now();

-- 3. Create portal_memberships for all live portals
INSERT INTO portal_memberships (user_id, portal_id, status, membership_type)
VALUES
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'player', 'subscribed', 'free'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'coach', 'subscribed', 'complimentary'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'creator', 'subscribed', 'complimentary'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'business', 'subscribed', 'complimentary'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'media', 'subscribed', 'complimentary'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'stable', 'subscribed', 'complimentary')
ON CONFLICT DO NOTHING;

-- 4. Create poker_resumes entry for People directory (Poker Pros)
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM poker_resumes WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
  IF v_count = 0 THEN
    INSERT INTO poker_resumes (
      account_id, display_name, username, bio, primary_format,
      plays_mtt, plays_live, plays_online,
      abi, buy_in_range,
      is_published, is_looking,
      accomplishments, credentials
    )
    VALUES (
      'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
      'Bryan Paris',
      'BryanParis',
      'COO at SpotVault and tournament poker coach. Focused on MTT strategy, hand analysis, and player development for serious tournament players.',
      'MTT',
      true, true, true,
      500, '$500+',
      true, false,
      'Tournament poker professional and coach specializing in MTT strategy and high-stakes play.',
      jsonb_build_array(
        jsonb_build_object('type', 'industry_position', 'title', 'COO / Coach', 'year', '2026', 'description', 'Chief Operating Officer at SpotVault'),
        jsonb_build_object('type', 'coaching_credential', 'title', 'MTT Coach', 'year', '2025', 'description', 'Tournament poker coaching for serious players')
      )
    );
  ELSE
    UPDATE poker_resumes SET
      display_name = 'Bryan Paris',
      username = 'BryanParis',
      bio = 'COO at SpotVault and tournament poker coach. Focused on MTT strategy, hand analysis, and player development for serious tournament players.',
      primary_format = 'MTT',
      plays_mtt = true, plays_live = true, plays_online = true,
      abi = 500, buy_in_range = '$500+',
      is_published = true,
      accomplishments = 'Tournament poker professional and coach specializing in MTT strategy and high-stakes play.',
      credentials = jsonb_build_array(
        jsonb_build_object('type', 'industry_position', 'title', 'COO / Coach', 'year', '2026', 'description', 'Chief Operating Officer at SpotVault'),
        jsonb_build_object('type', 'coaching_credential', 'title', 'MTT Coach', 'year', '2025', 'description', 'Tournament poker coaching for serious players')
      ),
      updated_at = now()
    WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
  END IF;
END $$;

-- 5. Update Bryan's profile photo path
UPDATE user_profiles
SET avatar_url = '/assets/profiles/image copy.png',
    updated_at = now()
WHERE user_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

-- 6. Update coach_listings profile photo
UPDATE coach_listings
SET profile_photo_url = '/assets/profiles/image copy.png',
    updated_at = now()
WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

-- 7. Update network_chat_messages author_avatar
UPDATE network_chat_messages
SET author_avatar = '/assets/profiles/image copy.png'
WHERE author_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

-- 8. Update industry_wire_posts source_avatar
UPDATE industry_wire_posts
SET source_avatar = '/assets/profiles/image copy.png'
WHERE source_name = 'Bryan Paris';

-- 9. Ensure password recovery credential is consumed (no forced reset)
UPDATE password_recovery_credentials
SET consumed = true, consumed_at = now()
WHERE username = 'bryanparis' AND consumed = false;

-- 10. Grant general_feed_post capability so Bryan can post to community feed
INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, granted_at)
VALUES ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'general_feed_post', 'active', '17ca0743-ccdb-4d43-ab24-f84aa2821170', now())
ON CONFLICT (user_id, capability) DO NOTHING;

-- 11. Grant creator permissions (can_publish_video_spots, can_create_multispot)
INSERT INTO sv_creator_permissions (user_id, can_publish_video_spots, can_create_multispot)
VALUES ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', true, true)
ON CONFLICT (user_id) DO UPDATE SET
  can_publish_video_spots = true,
  can_create_multispot = true;

-- 12. Create user_membership at pro tier
INSERT INTO user_memberships (user_id, tier_id, status)
VALUES ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'pro', 'active')
ON CONFLICT (user_id) DO UPDATE SET
  tier_id = 'pro',
  status = 'active';
