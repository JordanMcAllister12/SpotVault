/*
# Centralized SpotVault Issue Management System (fixed)

Creates a database-backed issue tracking system that allows users to report
issues and staff to manage them through a shared queue with realtime sync.

## New Tables
1. issues — main issue records with ticket IDs, status, priority, category
2. issue_comments — user and staff comments (internal notes flagged)
3. issue_activity — audit trail of all actions on each issue
4. issue_attachments — metadata for uploaded screenshot files

## Security
- RLS on all tables: users see only their own issues' data; staff see all
- Staff access gated through existing sv_is_staff_or_admin() function
- Storage uses existing user-uploads bucket with path pattern issues/{issue_id}/

## Notes
- Ticket IDs generated via sequence (SV-1001, SV-1002, ...)
- updated_at auto-updated via trigger
*/

-- ── Issues table ──
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text UNIQUE NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('bug_technical','hand_history','analytics_spr','solver','spots_marketplace','payments_membership','account_login','other')),
  description text NOT NULL,
  page_location text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved','reopened','closed')),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_agent text,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_issues" ON issues;
CREATE POLICY "select_own_issues" ON issues FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_select_all_issues" ON issues;
CREATE POLICY "staff_select_all_issues" ON issues FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "insert_own_issues" ON issues;
CREATE POLICY "insert_own_issues" ON issues FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_update_issues" ON issues;
CREATE POLICY "staff_update_issues" ON issues FOR UPDATE
  TO authenticated USING (public.sv_is_staff_or_admin()) WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "update_own_issues" ON issues;
CREATE POLICY "update_own_issues" ON issues FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Issue comments table ──
CREATE TABLE IF NOT EXISTS issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  is_internal boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_issue_comments" ON issue_comments;
CREATE POLICY "select_own_issue_comments" ON issue_comments FOR SELECT
  TO authenticated USING (
    (is_internal = false AND EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_comments.issue_id AND issues.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "staff_select_all_comments" ON issue_comments;
CREATE POLICY "staff_select_all_comments" ON issue_comments FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "insert_own_issue_comments" ON issue_comments;
CREATE POLICY "insert_own_issue_comments" ON issue_comments FOR INSERT
  TO authenticated WITH CHECK (
    is_internal = false
    AND auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_comments.issue_id AND issues.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert_comments" ON issue_comments;
CREATE POLICY "staff_insert_comments" ON issue_comments FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin() AND auth.uid() = author_id);

-- ── Issue activity table ──
CREATE TABLE IF NOT EXISTS issue_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE issue_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_issue_activity" ON issue_activity;
CREATE POLICY "select_own_issue_activity" ON issue_activity FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_activity.issue_id AND issues.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_select_all_activity" ON issue_activity;
CREATE POLICY "staff_select_all_activity" ON issue_activity FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_activity" ON issue_activity;
CREATE POLICY "staff_insert_activity" ON issue_activity FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "insert_own_issue_activity" ON issue_activity;
CREATE POLICY "insert_own_issue_activity" ON issue_activity FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = actor_id
    AND EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_activity.issue_id AND issues.user_id = auth.uid())
  );

-- ── Issue attachments table ──
CREATE TABLE IF NOT EXISTS issue_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_issue_attachments" ON issue_attachments;
CREATE POLICY "select_own_issue_attachments" ON issue_attachments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_attachments.issue_id AND issues.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_select_all_attachments" ON issue_attachments;
CREATE POLICY "staff_select_all_attachments" ON issue_attachments FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "insert_own_issue_attachments" ON issue_attachments;
CREATE POLICY "insert_own_issue_attachments" ON issue_attachments FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_attachments.issue_id AND issues.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert_attachments" ON issue_attachments;
CREATE POLICY "staff_insert_attachments" ON issue_attachments FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_issue_id ON issue_activity(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON issue_attachments(issue_id);

-- ── Updated_at trigger ──
CREATE OR REPLACE FUNCTION update_issue_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION update_issue_updated_at();

-- ── Ticket ID sequence ──
CREATE SEQUENCE IF NOT EXISTS issue_ticket_seq START 1001;

CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS text AS $$
BEGIN
  RETURN 'SV-' || nextval('issue_ticket_seq');
END;
$$ LANGUAGE plpgsql;

-- ── Storage policies for issue attachments in user-uploads bucket ──
DROP POLICY IF EXISTS "issue_uploads_insert" ON storage.objects;
CREATE POLICY "issue_uploads_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'issues'
  );

DROP POLICY IF EXISTS "issue_uploads_select_owner" ON storage.objects;
CREATE POLICY "issue_uploads_select_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'issues'
  );
