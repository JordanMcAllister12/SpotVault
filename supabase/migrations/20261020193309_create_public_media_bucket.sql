/*
# Create public media bucket for intro video

1. New Storage
- Public bucket `public-media` for serving the original SpotVault intro video
  from the app's own Supabase project (instead of a cross-project URL).
2. Security
- Public bucket (public = true) — the intro video is intended for all authenticated users.
- RLS enabled on storage.objects for the bucket; public read policy added.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-media', 'public-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_public_media" ON storage.objects;
CREATE POLICY "public_read_public_media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'public-media');

DROP POLICY IF EXISTS "authed_write_public_media" ON storage.objects;
CREATE POLICY "authed_write_public_media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public-media');
