/*
# Add hand_id to content_spots

1. Changes
- Add `hand_id` text column to `content_spots` table.
- This column stores a reference to a saved hand in `poker_hand_records` (by hand_id).
- Nullable: existing spots have no attached hand and continue to work unchanged.
- No foreign key constraint is added because poker_hand_records.hand_id is not
  guaranteed to be unique per row (it can appear across different users' imports),
  and we want to allow referencing any hand the creator has access to without
  strict referential integrity that could break on hand re-imports.
2. Security
- No RLS policy changes. Existing content_spots RLS policies already govern
  SELECT/INSERT/UPDATE/DELETE by account ownership. The new column inherits
  those protections automatically.
3. Notes
- Existing spots without hand_id render normally (intro → hand details).
- Spots WITH hand_id render an embedded HH Replayer between intro and hand details.
- The column is TEXT (not UUID) because hand_id values in poker_hand_records
  are text strings, not UUIDs.
*/

ALTER TABLE content_spots
ADD COLUMN IF NOT EXISTS hand_id text;
