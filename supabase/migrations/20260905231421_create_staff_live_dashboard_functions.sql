-- Staff Live Dashboard: SECURITY DEFINER functions for staff-only access
-- to user accounts, platform activity, and summary metrics.
-- All functions check sv_is_staff() or sv_is_admin() before returning data.

-- Helper: check if current user is staff or admin
CREATE OR REPLACE FUNCTION public.sv_is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sv_is_staff(auth.uid()) OR sv_is_admin();
$$;

-- 1) User Accounts: paginated, searchable, sortable
-- Returns user_id, display_name, username, email, created_at, primary_role, poker_role, status
CREATE OR REPLACE FUNCTION public.sv_staff_list_users(
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  user_id text,
  display_name text,
  username text,
  email text,
  created_at timestamptz,
  primary_role text,
  poker_role text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    up.created_at,
    up.primary_role,
    up.poker_role,
    CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END AS status
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id::text = up.user_id
  WHERE
    p_search IS NULL
    OR p_search = ''
    OR up.display_name ILIKE '%' || p_search || '%'
    OR up.username ILIKE '%' || p_search || '%'
    OR COALESCE(au.email, '') ILIKE '%' || p_search || '%'
    OR up.user_id ILIKE '%' || p_search || '%'
    OR up.primary_role ILIKE '%' || p_search || '%'
  ORDER BY
    CASE WHEN p_sort = 'newest' THEN up.created_at END DESC,
    CASE WHEN p_sort = 'oldest' THEN up.created_at END ASC,
    CASE WHEN p_sort = 'alpha_az' THEN up.display_name END ASC,
    CASE WHEN p_sort = 'alpha_za' THEN up.display_name END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 1b) User count (for pagination)
CREATE OR REPLACE FUNCTION public.sv_staff_count_users(p_search text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT count(*) INTO v_count
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id::text = up.user_id
  WHERE
    p_search IS NULL
    OR p_search = ''
    OR up.display_name ILIKE '%' || p_search || '%'
    OR up.username ILIKE '%' || p_search || '%'
    OR COALESCE(au.email, '') ILIKE '%' || p_search || '%'
    OR up.user_id ILIKE '%' || p_search || '%'
    OR up.primary_role ILIKE '%' || p_search || '%';

  RETURN v_count;
END;
$$;

-- 2) Unified Activity Feed: aggregated from multiple tables
-- Returns activity_type, user_id, user_name, description, amount, platform_fee, portal, created_at
CREATE OR REPLACE FUNCTION public.sv_staff_activity_feed(
  p_filter text DEFAULT 'all',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  activity_type text,
  user_id text,
  user_name text,
  description text,
  amount numeric,
  platform_fee numeric,
  portal text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  WITH all_activity AS (
    -- Sign-ups (user_profiles created)
    SELECT
      'signup'::text AS activity_type,
      up.user_id,
      COALESCE(up.display_name, up.username, up.user_id) AS user_name,
      'New account registered' AS description,
      NULL::numeric AS amount,
      NULL::numeric AS platform_fee,
      up.primary_role AS portal,
      up.created_at
    FROM user_profiles up
    WHERE p_filter IN ('all', 'signup')

    UNION ALL

    -- Solver runs
    SELECT
      'solver'::text AS activity_type,
      sj.user_id::text,
      COALESCE(up.display_name, up.username, sj.user_id::text) AS user_name,
      'Solver run: ' || COALESCE(sj.provider, 'unknown') || ' (' || COALESCE(sj.game_type, 'nlhe') || ')' AS description,
      NULL::numeric AS amount,
      NULL::numeric AS platform_fee,
      'solver' AS portal,
      sj.created_at
    FROM solver_jobs sj
    LEFT JOIN user_profiles up ON up.user_id = sj.user_id::text
    WHERE p_filter IN ('all', 'solver')

    UNION ALL

    -- Bookings
    SELECT
      'booking'::text AS activity_type,
      b.requester_account_id,
      COALESCE(req.display_name, req.username, b.requester_account_id) AS user_name,
      'Booking: ' || COALESCE(b.service_name, 'Session') || ' (' || b.booking_status || ')' AS description,
      b.price_credits::numeric AS amount,
      b.platform_fee_credits::numeric AS platform_fee,
      COALESCE(b.service_type, 'booking') AS portal,
      b.created_at
    FROM bookings b
    LEFT JOIN user_profiles req ON req.user_id = b.requester_account_id
    WHERE p_filter IN ('all', 'booking')

    UNION ALL

    -- Spot Library purchases
    SELECT
      'spot_library'::text AS activity_type,
      jp.user_id,
      COALESCE(buyer.display_name, buyer.username, jp.user_id) AS user_name,
      'Spot Library purchase: ' || COALESCE(jp.product_id::text, 'product') AS description,
      jp.price_paid::numeric AS amount,
    (jp.price_paid * 0.2)::numeric AS platform_fee,
      'spot_library' AS portal,
      jp.purchased_at AS created_at
    FROM jukebox_purchases jp
    LEFT JOIN user_profiles buyer ON buyer.user_id = jp.user_id
    WHERE p_filter IN ('all', 'spot_library')

    UNION ALL

    -- Portal sign-ups (partner_attributions)
    SELECT
      'portal_signup'::text AS activity_type,
      pa.user_id::text,
      COALESCE(up.display_name, up.username, pa.user_id::text) AS user_name,
      'Joined portal: ' || pa.partner_slug AS description,
      NULL::numeric AS amount,
      NULL::numeric AS platform_fee,
      pa.partner_slug AS portal,
      pa.joined_at AS created_at
    FROM partner_attributions pa
    LEFT JOIN user_profiles up ON up.user_id = pa.user_id::text
    WHERE p_filter IN ('all', 'portal_signup')
  )
  SELECT * FROM all_activity
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 2b) Activity feed count
CREATE OR REPLACE FUNCTION public.sv_staff_count_activity(p_filter text DEFAULT 'all')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  WITH all_activity AS (
    SELECT 1 FROM user_profiles WHERE p_filter IN ('all', 'signup')
    UNION ALL
    SELECT 1 FROM solver_jobs WHERE p_filter IN ('all', 'solver')
    UNION ALL
    SELECT 1 FROM bookings WHERE p_filter IN ('all', 'booking')
    UNION ALL
    SELECT 1 FROM jukebox_purchases WHERE p_filter IN ('all', 'spot_library')
    UNION ALL
    SELECT 1 FROM partner_attributions WHERE p_filter IN ('all', 'portal_signup')
  )
  SELECT count(*) INTO v_count FROM all_activity;

  RETURN v_count;
END;
$$;

-- 3) Dashboard summary metrics
CREATE OR REPLACE FUNCTION public.sv_staff_dashboard_summary()
RETURNS TABLE (
  users_today bigint,
  users_total bigint,
  solver_runs_today bigint,
  solver_runs_month bigint,
  bookings_today bigint,
  bookings_total bigint,
  spot_library_sales_today bigint,
  spot_library_sales_total bigint,
  portal_signups_today bigint,
  portal_signups_total bigint,
  activity_today bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM user_profiles WHERE created_at >= date_trunc('day', now())),
    (SELECT count(*) FROM user_profiles),
    (SELECT count(*) FROM solver_jobs WHERE created_at >= date_trunc('day', now())),
    (SELECT count(*) FROM solver_jobs WHERE created_at >= date_trunc('month', now())),
    (SELECT count(*) FROM bookings WHERE created_at >= date_trunc('day', now())),
    (SELECT count(*) FROM bookings),
    (SELECT count(*) FROM jukebox_purchases WHERE purchased_at >= date_trunc('day', now())),
    (SELECT count(*) FROM jukebox_purchases),
    (SELECT count(*) FROM partner_attributions WHERE joined_at >= date_trunc('day', now())),
    (SELECT count(*) FROM partner_attributions),
    (
      (SELECT count(*) FROM user_profiles WHERE created_at >= date_trunc('day', now())) +
      (SELECT count(*) FROM solver_jobs WHERE created_at >= date_trunc('day', now())) +
      (SELECT count(*) FROM bookings WHERE created_at >= date_trunc('day', now())) +
      (SELECT count(*) FROM jukebox_purchases WHERE purchased_at >= date_trunc('day', now())) +
      (SELECT count(*) FROM partner_attributions WHERE joined_at >= date_trunc('day', now()))
    );
END;
$$;

-- Grant execute to authenticated role (RLS still enforced via sv_is_staff_or_admin check)
GRANT EXECUTE ON FUNCTION public.sv_staff_list_users(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_count_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_activity_feed(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_count_activity(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_dashboard_summary() TO authenticated;
