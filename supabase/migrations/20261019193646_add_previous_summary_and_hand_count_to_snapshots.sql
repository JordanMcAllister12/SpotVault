-- Add previous_summary and previous_hand_count columns to poker_analytics_snapshots
-- These are used by recalculateAnalytics() to store the prior snapshot's summary
-- and hand count for trend calculation. The code writes these fields on every
-- snapshot upsert, but the columns were never created in the table.

ALTER TABLE poker_analytics_snapshots
  ADD COLUMN IF NOT EXISTS previous_summary jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS previous_hand_count integer DEFAULT NULL;
