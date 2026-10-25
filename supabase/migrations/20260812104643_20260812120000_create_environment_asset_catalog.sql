/*
# Create durable environment asset catalog

1. New Tables
- `public.spotvault_environment_assets`
- `id` (text, stable asset identifier)
- `display_name` (text, editable Staff Room label)
- `file_name` (text, original uploaded filename)
- `file_path` (text, stored source path)
- `src` (text, public image URL or null for generated environments)
- `kind` (text, image or generated)
- `allowed_screens` (text array, explicit available-screen assignments)
- `notes` (text, Staff Room-only internal notes)
- `created_at` and `updated_at` timestamps

2. Storage
- Creates the public `spotvault-assets` bucket for background/environment images.
- Uploads are limited to image MIME types and 10 MB per file.

3. Security
- Enables row level security on the catalog.
- Adds separate SELECT, INSERT, UPDATE, and DELETE policies for the single-tenant demo application, which intentionally shares this Staff-managed catalog through the anon client.
- Adds separate storage object policies scoped to the `spotvault-assets` bucket.

4. Important Notes
- New catalog rows start with an empty `allowed_screens` array and must be explicitly assigned by Staff Room.
- Existing static assignments are preserved by the application seed process and are not overwritten by this migration.
*/

CREATE TABLE IF NOT EXISTS public.spotvault_environment_assets (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  src text,
  kind text NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'generated')),
  allowed_screens text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spotvault_environment_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_environment_assets" ON public.spotvault_environment_assets;
CREATE POLICY "public_select_environment_assets" ON public.spotvault_environment_assets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_environment_assets" ON public.spotvault_environment_assets;
CREATE POLICY "public_insert_environment_assets" ON public.spotvault_environment_assets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_environment_assets" ON public.spotvault_environment_assets;
CREATE POLICY "public_update_environment_assets" ON public.spotvault_environment_assets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_environment_assets" ON public.spotvault_environment_assets;
CREATE POLICY "public_delete_environment_assets" ON public.spotvault_environment_assets FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('spotvault-assets', 'spotvault-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

DROP POLICY IF EXISTS "spotvault_assets_select" ON storage.objects;
CREATE POLICY "spotvault_assets_select" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'spotvault-assets');

DROP POLICY IF EXISTS "spotvault_assets_insert" ON storage.objects;
CREATE POLICY "spotvault_assets_insert" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'spotvault-assets');

DROP POLICY IF EXISTS "spotvault_assets_update" ON storage.objects;
CREATE POLICY "spotvault_assets_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'spotvault-assets') WITH CHECK (bucket_id = 'spotvault-assets');

DROP POLICY IF EXISTS "spotvault_assets_delete" ON storage.objects;
CREATE POLICY "spotvault_assets_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'spotvault-assets');
