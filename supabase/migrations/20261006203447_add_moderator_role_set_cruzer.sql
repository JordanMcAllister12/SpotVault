/*
# Add moderator role and set cruzer account

1. Expand sv_roles check constraint
   - Add 'moderator' to the allowed role values.
   - Drop the old constraint and create a new one with moderator included.

2. Fix sv_user_id_seq
   - The sequence is out of sync. Set it to 13 (current max) so next insert gets SV-000014.

3. User account correction
   - User: ljdloewen@hotmail.com (auth id: ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32)
   - Insert user_profiles row: username = 'cruzer', display_name = 'Cruzer'

4. Moderator role assignment
   - Insert sv_roles row: role = 'moderator', status = 'active'
   - Moderator is its own role, distinct from staff/superuser.

5. Idempotent
   - ON CONFLICT for user_profiles upsert
   - WHERE NOT EXISTS for sv_roles insert
*/

-- 1. Expand the check constraint to include 'moderator'
ALTER TABLE sv_roles DROP CONSTRAINT IF EXISTS sv_roles_role_check;
ALTER TABLE sv_roles ADD CONSTRAINT sv_roles_role_check
  CHECK (role = ANY (ARRAY['player', 'coach', 'creator', 'investor', 'stable_operator', 'business', 'staff', 'superuser', 'admin', 'owner', 'moderator']));

-- 2. Fix sequence
SELECT setval('sv_user_id_seq', 13);

-- 3. Upsert user_profiles row for cruzer
INSERT INTO user_profiles (user_id, username, display_name, primary_role, poker_role, privacy_mode)
VALUES (
  'ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32',
  'cruzer',
  'Cruzer',
  'player',
  '',
  'public'
)
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    updated_at = now();

-- 4. Insert moderator role (idempotent)
INSERT INTO sv_roles (user_id, role, status)
SELECT 'ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32', 'moderator', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM sv_roles
  WHERE user_id = 'ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32'
    AND role = 'moderator'
);
