/*
# Part B: Create canonical login event system
# Part C: Fix privilege escalation in sv_roles/sv_portal_access INSERT policies

## Security Fix (Part C)
The INSERT policies on sv_roles and sv_portal_access only checked auth.uid() = user_id
but did NOT restrict which role/portal values could be inserted. Any authenticated
user could INSERT ('superuser', 'active') into sv_roles for themselves.

Fix: Replace the INSERT policies with ones that restrict to 'player' role only
for sv_roles, and 'player' portal type only for sv_portal_access.

## Login Event System (Part B)
No historical login event table existed. auth.users.last_sign_in_at only stores
the most recent sign-in, not a complete history. This creates sv_auth_events
to record genuine SIGNED_IN events.

Accurate login history begins from the creation of this table.
*/

-- ============================================================
-- PART C: Fix privilege escalation in INSERT policies
-- ============================================================

-- Drop the insecure sv_roles INSERT policy
DROP POLICY IF EXISTS sv_roles_insert_own ON public.sv_roles;

-- Replace with one that only allows 'player' role for self-signup
CREATE POLICY sv_roles_insert_own ON public.sv_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'player');

-- Drop the insecure sv_portal_access INSERT policy
DROP POLICY IF EXISTS sv_portal_access_insert_own ON public.sv_portal_access;

-- Replace with one that only allows 'player' portal type for self-signup
CREATE POLICY sv_portal_access_insert_own ON public.sv_portal_access
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND portal_type = 'player');

-- ============================================================
-- PART B: Create canonical login event system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sv_auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'SIGNED_IN',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  portal text,
  device_type text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_sv_auth_events_user_id ON public.sv_auth_events (user_id);

-- Index for querying by date range (most common staff query)
CREATE INDEX IF NOT EXISTS idx_sv_auth_events_occurred_at ON public.sv_auth_events (occurred_at DESC);

-- Index for querying by user + date (to detect duplicate events)
CREATE INDEX IF NOT EXISTS idx_sv_auth_events_user_date ON public.sv_auth_events (user_id, occurred_at);

-- Enable RLS
ALTER TABLE public.sv_auth_events ENABLE ROW LEVEL SECURITY;

-- Users can see their own login events
CREATE POLICY sv_auth_events_select_own ON public.sv_auth_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own login events
CREATE POLICY sv_auth_events_insert_own ON public.sv_auth_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE for users

-- Grant permissions
GRANT SELECT ON public.sv_auth_events TO authenticated;
GRANT INSERT ON public.sv_auth_events TO authenticated;

-- ============================================================
-- RPC: Record a sign-in event (called from frontend after auth)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sv_record_sign_in(
  p_portal text DEFAULT NULL,
  p_device_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- Prevent duplicate events within the same 5-minute window
  -- This stops page refreshes, navigation, and session restoration
  -- from creating fake login events
  IF EXISTS (
    SELECT 1 FROM public.sv_auth_events
    WHERE user_id = v_uid
    AND event_type = 'SIGNED_IN'
    AND occurred_at > now() - interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.sv_auth_events (user_id, event_type, portal, device_type)
  VALUES (v_uid, 'SIGNED_IN', p_portal, p_device_type);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sv_record_sign_in TO authenticated;

-- ============================================================
-- RPC: Staff get login activity summary
-- ============================================================

CREATE OR REPLACE FUNCTION public.sv_staff_get_login_activity(
  p_period text DEFAULT 'today',
  p_date date DEFAULT NULL
)
RETURNS TABLE(
  user_id text,
  email text,
  display_name text,
  role text,
  login_count bigint,
  first_login timestamptz,
  latest_login timestamptz,
  portal text,
  device_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Determine date range
  IF p_date IS NOT NULL THEN
    v_start := p_date::timestamptz;
    v_end := (p_date + 1)::timestamptz;
  ELSIF p_period = 'today' THEN
    v_start := date_trunc('day', now());
    v_end := now();
  ELSIF p_period = 'yesterday' THEN
    v_start := date_trunc('day', now() - interval '1 day');
    v_end := date_trunc('day', now());
  ELSIF p_period = '7days' THEN
    v_start := now() - interval '7 days';
    v_end := now();
  ELSIF p_period = '30days' THEN
    v_start := now() - interval '30 days';
    v_end := now();
  ELSE
    v_start := date_trunc('day', now());
    v_end := now();
  END IF;

  RETURN QUERY
  SELECT
    au.id::text AS user_id,
    au.email::text AS email,
    COALESCE(up.display_name, au.email::text)::text AS display_name,
    COALESCE(
      CASE
        WHEN au.raw_app_meta_data->>'role' IS NOT NULL THEN au.raw_app_meta_data->>'role'
        WHEN sr.role IS NOT NULL THEN sr.role
        ELSE 'member'
      END, 'member')::text AS role,
    COUNT(e.id)::bigint AS login_count,
    MIN(e.occurred_at) AS first_login,
    MAX(e.occurred_at) AS latest_login,
    MAX(e.portal)::text AS portal,
    MAX(e.device_type)::text AS device_type
  FROM public.sv_auth_events e
  INNER JOIN auth.users au ON au.id = e.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
  LEFT JOIN public.sv_roles sr ON sr.user_id = au.id AND sr.status = 'active'
  WHERE e.event_type = 'SIGNED_IN'
    AND e.occurred_at >= v_start
    AND e.occurred_at < v_end
  GROUP BY au.id, au.email, up.display_name, au.raw_app_meta_data, sr.role
  ORDER BY MAX(e.occurred_at) DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sv_staff_get_login_activity TO authenticated;

-- ============================================================
-- RPC: Staff get login activity counts
-- ============================================================

CREATE OR REPLACE FUNCTION public.sv_staff_get_login_counts(
  p_period text DEFAULT 'today'
)
RETURNS TABLE(
  authenticated_users bigint,
  total_login_events bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_period = 'today' THEN
    v_start := date_trunc('day', now());
    v_end := now();
  ELSIF p_period = 'yesterday' THEN
    v_start := date_trunc('day', now() - interval '1 day');
    v_end := date_trunc('day', now());
  ELSIF p_period = '7days' THEN
    v_start := now() - interval '7 days';
    v_end := now();
  ELSIF p_period = '30days' THEN
    v_start := now() - interval '30 days';
    v_end := now();
  ELSE
    v_start := date_trunc('day', now());
    v_end := now();
  END IF;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT e.user_id)::bigint AS authenticated_users,
    COUNT(e.id)::bigint AS total_login_events
  FROM public.sv_auth_events e
  WHERE e.event_type = 'SIGNED_IN'
    AND e.occurred_at >= v_start
    AND e.occurred_at < v_end;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sv_staff_get_login_counts TO authenticated;
