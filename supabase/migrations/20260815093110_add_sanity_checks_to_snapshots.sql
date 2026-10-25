ALTER TABLE poker_analytics_snapshots
ADD COLUMN IF NOT EXISTS sanity_checks jsonb DEFAULT '[]'::jsonb;