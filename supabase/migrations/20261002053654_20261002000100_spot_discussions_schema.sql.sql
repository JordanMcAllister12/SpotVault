/*
# Spot Types, Freeform Blocks, and Spot Discussions — Schema

## Changes
1. content_spots: add spot_type + content_blocks columns
2. Create spot_comments table (threaded discussion on spots)
3. Create spot_comment_likes table (likes on comments)
4. RLS on both new tables — access-gated by spot visibility/ownership/grants
5. Indexes for performant queries

## Notes
- spot_type defaults to 'hand_analysis' so all existing spots work unchanged
- content_blocks stores ordered freeform blocks (jsonb) for Freeform spots
- spot_comments use text account IDs matching content_spots.account_id pattern
- Comment access follows spot access: published spots are open; paid spots require ownership or grant
*/

-- ============================================================
-- 1. Add spot_type and content_blocks to content_spots
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_spots' AND column_name = 'spot_type') THEN
    ALTER TABLE content_spots ADD COLUMN spot_type text NOT NULL DEFAULT 'hand_analysis';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_spots' AND column_name = 'content_blocks') THEN
    ALTER TABLE content_spots ADD COLUMN content_blocks jsonb;
  END IF;
END $$;

-- ============================================================
-- 2. Create spot_comments table
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id           uuid NOT NULL REFERENCES content_spots(id) ON DELETE CASCADE,
  author_id         text NOT NULL,
  author_name       text NOT NULL,
  author_avatar     text,
  author_role       text NOT NULL DEFAULT 'PLAYER',
  body              text NOT NULL,
  reply_to          uuid REFERENCES spot_comments(id) ON DELETE CASCADE,
  is_pinned         boolean NOT NULL DEFAULT false,
  is_creator_answer boolean NOT NULL DEFAULT false,
  edited_at         timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spot_comments_spot_created_idx
  ON spot_comments (spot_id, created_at);
CREATE INDEX IF NOT EXISTS spot_comments_reply_idx
  ON spot_comments (reply_to) WHERE reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS spot_comments_author_idx
  ON spot_comments (author_id, created_at DESC);

-- ============================================================
-- 3. Create spot_comment_likes table
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_comment_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid NOT NULL REFERENCES spot_comments(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS spot_comment_likes_comment_idx
  ON spot_comment_likes (comment_id);

-- ============================================================
-- 4. RLS for spot_comments
-- ============================================================

ALTER TABLE spot_comments ENABLE ROW LEVEL SECURITY;

-- Helper: check if current account can access a spot
-- (published, or creator, or has access grant)
-- We inline this in policies since SECURITY DEFINER functions add complexity.

DROP POLICY IF EXISTS "select_spot_comments" ON spot_comments;
CREATE POLICY "select_spot_comments"
ON spot_comments FOR SELECT
TO anon, authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM content_spots cs
    WHERE cs.id = spot_comments.spot_id
    AND (
      cs.status = 'published'
      OR cs.account_id = current_setting('app.current_account_id', true)
      OR EXISTS (
        SELECT 1 FROM content_access_grants g
        WHERE g.content_spot_id = cs.id
        AND g.user_id = current_setting('app.current_account_id', true)::uuid
      )
    )
  )
);

DROP POLICY IF EXISTS "insert_spot_comments" ON spot_comments;
CREATE POLICY "insert_spot_comments"
ON spot_comments FOR INSERT
TO anon, authenticated
WITH CHECK (
  author_id = current_setting('app.current_account_id', true)
  AND EXISTS (
    SELECT 1 FROM content_spots cs
    WHERE cs.id = spot_comments.spot_id
    AND (
      cs.status = 'published'
      OR cs.account_id = current_setting('app.current_account_id', true)
      OR EXISTS (
        SELECT 1 FROM content_access_grants g
        WHERE g.content_spot_id = cs.id
        AND g.user_id = current_setting('app.current_account_id', true)::uuid
      )
    )
  )
);

DROP POLICY IF EXISTS "update_spot_comments" ON spot_comments;
CREATE POLICY "update_spot_comments"
ON spot_comments FOR UPDATE
TO anon, authenticated
USING (
  author_id = current_setting('app.current_account_id', true)
)
WITH CHECK (
  author_id = current_setting('app.current_account_id', true)
);

DROP POLICY IF EXISTS "delete_spot_comments" ON spot_comments;
CREATE POLICY "delete_spot_comments"
ON spot_comments FOR DELETE
TO anon, authenticated
USING (
  author_id = current_setting('app.current_account_id', true)
);

-- ============================================================
-- 5. RLS for spot_comment_likes
-- ============================================================

ALTER TABLE spot_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "select_spot_comment_likes"
ON spot_comment_likes FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "insert_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "insert_spot_comment_likes"
ON spot_comment_likes FOR INSERT
TO anon, authenticated
WITH CHECK (
  user_id = current_setting('app.current_account_id', true)
);

DROP POLICY IF EXISTS "delete_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "delete_spot_comment_likes"
ON spot_comment_likes FOR DELETE
TO anon, authenticated
USING (
  user_id = current_setting('app.current_account_id', true)
);
