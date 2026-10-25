/*
# Fix Peak6 auth.users row: normalize NULL fields to defaults

## Background
The Peak6 test account (peak6@spotvault.app, id f49b8e1a-5644-44fe-b454-f87ea9455db5)
was manually provisioned in auth.users rather than created via supabase.auth.signUp.
Several nullable columns were left as NULL that normal sign-up flow populates with
defaults (empty strings). The Supabase Auth provider's internal schema query fails
with "Database error querying schema" (HTTP 500) when it encounters these NULLs,
specifically `email_change = NULL`. Normal users (created via signUp) have
`email_change = ''`.

## Changes
1. Sets `email_change = ''` on the Peak6 auth.users row (was NULL).
   This was the specific column causing the 500 error.

## Verification
- After this migration, POST /auth/v1/token?grant_type=password for peak6@spotvault.app
  returns HTTP 200 with a valid session (previously returned 500).
- Password hash is unchanged and still validates correctly.
- No other user rows are touched.

## Security
No RLS or policy changes. No schema changes. This is a data-only fix on a single
auth.users row to bring it in line with the default values that supabase.auth.signUp
would have set.
*/

UPDATE auth.users
SET email_change = ''
WHERE id = 'f49b8e1a-5644-44fe-b454-f87ea9455db5'
  AND email_change IS NULL;
