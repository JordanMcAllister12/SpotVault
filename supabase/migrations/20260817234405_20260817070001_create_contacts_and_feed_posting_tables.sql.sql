/*
# Contacts + General Feed Posting — Part 1: Tables and relationship type changes

## Purpose
1. Add 'network_contact' to sv_relationships type + 'declined'/'removed' statuses
2. Create sv_general_feed_posting_requests table
3. Create community_posts table
4. Modify network_chat_messages: add moderation_status, tighten RLS
*/

-- ============================================================
-- 1. MODIFY sv_relationships: add network_contact type
-- ============================================================
DO $$ BEGIN
  ALTER TABLE sv_relationships DROP CONSTRAINT IF EXISTS sv_relationships_type_check;
  ALTER TABLE sv_relationships ADD CONSTRAINT sv_relationships_type_check
    CHECK (type IN ('coach_student', 'stable_player', 'business_employee', 'creator_customer', 'network_contact'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE sv_relationships DROP CONSTRAINT IF EXISTS sv_relationships_status_check;
  ALTER TABLE sv_relationships ADD CONSTRAINT sv_relationships_status_check
    CHECK (status IN ('pending', 'active', 'paused', 'ended', 'blocked', 'declined', 'removed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 2. CREATE sv_general_feed_posting_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_general_feed_posting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  reason text,
  category text CHECK (category IN ('player', 'coach', 'creator', 'business', 'media', 'industry', 'other') OR category IS NULL),
  profile_link text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_gfpr_status_idx ON sv_general_feed_posting_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sv_gfpr_user_idx ON sv_general_feed_posting_requests (user_id, created_at DESC);

ALTER TABLE sv_general_feed_posting_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_gfpr_select" ON sv_general_feed_posting_requests;
CREATE POLICY "sv_gfpr_select" ON sv_general_feed_posting_requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
    )
  );

REVOKE INSERT ON sv_general_feed_posting_requests FROM anon, authenticated;
REVOKE UPDATE ON sv_general_feed_posting_requests FROM anon, authenticated;
REVOKE DELETE ON sv_general_feed_posting_requests FROM anon, authenticated;

-- ============================================================
-- 3. CREATE community_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_type text,
  attachment_url text,
  attachment_label text,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_name text,
  reply_to uuid REFERENCES community_posts(id) ON DELETE CASCADE,
  moderation_status text NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS community_posts_created_idx ON community_posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS community_posts_reply_idx ON community_posts (reply_to) WHERE reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_posts_author_idx ON community_posts (author_id, created_at DESC);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read visible, non-deleted posts
DROP POLICY IF EXISTS "community_posts_select" ON community_posts;
CREATE POLICY "community_posts_select" ON community_posts FOR SELECT
  TO authenticated USING (moderation_status = 'visible' AND deleted_at IS NULL);

-- Only approved general feed posters can insert (checked via function defined in part 2)
-- For now, use a subquery check directly in the policy
DROP POLICY IF EXISTS "community_posts_insert" ON community_posts;
CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT
  TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sv_general_feed_posting_requests
      WHERE sv_general_feed_posting_requests.user_id = auth.uid()
      AND sv_general_feed_posting_requests.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "community_posts_update" ON community_posts;
CREATE POLICY "community_posts_update" ON community_posts FOR UPDATE
  TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "community_posts_delete" ON community_posts;
CREATE POLICY "community_posts_delete" ON community_posts FOR DELETE
  TO authenticated USING (author_id = auth.uid());

-- ============================================================
-- 4. MODIFY network_chat_messages
-- ============================================================
DO $$ BEGIN
  ALTER TABLE network_chat_messages ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible', 'hidden', 'removed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS network_chat_messages_moderation_idx ON network_chat_messages (moderation_status, created_at DESC);

DROP POLICY IF EXISTS "network_chat_select" ON network_chat_messages;
CREATE POLICY "network_chat_select" ON network_chat_messages FOR SELECT
  TO authenticated USING (moderation_status = 'visible');

DROP POLICY IF EXISTS "network_chat_insert" ON network_chat_messages;
CREATE POLICY "network_chat_insert" ON network_chat_messages FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "network_chat_update" ON network_chat_messages;
CREATE POLICY "network_chat_update" ON network_chat_messages FOR UPDATE
  TO authenticated USING (author_id = auth.uid()::text) WITH CHECK (author_id = auth.uid()::text);

DROP POLICY IF EXISTS "network_chat_delete" ON network_chat_messages;
CREATE POLICY "network_chat_delete" ON network_chat_messages FOR DELETE
  TO authenticated USING (author_id = auth.uid()::text);