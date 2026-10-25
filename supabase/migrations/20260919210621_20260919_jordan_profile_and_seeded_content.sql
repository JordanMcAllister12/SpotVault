/*
# Update Jordan profile + seed Jordan demo content

1. Update Jordan's user_profiles: avatar_url, poker_role, title
2. Seed 5 community_posts from Jordan
3. Seed 3 industry_wire_posts from Jordan
4. Seed 2 poker_lounge_messages from Jordan
5. Update Bryan's existing messages with canonical avatar

Jordan's UUID: 17ca0743-ccdb-4d43-ab24-f84aa2821170
Bryan's UUID: d421b1bd-f8c6-4cd0-b68f-40ae275e99ba (unchanged)
*/

-- 1. Update Jordan's profile
UPDATE user_profiles
SET avatar_url = '/assets/profiles/image.png',
    poker_role = 'Founder / CEO',
    title = 'Founder / CEO',
    updated_at = now()
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170';

-- 2. Seed Jordan community posts (5)
INSERT INTO community_posts (author_id, body, is_sponsored, moderation_status, created_at)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Been spending a lot of time thinking about how poker study gets fragmented across different tools. The goal with SpotVault is to make the workflow feel connected from the moment you find a hand worth studying.', false, 'visible', now() - interval '5 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Running through Multi-Spot Analysis today. One interesting hand is useful. Seeing the same decision repeat across an entire group of hands is where things start getting really valuable.', false, 'visible', now() - interval '4 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Would love feedback from players using the early tools. If something feels unnecessarily complicated, tell us. We are trying to make serious poker study easier, not add another layer of friction.', false, 'visible', now() - interval '2 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'One of the things I am most interested in seeing is what players build inside their own libraries once they can actually keep analysis, spots and study material organized in one place.', false, 'visible', now() - interval '1 day'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Poker has incredible players, coaches, creators and businesses spread across a lot of disconnected places. Building better ways for those groups to interact is a big part of what we are working toward.', false, 'visible', now() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- 3. Seed Jordan industry wire posts (3)
INSERT INTO industry_wire_posts (source_name, source_handle, source_avatar, source_verified, content_type, title, body, is_promoted, is_featured, author_role, created_at)
VALUES
  ('Jordan McAllister', '@JordanMcAllister', '/assets/profiles/image.png', true, 'INSIGHT', 'Building Connected Poker Workflows',
   'SpotVault development update: we are continuing to connect the Player, Coach, Stable and Business experiences while tightening the underlying permissions and account architecture. The goal is a unified workflow from hand import to study to coaching.',
   false, true, 'Founder / CEO', now() - interval '3 days'),
  ('Jordan McAllister', '@JordanMcAllister', '/assets/profiles/image.png', true, 'PRODUCT', 'Creator Tools and Structured Content',
   'Creator tools are becoming an increasingly important part of the platform. The objective is to make it easier to turn quality poker knowledge into structured content players can actually discover and use.',
   false, false, 'Founder / CEO', now() - interval '1 day'),
  ('Jordan McAllister', '@JordanMcAllister', '/assets/profiles/image.png', true, 'COMMUNITY', 'Feedback Drives Development',
   'Would love feedback from players using the early tools. If something feels unnecessarily complicated, tell us. We are trying to make serious poker study easier, not add another layer of friction.',
   false, false, 'Founder / CEO', now() - interval '10 hours')
ON CONFLICT DO NOTHING;

-- 4. Seed Jordan poker lounge messages (2)
INSERT INTO poker_lounge_messages (author_id, author_name, author_avatar, author_role, body, stakes_level, poker_format, community_scope, created_at)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'Founder / CEO', 'Welcome to the Poker Lounge. This is a space for real-time poker discussion — share hands, talk strategy, and connect with other serious players.', 'high', 'mtt', 'spotvault', now() - interval '5 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'Founder / CEO', 'Interesting pattern in my recent MTT review: the same reshove spot keeps showing up across different structures. 15-20bb stacks from the cutoff and button are where most of the edge lives in late-stage tournaments.', 'high', 'mtt', 'spotvault', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- 5. Update Bryan's network_chat_messages to use canonical avatar
UPDATE network_chat_messages
SET author_avatar = '/assets/profiles/image copy.png'
WHERE author_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

-- 6. Update Bryan's industry_wire_posts to use canonical avatar
UPDATE industry_wire_posts
SET source_avatar = '/assets/profiles/image copy.png'
WHERE source_name = 'Bryan Paris';
