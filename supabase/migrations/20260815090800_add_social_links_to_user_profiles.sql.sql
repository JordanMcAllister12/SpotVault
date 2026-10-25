/*
# Add social_links column to user_profiles

1. Modified Tables
- `user_profiles`: Add `social_links` column (jsonb, nullable) to store
  optional social media links (Twitter, Instagram, Twitch, YouTube, etc.)
2. Security
- No RLS changes needed — existing policies already cover the column.
*/

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;
