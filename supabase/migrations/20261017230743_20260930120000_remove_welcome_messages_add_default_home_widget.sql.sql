/*
# Remove Welcome Messages + Add Default Home Widget Preference

## Purpose
1. Deletes all existing `new_user_welcome_v1` system messages from the `system_messages` table
   so users no longer see the automated signup welcome message.
2. Adds a `default_home_widget` column to `user_preferences` so the user's preferred default
   Home workspace experience (Media / Chat / Communication) can be persisted per user.

## Changes
### system_messages
- DELETE all rows where `message_key = 'new_user_welcome_v1'`.
  The table and `sv_send_system_message` function remain intact for future configurable messages.

### user_preferences
- ADD COLUMN `default_home_widget text` (nullable) — stores the user's preferred default
  Home widget id: `'media'`, `'chat'`, or `'communication'`. NULL means "use system default".

## Security
- No policy changes. The existing RLS on both tables remains unchanged.
- `default_home_widget` is user-editable content (a personal preference), not a privilege field.

## Important Notes
1. The `sv_send_system_message` RPC is NOT dropped — it remains available for future
   system messages (coach notifications, platform announcements, etc.).
2. The frontend will stop calling `sendWelcomeMessage` entirely; the DELETE here removes
   any already-created welcome messages so existing users don't see stale copies.
3. The migration is idempotent: re-running safely deletes any new welcome rows and
   the ADD COLUMN uses IF NOT EXISTS.
*/

-- Remove all existing welcome messages
DELETE FROM system_messages WHERE message_key = 'new_user_welcome_v1';

-- Add default_home_widget column to user_preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'default_home_widget'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN default_home_widget text;
  END IF;
END $$;