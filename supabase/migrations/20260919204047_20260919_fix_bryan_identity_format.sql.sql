/*
# Fix Bryan's auth.identities row to match expected format

## Problem
The manually inserted identity row was missing phone_verified in identity_data
and had last_sign_in_at = NULL. GoTrue expects the identity_data to match the
format it creates internally.

## Fix
Update the identity_data to include phone_verified: false and set last_sign_in_at.
*/

UPDATE auth.identities
SET
  identity_data = jsonb_build_object(
    'sub', 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
    'email', 'bparispoker@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  last_sign_in_at = created_at,
  updated_at = now()
WHERE user_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
