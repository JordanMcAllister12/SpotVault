/*
# Social Graph: User Search, Mutual Follow, and Relationship Status RPCs

## Purpose
Adds three SECURITY DEFINER RPCs to power the unified social relationship system:
1. `sv_search_users` — general-purpose user search by username, display name, or SV User ID
2. `sv_get_mutual_follows` — returns mutual follow relationships for a user
3. `sv_get_relationship_status` — returns the full relationship status between the caller and a target user (following, followed_by, mutual, contact, contact_pending, blocked)

## New Functions

### sv_search_users(p_query text, p_limit int DEFAULT 10)
- Searches `user_profiles` by `username` (ILIKE), `display_name` (ILIKE), or `sv_user_id` (exact or ILIKE)
- Returns: user_id, display_name, username, avatar_url, poker_role, sv_user_id, is_verified
- Does NOT expose email, phone, or any private fields
- SECURITY DEFINER so it can query profiles regardless of RLS
- Only returns users with a non-null username (prevents empty/seed accounts from cluttering results)
- Excludes the caller from results

### sv_get_mutual_follows(p_limit int DEFAULT 50)
- Returns user IDs where both A→B and B→A follow relationships are active in sv_relationships
- Returns: user_id, display_name, username, avatar_url, poker_role, sv_user_id
- SECURITY DEFINER, scoped to auth.uid()

### sv_get_relationship_status(p_target_user_id uuid)
- Returns a JSON object with: is_following, is_followed_by, is_mutual, is_contact, contact_request_pending, contact_relationship_id, is_blocked
- SECURITY DEFINER, scoped to auth.uid()
- Single-call convenience for the Profile Viewer to determine which action buttons to show

## Security
- All functions are SECURITY DEFINER with `SET search_path = public`
- No private fields (email, phone, billing) are exposed
- Only profile-level public data is returned
- All functions require authentication (auth.uid() used for caller identity)
- GRANT EXECUTE to authenticated only
*/

-- ─────────────────────────────────────────────────────────────
-- 1. General-purpose user search
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sv_search_users(p_query text, p_limit int DEFAULT 10)
RETURNS TABLE (
  user_id text,
  display_name text,
  username text,
  avatar_url text,
  poker_role text,
  sv_user_id text,
  is_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    up.user_id::text,
    up.display_name,
    up.username,
    up.avatar_url,
    up.poker_role,
    up.sv_user_id,
    up.is_verified
  FROM user_profiles up
  WHERE up.username IS NOT NULL
    AND up.user_id::text != auth.uid()::text
    AND (
      up.username ILIKE '%' || trim(p_query) || '%'
      OR up.display_name ILIKE '%' || trim(p_query) || '%'
      OR up.sv_user_id ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY
    CASE
      WHEN up.username ILIKE trim(p_query) || '%' THEN 0
      WHEN up.display_name ILIKE trim(p_query) || '%' THEN 1
      ELSE 2
    END,
    up.display_name
  LIMIT LEAST(p_limit, 25);
END;
$$;

GRANT EXECUTE ON FUNCTION sv_search_users(text, int) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Mutual follows
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sv_get_mutual_follows(p_limit int DEFAULT 50)
RETURNS TABLE (
  user_id text,
  display_name text,
  username text,
  avatar_url text,
  poker_role text,
  sv_user_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.user_id::text,
    up.display_name,
    up.username,
    up.avatar_url,
    up.poker_role,
    up.sv_user_id
  FROM sv_relationships r1
  INNER JOIN sv_relationships r2
    ON r1.user_b = r2.user_a
    AND r2.user_b = r1.user_a
    AND r2.type = 'follow'
    AND r2.status = 'active'
  INNER JOIN user_profiles up
    ON up.user_id::text = r1.user_b::text
  WHERE r1.type = 'follow'
    AND r1.status = 'active'
    AND r1.user_a = auth.uid()
  ORDER BY up.display_name
  LIMIT LEAST(p_limit, 100);
END;
$$;

GRANT EXECUTE ON FUNCTION sv_get_mutual_follows(int) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Relationship status between caller and target
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sv_get_relationship_status(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_following boolean := false;
  v_is_followed_by boolean := false;
  v_is_contact boolean := false;
  v_contact_request_pending boolean := false;
  v_contact_relationship_id uuid := null;
  v_is_blocked boolean := false;
BEGIN
  IF p_target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('is_self', true);
  END IF;

  -- Am I following them?
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'follow' AND status = 'active'
      AND user_a = auth.uid() AND user_b = p_target_user_id
  ) INTO v_is_following;

  -- Are they following me?
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'follow' AND status = 'active'
      AND user_a = p_target_user_id AND user_b = auth.uid()
  ) INTO v_is_followed_by;

  -- Is there an active contact relationship?
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'contact' AND status = 'active'
      AND ((user_a = auth.uid() AND user_b = p_target_user_id)
        OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ) INTO v_is_contact;

  -- Is there a pending contact request (either direction)?
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'contact' AND status = 'pending'
      AND ((user_a = auth.uid() AND user_b = p_target_user_id)
        OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ) INTO v_contact_request_pending;

  -- Get the contact relationship ID if one exists
  SELECT id INTO v_contact_relationship_id
  FROM sv_relationships
  WHERE type = 'contact'
    AND ((user_a = auth.uid() AND user_b = p_target_user_id)
      OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ORDER BY created_at DESC LIMIT 1;

  -- Is there a block (either direction)?
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'block' AND status = 'active'
      AND ((user_a = auth.uid() AND user_b = p_target_user_id)
        OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ) INTO v_is_blocked;

  RETURN jsonb_build_object(
    'is_self', false,
    'is_following', v_is_following,
    'is_followed_by', v_is_followed_by,
    'is_mutual', v_is_following AND v_is_followed_by,
    'is_contact', v_is_contact,
    'contact_request_pending', v_contact_request_pending,
    'contact_relationship_id', v_contact_relationship_id,
    'is_blocked', v_is_blocked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sv_get_relationship_status(uuid) TO authenticated;
