/*
# Fix user_profiles column-level UPDATE privileges

## Summary
The previous migration revoked UPDATE on sensitive columns (primary_role, is_verified,
is_test_account, sv_user_id) at the column level. However, a table-level UPDATE grant
overrides column-level REVOKEs in PostgreSQL. This migration revokes the table-level
UPDATE and re-grants it only on user-editable columns.

## Changes
- REVOKE UPDATE ON user_profiles FROM authenticated (table-level)
- GRANT UPDATE (user-editable columns only) ON user_profiles TO authenticated
- service_role retains table-level UPDATE (needed for edge functions / admin operations)

## Security
- Users can no longer UPDATE primary_role, is_verified, is_test_account, or sv_user_id
- These columns are only writable by service_role (edge functions using service role key)
*/

REVOKE UPDATE ON public.user_profiles FROM authenticated;

GRANT UPDATE (
  display_name, bio, avatar_url, location, privacy_mode, poker_site,
  hendon_mob_url, updated_at, username, poker_role, social_links,
  home_city_slug, country, title, specialties, is_discoverable
) ON public.user_profiles TO authenticated;
