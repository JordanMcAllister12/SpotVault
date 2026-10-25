/*
# Creator Application & Permission System

1. Purpose
   Not every user should be able to publish video spots or multi-spot analysis.
   This migration creates a staff-controlled approval system for creator permissions.
   Normal users can still create text spots without approval.

2. New Tables
   - `sv_creator_permissions` — tracks which users have been approved for which
     creator capabilities (can_publish_video_spots, can_create_multispot).
     One row per user. Staff grant/revoke permissions here.
   - `sv_creator_applications` — user-submitted applications requesting creator
     access. Staff review and approve/reject these.

3. sv_creator_permissions columns
   - user_id (uuid, FK auth.users, PK) — the user who has permissions
   - can_publish_video_spots (boolean, default false)
   - can_create_multispot (boolean, default false)
   - granted_by (uuid, FK auth.users) — staff member who approved
   - granted_at (timestamptz)
   - updated_at (timestamptz)

4. sv_creator_applications columns
   - id (uuid PK)
   - user_id (uuid, FK auth.users) — applicant
   - application_type (text) — 'video_spot', 'multispot', or 'both'
   - status (text) — 'pending', 'approved', 'rejected', 'info_requested'
   - real_name, poker_screen_names, main_poker_sites, game_type, stakes_abi,
     primary_formats, years_playing, documented_results, public_profile_links,
     other_results, coaching_experience, social_content_links, intended_content (all text)
   - attachment_urls (jsonb) — array of uploaded file URLs
   - staff_notes (text) — internal staff notes during review
   - reviewed_by (uuid, FK auth.users) — staff who reviewed
   - reviewed_at (timestamptz)
   - created_at, updated_at (timestamptz)

5. Security — RLS
   - sv_creator_permissions: users can read their own row. Staff can read all
     and update. Users cannot self-grant.
   - sv_creator_applications: users can read/create/update their own. Staff
     can read all and update (review).

6. Helper functions (SECURITY DEFINER)
   - sv_get_creator_permissions(p_user_id) — returns permission row or defaults
   - sv_can_publish_video_spots(p_user_id) — returns boolean
   - sv_can_create_multispot(p_user_id) — returns boolean
*/

-- ── Permissions table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sv_creator_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_publish_video_spots boolean NOT NULL DEFAULT false,
  can_create_multispot boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sv_creator_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_creator_perms" ON sv_creator_permissions;
CREATE POLICY "select_own_creator_perms"
ON sv_creator_permissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_select_creator_perms" ON sv_creator_permissions;
CREATE POLICY "staff_select_creator_perms"
ON sv_creator_permissions FOR SELECT
TO authenticated
USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_creator_perms" ON sv_creator_permissions;
CREATE POLICY "staff_insert_creator_perms"
ON sv_creator_permissions FOR INSERT
TO authenticated
WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_creator_perms" ON sv_creator_permissions;
CREATE POLICY "staff_update_creator_perms"
ON sv_creator_permissions FOR UPDATE
TO authenticated
USING (public.sv_is_staff_or_admin())
WITH CHECK (public.sv_is_staff_or_admin());

-- ── Applications table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sv_creator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_type text NOT NULL DEFAULT 'both' CHECK (application_type IN ('video_spot', 'multispot', 'both')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'info_requested')),
  real_name text DEFAULT '',
  poker_screen_names text DEFAULT '',
  main_poker_sites text DEFAULT '',
  game_type text DEFAULT '',
  stakes_abi text DEFAULT '',
  primary_formats text DEFAULT '',
  years_playing text DEFAULT '',
  documented_results text DEFAULT '',
  public_profile_links text DEFAULT '',
  other_results text DEFAULT '',
  coaching_experience text DEFAULT '',
  social_content_links text DEFAULT '',
  intended_content text DEFAULT '',
  attachment_urls jsonb DEFAULT '[]'::jsonb,
  staff_notes text DEFAULT '',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sv_creator_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_applications" ON sv_creator_applications;
CREATE POLICY "select_own_applications"
ON sv_creator_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_applications" ON sv_creator_applications;
CREATE POLICY "insert_own_applications"
ON sv_creator_applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_applications" ON sv_creator_applications;
CREATE POLICY "update_own_applications"
ON sv_creator_applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_select_applications" ON sv_creator_applications;
CREATE POLICY "staff_select_applications"
ON sv_creator_applications FOR SELECT
TO authenticated
USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_applications" ON sv_creator_applications;
CREATE POLICY "staff_update_applications"
ON sv_creator_applications FOR UPDATE
TO authenticated
USING (public.sv_is_staff_or_admin())
WITH CHECK (public.sv_is_staff_or_admin());

-- ── Helper functions (SECURITY DEFINER) ────────────────────────

CREATE OR REPLACE FUNCTION sv_get_creator_permissions(p_user_id uuid)
RETURNS TABLE (
  can_publish_video_spots boolean,
  can_create_multispot boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.can_publish_video_spots, false),
    COALESCE(p.can_create_multispot, false)
  FROM sv_creator_permissions p
  WHERE p.user_id = p_user_id
  UNION ALL
  SELECT false, false
  WHERE NOT EXISTS (SELECT 1 FROM sv_creator_permissions WHERE user_id = p_user_id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION sv_can_publish_video_spots(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT can_publish_video_spots FROM sv_creator_permissions WHERE user_id = p_user_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION sv_can_create_multispot(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT can_create_multispot FROM sv_creator_permissions WHERE user_id = p_user_id),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION sv_get_creator_permissions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_can_publish_video_spots(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_can_create_multispot(uuid) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON sv_creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON sv_creator_applications(user_id);
