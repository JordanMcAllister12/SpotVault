/*
# Fix Bryan Paris Coach Profile Data

## Problem
Bryan Paris's `coach_listings` row contains a placeholder biography
("Professional poker player and coach. Profile to be completed.") and
missing specialties, accomplishments, and other fields. His real profile
data exists in `user_profiles` and `src/data/peopleDirectory.ts`.

## Changes
Updates the `coach_listings` row for Bryan Paris (account_id =
'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba') with:

1. **bio** — replaced placeholder with his actual user_profiles bio
2. **coaching_description** — populated from his resume coaching summary
3. **specialties** — populated from his user_profiles specialties
4. **accomplishments** — populated from his resume headline
5. **stakes_coached** — '$500+ Buy-in Events' from his resume
6. **is_featured** — set to true (he is the featured coach)

## Data Sources
- `user_profiles` bio, specialties, title for Bryan Paris
- `src/data/peopleDirectory.ts` BRYAN_PARIS_RESUME for coaching summary,
  primary formats, and background

## Security
No RLS or schema changes. Only a data update to an existing row.
*/

UPDATE coach_listings
SET
  bio = 'COO at SpotVault and tournament poker coach. Focused on MTT strategy, hand analysis, and player development for serious tournament players.',
  coaching_description = 'Available for MTT coaching sessions focused on decision-making, hand analysis, and tournament dynamics for players competing in $500+ buy-in events.',
  specialties = ARRAY['MTT', 'Tournament Strategy', 'Hand Analysis', 'ICM', 'Final Table Play'],
  accomplishments = 'Professional poker player specializing in online multi-table tournaments, with a long history of competing at a high level across the major online poker platforms. 15+ years of experience. COO at SpotVault.',
  stakes_coached = ARRAY['$500+ Buy-in Events', 'High-Roller Tournaments'],
  is_featured = true,
  updated_at = now()
WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';
