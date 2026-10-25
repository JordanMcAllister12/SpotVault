/*
# Add creator_guide_auto_show column to user_preferences

1. Changes
- Add `creator_guide_auto_show` boolean column to `user_preferences`, defaulting to `true`.
- This lets users permanently dismiss the auto-display of the Creator Guide
  while still allowing manual access via the "Creator Guide" button.
- Existing rows get `true` (preserving current behavior for users who haven't dismissed yet).
- Users who previously completed/dismissed the guide already have
  `creator_guide_seen = true`, which already prevents auto-show — so no
  regression for them.
*/

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS creator_guide_auto_show boolean NOT NULL DEFAULT true;
