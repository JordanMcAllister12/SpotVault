/*
# Fix Staff RPC execute grants and search_path

## Problem
All staff RPCs (sv_staff_get_accounts, sv_staff_get_login_activity, sv_staff_get_login_counts, sv_staff_get_traffic, sv_is_staff_or_admin) were missing EXECUTE grants for the `authenticated` role. This caused "PERMISSION DENIED" errors when Staff Console tried to call them.

Additionally, sv_staff_get_traffic was missing `SET search_path TO 'public'`.

## Changes
1. GRANT EXECUTE on all 5 staff RPCs to `authenticated`
2. Recreate sv_staff_get_traffic with SECURITY DEFINER + SET search_path TO 'public'
3. No data changes, no schema changes
*/

GRANT EXECUTE ON FUNCTION public.sv_staff_get_accounts TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_get_login_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_get_login_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_is_staff_or_admin TO authenticated;

-- Fix sv_staff_get_traffic: add search_path and grant
GRANT EXECUTE ON FUNCTION public.sv_staff_get_traffic TO authenticated;

-- Recreate sv_staff_get_traffic with proper search_path if it doesn't have one
DO $$
BEGIN
  -- Only recreate if the function doesn't have search_path set
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'sv_staff_get_traffic' AND n.nspname = 'public'
    AND p.proconfig IS NOT NULL AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
  ) THEN
    -- The function body is preserved; we just add SET search_path
    ALTER FUNCTION public.sv_staff_get_traffic SECURITY DEFINER;
    ALTER FUNCTION public.sv_staff_get_traffic SET search_path TO 'public';
  END IF;
END $$;
