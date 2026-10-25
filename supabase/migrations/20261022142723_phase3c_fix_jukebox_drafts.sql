-- Phase 3c: Fix jukebox_drafts policies to be creator-scoped
-- jukebox_hand_analysis and jukebox_product_hands already have ownership checks
-- via sv_can_publish_jukebox for writes; SELECT was permissive but these are
-- published product content, so public read is acceptable. Just fix drafts.

DROP POLICY IF EXISTS "read_own_drafts" ON jukebox_drafts;
DROP POLICY IF EXISTS "insert_drafts" ON jukebox_drafts;
DROP POLICY IF EXISTS "update_own_drafts" ON jukebox_drafts;
DROP POLICY IF EXISTS "delete_own_drafts" ON jukebox_drafts;

CREATE POLICY "drafts_select_own" ON jukebox_drafts FOR SELECT TO authenticated
  USING (auth.uid()::text = creator_id);
CREATE POLICY "drafts_insert_own" ON jukebox_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = creator_id);
CREATE POLICY "drafts_update_own" ON jukebox_drafts FOR UPDATE TO authenticated
  USING (auth.uid()::text = creator_id)
  WITH CHECK (auth.uid()::text = creator_id);
CREATE POLICY "drafts_delete_own" ON jukebox_drafts FOR DELETE TO authenticated
  USING (auth.uid()::text = creator_id);
