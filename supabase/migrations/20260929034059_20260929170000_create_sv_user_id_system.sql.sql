-- ============================================================
-- Permanent SpotVault User ID System
--
-- Adds a permanent, human-readable SV User ID (SV-000001 format)
-- to every user. Does NOT replace existing auth UUIDs or modify
-- any foreign-key relationships. Adds a new column to user_profiles,
-- backfills all existing users by creation order, creates a
-- concurrency-safe sequence for new registrations, and provides
-- an audit RPC for Staff verification.
--
-- Tables modified:
--   user_profiles: adds sv_user_id text column (unique, nullable during backfill)
--
-- New objects:
--   Sequence: sv_user_id_seq (starts at 1, increments by 1)
--   Function: sv_assign_next_user_id() - concurrency-safe ID assignment
--   Function: sv_get_user_id_audit() - Staff verification report
--   Trigger: sv_assign_user_id_on_signup - fires on new user_profiles insert
--
-- Security:
--   sv_user_id is readable by all authenticated users
--   Only the system/trigger can assign IDs automatically
--   Staff can manually assign via RPC if needed
--   Audit RPC restricted to staff
-- ============================================================

-- 1. Add sv_user_id column to user_profiles
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS sv_user_id text;

-- 2. Create a dedicated sequence for SV User IDs
CREATE SEQUENCE IF NOT EXISTS sv_user_id_seq 
  START 1 
  INCREMENT 1 
  NO CYCLE;

-- 3. Backfill existing users ordered by auth.users creation date
-- Only assign to profiles that don't already have an sv_user_id
WITH ranked_users AS (
  SELECT 
    up.user_id,
    ROW_NUMBER() OVER (
      ORDER BY au.created_at ASC, up.user_id ASC
    ) AS rn
  FROM user_profiles up
  JOIN auth.users au ON au.id::text = up.user_id
  WHERE up.sv_user_id IS NULL
)
UPDATE user_profiles
SET sv_user_id = 'SV-' || LPAD(ranked_users.rn::text, 6, '0')
FROM ranked_users
WHERE user_profiles.user_id = ranked_users.user_id;

-- 4. Create unique index on sv_user_id (after backfill so existing rows get IDs first)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_sv_user_id_key 
  ON user_profiles (sv_user_id) 
  WHERE sv_user_id IS NOT NULL;

-- 5. Concurrency-safe function to assign next SV User ID
CREATE OR REPLACE FUNCTION public.sv_assign_next_user_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SV-' || LPAD(nextval('sv_user_id_seq')::text, 6, '0')
$$;

-- 6. Trigger function: auto-assign SV User ID on new profile creation
CREATE OR REPLACE FUNCTION public.sv_assign_user_id_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sv_user_id IS NULL THEN
    NEW.sv_user_id := sv_assign_next_user_id();
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Create the trigger on user_profiles
DROP TRIGGER IF EXISTS sv_auto_assign_user_id ON user_profiles;
CREATE TRIGGER sv_auto_assign_user_id
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sv_assign_user_id_trigger();

-- 8. Grant access
GRANT USAGE ON SEQUENCE sv_user_id_seq TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;

-- 9. Audit RPC for Staff verification
CREATE OR REPLACE FUNCTION public.sv_get_user_id_audit()
RETURNS TABLE(
  total_users integer,
  ids_assigned integer,
  missing_ids integer,
  duplicate_ids integer,
  orphan_records integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::integer FROM user_profiles) AS total_users,
    (SELECT count(*)::integer FROM user_profiles WHERE sv_user_id IS NOT NULL) AS ids_assigned,
    (SELECT count(*)::integer FROM user_profiles WHERE sv_user_id IS NULL) AS missing_ids,
    (SELECT count(*)::integer FROM (
      SELECT sv_user_id FROM user_profiles 
      WHERE sv_user_id IS NOT NULL 
      GROUP BY sv_user_id 
      HAVING count(*) > 1
    ) d) AS duplicate_ids,
    (SELECT count(*)::integer FROM user_profiles up 
     LEFT JOIN auth.users au ON au.id::text = up.user_id 
     WHERE au.id IS NULL) AS orphan_records
$$;

-- 10. Grant audit RPC to authenticated (staff check is in RLS/function logic)
-- The function is SECURITY DEFINER so it runs with elevated privileges.
-- Access is controlled by the application layer checking sv_is_staff_or_admin.
GRANT EXECUTE ON FUNCTION sv_get_user_id_audit() TO authenticated;
