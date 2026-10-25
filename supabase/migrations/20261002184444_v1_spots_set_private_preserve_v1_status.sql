-- Correction: V1 migrated Spots must be private (draft), not publicly published.
-- Scope: ONLY source = 'spotvault_v1'. Native V2 spots are untouched.
--
-- 1. Preserve the original V1 publication state inside legacy_v1_metadata
--    for provenance (only for rows that don't already have it).
-- 2. Set current V2 status to 'draft' and clear published_at / monetization
--    so they no longer appear in the public Spot Library (fetchPublishedSpots
--    filters by status = 'published').
-- 3. Do NOT delete or duplicate any rows. IDs, content, tags, solver data,
--    image refs, and legacy metadata are all preserved.

UPDATE content_spots
SET
  -- Preserve original V1 publication state for provenance
  tags = CASE
    WHEN tags->'legacy_v1_metadata' ? 'v2_status_before_correction' THEN tags
    ELSE jsonb_set(
      tags,
      '{legacy_v1_metadata,v2_status_before_correction}',
      to_jsonb(status),
      true
    )
  END,
  -- Set to private/draft
  status = 'draft',
  published_at = NULL,
  is_monetized = false,
  price_credits = 0,
  updated_at = now()
WHERE source = 'spotvault_v1'
  AND status = 'published';
