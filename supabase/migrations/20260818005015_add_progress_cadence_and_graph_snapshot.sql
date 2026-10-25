/*
# Coaching Progress: Add reminder cadence, status, and graph snapshot data

## Changes to coaching_progress_profiles
- Add reminder_interval_days (int, default 30)
- Add next_update_at (timestamptz, nullable)
- Add status (text, default 'active')
- Add end_date (timestamptz, nullable)

## Changes to coaching_progress_snapshots
- Add graph_snapshot_data (jsonb, nullable) — stores frozen graph points
- Add external_image_url (text, nullable) — for optional external screenshot
*/

ALTER TABLE coaching_progress_profiles
  ADD COLUMN IF NOT EXISTS reminder_interval_days int DEFAULT 30,
  ADD COLUMN IF NOT EXISTS next_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS end_date timestamptz;

ALTER TABLE coaching_progress_snapshots
  ADD COLUMN IF NOT EXISTS graph_snapshot_data jsonb,
  ADD COLUMN IF NOT EXISTS external_image_url text;
