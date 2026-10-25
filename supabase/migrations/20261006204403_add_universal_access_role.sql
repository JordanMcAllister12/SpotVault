/*
# Add universal_access role and sv_has_universal_access() function

## Purpose
Creates a centralized "universal access" permission system that bypasses
all product-tier and subscription gates. Two accounts will hold this:
  - Jordan (superuser) — already gets universal access via superuser role
  - Donnelle — gets a new `universal_access` role in sv_roles

## Changes
1. Expands sv_roles check constraint to include 'universal_access'
2. Creates SECURITY DEFINER function sv_has_universal_access() that returns
   true when the authenticated user has 'superuser' OR 'universal_access'
   role with status='active'. This is the single DB-level check.
3. Grants EXECUTE on the function to authenticated role.
4. Inserts 'universal_access' role for Donnelle's existing account
   (ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32).

## Security
- The function is SECURITY DEFINER (owned by postgres) so it can read
  sv_roles regardless of the caller's RLS.
- It only checks roles, never grants write access or bypasses RLS on
  data tables.
- Universal access means product/feature gates are bypassed, NOT that
  RLS is disabled or that destructive admin powers are granted.
*/

-- 1. Expand check constraint to allow 'universal_access'
ALTER TABLE public.sv_roles DROP CONSTRAINT IF EXISTS sv_roles_role_check;
ALTER TABLE public.sv_roles ADD CONSTRAINT sv_roles_role_check
  CHECK (role = ANY (ARRAY[
    'player', 'coach', 'creator', 'investor', 'stable_operator',
    'business', 'staff', 'superuser', 'admin', 'owner', 'moderator',
    'universal_access'
  ]));

-- 2. Create centralized DB function
CREATE OR REPLACE FUNCTION public.sv_has_universal_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = auth.uid()
      AND role IN ('superuser', 'universal_access')
      AND status = 'active'
  );
END;
$$;

-- 3. Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.sv_has_universal_access() TO authenticated;

-- 4. Insert universal_access role for Donnelle (ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32)
INSERT INTO public.sv_roles (user_id, role, status)
VALUES ('ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32', 'universal_access', 'active')
ON CONFLICT (user_id, role) DO NOTHING;
