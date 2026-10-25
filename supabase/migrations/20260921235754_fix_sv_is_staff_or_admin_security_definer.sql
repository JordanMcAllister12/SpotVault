/*
# Fix sv_is_staff_or_admin: make it SECURITY DEFINER

## Root Cause
sv_staff_get_accounts is SECURITY DEFINER (runs as postgres) but calls
sv_is_staff_or_admin() which is SECURITY INVOKER (runs as the authenticated user).
While the authenticated user CAN read their own sv_roles row via RLS,
this creates a fragile dependency on RLS policies during the staff check.

Making sv_is_staff_or_admin SECURITY DEFINER means it runs as postgres
(who bypasses RLS) and can reliably check the caller's role regardless
of RLS state. The function still uses auth.uid() to identify the caller.

## Security
- The function only reads sv_roles (no writes)
- It uses auth.uid() to identify the caller
- Returns a boolean, not role data
*/

CREATE OR REPLACE FUNCTION public.sv_is_staff_or_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser')
    AND status = 'active'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sv_is_staff_or_admin() TO authenticated;
