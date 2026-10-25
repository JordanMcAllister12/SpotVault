/*
# Add expiration + Info Feed rotation settings for staff announcements

## Purpose
The Staff Control Console Announcements section is being redesigned to support
scheduled expiration of announcements and an Info Feed rotation feature that
cycles published announcements at a configurable interval.

## Changes

### 1. staff_announcements table — new column
- `expires_at` (timestamptz, nullable) — when set, the announcement is considered
  expired after this timestamp. The frontend filters out expired announcements
  from the published feed. Existing rows get NULL (no expiration), preserving
  all current behavior.

### 2. app_settings table — new setting key
- A row with key `info_feed_rotation` is seeded with JSON:
  `{ "enabled": false, "interval_seconds": 30 }`
- This controls whether the Info Feed auto-rotates through published announcements
  and at what interval. Staff can toggle and adjust this from the Announcements
  console.

## Security
- No RLS changes needed. `staff_announcements` already has RLS enabled with
  existing policies. `app_settings` already has RLS enabled.
- The new `expires_at` column inherits the table's existing RLS policies.

## Notes
1. The `expires_at` column is nullable so all existing announcements remain
   valid with no expiration.
2. The rotation settings are stored as JSONB in `app_settings` under the
   `info_feed_rotation` key, reusing the existing key-value infrastructure.
3. Migration is idempotent — the column is only added if it doesn't exist,
   and the settings row uses ON CONFLICT to avoid duplicates.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_announcements' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE staff_announcements ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

INSERT INTO app_settings (key, value)
VALUES ('info_feed_rotation', '{"enabled": false, "interval_seconds": 30}'::jsonb)
ON CONFLICT (key) DO NOTHING;
