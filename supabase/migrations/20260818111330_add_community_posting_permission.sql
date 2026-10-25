/*
# Add separate Community Feed posting permission

## Problem
The Community Feed (public social feed) and Main Feed (Industry Wire / restricted feed)
both use sv_can_post_general_feed() for posting permission checks. This conflates two
distinct permission levels:
- Community Feed: should be open to any authenticated user
- Main Feed (Industry Wire): should require staff approval / network_post capability

## Changes
1. Create sv_can_post_community() — allows ANY authenticated user to post to the
   Community Feed. This is intentionally permissive: the community feed is the public
   social feed where all members can participate.

2. Keep sv_can_post_general_feed() unchanged — it remains the stricter check used
   by the Main Feed / Industry Wire for curated/restricted posting.

3. Keep sv_can_post_network() unchanged — it remains the explicit network_post
   capability check for Industry Wire posting.

## Security
- sv_can_post_community() is SECURITY DEFINER, returns true for any authenticated user
- This does NOT bypass RLS on community_posts — the table's INSERT policy still
  enforces that the author_id must match auth.uid()
*/

-- ============================================================
-- 1. Create sv_can_post_community() — any authenticated user can post
-- ============================================================
CREATE OR REPLACE FUNCTION public.sv_can_post_community()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Any authenticated user can post to the Community Feed
  SELECT auth.uid() IS NOT NULL;
$function$;

REVOKE EXECUTE ON FUNCTION sv_can_post_community FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_community TO authenticated;
