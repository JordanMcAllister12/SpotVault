/*
# Add Presentation ID System

## Purpose
Add a human-readable, collision-resistant presentation ID (format: SV-PRES-XXXXX) to
the sv_presentation_recordings table, inspired by the existing Build a Hand ID system.

## Changes

1. New column
   - `sv_presentation_recordings.presentation_id` (text, unique)
     - Format: SV-PRES-XXXXX where XXXXX is 5 alphanumeric characters
     - Used for shareable links like /presentation/SV-PRES-8K42M

2. New function
   - `sv_generate_presentation_id()` — generates a unique SV-PRES-XXXXX ID,
     checks for collisions, retries up to 5 times.
     - SECURITY DEFINER, owned by postgres
     - EXECUTE granted to authenticated only

3. Security
   - Unique index on presentation_id
   - Existing RLS on sv_presentation_recordings remains owner-scoped
*/

-- Add presentation_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_presentation_recordings'
    AND column_name = 'presentation_id'
  ) THEN
    ALTER TABLE sv_presentation_recordings ADD COLUMN presentation_id text;
  END IF;
END $$;

-- Unique index on presentation_id (partial — only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS sv_presentation_recordings_presentation_id_key
  ON sv_presentation_recordings (presentation_id)
  WHERE presentation_id IS NOT NULL;

-- Function to generate a unique presentation ID
CREATE OR REPLACE FUNCTION sv_generate_presentation_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts int := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_id := 'SV-PRES-';
    FOR i IN 1..5 LOOP
      v_id := v_id || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;

    -- Check for collision
    IF NOT EXISTS (SELECT 1 FROM sv_presentation_recordings WHERE presentation_id = v_id) THEN
      RETURN v_id;
    END IF;

    IF v_attempts >= 5 THEN
      -- Fallback: append random number to ensure uniqueness
      v_id := v_id || '-' || floor(random() * 100000)::text;
      RETURN v_id;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute to authenticated only
REVOKE EXECUTE ON FUNCTION sv_generate_presentation_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sv_generate_presentation_id() TO authenticated;
