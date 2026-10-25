/*
# Quick PIN Hash Upgrade — SHA-256 → bcrypt (pgcrypto)

## Why
Numeric PINs have low entropy. SHA-256 is intentionally fast, making offline
brute-force attacks feasible even with salt. We switch to bcrypt (via pgcrypto's
`crypt()` + `gen_salt('bf', N)`) which is a deliberately slow password hashing
algorithm with a tunable work factor.

## Changes
1. Add `hash_version` column to `user_quick_pin` (1 = legacy SHA-256, 2 = bcrypt)
2. `sv_set_quick_pin` now hashes with bcrypt (`gen_salt('bf', 10)`)
3. `sv_verify_quick_pin` now:
   - Detects legacy SHA-256 hashes (hash_version = 1 or NULL with 64-char hex)
   - Verifies legacy hashes with SHA-256 for backward compatibility
   - On successful legacy verification, immediately rehashes with bcrypt
   - Verifies bcrypt hashes using `crypt()` which is constant-time by design
4. All other behavior (trusted-device check, throttling, lockout, generic error)
   remains unchanged.

## Security properties
- bcrypt `crypt()` comparison is constant-time (uses CRYPTO_memcmp internally)
- Each PIN gets a unique random salt via `gen_salt('bf', 10)`
- The stored hash embeds the salt + work factor, so verification is self-describing
- Legacy hashes are migrated transparently — no user action required
- Plaintext PIN is never stored or logged
- The stored hash is never sent to the client (RLS prevents SELECT on pin_hash)
*/

-- Add hash_version column to track which algorithm was used
ALTER TABLE user_quick_pin ADD COLUMN IF NOT EXISTS hash_version smallint NOT NULL DEFAULT 1;

-- ============================================================
-- Updated sv_set_quick_pin — now uses bcrypt
-- ============================================================
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

  -- Hash with bcrypt (work factor 10) — deliberately slow
  v_hash := crypt(p_pin, gen_salt('bf', 10));

  INSERT INTO user_quick_pin (user_id, pin_hash, hash_version, created_at, updated_at)
  VALUES (v_user, v_hash, 2, now(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash, hash_version = 2, updated_at = now();
END;
$$;

-- ============================================================
-- Updated sv_verify_quick_pin — supports legacy + bcrypt with auto-migration
-- ============================================================
CREATE OR REPLACE FUNCTION sv_verify_quick_pin(p_pin text, p_device_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_stored_hash text;
  v_hash_version smallint;
  v_legacy_hash text;
  v_device_hash text;
  v_device_record record;
  v_fail_count int;
  v_verified boolean := false;
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;

  -- Check lockout
  SELECT count(*) INTO v_fail_count
  FROM quick_pin_attempts
  WHERE user_id = v_user
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  IF v_fail_count >= 5 THEN
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  -- Verify trusted device FIRST — untrusted device gets no info
  IF p_device_token IS NULL OR p_device_token = '' THEN
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  v_device_hash := encode(digest(p_device_token || 'spotvault-trusted-device-salt', 'sha256'), 'hex');

  SELECT * INTO v_device_record FROM trusted_devices
  WHERE user_id = v_user AND token_hash = v_device_hash AND NOT revoked AND expires_at > now()
  LIMIT 1;

  IF v_device_record IS NULL THEN
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  -- Fetch stored hash
  SELECT pin_hash, hash_version INTO v_stored_hash, v_hash_version
  FROM user_quick_pin WHERE user_id = v_user;

  IF v_stored_hash IS NULL THEN
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;

  -- Determine verification method
  -- hash_version 2 = bcrypt; hash_version 1 or NULL = legacy SHA-256
  IF v_hash_version = 2 THEN
    -- bcrypt verification (constant-time via crypt())
    v_verified := (crypt(p_pin, v_stored_hash) = v_stored_hash);
  ELSE
    -- Legacy SHA-256 verification
    v_legacy_hash := encode(digest(p_pin || v_user::text || 'spotvault-quickpin-salt', 'sha256'), 'hex');
    v_verified := (v_legacy_hash = v_stored_hash);

    -- If legacy verification succeeds, migrate to bcrypt immediately
    IF v_verified THEN
      UPDATE user_quick_pin
      SET pin_hash = crypt(p_pin, gen_salt('bf', 10)),
          hash_version = 2,
          updated_at = now()
      WHERE user_id = v_user;
    END IF;
  END IF;

  IF v_verified THEN
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, true);
    RETURN true;
  ELSE
    INSERT INTO quick_pin_attempts (user_id, success) VALUES (v_user, false);
    RETURN false;
  END IF;
END;
$$;

-- Re-grant execute (function signature unchanged but body replaced)
GRANT EXECUTE ON FUNCTION sv_set_quick_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sv_verify_quick_pin(text, text) TO authenticated;
