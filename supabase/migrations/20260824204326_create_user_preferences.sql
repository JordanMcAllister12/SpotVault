/*
# Create user_preferences table

1. Purpose
   Stores per-user personalization: per-screen background selections,
   home screen widget visibility/order, and any future user-level settings.
   Each row belongs to one authenticated user.

2. New Tables
   - user_preferences
     - user_id (uuid, primary key, references auth.users, defaults to auth.uid())
     - backgrounds (jsonb, default '{}') — maps ScreenTarget → environment asset id
     - home_widgets (jsonb, default '{}') — { enabled: string[], order: string[] }
     - updated_at (timestamptz, default now())

3. Security
   - RLS enabled.
   - Owner-scoped CRUD: each authenticated user can only read/insert/update/delete
     their own row. The DEFAULT auth.uid() on user_id ensures inserts that omit
     user_id still satisfy the WITH CHECK policy.
*/

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  backgrounds jsonb NOT NULL DEFAULT '{}'::jsonb,
  home_widgets jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_preferences" ON user_preferences;
CREATE POLICY "select_own_preferences" ON user_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_preferences" ON user_preferences;
CREATE POLICY "insert_own_preferences" ON user_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_preferences" ON user_preferences;
CREATE POLICY "update_own_preferences" ON user_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_preferences" ON user_preferences;
CREATE POLICY "delete_own_preferences" ON user_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
