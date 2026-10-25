/*
# Add portal_slug column to content_spots

## Purpose
Enables portal-specific content isolation. When a user is inside a custom portal
(e.g. Poker Power), My Spots should only show content associated with that portal.
Content created inside a custom portal gets tagged with that portal's slug.

## Changes
1. New column: `content_spots.portal_slug` (text, nullable)
   - NULL means the spot belongs to SpotVault generally (no specific portal)
   - A portal slug like 'poker-power' means the spot belongs to that portal
2. Index on (account_id, portal_slug) for efficient portal-filtered queries

## Security
- No RLS policy changes needed — existing policies on content_spots already
  enforce ownership via account_id. The portal_slug column is user-settable
  (the content creator chooses which portal to associate with), so no
  column-level privilege changes are required.

## Notes
1. Existing spots get portal_slug = NULL (they remain visible in SpotVault generally)
2. The frontend will filter: inside a custom portal, show only spots where
   portal_slug matches the active portal slug. In SpotVault default, show all spots.
*/

ALTER TABLE public.content_spots
  ADD COLUMN IF NOT EXISTS portal_slug text;

CREATE INDEX IF NOT EXISTS idx_content_spots_account_portal
  ON public.content_spots (account_id, portal_slug);
