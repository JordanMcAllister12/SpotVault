/*
# Add audio/video attachments to Spots, Multi-Spots, and Presentations

## Purpose
This migration adds support for audio voice notes and video commentary
attachments to Content Spots and Multi-Spot Analysis entries, and extends
guided presentations to support video as the master timeline plus multi-hand
(multi-spot) presentations.

## Changes

### 1. content_spots — add audio_url
- New column `audio_url` (text, nullable): stores a public URL to an audio
  file (voice note) attached to a Content Spot. Audio is uploaded to the
  `user-uploads` Supabase Storage bucket and the public URL is stored here.

### 2. sv_msa_entries — add audio_url and video_url
- New column `audio_url` (text, nullable): per-entry audio commentary URL.
- New column `video_url` (text, nullable): per-entry video commentary URL.
  These are file-based attachments (not YouTube links), stored in user-uploads.

### 3. guided_presentations — add video and multi-spot support
- New column `video_storage_path` (text, nullable): storage path for a video
  file used as the master timeline (alternative to audio_storage_path).
- New column `video_duration` (numeric, nullable): duration of the video in
  seconds, used for timeline scrubbing.
- New column `multi_spot_id` (uuid, nullable): when set, this presentation is
  linked to a Multi-Spot Analysis (content_spots row) rather than a single hand.
  The hand_id column still stores the currently active hand.

## Security
- No RLS policy changes needed; new columns inherit existing table policies.
- All new columns are nullable with no defaults, so existing rows are
  unaffected.
*/

ALTER TABLE content_spots
  ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE sv_msa_entries
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE guided_presentations
  ADD COLUMN IF NOT EXISTS video_storage_path text,
  ADD COLUMN IF NOT EXISTS video_duration numeric,
  ADD COLUMN IF NOT EXISTS multi_spot_id uuid;