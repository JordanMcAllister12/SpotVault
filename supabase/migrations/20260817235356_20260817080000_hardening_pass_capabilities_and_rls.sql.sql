/*
# Hardening Pass: Fix RLS, Add Capabilities, Protect Staff Notes

## Changes
1. Drop old permissive anon_* policies on network_chat_messages
2. Create sv_user_capabilities table for explicit capability tracking
3. Update sv_can_post_general_feed() to check active capability
4. Update approve/revoke functions to grant/revoke explicit capability
5. Fix sv_get_my_feed_posting_requests to exclude staff_note
*/

-- ============================================================
-- 1. DROP old permissive anon policies on network_chat_messages
-- ============================================================
DROP POLICY IF EXISTS "anon_delete_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "anon_insert_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "anon_select_chat_messages" ON network_chat_messages;
DROP POLICY IF EXISTS "anon_update_chat_messages" ON network_chat_messages;

-- ============================================================
-- 2. CREATE sv_user_capabilities table
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_user_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  source_request_id uuid REFERENCES sv_general_feed_posting_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, capability)
);

CREATE INDEX IF NOT EXISTS sv_uc_user_capability_idx ON sv_user_capabilities (user_id, capability, status);

ALTER TABLE sv_user_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_uc_select_own" ON sv_user_capabilities;
CREATE POLICY "sv_uc_select_own" ON sv_user_capabilities FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE sv_roles.user_id = auth.uid()
      AND sv_roles.role = 'staff'
      AND sv_roles.status = 'active'
    )
  );

REVOKE INSERT ON sv_user_capabilities FROM anon, authenticated;
REVOKE UPDATE ON sv_user_capabilities FROM anon, authenticated;
REVOKE DELETE ON sv_user_capabilities FROM anon, authenticated;

-- ============================================================
-- 3. UPDATE sv_can_post_general_feed() to check explicit capability
-- ============================================================
CREATE OR REPLACE FUNCTION sv_can_post_general_feed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sv_user_capabilities
    WHERE user_id = auth.uid()
    AND capability = 'general_feed_post'
    AND status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION sv_can_post_general_feed() FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_general_feed() TO authenticated;

-- ============================================================
-- 4. UPDATE approve function to grant explicit capability
-- ============================================================
CREATE OR REPLACE FUNCTION sv_approve_general_feed_posting(
  p_request_id uuid,
  p_staff_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid() AND sv_roles.role = 'staff' AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff only';
  END IF;

  SELECT user_id INTO v_user_id FROM sv_general_feed_posting_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE sv_general_feed_posting_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      staff_note = p_staff_note, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, source_request_id)
  VALUES (v_user_id, 'general_feed_post', 'active', auth.uid(), p_request_id)
  ON CONFLICT (user_id, capability)
  DO UPDATE SET status = 'active', granted_by = auth.uid(), granted_at = now(),
      revoked_by = NULL, revoked_at = NULL, source_request_id = p_request_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'feed_posting_approved', v_user_id,
    jsonb_build_object('request_id', p_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_approve_general_feed_posting(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_approve_general_feed_posting(uuid, text) TO authenticated;

-- ============================================================
-- 5. UPDATE reject function
-- ============================================================
CREATE OR REPLACE FUNCTION sv_reject_general_feed_posting(
  p_request_id uuid,
  p_staff_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid() AND sv_roles.role = 'staff' AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff only';
  END IF;

  SELECT user_id INTO v_user_id FROM sv_general_feed_posting_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE sv_general_feed_posting_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      staff_note = p_staff_note, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'feed_posting_rejected', v_user_id,
    jsonb_build_object('request_id', p_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_reject_general_feed_posting(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_reject_general_feed_posting(uuid, text) TO authenticated;

-- ============================================================
-- 6. UPDATE revoke function to revoke explicit capability
-- ============================================================
CREATE OR REPLACE FUNCTION sv_revoke_general_feed_posting(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sv_roles
    WHERE sv_roles.user_id = auth.uid() AND sv_roles.role = 'staff' AND sv_roles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized: staff only';
  END IF;

  SELECT user_id INTO v_user_id FROM sv_general_feed_posting_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE sv_general_feed_posting_requests
  SET status = 'revoked', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  UPDATE sv_user_capabilities
  SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
  WHERE user_id = v_user_id AND capability = 'general_feed_post';

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'feed_posting_revoked', v_user_id,
    jsonb_build_object('request_id', p_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_general_feed_posting(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_general_feed_posting(uuid) TO authenticated;

-- ============================================================
-- 7. DROP and recreate sv_get_my_feed_posting_requests without staff_note
-- ============================================================
DROP FUNCTION IF EXISTS sv_get_my_feed_posting_requests();

CREATE FUNCTION sv_get_my_feed_posting_requests()
RETURNS TABLE (
  id uuid, status text, reason text, category text,
  created_at timestamptz, reviewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, reason, category, created_at, reviewed_at
  FROM sv_general_feed_posting_requests
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_feed_posting_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_feed_posting_requests() TO authenticated;