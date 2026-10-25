/*
# Fix Community Posting + Add Network Posting Approval System

## 1. Fix sv_can_post_general_feed()
The current function only allows posting if the user has an explicit
'general_feed_post' capability or a staff/superuser/admin/owner role.
This incorrectly blocks Core+ members from posting to the Community feed.

Updated logic:
- Staff/superuser/admin/owner can always post (unchanged)
- Users with explicit 'general_feed_post' capability can post (unchanged)
- Users with ANY active portal access (coach, stable, business, creator) can post
  (these represent paid memberships — Core and above)
- Users with any active non-player role can post

This means: Free users (no portal access, no roles, no capability) cannot post.
Core+ members (any active portal access or role) can post without manual approval.

## 2. Add network_post capability for Industry Wire / SpotVault Network posting
- Uses the existing sv_user_capabilities table
- Adds 'network_post' as a capability value
- Creates sv_can_post_network() RPC function to check this
- Creates sv_grant_network_posting() and sv_revoke_network_posting() for staff
- Creates sv_get_network_posting_approvals() to list all approved users
- Creates sv_search_users_for_network_approval() for staff search

## 3. Security
- All functions are SECURITY DEFINER
- Grant/revoke functions restricted to staff roles
- Read functions available to authenticated users
*/

-- ============================================================
-- 1. Fix sv_can_post_general_feed() — allow Core+ members
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_can_post_general_feed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  -- Check explicit capability
  EXISTS (
    SELECT 1 FROM sv_user_capabilities
    WHERE user_id = auth.uid()
    AND capability = 'general_feed_post'
    AND status = 'active'
  )
  -- Check staff/superuser roles
  OR EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  )
  -- Check any active portal access (Core+ membership indicator)
  OR EXISTS (
    SELECT 1 FROM sv_portal_access
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND portal_type IN ('coach', 'stable', 'business', 'creator')
  )
  -- Check any active non-player role
  OR EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role NOT IN ('player')
    AND status = 'active'
  );
$function$;

REVOKE EXECUTE ON FUNCTION sv_can_post_general_feed FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_general_feed TO authenticated;

-- ============================================================
-- 2. Network posting capability functions
-- ============================================================

-- Check if current user can post to Network/Industry Wire
CREATE OR REPLACE FUNCTION public.sv_can_post_network()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  -- Explicit network_post capability
  EXISTS (
    SELECT 1 FROM sv_user_capabilities
    WHERE user_id = auth.uid()
    AND capability = 'network_post'
    AND status = 'active'
  )
  -- Staff can always post
  OR EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  );
$function$;

REVOKE EXECUTE ON FUNCTION sv_can_post_network FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_network TO authenticated;

-- Grant network posting capability (staff only)
CREATE OR REPLACE FUNCTION public.sv_grant_network_posting(
  p_target_user_id uuid,
  p_category text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_staff boolean;
  v_existing_id uuid;
BEGIN
  -- Check if caller is staff
  SELECT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Only staff can grant network posting permission';
  END IF;

  -- Check if capability already exists
  SELECT id INTO v_existing_id FROM sv_user_capabilities
  WHERE user_id = p_target_user_id AND capability = 'network_post';

  IF v_existing_id IS NOT NULL THEN
    -- Reactivate if revoked
    UPDATE sv_user_capabilities
    SET status = 'active', revoked_at = NULL, revoked_by = NULL,
        granted_by = auth.uid(), granted_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by)
    VALUES (p_target_user_id, 'network_post', 'active', auth.uid());
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION sv_grant_network_posting FROM anon;
GRANT EXECUTE ON FUNCTION sv_grant_network_posting TO authenticated;

-- Revoke network posting capability (staff only)
CREATE OR REPLACE FUNCTION public.sv_revoke_network_posting(
  p_target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Only staff can revoke network posting permission';
  END IF;

  UPDATE sv_user_capabilities
  SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
  WHERE user_id = p_target_user_id AND capability = 'network_post';

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION sv_revoke_network_posting FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_network_posting TO authenticated;

-- List all users with network posting capability (staff only)
CREATE OR REPLACE FUNCTION public.sv_get_network_posting_approvals()
RETURNS TABLE (
  user_id uuid,
  status text,
  category text,
  granted_at timestamptz,
  granted_by uuid,
  revoked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Only staff can view network posting approvals';
  END IF;

  RETURN QUERY
  SELECT
    uc.user_id,
    uc.status,
    NULL::text AS category,
    uc.granted_at,
    uc.granted_by,
    uc.revoked_at
  FROM sv_user_capabilities uc
  WHERE uc.capability = 'network_post'
  ORDER BY uc.granted_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION sv_get_network_posting_approvals FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_network_posting_approvals TO authenticated;

-- Search users for network posting approval (staff only)
CREATE OR REPLACE FUNCTION public.sv_search_users_for_network_approval(
  p_query text
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  poker_role text,
  is_approved boolean,
  has_membership boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser', 'admin', 'owner')
    AND status = 'active'
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Only staff can search users for approval';
  END IF;

  RETURN QUERY
  SELECT
    p.account_id,
    p.display_name,
    p.username,
    p.poker_role,
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id = p.account_id
      AND capability = 'network_post'
      AND status = 'active'
    ) AS is_approved,
    EXISTS (
      SELECT 1 FROM sv_portal_access
      WHERE user_id = p.account_id
      AND status = 'active'
    ) AS has_membership
  FROM user_profiles p
  WHERE
    p.display_name ILIKE '%' || p_query || '%'
    OR p.username ILIKE '%' || p_query || '%'
    OR p.account_id::text ILIKE '%' || p_query || '%'
  ORDER BY p.display_name
  LIMIT 50;
END;
$function$;

REVOKE EXECUTE ON FUNCTION sv_search_users_for_network_approval FROM anon;
GRANT EXECUTE ON FUNCTION sv_search_users_for_network_approval TO authenticated;
