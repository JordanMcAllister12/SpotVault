/*
# Storage policies for user-uploads bucket

1. Security
- Allow anon + authenticated to upload, read, and delete files in the
  user-uploads bucket. This is a demo/prototype app with no real auth,
  so public access is intentional.
- Avatars and accomplishment screenshots are stored here.
*/

-- Enable public read access
DROP POLICY IF EXISTS "Public read user-uploads" ON storage.objects;
CREATE POLICY "Public read user-uploads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'user-uploads');

-- Allow uploads
DROP POLICY IF EXISTS "Public upload user-uploads" ON storage.objects;
CREATE POLICY "Public upload user-uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'user-uploads');

-- Allow updates (for upserts)
DROP POLICY IF EXISTS "Public update user-uploads" ON storage.objects;
CREATE POLICY "Public update user-uploads"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'user-uploads') WITH CHECK (bucket_id = 'user-uploads');

-- Allow deletes
DROP POLICY IF EXISTS "Public delete user-uploads" ON storage.objects;
CREATE POLICY "Public delete user-uploads"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'user-uploads');
