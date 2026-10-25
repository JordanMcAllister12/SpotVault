/*
# Create spot_evidence table

## Purpose
Allow creators to attach supporting visual evidence (solver screenshots, GTO Wizard outputs,
HRC screenshots, range charts, EV comparisons, equity calculations, database/stat screenshots,
graphs, hand-history screenshots) to their Content Spots.

## New Table: spot_evidence
- `id` (uuid, PK) — unique evidence item ID
- `spot_id` (uuid, FK → content_spots.id, ON DELETE CASCADE) — which spot this evidence belongs to
- `account_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the creator who uploaded it
- `asset_url` (text, NOT NULL) — public URL of the uploaded image in user-uploads storage bucket
- `title` (text, nullable) — optional title (e.g. "Solver Output — Turn")
- `caption` (text, nullable) — optional explanation/caption
- `display_order` (int, NOT NULL, DEFAULT 0) — ordering for display
- `display_position` (text, NOT NULL, DEFAULT 'after_content') — where evidence appears relative to written content; V1 supports 'after_content'
- `created_at` (timestamptz, DEFAULT now())

## Security
- RLS enabled on spot_evidence
- 4 separate policies (SELECT, INSERT, UPDATE, DELETE) scoped to authenticated users who own the evidence (account_id = auth.uid())
- SELECT also allows any authenticated user to read published spot evidence (via join to content_spots where status = 'published')

## Indexes
- idx_spot_evidence_spot_id on spot_id for efficient lookups
- idx_spot_evidence_account_id on account_id for ownership checks

## Notes
1. Evidence images are uploaded to the existing `user-uploads` Supabase storage bucket (same as visual_details).
2. Evidence is OPTIONAL — a spot can be published without any evidence.
3. The table is separate from content_spots columns; evidence items are fetched as a list ordered by display_order.
4. display_position defaults to 'after_content'; future values could include 'before_content', 'inline', etc.
*/

CREATE TABLE IF NOT EXISTS spot_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid REFERENCES content_spots(id) ON DELETE CASCADE,
  account_id uuid NOT NULL DEFAULT auth.uid(),
  asset_url text NOT NULL,
  title text,
  caption text,
  display_order int NOT NULL DEFAULT 0,
  display_position text NOT NULL DEFAULT 'after_content',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE spot_evidence ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spot_evidence_spot_id ON spot_evidence(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_evidence_account_id ON spot_evidence(account_id);

-- SELECT: owner can see their own evidence; anyone can see evidence for published spots
DROP POLICY IF EXISTS "select_spot_evidence" ON spot_evidence;
CREATE POLICY "select_spot_evidence"
ON spot_evidence FOR SELECT
TO authenticated
USING (
  account_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = spot_evidence.spot_id
    AND content_spots.status = 'published'
  )
);

-- INSERT: only the owner can insert evidence
DROP POLICY IF EXISTS "insert_spot_evidence" ON spot_evidence;
CREATE POLICY "insert_spot_evidence"
ON spot_evidence FOR INSERT
TO authenticated
WITH CHECK (account_id = auth.uid());

-- UPDATE: only the owner can update evidence
DROP POLICY IF EXISTS "update_spot_evidence" ON spot_evidence;
CREATE POLICY "update_spot_evidence"
ON spot_evidence FOR UPDATE
TO authenticated
USING (account_id = auth.uid())
WITH CHECK (account_id = auth.uid());

-- DELETE: only the owner can delete evidence
DROP POLICY IF EXISTS "delete_spot_evidence" ON spot_evidence;
CREATE POLICY "delete_spot_evidence"
ON spot_evidence FOR DELETE
TO authenticated
USING (account_id = auth.uid());