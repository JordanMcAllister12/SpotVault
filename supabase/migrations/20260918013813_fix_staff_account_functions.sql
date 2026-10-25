/*
# Fix staff account functions and traffic summary

1. staff_list_real_users()
   - Add sv_is_staff_or_admin() permission check (was missing — returned auth emails to anyone)
   - Keep SECURITY DEFINER so it can read auth.users
   - Return type unchanged

2. staff_traffic_summary()
   - Fix return type: return individual columns instead of relying on JSONB parsing
   - The daily breakdown returns as JSONB which the Supabase JS client may not parse
   - Change to return daily as a text column containing JSON, so the client can JSON.parse it
   - Actually, the issue is that the function returns a single row with a JSONB column,
     but the Supabase client wraps it in an array. Fix the frontend to handle this.
   - The real fix: ensure numeric columns are bigint, not numeric, so they don't become NaN

3. sv_staff_list_users()
   - Already has permission check via sv_is_staff_or_admin()
   - The function works correctly when the caller has staff role
   - No changes needed to the function itself

4. sv_staff_count_users()
   - Same as above — works when caller has staff role
   - No changes needed
*/

-- Fix staff_list_real_users: add permission check
CREATE OR REPLACE FUNCTION public.staff_list_real_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  username text,
  poker_role text,
  primary_role text,
  role text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email,
    p.display_name,
    p.username,
    p.poker_role,
    p.primary_role,
    COALESCE(u.raw_app_meta_data->>'role', 'authenticated') AS role,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.user_id::text = u.id::text
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_list_real_users() TO authenticated;

-- Fix staff_traffic_summary: ensure proper return types
CREATE OR REPLACE FUNCTION public.staff_traffic_summary()
RETURNS TABLE(
  today bigint,
  last_7_days bigint,
  last_30_days bigint,
  daily jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today bigint;
  v_7d bigint;
  v_30d bigint;
  v_daily jsonb;
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;

  SELECT count(*)::bigint INTO v_today
  FROM page_views
  WHERE created_at >= date_trunc('day', now());

  SELECT count(*)::bigint INTO v_7d
  FROM page_views
  WHERE created_at >= now() - interval '7 days';

  SELECT count(*)::bigint INTO v_30d
  FROM page_views
  WHERE created_at >= now() - interval '30 days';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d::text, 'visits', c) ORDER BY d), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT date_trunc('day', created_at)::date AS d, count(*)::bigint AS c
    FROM page_views
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1
  ) t;

  RETURN QUERY SELECT v_today, v_7d, v_30d, v_daily;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_traffic_summary() TO authenticated;
