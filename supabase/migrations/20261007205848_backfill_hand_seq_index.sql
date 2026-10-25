/*
# Backfill hand_seq_index for chronological tournament ordering

## Purpose
Tournament hands should display in chronological order (first hand first).
The `hand_seq_index` column exists but was never populated. This migration
backfills it based on `played_at` timestamp then `hand_id` as a tiebreaker,
assigning a sequential index per batch (review_set_id).

## Changes
1. For each `review_set_id`, assign `hand_seq_index` = row_number() ordered by
   `played_at` ASC NULLS LAST, then `hand_id` ASC — but only for rows where
   `hand_seq_index IS NULL`.
2. No schema changes, no new tables, no RLS changes.

## Notes
- Future inserts set `hand_seq_index` from the application layer.
- `fetchBatchHands` will order by `hand_seq_index ASC NULLS LAST, sort_order ASC, created_at ASC`.
*/

DO $$
BEGIN
  WITH ranked AS (
    SELECT
      id,
      review_set_id,
      ROW_NUMBER() OVER (
        PARTITION BY review_set_id
        ORDER BY
          CASE WHEN played_at IS NULL THEN 1 ELSE 0 END,
          played_at ASC,
          COALESCE(hand_id, '') ASC
      ) - 1 AS seq_idx
    FROM sv_review_hands
    WHERE hand_seq_index IS NULL
  )
  UPDATE sv_review_hands h
  SET hand_seq_index = ranked.seq_idx
  FROM ranked
  WHERE h.id = ranked.id;
END $$;
