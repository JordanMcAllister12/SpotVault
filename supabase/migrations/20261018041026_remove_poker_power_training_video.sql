-- Remove the Poker Power Training Video from the media library.
-- The video (YouTube ID Bbh9altzjtw) was seeded by migration
-- 20261012202200_add_peak6_youtube_media_asset. This removes its
-- media_assignment and the media_asset row so it no longer appears
-- in the Media Player's "My Content" tab or anywhere else.
-- The media player infrastructure is preserved for future content.

DELETE FROM media_assignments
  WHERE media_asset_id IN (
    SELECT id FROM media_assets WHERE youtube_video_id = 'Bbh9altzjtw'
  );

DELETE FROM media_assets WHERE youtube_video_id = 'Bbh9altzjtw';