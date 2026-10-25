/*
# Tighten Coach Profile Ownership RLS

## Purpose
Enforce that only the profile owner can edit their own coaching profile data.
Previously, coach_result_images and coach_reviews had `using=true` on all
CRUD policies, meaning any authenticated user could modify any coach's
data. This migration scopes write operations to the owner via the
`app.current_account_id` session setting (same pattern already used by
the coach_listings SELECT policy).

## Changes

### coach_listings
- UPDATE: restricted to own `account_id` (was `using=true`)
- DELETE: restricted to own `account_id` (was `using=true`)
- INSERT: restricted to own `account_id` (was `with_check=true`)
- SELECT: unchanged (published OR own)

### coach_result_images
- SELECT: unchanged (public — anyone can view a coach's results)
- INSERT: must own the coach profile (`coach_account_id` matches)
- UPDATE: must own the coach profile
- DELETE: must own the coach profile

### coach_reviews
- SELECT: unchanged (public — anyone can view reviews)
- INSERT: student must own the review (`student_account_id` matches)
- UPDATE: coach must own the reviewed profile (`coach_account_id` matches)
- DELETE: coach must own the reviewed profile

## Security
All write policies now use `current_setting('app.current_account_id'::text, true)`
for ownership verification, consistent with the existing coach_listings SELECT policy.
*/

-- ── coach_listings: tighten writes ──
DROP POLICY IF EXISTS "update_coach_listings" ON coach_listings;
CREATE POLICY "update_coach_listings"
ON coach_listings FOR UPDATE
TO anon, authenticated
USING (account_id = current_setting('app.current_account_id'::text, true))
WITH CHECK (account_id = current_setting('app.current_account_id'::text, true));

DROP POLICY IF EXISTS "delete_coach_listings" ON coach_listings;
CREATE POLICY "delete_coach_listings"
ON coach_listings FOR DELETE
TO anon, authenticated
USING (account_id = current_setting('app.current_account_id'::text, true));

DROP POLICY IF EXISTS "insert_coach_listings" ON coach_listings;
CREATE POLICY "insert_coach_listings"
ON coach_listings FOR INSERT
TO anon, authenticated
WITH CHECK (account_id = current_setting('app.current_account_id'::text, true));

-- ── coach_result_images: tighten writes, keep SELECT public ──
DROP POLICY IF EXISTS "anon_insert_result_images" ON coach_result_images;
CREATE POLICY "owner_insert_result_images"
ON coach_result_images FOR INSERT
TO anon, authenticated
WITH CHECK (coach_account_id = current_setting('app.current_account_id'::text, true));

DROP POLICY IF EXISTS "anon_update_result_images" ON coach_result_images;
CREATE POLICY "owner_update_result_images"
ON coach_result_images FOR UPDATE
TO anon, authenticated
USING (coach_account_id = current_setting('app.current_account_id'::text, true))
WITH CHECK (coach_account_id = current_setting('app.current_account_id'::text, true));

DROP POLICY IF EXISTS "anon_delete_result_images" ON coach_result_images;
CREATE POLICY "owner_delete_result_images"
ON coach_result_images FOR DELETE
TO anon, authenticated
USING (coach_account_id = current_setting('app.current_account_id'::text, true));

-- ── coach_reviews: tighten writes, keep SELECT public ──
DROP POLICY IF EXISTS "anon_insert_reviews" ON coach_reviews;
CREATE POLICY "student_insert_reviews"
ON coach_reviews FOR INSERT
TO anon, authenticated
WITH CHECK (student_account_id = current_setting('app.current_account_id'::text, true));

DROP POLICY IF EXISTS "anon_update_reviews" ON coach_reviews;
CREATE POLICY "coach_update_reviews"
ON coach_reviews FOR UPDATE
TO anon, authenticated
USING (coach_account_id = current_setting('app.current_account_id'::text, true))
WITH CHECK (coach_account_id = current_setting('app.current_account_id'::text, true));

DROP POLICY IF EXISTS "anon_delete_reviews" ON coach_reviews;
CREATE POLICY "coach_delete_reviews"
ON coach_reviews FOR DELETE
TO anon, authenticated
USING (coach_account_id = current_setting('app.current_account_id'::text, true));
