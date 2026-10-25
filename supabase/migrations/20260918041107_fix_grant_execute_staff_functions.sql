/*
# Fix: GRANT EXECUTE on canonical staff functions to authenticated role

The previous migration created the functions but the GRANT EXECUTE statements
did not actually take effect. The authenticated role has no permission to call
sv_staff_get_accounts, sv_staff_get_accounts_count, sv_staff_get_traffic,
or sv_is_staff_or_admin. Every RPC call from the frontend returns permission denied.
*/

GRANT EXECUTE ON FUNCTION public.sv_staff_get_accounts TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_get_accounts_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_staff_get_traffic TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_is_staff_or_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_check_staff_access TO authenticated;
