/*
# Staff: List Real Auth Users

1. Purpose
   - Staff portal needs to display real registered platform users (from auth.users)
   - auth.users is not accessible via RLS to the frontend anon/authenticated role
   - This SECURITY DEFINER function lets authenticated staff list real users with their profile data

2. New Functions
   - `staff_list_real_users()` — returns a table of real auth users joined with user_profiles
   - Columns: user_id, email, display_name, username, poker_role, primary_role, role, created_at, last_sign_in_at
   - `role` comes from raw_app_meta_data (the authoritative source for auth role)
   - Only callable by authenticated users (staff are authenticated)

3. Security
   - SECURITY DEFINER — runs with the function owner's privileges to read auth.users
   - EXECUTE granted to `authenticated` role only
   - Returns read-only data — no mutations
   - Does NOT expose passwords, tokens, or sensitive auth metadata
*/

CREATE OR REPLACE FUNCTION public.staff_list_real_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  poker_role text,
  primary_role text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  LEFT JOIN public.user_profiles p ON p.user_id::text = u.id::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_list_real_users() TO authenticated;
