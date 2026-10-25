/*
# Media Manager storage bucket

1. Storage
- Create a 'media-manager' bucket (public read) for uploaded video files.
- Apply public read + authenticated write/delete policies.

2. Notes
- Videos are stored here instead of user-uploads to keep media separate from
  avatars/screenshots.
- The bucket is public so the Media Center player can stream from it.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('media-manager', 'media-manager', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read media-manager" ON storage.objects;
CREATE POLICY "Public read media-manager"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'media-manager');

DROP POLICY IF EXISTS "Authenticated upload media-manager" ON storage.objects;
CREATE POLICY "Authenticated upload media-manager"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media-manager');

DROP POLICY IF EXISTS "Authenticated update media-manager" ON storage.objects;
CREATE POLICY "Authenticated update media-manager"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media-manager') WITH CHECK (bucket_id = 'media-manager');

DROP POLICY IF EXISTS "Authenticated delete media-manager" ON storage.objects;
CREATE POLICY "Authenticated delete media-manager"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media-manager');
