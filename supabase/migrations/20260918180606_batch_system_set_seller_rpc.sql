/*
# Set seller permissions RPC (staff/admin only)
*/
CREATE OR REPLACE FUNCTION public.sv_set_seller_permissions(
  p_user_id uuid,
  p_spots boolean DEFAULT false,
  p_video boolean DEFAULT false,
  p_multi_spot_analysis boolean DEFAULT false,
  p_hh_bundles boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND role IN ('staff', 'superuser')
  ) INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Permission denied — staff access required';
  END IF;

  INSERT INTO public.sv_seller_permissions (user_id, spots, video, multi_spot_analysis, hh_bundles, approved_at, approved_by, updated_at)
  VALUES (p_user_id, p_spots, p_video, p_multi_spot_analysis, p_hh_bundles, now(), auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET spots = p_spots,
        video = p_video,
        multi_spot_analysis = p_multi_spot_analysis,
        hh_bundles = p_hh_bundles,
        approved_at = CASE WHEN (p_spots OR p_video OR p_multi_spot_analysis OR p_hh_bundles) THEN COALESCE(sv_seller_permissions.approved_at, now()) ELSE NULL END,
        approved_by = CASE WHEN (p_spots OR p_video OR p_multi_spot_analysis OR p_hh_bundles) THEN COALESCE(sv_seller_permissions.approved_by, auth.uid()) ELSE NULL END,
        updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_set_seller_permissions(uuid, boolean, boolean, boolean, boolean) TO authenticated;