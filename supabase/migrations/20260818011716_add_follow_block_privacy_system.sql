/*
# Network Follow + Block + Privacy Settings

## Changes to sv_relationships
- Add 'follow' and 'block' to the type CHECK constraint
- Add 'requested' status for approval-required follows

## New Table: sv_user_privacy_settings
- who_can_follow: 'everyone' | 'approval_required' | 'nobody' (default 'everyone')
- who_can_message: 'contacts_only' | 'people_i_follow' | 'everyone' (default 'contacts_only')
- share_current_city: boolean (default false)

## New Table: sv_follow_requests
- For approval-required follows: tracks pending follow requests

## Security
- All follow/block mutations through SECURITY DEFINER functions
- Privacy settings enforced server-side
- Rate limiting via function logic
- RLS on privacy settings (user can only read/write own settings)
*/

-- ── 1. Extend sv_relationships type constraint ──
ALTER TABLE sv_relationships DROP CONSTRAINT IF EXISTS sv_relationships_type_check;
ALTER TABLE sv_relationships ADD CONSTRAINT sv_relationships_type_check
  CHECK (type IN ('coach_student', 'stable_player', 'business_employee', 'creator_customer', 'network_contact', 'follow', 'block'));

-- ── 2. Extend status constraint to include 'requested' ──
ALTER TABLE sv_relationships DROP CONSTRAINT IF EXISTS sv_relationships_status_check;
ALTER TABLE sv_relationships ADD CONSTRAINT sv_relationships_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'ended', 'blocked', 'declined', 'removed', 'requested'));

CREATE INDEX IF NOT EXISTS sv_relationships_follow_idx ON sv_relationships (type, user_a, user_b, status) WHERE type IN ('follow', 'block');

-- ── 3. User privacy settings table ──
CREATE TABLE IF NOT EXISTS sv_user_privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  who_can_follow text NOT NULL DEFAULT 'everyone'
    CHECK (who_can_follow IN ('everyone', 'approval_required', 'nobody')),
  who_can_message text NOT NULL DEFAULT 'contacts_only'
    CHECK (who_can_message IN ('contacts_only', 'people_i_follow', 'everyone')),
  share_current_city boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_user_privacy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_privacy_select_own" ON sv_user_privacy_settings;
CREATE POLICY "sv_privacy_select_own" ON sv_user_privacy_settings FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sv_privacy_upsert_own" ON sv_user_privacy_settings;
CREATE POLICY "sv_privacy_upsert_own" ON sv_user_privacy_settings FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sv_privacy_update_own" ON sv_user_privacy_settings;
CREATE POLICY "sv_privacy_update_own" ON sv_user_privacy_settings FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 4. Follow request tracking table ──
CREATE TABLE IF NOT EXISTS sv_follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS sv_follow_requests_target_idx ON sv_follow_requests (target_id, status);
CREATE INDEX IF NOT EXISTS sv_follow_requests_requester_idx ON sv_follow_requests (requester_id, status);

ALTER TABLE sv_follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_follow_req_select_participants" ON sv_follow_requests;
CREATE POLICY "sv_follow_req_select_participants" ON sv_follow_requests FOR SELECT
  TO authenticated USING (requester_id = auth.uid() OR target_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON sv_follow_requests FROM anon, authenticated;

-- ── 5. Get user's follow privacy setting ──
CREATE OR REPLACE FUNCTION sv_get_follow_privacy(p_target_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT who_can_follow FROM sv_user_privacy_settings WHERE user_id = p_target_user_id),
    'everyone'
  );
$$;
REVOKE EXECUTE ON FUNCTION sv_get_follow_privacy(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_follow_privacy(uuid) TO authenticated;

-- ── 6. Get user's message privacy setting ──
CREATE OR REPLACE FUNCTION sv_get_message_privacy(p_target_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT who_can_message FROM sv_user_privacy_settings WHERE user_id = p_target_user_id),
    'contacts_only'
  );
$$;
REVOKE EXECUTE ON FUNCTION sv_get_message_privacy(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_message_privacy(uuid) TO authenticated;

-- ── 7. Follow user ──
CREATE OR REPLACE FUNCTION sv_follow_user(p_target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_privacy text;
  v_existing_id uuid;
  v_existing_status text;
  v_block_exists boolean;
  v_recent_count int;
BEGIN
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'block' AND status = 'active'
    AND ((user_a = auth.uid() AND user_b = p_target_user_id)
         OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ) INTO v_block_exists;
  IF v_block_exists THEN RAISE EXCEPTION 'Cannot follow: block exists'; END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM sv_relationships
  WHERE type = 'follow' AND user_a = auth.uid() AND user_b = p_target_user_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing_status = 'active' THEN RETURN 'already_following'; END IF;

  SELECT count(*) INTO v_recent_count
  FROM sv_relationships
  WHERE type = 'follow' AND user_a = auth.uid()
  AND created_at > now() - interval '1 hour';
  IF v_recent_count >= 50 THEN RAISE EXCEPTION 'Rate limit: too many follow actions'; END IF;

  v_privacy := sv_get_follow_privacy(p_target_user_id);

  IF v_privacy = 'nobody' THEN RAISE EXCEPTION 'This user does not accept follows'; END IF;

  IF v_privacy = 'approval_required' THEN
    INSERT INTO sv_follow_requests (requester_id, target_id, status)
    VALUES (auth.uid(), p_target_user_id, 'pending')
    ON CONFLICT (requester_id, target_id) DO UPDATE SET status = 'pending', responded_at = NULL;

    IF v_existing_id IS NOT NULL THEN
      UPDATE sv_relationships SET status = 'requested', updated_at = now() WHERE id = v_existing_id;
    ELSE
      INSERT INTO sv_relationships (type, user_a, user_b, status, metadata)
      VALUES ('follow', auth.uid(), p_target_user_id, 'requested',
        jsonb_build_object('initiated_by', auth.uid()));
    END IF;

    INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
    VALUES (auth.uid(), 'follow_requested', p_target_user_id, jsonb_build_object('type', 'follow'));
    RETURN 'requested';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE sv_relationships SET status = 'active', started_at = now(), updated_at = now() WHERE id = v_existing_id;
  ELSE
    INSERT INTO sv_relationships (type, user_a, user_b, status, started_at, metadata)
    VALUES ('follow', auth.uid(), p_target_user_id, 'active', now(),
      jsonb_build_object('initiated_by', auth.uid()));
  END IF;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'followed', p_target_user_id, jsonb_build_object('type', 'follow'));
  RETURN 'following';
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_follow_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_follow_user(uuid) TO authenticated;

-- ── 8. Unfollow ──
CREATE OR REPLACE FUNCTION sv_unfollow_user(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE sv_relationships
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE type = 'follow' AND user_a = auth.uid() AND user_b = p_target_user_id
  AND status IN ('active', 'requested');

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'unfollowed', p_target_user_id, jsonb_build_object('type', 'follow'));
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_unfollow_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_unfollow_user(uuid) TO authenticated;

-- ── 9. Accept follow request ──
CREATE OR REPLACE FUNCTION sv_accept_follow_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_requester_id = auth.uid() THEN RAISE EXCEPTION 'Cannot accept own request'; END IF;

  UPDATE sv_follow_requests
  SET status = 'accepted', responded_at = now()
  WHERE requester_id = p_requester_id AND target_id = auth.uid() AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'No pending follow request'; END IF;

  UPDATE sv_relationships
  SET status = 'active', started_at = now(), updated_at = now()
  WHERE type = 'follow' AND user_a = p_requester_id AND user_b = auth.uid() AND status = 'requested';

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'follow_accepted', p_requester_id, jsonb_build_object('type', 'follow'));
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_accept_follow_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_accept_follow_request(uuid) TO authenticated;

-- ── 10. Decline follow request ──
CREATE OR REPLACE FUNCTION sv_decline_follow_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE sv_follow_requests
  SET status = 'declined', responded_at = now()
  WHERE requester_id = p_requester_id AND target_id = auth.uid() AND status = 'pending';

  UPDATE sv_relationships
  SET status = 'declined', updated_at = now()
  WHERE type = 'follow' AND user_a = p_requester_id AND user_b = auth.uid() AND status = 'requested';
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_decline_follow_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_decline_follow_request(uuid) TO authenticated;

-- ── 11. Block user (bidirectional) ──
CREATE OR REPLACE FUNCTION sv_block_user(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_block_id uuid;
  v_recent_count int;
BEGIN
  IF p_target_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;

  SELECT count(*) INTO v_recent_count FROM sv_relationships
  WHERE type = 'block' AND user_a = auth.uid() AND created_at > now() - interval '1 hour';
  IF v_recent_count >= 20 THEN RAISE EXCEPTION 'Rate limit: too many block actions'; END IF;

  UPDATE sv_relationships
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE (user_a = auth.uid() AND user_b = p_target_user_id)
     OR (user_a = p_target_user_id AND user_b = auth.uid())
  AND type IN ('follow', 'network_contact')
  AND status IN ('active', 'pending', 'requested');

  DELETE FROM sv_follow_requests
  WHERE (requester_id = auth.uid() AND target_id = p_target_user_id)
     OR (requester_id = p_target_user_id AND target_id = auth.uid());

  SELECT id INTO v_block_id FROM sv_relationships
  WHERE type = 'block' AND user_a = auth.uid() AND user_b = p_target_user_id LIMIT 1;

  IF v_block_id IS NOT NULL THEN
    UPDATE sv_relationships SET status = 'active', updated_at = now() WHERE id = v_block_id;
  ELSE
    INSERT INTO sv_relationships (type, user_a, user_b, status, started_at, metadata)
    VALUES ('block', auth.uid(), p_target_user_id, 'active', now(),
      jsonb_build_object('initiated_by', auth.uid()));
  END IF;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'blocked_user', p_target_user_id, jsonb_build_object('type', 'block'));
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_block_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_block_user(uuid) TO authenticated;

-- ── 12. Unblock user ──
CREATE OR REPLACE FUNCTION sv_unblock_user(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE sv_relationships
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE type = 'block' AND user_a = auth.uid() AND user_b = p_target_user_id AND status = 'active';
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_unblock_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_unblock_user(uuid) TO authenticated;

-- ── 13. Get my following list ──
CREATE OR REPLACE FUNCTION sv_get_my_following()
RETURNS TABLE (user_id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_b AS user_id, created_at
  FROM sv_relationships
  WHERE type = 'follow' AND user_a = auth.uid() AND status = 'active'
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION sv_get_my_following() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_following() TO authenticated;

-- ── 14. Get my followers ──
CREATE OR REPLACE FUNCTION sv_get_my_followers()
RETURNS TABLE (user_id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_a AS user_id, created_at
  FROM sv_relationships
  WHERE type = 'follow' AND user_b = auth.uid() AND status = 'active'
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION sv_get_my_followers() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_followers() TO authenticated;

-- ── 15. Get pending follow requests ──
CREATE OR REPLACE FUNCTION sv_get_pending_follow_requests()
RETURNS TABLE (requester_id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT requester_id, created_at
  FROM sv_follow_requests
  WHERE target_id = auth.uid() AND status = 'pending'
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION sv_get_pending_follow_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_pending_follow_requests() TO authenticated;

-- ── 16. Check if I follow someone ──
CREATE OR REPLACE FUNCTION sv_is_following(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'follow' AND user_a = auth.uid() AND user_b = p_target_user_id AND status = 'active'
  );
$$;
REVOKE EXECUTE ON FUNCTION sv_is_following(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_is_following(uuid) TO authenticated;

-- ── 17. Check if blocked ──
CREATE OR REPLACE FUNCTION sv_is_blocked(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'block' AND status = 'active'
    AND ((user_a = auth.uid() AND user_b = p_target_user_id)
         OR (user_a = p_target_user_id AND user_b = auth.uid()))
  );
$$;
REVOKE EXECUTE ON FUNCTION sv_is_blocked(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_is_blocked(uuid) TO authenticated;

-- ── 18. Get my blocked users ──
CREATE OR REPLACE FUNCTION sv_get_my_blocked_users()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_b AS user_id
  FROM sv_relationships
  WHERE type = 'block' AND user_a = auth.uid() AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION sv_get_my_blocked_users() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_blocked_users() TO authenticated;

-- ── 19. Get users by home city ──
CREATE OR REPLACE FUNCTION sv_get_users_by_home_city(p_city_slug text)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  poker_role text,
  bio text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    up.user_id::uuid,
    up.display_name,
    up.username,
    up.avatar_url,
    up.poker_role,
    up.bio
  FROM user_profiles up
  WHERE up.home_city_slug = p_city_slug
  AND up.user_id::text != auth.uid()::text
  AND NOT EXISTS (
    SELECT 1 FROM sv_relationships b
    WHERE b.type = 'block' AND b.status = 'active'
    AND ((b.user_a = auth.uid() AND b.user_b = up.user_id::uuid)
         OR (b.user_a = up.user_id::uuid AND b.user_b = auth.uid()))
  )
  ORDER BY up.display_name;
$$;
REVOKE EXECUTE ON FUNCTION sv_get_users_by_home_city(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_users_by_home_city(text) TO authenticated;

-- ── 20. Update my privacy settings ──
CREATE OR REPLACE FUNCTION sv_update_privacy_settings(
  p_who_can_follow text DEFAULT NULL,
  p_who_can_message text DEFAULT NULL,
  p_share_current_city boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_who_can_follow IS NOT NULL AND p_who_can_follow NOT IN ('everyone', 'approval_required', 'nobody') THEN
    RAISE EXCEPTION 'Invalid who_can_follow value';
  END IF;
  IF p_who_can_message IS NOT NULL AND p_who_can_message NOT IN ('contacts_only', 'people_i_follow', 'everyone') THEN
    RAISE EXCEPTION 'Invalid who_can_message value';
  END IF;

  INSERT INTO sv_user_privacy_settings (user_id, who_can_follow, who_can_message, share_current_city, updated_at)
  VALUES (auth.uid(),
    COALESCE(p_who_can_follow, 'everyone'),
    COALESCE(p_who_can_message, 'contacts_only'),
    COALESCE(p_share_current_city, false),
    now())
  ON CONFLICT (user_id) DO UPDATE SET
    who_can_follow = COALESCE(p_who_can_follow, sv_user_privacy_settings.who_can_follow),
    who_can_message = COALESCE(p_who_can_message, sv_user_privacy_settings.who_can_message),
    share_current_city = COALESCE(p_share_current_city, sv_user_privacy_settings.share_current_city),
    updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_update_privacy_settings(text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION sv_update_privacy_settings(text, text, boolean) TO authenticated;

-- ── 21. Get my privacy settings ──
CREATE OR REPLACE FUNCTION sv_get_my_privacy_settings()
RETURNS TABLE (
  who_can_follow text,
  who_can_message text,
  share_current_city boolean
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(who_can_follow, 'everyone'),
    COALESCE(who_can_message, 'contacts_only'),
    COALESCE(share_current_city, false)
  FROM sv_user_privacy_settings
  WHERE user_id = auth.uid()
  UNION ALL
  SELECT 'everyone', 'contacts_only', false
  WHERE NOT EXISTS (SELECT 1 FROM sv_user_privacy_settings WHERE user_id = auth.uid())
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION sv_get_my_privacy_settings() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_privacy_settings() TO authenticated;

-- ── 22. Can I message this user? ──
CREATE OR REPLACE FUNCTION sv_can_message_user(p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_privacy text;
  v_is_contact boolean;
  v_is_following boolean;
BEGIN
  IF p_target_user_id = auth.uid() THEN RETURN true; END IF;
  IF sv_is_blocked(p_target_user_id) THEN RETURN false; END IF;

  v_privacy := sv_get_message_privacy(p_target_user_id);
  IF v_privacy = 'everyone' THEN RETURN true; END IF;

  IF v_privacy = 'people_i_follow' THEN
    SELECT EXISTS(
      SELECT 1 FROM sv_relationships
      WHERE type = 'follow' AND user_a = p_target_user_id AND user_b = auth.uid() AND status = 'active'
    ) INTO v_is_following;
    RETURN v_is_following;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'network_contact' AND status = 'active'
    AND ((user_a = auth.uid() AND user_b = p_target_user_id)
         OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ) INTO v_is_contact;
  RETURN v_is_contact;
END;
$$;
REVOKE EXECUTE ON FUNCTION sv_can_message_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_message_user(uuid) TO authenticated;
