ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS remember_portal boolean NOT NULL DEFAULT false;
