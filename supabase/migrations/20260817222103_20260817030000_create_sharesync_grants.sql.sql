/*
# Phase 3 — ShareSync: Resource Grants + Permission Levels

## Purpose
Implements the ShareSync system: permission-based access to ORIGINAL resources.
The resource remains owned by the original owner — no duplicate copies are created.

## New Tables

### sv_resource_grants
A grant giving a recipient permission to access the original resource.
- id (uuid, primary key)
- resource_type (text: 'hand' | 'hand_collection' | 'tournament' | 'session' | 'analytics_dataset' | 'analytics_report' | 'library_item' | 'spot' | 'video' | 'course' | 'study_set' | 'coaching_recording' | 'transcript')
- resource_id (uuid — the ID of the resource in its source table)
- owner_id (uuid — the user who owns the resource)
- recipient_id (uuid — the user receiving access)
- relationship_id (uuid, nullable — the relationship that justifies this grant)
- permission_level (text: 'view' | 'review' | 'collaborate' | 'manage')
- created_by (uuid — who created the grant, usually the owner)
- expires_at (timestamptz, nullable)
- revoked_at (timestamptz, nullable)
- created_at

### sv_entitlements
Durable access rights from purchases or subscriptions. Separate from ShareSync
because purchases create consume/access rights, not ownership.
- id (uuid, primary key)
- user_id (uuid — the purchaser/subscriber)
- resource_type (text)
- resource_id (uuid)
- entitlement_type (text: 'purchase' | 'subscription')
- granted_at (timestamptz)
- expires_at (timestamptz, nullable — NULL for permanent purchases)
- revoked_at (timestamptz, nullable)
- metadata (jsonb)
- created_at

## Security
- sv_resource_grants: RLS enabled. Owner and recipient can read their grants.
  Mutations through SECURITY DEFINER functions only.
- sv_entitlements: RLS enabled. User can read their own entitlements.
  Mutations through SECURITY DEFINER functions only.

## Important Notes
1. ShareSync references the ORIGINAL resource — if the owner updates it, the recipient
   sees the current authorized version.
2. Revoking a grant immediately removes access (server-side, not just UI hiding).
3. Permission levels are bundles: VIEW (read), REVIEW (read + study tools),
   COLLABORATE (review + comments/notes), MANAGE (modify resource).
4. Entitlements are separate from ShareSync: a purchase gives consume rights, not
   edit/republish/sell rights.
*/

-- ============================================================
-- 1. RESOURCE GRANTS (ShareSync)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_resource_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id uuid REFERENCES sv_relationships(id) ON DELETE SET NULL,
  permission_level text NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'review', 'collaborate', 'manage')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS sv_grants_recipient_idx ON sv_resource_grants (recipient_id, revoked_at);
CREATE INDEX IF NOT EXISTS sv_grants_owner_idx ON sv_resource_grants (owner_id, revoked_at);
CREATE INDEX IF NOT EXISTS sv_grants_resource_idx ON sv_resource_grants (resource_type, resource_id, revoked_at);
CREATE INDEX IF NOT EXISTS sv_grants_relationship_idx ON sv_resource_grants (relationship_id);

ALTER TABLE sv_resource_grants ENABLE ROW LEVEL SECURITY;

-- Owner and recipient can read grants
DROP POLICY IF EXISTS "sv_grants_select_participants" ON sv_resource_grants;
CREATE POLICY "sv_grants_select_participants" ON sv_resource_grants FOR SELECT
  TO authenticated USING (owner_id = auth.uid() OR recipient_id = auth.uid());

REVOKE INSERT ON sv_resource_grants FROM anon, authenticated;
REVOKE UPDATE ON sv_resource_grants FROM anon, authenticated;
REVOKE DELETE ON sv_resource_grants FROM anon, authenticated;

-- ============================================================
-- 2. ENTITLEMENTS (Purchases / Subscriptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  entitlement_type text NOT NULL CHECK (entitlement_type IN ('purchase', 'subscription')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_type, resource_id, entitlement_type)
);

CREATE INDEX IF NOT EXISTS sv_entitlements_user_idx ON sv_entitlements (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS sv_entitlements_resource_idx ON sv_entitlements (resource_type, resource_id);

ALTER TABLE sv_entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlements
DROP POLICY IF EXISTS "sv_entitlements_select_own" ON sv_entitlements;
CREATE POLICY "sv_entitlements_select_own" ON sv_entitlements FOR SELECT
  TO authenticated USING (user_id = auth.uid());

REVOKE INSERT ON sv_entitlements FROM anon, authenticated;
REVOKE UPDATE ON sv_entitlements FROM anon, authenticated;
REVOKE DELETE ON sv_entitlements FROM anon, authenticated;

-- ============================================================
-- 3. SECURITY DEFINER: Create ShareSync Grant
-- ============================================================
-- Only the resource owner can grant access to their resource.
CREATE OR REPLACE FUNCTION sv_create_grant(
  p_resource_type text,
  p_resource_id uuid,
  p_recipient_id uuid,
  p_permission_level text DEFAULT 'view',
  p_relationship_id uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_owner_id uuid;
BEGIN
  IF p_permission_level NOT IN ('view', 'review', 'collaborate', 'manage') THEN
    RAISE EXCEPTION 'Invalid permission level';
  END IF;

  -- Verify caller owns the resource
  SELECT owner_id INTO v_owner_id
  FROM sv_resource_ownership
  WHERE resource_type = p_resource_type AND resource_id = p_resource_id AND owner_type = 'user';

  IF v_owner_id IS NULL OR v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: you do not own this resource';
  END IF;

  INSERT INTO sv_resource_grants (
    resource_type, resource_id, owner_id, recipient_id,
    relationship_id, permission_level, created_by, expires_at
  )
  VALUES (
    p_resource_type, p_resource_id, v_owner_id, p_recipient_id,
    p_relationship_id, p_permission_level, auth.uid(), p_expires_at
  )
  ON CONFLICT (resource_type, resource_id, recipient_id) DO UPDATE
    SET permission_level = EXCLUDED.permission_level,
        relationship_id = EXCLUDED.relationship_id,
        expires_at = EXCLUDED.expires_at,
        revoked_at = NULL
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, resource_type, resource_id, target_user_id, metadata)
  VALUES (auth.uid(), 'resource_shared', p_resource_type, p_resource_id, p_recipient_id,
    jsonb_build_object('permission_level', p_permission_level, 'grant_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_create_grant(text, uuid, uuid, text, uuid, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION sv_create_grant(text, uuid, uuid, text, uuid, timestamptz) TO authenticated;

-- ============================================================
-- 4. SECURITY DEFINER: Revoke ShareSync Grant
-- ============================================================
CREATE OR REPLACE FUNCTION sv_revoke_grant(p_grant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_recipient_id uuid;
  v_resource_type text;
  v_resource_id uuid;
BEGIN
  SELECT owner_id, recipient_id, resource_type, resource_id
  INTO v_owner_id, v_recipient_id, v_resource_type, v_resource_id
  FROM sv_resource_grants WHERE id = p_grant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grant not found';
  END IF;

  IF auth.uid() != v_owner_id THEN
    RAISE EXCEPTION 'Not authorized: only the owner can revoke';
  END IF;

  UPDATE sv_resource_grants SET revoked_at = now() WHERE id = p_grant_id;

  INSERT INTO sv_access_audit_log (actor_id, action, resource_type, resource_id, target_user_id, metadata)
  VALUES (auth.uid(), 'sharesync_revoked', v_resource_type, v_resource_id, v_recipient_id,
    jsonb_build_object('grant_id', p_grant_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_grant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_grant(uuid) TO authenticated;

-- ============================================================
-- 5. SECURITY DEFINER: Check Permission Level
-- ============================================================
-- Returns the permission level for a recipient on a resource, or NULL if no access.
CREATE OR REPLACE FUNCTION sv_check_permission(
  p_resource_type text,
  p_resource_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_permission text;
  v_owner_id uuid;
BEGIN
  -- Check direct ownership
  SELECT owner_id INTO v_owner_id
  FROM sv_resource_ownership
  WHERE resource_type = p_resource_type AND resource_id = p_resource_id AND owner_type = 'user';

  IF v_owner_id = auth.uid() THEN
    RETURN 'owner';
  END IF;

  -- Check active grants
  SELECT permission_level INTO v_permission
  FROM sv_resource_grants
  WHERE resource_type = p_resource_type
  AND resource_id = p_resource_id
  AND recipient_id = auth.uid()
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_permission IS NOT NULL THEN
    RETURN v_permission;
  END IF;

  -- Check entitlements
  SELECT 'view' INTO v_permission
  FROM sv_entitlements
  WHERE resource_type = p_resource_type
  AND resource_id = p_resource_id
  AND user_id = auth.uid()
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_permission IS NOT NULL THEN
    RETURN v_permission;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_check_permission(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_check_permission(text, uuid) TO authenticated;

-- ============================================================
-- 6. SECURITY DEFINER: Grant Entitlement
-- ============================================================
-- Called after a purchase or subscription activation.
CREATE OR REPLACE FUNCTION sv_grant_entitlement(
  p_user_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_entitlement_type text,
  p_expires_at timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_entitlement_type NOT IN ('purchase', 'subscription') THEN
    RAISE EXCEPTION 'Invalid entitlement type';
  END IF;

  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, expires_at, metadata)
  VALUES (p_user_id, p_resource_type, p_resource_id, p_entitlement_type, p_expires_at, p_metadata)
  ON CONFLICT (user_id, resource_type, resource_id, entitlement_type) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        revoked_at = NULL,
        metadata = EXCLUDED.metadata,
        granted_at = now()
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, resource_type, resource_id, target_user_id, metadata)
  VALUES (auth.uid(), 'entitlement_granted', p_resource_type, p_resource_id, p_user_id,
    jsonb_build_object('entitlement_type', p_entitlement_type, 'entitlement_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_grant_entitlement(uuid, text, uuid, text, timestamptz, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION sv_grant_entitlement(uuid, text, uuid, text, timestamptz, jsonb) TO authenticated;

-- ============================================================
-- 7. SECURITY DEFINER: Revoke Entitlement
-- ============================================================
CREATE OR REPLACE FUNCTION sv_revoke_entitlement(p_entitlement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM sv_entitlements WHERE id = p_entitlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entitlement not found'; END IF;

  UPDATE sv_entitlements SET revoked_at = now() WHERE id = p_entitlement_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'entitlement_revoked', v_user_id, jsonb_build_object('entitlement_id', p_entitlement_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_revoke_entitlement(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_revoke_entitlement(uuid) TO authenticated;

-- ============================================================
-- 8. SECURITY DEFINER: Get My Grants (as recipient)
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_grants(p_resource_type text DEFAULT NULL)
RETURNS TABLE (
  id uuid, resource_type text, resource_id uuid, owner_id uuid,
  permission_level text, expires_at timestamptz, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, resource_type, resource_id, owner_id, permission_level, expires_at, created_at
  FROM sv_resource_grants
  WHERE recipient_id = auth.uid()
  AND revoked_at IS NULL
  AND (p_resource_type IS NULL OR resource_type = p_resource_type);
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_grants(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_grants(text) TO authenticated;

-- ============================================================
-- 9. SECURITY DEFINER: Get My Entitlements
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_entitlements()
RETURNS TABLE (
  id uuid, resource_type text, resource_id uuid,
  entitlement_type text, expires_at timestamptz, metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, resource_type, resource_id, entitlement_type, expires_at, metadata
  FROM sv_entitlements
  WHERE user_id = auth.uid()
  AND revoked_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_entitlements() FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_entitlements() TO authenticated;