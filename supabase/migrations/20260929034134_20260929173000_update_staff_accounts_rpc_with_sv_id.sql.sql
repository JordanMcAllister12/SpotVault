-- ============================================================
-- Update sv_staff_get_accounts to include SV User ID
--
-- Adds sv_user_id to the return columns and search support.
-- Also adds sv_user_id to the search filter so Staff can search
-- by "SV-000001" or partial matches.
--
-- No new tables. No data changes. Only modifies the RPC function.
-- ============================================================

DROP FUNCTION IF EXISTS public.sv_staff_get_accounts(text, text, integer, integer);

CREATE FUNCTION public.sv_staff_get_accounts(
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id text,
  email text,
  display_name text,
  username text,
  role text,
  status text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  primary_role text,
  poker_role text,
  membership_tier text,
  profile_complete boolean,
  sv_user_id text
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_is_staff boolean;
BEGIN
  v_uid := auth.uid();
  v_is_staff := public.sv_is_staff_or_admin();

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Permission denied (uid=%, staff=%)', v_uid, v_is_staff;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (au.id)
    au.id::text AS user_id,
    au.email AS email,
    COALESCE(up.display_name, au.email) AS display_name,
    COALESCE(up.username, '') AS username,
    COALESCE(
      CASE
        WHEN au.raw_app_meta_data->>'role' IS NOT NULL THEN au.raw_app_meta_data->>'role'
        WHEN sr.role IS NOT NULL THEN sr.role
        ELSE 'member'
      END, 'member') AS role,
    CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END AS status,
    au.created_at AS created_at,
    au.last_sign_in_at AS last_sign_in_at,
    COALESCE(up.primary_role, 'player') AS primary_role,
    COALESCE(up.poker_role, '') AS poker_role,
    COALESCE(um.tier_id, 'free') AS membership_tier,
    (up.user_id IS NOT NULL) AS profile_complete,
    up.sv_user_id AS sv_user_id
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
  LEFT JOIN public.sv_roles sr ON sr.user_id = au.id AND sr.status = 'active'
  LEFT JOIN public.user_memberships um ON um.user_id = au.id AND um.status = 'active'
  WHERE
    p_search IS NULL OR p_search = '' OR
    au.email ILIKE '%' || p_search || '%' OR
    COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR
    au.id::text ILIKE '%' || p_search || '%' OR
    COALESCE(up.sv_user_id, '') ILIKE '%' || p_search || '%'
  ORDER BY
    au.id,
    CASE
      WHEN sr.role = 'superuser' THEN 1
      WHEN sr.role = 'staff' THEN 2
      WHEN sr.role = 'coach' THEN 3
      WHEN sr.role = 'player' THEN 4
      ELSE 99
    END,
    CASE WHEN p_sort = 'oldest' THEN au.created_at END ASC,
    CASE WHEN p_sort = 'alpha_az' THEN COALESCE(up.display_name, au.email) END ASC,
    CASE WHEN p_sort = 'alpha_za' THEN COALESCE(up.display_name, au.email) END DESC,
    CASE WHEN p_sort NOT IN ('oldest', 'alpha_az', 'alpha_za') THEN au.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION sv_staff_get_accounts(text, text, integer, integer) TO authenticated;
