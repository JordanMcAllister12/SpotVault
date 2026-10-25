/*
# Account Security — Security Events & Recovery Codes

1. Purpose
   This migration creates two tables to support the Account Security system:
   - `security_events`: An audit log of important security actions (password changes, MFA enrollment, email changes, etc.)
   - `recovery_codes`: Stores hashed backup recovery codes for 2FA recovery.

2. New Tables
   - `security_events`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null, defaults to auth.uid())
     - `event_type` (text, not null) — e.g. 'password_changed', 'mfa_enabled', 'mfa_disabled', 'email_changed', 'phone_changed', 'recovery_codes_regenerated', 'session_revoked'
     - `metadata` (jsonb, default '{}')
     - `ip_address` (text, nullable)
     - `created_at` (timestamptz, default now())
   - `recovery_codes`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null, unique — one set of codes per user)
     - `codes_hashed` (jsonb, not null) — array of hashed code strings
     - `generated_at` (timestamptz, default now())

3. Security
   - Both tables have RLS enabled.
   - `security_events`: Users can only read/insert their own events.
   - `recovery_codes`: Users can only read/update/delete their own codes.
   - No anon access — authenticated only.

4. Notes
   - Recovery codes are stored as hashed values (SHA-256), never in plaintext.
   - Security events are append-only (no UPDATE or DELETE policies).
   - The `sv_log_security_event` function allows users to log their own security events.
   - The `sv_verify_recovery_code` function atomically verifies and consumes a recovery code.
*/

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_security_events" ON security_events;
CREATE POLICY "select_own_security_events" ON security_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_security_events" ON security_events;
CREATE POLICY "insert_own_security_events" ON security_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid(),
  codes_hashed jsonb NOT NULL,
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recovery_codes" ON recovery_codes;
CREATE POLICY "select_own_recovery_codes" ON recovery_codes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "upsert_own_recovery_codes" ON recovery_codes;
CREATE POLICY "upsert_own_recovery_codes" ON recovery_codes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recovery_codes" ON recovery_codes;
CREATE POLICY "update_own_recovery_codes" ON recovery_codes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recovery_codes" ON recovery_codes;
CREATE POLICY "delete_own_recovery_codes" ON recovery_codes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id, created_at DESC);
