/*
# Contacts + General Feed Posting — Part 2: SECURITY DEFINER Functions

## Purpose
All server-side functions for contacts and general feed posting permission.
Tables were created in part 1 (20260817070001).
*/

-- ============================================================
-- 1. sv_can_post_general_feed()
-- ============================================================
CREATE OR REPLACE FUNCTION sv_can_post_general_feed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sv_general_feed_posting_requests
    WHERE user_id = auth.uid()
    AND status = 'approved'
  );
$$;

REVOKE EXECUTE ON FUNCTION sv_can_post_general_feed() FROM anon;
GRANT EXECUTE ON FUNCTION sv_can_post_general_feed() TO authenticated;

-- ============================================================
-- 2. CONTACT FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION sv_request_contact(p_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot add yourself as a contact';
  END IF;

  SELECT id INTO v_id FROM sv_relationships
  WHERE type = 'network_contact'
  AND ((user_a = auth.uid() AND user_b = p_target_user_id)
       OR (user_a = p_target_user_id AND user_b = auth.uid()))
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE sv_relationships
    SET status = 'pending', metadata = jsonb_build_object('initiated_by', auth.uid()),
        updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO sv_relationships (type, user_a, user_b, status, metadata)
  VALUES ('network_contact', auth.uid(), p_target_user_id, 'pending',
    jsonb_build_object('initiated_by', auth.uid()))
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'contact_requested', p_target_user_id,
    jsonb_build_object('relationship_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_request_contact(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_request_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sv_accept_contact(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
  v_status text;
BEGIN
  SELECT user_a, user_b, status INTO v_user_a, v_user_b, v_status
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Contact request is not pending'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE sv_relationships
  SET status = 'active', started_at = COALESCE(started_at, now()), updated_at = now()
  WHERE id = p_relationship_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'contact_accepted',
    CASE WHEN auth.uid() = v_user_a THEN v_user_b ELSE v_user_a END,
    jsonb_build_object('relationship_id', p_relationship_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_accept_contact(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_accept_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sv_decline_contact(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT user_a, user_b INTO v_user_a, v_user_b
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE sv_relationships
  SET status = 'declined', updated_at = now()
  WHERE id = p_relationship_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'contact_declined',
    CASE WHEN auth.uid() = v_user_a THEN v_user_b ELSE v_user_a END,
    jsonb_build_object('relationship_id', p_relationship_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_decline_contact(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_decline_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sv_remove_contact(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT user_a, user_b INTO v_user_a, v_user_b
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE sv_relationships
  SET status = 'removed', ended_at = now(), updated_at = now()
  WHERE id = p_relationship_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'contact_removed',
    CASE WHEN auth.uid() = v_user_a THEN v_user_b ELSE v_user_a END,
    jsonb_build_object('relationship_id', p_relationship_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_remove_contact(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_remove_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sv_get_my_contacts()
RETURNS TABLE (
  relationship_id uuid, user_id uuid, status text, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id,
    CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END AS user_id,
    status, created_at
  FROM sv_relationships
  WHERE type = 'network_contact'
  AND (user_a = auth.uid() OR user_b = auth.uid())
  AND status IN ('active', 'pending')
  ORDER BY
    CASE WHEN status = 'active' THEN 0 ELSE 1 END,
    created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_contacts() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_contacts() TO authenticated;

CREATE OR REPLACE FUNCTION sv_get_pending_contact_requests()
RETURNS TABLE (
  relationship_id uuid, requester_id uuid, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id,
    CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END AS requester_id,
    created_at
  FROM sv_relationships
  WHERE type = 'network_contact'
  AND status = 'pending'
  AND (user_a = auth.uid() OR user_b = auth.uid())
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_pending_contact_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_pending_contact_requests() TO authenticated;

-- ============================================================
-- 3. GENERAL FEED POSTING FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION sv_request_general_feed_posting(
  p_reason text,
  p_category text DEFAULT NULL,
  p_profile_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM sv_general_feed_posting_requests
    WHERE user_id = auth.uid() AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You already have general feed posting access';
  END IF;

  SELECT status INTO v_existing FROM sv_general_feed_posting_requests
  WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1;

  IF v_existing = 'pending' THEN
    RAISE EXCEPTION 'You already have a pending request';
  END IF;

  INSERT INTO sv_general_feed_posting_requests (user_id, reason, category, profile_link)
  VALUES (auth.uid(), p_reason, p_category, p_profile_link)
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'feed_posting_requested', auth.uid(),
    jsonb_build_object('request_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_request_general_feed_posting(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_request_general_feed_posting(text, text, text) TO authenticated;

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

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'feed_posting_approved', v_user_id,
    jsonb_build_object('request_id', p_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_approve_general_feed_posting(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_approve_general_feed_posting(uuid, text) TO authenticated;

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

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'feed_posting_revoked', v_user_id,
    jsonb_build_object('request_id', p_request_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_general_feed_posting(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_general_feed_posting(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sv_get_pending_feed_posting_requests()
RETURNS TABLE (
  id uuid, user_id uuid, status text, reason text, category text,
  profile_link text, created_at timestamptz, reviewed_at timestamptz, staff_note text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, user_id, status, reason, category, profile_link, created_at, reviewed_at, staff_note
  FROM sv_general_feed_posting_requests
  WHERE status = 'pending'
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_pending_feed_posting_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_pending_feed_posting_requests() TO authenticated;

CREATE OR REPLACE FUNCTION sv_get_all_feed_posting_requests()
RETURNS TABLE (
  id uuid, user_id uuid, status text, reason text, category text,
  profile_link text, created_at timestamptz, reviewed_at timestamptz, staff_note text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, user_id, status, reason, category, profile_link, created_at, reviewed_at, staff_note
  FROM sv_general_feed_posting_requests
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_all_feed_posting_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_all_feed_posting_requests() TO authenticated;

CREATE OR REPLACE FUNCTION sv_get_my_feed_posting_requests()
RETURNS TABLE (
  id uuid, status text, reason text, category text, staff_note text,
  created_at timestamptz, reviewed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, reason, category, staff_note, created_at, reviewed_at
  FROM sv_general_feed_posting_requests
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_feed_posting_requests() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_feed_posting_requests() TO authenticated;