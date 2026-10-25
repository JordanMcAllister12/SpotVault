CREATE OR REPLACE FUNCTION public.sv_check_seller_permissions()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(
    (SELECT json_build_object(
      'spots', spots,
      'video', video,
      'multi_spot_analysis', multi_spot_analysis,
      'hh_bundles', hh_bundles,
      'approved', (spots OR video OR multi_spot_analysis OR hh_bundles)
    ) FROM public.sv_seller_permissions WHERE user_id = auth.uid()),
    json_build_object(
      'spots', false, 'video', false, 'multi_spot_analysis', false,
      'hh_bundles', false, 'approved', false
    )
  )
$$;