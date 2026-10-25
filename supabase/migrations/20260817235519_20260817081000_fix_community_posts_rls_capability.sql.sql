/*
# Fix community_posts INSERT policy to use sv_user_capabilities

The sv_can_post_general_feed() function was updated to check sv_user_capabilities,
but the RLS INSERT policy on community_posts still checks sv_general_feed_posting_requests.
This migration aligns the RLS policy with the capability-based permission model.
*/

DROP POLICY IF EXISTS "community_posts_insert" ON community_posts;
CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT
  TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE sv_user_capabilities.user_id = auth.uid()
      AND sv_user_capabilities.capability = 'general_feed_post'
      AND sv_user_capabilities.status = 'active'
    )
  );