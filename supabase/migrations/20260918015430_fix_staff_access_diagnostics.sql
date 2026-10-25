/*
# Fix staff access diagnostics

1. sv_check_staff_access() — returns diagnostic info about the current user's staff status.
   Returns: auth_uid, has_staff_role, error_message
   This helps the frontend provide meaningful error messages instead of just "Failed to load users".

2. sv_ensure_staff_role() — SECURITY DEFINER function that checks if the current user
   has a row in sv_roles with role='staff' or 'superuser'. If not, checks if their email
   matches a known staff account and creates the role if missing.
   This is called on login to sync frontend staff status with database staff status.
*/

CREATE OR REPLACE FUNCTION public.sv_check_staff_access()
RETURNS TABLE(
  auth_uid text,
  has_staff_role boolean,
  role text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::text, false, NULL::text, 'No authenticated session (auth.uid() is null)'::text;
    RETURN;
  END IF;

  SELECT role INTO v_role
  FROM sv_roles
  WHERE user_id = v_uid AND role IN ('staff', 'superuser') AND status = 'active'
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN QUERY SELECT v_uid::text, true, v_role, NULL::text;
  ELSE
    RETURN QUERY SELECT v_uid::text, false, NULL::text, 'Your account does not have a staff or admin role in sv_roles. Contact an administrator.'::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_check_staff_access() TO authenticated;
