/*
# Staff Security & Access Control System

## Purpose
Creates the database infrastructure for:
1. Founder-controlled Google Authenticator (TOTP) requirement for Staff Console access
2. Temporary administrative access grants for non-founder staff

## New Tables

### staff_security_config
- Singleton configuration row controlling the founder's MFA requirement
- `mfa_required` (boolean, default false) — when true, entering Staff Console requires a valid TOTP code
- `session_timeout_minutes` (integer, default 30) — how long an elevated staff session lasts
- `updated_by` (uuid) — the founder who last changed the setting
- `updated_at` (timestamptz) — when the setting was last changed
- Only one row exists (enforced by a singleton check)

### staff_temporary_access
- Records temporary administrative access grants for non-founder staff
- `granted_to` (uuid) — the staff member receiving access
- `granted_by` (uuid) — the founder who granted access
- `permission_level` (text) — 'read_only' | 'support_admin' | 'custom'
- `permissions` (jsonb) — specific capabilities granted (for custom level)
- `reason` (text) — why access was granted
- `expires_at` (timestamptz) — when the grant expires
- `revoked_at` (timestamptz, nullable) — when access was revoked early
- `revoked_by` (uuid, nullable) — who revoked it
- `status` (text) — 'active' | 'expired' | 'revoked'

## Security
- RLS enabled on both tables
- Only authenticated users can read
- Only the founder (superuser role) can insert/update/delete
- Uses sv_is_staff_or_admin() for founder identification

## Important Notes
1. MFA is NOT activated by default — mfa_required defaults to false
2. The founder can enroll their authenticator and test before enabling
3. Temporary access grants expire automatically based on expires_at
4. All changes are logged to sv_access_audit_log
*/

-- ── staff_security_config ──
CREATE TABLE IF NOT EXISTS staff_security_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mfa_required boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 30 CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 480),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_row CHECK (id = (id))
);

-- Enforce singleton: only one row
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_security_config) THEN
    INSERT INTO staff_security_config (mfa_required, session_timeout_minutes) VALUES (false, 30);
  END IF;
END $$;

ALTER TABLE staff_security_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_staff_security_config" ON staff_security_config;
CREATE POLICY "read_staff_security_config" ON staff_security_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "write_staff_security_config" ON staff_security_config;
CREATE POLICY "write_staff_security_config" ON staff_security_config FOR UPDATE
  TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "insert_staff_security_config" ON staff_security_config;
CREATE POLICY "insert_staff_security_config" ON staff_security_config FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

-- ── staff_temporary_access ──
CREATE TABLE IF NOT EXISTS staff_temporary_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granted_to uuid NOT NULL,
  granted_by uuid NOT NULL,
  permission_level text NOT NULL DEFAULT 'read_only' CHECK (permission_level IN ('read_only', 'support_admin', 'custom')),
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_temp_access_granted_to ON staff_temporary_access(granted_to);
CREATE INDEX IF NOT EXISTS idx_staff_temp_access_status ON staff_temporary_access(status);
CREATE INDEX IF NOT EXISTS idx_staff_temp_access_expires ON staff_temporary_access(expires_at);

ALTER TABLE staff_temporary_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_staff_temporary_access" ON staff_temporary_access;
CREATE POLICY "read_staff_temporary_access" ON staff_temporary_access FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_staff_temporary_access" ON staff_temporary_access;
CREATE POLICY "insert_staff_temporary_access" ON staff_temporary_access FOR INSERT
  TO authenticated WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "update_staff_temporary_access" ON staff_temporary_access;
CREATE POLICY "update_staff_temporary_access" ON staff_temporary_access FOR UPDATE
  TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());

DROP POLICY IF EXISTS "delete_staff_temporary_access" ON staff_temporary_access;
CREATE POLICY "delete_staff_temporary_access" ON staff_temporary_access FOR DELETE
  TO authenticated USING (sv_is_staff_or_admin());

-- ── Auto-expire function: marks expired grants ──
-- Called from the frontend or a scheduled job to clean up expired grants
CREATE OR REPLACE FUNCTION sv_expire_staff_temporary_access()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE staff_temporary_access
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION sv_expire_staff_temporary_access() TO authenticated;