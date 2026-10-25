/*
# Create Access Control System — Audit Log + Permission Matrix Function

## Purpose
Centralizes all user-level permission/access/role/verification data into a single
queryable interface for the Staff Access Control HUD. Does NOT modify any existing
permission tables — it reads from them and presents a unified view.

## New Tables
- `sv_permission_audit_log` — audit trail for every manual permission change made
  through the Access Control HUD. Records: affected user, permission key, previous
  state, new state, staff member who made the change, timestamp, and optional note.

## New Functions
- `sv_staff_get_user_permissions(p_user_id text)` — SECURITY DEFINER, staff-only.
  Returns a JSON object containing ALL permissions/access for a given user:
  roles, portal access, feed posting, creator permissions, partner access,
  booking provider status, capabilities, community entitlements, and account status.
- `sv_staff_search_users_access(p_query text, p_limit int)` — SECURITY DEFINER, staff-only.
  Searches users by username/display_name/email/user_id and returns basic profile info
  plus a summary of their key permissions for the matrix view.
- `sv_staff_get_permission_audit_log(p_limit int, p_offset int)` — SECURITY DEFINER, staff-only.
  Returns recent permission audit log entries.

## Security
- RLS enabled on `sv_permission_audit_log`.
- Staff can read all audit log entries; users can read entries where they are the actor or target.
- Only staff/superuser can insert audit log entries (via SECURITY DEFINER function).
- All three functions check `sv_is_staff_or_admin()` before returning data.

## Notes
1. This migration does NOT modify any existing tables or permissions.
2. The permission matrix function reads from multiple tables and presents a unified view.
3. Existing permission enforcement (RLS policies, SECURITY DEFINER functions) is unchanged.
4. The audit log table is new and does not affect existing audit systems.
*/

-- ── Audit Log Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sv_permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id text NOT NULL,
  target_user_name text,
  permission_key text NOT NULL,
  permission_label text,
  previous_state text,
  new_state text,
  actor_id text NOT NULL,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_permission_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_all_audit_log" ON sv_permission_audit_log;
CREATE POLICY "staff_read_all_audit_log"
ON sv_permission_audit_log FOR SELECT
TO authenticated
USING (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "users_read_own_audit_log" ON sv_permission_audit_log;
CREATE POLICY "users_read_own_audit_log"
ON sv_permission_audit_log FOR SELECT
TO authenticated
USING (auth.uid()::text = target_user_id OR auth.uid()::text = actor_id);

-- No INSERT policy — inserts go through the SECURITY DEFINER function only.

-- ── Function: Record permission audit event ──────────────────────
CREATE OR REPLACE FUNCTION sv_record_permission_audit(
  p_target_user_id text,
  p_permission_key text,
  p_previous_state text,
  p_new_state text,
  p_permission_label text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id text;
  v_actor_name text;
  v_target_name text;
BEGIN
  v_actor_id := auth.uid()::text;

  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT display_name INTO v_actor_name FROM user_profiles WHERE user_id = v_actor_id;
  SELECT display_name INTO v_target_name FROM user_profiles WHERE user_id = p_target_user_id;

  INSERT INTO sv_permission_audit_log (
    target_user_id, target_user_name, permission_key, permission_label,
    previous_state, new_state, actor_id, actor_name, note
  ) VALUES (
    p_target_user_id, v_target_name, p_permission_key, p_permission_label,
    p_previous_state, p_new_state, v_actor_id, v_actor_name, p_note
  );
END;
$$;

-- ── Function: Get all permissions for a user ────────────────────
CREATE OR REPLACE FUNCTION sv_staff_get_user_permissions(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_roles jsonb;
  v_portals jsonb;
  v_capabilities jsonb;
  v_feed_posting jsonb;
  v_network_posting jsonb;
  v_creator_perms jsonb;
  v_creator_apps jsonb;
  v_partner jsonb;
  v_booking jsonb;
  v_community jsonb;
  v_entitlements jsonb;
  v_profile jsonb;
  v_account_status text;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Roles
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'role', role, 'status', status, 'approved_by', approved_by, 'approved_at', approved_at
  )), '[]'::jsonb) INTO v_roles
  FROM sv_roles WHERE user_id = p_user_id;

  -- Portal access
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'portal_type', portal_type, 'status', status, 'expires_at', expires_at
  )), '[]'::jsonb) INTO v_portals
  FROM sv_portal_access WHERE user_id = p_user_id;

  -- Capabilities
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'capability', capability, 'status', status, 'granted_by', granted_by, 'granted_at', granted_at
  )), '[]'::jsonb) INTO v_capabilities
  FROM sv_user_capabilities WHERE user_id = p_user_id;

  -- Feed posting requests
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'status', status, 'category', category, 'created_at', created_at, 'reviewed_at', reviewed_at
  )), '[]'::jsonb) INTO v_feed_posting
  FROM sv_general_feed_posting_requests WHERE user_id = p_user_id;

  -- Network posting approvals
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'status', status, 'category', category, 'granted_at', granted_at
  )), '[]'::jsonb) INTO v_network_posting
  FROM sv_network_posting_approvals WHERE user_id = p_user_id;

  -- Creator permissions
  SELECT COALESCE(jsonb_build_object(
    'can_publish_video_spots', can_publish_video_spots,
    'can_create_multispot', can_create_multispot,
    'granted_at', granted_at
  ), '{}'::jsonb) INTO v_creator_perms
  FROM sv_creator_permissions WHERE user_id = p_user_id;

  -- Creator applications
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'application_type', application_type, 'status', status, 'created_at', created_at, 'reviewed_at', reviewed_at
  )), '[]'::jsonb) INTO v_creator_apps
  FROM sv_creator_applications WHERE user_id = p_user_id;

  -- Partner attributions
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'partner_slug', partner_slug, 'status', status, 'verified', verified,
    'entitlement_active', entitlement_active, 'stakekings_role', stakekings_role,
    'joined_at', joined_at, 'verified_at', verified_at
  )), '[]'::jsonb) INTO v_partner
  FROM partner_attributions WHERE user_id = p_user_id;

  -- Booking provider approval
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'status', status, 'categories', categories, 'approved_at', approved_at, 'revoked_at', revoked_at
  )), '[]'::jsonb) INTO v_booking
  FROM booking_provider_approvals WHERE account_id = p_user_id;

  -- Community entitlements
  SELECT COALESCE(jsonb_build_object(
    'tier', tier, 'is_paid_member', is_paid_member, 'member_since', member_since,
    'privileges', privileges, 'priority_weight', priority_weight
  ), '{}'::jsonb) INTO v_community
  FROM community_entitlements WHERE user_id = p_user_id;

  -- Entitlements (purchases/subscriptions)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'entitlement_type', entitlement_type, 'reference_id', reference_id, 'expires_at', expires_at
  )), '[]'::jsonb) INTO v_entitlements
  FROM sv_entitlements WHERE user_id = p_user_id;

  -- Profile + account status
  SELECT jsonb_build_object(
    'display_name', up.display_name,
    'username', up.username,
    'email', COALESCE(au.email, ''),
    'avatar_url', up.avatar_url,
    'poker_role', up.poker_role,
    'created_at', up.created_at,
    'account_status', CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END
  ) INTO v_profile
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id::text = up.user_id
  WHERE up.user_id = p_user_id;

  v_result := jsonb_build_object(
    'profile', v_profile,
    'roles', v_roles,
    'portals', v_portals,
    'capabilities', v_capabilities,
    'feed_posting', v_feed_posting,
    'network_posting', v_network_posting,
    'creator_permissions', v_creator_perms,
    'creator_applications', v_creator_apps,
    'partner', v_partner,
    'booking_provider', v_booking,
    'community', v_community,
    'entitlements', v_entitlements
  );

  RETURN v_result;
END;
$$;

-- ── Function: Search users for Access Control matrix ─────────────
CREATE OR REPLACE FUNCTION sv_staff_search_users_access(
  p_query text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  user_id text,
  display_name text,
  username text,
  email text,
  primary_role text,
  account_status text,
  has_feed_posting boolean,
  has_network_posting boolean,
  has_creator_video boolean,
  has_creator_multispot boolean,
  has_stakekings boolean,
  has_stakekings_manager boolean,
  is_booking_provider boolean,
  is_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    up.user_id,
    up.display_name,
    up.username,
    COALESCE(au.email, '') AS email,
    up.primary_role,
    CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END AS account_status,
    EXISTS(SELECT 1 FROM sv_user_capabilities c WHERE c.user_id = up.user_id AND c.capability = 'general_feed_post' AND c.status = 'active') AS has_feed_posting,
    EXISTS(SELECT 1 FROM sv_network_posting_approvals n WHERE n.user_id = up.user_id AND n.status = 'active') AS has_network_posting,
    COALESCE((SELECT can_publish_video_spots FROM sv_creator_permissions cp WHERE cp.user_id = up.user_id), false) AS has_creator_video,
    COALESCE((SELECT can_create_multispot FROM sv_creator_permissions cp WHERE cp.user_id = up.user_id), false) AS has_creator_multispot,
    EXISTS(SELECT 1 FROM partner_attributions pa WHERE pa.user_id = up.user_id AND pa.partner_slug = 'stakekings' AND pa.entitlement_active = true) AS has_stakekings,
    EXISTS(SELECT 1 FROM partner_attributions pa WHERE pa.user_id = up.user_id AND pa.partner_slug = 'stakekings' AND pa.stakekings_role = 'manager') AS has_stakekings_manager,
    EXISTS(SELECT 1 FROM booking_provider_approvals bpa WHERE bpa.account_id = up.user_id AND bpa.status = 'active') AS is_booking_provider,
    EXISTS(SELECT 1 FROM partner_attributions pa WHERE pa.user_id = up.user_id AND pa.verified = true) AS is_verified
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id::text = up.user_id
  WHERE
    p_query IS NULL
    OR p_query = ''
    OR up.display_name ILIKE '%' || p_query || '%'
    OR up.username ILIKE '%' || p_query || '%'
    OR COALESCE(au.email, '') ILIKE '%' || p_query || '%'
    OR up.user_id ILIKE '%' || p_query || '%'
  ORDER BY up.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ── Function: Get permission audit log ───────────────────────────
CREATE OR REPLACE FUNCTION sv_staff_get_permission_audit_log(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  target_user_id text,
  target_user_name text,
  permission_key text,
  permission_label text,
  previous_state text,
  new_state text,
  actor_id text,
  actor_name text,
  note text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    al.id, al.target_user_id, al.target_user_name,
    al.permission_key, al.permission_label,
    al.previous_state, al.new_state,
    al.actor_id, al.actor_name, al.note, al.created_at
  FROM sv_permission_audit_log al
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
