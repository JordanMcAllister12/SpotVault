/*
# Add account verification + coach ratings + fix Jordan location

## Changes
1. user_profiles: Add is_verified boolean column (default false) for account-level verification
2. user_profiles: Set Jordan McAllister is_verified = true, location = 'Winnipeg, Manitoba, Canada'
3. coach_listings: Add coach_rating_average numeric and coach_rating_count integer columns for coaching ratings
4. coach_listings: Set Bryan Paris demo rating (4.9, 27) as explicitly marked demo data

## Security
- is_verified is account-level: means SpotVault verified the identity, NOT an endorsement of poker ability
- coach_rating_average and coach_rating_count are system-managed fields, not user-editable
- No RLS policy changes needed for these columns (existing policies cover the tables)
*/

-- 1. Add is_verified to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 2. Set Jordan verified + location
UPDATE user_profiles
SET is_verified = true,
    location = 'Winnipeg, Manitoba, Canada'
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170';

-- 3. Add coach rating columns to coach_listings
ALTER TABLE coach_listings
  ADD COLUMN IF NOT EXISTS coach_rating_average numeric(2,1) NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS coach_rating_count integer NOT NULL DEFAULT 0;

-- 4. Set Bryan's demo coach rating (explicitly demo data)
UPDATE coach_listings
SET coach_rating_average = 4.9,
    coach_rating_count = 27
WHERE account_id = 'd421b1bd-f8c6-4cd0-b68f-40ae275e99ba';