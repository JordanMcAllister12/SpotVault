/*
# Add Work Pack stages column and simplify Spot Types

## Summary
Simplifies the Spot Type system from 5 formats to 3 presentation formats:
- `structured` (was `hand_analysis`) — guided hand-analysis structure
- `freeform` — block-based editor (unchanged)
- `work_pack` — new stage-based solver/HRC study packet format

Removed top-level types: `solver`, `icm_hrc`, `question`.
Solver and ICM/HRC are now available as content_type tags instead.
Question/Discussion is inherent to every published Spot (discussion section exists on all).

## Changes
1. New column: `content_spots.work_pack_stages` (jsonb, nullable)
   - Stores an array of WorkPackStage objects: { id, title, blocks: ContentBlock[] }
   - Reuses the same ContentBlock architecture as Freeform
2. Migrate existing `spot_type` values:
   - `hand_analysis` → `structured`
   - `solver` → `work_pack`
   - `icm_hrc` → `work_pack`
   - `question` → `freeform`
3. No data loss — all existing content is preserved, just reclassified

## Security
- No RLS policy changes (existing policies on content_spots remain unchanged)
- New column inherits existing row-level security
*/

-- Add work_pack_stages column
ALTER TABLE content_spots ADD COLUMN IF NOT EXISTS work_pack_stages jsonb;

-- Migrate spot_type values
UPDATE content_spots SET spot_type = 'structured' WHERE spot_type = 'hand_analysis';
UPDATE content_spots SET spot_type = 'work_pack' WHERE spot_type IN ('solver', 'icm_hrc');
UPDATE content_spots SET spot_type = 'freeform' WHERE spot_type = 'question';
