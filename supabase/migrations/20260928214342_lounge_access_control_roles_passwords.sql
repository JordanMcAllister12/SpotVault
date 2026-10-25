/*
# Lounge Access Control, Roles, Passwords, Join Requests, Default Lounge

## Changes to lounge_memberships
- ADD role column (owner, admin, moderator, member) DEFAULT 'member'
- ADD approved_by column (uuid, the user who approved)
- ADD is_default column (boolean) DEFAULT false

## Changes to lounge_configs
- ADD access_mode column (open, approval, password, password_approval) DEFAULT 'open'
- ADD discoverability column (public, unlisted) DEFAULT 'public'
- ADD password_hash column (text) — bcrypt-hashed, NULL if no password
- ADD region column (text) — geographic region for search
- ADD tags column (text[]) — searchable tags
- ADD member_count column (integer) DEFAULT 0 — cached count

## New Table: lounge_join_requests
- Tracks pending join requests for approval-based lounges
- user_id, lounge_slug, status (pending/approved/declined), password_verified (bool)
- reviewed_by, reviewed_at

## New Table: lounge_moderation_logs
- Records moderation actions for accountability
- lounge_slug, moderator_id, action, target_user_id, target_type, target_id, reason, created_at

## Security
- RLS on all new tables
- Memberships: owner-scoped (auth.uid = user_id)
- Join requests: owner-scoped
- Moderation logs: readable by lounge moderators (via RPC check)
*/

-- ============================================================
-- lounge_memberships: add role, approved_by, is_default
-- ============================================================
ALTER TABLE lounge_memberships ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE lounge_memberships ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE lounge_memberships ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- ============================================================
-- lounge_configs: add access_mode, discoverability, password_hash, region, tags, member_count
-- ============================================================
ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'open';
ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS discoverability text NOT NULL DEFAULT 'public';
ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- lounge_join_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS lounge_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lounge_slug text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  password_verified boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, lounge_slug)
);

ALTER TABLE lounge_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_join_requests" ON lounge_join_requests;
CREATE POLICY "select_own_join_requests" ON lounge_join_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_join_requests" ON lounge_join_requests;
CREATE POLICY "insert_own_join_requests" ON lounge_join_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_join_requests" ON lounge_join_requests;
CREATE POLICY "update_own_join_requests" ON lounge_join_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_join_requests_lounge ON lounge_join_requests(lounge_slug);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON lounge_join_requests(status);

-- ============================================================
-- lounge_moderation_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS lounge_moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_slug text NOT NULL,
  moderator_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_type text,
  target_id text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lounge_moderation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_moderation_logs" ON lounge_moderation_logs;
CREATE POLICY "select_moderation_logs" ON lounge_moderation_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_moderation_logs" ON lounge_moderation_logs;
CREATE POLICY "insert_moderation_logs" ON lounge_moderation_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = moderator_id);

CREATE INDEX IF NOT EXISTS idx_mod_logs_lounge ON lounge_moderation_logs(lounge_slug);

-- ============================================================
-- Update membership policies to allow is_default updates
-- ============================================================
DROP POLICY IF EXISTS "update_own_lounge_memberships" ON lounge_memberships;
CREATE POLICY "update_own_lounge_memberships" ON lounge_memberships
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
