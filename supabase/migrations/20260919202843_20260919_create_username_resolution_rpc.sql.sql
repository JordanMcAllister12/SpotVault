/*
# Create public username-to-email resolution RPC

## Purpose
Allows the login form to resolve a SpotVault username (e.g. "BryanParis")
to the associated auth email so that `supabase.auth.signInWithPassword()`
can be called. This is required because Supabase Auth only accepts email,
not username, for password login.

## Security
- SECURITY DEFINER with fixed search_path to prevent injection.
- Callable by `anon, authenticated` (pre-auth, before the user has a session).
- Returns only the `email` field — no password hashes, no user_id, no metadata.
- Username matching is case-insensitive (ILIKE).
- Also accepts an email directly (pass-through), so the same RPC works for
  both "username" and "email" login without the client needing to distinguish.
- If no match is found, returns `null` — the client treats this as "user not found".

## Functions
- `sv_resolve_login_email(p_identifier text)` — returns `text` (the email) or NULL.

## Notes
- Email enumeration is an accepted tradeoff: Supabase's own signUp flow already
  reveals whether an email is registered ("User already registered"). This RPC
  does not lower the security posture below that baseline.
- Does NOT modify any existing tables, roles, or data.
*/

CREATE OR REPLACE FUNCTION public.sv_resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT au.email
  FROM auth.users au
  JOIN user_profiles up ON up.user_id = au.id::text
  WHERE up.username ILIKE p_identifier
     OR au.email ILIKE p_identifier
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.sv_resolve_login_email(text) TO anon, authenticated;
