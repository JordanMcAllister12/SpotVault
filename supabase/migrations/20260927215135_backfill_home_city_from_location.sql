/*
# Backfill home_city_slug from location text

## Purpose
Users who typed their city in the "Location (Display)" field (e.g. "Winnipeg, Manitoba, Canada")
but never picked a Home City from the dropdown have `home_city_slug = NULL` while their `location`
text clearly identifies a known city. This causes Discover → Home City to say "No Home City set"
even though the profile shows the city name.

## What this does
For every `user_profiles` row where `home_city_slug IS NULL` and `location` is non-empty,
try to match the location text against `poker_scene_cities` by:
1. Exact city name match (case-insensitive)
2. Alias match (city aliases array contains the lowercased location)
3. Partial match (location contains city name or vice versa)

Where a match is found, set `home_city_slug` to the matched city's slug.

## Safety
- Only updates rows where home_city_slug is NULL (never overwrites an explicit choice)
- Uses non-destructive UPDATE (no drops, no deletes, no type changes)
- Idempotent: re-running only affects rows that still have NULL home_city_slug
*/

UPDATE user_profiles u
SET home_city_slug = c.slug
FROM poker_scene_cities c
WHERE u.home_city_slug IS NULL
  AND COALESCE(u.location, '') <> ''
  AND (
    lower(u.location) = lower(c.city_name)
    OR c.aliases @> ARRAY[lower(u.location)]::text[]
    OR lower(u.location) LIKE '%' || lower(c.city_name) || '%'
    OR lower(c.city_name) LIKE '%' || lower(u.location) || '%'
  );
