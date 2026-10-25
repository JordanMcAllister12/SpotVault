/*
# Restore Knowing When to Fold Marketplace Thumbnail and Difficulty

## Purpose
Update the existing published Spot record without creating, deleting, or duplicating content.

## Modified record
- `content_spots.id = 2c0256e6-213b-457b-b1d6-0f72ee7f725b`
- `cover_image_url`: points to the uploaded Poker Power image copy 11 asset
- `difficulty`: changes from medium to easy
- `portal_slug`: changes to NULL so this intentionally public Spot appears in the standard
  marketplace and in Poker Power's marketplace through the shared public-content rule

## Data safety
- Title, creator, ownership, publication status, pricing, rich content, hand details,
  hand history, tags, and existing image arrays are preserved.
- Only the three fields listed above and `updated_at` are changed.
- No tables, columns, users, or historical records are deleted.
*/

UPDATE content_spots
SET cover_image_url = '/assets/portals/poker-power/image copy 11.png',
    difficulty = 'easy',
    portal_slug = NULL,
    updated_at = now()
WHERE id = '2c0256e6-213b-457b-b1d6-0f72ee7f725b';
