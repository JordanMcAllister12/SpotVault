/*
# Fix Jordan McAllister avatar and add Social Feed posts

1. Updates Jordan's user_profiles.avatar_url to /assets/profiles/ceopic.jpg
   This is the canonical profile photo for Jordan McAllister (Founder/CEO).
   Previously pointed to /assets/profiles/image.png which is a generic asset.

2. Adds 5 realistic Social Feed posts from Jordan to network_chat_messages.
   These are SOCIAL FEED posts (network_chat_messages), NOT Main Feed posts
   (community_posts). Previous migration incorrectly added to community_posts.
   Jordan now appears in Community → Social Feed → For You alongside Bryan.

Jordan UUID: 17ca0743-ccdb-4d43-ab24-f84aa2821170
*/

-- 1. Fix Jordan's avatar URL
UPDATE public.user_profiles
SET avatar_url = '/assets/profiles/ceopic.jpg'
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170';

-- 2. Add 5 Jordan Social Feed posts to network_chat_messages
INSERT INTO public.network_chat_messages (author_id, author_name, author_avatar, author_role, body, is_sponsored, reply_to, created_at, moderation_status)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/ceopic.jpg', 'FOUNDER', 'Welcome to SpotVault everyone. We are still polishing things ahead of launch — if anything feels clunky or you have feedback, send it our way. That is exactly what helps us improve.', false, null, now() - interval '5 days', 'visible'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/ceopic.jpg', 'FOUNDER', 'The long-term goal has always been to connect players, coaches, stables, creators and poker businesses in one ecosystem. Poker has been fragmented for too long and we are building the infrastructure to fix that.', false, null, now() - interval '3 days', 'visible'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/ceopic.jpg', 'FOUNDER', 'What study tools or features do you want us to prioritize? We have a roadmap but want to hear from the people actually using the platform. Drop your ideas below.', false, null, now() - interval '2 days', 'visible'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/ceopic.jpg', 'FOUNDER', 'Continuing to tighten everything across the platform ahead of launch. The goal is making serious poker study easier, not adding another layer of friction. Less clutter, more signal.', false, null, now() - interval '18 hours', 'visible'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/ceopic.jpg', 'FOUNDER', 'Poker study has been fragmented across too many tools for too long. SpotVault is being built to bring coaching, analytics, content and community together in one place. That is the whole point.', false, null, now() - interval '4 hours', 'visible')
ON CONFLICT DO NOTHING;
