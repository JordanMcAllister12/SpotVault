/*
# Expand user_profiles primary_role check constraint

Adds 'universal_access' to the allowed primary_role values so that
accounts with the universal access role can store it in their profile.
*/

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_primary_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_primary_role_check
  CHECK (primary_role = ANY (ARRAY[
    'player', 'coach', 'creator', 'stable', 'business', 'investor',
    'universal_access'
  ]));

-- Now update Donnelle's primary_role
UPDATE public.user_profiles
SET primary_role = 'universal_access'
WHERE user_id = 'ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32';
