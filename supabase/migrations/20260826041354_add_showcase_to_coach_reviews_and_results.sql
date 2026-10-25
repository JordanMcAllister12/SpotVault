/*
# Add showcase columns to coach reviews and result images

1. Changes to `coach_reviews`
   - Add `is_showcased` boolean (default false) — lets a coach flag up to 2 reviews
     to display on their public coaching profile.
   - Add `showcase_order` integer (default 0) — controls display order of featured reviews.

2. Changes to `coach_result_images`
   - `is_featured` already exists (boolean, default false). Previously the app treated
     this as exclusive (only one featured at a time). The column already supports
     multiple rows being true, so no schema change is needed — the app logic will
     allow 2–4 featured results instead of a single exclusive one.
   - Add `showcase_order` integer (default 0) for ordering featured results.

3. Security
   - No new tables. Existing RLS policies remain unchanged.
   - The coach (owner) can update their own review showcase flags and result image
     featured flags through existing UPDATE policies.
*/

ALTER TABLE coach_reviews
  ADD COLUMN IF NOT EXISTS is_showcased boolean NOT NULL DEFAULT false;

ALTER TABLE coach_reviews
  ADD COLUMN IF NOT EXISTS showcase_order integer NOT NULL DEFAULT 0;

ALTER TABLE coach_result_images
  ADD COLUMN IF NOT EXISTS showcase_order integer NOT NULL DEFAULT 0;
