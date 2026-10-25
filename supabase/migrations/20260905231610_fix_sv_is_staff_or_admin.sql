-- Fix sv_is_staff_or_admin to check sv_roles directly instead of relying on sv_is_admin
-- (which references non-existent columns on user_profiles)
CREATE OR REPLACE FUNCTION public.sv_is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'superuser')
    AND status = 'active'
  );
$$;
