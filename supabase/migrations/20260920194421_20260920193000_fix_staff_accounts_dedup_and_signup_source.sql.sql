-- Fix 1: Deduplicate sv_staff_get_accounts so users with multiple sv_roles (e.g. Bryan: staff+coach+player)
-- produce exactly ONE row per auth.users UUID.
-- Fix 2: Change sv_staff_activity_feed signup events to use auth.users.created_at (actual account registration)
-- instead of user_profiles.created_at (profile row creation/recreation).

-- ── sv_staff_get_accounts ──────────────────────────────────────
-- Replace the function body to use DISTINCT ON (au.id) so only one row per auth user is returned.
-- The role column picks the most privileged role via a priority subquery.

CREATE OR REPLACE FUNCTION public.sv_staff_get_accounts(
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
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
SECURITY INVOKER
SET search_path = public
AS $$
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
    COALESCE(um.tier_id, 'free') AS membership_tier
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
$$;

-- ── sv_staff_activity_feed ─────────────────────────────────────
-- Change signup events to read from auth.users.created_at (actual account registration)
-- instead of user_profiles.created_at (profile row creation/recreation).
-- Profile recreation (e.g. Jordan's Sep 19 profile rebuild) should NOT appear as "NEW SIGN UP".

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
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  WITH all_activity AS (
    -- Sign-ups: use auth.users.created_at (actual account registration date)
    SELECT
      'signup'::text AS activity_type,
      au.id::text AS user_id,
      COALESCE(up.display_name, up.username, au.email) AS user_name,
      'New account registered' AS description,
      NULL::numeric AS amount,
      NULL::numeric AS platform_fee,
      COALESCE(up.primary_role, 'member') AS portal,
      au.created_at AS created_at
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
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
    FROM public.solver_jobs sj
    LEFT JOIN public.user_profiles up ON up.user_id = sj.user_id::text
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
    FROM public.bookings b
    LEFT JOIN public.user_profiles req ON req.user_id = b.requester_account_id
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
    FROM public.jukebox_purchases jp
    LEFT JOIN public.user_profiles buyer ON buyer.user_id = jp.user_id
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
    FROM public.partner_attributions pa
    LEFT JOIN public.user_profiles up ON up.user_id = pa.user_id::text
    WHERE p_filter IN ('all', 'portal_signup')
  )
  SELECT * FROM all_activity
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
