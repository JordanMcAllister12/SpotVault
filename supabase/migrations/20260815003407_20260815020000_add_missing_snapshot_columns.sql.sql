-- Add missing columns to poker_analytics_snapshots that the analytics engine inserts
ALTER TABLE poker_analytics_snapshots
  ADD COLUMN IF NOT EXISTS flop_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS turn_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS river_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS starting_hands JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '{}'::jsonb;
