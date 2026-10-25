/*
# Media Manager — media_assets and media_assignments

1. New Tables

- `media_assets`
  - `id` (uuid, primary key)
  - `title` (text, not null)
  - `description` (text, nullable)
  - `source_type` (text, not null) — 'uploaded' or 'youtube'
  - `storage_path` (text, nullable) — Supabase Storage path for uploaded files
  - `youtube_video_id` (text, nullable) — YouTube video ID
  - `youtube_url` (text, nullable) — normalized YouTube URL
  - `mime_type` (text, nullable)
  - `file_size` (bigint, nullable) — bytes
  - `duration` (integer, nullable) — seconds
  - `thumbnail_url` (text, nullable) — poster/thumbnail URL
  - `uploaded_by` (text, nullable) — staff account id
  - `status` (text, not null default 'ready') — 'ready' or 'processing'
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

- `media_assignments`
  - `id` (uuid, primary key)
  - `media_asset_id` (uuid, FK → media_assets, ON DELETE CASCADE)
  - `destination` (text, not null) — e.g. 'media_center_primary'
  - `status` (text, not null default 'active') — 'active' or 'inactive'
  - `assigned_by` (text, nullable)
  - `assigned_at` (timestamptz, default now)
  - `display_order` (integer, default 0) — for future playlists

2. Security

- Enable RLS on both tables.
- media_assets: anon + authenticated can SELECT (public read for Media Center playback).
  Only authenticated users can INSERT/UPDATE/DELETE (staff management).
- media_assignments: same pattern — public read, authenticated write.
- Index on media_assignments.destination for fast Media Center lookups.
- Unique partial index: only one active assignment per destination.

3. Notes

- Uses the existing 'user-uploads' storage bucket (already has public CRUD policies).
- The unique partial index on (destination) WHERE status='active' guarantees
  only one primary Media Center video at a time.
- The media_assignments table is designed to support multiple destinations
  (courses, community, advertisements) and future playlists via display_order
  without schema changes.
*/

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source_type text NOT NULL CHECK (source_type IN ('uploaded', 'youtube')),
  storage_path text,
  youtube_video_id text,
  youtube_url text,
  mime_type text,
  file_size bigint,
  duration integer,
  thumbnail_url text,
  uploaded_by text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_public_read" ON media_assets;
CREATE POLICY "media_assets_public_read"
ON media_assets FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "media_assets_auth_insert" ON media_assets;
CREATE POLICY "media_assets_auth_insert"
ON media_assets FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "media_assets_auth_update" ON media_assets;
CREATE POLICY "media_assets_auth_update"
ON media_assets FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "media_assets_auth_delete" ON media_assets;
CREATE POLICY "media_assets_auth_delete"
ON media_assets FOR DELETE
TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS media_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  assigned_by text,
  assigned_at timestamptz DEFAULT now(),
  display_order integer DEFAULT 0
);

ALTER TABLE media_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assignments_public_read" ON media_assignments;
CREATE POLICY "media_assignments_public_read"
ON media_assignments FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "media_assignments_auth_insert" ON media_assignments;
CREATE POLICY "media_assignments_auth_insert"
ON media_assignments FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "media_assignments_auth_update" ON media_assignments;
CREATE POLICY "media_assignments_auth_update"
ON media_assignments FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "media_assignments_auth_delete" ON media_assignments;
CREATE POLICY "media_assignments_auth_delete"
ON media_assignments FOR DELETE
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_media_assignments_destination ON media_assignments(destination);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assignments_unique_active
  ON media_assignments(destination) WHERE status = 'active';
