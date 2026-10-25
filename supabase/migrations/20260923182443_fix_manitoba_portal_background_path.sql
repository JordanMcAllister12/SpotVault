/*
# Fix Manitoba Poker Network portal background path

## What changed
The Manitoba Poker Network custom portal's config had `backgrounds.lounge`
pointing to `/assets/portals/manitoba-lounge.webp`, which does not exist.
The actual wallpaper image was uploaded to
`/assets/portals/manitoba/image.png`.

## Why
The mismatched path caused the portal content area to render completely
black — the background-image URL 404'd silently, leaving only the dark
scrim layer visible.

## Fix
Update `custom_portals.config.backgrounds.lounge` to the correct path
`/assets/portals/manitoba/image.png` for the `manitoba-poker-network` slug.

## Safety
- No schema changes.
- No RLS changes.
- Single-row UPDATE scoped by slug.
*/

UPDATE custom_portals
SET config = jsonb_set(config, '{backgrounds,lounge}', '"/assets/portals/manitoba/image.png"')
WHERE slug = 'manitoba-poker-network';
