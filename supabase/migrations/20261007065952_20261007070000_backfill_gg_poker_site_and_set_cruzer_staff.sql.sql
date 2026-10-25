/*
# Fix GG Poker site branding + Set Cruzer as STAFF

## Part A: Backfill poker_site for legacy GG Poker spot
The spot "The Difference Between Good & Great?" is a GG Poker hand but has
poker_site = NULL. Backfill to 'ggpoker' so the poker-site branding resolver
displays the GG Poker logo.

## Part B: Add 'staff' role for Cruzer
Cruzer (user_id = ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32) currently has
'moderator' and 'universal_access' roles but no 'staff' role. The
sv_staff_get_accounts function now derives ROLE from sv_roles:
  superuser -> SUPERUSER
  staff -> STAFF
  else -> USER

Add a 'staff' role row so Cruzer shows as STAFF.

## Part C: Set Cruzer's staff title to 'Moderator'
Update user_profiles.title to 'Moderator' for Cruzer.
*/

-- Part A: Backfill GG Poker site for legacy spot
UPDATE public.content_spots
SET poker_site = 'ggpoker'
WHERE id = '3f77f7bf-332b-4645-8eba-0527ad04d969'
  AND poker_site IS NULL;

-- Part B: Add staff role for Cruzer
INSERT INTO public.sv_roles (user_id, role, status)
VALUES ('ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32', 'staff', 'active')
ON CONFLICT DO NOTHING;

-- Part C: Set staff title
UPDATE public.user_profiles
SET title = 'Moderator'
WHERE user_id = 'ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32';
