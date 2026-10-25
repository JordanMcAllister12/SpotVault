/*
# Phase 2 — Relationships (Coach/Student, Stable/Player, Multi-Coach)

## Purpose
Creates the centralized relationship system that connects users. This replaces the
ad-hoc student_coach_connections table with a generalized relationship model that
supports multiple coaches per student, stable-player relationships, and more.

## New Tables

### sv_relationships
A generalized relationship between two users. Supports coach_student, stable_player,
business_employee, creator_customer, and more.
- id (uuid, primary key)
- type (text: 'coach_student' | 'stable_player' | 'business_employee' | 'creator_customer')
- user_a (uuid — the "provider" side: coach, stable, business, creator)
- user_b (uuid — the "recipient" side: student, player, employee, customer)
- status (text: 'pending' | 'active' | 'paused' | 'ended' | 'blocked')
- is_primary (boolean — designates primary coach etc)
- metadata (jsonb — for role labels, specialization, etc)
- started_at, ended_at, created_at, updated_at

## Security
- RLS enabled
- Both participants can read the relationship
- Mutations go through SECURITY DEFINER functions (sv_create_relationship, sv_end_relationship)
- Direct client INSERT/UPDATE/DELETE revoked

## Important Notes
1. Does NOT modify the existing student_coach_connections table — old data stays intact.
2. A coach must have an actual relationship with a student to access their data — being
   an approved coach does NOT grant access to all students.
3. Relationship does NOT automatically mean full data access — ShareSync grants (Phase 3)
   control actual resource access.
4. Supports multiple coaches per student (primary MTT coach, mental-game coach, etc).
*/

CREATE TABLE IF NOT EXISTS sv_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('coach_student', 'stable_player', 'business_employee', 'creator_customer')),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'ended', 'blocked')),
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_relationships_user_a_idx ON sv_relationships (user_a, status);
CREATE INDEX IF NOT EXISTS sv_relationships_user_b_idx ON sv_relationships (user_b, status);
CREATE INDEX IF NOT EXISTS sv_relationships_type_idx ON sv_relationships (type, status);

ALTER TABLE sv_relationships ENABLE ROW LEVEL SECURITY;

-- Both participants can read the relationship
DROP POLICY IF EXISTS "sv_relationships_select_participants" ON sv_relationships;
CREATE POLICY "sv_relationships_select_participants" ON sv_relationships FOR SELECT
  TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid());

-- All mutations through SECURITY DEFINER functions
REVOKE INSERT ON sv_relationships FROM anon, authenticated;
REVOKE UPDATE ON sv_relationships FROM anon, authenticated;
REVOKE DELETE ON sv_relationships FROM anon, authenticated;

-- ============================================================
-- SECURITY DEFINER: Create Relationship
-- ============================================================
CREATE OR REPLACE FUNCTION sv_create_relationship(
  p_type text,
  p_user_a uuid,
  p_user_b uuid,
  p_is_primary boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing text;
BEGIN
  IF p_type NOT IN ('coach_student', 'stable_player', 'business_employee', 'creator_customer') THEN
    RAISE EXCEPTION 'Invalid relationship type';
  END IF;

  IF auth.uid() != p_user_a AND auth.uid() != p_user_b THEN
    RAISE EXCEPTION 'Not authorized: must be a participant';
  END IF;

  SELECT status INTO v_existing
  FROM sv_relationships
  WHERE type = p_type
  AND ((user_a = p_user_a AND user_b = p_user_b) OR (user_a = p_user_b AND user_b = p_user_a))
  LIMIT 1;

  IF v_existing = 'active' THEN
    RAISE EXCEPTION 'Relationship already exists and is active';
  END IF;

  IF v_existing = 'pending' THEN
    UPDATE sv_relationships
    SET status = 'active', started_at = now(), updated_at = now()
    WHERE type = p_type
    AND ((user_a = p_user_a AND user_b = p_user_b) OR (user_a = p_user_b AND user_b = p_user_a))
    AND status = 'pending'
    RETURNING id INTO v_id;

    INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
    VALUES (auth.uid(), 'relationship_created', p_user_b, jsonb_build_object('type', p_type, 'status', 'active'));
    RETURN v_id;
  END IF;

  INSERT INTO sv_relationships (type, user_a, user_b, status, is_primary, metadata, started_at)
  VALUES (p_type, p_user_a, p_user_b, 'pending', p_is_primary, p_metadata,
    CASE WHEN auth.uid() = p_user_a AND auth.uid() = p_user_b THEN now() ELSE NULL END)
  RETURNING id INTO v_id;

  INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
  VALUES (auth.uid(), 'relationship_created',
    CASE WHEN auth.uid() = p_user_a THEN p_user_b ELSE p_user_a END,
    jsonb_build_object('type', p_type, 'status', 'pending'));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_create_relationship(text, uuid, uuid, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION sv_create_relationship(text, uuid, uuid, boolean, jsonb) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: End Relationship
-- ============================================================
CREATE OR REPLACE FUNCTION sv_end_relationship(p_relationship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text;
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT type, user_a, user_b INTO v_type, v_user_a, v_user_b
  FROM sv_relationships WHERE id = p_relationship_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  IF auth.uid() != v_user_a AND auth.uid() != v_user_b THEN
    RAISE EXCEPTION 'Not authorized: must be a participant';
  END IF;

  UPDATE sv_relationships
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE id = p_relationship_id;

  BEGIN
    UPDATE sv_resource_grants
    SET revoked_at = now()
    WHERE relationship_id = p_relationship_id
    AND revoked_at IS NULL;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  INSERT INTO sv_access_audit_log (actor_id, action, resource_type, metadata)
  VALUES (auth.uid(), 'relationship_ended', NULL,
    jsonb_build_object('relationship_id', p_relationship_id, 'type', v_type,
      'user_a', v_user_a, 'user_b', v_user_b));
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_end_relationship(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_end_relationship(uuid) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: Get My Relationships
-- ============================================================
CREATE OR REPLACE FUNCTION sv_get_my_relationships(p_type text DEFAULT NULL)
RETURNS TABLE (
  id uuid, type text, user_a uuid, user_b uuid, status text,
  is_primary boolean, metadata jsonb, started_at timestamptz, ended_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, type, user_a, user_b, status, is_primary, metadata, started_at, ended_at
  FROM sv_relationships
  WHERE (user_a = auth.uid() OR user_b = auth.uid())
  AND (p_type IS NULL OR type = p_type);
$$;

REVOKE EXECUTE ON FUNCTION sv_get_my_relationships(text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_get_my_relationships(text) TO authenticated;

-- ============================================================
-- SECURITY DEFINER: Check Active Relationship
-- ============================================================
CREATE OR REPLACE FUNCTION sv_has_relationship(
  p_target_user_id uuid,
  p_type text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sv_relationships
    WHERE type = p_type
    AND status = 'active'
    AND (
      (user_a = auth.uid() AND user_b = p_target_user_id)
      OR (user_b = auth.uid() AND user_a = p_target_user_id)
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION sv_has_relationship(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION sv_has_relationship(uuid, text) TO authenticated;