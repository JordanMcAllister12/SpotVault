/*
# Lock Down Administrative Function Execution

## Summary
1. Removes inherited PUBLIC execution access from the three founder-protected administrative functions created in the prior migration.
2. Keeps execution available only to authenticated callers, where each function performs its own server-side role and founder-protection checks.

## Security
- `anon` and `PUBLIC` cannot invoke administrative user-status, user-deletion, or role-grant functions.
- `authenticated` retains access to the functions, subject to their internal authorization checks.
*/

REVOKE EXECUTE ON FUNCTION public.sv_admin_update_user_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sv_admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sv_admin_grant_role(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sv_admin_update_user_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_admin_grant_role(uuid, text, text) TO authenticated;
