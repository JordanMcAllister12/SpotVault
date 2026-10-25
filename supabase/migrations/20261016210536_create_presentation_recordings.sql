/*
# Create Presentation Recordings System

## Purpose
Stores voice and video recordings created in the Workspace Presentation Studio, including replay synchronization data and Spot/Multi-Spot attachments.

## New Tables

### `sv_presentation_recordings`
- `id` (uuid, primary key)
- `user_id` (uuid, not null, defaults to auth.uid() — owner of the recording)
- `title` (text, not null — display name)
- `media_type` (text, not null — 'audio' or 'video')
- `duration_seconds` (integer — recording length)
- `file_size_bytes` (bigint — stored blob size)
- `storage_path` (text — path in the presentation-media storage bucket)
- `hand_id` (text, nullable — associated poker hand ID)
- `sync_data` (jsonb, nullable — replay synchronization timeline markers)
- `status` (text, not null, default 'active' — 'active', 'processing', 'deleted')
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `sv_presentation_attachments`
- `id` (uuid, primary key)
- `recording_id` (uuid, references sv_presentation_recordings ON DELETE CASCADE)
- `content_spot_id` (uuid, nullable — attached to a Spot)
- `multispot_id` (uuid, nullable — attached to a Multi-Spot)
- `multispot_member_id` (uuid, nullable — specific Spot within a Multi-Spot)
- `is_intro` (boolean, default false — introductory recording for a Multi-Spot)
- `created_at` (timestamptz, default now())

## Storage
- Creates a `presentation-media` storage bucket for audio/video files.

## Security
- RLS enabled on both tables.
- Owner-scoped CRUD on `sv_presentation_recordings` (auth.uid() = user_id).
- Attachment access scoped through recording ownership.
- Storage bucket policies allow authenticated users to manage their own files.
*/

CREATE TABLE IF NOT EXISTS sv_presentation_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('audio', 'video')),
  duration_seconds integer NOT NULL DEFAULT 0,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text,
  hand_id text,
  sync_data jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'processing', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_presentation_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recordings" ON sv_presentation_recordings;
CREATE POLICY "select_own_recordings" ON sv_presentation_recordings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recordings" ON sv_presentation_recordings;
CREATE POLICY "insert_own_recordings" ON sv_presentation_recordings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recordings" ON sv_presentation_recordings;
CREATE POLICY "update_own_recordings" ON sv_presentation_recordings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recordings" ON sv_presentation_recordings;
CREATE POLICY "delete_own_recordings" ON sv_presentation_recordings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_presentation_recordings_user ON sv_presentation_recordings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_presentation_recordings_hand ON sv_presentation_recordings(hand_id);

CREATE TABLE IF NOT EXISTS sv_presentation_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES sv_presentation_recordings(id) ON DELETE CASCADE,
  content_spot_id uuid,
  multispot_id uuid,
  multispot_member_id uuid,
  is_intro boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_presentation_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_attachments" ON sv_presentation_attachments;
CREATE POLICY "select_own_attachments" ON sv_presentation_attachments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_presentation_recordings r WHERE r.id = sv_presentation_attachments.recording_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_attachments" ON sv_presentation_attachments;
CREATE POLICY "insert_own_attachments" ON sv_presentation_attachments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM sv_presentation_recordings r WHERE r.id = sv_presentation_attachments.recording_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_attachments" ON sv_presentation_attachments;
CREATE POLICY "delete_own_attachments" ON sv_presentation_attachments
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_presentation_recordings r WHERE r.id = sv_presentation_attachments.recording_id AND r.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_presentation_attachments_recording ON sv_presentation_attachments(recording_id);
CREATE INDEX IF NOT EXISTS idx_presentation_attachments_spot ON sv_presentation_attachments(content_spot_id);
CREATE INDEX IF NOT EXISTS idx_presentation_attachments_multispot ON sv_presentation_attachments(multispot_id);

-- Insert the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation-media', 'presentation-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_presentation_media" ON storage.objects;
CREATE POLICY "auth_upload_presentation_media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'presentation-media' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "auth_read_presentation_media" ON storage.objects;
CREATE POLICY "auth_read_presentation_media" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'presentation-media' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "auth_delete_presentation_media" ON storage.objects;
CREATE POLICY "auth_delete_presentation_media" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'presentation-media' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );
