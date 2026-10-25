/* Idempotency re-check: run the same insert, should insert 0 rows */

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
