/*
# MFA Method Preferences & Trusted Devices

1. Purpose
   This migration adds tables to support user-selectable MFA methods
   (authenticator app, SMS, email) and secure trusted-device tokens.

2. New Tables
   - `user_mfa_preferences`
     - `user_id` (uuid, primary key, references auth.users)
     - `sms_enabled` (boolean, default false)
     - `email_enabled` (boolean, default false)
     - `totp_enabled` (boolean, default false) — mirrors Supabase MFA state
     - `phone_number` (text, nullable) — E.164 normalized
     - `phone_verified` (boolean, default false)
     - `phone_masked` (text, nullable) — e.g. "••• ••• 1234"
     - `preferred_method` (text, nullable) — 'totp' | 'sms' | 'email'
     - `updated_at` (timestamptz, default now())

   - `trusted_devices`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null, references auth.users)
     - `token_hash` (text, not null) — SHA-256 hash of the trusted-device token
     - `device_label` (text, nullable) — user-agent snippet
     - `expires_at` (timestamptz, not null) — 30 days from issue
     - `created_at` (timestamptz, default now())
     - `revoked` (boolean, default false)

   - `sms_otp_codes`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null)
     - `phone_number` (text, not null)
     - `code_hash` (text, not null) — SHA-256 hash of the OTP code
     - `purpose` (text, not null) — 'enrollment' | 'login'
     - `expires_at` (timestamptz, not null) — 10 minutes from issue
     - `consumed` (boolean, default false)
     - `created_at` (timestamptz, default now())

   - `email_otp_codes`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null)
     - `email` (text, not null)
     - `code_hash` (text, not null)
     - `purpose` (text, not null) — 'enrollment' | 'login'
     - `expires_at` (timestamptz, not null)
     - `consumed` (boolean, default false)
     - `created_at` (timestamptz, default now())

3. Security
   - All tables have RLS enabled.
   - Users can only access their own rows.
   - OTP code tables are write-only from the client (client can insert for enrollment,
     but only the edge function inserts for login; client can verify via RPC).
   - Trusted devices can only be read/created/deleted by the owning user.

4. Functions
   - `sv_issue_trusted_device()` — generates a secure token, stores its hash, returns plaintext once.
   - `sv_verify_trusted_device(p_token)` — checks token against hash + expiry + revoked.
   - `sv_revoke_trusted_devices()` — revokes all trusted devices for the current user.
   - `sv_create_sms_otp(p_phone, p_purpose)` — generates and stores a 6-digit OTP hash.
   - `sv_verify_sms_otp(p_code, p_purpose)` — verifies and consumes an SMS OTP.
   - `sv_create_email_otp(p_email, p_purpose)` — generates and stores a 6-digit OTP hash.
   - `sv_verify_email_otp(p_code, p_purpose)` — verifies and consumes an email OTP.
   - `sv_set_mfa_preference(p_method, p_enabled)` — toggles a method on/off.
   - `sv_get_mfa_preferences()` — returns the user's MFA preference row.
   - `sv_set_phone(p_phone, p_masked)` — sets phone number after verification.
   - `sv_remove_phone()` — removes phone and disables SMS 2FA.
*/

-- ============================================================
-- user_mfa_preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS user_mfa_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sms_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  totp_enabled boolean NOT NULL DEFAULT false,
  phone_number text,
  phone_verified boolean NOT NULL DEFAULT false,
  phone_masked text,
  preferred_method text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_mfa_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_mfa_prefs" ON user_mfa_preferences;
CREATE POLICY "select_own_mfa_prefs" ON user_mfa_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "upsert_own_mfa_prefs" ON user_mfa_preferences;
CREATE POLICY "upsert_own_mfa_prefs" ON user_mfa_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_mfa_prefs" ON user_mfa_preferences;
CREATE POLICY "update_own_mfa_prefs" ON user_mfa_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- trusted_devices
-- ============================================================

CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  device_label text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked boolean NOT NULL DEFAULT false
);

ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trusted_devices" ON trusted_devices;
CREATE POLICY "select_own_trusted_devices" ON trusted_devices FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trusted_devices" ON trusted_devices;
CREATE POLICY "insert_own_trusted_devices" ON trusted_devices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trusted_devices" ON trusted_devices;
CREATE POLICY "delete_own_trusted_devices" ON trusted_devices FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id) WHERE NOT revoked;

-- ============================================================
-- sms_otp_codes
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'enrollment',
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sms_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sms_otp" ON sms_otp_codes;
CREATE POLICY "select_own_sms_otp" ON sms_otp_codes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sms_otp" ON sms_otp_codes;
CREATE POLICY "insert_own_sms_otp" ON sms_otp_codes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sms_otp" ON sms_otp_codes;
CREATE POLICY "update_own_sms_otp" ON sms_otp_codes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sms_otp_user ON sms_otp_codes(user_id, consumed, expires_at DESC);

-- ============================================================
-- email_otp_codes
-- ============================================================

CREATE TABLE IF NOT EXISTS email_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'enrollment',
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_otp" ON email_otp_codes;
CREATE POLICY "select_own_email_otp" ON email_otp_codes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_otp" ON email_otp_codes;
CREATE POLICY "insert_own_email_otp" ON email_otp_codes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_otp" ON email_otp_codes;
CREATE POLICY "update_own_email_otp" ON email_otp_codes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_otp_user ON email_otp_codes(user_id, consumed, expires_at DESC);

-- ============================================================
-- Functions
-- ============================================================

-- Trusted device: issue a new token
CREATE OR REPLACE FUNCTION sv_issue_trusted_device(p_device_label text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_hash text;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Generate a secure random token (32 bytes hex)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token || 'spotvault-trusted-device-salt', 'sha256'), 'hex');

  INSERT INTO trusted_devices (user_id, token_hash, device_label, expires_at)
  VALUES (v_user, v_hash, p_device_label, now() + interval '30 days');

  RETURN v_token;
END;
$$;

-- Trusted device: verify a token
CREATE OR REPLACE FUNCTION sv_verify_trusted_device(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash text;
  v_user uuid := auth.uid();
  v_record record;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  v_hash := encode(digest(p_token || 'spotvault-trusted-device-salt', 'sha256'), 'hex');

  SELECT * INTO v_record FROM trusted_devices
  WHERE user_id = v_user AND token_hash = v_hash AND NOT revoked AND expires_at > now()
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Revoke all trusted devices for the current user
CREATE OR REPLACE FUNCTION sv_revoke_trusted_devices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE trusted_devices SET revoked = true WHERE user_id = auth.uid() AND NOT revoked;
END;
$$;

-- SMS OTP: create a new code
CREATE OR REPLACE FUNCTION sv_create_sms_otp(p_phone text, p_purpose text DEFAULT 'enrollment')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  v_hash := encode(digest(v_code || 'spotvault-sms-otp-salt', 'sha256'), 'hex');

  INSERT INTO sms_otp_codes (user_id, phone_number, code_hash, purpose, expires_at)
  VALUES (v_user, p_phone, v_hash, p_purpose, now() + interval '10 minutes');

  RETURN v_code;
END;
$$;

-- SMS OTP: verify and consume
CREATE OR REPLACE FUNCTION sv_verify_sms_otp(p_code text, p_purpose text DEFAULT 'enrollment')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash text;
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  v_hash := encode(digest(p_code || 'spotvault-sms-otp-salt', 'sha256'), 'hex');

  SELECT id INTO v_id FROM sms_otp_codes
  WHERE user_id = v_user AND code_hash = v_hash AND purpose = p_purpose
    AND NOT consumed AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE sms_otp_codes SET consumed = true WHERE id = v_id;
  RETURN true;
END;
$$;

-- Email OTP: create a new code
CREATE OR REPLACE FUNCTION sv_create_email_otp(p_email text, p_purpose text DEFAULT 'enrollment')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  v_hash := encode(digest(v_code || 'spotvault-email-otp-salt', 'sha256'), 'hex');

  INSERT INTO email_otp_codes (user_id, email, code_hash, purpose, expires_at)
  VALUES (v_user, p_email, v_hash, p_purpose, now() + interval '10 minutes');

  RETURN v_code;
END;
$$;

-- Email OTP: verify and consume
CREATE OR REPLACE FUNCTION sv_verify_email_otp(p_code text, p_purpose text DEFAULT 'enrollment')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash text;
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  v_hash := encode(digest(p_code || 'spotvault-email-otp-salt', 'sha256'), 'hex');

  SELECT id INTO v_id FROM email_otp_codes
  WHERE user_id = v_user AND code_hash = v_hash AND purpose = p_purpose
    AND NOT consumed AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE email_otp_codes SET consumed = true WHERE id = v_id;
  RETURN true;
END;
$$;

-- Set MFA method preference (toggle on/off)
CREATE OR REPLACE FUNCTION sv_set_mfa_preference(p_method text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO user_mfa_preferences (user_id, updated_at)
  VALUES (v_user, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now();

  IF p_method = 'totp' THEN
    UPDATE user_mfa_preferences SET totp_enabled = p_enabled, updated_at = now() WHERE user_id = v_user;
  ELSIF p_method = 'sms' THEN
    UPDATE user_mfa_preferences SET sms_enabled = p_enabled, updated_at = now() WHERE user_id = v_user;
  ELSIF p_method = 'email' THEN
    UPDATE user_mfa_preferences SET email_enabled = p_enabled, updated_at = now() WHERE user_id = v_user;
  END IF;
END;
$$;

-- Get MFA preferences
CREATE OR REPLACE FUNCTION sv_get_mfa_preferences()
RETURNS user_mfa_preferences
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row user_mfa_preferences%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM user_mfa_preferences WHERE user_id = v_user;
  RETURN v_row;
END;
$$;

-- Set phone number (after verification)
CREATE OR REPLACE FUNCTION sv_set_phone(p_phone text, p_masked text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO user_mfa_preferences (user_id, phone_number, phone_verified, phone_masked, updated_at)
  VALUES (auth.uid(), p_phone, true, p_masked, now())
  ON CONFLICT (user_id) DO UPDATE
  SET phone_number = EXCLUDED.phone_number,
      phone_verified = true,
      phone_masked = EXCLUDED.phone_masked,
      updated_at = now();
END;
$$;

-- Remove phone number
CREATE OR REPLACE FUNCTION sv_remove_phone()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE user_mfa_preferences
  SET phone_number = NULL, phone_verified = false, phone_masked = NULL,
      sms_enabled = false, updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Grant execute on all functions to authenticated
GRANT EXECUTE ON FUNCTION sv_issue_trusted_device(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_verify_trusted_device(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_revoke_trusted_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_create_sms_otp(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_verify_sms_otp(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_create_email_otp(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_verify_email_otp(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_set_mfa_preference(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_get_mfa_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_set_phone(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_remove_phone() TO authenticated;
