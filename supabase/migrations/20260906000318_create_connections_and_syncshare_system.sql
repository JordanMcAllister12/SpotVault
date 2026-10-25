/*
# Connections and SyncShare System

1. New Tables
- sv_connections: Mutually approved user relationships for private sharing
- sv_syncshares: Synchronized content sharing from creator to recipient

2. Security
- sv_connections: Owner-scoped CRUD (auth.uid() = requester_id OR target_id)
- sv_syncshares: Owner (owner_id) can create/update/delete; recipient can read their own

3. Functions
- sv_send_connection_request, sv_accept_connection_request, sv_decline_connection_request
- sv_list_connections, sv_list_pending_connection_requests, sv_are_connected
- sv_list_my_syncshares, sv_list_shared_by_me, sv_revoke_syncshare
*/

-- ── sv_connections ──

CREATE TABLE IF NOT EXISTS sv_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(requester_id, target_id)
);

ALTER TABLE sv_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_connections" ON sv_connections;
CREATE POLICY "select_own_connections" ON sv_connections FOR SELECT
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "insert_own_connection_request" ON sv_connections;
CREATE POLICY "insert_own_connection_request" ON sv_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "update_own_connection" ON sv_connections;
CREATE POLICY "update_own_connection" ON sv_connections FOR UPDATE
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "delete_own_connection" ON sv_connections;
CREATE POLICY "delete_own_connection" ON sv_connections FOR DELETE
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- ── sv_syncshares ──

CREATE TABLE IF NOT EXISTS sv_syncshares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('content_spot', 'jukebox_product')),
  content_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  share_scope text NOT NULL DEFAULT 'selected_connections' CHECK (share_scope IN ('all_connections', 'selected_connections', 'off')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_type, content_id, recipient_id)
);

ALTER TABLE sv_syncshares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_syncshares" ON sv_syncshares;
CREATE POLICY "select_own_syncshares" ON sv_syncshares FOR SELECT
  TO authenticated USING (auth.uid() = owner_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "insert_own_syncshare" ON sv_syncshares;
CREATE POLICY "insert_own_syncshare" ON sv_syncshares FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_syncshare" ON sv_syncshares;
CREATE POLICY "update_own_syncshare" ON sv_syncshares FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_syncshare" ON sv_syncshares;
CREATE POLICY "delete_own_syncshare" ON sv_syncshares FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- ── Functions ──

CREATE OR REPLACE FUNCTION public.sv_send_connection_request(p_target_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_status text;
BEGIN
  IF auth.uid() = p_target_id THEN
    RETURN 'self';
  END IF;

  SELECT status INTO existing_status FROM sv_connections
  WHERE (requester_id = auth.uid() AND target_id = p_target_id)
     OR (requester_id = p_target_id AND target_id = auth.uid());

  IF existing_status = 'accepted' THEN RETURN 'already_connected'; END IF;
  IF existing_status = 'pending' THEN RETURN 'already_pending'; END IF;

  INSERT INTO sv_connections (requester_id, target_id, status)
  VALUES (auth.uid(), p_target_id, 'pending')
  ON CONFLICT (requester_id, target_id) DO UPDATE SET status = 'pending', responded_at = NULL;

  RETURN 'sent';
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_send_connection_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_accept_connection_request(p_requester_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE sv_connections
  SET status = 'accepted', responded_at = now()
  WHERE requester_id = p_requester_id AND target_id = auth.uid() AND status = 'pending';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_accept_connection_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_decline_connection_request(p_requester_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE sv_connections
  SET status = 'declined', responded_at = now()
  WHERE requester_id = p_requester_id AND target_id = auth.uid() AND status = 'pending';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_decline_connection_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_list_connections()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  connected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN c.requester_id = auth.uid() THEN c.target_id ELSE c.requester_id END as user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    c.responded_at as connected_at
  FROM sv_connections c
  JOIN user_profiles p ON p.user_id = CASE WHEN c.requester_id = auth.uid() THEN c.target_id ELSE c.requester_id END
  WHERE c.status = 'accepted'
    AND (c.requester_id = auth.uid() OR c.target_id = auth.uid())
  ORDER BY c.responded_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_list_connections() TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_list_pending_connection_requests()
RETURNS TABLE (
  requester_id uuid,
  display_name text,
  username text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.requester_id,
    p.display_name,
    p.username,
    p.avatar_url,
    c.created_at
  FROM sv_connections c
  JOIN user_profiles p ON p.user_id = c.requester_id
  WHERE c.target_id = auth.uid() AND c.status = 'pending'
  ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_list_pending_connection_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_are_connected(p_other_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM sv_connections
  WHERE status = 'accepted'
    AND ((requester_id = auth.uid() AND target_id = p_other_user_id)
      OR (requester_id = p_other_user_id AND target_id = auth.uid()));
  RETURN cnt > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_are_connected(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_list_my_syncshares()
RETURNS TABLE (
  id uuid,
  content_type text,
  content_id uuid,
  owner_id uuid,
  owner_name text,
  message text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.content_type,
    s.content_id,
    s.owner_id,
    p.display_name as owner_name,
    s.message,
    s.created_at
  FROM sv_syncshares s
  JOIN user_profiles p ON p.user_id = s.owner_id
  WHERE s.recipient_id = auth.uid() AND s.status = 'active'
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_list_my_syncshares() TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_list_shared_by_me()
RETURNS TABLE (
  id uuid,
  content_type text,
  content_id uuid,
  recipient_id uuid,
  recipient_name text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.content_type,
    s.content_id,
    s.recipient_id,
    p.display_name as recipient_name,
    s.status,
    s.created_at
  FROM sv_syncshares s
  JOIN user_profiles p ON p.user_id = s.recipient_id
  WHERE s.owner_id = auth.uid()
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_list_shared_by_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_revoke_syncshare(p_syncshare_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE sv_syncshares SET status = 'revoked', updated_at = now()
  WHERE id = p_syncshare_id AND owner_id = auth.uid();
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_revoke_syncshare(uuid) TO authenticated;
