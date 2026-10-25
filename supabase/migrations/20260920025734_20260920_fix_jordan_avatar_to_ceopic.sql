/*
# Fix Jordan McAllister avatar — switch from Bryan's photo to Jordan's canonical photo

## Problem
Jordan McAllister's avatar_url was set to '/assets/profiles/image.png' which is actually
Bryan Paris's photo. Jordan's correct canonical profile photo is '/assets/profiles/ceopic.jpg'.
This was caused by the Bryan Paris account creation migration (20260919201256) using
'/assets/profiles/image.png' for Bryan, and subsequent Jordan migrations also picking up
the same path. The peopleDirectory.ts static data already correctly maps Jordan to ceopic.jpg,
but the database and denormalized avatar fields still point to image.png.

## Changes
1. user_profiles: Update Jordan McAllister's avatar_url from image.png to ceopic.jpg
2. industry_wire_posts: Update all Jordan McAllister source_avatar from image.png to ceopic.jpg
3. network_chat_messages: Update all Jordan McAllister author_avatar from image.png to ceopic.jpg
4. poker_lounge_messages: Update all Jordan McAllister author_avatar from image.png to ceopic.jpg
5. poker_scene_shoutouts: Set Jordan McAllister user_avatar to ceopic.jpg where null

Bryan Paris's avatar ('/assets/profiles/image copy.png') is already correct and is NOT modified.
*/

-- 1. Fix Jordan's canonical avatar in user_profiles
UPDATE user_profiles
SET avatar_url = '/assets/profiles/ceopic.jpg',
    updated_at = now()
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND avatar_url = '/assets/profiles/image.png';

-- 2. Fix denormalized avatars in industry_wire_posts
UPDATE industry_wire_posts
SET source_avatar = '/assets/profiles/ceopic.jpg'
WHERE source_name = 'Jordan McAllister'
  AND source_avatar = '/assets/profiles/image.png';

-- 3. Fix denormalized avatars in network_chat_messages
UPDATE network_chat_messages
SET author_avatar = '/assets/profiles/ceopic.jpg'
WHERE author_name = 'Jordan McAllister'
  AND author_avatar = '/assets/profiles/image.png';

-- 4. Fix denormalized avatars in poker_lounge_messages
UPDATE poker_lounge_messages
SET author_avatar = '/assets/profiles/ceopic.jpg'
WHERE author_name = 'Jordan McAllister'
  AND author_avatar = '/assets/profiles/image.png';

-- 5. Fix null avatars in poker_scene_shoutouts
UPDATE poker_scene_shoutouts
SET user_avatar = '/assets/profiles/ceopic.jpg'
WHERE user_name = 'Jordan McAllister'
  AND user_avatar IS NULL;