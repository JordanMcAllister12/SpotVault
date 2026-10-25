/*
# Fix Jordan McAllister avatar — root cause fix

## Problem
Jordan McAllister's user_profiles.avatar_url is set to '/assets/profiles/image.png'
which is Bryan Paris's photo (301x312 PNG, same dimensions as Bryan's 'image copy.png').
Jordan's correct canonical profile photo is '/assets/profiles/ceopic.jpg'.

Previous migrations (20260919213706, 20260920025724, 20260920025734) attempted to fix
this but the avatar_url is STILL '/assets/profiles/image.png' in the live database.
This migration applies an unconditional UPDATE to ensure the fix takes effect.

## Root Cause
The Bryan Paris account creation migration (20260919201256) used '/assets/profiles/image.png'
for Bryan, and Jordan's profile was subsequently created with the same path. Despite
multiple fix migrations, the avatar_url was never actually changed — likely because
a later migration re-set it or the conditional WHERE clause didn't match.

## Fix
1. user_profiles: Unconditional UPDATE of Jordan's avatar_url to ceopic.jpg
2. Also set title to 'Founder / CEO' and is_verified to true for canonical identity
3. Clean up any denormalized avatar references in social tables (currently none exist)

## Security
- No RLS changes
- No schema changes
- Only data correction for a single user profile
*/
UPDATE user_profiles
SET avatar_url = '/assets/profiles/ceopic.jpg',
    title = 'Founder / CEO',
    is_verified = true,
    updated_at = now()
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170';

-- Fix any denormalized avatars that may reference the wrong image
UPDATE network_chat_messages
SET author_avatar = '/assets/profiles/ceopic.jpg'
WHERE author_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND (author_avatar = '/assets/profiles/image.png' OR author_avatar IS NULL);

UPDATE poker_lounge_messages
SET author_avatar = '/assets/profiles/ceopic.jpg'
WHERE author_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND (author_avatar = '/assets/profiles/image.png' OR author_avatar IS NULL);

UPDATE industry_wire_posts
SET source_avatar = '/assets/profiles/ceopic.jpg'
WHERE source_name = 'Jordan McAllister'
  AND (source_avatar = '/assets/profiles/image.png' OR source_avatar IS NULL);
