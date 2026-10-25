/*
# Add canonical hand references, creator notes, and Hand Pack content type

## Purpose
Enable the Workspace to reference canonical poker_hand_records without duplicating them,
add lightweight creator notes on canonical hands, and support Hand Packs as a creator
content type in My Spots / content_spots.

## Changes

### 1. sv_review_hands — add canonical reference columns
- `canonical_hand_id` (text, nullable) — references poker_hand_records.hand_id
- `canonical_user_id` (uuid, nullable) — references poker_hand_records.user_id
- `raw_hand_text` is now nullable (canonical-ref hands don't store raw text)

When both canonical columns are set, the hand is a REFERENCE to a canonical
poker_hand_records row, not a copy. The HHReplayer fetches the full record
from poker_hand_records using these keys.

### 2. sv_review_sets — add content_spot link
- `content_spot_id` (text, nullable) — references content_spots.id when this
  batch has been published as a Hand Pack to the creator marketplace.

### 3. New table: sv_canonical_hand_notes
Lightweight creator notes on canonical hands (distinct from the coaching
exchange system in sv_review_hand_notes). Used during tournament review
in Workspace.
- `id` (uuid PK)
- `user_id` (uuid NOT NULL, defaults to auth.uid())
- `hand_id` (text NOT NULL) — references poker_hand_records.hand_id
- `hand_user_id` (uuid NOT NULL) — references poker_hand_records.user_id
- `note_text` (text NOT NULL)
- `is_flagged` (boolean NOT NULL DEFAULT false) — equivalent to "saved/flagged"
- `created_at`, `updated_at` (timestamptz)

### 4. content_spots — add 'hand_pack' spot_type
No column change needed (spot_type is text without a CHECK constraint).
The frontend will use source = 'Hand Pack' and spot_type = 'hand_pack'.

## Security
- sv_canonical_hand_notes: RLS enabled, owner-scoped CRUD (authenticated only)
- sv_review_hands canonical columns: covered by existing sv_review_hands RLS
- sv_review_sets content_spot_id: covered by existing sv_review_sets RLS

## Notes
- This migration does NOT duplicate any poker_hand_records data.
- Canonical-ref hands in sv_review_hands store only metadata (blinds, position,
  net_result, etc.) for list display, and fetch full replay data from
  poker_hand_records on demand.
- The existing sv_saved_hands bookmark system remains unchanged and is the
  canonical "saved" state shared across HH Replayer and Workspace.
*/

-- 1. Add canonical reference columns to sv_review_hands
ALTER TABLE sv_review_hands
  ADD COLUMN IF NOT EXISTS canonical_hand_id text,
  ADD COLUMN IF NOT EXISTS canonical_user_id uuid;

-- Make raw_hand_text nullable for canonical-ref hands
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sv_review_hands'
      AND column_name = 'raw_hand_text'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sv_review_hands ALTER COLUMN raw_hand_text DROP NOT NULL;
  END IF;
END $$;

-- 2. Add content_spot_id to sv_review_sets
ALTER TABLE sv_review_sets
  ADD COLUMN IF NOT EXISTS content_spot_id text;

-- 3. Create sv_canonical_hand_notes table
CREATE TABLE IF NOT EXISTS sv_canonical_hand_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  hand_id text NOT NULL,
  hand_user_id uuid NOT NULL,
  note_text text NOT NULL DEFAULT '',
  is_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, hand_id, hand_user_id)
);

ALTER TABLE sv_canonical_hand_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_canonical_notes" ON sv_canonical_hand_notes;
CREATE POLICY "select_own_canonical_notes"
ON sv_canonical_hand_notes FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_canonical_notes" ON sv_canonical_hand_notes;
CREATE POLICY "insert_own_canonical_notes"
ON sv_canonical_hand_notes FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_canonical_notes" ON sv_canonical_hand_notes;
CREATE POLICY "update_own_canonical_notes"
ON sv_canonical_hand_notes FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_canonical_notes" ON sv_canonical_hand_notes;
CREATE POLICY "delete_own_canonical_notes"
ON sv_canonical_hand_notes FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Index for fast lookup by user + hand
CREATE INDEX IF NOT EXISTS idx_canonical_notes_user_hand
ON sv_canonical_hand_notes(user_id, hand_id, hand_user_id);
