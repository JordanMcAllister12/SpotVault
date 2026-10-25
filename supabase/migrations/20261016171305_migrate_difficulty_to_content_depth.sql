/*
# Migrate difficulty values to Content Depth classification

## Summary
Replaces the old difficulty-based tagging (Beginner/Medium/Advanced) with
new Content Depth classifications: Quick Read, Detailed, Advanced Analysis.

## Changes
- Updates the `difficulty` text column on `content_spots`:
  - 'beginner' → 'quick_read'
  - 'easy'     → 'quick_read'
  - 'medium'   → 'detailed'
  - 'advanced' → 'advanced_analysis'
  - 'intermediate' → 'detailed'
  - 'expert'   → 'advanced_analysis'
  - 'hard'     → 'advanced_analysis'
- Also updates difficulty values stored inside the `tags` jsonb field
  (legacy storage location) using the same mapping.

## Notes
- This is a data-only UPDATE migration — no schema changes.
- Values already in the new format ('quick_read', 'detailed', 'advanced_analysis') are left unchanged.
- NULL difficulty values are left as NULL.
*/

-- Migrate the difficulty column
UPDATE content_spots
SET difficulty = CASE
  WHEN difficulty ILIKE 'beginner' THEN 'quick_read'
  WHEN difficulty ILIKE 'easy' THEN 'quick_read'
  WHEN difficulty ILIKE 'medium' THEN 'detailed'
  WHEN difficulty ILIKE 'advanced' THEN 'advanced_analysis'
  WHEN difficulty ILIKE 'intermediate' THEN 'detailed'
  WHEN difficulty ILIKE 'expert' THEN 'advanced_analysis'
  WHEN difficulty ILIKE 'hard' THEN 'advanced_analysis'
  ELSE difficulty
END
WHERE difficulty IS NOT NULL
  AND difficulty NOT IN ('quick_read', 'detailed', 'advanced_analysis');

-- Migrate legacy difficulty stored inside tags jsonb
UPDATE content_spots
SET tags = jsonb_set(
  tags,
  '{difficulty}',
  to_jsonb(
    CASE
      WHEN tags->>'difficulty' ILIKE 'beginner' THEN 'quick_read'
      WHEN tags->>'difficulty' ILIKE 'easy' THEN 'quick_read'
      WHEN tags->>'difficulty' ILIKE 'medium' THEN 'detailed'
      WHEN tags->>'difficulty' ILIKE 'advanced' THEN 'advanced_analysis'
      WHEN tags->>'difficulty' ILIKE 'intermediate' THEN 'detailed'
      WHEN tags->>'difficulty' ILIKE 'expert' THEN 'advanced_analysis'
      WHEN tags->>'difficulty' ILIKE 'hard' THEN 'advanced_analysis'
      ELSE tags->>'difficulty'
    END
  )
)
WHERE tags ? 'difficulty'
  AND (tags->>'difficulty') IS NOT NULL
  AND (tags->>'difficulty') NOT IN ('quick_read', 'detailed', 'advanced_analysis');
