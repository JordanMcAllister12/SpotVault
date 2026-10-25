/*
# Quick Login PIN — Variable-Length, Trusted-Device-Bound

1. Purpose
   This migration adds a Quick Login PIN system that lets users on a previously
   trusted device sign in with a short numeric PIN instead of their full password.
   The PIN is:
     - Variable length (4–12 digits, user-chosen)
     - Optional (users can set it up or skip it)
     - NOT 2FA — it does not replace the user's password or MFA
     - Only usable on a trusted device (trusted_devices table already exists)
   Security relies on:
     - Trusted-device binding (must have a valid trusted device token)
     - Secure hashing (SHA-256 with salt, never plaintext)
     - Failed-attempt throttling (max 5 attempts, then 15-minute lockout)
     - After lockout, full password + 2FA is required

2. New Tables
   - `user_quick_pin`
     - `user_id` (uuid, primary key, references auth.users ON DELETE CASCADE)
     - `pin_hash` (text, not null) — SHA-256 hash of the PIN with salt
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, default now())
   - `quick_pin_attempts`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null, references auth.users ON DELETE CASCADE)
     - `attempted_at` (timestamptz, default now())
     - `success` (boolean, not null)

3. Security
   - RLS enabled on both tables.
   - user_quick_pin: owner can SELECT (to check if set), but INSERT/UPDATE/DELETE
     only via SECURITY DEFINER RPC (so the client never writes the hash directly).
   - quick_pin_attempts: INSERT via SECURITY DEFINER only (client cannot read
     or write this table directly).
   - All PIN operations go through RPC functions that verify auth.uid().

4. Functions
   - `sv_set_quick_pin(p_pin text)` — validates 4–12 digits, hashes, stores.
     Requires authenticated session. Overwrites any existing PIN.
   - `sv_remove_quick_pin()` — deletes the user's PIN.
   - `sv_verify_quick_pin(p_pin text, p_device_token text)` — verifies the PIN
     AND that the device is trusted. Records the attempt. Returns true on success.
     On failure, returns false (generic — does not reveal whether PIN length or
     value was wrong). After 5 failed attempts in 15 minutes, returns false and
     sets a lockout (subsequent calls return false until lockout expires).
   - `sv_has_quick_pin()` — returns boolean indicating whether the current user
     has a PIN set. Does NOT reveal the PIN or its length.
   - `sv_is_quick_pin_locked()` — returns boolean indicating whether the user
     is currently locked out of quick PIN login.

5. Important Notes
   - The PIN hash uses a per-user salt derived from the user's UUID + a static
     application salt. This prevents rainbow table attacks.
   - The `sv_verify_quick_pin` function checks the trusted device token FIRST.
     If the device is not trusted, it returns false without checking the PIN —
     an attacker on an untrusted device gets no information.
   - Failed attempts are tracked in `quick_pin_attempts`. The lockout window is
     15 minutes. After 5 failed attempts within that window, the account is
     locked for quick PIN login until the window expires.
   - The lockout does NOT affect full password + 2FA login — the user can
     always fall back to that.
*/

-- ============================================================
-- user_quick_pin
-- ============================================================

CREATE TABLE IF NOT EXISTS user_quick_pin (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_quick_pin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_quick_pin" ON user_quick_pin;
CREATE POLICY "select_own_quick_pin" ON user_quick_pin FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- quick_pin_attempts
-- ============================================================

CREATE TABLE IF NOT EXISTS quick_pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL
);

ALTER TABLE quick_pin_attempts ENABLE ROW LEVEL SECURITY;

-- No direct policies — all access via SECURITY DEFINER functions

CREATE INDEX IF NOT EXISTS idx_quick_pin_attempts_user_time
  ON quick_pin_attempts(user_id, attempted_at DESC);

-- ============================================================
-- Functions
-- ============================================================

-- Set or update the quick PIN (4–12 digits)
CREATE OR REPLACE FUNCTION sv_set_quick_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate: numeric only, 4–12 digits
  IF p_pin !~ '^[0-9]{4,12}$' THEN
    RAISE EXCEPTION 'PIN must be 4–12 digits';
  END IF;

  -- Hash with per-user salt
  v_hash := encode(digest(p_pin || v_user::text || 'spotvault-quickpin-salt', 'sha256'), 'hex');

  INSERT INTO user_quick_pin (user_id, pin_hash, created_at, updated_at)
  VALUES (v_user, v_hash, now(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash, updated_at = now();
END;
$$;

-- Remove the quick PIN
CREATE OR REPLACE FUNCTION sv_remove_quick_pin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM user_quick_pin WHERE user_id = auth.uid();
END;
$$;

-- Check if the current user has a quick PIN set
CREATE OR REPLACE FUNCTION sv_has_quick_pin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM user_quick_pin WHERE user_id = v_user) INTO v_exists;
  RETURN v_exists;
END;
$$;

-- Check if the user is currently locked out of quick PIN
CREATE OR REPLACE FUNCTION sv_is_quick_pin_locked()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_fail_count int;
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO v_fail_count
  FROM quick_pin_attempts
  WHERE user_id = v_user
    AND success = false
    AND attempted_at > now() - interval '15 minutes';
  RETURN v_fail_count >= 5;
END;
$$;

-- Verify a quick PIN attempt
-- p_pin: the PIN entered by the user
-- p_device_token: the trusted device token from localStorage
-- Returns true only if: device is trusted AND PIN matches AND not locked out
CREATE OR REPLACE FUNCTION sv_verify_quick_pin(p_pin text, p_device_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pin_hash text;
  v_stored_hash text;
  v_device_hash text;
  v_device_record record;
  v_locked boolean;
  v_fail_count int;
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;

  -- Check lockout
  SELECT count(*) INTO v_fail_count
  FROM quick_pin_attempts
  WHERE user_id = v_user
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  IF v_fail_count >= 5 THEN
    -- Record the attempt (still locked)
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  -- Verify trusted device
  IF p_device_token IS NULL OR p_device_token = '' THEN
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  v_device_hash := encode(digest(p_device_token || 'spotvault-trusted-device-salt', 'sha256'), 'hex');

  SELECT * INTO v_device_record FROM trusted_devices
  WHERE user_id = v_user AND token_hash = v_device_hash AND NOT revoked AND expires_at > now()
  LIMIT 1;

  IF v_device_record IS NULL THEN
    -- Untrusted device — record failure, return false
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  -- Verify PIN
  v_pin_hash := encode(digest(p_pin || v_user::text || 'spotvault-quickpin-salt', 'sha256'), 'hex');

  SELECT pin_hash INTO v_stored_hash FROM user_quick_pin WHERE user_id = v_user;

  IF v_stored_hash IS NULL THEN
    -- No PIN set
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  IF v_pin_hash = v_stored_hash THEN
    -- Success — record it
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, true);
    RETURN true;
  ELSE
    -- Wrong PIN — record failure
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION sv_set_quick_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_remove_quick_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_has_quick_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_is_quick_pin_locked() TO authenticated;
GRANT EXECUTE ON FUNCTION sv_verify_quick_pin(text, text) TO authenticated;
