/*
# One-time idempotent migration: grant demo Spot entitlements to Peak6account

## Purpose
The Poker Power custom portal sidebar previously had a "Spot Library" nav entry
where demo users could find educational Spots. The sidebar is being refactored
to match the default SpotVault Player Portal, which uses "My Spots" instead.
This migration grants access entitlements for the 5 demo content spots to the
Peak6account demo user so they appear in "My Spots" instead of requiring the
old "Spot Library" nav entry.

## What this does
1. Finds all content spots created by Jordan McAllister (account_id = '17ca0743-...')
   — these are the demo spots visible in the Poker Power portal's Spot Library.
2. For each, inserts an `sv_entitlements` row for Peak6account (user_id =
   f49b8e1a-5644-44fe-b454-f87ea9455db5) with resource_type = 'content_spot',
   entitlement_type = 'purchase' (required by check constraint), source = 'creator_grant'.
3. Idempotent: uses `WHERE NOT EXISTS` to skip any spot that already has an
   active (non-revoked) entitlement for this user. Safe to re-run.

## Data integrity
- No existing rows are modified or deleted.
- Creator attribution on content_spots is NOT changed.
- Only the Peak6account demo user receives entitlements.
- No other users are affected.
*/

INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, metadata)
SELECT
  'f49b8e1a-5644-44fe-b454-f87ea9455db5'::uuid,
  'content_spot',
  cs.id,
  'purchase',
  'creator_grant',
  jsonb_build_object('migration', 'demo_spots_to_my_spots', 'portal', COALESCE(cs.portal_slug, 'shared'))
FROM content_spots cs
WHERE cs.account_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND NOT EXISTS (
    SELECT 1 FROM sv_entitlements e
    WHERE e.user_id = 'f49b8e1a-5644-44fe-b454-f87ea9455db5'::uuid
      AND e.resource_type = 'content_spot'
      AND e.resource_id = cs.id
      AND e.revoked_at IS NULL
  );
