/*
# Canonical Batch System — Phase 2a: Column additions + RLS fixes

## Changes
1. sv_review_sets: add batch_type column
2. sv_review_hands: add selection_status, added_by, batch_note columns
3. sv_review_hands: add missing DELETE RLS policy (bug fix)
4. Indexes for performance
*/

-- 1. Add batch_type to sv_review_sets
ALTER TABLE public.sv_review_sets
  ADD COLUMN IF NOT EXISTS batch_type text NOT NULL DEFAULT 'personal';

-- 2. Add selection_status, added_by, batch_note to sv_review_hands
ALTER TABLE public.sv_review_hands
  ADD COLUMN IF NOT EXISTS selection_status text NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS added_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS batch_note text;

-- 3. Add missing DELETE policy on sv_review_hands
DROP POLICY IF EXISTS "sv_review_hands_delete_own" ON public.sv_review_hands;
CREATE POLICY "sv_review_hands_delete_own"
  ON public.sv_review_hands FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sv_review_sets
      WHERE sv_review_sets.id = sv_review_hands.review_set_id
        AND sv_review_sets.owner_id = auth.uid()
    )
  );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_review_hands_batch_selection
  ON public.sv_review_hands(review_set_id, selection_status);