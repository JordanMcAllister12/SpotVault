/*
# Fix sv_is_staff_or_admin() — SECURITY INVOKER so auth.uid() resolves correctly

## Problem
The `sv_is_staff_or_admin()` function was marked SECURITY DEFINER, which means
it runs with the privileges of the function owner (postgres). Inside a SECURITY
DEFINER function, `auth.uid()` returns NULL because the function is not executing
as the calling user — it's executing as postgres. This caused every call to
`sv_staff_get_accounts` to fail with "Permission denied (uid=<NULL>, staff=f)",
which surfaced in the Staff Room UI as "Failed to load accounts".

## Fix
Use CREATE OR REPLACE to change the function from SECURITY DEFINER to
SECURITY INVOKER. This allows auth.uid() to resolve to the actual calling
user. We cannot DROP the function because RLS policies on multiple tables
depend on it, so CREATE OR REPLACE is the only safe path.

Note: CREATE OR REPLACE cannot change the SECURITY attribute if the function
body language differs. Since the existing function is `LANGUAGE sql`, we
use the same language. However, CREATE OR REPLACE for a sql function cannot
change the SECURITY attribute. So we use a PL/pgSQL wrapper approach:
we recreate it as a plpgsql function with SECURITY INVOKER.

Actually, CREATE OR REPLACE FUNCTION can change the SECURITY attribute
for the same function signature. Let's try that.
*/

-- 1. Replace the guard function with SECURITY INVOKER
-- Must use plpgsql since we need to change security attribute
CREATE OR REPLACE FUNCTION public.sv_is_staff_or_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser')
    AND status = 'active'
  );
END;
$$;

-- 2. Re-grant execute
GRANT EXECUTE ON FUNCTION public.sv_is_staff_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_is_staff_or_admin() TO anon;
