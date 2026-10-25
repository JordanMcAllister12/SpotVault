/*
# Pin the seeded partnership article

1. Data correction
- Marks the initial StakeKings partnership announcement as pinned with no expiration.
*/

UPDATE public.main_feed_posts
SET is_pinned = true
WHERE slug = 'stakekings-player-development-academy-partnership';
