/*
# Create persistent Main Feed CMS

1. New Tables
- `main_feed_posts`: staff-managed official Community Main Feed articles.
- `id`, `slug`, `title`, `subtitle`, `body_html`: article identity and editorial content.
- `post_type`, `label`, `publish_as`: editorial classification and publishing identity.
- `feature_image_url`, `cta_label`, `cta_url`: optional article media and call to action.
- `status`, `published_at`, `scheduled_for`, `pin_until`: publishing workflow and pinning.
- `author_id`, `created_at`, `updated_at`: audit metadata.

2. Storage
- Creates the public `main-feed` bucket for feature and inline article images.
- Staff and superusers may upload, update, and delete objects; everyone may read them.

3. Security
- Enables row-level security on the article table.
- Public readers see only published articles whose publication time has arrived.
- Staff and superusers manage all article rows through the existing `sv_is_staff_or_admin()` server-side helper.
- Staff and superusers are the only users allowed to write Main Feed storage objects.

4. Seed Content
- Inserts the first pinned StakeKings partnership announcement through the same CMS table used by future posts.
*/

CREATE TABLE IF NOT EXISTS public.main_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  post_type text NOT NULL CHECK (post_type IN ('news', 'announcement', 'platform_update', 'feature', 'education', 'promotion', 'community')),
  label text,
  publish_as text NOT NULL CHECK (publish_as IN ('spotvault', 'spotvault_news', 'staff')),
  feature_image_url text,
  body_html text NOT NULL DEFAULT '',
  cta_label text,
  cta_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  published_at timestamptz,
  scheduled_for timestamptz,
  pin_until timestamptz,
  author_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS main_feed_posts_public_order_idx ON public.main_feed_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS main_feed_posts_pin_order_idx ON public.main_feed_posts (pin_until DESC NULLS LAST, published_at DESC);
ALTER TABLE public.main_feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "main_feed_public_read" ON public.main_feed_posts;
CREATE POLICY "main_feed_public_read" ON public.main_feed_posts FOR SELECT TO anon, authenticated
  USING (status = 'published' AND COALESCE(published_at, created_at) <= now());
DROP POLICY IF EXISTS "main_feed_staff_read" ON public.main_feed_posts;
CREATE POLICY "main_feed_staff_read" ON public.main_feed_posts FOR SELECT TO authenticated
  USING (public.sv_is_staff_or_admin());
DROP POLICY IF EXISTS "main_feed_staff_insert" ON public.main_feed_posts;
CREATE POLICY "main_feed_staff_insert" ON public.main_feed_posts FOR INSERT TO authenticated
  WITH CHECK (public.sv_is_staff_or_admin() AND (author_id = auth.uid() OR author_id IS NULL));
DROP POLICY IF EXISTS "main_feed_staff_update" ON public.main_feed_posts;
CREATE POLICY "main_feed_staff_update" ON public.main_feed_posts FOR UPDATE TO authenticated
  USING (public.sv_is_staff_or_admin()) WITH CHECK (public.sv_is_staff_or_admin());
DROP POLICY IF EXISTS "main_feed_staff_delete" ON public.main_feed_posts;
CREATE POLICY "main_feed_staff_delete" ON public.main_feed_posts FOR DELETE TO authenticated
  USING (public.sv_is_staff_or_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('main-feed', 'main-feed', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];
DROP POLICY IF EXISTS "main_feed_storage_read" ON storage.objects;
CREATE POLICY "main_feed_storage_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'main-feed');
DROP POLICY IF EXISTS "main_feed_storage_insert" ON storage.objects;
CREATE POLICY "main_feed_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'main-feed' AND public.sv_is_staff_or_admin());
DROP POLICY IF EXISTS "main_feed_storage_update" ON storage.objects;
CREATE POLICY "main_feed_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'main-feed' AND public.sv_is_staff_or_admin()) WITH CHECK (bucket_id = 'main-feed' AND public.sv_is_staff_or_admin());
DROP POLICY IF EXISTS "main_feed_storage_delete" ON storage.objects;
CREATE POLICY "main_feed_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'main-feed' AND public.sv_is_staff_or_admin());

INSERT INTO public.main_feed_posts (slug, title, subtitle, post_type, label, publish_as, body_html, status, published_at, pin_until)
VALUES (
  'stakekings-player-development-academy-partnership',
  'StakeKings Signs Agreement With SpotVault to Host Player Development Academy',
  'The partnership will bring StakeKings'' player-development offering to SpotVault, connecting poker education, study tools and community in one platform.',
  'announcement', 'PARTNERSHIP', 'spotvault_news',
  '<p>SpotVault Technologies Inc. is pleased to announce an agreement with StakeKings that will bring the StakeKings Player Development Academy to SpotVault.</p><p>The collaboration brings together two complementary parts of the poker ecosystem. StakeKings has built a large community around players, staking and poker opportunities, while SpotVault has been designed as a dedicated environment for poker study, analysis, education and player development.</p><p>Through the agreement, SpotVault will provide the technology and platform infrastructure used to host the StakeKings Player Development Academy.</p><p>Players will be able to access educational content while also taking advantage of SpotVault''s broader study ecosystem, including hand-history review, analytics, study tools, educational Spots and courses, community features and additional player-development resources.</p><p>The goal is to create a more connected path between playing poker and actively working to improve.</p><blockquote>“We built SpotVault around a pretty simple idea: poker players should have one place they actually want to come back to when they''re trying to get better. Having StakeKings choose SpotVault as the home of its Player Development Academy is a huge step toward what we envisioned from the beginning.”<br><strong>— Jordan McAllister</strong><br>Founder &amp; CEO, SpotVault Technologies Inc.</blockquote><p>The StakeKings Player Development Academy will give players a dedicated environment within the broader SpotVault ecosystem while allowing them to remain connected to the larger poker community.</p><p>Additional educational content, instructors, player-development initiatives and Academy features can be introduced as the partnership develops.</p><p>This represents an important milestone for SpotVault as the platform prepares to welcome a much larger community of poker players.</p><p><strong>Better tools. Smarter play.</strong></p><p>SpotVault</p>',
  'published', now(), NULL
)
ON CONFLICT (slug) DO NOTHING;
