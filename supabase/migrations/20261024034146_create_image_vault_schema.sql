/*
# Create Image Vault schema for centralized image management

1. New Tables
- `image_vault_assets` — Central inventory of all images across the platform.
  Each row represents one image file (from public assets, storage buckets, or DB URLs).
  Tracks assignment type, usage references, content hash for duplicate detection, and deletion/quarantine state.
- `image_vault_assignments` — Links images to specific accounts/persons, functions/features, or general/shared use.
  Ensures profile image assignments use account IDs (never array positions or name matching).
- `image_vault_audit_log` — Immutable record of all image vault actions (assignment changes, deletions, quarantine, bulk ops).

2. Storage
- Creates `image-vault` storage bucket (public read, staff-only write, 10 MB limit, image MIME types only).

3. Security
- RLS enabled on all three tables.
- `image_vault_assets`: staff-only write (INSERT/UPDATE/DELETE via sv_is_staff_or_admin check); authenticated read.
- `image_vault_assignments`: staff-only write; authenticated read.
- `image_vault_audit_log`: staff-only write; staff-only read (contains actor info).
- Storage bucket: public read, staff-only write (write policies check sv_is_staff_or_admin).
- EXECUTE revoked from anon on all new functions.

4. Important Notes
- `content_hash` (text) enables duplicate detection — two images with the same hash are duplicates.
- `assignment_type` enum: 'person_account' | 'function_feature' | 'general_shared' | 'unassigned'.
- `status` enum: 'active' | 'quarantined' | 'deleted' — quarantined images are hidden from normal views but recoverable.
- `assigned_account_id` in assignments table uses uuid FK to auth.users — NEVER name-based or array-position matching.
- `code_references` (jsonb) stores the list of source files that reference this image path.
*/

-- ============================================================
-- image_vault_assets
-- ============================================================
CREATE TABLE IF NOT EXISTS image_vault_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  source_path text NOT NULL,
  source_type text NOT NULL DEFAULT 'public_asset', -- 'public_asset' | 'storage_bucket' | 'db_url' | 'external_url'
  source_bucket text,
  filename text NOT NULL,
  directory text,
  extension text NOT NULL,
  mime_type text,
  file_size bigint,
  width integer,
  height integer,
  content_hash text, -- for duplicate detection
  assignment_type text NOT NULL DEFAULT 'unassigned', -- 'person_account' | 'function_feature' | 'general_shared' | 'unassigned'
  status text NOT NULL DEFAULT 'active', -- 'active' | 'quarantined' | 'deleted'
  code_references jsonb DEFAULT '[]'::jsonb, -- array of {file, line?} objects
  thumbnail_url text,
  notes text,
  quarantined_at timestamptz,
  quarantined_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quarantined_reason text,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_vault_assets_hash ON image_vault_assets(content_hash);
CREATE INDEX IF NOT EXISTS idx_image_vault_assets_assignment ON image_vault_assets(assignment_type);
CREATE INDEX IF NOT EXISTS idx_image_vault_assets_status ON image_vault_assets(status);
CREATE INDEX IF NOT EXISTS idx_image_vault_assets_source_path ON image_vault_assets(source_path);

ALTER TABLE image_vault_assets ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON image_vault_assets TO authenticated;
-- Staff write via column-restricted grant (only staff should pass RLS, but column-level adds defense)
REVOKE INSERT, UPDATE, DELETE ON image_vault_assets FROM authenticated;

DROP POLICY IF EXISTS "iv_assets_select_staff_or_authenticated" ON image_vault_assets;
CREATE POLICY "iv_assets_select_staff_or_authenticated"
ON image_vault_assets FOR SELECT
TO authenticated
USING (
  sv_is_staff_or_admin()
  OR (status = 'active')
);

-- Staff-only writes via SECURITY DEFINER functions (see below).
-- Direct table grants for INSERT/UPDATE/DELETE are NOT given to authenticated.
-- service_role bypasses RLS for edge function use.
GRANT INSERT, UPDATE, DELETE ON image_vault_assets TO service_role;

-- ============================================================
-- image_vault_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS image_vault_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid NOT NULL REFERENCES image_vault_assets(id) ON DELETE CASCADE,
  assignment_type text NOT NULL, -- 'person_account' | 'function_feature' | 'general_shared'
  assigned_account_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- for person_account assignments
  assigned_function text, -- e.g. 'player_avatar', 'coach_portal_bg', 'about_page_slide'
  assigned_label text, -- human-readable label for the assignment
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iv_assignments_image ON image_vault_assignments(image_id);
CREATE INDEX IF NOT EXISTS idx_iv_assignments_account ON image_vault_assignments(assigned_account_id);
CREATE INDEX IF NOT EXISTS idx_iv_assignments_type ON image_vault_assignments(assignment_type);

ALTER TABLE image_vault_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON image_vault_assignments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON image_vault_assignments FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON image_vault_assignments TO service_role;

DROP POLICY IF EXISTS "iv_assignments_select_all" ON image_vault_assignments;
CREATE POLICY "iv_assignments_select_all"
ON image_vault_assignments FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- image_vault_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS image_vault_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES image_vault_assets(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'assign' | 'unassign' | 'quarantine' | 'restore' | 'delete' | 'bulk_delete' | 'bulk_assign' | 'import' | 'update'
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iv_audit_image ON image_vault_audit_log(image_id);
CREATE INDEX IF NOT EXISTS idx_iv_audit_created ON image_vault_audit_log(created_at DESC);

ALTER TABLE image_vault_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON image_vault_audit_log TO service_role;
REVOKE INSERT, UPDATE, DELETE ON image_vault_audit_log FROM authenticated;

DROP POLICY IF EXISTS "iv_audit_select_staff" ON image_vault_audit_log;
CREATE POLICY "iv_audit_select_staff"
ON image_vault_audit_log FOR SELECT
TO authenticated
USING (sv_is_staff_or_admin());

-- ============================================================
-- SECURITY DEFINER functions for staff-only mutations
-- ============================================================

-- Upsert an image vault asset (import or update)
CREATE OR REPLACE FUNCTION sv_iv_upsert_asset(
  p_source_path text,
  p_filename text,
  p_extension text,
  p_source_type text DEFAULT 'public_asset',
  p_source_bucket text DEFAULT NULL,
  p_directory text DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL,
  p_content_hash text DEFAULT NULL,
  p_code_references jsonb DEFAULT '[]'::jsonb,
  p_thumbnail_url text DEFAULT NULL,
  p_title text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  INSERT INTO image_vault_assets (
    source_path, filename, extension, source_type, source_bucket,
    directory, mime_type, file_size, content_hash, code_references,
    thumbnail_url, title
  ) VALUES (
    p_source_path, p_filename, p_extension, p_source_type, p_source_bucket,
    p_directory, p_mime_type, p_file_size, p_content_hash, p_code_references,
    p_thumbnail_url, p_title
  )
  ON CONFLICT (source_path) DO UPDATE SET
    filename = EXCLUDED.filename,
    extension = EXCLUDED.extension,
    source_type = EXCLUDED.source_type,
    source_bucket = EXCLUDED.source_bucket,
    directory = EXCLUDED.directory,
    mime_type = COALESCE(EXCLUDED.mime_type, image_vault_assets.mime_type),
    file_size = COALESCE(EXCLUDED.file_size, image_vault_assets.file_size),
    content_hash = COALESCE(EXCLUDED.content_hash, image_vault_assets.content_hash),
    code_references = EXCLUDED.code_references,
    thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, image_vault_assets.thumbnail_url),
    title = EXCLUDED.title,
    updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (v_id, 'update', auth.uid(), jsonb_build_object('source_path', p_source_path));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_upsert_asset(text,text,text,text,text,text,text,bigint,text,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_upsert_asset(text,text,text,text,text,text,text,bigint,text,jsonb,text,text) TO authenticated;

-- Assign an image
CREATE OR REPLACE FUNCTION sv_iv_assign_image(
  p_image_id uuid,
  p_assignment_type text,
  p_assigned_account_id uuid DEFAULT NULL,
  p_assigned_function text DEFAULT NULL,
  p_assigned_label text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  IF p_assignment_type NOT IN ('person_account', 'function_feature', 'general_shared') THEN
    RAISE EXCEPTION 'Invalid assignment type';
  END IF;

  INSERT INTO image_vault_assignments (
    image_id, assignment_type, assigned_account_id, assigned_function, assigned_label, assigned_by
  ) VALUES (
    p_image_id, p_assignment_type, p_assigned_account_id, p_assigned_function, p_assigned_label, auth.uid()
  )
  RETURNING id INTO v_id;

  UPDATE image_vault_assets SET assignment_type = p_assignment_type, updated_at = now() WHERE id = p_image_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (p_image_id, 'assign', auth.uid(), jsonb_build_object(
    'assignment_id', v_id,
    'type', p_assignment_type,
    'account_id', p_assigned_account_id,
    'function', p_assigned_function,
    'label', p_assigned_label
  ));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_assign_image(uuid,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_assign_image(uuid,text,uuid,text,text) TO authenticated;

-- Unassign an image
CREATE OR REPLACE FUNCTION sv_iv_unassign_image(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_image_id uuid;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  SELECT image_id INTO v_image_id FROM image_vault_assignments WHERE id = p_assignment_id;
  IF v_image_id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  DELETE FROM image_vault_assignments WHERE id = p_assignment_id;

  -- Recompute assignment_type on the asset
  UPDATE image_vault_assets SET
    assignment_type = CASE
      WHEN EXISTS (SELECT 1 FROM image_vault_assignments WHERE image_id = v_image_id) THEN
        (SELECT assignment_type FROM image_vault_assignments WHERE image_id = v_image_id LIMIT 1)
      ELSE 'unassigned'
    END,
    updated_at = now()
  WHERE id = v_image_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (v_image_id, 'unassign', auth.uid(), jsonb_build_object('assignment_id', p_assignment_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_unassign_image(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_unassign_image(uuid) TO authenticated;

-- Quarantine an image (soft-hide, recoverable)
CREATE OR REPLACE FUNCTION sv_iv_quarantine_image(p_image_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  UPDATE image_vault_assets SET
    status = 'quarantined',
    quarantined_at = now(),
    quarantined_by = auth.uid(),
    quarantined_reason = p_reason,
    updated_at = now()
  WHERE id = p_image_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (p_image_id, 'quarantine', auth.uid(), jsonb_build_object('reason', p_reason));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_quarantine_image(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_quarantine_image(uuid,text) TO authenticated;

-- Restore from quarantine
CREATE OR REPLACE FUNCTION sv_iv_restore_image(p_image_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  UPDATE image_vault_assets SET
    status = 'active',
    quarantined_at = NULL,
    quarantined_by = NULL,
    quarantined_reason = NULL,
    updated_at = now()
  WHERE id = p_image_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (p_image_id, 'restore', auth.uid(), '{}'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_restore_image(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_restore_image(uuid) TO authenticated;

-- Delete an image (soft-delete with audit trail; storage object is NOT removed)
CREATE OR REPLACE FUNCTION sv_iv_delete_image(p_image_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  UPDATE image_vault_assets SET
    status = 'deleted',
    deleted_at = now(),
    deleted_by = auth.uid(),
    updated_at = now()
  WHERE id = p_image_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (p_image_id, 'delete', auth.uid(), '{}'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_delete_image(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_delete_image(uuid) TO authenticated;

-- Update asset metadata (title, notes)
CREATE OR REPLACE FUNCTION sv_iv_update_asset(
  p_image_id uuid,
  p_title text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_content_hash text DEFAULT NULL,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff only';
  END IF;

  UPDATE image_vault_assets SET
    title = COALESCE(p_title, title),
    notes = COALESCE(p_notes, notes),
    content_hash = COALESCE(p_content_hash, content_hash),
    width = COALESCE(p_width, width),
    height = COALESCE(p_height, height),
    updated_at = now()
  WHERE id = p_image_id;

  INSERT INTO image_vault_audit_log (image_id, action, actor_id, details)
  VALUES (p_image_id, 'update', auth.uid(), jsonb_build_object(
    'title', p_title, 'notes', p_notes, 'content_hash', p_content_hash
  ));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_iv_update_asset(uuid,text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_iv_update_asset(uuid,text,text,text,integer,integer) TO authenticated;

-- ============================================================
-- Storage bucket: image-vault
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'image-vault', 'image-vault', true, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
) ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "iv_storage_public_read" ON storage.objects;
CREATE POLICY "iv_storage_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'image-vault');

-- Staff-only write
DROP POLICY IF EXISTS "iv_storage_staff_insert" ON storage.objects;
CREATE POLICY "iv_storage_staff_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'image-vault'
  AND sv_is_staff_or_admin()
);

DROP POLICY IF EXISTS "iv_storage_staff_update" ON storage.objects;
CREATE POLICY "iv_storage_staff_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'image-vault'
  AND sv_is_staff_or_admin()
)
WITH CHECK (
  bucket_id = 'image-vault'
  AND sv_is_staff_or_admin()
);

DROP POLICY IF EXISTS "iv_storage_staff_delete" ON storage.objects;
CREATE POLICY "iv_storage_staff_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'image-vault'
  AND sv_is_staff_or_admin()
);
