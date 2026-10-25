ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS player_room_layout jsonb DEFAULT '{}'::jsonb;
