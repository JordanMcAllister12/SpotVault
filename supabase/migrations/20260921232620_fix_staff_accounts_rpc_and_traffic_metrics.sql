/*
# Fix Staff Room Account Source and Traffic Metrics

## Problem
1. sv_staff_get_traffic counts ALL page_views rows as "visits" — but these are individual page view events,
   not unique visitors or sessions. The metric labeled "today: 16" means "16 page view events today",
   not "16 unique visitors".
2. The page_views table has no column to distinguish authenticated vs anonymous visitors, or bots.
3. sv_staff_get_accounts doesn't flag users with missing profiles.

## Changes
1. Add columns to page_views: is_authenticated, user_agent, referrer
2. DROP and recreate sv_staff_get_traffic with unique visitor counts, page view counts, and bot exclusion
3. DROP and recreate sv_staff_get_accounts with profile_complete flag

## Security
- All RPCs require sv_is_staff_or_admin()
- No RLS changes
*/

-- 1. Add columns to page_views
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS is_authenticated boolean DEFAULT false;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS referrer text;

-- 2. Drop and recreate sv_staff_get_traffic with better metrics
DROP FUNCTION IF EXISTS public.sv_staff_get_traffic();

CREATE FUNCTION public.sv_staff_get_traffic()
RETURNS TABLE(
  today bigint,
  last_7_days bigint,
  last_30_days bigint,
  total bigint,
  page_views_today bigint,
  page_views_total bigint,
  authenticated_today bigint,
  daily jsonb,
  weekly jsonb,
  monthly jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    -- Unique visitors (by visitor_id) today, excluding bots
    (SELECT count(DISTINCT visitor_id) FROM public.page_views
      WHERE created_at >= date_trunc('day', now())
      AND (user_agent IS NULL OR (user_agent NOT ILIKE '%bot%' AND user_agent NOT ILIKE '%crawler%' AND user_agent NOT ILIKE '%spider%'))
    )::bigint,
    -- Unique visitors last 7 days
    (SELECT count(DISTINCT visitor_id) FROM public.page_views
      WHERE created_at >= date_trunc('day', now() - interval '6 days')
      AND (user_agent IS NULL OR (user_agent NOT ILIKE '%bot%' AND user_agent NOT ILIKE '%crawler%' AND user_agent NOT ILIKE '%spider%'))
    )::bigint,
    -- Unique visitors last 30 days
    (SELECT count(DISTINCT visitor_id) FROM public.page_views
      WHERE created_at >= date_trunc('day', now() - interval '29 days')
      AND (user_agent IS NULL OR (user_agent NOT ILIKE '%bot%' AND user_agent NOT ILIKE '%crawler%' AND user_agent NOT ILIKE '%spider%'))
    )::bigint,
    -- Total unique visitors
    (SELECT count(DISTINCT visitor_id) FROM public.page_views
      WHERE (user_agent IS NULL OR (user_agent NOT ILIKE '%bot%' AND user_agent NOT ILIKE '%crawler%' AND user_agent NOT ILIKE '%spider%'))
    )::bigint,
    -- Page views today (all events)
    (SELECT count(*) FROM public.page_views WHERE created_at >= date_trunc('day', now()))::bigint,
    -- Total page views
    (SELECT count(*) FROM public.page_views)::bigint,
    -- Authenticated visitors today
    (SELECT count(DISTINCT visitor_id) FROM public.page_views WHERE created_at >= date_trunc('day', now()) AND is_authenticated = true)::bigint,
    -- Daily unique visitors (last 30 days)
    (
      SELECT jsonb_agg(jsonb_build_object('date', d::date::text, 'visits', v))
      FROM (
        SELECT d::date, count(DISTINCT pv.visitor_id) AS v
        FROM generate_series(date_trunc('day', now() - interval '29 days'), date_trunc('day', now()), '1 day') d
        LEFT JOIN public.page_views pv ON date_trunc('day', pv.created_at) = d
          AND (pv.user_agent IS NULL OR (pv.user_agent NOT ILIKE '%bot%' AND pv.user_agent NOT ILIKE '%crawler%' AND pv.user_agent NOT ILIKE '%spider%'))
        GROUP BY d::date
        ORDER BY d::date
      ) daily_data
    ),
    -- Weekly unique visitors (last 12 weeks)
    (
      SELECT jsonb_agg(jsonb_build_object('week_start', w::date::text, 'visits', v))
      FROM (
        SELECT w::date, count(DISTINCT pv.visitor_id) AS v
        FROM generate_series(date_trunc('week', now() - interval '11 weeks'), date_trunc('week', now()), '1 week') w
        LEFT JOIN public.page_views pv ON date_trunc('week', pv.created_at) = w
          AND (pv.user_agent IS NULL OR (pv.user_agent NOT ILIKE '%bot%' AND pv.user_agent NOT ILIKE '%crawler%' AND pv.user_agent NOT ILIKE '%spider%'))
        GROUP BY w::date
        ORDER BY w::date
      ) weekly_data
    ),
    -- Monthly unique visitors (last 12 months)
    (
      SELECT jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'visits', v))
      FROM (
        SELECT m, count(DISTINCT pv.visitor_id) AS v
        FROM generate_series(date_trunc('month', now() - interval '11 months'), date_trunc('month', now()), '1 month') m
        LEFT JOIN public.page_views pv ON date_trunc('month', pv.created_at) = m
          AND (pv.user_agent IS NULL OR (pv.user_agent NOT ILIKE '%bot%' AND pv.user_agent NOT ILIKE '%crawler%' AND pv.user_agent NOT ILIKE '%spider%'))
        GROUP BY m
        ORDER BY m
      ) monthly_data
    );
END;
$function$;

-- 3. Drop and recreate sv_staff_get_accounts with profile_complete flag
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
  profile_complete boolean
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
    (up.user_id IS NOT NULL) AS profile_complete
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
  LEFT JOIN public.sv_roles sr ON sr.user_id = au.id AND sr.status = 'active'
  LEFT JOIN public.user_memberships um ON um.user_id = au.id AND um.status = 'active'
  WHERE
    p_search IS NULL OR p_search = '' OR
    au.email ILIKE '%' || p_search || '%' OR
    COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR
    au.id::text ILIKE '%' || p_search || '%'
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
