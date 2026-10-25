/*
# Fix RLS infinite recursion between content_spots and content_access_grants

## Problem
The previous migration (20261002120000) added a subquery to content_spots SELECT policy
that checks content_access_grants. But content_access_grants has its own SELECT policy
that checks content_spots.account_id — creating infinite recursion.

## Fix
1. Create a SECURITY DEFINER function sv_user_has_spot_access(p_user_id, p_spot_id)
   that checks content_access_grants bypassing RLS. This breaks the circular dependency.

2. Use this function in the content_spots SELECT policy instead of the inline subquery.

3. Simplify the content_access_grants SELECT policy to just auth.uid() = user_id
   (removing the reference to content_spots that caused the other side of the cycle).

## Functions Created
- sv_user_has_spot_access(uuid, uuid) — SECURITY DEFINER, returns boolean

## Tables Modified
- content_spots — SELECT policy updated to use the new function
- content_access_grants — SELECT policy simplified to break recursion

## Security
- The SECURITY DEFINER function only reads content_access_grants (no writes).
- It is granted to authenticated and anon roles.
- Private content isolation is maintained: only owners and users with explicit grants
  can see private spots.
*/
-- ============================================================
-- Create security definer function to check spot access
-- ============================================================

CREATE OR REPLACE FUNCTION public.sv_user_has_spot_access(p_user_id uuid, p_spot_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM content_access_grants
    WHERE content_spot_id = p_spot_id
      AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.sv_user_has_spot_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_user_has_spot_access(uuid, uuid) TO anon;

-- ============================================================
-- Update content_spots SELECT policy to use the function
-- ============================================================

DROP POLICY IF EXISTS "select_content_spots" ON content_spots;
CREATE POLICY "select_content_spots"
  ON content_spots FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR account_id = auth.uid()::text
    OR public.sv_user_has_spot_access(auth.uid(), content_spots.id)
    OR public.sv_is_staff_or_admin()
  );

-- ============================================================
-- Simplify content_access_grants SELECT to break recursion
-- ============================================================

DROP POLICY IF EXISTS "select_own_access_grants" ON content_access_grants;
CREATE POLICY "select_own_access_grants"
  ON content_access_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
