/*
# Update Poker Power lounge background image path

## Purpose
Update the lounge_configs row for poker-power to use the newly uploaded
background image at /assets/portals/poker-power/image.png instead of the
old /image copy 3.png path. Also change overlay from 'light' to 'medium'
for better text readability over the new background.

## Changes
1. UPDATE lounge_configs SET default_background, default_overlay WHERE slug = 'poker-power'
2. No schema changes, no new tables, no RLS changes

## Notes
- The new image was uploaded by the user to public/assets/portals/poker-power/image.png
- The frontend PlayerNetwork.tsx config override is updated separately in code
- The 'medium' overlay provides a darker scrim over the background image, making
  text in the lounge panels more readable (the old 'light' overlay was too transparent)
*/

UPDATE public.lounge_configs
SET
  default_background = '/assets/portals/poker-power/image.png',
  default_overlay = 'medium',
  updated_at = now()
WHERE slug = 'poker-power';
