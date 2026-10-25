/*
# Fix Media Manager RLS — superuser authorization

## Root Cause
1. `sv_roles.role` CHECK constraint only allowed ('player','coach','creator','investor','stable_operator','business','staff')
   — it did NOT include 'superuser','admin','owner', so those roles could never be stored.
2. The `sv_roles` table was empty — the Superuser account (jordan@spotvault.com) had no role row.
3. Media Manager RLS policies only checked `role = 'staff'`, excluding superuser/admin/owner.

## Fix
1. Drop and replace the CHECK constraint on `sv_roles.role` to include 'superuser','admin','owner'.
2. Seed the Superuser's auth UID into `sv_roles` with role='superuser', status='active'.
3. Update all media_assets and media_assignments write policies to accept role IN ('staff','superuser','admin','owner').
4. Update storage bucket policies to accept the same role set.
5. Public read access is preserved for regular users.

## Security
- RLS remains enabled on all tables.
- Regular authenticated users and anon retain only SELECT on media_assets/media_assignments.
- Only active privileged roles can INSERT/UPDATE/DELETE.
*/

-- 1. Expand the role CHECK constraint to include superuser/admin/owner
ALTER TABLE sv_roles DROP CONSTRAINT IF EXISTS sv_roles_role_check;
ALTER TABLE sv_roles ADD CONSTRAINT sv_roles_role_check
  CHECK (role IN ('player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff', 'superuser', 'admin', 'owner'));

-- 2. Seed the Superuser account (jordan@spotvault.com) with role='superuser'
INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at)
SELECT au.id, 'superuser', 'active', au.id, now()
FROM auth.users au
WHERE au.email = 'jordan@spotvault.com'
  AND NOT EXISTS (
    SELECT 1 FROM sv_roles sr WHERE sr.user_id = au.id AND sr.role = 'superuser'
  )
ON CONFLICT (user_id, role) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

-- 3. Update media_assets write policies to accept all privileged roles
DROP POLICY IF EXISTS "media_assets_staff_insert" ON media_assets;
CREATE POLICY "media_assets_privileged_insert"
ON media_assets FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assets_staff_update" ON media_assets;
CREATE POLICY "media_assets_privileged_update"
ON media_assets FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assets_staff_delete" ON media_assets;
CREATE POLICY "media_assets_privileged_delete"
ON media_assets FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

-- 4. Update media_assignments write policies to accept all privileged roles
DROP POLICY IF EXISTS "media_assignments_staff_insert" ON media_assignments;
CREATE POLICY "media_assignments_privileged_insert"
ON media_assignments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assignments_staff_update" ON media_assignments;
CREATE POLICY "media_assignments_privileged_update"
ON media_assignments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_assignments_staff_delete" ON media_assignments;
CREATE POLICY "media_assignments_privileged_delete"
ON media_assignments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

-- 5. Update storage bucket policies to accept all privileged roles
DROP POLICY IF EXISTS "Staff upload media-manager" ON storage.objects;
CREATE POLICY "Privileged upload media-manager"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "Staff update media-manager" ON storage.objects;
CREATE POLICY "Privileged update media-manager"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);

DROP POLICY IF EXISTS "Staff delete media-manager" ON storage.objects;
CREATE POLICY "Privileged delete media-manager"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-manager'
  AND EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
      AND sv_roles.status = 'active'
  )
);
