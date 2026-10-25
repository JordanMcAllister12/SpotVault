/*
# Fix Authentication Architecture: Staff Room RPC, Signup RLS, Partner Hub Access

## Root Causes Fixed

### 1. Staff Room "Failed to load accounts" — sv_staff_get_accounts is SECURITY INVOKER
The sv_staff_get_accounts function queries auth.users, but it runs as SECURITY INVOKER
(meaning it executes with the authenticated user's permissions). Authenticated users
do NOT have SELECT permission on auth.users — only the service role can read that table.
This causes the RPC to fail with a permission error, which the frontend shows as
"Failed to load accounts".

FIX: Recreate sv_staff_get_accounts as SECURITY DEFINER so it runs with the
function owner's privileges (postgres), which CAN read auth.users.

### 2. New account signup silently fails — missing INSERT policies on sv_roles and sv_portal_access
When a new user signs up, signUpNewUser() inserts into:
- user_profiles (has INSERT policy — works)
- sv_portal_access (NO INSERT policy — silently fails)
- sv_roles (NO INSERT policy — silently fails)

The new user gets an auth.users entry and a profile, but no roles and no portal access.
This means they can log in but can't access any portal, and Staff Room can't see their role.

FIX: Add INSERT policies on sv_roles and sv_portal_access allowing users to insert
their own row (user_id = auth.uid()).

### 3. StakeKings portals inaccessible — buildAccountFromSession doesn't query partner_hub_access
The canAccessPortal() function checks account.partnerHubAccess?.['stakekings_hub_access'],
but buildAccountFromSession() in authService.ts never queries the partner_hub_access
table. The partner_hub_access table has Tyler's StakeKings access, but it's never
loaded into the account object. Jordan's builtin DEMO_ACCOUNTS entry has
partnerHubAccess hardcoded, but when Jordan logs in via auth, the account is built
from the database — which doesn't include partnerHubAccess.

FIX: This is a frontend fix in authService.ts — add a query to partner_hub_access
in buildAccountFromSession(). No migration needed for this part.

## Security
- sv_staff_get_accounts: SECURITY DEFINER, runs as owner, already checks sv_is_staff_or_admin()
- sv_roles INSERT policy: user can only insert their own row (user_id = auth.uid())
- sv_portal_access INSERT policy: user can only insert their own row (user_id = auth.uid())
*/

-- 1. Fix sv_staff_get_accounts: make it SECURITY DEFINER
-- Must DROP first because we can't change security definer with CREATE OR REPLACE
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
SECURITY DEFINER
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

-- 2. Add INSERT policy on sv_roles — users can insert their own role row
DROP POLICY IF EXISTS "sv_roles_insert_own" ON public.sv_roles;
CREATE POLICY "sv_roles_insert_own"
ON public.sv_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Add INSERT policy on sv_portal_access — users can insert their own portal access
DROP POLICY IF EXISTS "sv_portal_access_insert_own" ON public.sv_portal_access;
CREATE POLICY "sv_portal_access_insert_own"
ON public.sv_portal_access FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Backfill the new phone account (Dylan Ellis) with player role and player portal access
-- since the signup inserts were silently blocked by RLS before this fix
INSERT INTO public.sv_roles (user_id, role, status)
VALUES ('ef8d140b-906f-4c2c-adc7-306b4b2bd3e7', 'player', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.sv_portal_access (user_id, portal_type, status)
VALUES ('ef8d140b-906f-4c2c-adc7-306b4b2bd3e7', 'player', 'active')
ON CONFLICT DO NOTHING;
