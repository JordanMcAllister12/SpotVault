/*
# Staff Organization Affiliation, Custom Tags, and Invitation System

## Overview
Expands the staff management system to support:
1. Staff organization affiliation (SpotVault or StakeKings)
2. Reusable custom staff display tags with full color customization
3. Secure staff account invitations with expiration
4. Enhanced audit logging for all staff administrative actions

## New Tables
- sv_staff_organizations: tracks org affiliation per staff member
- sv_staff_tags: reusable custom display tags with colors/icons/scope
- sv_staff_tag_assignments: many-to-many link between users and tags
- sv_staff_invitations: secure one-use invitation tokens for new staff

## Modified Tables
- sv_staff_metadata: added organization column for fast routing lookup

## Security
- RLS on all new tables
- Public read on tags/assignments/orgs (needed for badge display and routing)
- Invitation reads restricted to superuser
- All writes via SECURITY DEFINER functions checking sv_is_superuser()
- Invitation tokens hashed with SHA-256; plaintext never stored

## Important Notes
1. System tags (STAFF, MODERATOR, STAKEKINGS STAFF, etc.) are seeded with is_system=true
2. Existing staff badges in sv_staff_metadata are preserved — the tag system is additive
3. The sv_staff_metadata.organization column provides fast lookup for routing
4. Invitation tokens are one-use — consumed_at and consumed_by_user_id track activation
5. user_profiles.user_id is text (not uuid) so joins cast to uuid
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Staff Organization Affiliation
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_staff_organizations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization text NOT NULL DEFAULT 'spotvault' CHECK (organization IN ('spotvault', 'stakekings')),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sv_staff_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_staff_organizations" ON sv_staff_organizations;
CREATE POLICY "read_staff_organizations" ON sv_staff_organizations
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 2. Custom Staff Tags
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_staff_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  bg_color text NOT NULL DEFAULT '#d4a52c',
  text_color text NOT NULL DEFAULT '#0a0908',
  border_color text,
  icon text,
  scope text NOT NULL DEFAULT 'spotvault' CHECK (scope IN ('spotvault', 'stakekings', 'shared')),
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sv_staff_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_staff_tags" ON sv_staff_tags;
CREATE POLICY "read_staff_tags" ON sv_staff_tags
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 3. Staff Tag Assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_staff_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES sv_staff_tags(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tag_id)
);

ALTER TABLE sv_staff_tag_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_staff_tag_assignments" ON sv_staff_tag_assignments;
CREATE POLICY "read_staff_tag_assignments" ON sv_staff_tag_assignments
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 4. Staff Invitations
-- ============================================================

CREATE TABLE IF NOT EXISTS sv_staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL,
  full_name text NOT NULL,
  username text,
  organization text NOT NULL DEFAULT 'spotvault' CHECK (organization IN ('spotvault', 'stakekings')),
  tag_id uuid REFERENCES sv_staff_tags(id),
  permissions jsonb NOT NULL DEFAULT '{"solver":false,"analytics":false,"chat":false,"main_board":false}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days',
  consumed_at timestamptz,
  consumed_by_user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE sv_staff_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_staff_invitations" ON sv_staff_invitations;
CREATE POLICY "read_staff_invitations" ON sv_staff_invitations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_roles r WHERE r.user_id = auth.uid() AND r.role = 'superuser' AND r.status = 'active')
  );

CREATE INDEX IF NOT EXISTS idx_sv_staff_invitations_email ON sv_staff_invitations(email);
CREATE INDEX IF NOT EXISTS idx_sv_staff_invitations_token_hash ON sv_staff_invitations(token_hash);

-- ============================================================
-- 5. Add organization column to sv_staff_metadata
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sv_staff_metadata' AND column_name = 'organization'
  ) THEN
    ALTER TABLE sv_staff_metadata ADD COLUMN organization text;
  END IF;
END $$;

-- ============================================================
-- 6. Seed System Tags
-- ============================================================

INSERT INTO sv_staff_tags (title, bg_color, text_color, border_color, icon, scope, is_system, is_active)
VALUES
  ('STAFF', 'rgba(212,165,44,0.12)', '#f5e6b0', 'rgba(212,165,44,0.3)', 'ShieldCheck', 'spotvault', true, true),
  ('MODERATOR', 'rgba(91,141,239,0.12)', '#c5d8f7', 'rgba(91,141,239,0.3)', 'Scale', 'spotvault', true, true),
  ('STAKEKINGS STAFF', '#0a1a0a', '#22c55e', 'rgba(34,197,94,0.4)', null, 'stakekings', true, true),
  ('STAKEKINGS MODERATOR', '#0a1a0a', '#22c55e', 'rgba(34,197,94,0.4)', 'Scale', 'stakekings', true, true),
  ('STAKEKINGS SUPPORT', '#0a1a0a', '#4ade80', 'rgba(34,197,94,0.3)', 'Headphones', 'stakekings', true, true),
  ('STAKEKINGS ADMIN', '#0a1a0a', '#bbf7d0', 'rgba(34,197,94,0.5)', 'Crown', 'stakekings', true, true),
  ('FOUNDER', '#d4a52c', '#1a1200', 'rgba(212,165,44,0.5)', 'Crown', 'spotvault', true, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. SECURITY DEFINER Functions
-- ============================================================

-- Set staff organization affiliation
CREATE OR REPLACE FUNCTION sv_set_staff_organization(p_user_id uuid, p_organization text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can set staff organization'; END IF;
  IF p_organization NOT IN ('spotvault', 'stakekings') THEN RAISE EXCEPTION 'Invalid organization'; END IF;
  INSERT INTO sv_staff_organizations (user_id, organization, updated_by, updated_at)
  VALUES (p_user_id, p_organization, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET organization = EXCLUDED.organization, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  UPDATE sv_staff_metadata SET organization = p_organization WHERE user_id = p_user_id;
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'set_staff_organization', p_user_id, jsonb_build_object('organization', p_organization));
END;
$$;

-- Get staff organization for a user
CREATE OR REPLACE FUNCTION sv_get_staff_organization(p_user_id uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT organization FROM sv_staff_organizations WHERE user_id = p_user_id; $$;

-- Get current user's staff organization
CREATE OR REPLACE FUNCTION sv_get_my_staff_organization()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT organization FROM sv_staff_organizations WHERE user_id = auth.uid(); $$;

-- Create a staff tag
CREATE OR REPLACE FUNCTION sv_create_staff_tag(p_title text, p_bg_color text, p_text_color text, p_border_color text, p_icon text, p_scope text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can create staff tags'; END IF;
  IF p_scope NOT IN ('spotvault', 'stakekings', 'shared') THEN RAISE EXCEPTION 'Invalid scope'; END IF;
  INSERT INTO sv_staff_tags (title, bg_color, text_color, border_color, icon, scope, is_system, is_active, created_by)
  VALUES (p_title, p_bg_color, p_text_color, p_border_color, p_icon, p_scope, false, true, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO sv_access_audit_log (actor_id, action, metadata)
  VALUES (auth.uid(), 'create_staff_tag', jsonb_build_object('tag_id', v_id, 'title', p_title));
  RETURN v_id;
END;
$$;

-- Update a staff tag
CREATE OR REPLACE FUNCTION sv_update_staff_tag(p_tag_id uuid, p_title text, p_bg_color text, p_text_color text, p_border_color text, p_icon text, p_scope text, p_is_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can update staff tags'; END IF;
  UPDATE sv_staff_tags SET title = p_title, bg_color = p_bg_color, text_color = p_text_color,
    border_color = p_border_color, icon = p_icon, scope = p_scope, is_active = p_is_active, updated_at = now()
  WHERE id = p_tag_id;
  INSERT INTO sv_access_audit_log (actor_id, action, metadata)
  VALUES (auth.uid(), 'update_staff_tag', jsonb_build_object('tag_id', p_tag_id));
END;
$$;

-- Delete a staff tag (non-system only)
CREATE OR REPLACE FUNCTION sv_delete_staff_tag(p_tag_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can delete staff tags'; END IF;
  IF EXISTS (SELECT 1 FROM sv_staff_tags WHERE id = p_tag_id AND is_system = true) THEN RAISE EXCEPTION 'System tags cannot be deleted'; END IF;
  DELETE FROM sv_staff_tags WHERE id = p_tag_id;
  INSERT INTO sv_access_audit_log (actor_id, action, metadata)
  VALUES (auth.uid(), 'delete_staff_tag', jsonb_build_object('tag_id', p_tag_id));
END;
$$;

-- Assign a tag to a user
CREATE OR REPLACE FUNCTION sv_assign_staff_tag(p_user_id uuid, p_tag_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can assign staff tags'; END IF;
  INSERT INTO sv_staff_tag_assignments (user_id, tag_id, assigned_by, assigned_at)
  VALUES (p_user_id, p_tag_id, auth.uid(), now()) ON CONFLICT (user_id, tag_id) DO NOTHING;
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'assign_staff_tag', p_user_id, jsonb_build_object('tag_id', p_tag_id));
END;
$$;

-- Remove a tag from a user
CREATE OR REPLACE FUNCTION sv_remove_staff_tag(p_user_id uuid, p_tag_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can remove staff tags'; END IF;
  DELETE FROM sv_staff_tag_assignments WHERE user_id = p_user_id AND tag_id = p_tag_id;
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'remove_staff_tag', p_user_id, jsonb_build_object('tag_id', p_tag_id));
END;
$$;

-- Get all staff tags
CREATE OR REPLACE FUNCTION sv_get_staff_tags()
RETURNS TABLE (id uuid, title text, bg_color text, text_color text, border_color text, icon text, scope text, is_active boolean, is_system boolean)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT id, title, bg_color, text_color, border_color, icon, scope, is_active, is_system FROM sv_staff_tags ORDER BY is_system DESC, title ASC; $$;

-- Get tags assigned to a user
CREATE OR REPLACE FUNCTION sv_get_user_staff_tags(p_user_id uuid)
RETURNS TABLE (tag_id uuid, title text, bg_color text, text_color text, border_color text, icon text, scope text, is_active boolean)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT t.id, t.title, t.bg_color, t.text_color, t.border_color, t.icon, t.scope, t.is_active
  FROM sv_staff_tag_assignments a JOIN sv_staff_tags t ON a.tag_id = t.id
  WHERE a.user_id = p_user_id AND t.is_active = true ORDER BY t.is_system DESC, t.title ASC;
$$;

-- Create a staff invitation (returns plaintext token)
CREATE OR REPLACE FUNCTION sv_create_staff_invitation(p_email text, p_full_name text, p_username text, p_organization text, p_tag_id uuid, p_permissions jsonb)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_token_hash text; v_id uuid; v_existing int;
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can create staff invitations'; END IF;
  IF p_organization NOT IN ('spotvault', 'stakekings') THEN RAISE EXCEPTION 'Invalid organization'; END IF;
  SELECT count(*) INTO v_existing FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_existing > 0 THEN RAISE EXCEPTION 'EMAIL_EXISTS: An account with this email already exists. Use the promote flow instead.'; END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := digest(v_token, 'sha256');
  INSERT INTO sv_staff_invitations (email, token_hash, full_name, username, organization, tag_id, permissions, status, created_by, expires_at)
  VALUES (p_email, v_token_hash, p_full_name, p_username, p_organization, p_tag_id, p_permissions, 'pending', auth.uid(), now() + interval '7 days')
  RETURNING id INTO v_id;
  INSERT INTO sv_access_audit_log (actor_id, action, metadata)
  VALUES (auth.uid(), 'create_staff_invitation', jsonb_build_object('invitation_id', v_id, 'email', p_email, 'organization', p_organization));
  RETURN v_token;
END;
$$;

-- Verify and consume a staff invitation
CREATE OR REPLACE FUNCTION sv_consume_staff_invitation(p_token text, p_new_user_id uuid)
RETURNS TABLE (id uuid, email text, full_name text, username text, organization text, tag_id uuid, permissions jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_hash text; v_inv sv_staff_invitations%ROWTYPE;
BEGIN
  v_hash := digest(p_token, 'sha256');
  SELECT * INTO v_inv FROM sv_staff_invitations WHERE token_hash = v_hash AND status = 'pending' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_TOKEN'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE sv_staff_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'EXPIRED_TOKEN';
  END IF;
  UPDATE sv_staff_invitations SET status = 'consumed', consumed_at = now(), consumed_by_user_id = p_new_user_id WHERE id = v_inv.id;
  INSERT INTO sv_staff_organizations (user_id, organization, updated_by, updated_at)
  VALUES (p_new_user_id, v_inv.organization, v_inv.created_by, now()) ON CONFLICT DO NOTHING;
  INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at)
  VALUES (p_new_user_id, 'staff', 'active', v_inv.created_by, now()) ON CONFLICT (user_id, role) DO UPDATE SET status = 'active', approved_at = now();
  IF v_inv.tag_id IS NOT NULL THEN
    INSERT INTO sv_staff_tag_assignments (user_id, tag_id, assigned_by, assigned_at)
    VALUES (p_new_user_id, v_inv.tag_id, v_inv.created_by, now()) ON CONFLICT DO NOTHING;
  END IF;
  IF (v_inv.permissions->>'solver')::boolean THEN
    INSERT INTO sv_entitlements (user_id, resource_type, entitlement_type, source) VALUES (p_new_user_id, 'tool', 'solver', 'staff_grant') ON CONFLICT DO NOTHING; END IF;
  IF (v_inv.permissions->>'analytics')::boolean THEN
    INSERT INTO sv_entitlements (user_id, resource_type, entitlement_type, source) VALUES (p_new_user_id, 'tool', 'analytics', 'staff_grant') ON CONFLICT DO NOTHING; END IF;
  IF (v_inv.permissions->>'chat')::boolean THEN
    INSERT INTO sv_entitlements (user_id, resource_type, entitlement_type, source) VALUES (p_new_user_id, 'tool', 'chat', 'staff_grant') ON CONFLICT DO NOTHING; END IF;
  IF (v_inv.permissions->>'main_board')::boolean THEN
    INSERT INTO sv_entitlements (user_id, resource_type, entitlement_type, source) VALUES (p_new_user_id, 'tool', 'main_board', 'staff_grant') ON CONFLICT DO NOTHING; END IF;
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (v_inv.created_by, 'consume_staff_invitation', p_new_user_id, jsonb_build_object('invitation_id', v_inv.id));
  RETURN QUERY SELECT v_inv.id, v_inv.email, v_inv.full_name, v_inv.username, v_inv.organization, v_inv.tag_id, v_inv.permissions;
END;
$$;

-- List all staff invitations
CREATE OR REPLACE FUNCTION sv_list_staff_invitations()
RETURNS TABLE (id uuid, email text, full_name text, username text, organization text, status text, created_at timestamptz, expires_at timestamptz, consumed_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT id, email, full_name, username, organization, status, created_at, expires_at, consumed_at FROM sv_staff_invitations ORDER BY created_at DESC; $$;

-- Resend a pending invitation
CREATE OR REPLACE FUNCTION sv_resend_staff_invitation(p_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_token_hash text; v_inv sv_staff_invitations%ROWTYPE;
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can resend invitations'; END IF;
  SELECT * INTO v_inv FROM sv_staff_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status = 'consumed' THEN RAISE EXCEPTION 'Cannot resend a consumed invitation'; END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := digest(v_token, 'sha256');
  UPDATE sv_staff_invitations SET token_hash = v_token_hash, status = 'pending', expires_at = now() + interval '7 days' WHERE id = p_invitation_id;
  INSERT INTO sv_access_audit_log (actor_id, action, metadata)
  VALUES (auth.uid(), 'resend_staff_invitation', jsonb_build_object('invitation_id', p_invitation_id));
  RETURN v_token;
END;
$$;

-- Revoke a pending invitation
CREATE OR REPLACE FUNCTION sv_revoke_staff_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can revoke invitations'; END IF;
  UPDATE sv_staff_invitations SET status = 'expired' WHERE id = p_invitation_id AND status = 'pending';
  INSERT INTO sv_access_audit_log (actor_id, action, metadata)
  VALUES (auth.uid(), 'revoke_staff_invitation', jsonb_build_object('invitation_id', p_invitation_id));
END;
$$;

-- Suspend a staff account
CREATE OR REPLACE FUNCTION sv_suspend_staff(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_is_super int;
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can suspend staff'; END IF;
  SELECT count(*) INTO v_is_super FROM sv_roles WHERE user_id = p_user_id AND role = 'superuser' AND status = 'active';
  IF v_is_super > 0 THEN RAISE EXCEPTION 'Cannot suspend a superuser account'; END IF;
  UPDATE sv_roles SET status = 'suspended', updated_at = now() WHERE user_id = p_user_id AND role IN ('staff', 'developer_admin', 'moderator');
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'suspend_staff', p_user_id, '{}'::jsonb);
END;
$$;

-- Reactivate a suspended staff account
CREATE OR REPLACE FUNCTION sv_reactivate_staff(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_superuser() THEN RAISE EXCEPTION 'Only superusers can reactivate staff'; END IF;
  UPDATE sv_roles SET status = 'active', updated_at = now() WHERE user_id = p_user_id AND role IN ('staff', 'developer_admin', 'moderator');
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'reactivate_staff', p_user_id, '{}'::jsonb);
END;
$$;

-- Enhanced staff directory (note: user_profiles.user_id is text, needs cast)
CREATE OR REPLACE FUNCTION sv_get_enhanced_staff_directory()
RETURNS TABLE (
  user_id uuid, display_name text, username text, email text, sv_user_id text,
  role text, staff_title text, organization text, status text,
  badge_text text, badge_color text, badge_text_color text, badge_icon text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    p.display_name,
    p.username,
    u.email,
    p.sv_user_id,
    COALESCE(r.role, 'user') AS role,
    m.staff_title,
    COALESCE(o.organization, 'spotvault') AS organization,
    COALESCE(r.status, 'active') AS status,
    m.badge_text,
    m.badge_color,
    m.badge_text_color,
    m.badge_icon
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.user_id::uuid = u.id
  LEFT JOIN sv_roles r ON r.user_id = u.id AND r.status = 'active'
  LEFT JOIN sv_staff_metadata m ON m.user_id = u.id
  LEFT JOIN sv_staff_organizations o ON o.user_id = u.id
  WHERE r.role IN ('staff', 'superuser', 'developer_admin', 'moderator')
    AND r.status = 'active'
  ORDER BY r.role = 'superuser' DESC, p.display_name ASC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sv_get_staff_organization(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_get_my_staff_organization() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_get_staff_tags() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_get_user_staff_tags(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_get_enhanced_staff_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_set_staff_organization(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_create_staff_tag(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_update_staff_tag(uuid, text, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_delete_staff_tag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_assign_staff_tag(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_remove_staff_tag(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_create_staff_invitation(text, text, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_consume_staff_invitation(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_list_staff_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_resend_staff_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_revoke_staff_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_suspend_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_reactivate_staff(uuid) TO authenticated;