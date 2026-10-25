/*
# Poker Lounge Messages + Enriched Follower/Following Functions

## Purpose
1. Create `poker_lounge_messages` table for structured poker discussion rooms
   scoped by stakes, format, and community (SpotVault vs StakeKings).
2. Create enriched follower/following RPC functions that return user profile
   data (name, avatar, role) alongside user IDs, for displaying follower/following
   lists on profile pages.

## 1. New Table: poker_lounge_messages

Stores messages in poker discussion rooms. Each message belongs to a specific
room identified by the combination of:
- `stakes_level`: 'micro' | 'low' | 'medium' | 'high'
- `poker_format`: 'cash' | 'mtt' | 'live'
- `community_scope`: 'spotvault' | 'stakekings'

This allows the same forum architecture to serve both the general SpotVault
community and a private StakeKings-only community without cross-contamination.

Columns:
- `id` (uuid PK)
- `author_id` (uuid, the message author's auth user ID)
- `author_name` (text, denormalized for display)
- `author_avatar` (text, nullable, denormalized avatar URL)
- `author_role` (text, nullable, denormalized role label)
- `body` (text, the message content)
- `stakes_level` (text, one of micro/low/medium/high)
- `poker_format` (text, one of cash/mtt/live)
- `community_scope` (text, one of spotvault/stakekings — defaults to spotvault)
- `reply_to` (uuid, self-referencing FK for threaded replies, nullable)
- `created_at` (timestamptz, defaults to now)

Indexes:
- `idx_poker_lounge_room` on (community_scope, stakes_level, poker_format, created_at DESC)
  — the primary query pattern: "get messages for this room, newest first"
- `idx_poker_lounge_author` on (author_id)

## 2. Security (RLS)

RLS enabled on `poker_lounge_messages`.

### SpotVault rooms (community_scope = 'spotvault')
These are public to all anon/authenticated users (the app uses anon-key access).
CRUD policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
because the table is intentionally shared/public — same pattern as `network_chat_messages`.

### StakeKings rooms (community_scope = 'stakekings')
Access is restricted to users with a valid StakeKings entitlement. The policies
check that the requesting user has a row in `partner_attributions` where
`partner_slug = 'stakekings'` AND `entitlement_active = true`.

For SELECT: the USING clause checks StakeKings entitlement.
For INSERT: the WITH CHECK clause checks StakeKings entitlement AND that
  `community_scope = 'stakekings'` (preventing writing to wrong scope).
For UPDATE/DELETE: only the message author can modify their own messages,
  AND must still have active StakeKings entitlement.

Since the frontend uses the anon key (no auth session), StakeKings rooms will
return zero rows to unauthenticated users — this is the intended access control.
For demo purposes, we also allow access when the anon key is used AND the
community_scope is 'spotvault', so the general lounge works without auth.

## 3. New Functions

### sv_get_followers_enriched(target_uuid uuid)
Returns follower list with profile data for a given user.
Returns: TABLE(user_id uuid, display_name text, username text, avatar_url text,
               poker_role text, bio text, home_city_slug text, created_at timestamptz)

### sv_get_following_enriched(target_uuid uuid)
Returns following list with profile data for a given user.
Same return shape as above.

### sv_get_follower_count(target_uuid uuid)
Returns integer count of followers.

### sv_get_following_count(target_uuid uuid)
Returns integer count of following.

These functions join `sv_relationships` (type='follow', status='active') with
`user_profiles` to enrich the user IDs with display information. They are
SECURITY DEFINER so they can read relationship data regardless of the caller's
RLS context, but they only return data for 'active' follow relationships.

## 4. Important Notes
- The `user_profiles` table uses `user_id` as `text` type, so we cast uuid to text
  in the join.
- StakeKings access is enforced at the RLS policy level, not just frontend filtering.
- The `community_scope` column defaults to 'spotvault' so existing inserts that
  don't specify a scope go to the general community.
- All functions are idempotent (CREATE OR REPLACE).
*/

-- ── 1. Create poker_lounge_messages table ──────────────────────

CREATE TABLE IF NOT EXISTS poker_lounge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  author_avatar text,
  author_role text,
  body text NOT NULL,
  stakes_level text NOT NULL CHECK (stakes_level IN ('micro', 'low', 'medium', 'high')),
  poker_format text NOT NULL CHECK (poker_format IN ('cash', 'mtt', 'live')),
  community_scope text NOT NULL DEFAULT 'spotvault' CHECK (community_scope IN ('spotvault', 'stakekings')),
  reply_to uuid REFERENCES poker_lounge_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_lounge_room
  ON poker_lounge_messages (community_scope, stakes_level, poker_format, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poker_lounge_author
  ON poker_lounge_messages (author_id);

ALTER TABLE poker_lounge_messages ENABLE ROW LEVEL SECURITY;

-- SpotVault rooms: public read/write (same pattern as network_chat_messages)
DROP POLICY IF EXISTS "anon_select_spotvault_lounge" ON poker_lounge_messages;
CREATE POLICY "anon_select_spotvault_lounge"
  ON poker_lounge_messages FOR SELECT
  TO anon, authenticated
  USING (community_scope = 'spotvault');

DROP POLICY IF EXISTS "anon_insert_spotvault_lounge" ON poker_lounge_messages;
CREATE POLICY "anon_insert_spotvault_lounge"
  ON poker_lounge_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (community_scope = 'spotvault');

DROP POLICY IF EXISTS "anon_update_spotvault_lounge" ON poker_lounge_messages;
CREATE POLICY "anon_update_spotvault_lounge"
  ON poker_lounge_messages FOR UPDATE
  TO anon, authenticated
  USING (community_scope = 'spotvault' AND author_id = auth.uid())
  WITH CHECK (community_scope = 'spotvault' AND author_id = auth.uid());

DROP POLICY IF EXISTS "anon_delete_spotvault_lounge" ON poker_lounge_messages;
CREATE POLICY "anon_delete_spotvault_lounge"
  ON poker_lounge_messages FOR DELETE
  TO anon, authenticated
  USING (community_scope = 'spotvault' AND author_id = auth.uid());

-- StakeKings rooms: restricted to users with active StakeKings entitlement
DROP POLICY IF EXISTS "sk_select_stakekings_lounge" ON poker_lounge_messages;
CREATE POLICY "sk_select_stakekings_lounge"
  ON poker_lounge_messages FOR SELECT
  TO authenticated
  USING (
    community_scope = 'stakekings'
    AND EXISTS (
      SELECT 1 FROM partner_attributions
      WHERE partner_attributions.user_id = auth.uid()
        AND partner_attributions.partner_slug = 'stakekings'
        AND partner_attributions.entitlement_active = true
    )
  );

DROP POLICY IF EXISTS "sk_insert_stakekings_lounge" ON poker_lounge_messages;
CREATE POLICY "sk_insert_stakekings_lounge"
  ON poker_lounge_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    community_scope = 'stakekings'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM partner_attributions
      WHERE partner_attributions.user_id = auth.uid()
        AND partner_attributions.partner_slug = 'stakekings'
        AND partner_attributions.entitlement_active = true
    )
  );

DROP POLICY IF EXISTS "sk_update_stakekings_lounge" ON poker_lounge_messages;
CREATE POLICY "sk_update_stakekings_lounge"
  ON poker_lounge_messages FOR UPDATE
  TO authenticated
  USING (
    community_scope = 'stakekings'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM partner_attributions
      WHERE partner_attributions.user_id = auth.uid()
        AND partner_attributions.partner_slug = 'stakekings'
        AND partner_attributions.entitlement_active = true
    )
  )
  WITH CHECK (
    community_scope = 'stakekings'
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "sk_delete_stakekings_lounge" ON poker_lounge_messages;
CREATE POLICY "sk_delete_stakekings_lounge"
  ON poker_lounge_messages FOR DELETE
  TO authenticated
  USING (
    community_scope = 'stakekings'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM partner_attributions
      WHERE partner_attributions.user_id = auth.uid()
        AND partner_attributions.partner_slug = 'stakekings'
        AND partner_attributions.entitlement_active = true
    )
  );

-- ── 2. Enriched follower/following functions ───────────────────

CREATE OR REPLACE FUNCTION sv_get_followers_enriched(target_uuid uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  poker_role text,
  bio text,
  home_city_slug text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    r.user_a::uuid AS user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.poker_role,
    p.bio,
    p.home_city_slug,
    r.created_at
  FROM sv_relationships r
  LEFT JOIN user_profiles p ON p.user_id = r.user_a::text
  WHERE r.type = 'follow'
    AND r.user_b = target_uuid
    AND r.status = 'active'
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION sv_get_following_enriched(target_uuid uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  poker_role text,
  bio text,
  home_city_slug text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    r.user_b::uuid AS user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.poker_role,
    p.bio,
    p.home_city_slug,
    r.created_at
  FROM sv_relationships r
  LEFT JOIN user_profiles p ON p.user_id = r.user_b::text
  WHERE r.type = 'follow'
    AND r.user_a = target_uuid
    AND r.status = 'active'
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION sv_get_follower_count(target_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)::integer
  FROM sv_relationships
  WHERE type = 'follow'
    AND user_b = target_uuid
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION sv_get_following_count(target_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)::integer
  FROM sv_relationships
  WHERE type = 'follow'
    AND user_a = target_uuid
    AND status = 'active';
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION sv_get_followers_enriched(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_get_following_enriched(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_get_follower_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_get_following_count(uuid) TO anon, authenticated;
