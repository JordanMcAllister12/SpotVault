/*
# Correct Dane Cook and Bryan Paris profile images

## Purpose
Replace the shared incorrect image mapping with the supplied Dane Cook photo
and restore Bryan Paris to his existing dedicated coach portrait.

## Image assignments
- Dane Cook (`28635338-812c-4c83-a7b7-b10d007e7715`) uses
  `/assets/profiles/image copy 6.png`, the supplied authoritative photograph.
- Bryan Paris (`d421b1bd-f8c6-4cd0-b68f-40ae275e99ba`) uses
  `/assets/profiles/image copy.png`, the existing portrait already used by his
  dedicated coach listing.

## Tables modified
- `user_profiles.avatar_url` for Dane and Bryan.
- `coach_listings.profile_photo_url` for Bryan.
- `network_chat_messages.author_avatar` for authored records.
- `industry_wire_posts.source_avatar` for authored records.
- `poker_lounge_messages.author_avatar` for authored records.
- `spot_comments.author_avatar` for authored records.

`community_posts` stores author IDs and resolves avatars from `user_profiles`,
so no copied avatar field is present there.

## Security and preservation
- No permissions, memberships, roles, credentials, badges, or portal access are changed.
- No rows are deleted and no hand-history records are copied into Dane's account.
- Updates are restricted to records owned by the two identified account IDs or
  their exact display/handle identity, preventing changes to unrelated users.
*/

UPDATE user_profiles
SET avatar_url = '/assets/profiles/image copy 6.png', updated_at = now()
WHERE user_id = '28635338-812c-4c83-a7b7-b10d007e7715';

UPDATE user_profiles
SET avatar_url = '/assets/profiles/image copy.png', updated_at = now()
WHERE user_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

UPDATE coach_listings
SET profile_photo_url = '/assets/profiles/image copy.png', updated_at = now()
WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

UPDATE network_chat_messages
SET author_avatar = '/assets/profiles/image copy 6.png'
WHERE author_id = '28635338-812c-4c83-a7b7-b10d007e7715'
   OR (author_name = 'Dane Cook' AND author_avatar = '/assets/profiles/image.png');

UPDATE network_chat_messages
SET author_avatar = '/assets/profiles/image copy.png'
WHERE author_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba'
   OR (author_name = 'Bryan Paris' AND author_avatar = '/assets/profiles/image.png');

UPDATE industry_wire_posts
SET source_avatar = '/assets/profiles/image copy 6.png'
WHERE source_name = 'Dane Cook' OR source_handle IN ('DaneCook', '@DaneCook');

UPDATE industry_wire_posts
SET source_avatar = '/assets/profiles/image copy.png'
WHERE source_name = 'Bryan Paris' OR source_handle IN ('BryanParis', '@BryanParis');

UPDATE poker_lounge_messages
SET author_avatar = '/assets/profiles/image copy 6.png'
WHERE author_id = '28635338-812c-4c83-a7b7-b10d007e7715';

UPDATE poker_lounge_messages
SET author_avatar = '/assets/profiles/image copy.png'
WHERE author_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';

UPDATE spot_comments
SET author_avatar = '/assets/profiles/image copy 6.png'
WHERE author_id = '28635338-812c-4c83-a7b7-b10d007e7715';

UPDATE spot_comments
SET author_avatar = '/assets/profiles/image copy.png'
WHERE author_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
