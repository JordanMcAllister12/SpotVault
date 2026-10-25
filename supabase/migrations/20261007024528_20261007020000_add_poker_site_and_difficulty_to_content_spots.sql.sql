/*
# Add poker_site and difficulty columns to content_spots

## Purpose
Supports structured metadata for poker site/platform selection and
standalone difficulty level on Spot cards. Previously difficulty lived
only inside the tags jsonb; this promotes it to its own column for
filtering and display. Poker site is entirely new structured metadata.

## Changes
1. New columns on `content_spots`:
   - `poker_site` (text, nullable) — stores the creator-selected poker
     platform key (e.g. 'ggpoker', 'pokerstars', 'wpt_global', etc.)
   - `difficulty` (text, nullable) — stores the difficulty level key
     (e.g. 'beginner', 'intermediate', 'advanced', 'expert')
2. Both columns are nullable so existing Spots are unaffected.
3. No RLS changes needed — existing policies already cover SELECT/INSERT/UPDATE/DELETE.

## Notes
- The app will read `difficulty` column first, falling back to
  `tags->>'difficulty'` for older Spots that only have the jsonb value.
- poker_site null = show generic Spot icon (fallback behavior).
*/
ALTER TABLE content_spots
  ADD COLUMN IF NOT EXISTS poker_site text,
  ADD COLUMN IF NOT EXISTS difficulty text;
