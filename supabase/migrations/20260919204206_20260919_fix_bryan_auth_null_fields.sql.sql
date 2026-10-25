/*
# Fix Bryan's auth.users row: set NULL string fields to empty strings

## Problem
Bryan's auth.users row was created via raw SQL INSERT which left several
string columns as NULL. GoTrue (the Supabase Auth server) expects these
columns to be empty strings (''), not NULL. When GoTrue queries the user
during signInWithPassword, the NULL values cause a "Database error querying
schema" (500 error).

## Fix
Set the NULL string columns to empty strings to match the format GoTrue
expects. This does NOT modify the password, email, UUID, or any other
critical field.
*/

UPDATE auth.users
SET
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  phone = COALESCE(phone, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  updated_at = now()
WHERE id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
