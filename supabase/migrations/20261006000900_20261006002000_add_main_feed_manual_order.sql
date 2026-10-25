/*
# Add manual ordering for official Main Feed posts

1. Modified Table
- `public.main_feed_posts.sort_order`: integer position controlled by authorized staff for manual ordering.
- Existing rows receive a stable order based on their creation time.

2. Publishing Behavior
- Public Main Feed ordering remains pinned posts first, then manual order, then publication time.
- Drafts and scheduled posts keep their existing visibility rules.

3. Security
- Existing staff-only UPDATE policy continues to protect ordering changes.
- No new table, public write path, or permission is introduced.
*/

ALTER TABLE public.main_feed_posts
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ordered_posts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) * 10 AS next_order
  FROM public.main_feed_posts
)
UPDATE public.main_feed_posts AS posts
SET sort_order = ordered_posts.next_order
FROM ordered_posts
WHERE posts.id = ordered_posts.id
  AND posts.sort_order = 0;

CREATE INDEX IF NOT EXISTS main_feed_posts_public_sort_idx
  ON public.main_feed_posts (is_pinned DESC, sort_order ASC, published_at DESC);
