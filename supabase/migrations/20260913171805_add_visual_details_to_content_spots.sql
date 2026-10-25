/*
# Add Visual Details to content_spots

1. New Columns
- `content_spots.visual_details` (jsonb, nullable) — ordered array of image objects
  with optional captions. Format: [{ "url": "...", "caption": "..." }, ...]

2. Data
- Updates the demo spot (id 00000000-0000-0000-0000-000000000001) to include
  the two new Visual Details images in order.

3. Security
- No new RLS policies needed — the column is covered by existing content_spots
  policies (owner-scoped via account_id).
*/

ALTER TABLE content_spots
ADD COLUMN IF NOT EXISTS visual_details jsonb;

-- Seed visual_details for the demo spot with the two new images
UPDATE content_spots
SET visual_details = jsonb_build_array(
  jsonb_build_object(
    'url', '/assets/spots/The%20Difference%20Between%20Good%20%26%20Great%3F/image%20copy%202.png',
    'caption', ''
  ),
  jsonb_build_object(
    'url', '/assets/spots/The%20Difference%20Between%20Good%20%26%20Great%3F/image%20copy%203.png',
    'caption', ''
  )
)
WHERE id = '00000000-0000-0000-0000-000000000001';
