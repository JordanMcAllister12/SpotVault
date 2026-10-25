/*
# Fix: Insert missing auth.identities row for Bryan Paris

## Problem
Bryan's auth.users row was created by directly inserting into auth.users
(via migration 20260919201256) instead of using the Supabase Auth admin API.
This created the auth.users row with an encrypted_password but did NOT create
the corresponding auth.identities row. Supabase Auth requires an identity
record to authenticate via signInWithPassword.

## Fix
Insert the missing email identity row linking to Bryan's existing UUID.
The email column is generated, so we omit it.
*/

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT
  'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
  'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
  jsonb_build_object(
    'sub', 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
    'email', 'bparispoker@gmail.com',
    'email_verified', true
  ),
  'email',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba'
);
