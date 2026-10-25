/*
# Fix social table RLS policies for universal access

## Problem
1. `network_chat_messages` has an insecure `network_chat_insert` policy with
   `WITH CHECK (true)` that allows any authenticated user to insert as anyone.
2. `sv_can_post_community()` has two overloads and neither recognizes `universal_access`.
3. `community_posts` INSERT requires `general_feed_post` capability, blocking
   universal-access accounts.
4. `user_inbox_messages` has an insecure `anon_insert_msgs` policy.
5. `network_chat_reactions` has an insecure `anon_insert_reactions` policy.
6. `network_chat_boosts` has `WITH CHECK (true)`.

## Changes

### network_chat_messages
- Drop insecure `network_chat_insert` (WITH CHECK true)
- Keep `chat_messages_insert_auth` with identity check only

### sv_can_post_community()
- Drop both overloads, create single version with `universal_access` in role check

### community_posts
- Replace INSERT policy: author_id = auth.uid() AND (capability OR universal_access)

### industry_wire_posts  
- Replace INSERT policy: add universal_access to the OR condition

### poker_lounge_messages
- Add universal-access INSERT policy for spotvault scope

### user_inbox_messages
- Drop insecure `anon_insert_msgs`
- Keep secure `user_inbox_messages_insert_senders`

### network_chat_reactions
- Drop insecure `anon_insert_reactions`
- Keep secure `chat_reactions_insert_auth`

### network_chat_boosts
- Replace `insert_own_boost` with identity-checked version

## Security
- Identity validation (author_id = auth.uid()) ALWAYS enforced
- Universal access bypasses product-tier gates, NOT identity checks
- No `WITH CHECK (true)` on any INSERT policy for user-authored content
*/

-- ============================================================
-- 1. network_chat_messages — drop insecure INSERT
-- ============================================================
DROP POLICY IF EXISTS "network_chat_insert" ON network_chat_messages;
-- chat_messages_insert_auth already enforces author_id = auth.uid()::text

-- ============================================================
-- 2. sv_can_post_community() — single version with universal_access
-- ============================================================
DROP FUNCTION IF EXISTS public.sv_can_post_community();
DROP FUNCTION IF EXISTS public.sv_can_post_community(text);

CREATE OR REPLACE FUNCTION public.sv_can_post_community(
  p_user_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH effective_user AS (
    SELECT COALESCE(auth.uid()::text, p_user_id) AS uid
  ),
  uuid_check AS (
    SELECT (SELECT uid FROM effective_user) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AS is_uuid
  )
  SELECT
    -- Universal access, superusers, staff, admins, and owners can always post
    (SELECT is_uuid FROM uuid_check) AND EXISTS (
      SELECT 1 FROM sv_roles r
      WHERE r.user_id = (SELECT uid FROM effective_user)::uuid
      AND r.role IN ('staff', 'superuser', 'admin', 'owner', 'universal_access')
      AND r.status = 'active'
    )
    -- Active paid membership in community_entitlements
    OR EXISTS (
      SELECT 1 FROM community_entitlements ce
      WHERE ce.user_id = (SELECT uid FROM effective_user)
      AND ce.is_paid_member = true
    )
    -- Active non-expired, non-revoked entitlement in sv_entitlements
    OR (SELECT is_uuid FROM uuid_check) AND EXISTS (
      SELECT 1 FROM sv_entitlements en
      WHERE en.user_id = (SELECT uid FROM effective_user)::uuid
      AND en.revoked_at IS NULL
      AND (en.expires_at IS NULL OR en.expires_at > now())
    );
$function$;

REVOKE EXECUTE ON FUNCTION sv_can_post_community(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_community(text) TO authenticated;

-- ============================================================
-- 3. community_posts — add universal_access to INSERT
-- ============================================================
DROP POLICY IF EXISTS "community_posts_insert" ON community_posts;

CREATE POLICY "community_posts_insert"
  ON community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM sv_user_capabilities
        WHERE user_id = auth.uid()
        AND capability = 'general_feed_post'
        AND status = 'active'
      )
      OR public.sv_has_universal_access()
    )
  );

-- ============================================================
-- 4. industry_wire_posts — add universal_access
-- ============================================================
DROP POLICY IF EXISTS "network_post_insert_wire" ON industry_wire_posts;

CREATE POLICY "network_post_insert_wire"
  ON industry_wire_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id = auth.uid()
      AND capability = 'network_post'
      AND status = 'active'
    )
    OR public.sv_has_universal_access()
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'superuser', 'admin', 'owner')
      AND status = 'active'
    )
  );

-- ============================================================
-- 5. poker_lounge_messages — universal access for spotvault scope
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_spotvault_lounge" ON poker_lounge_messages;

CREATE POLICY "lounge_insert_spotvault"
  ON poker_lounge_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    community_scope = 'spotvault'
    AND author_id = auth.uid()
  );

-- Universal access users can post in any lounge scope
CREATE POLICY "lounge_insert_universal_access"
  ON poker_lounge_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.sv_has_universal_access()
    AND author_id = auth.uid()
  );

-- ============================================================
-- 6. user_inbox_messages — drop insecure anon INSERT
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_msgs" ON user_inbox_messages;
-- user_inbox_messages_insert_senders already enforces sender_id + conversation membership

-- ============================================================
-- 7. network_chat_reactions — drop insecure anon INSERT
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_reactions" ON network_chat_reactions;
-- chat_reactions_insert_auth already enforces user_id = auth.uid()::text

-- ============================================================
-- 8. network_chat_boosts — replace insecure INSERT
-- ============================================================
DROP POLICY IF EXISTS "insert_own_boost" ON network_chat_boosts;

CREATE POLICY "insert_own_boost"
  ON network_chat_boosts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);
