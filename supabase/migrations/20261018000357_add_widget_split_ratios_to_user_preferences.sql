/*
# Add widget split ratio columns to user_preferences

## Purpose
Stores per-user widget divider proportions so the Home Workspace
restores each user's preferred Media Player and Messaging split
layout across refreshes and re-logins.

## Changes
1. New column `media_split_ratio` (real, nullable) — MediaWidget
   vertical divider proportion (0.2–0.85). NULL = use built-in default.
2. New column `messaging_split_ratio` (real, nullable) — MessagingWorkspace
   horizontal divider proportion (0.2–0.8). NULL = use built-in default.

## Security
- No RLS policy changes. The existing user_preferences policies already
  restrict access to the owning user via auth.uid() = user_id.
- No new tables created.
*/

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS media_split_ratio real DEFAULT NULL;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS messaging_split_ratio real DEFAULT NULL;
