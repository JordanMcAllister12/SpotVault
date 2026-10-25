/*
# Authorization Foundation — Roles, Portal Access, Resource Ownership, Audit Log

## Purpose
Establishes the centralized authorization architecture for SpotVault. This is Phase 1 of the
unified permissions system. It creates the core tables that separate Identity, Role, Portal,
and Resource Permission concepts.

## New Tables

### sv_roles
Stores which roles a user has been approved for. One account can have multiple roles.
- user_id (uuid, references auth.users)
- role (text: 'player' | 'coach' | 'creator' | 'investor' | 'stable_operator' | 'business' | 'staff')
- status (text: 'active' | 'pending' | 'suspended' | 'revoked')
- approved_by (uuid, nullable — who approved this role)
- approved_at (timestamptz, nullable)
- created_at, updated_at

### sv_portal_access
Controls which portals (workspaces) a user can enter. Portal access is derived from roles
but stored separately so it can be revoked independently.
- user_id (uuid)
- portal_type (text: 'player' | 'coach' | 'stable' | 'business' | 'creator')
- status (text: 'active' | 'pending' | 'suspended' | 'revoked')
- approved_by (uuid, nullable)
- approved_at (timestamptz, nullable)
- expires_at (timestamptz, nullable)
- metadata (jsonb, for guest hours etc)
- created_at, updated_at

### sv_resource_ownership
Tracks ownership of private resources. Every private resource has exactly one owner
(individual or organization).
- id (uuid, primary key)
- resource_type (text: 'hand' | 'hand_collection' | 'tournament' | 'session' | 'analytics_dataset' | 'analytics_report' | 'library_item' | 'spot' | 'video' | 'course' | 'study_set' | 'assignment' | 'submission' | 'coaching_session' | 'coaching_recording' | 'transcript' | 'coaching_notes')
- resource_id (uuid — the ID of the resource in its source table)
- owner_type (text: 'user' | 'organization')
- owner_id (uuid — user_id or organization_id)
- created_at

### sv_access_audit_log
Audit trail for all meaningful authorization actions.
- id (uuid, primary key)
- actor_id (uuid — who performed the action)
- action (text: 'resource_shared' | 'sharesync_revoked' | 'relationship_created' | 'relationship_ended' | 'portal_approved' | 'portal_revoked' | 'submission_created' | 'recording_accessed' | 'recording_deleted' | 'entitlement_granted' | 'entitlement_revoked' | 'role_granted' | 'role_revoked')
- resource_type (text, nullable)
- resource_id (uuid, nullable)
- target_user_id (uuid, nullable — the user affected)
- metadata (jsonb)
- created_at

## Security
- All tables have RLS enabled
- sv_roles: users can read their own roles; inserts/updates only via SECURITY DEFINER functions
- sv_portal_access: users can read their own portal access; inserts/updates only via SECURITY DEFINER functions
- sv_resource_ownership: users can read ownership for resources they own or are granted access to
- sv_access_audit_log: users can read their own audit entries (as actor or target); inserts via SECURITY DEFINER

## Important Notes
1. This migration does NOT modify any existing tables or policies — existing functionality remains operational.
2. The 'sv_' prefix distinguishes new authorization tables from existing application tables.
3. Role and portal changes go through SECURITY DEFINER functions (Phase 1 helpers) to prevent client-side privilege escalation.
4. Resource ownership is additive — existing resources can be backfilled later without disruption.
*/

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'revoked')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE sv_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles
DROP POLICY IF EXISTS "sv_roles_select_own" ON sv_roles;
CREATE POLICY "sv_roles_select_own" ON sv_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- All mutations go through SECURITY DEFINER functions — no direct client writes
REVOKE INSERT ON sv_roles FROM anon, authenticated;
REVOKE UPDATE ON sv_roles FROM anon, authenticated;
REVOKE DELETE ON sv_roles FROM anon, authenticated;

-- ============================================================
-- 2. PORTAL ACCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_type text NOT NULL CHECK (portal_type IN ('player', 'coach', 'stable', 'business', 'creator')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended', 'revoked')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, portal_type)
);

ALTER TABLE sv_portal_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own portal access
DROP POLICY IF EXISTS "sv_portal_access_select_own" ON sv_portal_access;
CREATE POLICY "sv_portal_access_select_own" ON sv_portal_access FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- All mutations go through SECURITY DEFINER functions
REVOKE INSERT ON sv_portal_access FROM anon, authenticated;
REVOKE UPDATE ON sv_portal_access FROM anon, authenticated;
REVOKE DELETE ON sv_portal_access FROM anon, authenticated;

-- ============================================================
-- 3. RESOURCE OWNERSHIP
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_resource_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  owner_type text NOT NULL DEFAULT 'user' CHECK (owner_type IN ('user', 'organization')),
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id)
);

-- Index for looking up ownership by resource
CREATE INDEX IF NOT EXISTS sv_resource_ownership_resource_idx
  ON sv_resource_ownership (resource_type, resource_id);

-- Index for looking up all resources owned by a user
CREATE INDEX IF NOT EXISTS sv_resource_ownership_owner_idx
  ON sv_resource_ownership (owner_type, owner_id);

ALTER TABLE sv_resource_ownership ENABLE ROW LEVEL SECURITY;

-- Users can read ownership records for resources they own
DROP POLICY IF EXISTS "sv_ownership_select_own" ON sv_resource_ownership;
CREATE POLICY "sv_ownership_select_own" ON sv_resource_ownership FOR SELECT
  TO authenticated USING (
    owner_type = 'user' AND owner_id = auth.uid()
  );

-- All mutations go through SECURITY DEFINER functions
REVOKE INSERT ON sv_resource_ownership FROM anon, authenticated;
REVOKE UPDATE ON sv_resource_ownership FROM anon, authenticated;
REVOKE DELETE ON sv_resource_ownership FROM anon, authenticated;

-- ============================================================
-- 4. ACCESS AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_audit_actor_idx ON sv_access_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS sv_audit_target_idx ON sv_access_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS sv_audit_resource_idx ON sv_access_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS sv_audit_created_idx ON sv_access_audit_log (created_at DESC);

ALTER TABLE sv_access_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read audit entries where they are the actor or target
DROP POLICY IF EXISTS "sv_audit_select_own" ON sv_access_audit_log;
CREATE POLICY "sv_audit_select_own" ON sv_access_audit_log FOR SELECT
  TO authenticated USING (actor_id = auth.uid() OR target_user_id = auth.uid());

-- Inserts go through SECURITY DEFINER functions only
REVOKE INSERT ON sv_access_audit_log FROM anon, authenticated;
REVOKE UPDATE ON sv_access_audit_log FROM anon, authenticated;
REVOKE DELETE ON sv_access_audit_log FROM anon, authenticated;

-- ============================================================
-- 5. SECURITY DEFINER: Grant Role
-- ============================================================
-- Called by an admin/staff to grant a role to a user.
-- Checks that the CALLER is authorized (staff or admin).
CREATE OR REPLACE FUNCTION sv_grant_role(p_user_id uuid, p_role text, p_status text DEFAULT 'active')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Authorize the CALLER
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to grant roles';
  END IF;

  IF p_role NOT IN ('player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_status NOT IN ('active', 'pending', 'suspended', 'revoked') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  INSERT INTO sv_roles (user_id, role, status, approved_by, approved_at)
  VALUES (p_user_id, p_role, p_status, auth.uid(), now())
  ON CONFLICT (user_id, role) DO UPDATE
    SET status = EXCLUDED.status,
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        updated_at = now();

  -- Auto-grant player portal for any role (player is base experience)
  IF p_role != 'player' AND p_status = 'active' THEN
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
    VALUES (p_user_id, 'player', 'active', auth.uid(), now())
    ON CONFLICT (user_id, portal_type) DO UPDATE
      SET status = 'active', approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  END IF;

  -- Grant portal access for the role
  IF p_role = 'player' THEN
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
    VALUES (p_user_id, 'player', 'active', auth.uid(), now())
    ON CONFLICT (user_id, portal_type) DO UPDATE
      SET status = 'active', approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  ELSIF p_role = 'coach' THEN
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
    VALUES (p_user_id, 'coach', 'active', auth.uid(), now())
    ON CONFLICT (user_id, portal_type) DO UPDATE
      SET status = 'active', approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  ELSIF p_role = 'stable_operator' THEN
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
    VALUES (p_user_id, 'stable', 'active', auth.uid(), now())
    ON CONFLICT (user_id, portal_type) DO UPDATE
      SET status = 'active', approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  ELSIF p_role IN ('business', 'investor') THEN
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
    VALUES (p_user_id, 'business', 'active', auth.uid(), now())
    ON CONFLICT (user_id, portal_type) DO UPDATE
      SET status = 'active', approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  ELSIF p_role = 'creator' THEN
    INSERT INTO sv_portal_access (user_id, portal_type, status, approved_by, approved_at)
    VALUES (p_user_id, 'creator', 'active', auth.uid(), now())
    ON CONFLICT (user_id, portal_type) DO UPDATE
      SET status = 'active', approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  END IF;

  -- Audit
  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'role_granted', p_user_id, jsonb_build_object('role', p_role, 'status', p_status));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_grant_role(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_grant_role(uuid, text, text) TO authenticated;

-- ============================================================
-- 6. SECURITY DEFINER: Revoke Role
-- ============================================================
CREATE OR REPLACE FUNCTION sv_revoke_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to revoke roles';
  END IF;

  IF p_role NOT IN ('player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE sv_roles SET status = 'revoked', updated_at = now()
  WHERE user_id = p_user_id AND role = p_role;

  -- Revoke corresponding portal access
  IF p_role = 'coach' THEN
    UPDATE sv_portal_access SET status = 'revoked', updated_at = now()
    WHERE user_id = p_user_id AND portal_type = 'coach';
  ELSIF p_role = 'stable_operator' THEN
    UPDATE sv_portal_access SET status = 'revoked', updated_at = now()
    WHERE user_id = p_user_id AND portal_type = 'stable';
  ELSIF p_role IN ('business', 'investor') THEN
    UPDATE sv_portal_access SET status = 'revoked', updated_at = now()
    WHERE user_id = p_user_id AND portal_type = 'business';
  ELSIF p_role = 'creator' THEN
    UPDATE sv_portal_access SET status = 'revoked', updated_at = now()
    WHERE user_id = p_user_id AND portal_type = 'creator';
  END IF;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'role_revoked', p_user_id, jsonb_build_object('role', p_role));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_role(uuid, text) TO authenticated;

-- ============================================================
-- 7. SECURITY DEFINER: Check Portal Access
-- ============================================================
-- Returns true if the current user has active access to the given portal.
CREATE OR REPLACE FUNCTION sv_has_portal_access(p_portal_type text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sv_portal_access
    WHERE user_id = auth.uid()
    AND portal_type = p_portal_type
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION sv_has_portal_access(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_has_portal_access(text) TO authenticated;

-- ============================================================
-- 8. SECURITY DEFINER: Get User Roles
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_roles()
RETURNS TABLE (role text, status text)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role, status FROM sv_roles WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_roles() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_roles() TO authenticated;

-- ============================================================
-- 9. SECURITY DEFINER: Get My Portal Access
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_portal_access()
RETURNS TABLE (portal_type text, status text, expires_at timestamptz, metadata jsonb)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT portal_type, status, expires_at, metadata
  FROM sv_portal_access WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_portal_access() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_portal_access() TO authenticated;

-- ============================================================
-- 10. SECURITY DEFINER: Record Audit Event
-- ============================================================
-- Allows any authenticated user to record an audit event for their own actions.
CREATE OR REPLACE FUNCTION sv_record_audit_event(
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO sv_access_audit_log (actor_id, action, resource_type, resource_id, target_user_id, metadata)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_target_user_id, p_metadata);
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_record_audit_event(text, text, uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION sv_record_audit_event(text, text, uuid, uuid, jsonb) TO authenticated;

-- ============================================================
-- 11. SECURITY DEFINER: Claim Resource Ownership
-- ============================================================
-- Called when a user creates a private resource. Records that they own it.
CREATE OR REPLACE FUNCTION sv_claim_ownership(
  p_resource_type text,
  p_resource_id uuid,
  p_owner_type text DEFAULT 'user'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_owner_type NOT IN ('user', 'organization') THEN
    RAISE EXCEPTION 'Invalid owner type';
  END IF;

  INSERT INTO sv_resource_ownership (resource_type, resource_id, owner_type, owner_id)
  VALUES (p_resource_type, p_resource_id, p_owner_type, auth.uid())
  ON CONFLICT (resource_type, resource_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_claim_ownership(text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_claim_ownership(text, uuid, text) TO authenticated;

-- ============================================================
-- 12. SECURITY DEFINER: Check Resource Ownership
-- ============================================================
CREATE OR REPLACE FUNCTION sv_is_resource_owner(
  p_resource_type text,
  p_resource_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sv_resource_ownership
    WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND owner_type = 'user'
    AND owner_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION sv_is_resource_owner(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_is_resource_owner(text, uuid) TO authenticated;

-- ============================================================
-- 13. SECURITY DEFINER: Get Access Reason
-- ============================================================
-- Returns WHY a user has access to a resource: 'owner', 'purchase', 'subscription',
-- 'relationship_grant', 'submission', 'organization_member', 'admin', or NULL (no access).
CREATE OR REPLACE FUNCTION sv_get_access_reason(
  p_resource_type text,
  p_resource_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_reason text;
BEGIN
  -- Check direct ownership
  SELECT owner_id INTO v_owner_id
  FROM sv_resource_ownership
  WHERE resource_type = p_resource_type AND resource_id = p_resource_id AND owner_type = 'user';

  IF v_owner_id = auth.uid() THEN
    RETURN 'owner';
  END IF;

  -- Check ShareSync grants (Phase 3 — sv_resource_grants table)
  BEGIN
    SELECT 'relationship_grant' INTO v_reason
    FROM sv_resource_grants
    WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND recipient_id = auth.uid()
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF FOUND THEN RETURN v_reason; END IF;
  EXCEPTION WHEN undefined_table THEN
    -- Phase 3 table not yet created — skip
  END;

  -- Check entitlements (purchases/subscription)
  BEGIN
    SELECT 'purchase' INTO v_reason
    FROM sv_entitlements
    WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND user_id = auth.uid()
    AND entitlement_type = 'purchase'
    LIMIT 1;

    IF FOUND THEN RETURN v_reason; END IF;

    SELECT 'subscription' INTO v_reason
    FROM sv_entitlements
    WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND user_id = auth.uid()
    AND entitlement_type = 'subscription'
    AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF FOUND THEN RETURN v_reason; END IF;
  EXCEPTION WHEN undefined_table THEN
    -- Phase 6 table not yet created — skip
  END;

  -- Check coaching submission access
  BEGIN
    SELECT 'submission' INTO v_reason
    FROM sv_coaching_submissions
    WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND (student_id = auth.uid() OR coach_id = auth.uid())
    AND status NOT IN ('returned', 'cancelled')
    LIMIT 1;

    IF FOUND THEN RETURN v_reason; END IF;
  EXCEPTION WHEN undefined_table THEN
    -- Phase 4 table not yet created — skip
  END;

  -- No access found
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_access_reason(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_access_reason(text, uuid) TO authenticated;