/*
# Allow published presentation media playback

1. Modified Storage Policy
- Updates the `presentation_storage_select_owner` policy for the private `presentation-media` bucket.
- Owners retain access to their own presentation files.
- Authenticated viewers may read a file only when its path's presentation ID belongs to a published guided presentation.

2. Security
- Upload, update, and delete policies remain owner-only.
- The path is matched to the published presentation row instead of exposing the bucket publicly.
- Draft presentation files remain inaccessible to other users.
*/

DROP POLICY IF EXISTS "presentation_storage_select_owner" ON storage.objects;
CREATE POLICY "presentation_storage_select_owner" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'presentation-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.guided_presentations p
        WHERE p.id = ((storage.foldername(name))[2])::uuid
          AND p.status = 'published'
      )
    )
  );
