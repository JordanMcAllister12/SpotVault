/*
# Revoke anon execute on staff-only RPCs
*/
REVOKE EXECUTE ON FUNCTION public.sv_set_seller_permissions(uuid, boolean, boolean, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sv_add_hand_to_batch(uuid, text, text, text, text, text, numeric, numeric, text, numeric, text, text, text, timestamptz, boolean, boolean, boolean, boolean, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sv_set_hand_selection(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sv_create_batch_event(uuid, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sv_check_seller_permissions() FROM anon;