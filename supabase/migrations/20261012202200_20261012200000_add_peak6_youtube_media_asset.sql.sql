/*
# Add YouTube video media asset for Peak6 Poker Power portal

1. Purpose
   - Inserts a YouTube media asset for the video at https://www.youtube.com/watch?v=Bbh9altzjtw
   - Assigns it to the `player_my_spots` destination so it appears in the Media Player
   - This makes the video available to all portal users (including Peak6account)
   - The video ID is `Bbh9altzjtw` and the start position is 29 seconds

2. Tables affected
   - `media_assets` — INSERT one row (YouTube source type)
   - `media_assignments` — INSERT one row linking the asset to `player_my_spots`

3. Security
   - No schema changes. RLS already allows public SELECT on both tables.
   - INSERT is done via migration (service role), not client.
   - Idempotent: uses ON CONFLICT DO NOTHING on a unique youtube_video_id check.

4. Notes
   - The MediaWidget queries `media_assignments` with `destination = 'player_my_spots'` and `status = 'active'`
   - The YouTube iframe embed URL in MediaWidget uses the youtube_video_id field
   - The start-at-29s parameter is handled client-side by the auto-select logic
*/

INSERT INTO media_assets (title, source_type, youtube_video_id, youtube_url, status, uploaded_by)
SELECT 'Poker Power Training Video', 'youtube', 'Bbh9altzjtw', 'https://www.youtube.com/watch?v=Bbh9altzjtw', 'active', 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM media_assets WHERE youtube_video_id = 'Bbh9altzjtw'
);

INSERT INTO media_assignments (media_asset_id, destination, status, assigned_by, display_order)
SELECT ma.id, 'player_my_spots', 'active', 'system', 0
FROM media_assets ma
WHERE ma.youtube_video_id = 'Bbh9altzjtw'
AND NOT EXISTS (
  SELECT 1 FROM media_assignments maa WHERE maa.media_asset_id = ma.id AND maa.destination = 'player_my_spots'
);
