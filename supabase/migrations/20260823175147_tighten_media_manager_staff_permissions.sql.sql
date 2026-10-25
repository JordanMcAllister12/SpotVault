/*
# Restrict Media Manager writes to active staff

1. Security Changes
- Replace broad authenticated write policies on `media_assets` with active-staff-only policies.
- Replace broad authenticated write policies on `media_assignments` with active-staff-only policies.
- Restrict uploads, updates, and deletes in the `media-manager` storage bucket to active staff.
- Keep public read access so the Media Center can play published media for regular users.

2. Authorization Rule
- A caller must have an active `staff` row in `sv_roles`.
- Regular authenticated players and unauthenticated visitors can read published media but cannot manage it.
*/

DROP POLICY IF EXISTS "media_assets_auth_insert" ON media_assets;
CREATE POLICY "media_assets_staff_insert"
ON media_assets FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assets_auth_update" ON media_assets;
CREATE POLICY "media_assets_staff_update"
ON media_assets FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assets_auth_delete" ON media_assets;
CREATE POLICY "media_assets_staff_delete"
ON media_assets FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assignments_auth_insert" ON media_assignments;
CREATE POLICY "media_assignments_staff_insert"
ON media_assignments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assignments_auth_update" ON media_assignments;
CREATE POLICY "media_assignments_staff_update"
ON media_assignments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assignments_auth_delete" ON media_assignments;
CREATE POLICY "media_assignments_staff_delete"
ON media_assignments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "Authenticated upload media-manager" ON storage.objects;
CREATE POLICY "Staff upload media-manager"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "Authenticated update media-manager" ON storage.objects;
CREATE POLICY "Staff update media-manager"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "Authenticated delete media-manager" ON storage.objects;
CREATE POLICY "Staff delete media-manager"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
  )
);
