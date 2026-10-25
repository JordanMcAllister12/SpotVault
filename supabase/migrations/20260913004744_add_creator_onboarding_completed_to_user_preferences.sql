ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS creator_onboarding_completed boolean NOT NULL DEFAULT false;
