/*
# Complete Main Feed pinning and scheduling

1. Modified Table
- `main_feed_posts.is_pinned`: explicit pin state so an article can stay pinned indefinitely without requiring a fake expiration date.

2. Publishing Behavior
- Scheduled articles become readable by the public once `scheduled_for` has arrived.
- Published articles continue to use `published_at` for public ordering.

3. Security
- The existing staff-only write policies remain in place.
- Public reads still exclude drafts and future scheduled articles.
*/

ALTER TABLE public.main_feed_posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "main_feed_public_read" ON public.main_feed_posts;
CREATE POLICY "main_feed_public_read" ON public.main_feed_posts FOR SELECT TO anon, authenticated
  USING (
    (status = 'published' AND COALESCE(published_at, created_at) <= now())
    OR (status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= now())
  );

CREATE INDEX IF NOT EXISTS main_feed_posts_pinned_idx ON public.main_feed_posts (is_pinned, published_at DESC);
