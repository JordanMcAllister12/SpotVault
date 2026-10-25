/*
# Add coach_widget_layouts column to user_preferences

1. Changes
- Adds `coach_widget_layouts` (jsonb, default '{}') to the `user_preferences` table.
- Stores per-coach floating widget positions, sizes, and open/minimized/maximized state
  for widgets on the Coach Home screen (Schedule, Chat, etc.).
- Keyed by widget id (e.g. "coach-schedule", "coach-chat"), each value is a JSON object
  with { x, y, width, height, open, minimized, maximized }.
2. Security
- No new tables. Column inherits existing RLS policies on user_preferences
  (owner-scoped to auth.uid()).
3. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ to avoid duplicate column errors.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'coach_widget_layouts'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN coach_widget_layouts jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;