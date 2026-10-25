/*
# Add stakekings_theme column to user_preferences

1. Purpose
   Stores the user's preferred accent theme for the StakeKings Player Development
   portal. This is a visual preference only — it does not affect permissions,
   routing, or functionality.

2. Changes
   - ALTER TABLE user_preferences ADD COLUMN stakekings_theme text
     NOT NULL DEFAULT 'default'
     — Values: 'default' (SpotVault gold) or 'stakekings' (StakeKings green)
   - CHECK constraint ensures only valid theme values are stored.

3. Security
   - No RLS policy changes needed — existing policies already allow each
     authenticated user to read/update their own row.
   - The new column is covered by the existing SELECT/INSERT/UPDATE policies
     because they operate at the row level, not column level.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences'
      AND column_name = 'stakekings_theme'
  ) THEN
    ALTER TABLE user_preferences
      ADD COLUMN stakekings_theme text NOT NULL DEFAULT 'default';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_preferences_stakekings_theme_check'
      AND table_name = 'user_preferences'
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT user_preferences_stakekings_theme_check
      CHECK (stakekings_theme IN ('default', 'stakekings'));
  END IF;
END $$;
