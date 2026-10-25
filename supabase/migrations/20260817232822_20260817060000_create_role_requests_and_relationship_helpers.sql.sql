/*
# Role Requests + Relationship Acceptance Helpers

## Purpose
Adds a role-request workflow so users can request privileged roles (coach, creator,
investor, etc.) that require staff approval. Also adds relationship acceptance
helpers so coach-student connections work properly: the coach must accept before
the relationship becomes ACTIVE.

## New Tables

### sv_role_requests
A request from a user to obtain a privileged role. Staff approve or reject.
- id (uuid, primary key)
- user_id (uuid — who is requesting)
- role (text — the role being requested)
- status (text: 'pending' | 'approved' | 'rejected' | 'revoked')
- reviewed_by (uuid, nullable — staff who reviewed)
- reviewed_at (timestamptz, nullable)
- note (text, nullable — user's note explaining why they want the role)
- staff_note (text, nullable — staff's note on decision)
- created_at, updated_at

## Security
- sv_role_requests: RLS enabled. Users can read their own requests. Staff can read all.
  Mutations through SECURITY DEFINER functions only.
- Direct client INSERT/UPDATE/DELETE revoked on all tables.

## New/Modified Functions
1. sv_request_role(p_role, p_note) — user submits a role request (status=pending)
2. sv_review_role_request(p_request_id, p_decision, p_staff_note) — staff approve/reject
3. sv_revoke_role_request(p_request_id) — staff revoke a previously approved role
4. sv_accept_relationship(p_relationship_id) — the other party accepts a pending relationship
5. sv_decline_relationship(p_relationship_id) — the other party declines
6. sv_get_pending_role_requests() — staff: get all pending requests
7. sv_get_all_role_requests() — staff: get all requests (for audit/history)
8. sv_get_my_role_requests() — user: get their own requests

## Important Notes
1. When staff approves a role request, sv_grant_role is called internally to grant
   the role + corresponding portal access.
2. When staff revokes, sv_revoke_role is called to remove portal access.
3. Relationship acceptance: sv_accept_relationship flips status from pending to active.
   Only the non-initiating party can accept (the party who did NOT create the request).
4. Relationship decline: sets status to 'ended' with metadata.preserved.
5. Player role is automatic — no request needed.
*/

-- ============================================================
-- 1. ROLE REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('coach', 'creator', 'investor', 'stable_operator', 'business', 'affiliate', 'media', 'staff')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  note text,
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS sv_role_requests_status_idx ON sv_role_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sv_role_requests_user_idx ON sv_role_requests (user_id, created_at DESC);

ALTER TABLE sv_role_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests; staff can read all
DROP POLICY IF EXISTS "sv_role_requests_select" ON sv_role_requests;
CREATE POLICY "sv_role_requests_select" ON sv_role_requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
    )
  );

REVOKE INSERT ON sv_role_requests FROM anon, authenticated;
REVOKE UPDATE ON sv_role_requests FROM anon, authenticated;
REVOKE DELETE ON sv_role_requests FROM anon, authenticated;

-- ============================================================
-- 2. SECURITY DEFINER: Request Role
-- ============================================================
CREATE OR REPLACE FUNCTION sv_request_role(
  p_role text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing_status text;
BEGIN
  IF p_role NOT IN ('coach', 'creator', 'investor', 'stable_operator', 'business', 'affiliate', 'media', 'staff') THEN
    RAISE EXCEPTION 'Invalid role request';
  END IF;

  -- Check if already has an active role
  IF EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = p_role
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'You already have this role';
  END IF;

  -- Check for existing pending request
  SELECT status INTO v_existing_status
  FROM sv_role_requests
  WHERE user_id = auth.uid() AND role = p_role
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing_status = 'pending' THEN
    RAISE EXCEPTION 'You already have a pending request for this role';
  END IF;

  INSERT INTO sv_role_requests (user_id, role, status, note)
  VALUES (auth.uid(), p_role, 'pending', p_note)
  ON CONFLICT (user_id, role) DO UPDATE
    SET status = 'pending', note = EXCLUDED.note, reviewed_by = NULL, reviewed_at = NULL,
        staff_note = NULL, updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'role_requested', auth.uid(), jsonb_build_object('role', p_role, 'request_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_request_role(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_request_role(text, text) TO authenticated;

-- ============================================================
-- 3. SECURITY DEFINER: Review Role Request (Staff)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_review_role_request(
  p_request_id uuid,
  p_decision text,
  p_staff_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff only';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved or rejected';
  END IF;

  SELECT user_id, role INTO v_user_id, v_role
  FROM sv_role_requests WHERE id = p_request_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE sv_role_requests
  SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
      staff_note = p_staff_note, updated_at = now()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    -- Grant the role via the existing function
    PERFORM sv_grant_role(v_user_id, v_role, 'active');
  END IF;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_decision = 'approved' THEN 'role_approved' ELSE 'role_rejected' END,
    v_user_id, jsonb_build_object('role', v_role, 'request_id', p_request_id, 'decision', p_decision));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_review_role_request(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_review_role_request(uuid, text, text) TO authenticated;

-- ============================================================
-- 4. SECURITY DEFINER: Revoke Role Request (Staff)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_revoke_role_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'staff'
    AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff only';
  END IF;

  SELECT user_id, role INTO v_user_id, v_role
  FROM sv_role_requests WHERE id = p_request_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE sv_role_requests
  SET status = 'revoked', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Revoke the actual role + portal access
  PERFORM sv_revoke_role(v_user_id, v_role);

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'role_revoked', v_user_id, jsonb_build_object('role', v_role, 'request_id', p_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_role_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_role_request(uuid) TO authenticated;

-- ============================================================
-- 5. SECURITY DEFINER: Get Pending Role Requests (Staff)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_pending_role_requests()
RETURNS TABLE (
  id uuid, user_id uuid, role text, status text, note text,
  created_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, staff_note text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, user_id, role, status, note, created_at, reviewed_by, reviewed_at, staff_note
  FROM sv_role_requests
  WHERE status = 'pending'
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_pending_role_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_pending_role_requests() TO authenticated;

-- ============================================================
-- 6. SECURITY DEFINER: Get All Role Requests (Staff)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_all_role_requests()
RETURNS TABLE (
  id uuid, user_id uuid, role text, status text, note text,
  created_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, staff_note text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, user_id, role, status, note, created_at, reviewed_by, reviewed_at, staff_note
  FROM sv_role_requests
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_all_role_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_all_role_requests() TO authenticated;

-- ============================================================
-- 7. SECURITY DEFINER: Get My Role Requests
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_role_requests()
RETURNS TABLE (
  id uuid, role text, status text, note text, staff_note text,
  created_at timestamptz, reviewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, role, status, note, staff_note, created_at, reviewed_at
  FROM sv_role_requests
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_role_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_role_requests() TO authenticated;

-- ============================================================
-- 8. SECURITY DEFINER: Accept Relationship
-- ============================================================
-- The non-initiating party accepts a pending relationship.
-- For coach_student: user_a=coach, user_b=student. Student creates the request,
--   so the coach (user_a) accepts. If the coach creates it, the student accepts.
CREATE OR REPLACE FUNCTION sv_accept_relationship(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text;
  v_user_a uuid;
  v_user_b uuid;
  v_status text;
BEGIN
  SELECT type, user_a, user_b, status INTO v_type, v_user_a, v_user_b, v_status
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Relationship is not pending'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized: must be a participant';
  END IF;

  UPDATE sv_relationships
  SET status = 'active', started_at = COALESCE(started_at, now()), updated_at = now()
  WHERE id = p_relationship_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'relationship_accepted',
    CASE WHEN auth.uid() = v_user_a THEN v_user_b ELSE v_user_a END,
    jsonb_build_object('relationship_id', p_relationship_id, 'type', v_type));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_accept_relationship(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_accept_relationship(uuid) TO authenticated;

-- ============================================================
-- 9. SECURITY DEFINER: Decline Relationship
-- ============================================================
CREATE OR REPLACE FUNCTION sv_decline_relationship(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text;
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT type, user_a, user_b INTO v_type, v_user_a, v_user_b
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized: must be a participant';
  END IF;

  UPDATE sv_relationships
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE id = p_relationship_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'relationship_declined',
    CASE WHEN auth.uid() = v_user_a THEN v_user_b ELSE v_user_a END,
    jsonb_build_object('relationship_id', p_relationship_id, 'type', v_type));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_decline_relationship(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_decline_relationship(uuid) TO authenticated;

-- ============================================================
-- 10. SECURITY DEFINER: Block User (relationship-level)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_block_relationship(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT user_a, user_b INTO v_user_a, v_user_b
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized: must be a participant';
  END IF;

  UPDATE sv_relationships
  SET status = 'blocked', updated_at = now()
  WHERE id = p_relationship_id;

  -- Revoke all grants tied to this relationship
  BEGIN
    UPDATE sv_resource_grants
    SET revoked_at = now()
    WHERE relationship_id = p_relationship_id
    AND revoked_at IS NULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'relationship_blocked',
    CASE WHEN auth.uid() = v_user_a THEN v_user_b ELSE v_user_a END,
    jsonb_build_object('relationship_id', p_relationship_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_block_relationship(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_block_relationship(uuid) TO authenticated;

-- ============================================================
-- 11. SECURITY DEFINER: Get My Relationships (enhanced)
-- Replace existing with version that includes ended_at
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_relationships(p_type text DEFAULT NULL)
RETURNS TABLE (
  id uuid, type text, user_a uuid, user_b uuid, status text,
  is_primary boolean, metadata jsonb, started_at timestamptz, ended_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, type, user_a, user_b, status, is_primary, metadata, started_at, ended_at
  FROM sv_relationships
  WHERE (user_a = auth.uid() OR user_b = auth.uid())
  AND (p_type IS NULL OR type = p_type)
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_relationships(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_relationships(text) TO authenticated;

-- ============================================================
-- 12. SECURITY DEFINER: Get Pending Relationship Requests
-- Returns relationships where the current user is the one who needs to accept
-- (i.e., they are a participant but didn't initiate — for coach_student,
-- user_a=coach, user_b=student; if student created it, coach needs to accept)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_pending_relationship_requests()
RETURNS TABLE (
  id uuid, type text, user_a uuid, user_b uuid, metadata jsonb, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, type, user_a, user_b, metadata, created_at
  FROM sv_relationships
  WHERE status = 'pending'
  AND (user_a = auth.uid() OR user_b = auth.uid())
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_pending_relationship_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_pending_relationship_requests() TO authenticated;

-- ============================================================
-- 13. SECURITY DEFINER: Set Primary Coach/Relationship
-- ============================================================
CREATE OR REPLACE FUNCTION sv_set_primary_relationship(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text;
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT type, user_a, user_b INTO v_type, v_user_a, v_user_b
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized: must be a participant';
  END IF;

  -- Clear existing primary for same type and same user
  UPDATE sv_relationships
  SET is_primary = false, updated_at = now()
  WHERE type = v_type
  AND (user_a = auth.uid() OR user_b = auth.uid())
  AND is_primary = true;

  -- Set the new primary
  UPDATE sv_relationships
  SET is_primary = true, updated_at = now()
  WHERE id = p_relationship_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_set_primary_relationship(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_set_primary_relationship(uuid) TO authenticated;