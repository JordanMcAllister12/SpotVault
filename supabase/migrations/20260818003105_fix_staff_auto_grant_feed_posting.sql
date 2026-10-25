-- Auto-grant general feed posting for staff/superuser roles
CREATE OR REPLACE FUNCTION public.sv_can_post_general_feed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM sv_user_capabilities
  WHERE user_id = auth.uid()
  AND capability = 'general_feed_post'
  AND status = 'active'
) OR EXISTS (
  SELECT 1 FROM sv_roles
  WHERE user_id = auth.uid()
  AND role IN ('staff', 'superuser', 'admin', 'owner')
  AND status = 'active'
);
$function$;

REVOKE EXECUTE ON FUNCTION sv_can_post_general_feed FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_general_feed TO authenticated;