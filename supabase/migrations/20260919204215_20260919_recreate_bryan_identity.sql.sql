/*
# Recreate Bryan's auth.identities row with correct format
*/

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
SELECT
  'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
  'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
  jsonb_build_object(
    'sub', 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba',
    'email', 'bparispoker@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba'
);
