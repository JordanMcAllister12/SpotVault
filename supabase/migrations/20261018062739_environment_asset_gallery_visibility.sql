/*
# Environment Asset Gallery Visibility & Background Consolidation

## Purpose
Add founder approval controls to the environment asset library so only
approved backgrounds appear in user-facing background selection. Consolidate
duplicate image assets into single canonical entries.

## Changes
1. New column: `gallery_visibility` on `spotvault_environment_assets`
   - Values: 'player' (Player Portal only), 'community' (Community only),
     'both' (both destinations), 'hidden' (not in public gallery)
   - Default: 'hidden' — assets must be explicitly approved
2. Set gallery visibility for the 10 unique retained backgrounds
3. Mark duplicate assets as hidden (consolidated into canonical entries)
4. Set Player Portal default: player-high-roller-lounge
5. Set Community default: community-option-01

## The 10 unique approved backgrounds:
1. player-high-roller-lounge (/player-portal-high-roller-lounge.webp) — Player Portal default — visibility: both
2. coach-room-media-lounge (/coach-portal-background.webp) — visibility: both
3. investor-room-vancouver (/assets/investor-glass-tower-vancouver.webp) — visibility: both
4. glass-tower-toronto (/glass-tower-toronto.webp) — visibility: both
5. community-option-01 (/image copy.webp) — Community default — visibility: community
6. player-network-floor (/image copy copy copy copy.webp) — consolidated with community-option-02-unresolved — visibility: both
7. unassigned-image-copy (/image.webp) — visibility: both
8. stakekings-action (/assets/stakekings-action-btn.webp) — visibility: both
9. unassigned-assets-image-copy (/assets/image copy.webp) — visibility: both
10. unassigned-assets-image (/assets/image.webp) — visibility: both

## Hidden (duplicates or non-background):
- community-option-02-unresolved (duplicate of player-network-floor)
- business-office-unresolved (duplicate of player-network-floor)
- unassigned-image-copy-copy-copy-copy-copy (duplicate of community-option-01)
- All help-* assets (help environment, not user backgrounds)
- stakekings-logo-bg (stakekings branding, not user-selectable)
- All generated assets (CSS themes, not image backgrounds)

## Security
- No RLS changes needed — existing policies remain in place
- The gallery_visibility column is readable by authenticated users
  (needed for background selection UI)
*/

-- Add gallery_visibility column
ALTER TABLE public.spotvault_environment_assets
ADD COLUMN IF NOT EXISTS gallery_visibility text DEFAULT 'hidden';

-- Set visibility for the 10 approved unique backgrounds
UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'player-high-roller-lounge';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'coach-room-media-lounge';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'investor-room-vancouver';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'glass-tower-toronto';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'community'
WHERE id = 'community-option-01';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'player-network-floor';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'unassigned-image-copy';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'stakekings-action';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'unassigned-assets-image-copy';

UPDATE public.spotvault_environment_assets SET gallery_visibility = 'both'
WHERE id = 'unassigned-assets-image';

-- Mark duplicates as hidden
UPDATE public.spotvault_environment_assets SET gallery_visibility = 'hidden'
WHERE id IN (
  'community-option-02-unresolved',
  'business-office-unresolved',
  'unassigned-image-copy-copy-copy-copy-copy'
);

-- Mark help/stakekings-logo assets as hidden (not user-selectable backgrounds)
UPDATE public.spotvault_environment_assets SET gallery_visibility = 'hidden'
WHERE id IN (
  'help-overview',
  'help-therapy',
  'help-performance',
  'help-gambling',
  'help-my-support',
  'stakekings-logo-bg'
);

-- Generated assets stay hidden from image gallery
UPDATE public.spotvault_environment_assets SET gallery_visibility = 'hidden'
WHERE kind = 'generated';

-- Ensure Player Portal default is assigned to PLAYER_MAIN
UPDATE public.spotvault_environment_assets
SET allowed_screens = ARRAY['PLAYER_MAIN']::text[]
WHERE id = 'player-high-roller-lounge';

-- Ensure Community default is assigned to COMMUNITY
UPDATE public.spotvault_environment_assets
SET allowed_screens = ARRAY['COMMUNITY']::text[]
WHERE id = 'community-option-01';
