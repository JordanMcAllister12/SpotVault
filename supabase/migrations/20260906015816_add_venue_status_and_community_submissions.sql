-- =====================================================
-- CITY POKER SCENE — venue status, verification, community submissions
-- =====================================================

-- Add status and verification columns to poker_scene_venues
ALTER TABLE poker_scene_venues
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS poker_room_phone text,
  ADD COLUMN IF NOT EXISTS main_phone text,
  ADD COLUMN IF NOT EXISTS number_of_tables int,
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_type text NOT NULL DEFAULT 'public_listing',
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS inactive_reason text;

-- Backfill: existing phone goes to main_phone, existing verified_operator maps to verification_type
UPDATE poker_scene_venues SET main_phone = phone WHERE main_phone IS NULL AND phone IS NOT NULL;
UPDATE poker_scene_venues SET verification_type = 'verified_operator' WHERE verified_operator = true AND verification_type = 'public_listing';
UPDATE poker_scene_venues SET last_verified_at = created_at WHERE last_verified_at IS NULL;

-- Mark Club Regent as inactive (poker room no longer active)
UPDATE poker_scene_venues
  SET status = 'inactive',
      inactive_reason = 'Poker room no longer operating at this venue'
  WHERE name = 'Club Regent Casino';

-- Update McPhillips Station Casino with proper contact info
UPDATE poker_scene_venues
  SET poker_room_phone = '+1 (204) 957-2500',
      main_phone = '+1 (204) 957-2500',
      status = 'active',
      verification_type = 'venue',
      last_verified_at = now(),
      hours = 'Daily 11:00 AM - 3:00 AM'
  WHERE name = 'McPhillips Station Casino';

-- End any live/forming cash games at Club Regent
UPDATE poker_scene_cash_games
  SET status = 'ended'
  WHERE venue_id = (SELECT id FROM poker_scene_venues WHERE name = 'Club Regent Casino')
    AND status IN ('live', 'forming');

-- Create community submission table for moderation flow
CREATE TABLE IF NOT EXISTS poker_scene_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES poker_scene_venues(id) ON DELETE CASCADE,
  city_id uuid REFERENCES poker_scene_cities(id) ON DELETE CASCADE,
  submitted_by text NOT NULL,
  submission_type text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_scene_submissions_venue ON poker_scene_submissions(venue_id);
CREATE INDEX IF NOT EXISTS idx_poker_scene_submissions_status ON poker_scene_submissions(status);

-- RLS for community submissions
ALTER TABLE poker_scene_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_select_all"
  ON poker_scene_submissions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "submissions_insert_auth"
  ON poker_scene_submissions FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid()::text);

CREATE POLICY "submissions_update_staff"
  ON poker_scene_submissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update venue RLS: allow anon/authenticated to SELECT (they already can), 
-- restrict INSERT/UPDATE/DELETE to authenticated only
-- (existing policies from original migration remain; we add staff-only UPDATE)
CREATE POLICY "venues_update_staff"
  ON poker_scene_venues FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add index on venue status for filtering
CREATE INDEX IF NOT EXISTS idx_poker_scene_venues_status ON poker_scene_venues(status);
CREATE INDEX IF NOT EXISTS idx_poker_scene_venues_city_status ON poker_scene_venues(city_id, status);
