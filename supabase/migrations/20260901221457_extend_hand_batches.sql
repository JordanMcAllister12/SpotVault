/*
# Extend Hand Batches — Named Batches, Canonical Hands, Dedup

## Purpose
Upgrades the review set system into a first-class "Hand Batch" concept.
Users can create named batches, add individual hands over time, switch
between batches, and send batches (or marked subsets) to coaches or
HH Jukebox.

## Changes to sv_review_sets
- Add `description` (text, nullable) — optional batch notes/summary
- Expand `source_type` CHECK to include 'custom' and 'mixed'
- Rename existing source types conceptually: paste/file_upload/drag_drop
  remain valid; 'custom' = individually built batch; 'mixed' = batch
  containing hands from multiple sources

## Changes to sv_review_hands
- Add `sort_order` (integer, default 0) — ordering within batch
- Add `hand_title` (text, nullable) — optional per-hand title
- Add `hand_fingerprint` (text, nullable) — normalized fingerprint for dedup
- Add unique constraint on (review_set_id, hand_fingerprint) WHERE
  hand_fingerprint IS NOT NULL — prevents duplicate hands in same batch
- Add index on (review_set_id, sort_order) for efficient ordered loading

## Security
- No RLS policy changes — existing owner-scoped policies still apply
- The new columns inherit existing RLS coverage

## Important Notes
1. All changes are additive (ALTER TABLE ADD COLUMN) — no data loss
2. Existing review sets and hands remain fully functional
3. The unique constraint uses a partial index (WHERE hand_fingerprint IS NOT NULL)
   so unparsed hands without fingerprints are still allowed
4. sort_order defaults to 0; existing hands will need reordering if desired
   but will display in created_at order as before
*/

-- ============================================================
-- 1. EXTEND sv_review_sets
-- ============================================================

ALTER TABLE sv_review_sets
  ADD COLUMN IF NOT EXISTS description text;

-- Expand source_type to include 'custom' and 'mixed'
ALTER TABLE sv_review_sets DROP CONSTRAINT IF EXISTS sv_review_sets_source_type_check;
ALTER TABLE sv_review_sets ADD CONSTRAINT sv_review_sets_source_type_check
  CHECK (source_type IN ('paste', 'file_upload', 'drag_drop', 'custom', 'mixed'));

-- ============================================================
-- 2. EXTEND sv_review_hands
-- ============================================================

ALTER TABLE sv_review_hands
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE sv_review_hands
  ADD COLUMN IF NOT EXISTS hand_title text;

ALTER TABLE sv_review_hands
  ADD COLUMN IF NOT EXISTS hand_fingerprint text;

-- Partial unique index: prevents duplicate hands within the same batch
-- when a fingerprint is available
CREATE UNIQUE INDEX IF NOT EXISTS sv_review_hands_batch_fingerprint_uniq
  ON sv_review_hands (review_set_id, hand_fingerprint)
  WHERE hand_fingerprint IS NOT NULL;

-- Index for ordered loading by sort_order
CREATE INDEX IF NOT EXISTS sv_review_hands_sort_order_idx
  ON sv_review_hands (review_set_id, sort_order);
