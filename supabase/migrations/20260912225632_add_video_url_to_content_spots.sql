/*
# Add video_url to content_spots

1. Changes
- Adds `video_url` (text, nullable) to `content_spots`.
- This stores an optional supplementary video URL (YouTube link or embed URL)
  for Spots that include a video explanation alongside the written analysis.
- The written content remains the primary material; the video is supplementary.

2. Security
- No RLS policy changes. Existing policies on `content_spots` remain unchanged.
- The column is nullable so existing rows are unaffected.

3. Notes
- This column is read by the SpotViewer component to render a small embedded
  video player inside the Spot Viewer, NOT in the full Media Center.
- Text-only Spots simply have `video_url = null` and show no video section.
*/

ALTER TABLE content_spots
  ADD COLUMN IF NOT EXISTS video_url text;
