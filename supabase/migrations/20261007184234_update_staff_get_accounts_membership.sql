/*
# Update sv_staff_get_accounts to show override-aware membership

Drop and recreate sv_staff_get_accounts so membership_tier reflects:
1. membership_overrides (highest)
2. user_memberships (Stripe)
3. role-based elite (staff/superuser)
4. free/player (default)
*/

DROP FUNCTION IF EXISTS sv_staff_get_accounts(text, text, integer, integer);

CREATE FUNCTION sv_staff_get_accounts(
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  role text,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  primary_role text,
  poker_role text,
  membership_tier text,
  profile_complete boolean,
  sv_user_id text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (au.id)
    au.id AS user_id,
    au.email::text AS email,
    COALESCE(up.display_name, au.email::text)::text AS display_name,
    COALESCE(up.username, '')::text AS username,
    COALESCE(
      CASE
        WHEN sr_superuser.role IS NOT NULL THEN 'superuser'
        WHEN sr_staff.role IS NOT NULL THEN 'staff'
        ELSE 'user'
      END, 'user'
    )::text AS role,
    CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END::text AS status,
    au.created_at AS created_at,
    au.last_sign_in_at AS last_sign_in_at,
    COALESCE(up.primary_role, 'player')::text AS primary_role,
    COALESCE(up.poker_role, '')::text AS poker_role,
    COALESCE(
      mo.tier,
      CASE
        WHEN um.tier_id IS NOT NULL AND um.status = 'active' THEN
          CASE WHEN um.tier_id = 'player' THEN 'free' ELSE um.tier_id END
        WHEN sr_superuser.role IS NOT NULL THEN 'elite'
        WHEN sr_staff.role IS NOT NULL THEN 'elite'
        ELSE 'free'
      END
    )::text AS membership_tier,
    (up.user_id IS NOT NULL) AS profile_complete,
    COALESCE(up.sv_user_id, '')::text AS sv_user_id
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
  LEFT JOIN public.sv_roles sr_superuser ON sr_superuser.user_id = au.id AND sr_superuser.role = 'superuser' AND sr_superuser.status = 'active'
  LEFT JOIN public.sv_roles sr_staff ON sr_staff.user_id = au.id AND sr_staff.role = 'staff' AND sr_staff.status = 'active'
  LEFT JOIN public.user_memberships um ON um.user_id = au.id AND um.status = 'active'
  LEFT JOIN public.membership_overrides mo ON mo.user_id = au.id
  WHERE
    p_search IS NULL OR p_search = '' OR
    au.email ILIKE '%' || p_search || '%' OR
    COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR
    au.id::text ILIKE '%' || p_search || '%' OR
    COALESCE(up.sv_user_id, '') ILIKE '%' || p_search || '%'
  ORDER BY
    au.id,
    CASE WHEN sr_superuser.role IS NOT NULL THEN 1
         WHEN sr_staff.role IS NOT NULL THEN 2
         ELSE 99 END,
    CASE WHEN p_sort = 'oldest' THEN au.created_at END ASC,
    CASE WHEN p_sort = 'alpha_az' THEN COALESCE(up.display_name, au.email::text) END ASC,
    CASE WHEN p_sort = 'alpha_za' THEN COALESCE(up.display_name, au.email::text) END DESC,
    CASE WHEN p_sort NOT IN ('oldest', 'alpha_az', 'alpha_za') THEN au.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
