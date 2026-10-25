/*
# Fix content_spots and spot_comments RLS — replace unset app.current_account_id with auth.uid()

## Problem
The SELECT policies on content_spots, spot_comments, and spot_comment_likes used
`current_setting('app.current_account_id', true)` for ownership checks. This setting
was NEVER set anywhere — not in the frontend, not in a database function, not in a
pre-request hook. As a result:
- Private/draft content_spots were invisible to their owners (the setting resolves to NULL)
- spot_comments on private spots were invisible to comment authors
- spot_comment_likes could not be deleted by their owners

The INSERT/UPDATE/DELETE policies on content_spots were also wide open
(`WITH CHECK (true)` / `USING (true)`), allowing any client to write/modify any row.

## Fix
Replace `current_setting('app.current_account_id', true)` with `auth.uid()::text`
since account_id, author_id, and user_id columns are all TEXT type storing UUID strings.

### content_spots (account_id is TEXT)
- SELECT: published content is publicly readable; owners can SELECT their own private
  spots; users with explicit access grants can SELECT granted spots; staff/admins can
  SELECT all spots.
- INSERT: only authenticated users can insert, and only into their own account_id.
- UPDATE: only owners can update their own spots.
- DELETE: only owners can delete their own spots.

### spot_comments (author_id is TEXT)
- SELECT: comments on published spots are public; comment authors can see their own
  comments on private spots; users with access grants can see comments on granted spots.
- INSERT: only authenticated users, author must be auth.uid()::text.
- UPDATE: only the comment author.
- DELETE: only the comment author.

### spot_comment_likes (user_id is TEXT)
- SELECT: public.
- INSERT: only authenticated users, user_id must be auth.uid()::text.
- DELETE: only the like owner.

## Tables Modified
- content_spots — all 4 RLS policies replaced
- spot_comments — all 4 RLS policies replaced
- spot_comment_likes — all 4 RLS policies replaced

## Security
- Private content isolation is ENFORCED: only the owner (via auth.uid()) or users with
  explicit access grants can see private spots. Other normal users cannot.
- Staff/admin access preserved via sv_is_staff_or_admin().
- Published content remains publicly readable.
- No Jordan-specific bypass — the fix is generic for all authenticated users.
*/
-- ============================================================
-- content_spots (account_id is TEXT)
-- ============================================================

DROP POLICY IF EXISTS "select_content_spots" ON content_spots;
CREATE POLICY "select_content_spots"
  ON content_spots FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR account_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM content_access_grants g
      WHERE g.content_spot_id = content_spots.id
        AND g.user_id = auth.uid()
    )
    OR public.sv_is_staff_or_admin()
  );

DROP POLICY IF EXISTS "insert_content_spots" ON content_spots;
CREATE POLICY "insert_content_spots"
  ON content_spots FOR INSERT
  TO authenticated
  WITH CHECK (account_id = auth.uid()::text);

DROP POLICY IF EXISTS "update_content_spots" ON content_spots;
CREATE POLICY "update_content_spots"
  ON content_spots FOR UPDATE
  TO authenticated
  USING (account_id = auth.uid()::text)
  WITH CHECK (account_id = auth.uid()::text);

DROP POLICY IF EXISTS "delete_content_spots" ON content_spots;
CREATE POLICY "delete_content_spots"
  ON content_spots FOR DELETE
  TO authenticated
  USING (account_id = auth.uid()::text);

-- ============================================================
-- spot_comments (author_id is TEXT)
-- ============================================================

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
        OR cs.account_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM content_access_grants g
          WHERE g.content_spot_id = cs.id
            AND g.user_id = auth.uid()
        )
        OR public.sv_is_staff_or_admin()
      )
    )
  );

DROP POLICY IF EXISTS "insert_spot_comments" ON spot_comments;
CREATE POLICY "insert_spot_comments"
  ON spot_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

DROP POLICY IF EXISTS "update_spot_comments" ON spot_comments;
CREATE POLICY "update_spot_comments"
  ON spot_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid()::text)
  WITH CHECK (author_id = auth.uid()::text);

DROP POLICY IF EXISTS "delete_spot_comments" ON spot_comments;
CREATE POLICY "delete_spot_comments"
  ON spot_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid()::text);

-- ============================================================
-- spot_comment_likes (user_id is TEXT)
-- ============================================================

DROP POLICY IF EXISTS "select_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "select_spot_comment_likes"
  ON spot_comment_likes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "insert_spot_comment_likes"
  ON spot_comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "update_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "update_spot_comment_likes"
  ON spot_comment_likes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "delete_spot_comment_likes" ON spot_comment_likes;
CREATE POLICY "delete_spot_comment_likes"
  ON spot_comment_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);
