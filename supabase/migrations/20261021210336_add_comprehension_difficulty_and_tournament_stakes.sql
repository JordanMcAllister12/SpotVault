/*
# Add comprehension_difficulty and tournament_stakes to content_spots

## Purpose
These two new columns are independent of the existing `difficulty` column
(which stores analysis depth: quick_read / detailed / advanced_analysis).
They allow creators to separately classify the comprehension level required
and the tournament stakes level of a spot's featured hand.

## Changes
1. New column `comprehension_difficulty` (text, nullable) — stores values:
   'easy', 'medium', 'hard'. Null means unset (not yet classified).
2. New column `tournament_stakes` (text, nullable) — stores values:
   'micro', 'low', 'mid', 'high', 'nosebleed'. Null means unset.
3. Both columns are optional — existing rows keep NULL, no backfill.
4. No RLS changes needed — these columns are covered by existing content_spots policies.

## Notes
- The existing `difficulty` column continues to store analysis depth and is unchanged.
- These are presentation-level classifications, independent of each other and of analysis depth.
- No data loss: all existing data preserved, new columns simply start as NULL.
*/

ALTER TABLE content_spots
  ADD COLUMN IF NOT EXISTS comprehension_difficulty text DEFAULT NULL;

ALTER TABLE content_spots
  ADD COLUMN IF NOT EXISTS tournament_stakes text DEFAULT NULL;