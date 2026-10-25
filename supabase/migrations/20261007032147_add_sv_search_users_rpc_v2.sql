/*
# Add user search RPC for DM discovery

1. New Functions
- `sv_search_users(search_query text, limit_count int DEFAULT 10)` — SECURITY DEFINER function
  that searches `user_profiles` by `username` or `display_name` (case-insensitive, ILIKE).
  Returns `user_id`, `username`, `display_name`, `avatar_url`, `poker_role`, `primary_role`, `is_verified`.
  Excludes the caller's own profile from results.
  Only returns profiles where `username` is NOT NULL (must have a username to be discoverable).
  Does NOT expose email, auth data, or other private fields.

2. Security
- SECURITY DEFINER so it can read user_profiles regardless of RLS.
- Search path set to 'public' for safety.
- EXECUTE granted to both anon and authenticated roles.
- Only public-facing columns are returned.
*/

DROP FUNCTION IF EXISTS public.sv_search_users(text, int);

CREATE OR REPLACE FUNCTION public.sv_search_users(search_query text, limit_count int DEFAULT 10)
RETURNS TABLE (
  user_id text,
  username text,
  display_name text,
  avatar_url text,
  poker_role text,
  primary_role text,
  is_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me text := auth.uid()::text;
  pattern text;
BEGIN
  IF search_query IS NULL OR trim(search_query) = '' THEN
    RETURN;
  END IF;

  pattern := '%' || trim(search_query) || '%';

  RETURN QUERY
  SELECT
    up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.poker_role,
    up.primary_role,
    up.is_verified
  FROM user_profiles up
  WHERE up.username IS NOT NULL
    AND up.user_id <> me
    AND (
      up.username ILIKE pattern
      OR up.display_name ILIKE pattern
    )
  ORDER BY
    CASE
      WHEN up.username ILIKE trim(search_query) THEN 0
      WHEN up.display_name ILIKE trim(search_query) THEN 1
      WHEN up.username ILIKE pattern THEN 2
      ELSE 3
    END,
    up.display_name NULLS LAST
  LIMIT LEAST(limit_count, 20);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_search_users(text, int) TO anon, authenticated;
