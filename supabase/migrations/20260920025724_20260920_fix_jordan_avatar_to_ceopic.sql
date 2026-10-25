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
1. user_profiles: Update Jordan McAllister's avatar_url from image.png → ceopic.jpg
2. industry_wire_posts: Update all Jordan McAllister source_avatar from image.png → ceopic.jpg
3. network_chat_messages: Update all Jordan McAllister author_avatar from image.png → ceopic.jpg
4. poker_lounge_messages: Update all Jordan McAllister author_avatar from image.png → ceopic.jpg
5. poker_scene_shoutouts: Set Jordan McAllister user_avatar to ceopic.jpg where null

Bryan Paris's avatar ('/assets/profiles/image copy.png') is already correct and is NOT modified.
*/