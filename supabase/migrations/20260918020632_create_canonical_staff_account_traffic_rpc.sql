/*
# Canonical Staff Account + Traffic Analytics

## 1. sv_staff_get_accounts — ONE canonical user list RPC
Replaces both staff_list_real_users and sv_staff_list_users.
Starts from auth.users (so ALL registered accounts are visible) LEFT JOIN user_profiles.
Returns: user_id, email, display_name, username, role, status, created_at, last_sign_in_at,
        primary_role, poker_role, membership_tier
Supports: search, sort, pagination

## 2. sv_staff_get_accounts_count — count for pagination

## 3. sv_staff_get_traffic — canonical traffic RPC with day/week/month granularity
Replaces staff_traffic_summary. Returns daily, weekly, and monthly aggregates.
*/
CREATE OR REPLACE FUNCTION public.sv_staff_get_accounts(
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
  created_at timestamptz,
  last_sign_in_at timestamptz,
  primary_role text,
  poker_role text,
  membership_tier text
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
    COALESCE(um.tier_id, 'free') AS membership_tier
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.user_id = au.id::text
  LEFT JOIN sv_roles sr ON sr.user_id = au.id AND sr.status = 'active'
  LEFT JOIN user_memberships um ON um.user_id = au.id AND um.status = 'active'
  WHERE
    p_search IS NULL OR p_search = '' OR
    au.email ILIKE '%' || p_search || '%' OR
    COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR
    au.id::text ILIKE '%' || p_search || '%'
  ORDER BY
    CASE WHEN p_sort = 'oldest' THEN au.created_at END ASC,
    CASE WHEN p_sort = 'alpha_az' THEN COALESCE(up.display_name, au.email) END ASC,
    CASE WHEN p_sort = 'alpha_za' THEN COALESCE(up.display_name, au.email) END DESC,
    CASE WHEN p_sort NOT IN ('oldest', 'alpha_az', 'alpha_za') THEN au.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_staff_get_accounts TO authenticated;

-- Count function for pagination
CREATE OR REPLACE FUNCTION public.sv_staff_get_accounts_count(
  p_search text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN (
    SELECT count(*)
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.user_id = au.id::text
    WHERE
      p_search IS NULL OR p_search = '' OR
      au.email ILIKE '%' || p_search || '%' OR
      COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR
      COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR
      au.id::text ILIKE '%' || p_search || '%'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_staff_get_accounts_count TO authenticated;

-- Canonical traffic RPC with day/week/month granularity
CREATE OR REPLACE FUNCTION public.sv_staff_get_traffic()
RETURNS TABLE(
  today bigint,
  last_7_days bigint,
  last_30_days bigint,
  total bigint,
  daily jsonb,
  weekly jsonb,
  monthly jsonb
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
    (SELECT count(*) FROM page_views WHERE created_at >= date_trunc('day', now()))::bigint,
    (SELECT count(*) FROM page_views WHERE created_at >= date_trunc('day', now() - interval '6 days'))::bigint,
    (SELECT count(*) FROM page_views WHERE created_at >= date_trunc('day', now() - interval '29 days'))::bigint,
    (SELECT count(*) FROM page_views)::bigint,
    (
      SELECT jsonb_agg(jsonb_build_object('date', d::date::text, 'visits', v))
      FROM (
        SELECT d::date, count(pv.id) AS v
        FROM generate_series(date_trunc('day', now() - interval '29 days'), date_trunc('day', now()), '1 day') d
        LEFT JOIN page_views pv ON date_trunc('day', pv.created_at) = d
        GROUP BY d::date
        ORDER BY d::date
      ) daily_data
    ),
    (
      SELECT jsonb_agg(jsonb_build_object('week_start', w::date::text, 'visits', v))
      FROM (
        SELECT w::date, count(pv.id) AS v
        FROM generate_series(date_trunc('week', now() - interval '11 weeks'), date_trunc('week', now()), '1 week') w
        LEFT JOIN page_views pv ON date_trunc('week', pv.created_at) = w
        GROUP BY w::date
        ORDER BY w::date
      ) weekly_data
    ),
    (
      SELECT jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'visits', v))
      FROM (
        SELECT m, count(pv.id) AS v
        FROM generate_series(date_trunc('month', now() - interval '11 months'), date_trunc('month', now()), '1 month') m
        LEFT JOIN page_views pv ON date_trunc('month', pv.created_at) = m
        GROUP BY m
        ORDER BY m
      ) monthly_data
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_staff_get_traffic TO authenticated;
