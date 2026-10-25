/*
# Repair Peak6 Auth email identity

1. Purpose
- Repair the existing Peak6 test account so Supabase email/password authentication can resolve its provider identity.
- Preserve the existing account, password hash, profile, portal grants, and lounge memberships.

2. Data changes
- No tables or columns are created, removed, renamed, or changed.
- Adds the missing `auth.identities` email identity for `peak6@spotvault.app` only when it is absent.
- The `email` column on `auth.identities` is a generated column derived from `identity_data`, so it is intentionally omitted from the INSERT.

3. Security
- The identity is linked to the existing `auth.users` row by UUID.
- The identity uses the existing email provider and does not change credentials.

4. Important notes
- This is idempotent: re-running it updates the existing identity metadata without creating a duplicate.
- No password reset or account recreation is performed.
*/

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'peak6@spotvault.app';
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Peak6 auth user not found';
  END IF;

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    NULL,
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();
END $$;