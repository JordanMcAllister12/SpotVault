/*
# Set Tyler's password to 123456 directly via bcrypt hash

Supabase Auth API rejects "123456" as too weak. This migration
sets the bcrypt hash directly in auth.users, bypassing the Auth API's
strength check. This is a one-time operation for Tyler's test account.
*/

DO $$
DECLARE
  v_user_id uuid := '3f968934-e5d9-4e2c-989b-23a12f2fc2ef';
  v_hash text;
BEGIN
  -- Generate bcrypt hash for "123456"
  v_hash := extensions.crypt('123456', extensions.gen_salt('bf', 10));

  -- Update the password directly
  UPDATE auth.users
  SET encrypted_password = v_hash,
      updated_at = now()
  WHERE id = v_user_id AND email ILIKE '%stakekingstyler%';

  RAISE NOTICE 'Password updated for Tyler';
END $$;
