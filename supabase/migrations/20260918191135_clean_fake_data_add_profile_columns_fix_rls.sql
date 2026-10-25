/*
# Clean fake data + add profile columns + fix RLS + hover card RPC

## 1. Delete fake demo/seed data
- Delete network_chat_messages, system_messages, network_chat_reactions, profile_accomplishments
  where the user_id/author_id starts with 'demo-' or 'acc-'
- Delete user_profiles where user_id starts with 'demo-' or 'acc-'
- Delete test auth accounts (testaccount1, testaccount2) — no dependent data

## 2. Add missing profile columns
- country (text) — for country flag display
- title (text) — professional title/tag
- specialties (text[]) — array of specialty tags

## 3. Fix user_profiles RLS
- UPDATE policy: restrict to user_id = auth.uid()
- INSERT policy: restrict to user_id = auth.uid()

## 4. Create lightweight hover-card profile RPC
- sv_get_hover_profile(p_user_id) returns just the public fields needed for hover cards
- Includes follower count and whether the caller follows this user
*/

-- ── 1. Clean fake data ──────────────────────────────────────────

-- Delete network_chat_messages by demo/acc users
DELETE FROM network_chat_reactions
WHERE user_id::text LIKE 'demo-%' OR user_id::text LIKE 'acc-%';

DELETE FROM network_chat_messages
WHERE author_id LIKE 'demo-%' OR author_id LIKE 'acc-%';

-- Delete system_messages for demo/acc users
DELETE FROM system_messages
WHERE recipient_user_id::text LIKE 'demo-%' OR recipient_user_id::text LIKE 'acc-%';

-- Delete profile_accomplishments for demo/acc users
DELETE FROM profile_accomplishments
WHERE user_id::text LIKE 'demo-%' OR user_id::text LIKE 'acc-%';

-- Delete user_profiles for demo/acc users
DELETE FROM user_profiles
WHERE user_id LIKE 'demo-%' OR user_id LIKE 'acc-%';

-- Delete test auth accounts (no dependent data confirmed)
DELETE FROM auth.users
WHERE id IN ('93f046c8-3a5e-450b-8198-19936d18d8f8', '80cf0829-a296-4790-91a8-40ef6e522e94');

-- ── 2. Add missing profile columns ──────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS country text DEFAULT '';

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS title text DEFAULT '';

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}';

-- ── 3. Fix user_profiles RLS ────────────────────────────────────

-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "update_user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "insert_user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create properly scoped policies
CREATE POLICY "update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "insert_own_profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- SELECT policy remains permissive (profiles are public)
-- (existing SELECT policy is fine)

-- ── 4. Hover card profile RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION sv_get_hover_profile(
  p_user_id text
) RETURNS TABLE(
  user_id text,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  country text,
  title text,
  specialties text[],
  poker_role text,
  location text,
  home_city_slug text,
  follower_count bigint,
  is_followed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.user_id,
    up.display_name,
    up.username,
    up.avatar_url,
    up.bio,
    up.country,
    up.title,
    up.specialties,
    up.poker_role,
    up.location,
    up.home_city_slug,
    (
      SELECT count(*)::bigint
      FROM sv_relationships r
      WHERE r.type = 'follow'
        AND r.status = 'active'
        AND r.user_b::text = up.user_id
    ) AS follower_count,
    (
      EXISTS(
        SELECT 1 FROM sv_relationships r
        WHERE r.type = 'follow'
          AND r.status = 'active'
          AND r.user_a = auth.uid()
          AND r.user_b::text = up.user_id
      )
    ) AS is_followed
  FROM user_profiles up
  WHERE up.user_id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_hover_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_hover_profile(text) TO authenticated;