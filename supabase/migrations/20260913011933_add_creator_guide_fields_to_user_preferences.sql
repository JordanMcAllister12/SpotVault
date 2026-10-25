-- Replace creator_onboarding_completed with the richer creator_guide_seen + timestamp pattern.
-- (creator_onboarding_completed was added in a prior migration; keep it for backwards compat
-- but add the new authoritative fields.)

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS creator_guide_seen boolean NOT NULL DEFAULT false;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS creator_guide_seen_at timestamptz;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS creator_guide_email_sent_at timestamptz;
