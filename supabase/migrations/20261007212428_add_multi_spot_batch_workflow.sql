/*
# Add MULTI-SPOT batch workflow support

## Purpose
Enables the HH batch workflow: users select individual hands from a tournament,
add them to a working batch, add per-hand notes, then save the batch as a single
"MULTI-SPOT" draft item in My Spots. The batch can be reopened back into Workspace.

## Changes

### 1. content_spots table — add cover_image_url column
- New column `cover_image_url` (text, nullable) — stores the cover image URL for
  MULTI-SPOT items (and can be used by other spot types in the future).

### 2. content_spots table — add review_set_id column
- New column `review_set_id` (uuid, nullable) — foreign key to sv_review_sets.id.
  This links a MULTI-SPOT content spot to its underlying hand batch so the batch
  can be reopened in Workspace.
  - ON DELETE SET NULL: deleting the batch doesn't delete the spot.

### 3. sv_review_sets table — add batch_mode column
- New column `batch_mode` (text, not null, default 'review') — distinguishes
  working batches ('working') from normal review batches ('review').
  Working batches are the staging area before CREATE BATCH saves them as a spot.

## Security
- No new tables created.
- content_spots already has RLS enabled with owner-scoped policies.
- sv_review_sets already has RLS enabled with owner-scoped policies.
- No policy changes needed — new columns inherit existing policies.
- Foreign key review_set_id references sv_review_sets with ON DELETE SET NULL,
  so deleting a batch never cascades to delete the spot (data safety).

## Notes
1. Both columns are added with IF NOT EXISTS for idempotency.
2. The spot_type column on content_spots is a free text field (no CHECK constraint),
   so 'multi_spot' can be used without altering the schema.
3. The batch_mode column on sv_review_sets distinguishes working batches
   (temporary staging area) from saved batches (linked to a content spot).
*/

-- 1. Add cover_image_url to content_spots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_spots' AND column_name = 'cover_image_url'
  ) THEN
    ALTER TABLE content_spots ADD COLUMN cover_image_url text;
  END IF;
END $$;

-- 2. Add review_set_id to content_spots (links MULTI-SPOT to its batch)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_spots' AND column_name = 'review_set_id'
  ) THEN
    ALTER TABLE content_spots ADD COLUMN review_set_id uuid;
    ALTER TABLE content_spots
      ADD CONSTRAINT content_spots_review_set_id_fkey
      FOREIGN KEY (review_set_id) REFERENCES sv_review_sets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Add batch_mode to sv_review_sets (distinguishes working batches)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_review_sets' AND column_name = 'batch_mode'
  ) THEN
    ALTER TABLE sv_review_sets ADD COLUMN batch_mode text NOT NULL DEFAULT 'review';
  END IF;
END $$;
