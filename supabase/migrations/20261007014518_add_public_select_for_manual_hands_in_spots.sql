/*
# Allow public read of manual hand records referenced by content_spots

## Problem
When a creator attaches a constructed hand (stored in `sv_manual_hand_records`) to a
content_spot via a `hand_replay` content block, readers who open that Spot cannot
fetch the hand data because the existing RLS policy only allows the owner
(`auth.uid() = user_id`) to SELECT. This means `EmbeddedHandReplayer` silently fails
for any reader who is not the hand's creator.

## Fix
Add a new SELECT policy that allows any authenticated user to read a manual hand
record IF that hand_id is referenced by a content_spot's `content_blocks` jsonb
array (either as a block with `type = 'hand_replay'` and `hand_id` matching, or
as the top-level `hand_id` column). This is a join-based authorization: reader can
access Spot → Spot references Hand X → reader can read Hand X's replay payload.

## Tables Modified
- `sv_manual_hand_records` — new SELECT policy `manual_hands_select_via_spot_ref`

## Security
- New policy allows SELECT only, not insert/update/delete.
- The policy requires that the hand_id appears in a content_spot that the reader
  can already access (content_spots SELECT policy governs who can see the spot).
- Readers gain access ONLY to the normalized_hand replay payload for hands
  explicitly embedded in Spots they can view — not to any other hands, notes,
  tournaments, or workspace data.
*/

-- Allow authenticated readers to SELECT manual hand records that are referenced
-- by a content_spot's content_blocks (hand_replay block) or hand_id column.
DROP POLICY IF EXISTS "manual_hands_select_via_spot_ref" ON public.sv_manual_hand_records;
CREATE POLICY "manual_hands_select_via_spot_ref"
ON public.sv_manual_hand_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.content_spots cs
    WHERE (
      -- Top-level hand_id reference
      (cs.hand_id IS NOT NULL AND cs.hand_id = sv_manual_hand_records.hand_id)
      OR
      -- content_blocks jsonb array contains a hand_replay block referencing this hand_id
      (cs.content_blocks IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(cs.content_blocks) AS block
          WHERE block->>'type' = 'hand_replay'
            AND block->>'hand_id' = sv_manual_hand_records.hand_id
        )
      )
    )
  )
);
