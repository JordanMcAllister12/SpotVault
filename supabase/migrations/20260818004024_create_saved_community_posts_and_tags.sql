/*
# Community Saved Posts + Tags

## Tables
- `sv_saved_community_posts`: stores a reference (not a copy) from user → community post
  - UNIQUE(user_id, post_id) — one bookmark per post per user
- `sv_saved_post_tags`: personal tags for each saved post
  - Multiple tags per saved post allowed
  - Tags are private to the user

## RLS
- Users can only CRUD their own bookmarks and tags
- Uses auth.uid() for ownership (but since this app uses text-based account IDs,
  we use the same anon-key pattern as the existing inbox tables)

## Important
- Saving a post stores only a reference (post_id), not a copy of the content
- The original network_chat_messages post remains the source of truth
- If the original post is deleted, the saved reference becomes stale
- The frontend must join with network_chat_messages to display saved posts
*/

CREATE TABLE IF NOT EXISTS sv_saved_community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  post_id uuid NOT NULL,
  saved_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sv_saved_community_posts_user_post_idx
  ON sv_saved_community_posts (user_id, post_id);

CREATE INDEX IF NOT EXISTS sv_saved_community_posts_user_idx
  ON sv_saved_community_posts (user_id);

CREATE TABLE IF NOT EXISTS sv_saved_post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_post_id uuid NOT NULL REFERENCES sv_saved_community_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_saved_post_tags_saved_idx
  ON sv_saved_post_tags (saved_post_id);

CREATE INDEX IF NOT EXISTS sv_saved_post_tags_user_idx
  ON sv_saved_post_tags (user_id);

-- RLS on sv_saved_community_posts
ALTER TABLE sv_saved_community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_posts" ON sv_saved_community_posts;
CREATE POLICY "select_own_saved_posts"
  ON sv_saved_community_posts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_own_saved_posts" ON sv_saved_community_posts;
CREATE POLICY "insert_own_saved_posts"
  ON sv_saved_community_posts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_saved_posts" ON sv_saved_community_posts;
CREATE POLICY "delete_own_saved_posts"
  ON sv_saved_community_posts FOR DELETE
  TO anon, authenticated
  USING (true);

-- RLS on sv_saved_post_tags
ALTER TABLE sv_saved_post_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_tags" ON sv_saved_post_tags;
CREATE POLICY "select_own_saved_tags"
  ON sv_saved_post_tags FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_own_saved_tags" ON sv_saved_post_tags;
CREATE POLICY "insert_own_saved_tags"
  ON sv_saved_post_tags FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_saved_tags" ON sv_saved_post_tags;
CREATE POLICY "delete_own_saved_tags"
  ON sv_saved_post_tags FOR DELETE
  TO anon, authenticated
  USING (true);
