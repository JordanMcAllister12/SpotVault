/*
# Coach Applications System

1. New Tables
- `coach_applications` — invitation-based coach onboarding applications
  - `id` uuid PK
  - `user_id` text NOT NULL — the applicant's auth.uid()::text
  - `invitation_id` uuid — links to coach_invitations row (nullable for direct applications)
  - `status` text — draft, submitted, under_review, approved, rejected, changes_requested
  - `application_data` jsonb — structured multi-section form data
  - `staff_notes` text — internal staff notes during review
  - `reviewed_by` uuid — staff member who reviewed
  - `reviewed_at` timestamptz
  - `created_at`, `updated_at` timestamptz

- `coach_invitations` — staff-issued invitations to become a coach
  - `id` uuid PK
  - `invitee_email` text — email of invited person
  - `invitee_user_id` text — optionally linked to existing user
  - `invited_by` uuid — staff member who sent invitation
  - `status` text — pending, accepted, expired, revoked
  - `message` text — optional personal message
  - `expires_at` timestamptz — invitation expiry
  - `created_at` timestamptz

2. Security
- `coach_applications`: RLS enabled — owner can CRUD own drafts, staff can review
- `coach_invitations`: RLS enabled — invitee can see/accept, staff can create/revoke
3. Indexes on user_id, status for both tables
4. Also adds is_test_account to user_profiles and is_featured to coach_listings
*/

-- ═══════════════════════════════════════════════════════════════
-- COACH INVITATIONS (must be created first — referenced by applications)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitee_email text NOT NULL,
  invitee_user_id text,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  message text DEFAULT '',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_coach_invitations_email ON coach_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_status ON coach_invitations(status);

DROP POLICY IF EXISTS "coach_invitations_select_invitee" ON coach_invitations;
DROP POLICY IF EXISTS "coach_invitations_select_staff" ON coach_invitations;
DROP POLICY IF EXISTS "coach_invitations_insert_staff" ON coach_invitations;
DROP POLICY IF EXISTS "coach_invitations_update_invitee" ON coach_invitations;
DROP POLICY IF EXISTS "coach_invitations_update_staff" ON coach_invitations;
DROP POLICY IF EXISTS "coach_invitations_delete_staff" ON coach_invitations;

CREATE POLICY "coach_invitations_select_invitee" ON coach_invitations
  FOR SELECT TO authenticated
  USING (auth.uid()::text = invitee_user_id);

CREATE POLICY "coach_invitations_select_staff" ON coach_invitations
  FOR SELECT TO authenticated
  USING (public.sv_is_staff_or_admin());

CREATE POLICY "coach_invitations_insert_staff" ON coach_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.sv_is_staff_or_admin());

CREATE POLICY "coach_invitations_update_invitee" ON coach_invitations
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = invitee_user_id)
  WITH CHECK (auth.uid()::text = invitee_user_id);

CREATE POLICY "coach_invitations_update_staff" ON coach_invitations
  FOR UPDATE TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

CREATE POLICY "coach_invitations_delete_staff" ON coach_invitations
  FOR DELETE TO authenticated
  USING (public.sv_is_staff_or_admin());

-- ═══════════════════════════════════════════════════════════════
-- COACH APPLICATIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  invitation_id uuid REFERENCES coach_invitations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'changes_requested')),
  application_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  staff_notes text DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_coach_applications_user ON coach_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_applications_status ON coach_applications(status);

DROP POLICY IF EXISTS "coach_applications_select_own" ON coach_applications;
DROP POLICY IF EXISTS "coach_applications_select_staff" ON coach_applications;
DROP POLICY IF EXISTS "coach_applications_insert_own" ON coach_applications;
DROP POLICY IF EXISTS "coach_applications_update_own" ON coach_applications;
DROP POLICY IF EXISTS "coach_applications_update_staff" ON coach_applications;
DROP POLICY IF EXISTS "coach_applications_delete_staff" ON coach_applications;

CREATE POLICY "coach_applications_select_own" ON coach_applications
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "coach_applications_select_staff" ON coach_applications
  FOR SELECT TO authenticated
  USING (public.sv_is_staff_or_admin());

CREATE POLICY "coach_applications_insert_own" ON coach_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "coach_applications_update_own" ON coach_applications
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "coach_applications_update_staff" ON coach_applications
  FOR UPDATE TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

CREATE POLICY "coach_applications_delete_staff" ON coach_applications
  FOR DELETE TO authenticated
  USING (public.sv_is_staff_or_admin());

-- ═══════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trg_coach_applications_set_updated_at'
  ) THEN
    CREATE FUNCTION public.trg_coach_applications_set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_coach_applications_updated_at ON coach_applications;
CREATE TRIGGER trg_coach_applications_updated_at
  BEFORE UPDATE ON coach_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_coach_applications_set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ADD is_test_account TO user_profiles, is_featured TO coach_listings
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

ALTER TABLE coach_listings
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;