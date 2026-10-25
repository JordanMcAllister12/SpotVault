ALTER TABLE content_spots
  ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;