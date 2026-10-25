/*
# Multi-Spot Analysis (MSA) System

## Overview
Creates the data layer for Multi-Spot Analysis — a curated collection of poker hands
presented as one finished study product. MSA builds on top of the existing content_spots
and poker_hand_records infrastructure.

## New Tables

### `sv_msa_entries`
Stores per-hand analysis data for each hand within a Multi-Spot Analysis.
Each row references an existing poker_hand_records row via (hand_id, hand_user_id)
and caches display metadata (hero_cards, board, blinds, net_result, etc.) —
same pattern as sv_hand_pack_entries.

Columns:
- `id` — UUID primary key
- `content_spot_id` — FK to content_spots.id (the MSA container)
- `hand_id` — references poker_hand_records.hand_id
- `hand_user_id` — whose poker_hand_records row to look up (text, matching account_id type)
- `sort_order` — display order within the MSA (0-based)
- `hand_title` — optional custom title for this hand
- `creator_analysis` — main rich-text/multiline analysis field
- `key_takeaway` — optional shorter takeaway
- `evidence_url` — optional URL to uploaded evidence/screenshot image
- `evidence_caption` — optional caption for the evidence image
- `hero_cards` through `tournament_id` — cached display metadata
- `created_at` / `updated_at` — timestamps

## Security
- RLS enabled on `sv_msa_entries`
- Owner-scoped CRUD via ownership check: content_spots.account_id = auth.uid()::text
- Public SELECT for published MSAs (so purchasers/viewers can read entries)
- Standard 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

## Notes
1. The MSA container is a content_spots row with spot_type = 'multi_spot_analysis'.
2. Hand references use (hand_id, hand_user_id) — same pattern as sv_hand_pack_entries.
3. Cover images use existing image_urls array on content_spots + user-uploads bucket.
4. content_spots.account_id is text type, so auth.uid() is cast to text in policies.
*/

CREATE TABLE IF NOT EXISTS sv_msa_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_spot_id uuid NOT NULL REFERENCES content_spots(id) ON DELETE CASCADE,
  hand_id text NOT NULL,
  hand_user_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  hand_title text,
  creator_analysis text DEFAULT '',
  key_takeaway text,
  evidence_url text,
  evidence_caption text,
  hero_cards text,
  board text,
  blinds text,
  net_result numeric,
  pot_amount numeric,
  position text,
  played_at timestamptz,
  tournament_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msa_entries_spot_id ON sv_msa_entries(content_spot_id);
CREATE INDEX IF NOT EXISTS idx_msa_entries_sort ON sv_msa_entries(content_spot_id, sort_order);

ALTER TABLE sv_msa_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msa_select_own" ON sv_msa_entries;
DROP POLICY IF EXISTS "msa_select_published" ON sv_msa_entries;
DROP POLICY IF EXISTS "msa_insert_own" ON sv_msa_entries;
DROP POLICY IF EXISTS "msa_update_own" ON sv_msa_entries;
DROP POLICY IF EXISTS "msa_delete_own" ON sv_msa_entries;

CREATE POLICY "msa_select_own"
ON sv_msa_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_msa_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);

CREATE POLICY "msa_select_published"
ON sv_msa_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_msa_entries.content_spot_id
    AND content_spots.status = 'published'
  )
);

CREATE POLICY "msa_insert_own"
ON sv_msa_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_msa_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);

CREATE POLICY "msa_update_own"
ON sv_msa_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_msa_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_msa_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);

CREATE POLICY "msa_delete_own"
ON sv_msa_entries FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_spots
    WHERE content_spots.id = sv_msa_entries.content_spot_id
    AND content_spots.account_id = auth.uid()::text
  )
);
