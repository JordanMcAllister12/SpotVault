/*
# Complete sv_entitlements RLS policies and add source column

## Purpose
The `sv_entitlements` table already exists as a centralized entitlement system
with columns: id, user_id, resource_type, resource_id, entitlement_type,
granted_at, expires_at, revoked_at, metadata, created_at.

It currently only has a SELECT policy. This migration:
1. Adds a `source` column to track how the entitlement was acquired
   (purchase, free_claim, gift, creator_grant, coach_grant, promotion, subscription).
2. Adds INSERT, UPDATE, DELETE RLS policies so the owning user can manage their entitlements.
3. Adds an index on (user_id, resource_type) for efficient locker queries.

## Changes
- ALTER TABLE sv_entitlements ADD COLUMN source text DEFAULT 'purchase'
- CREATE INDEX on sv_entitlements(user_id, resource_type)
- INSERT policy: users can insert their own entitlements
- UPDATE policy: users can update their own entitlements
- DELETE policy: users can delete their own entitlements

## Security
- All policies scope to auth.uid() = user_id
- SELECT already exists and remains
*/
-- Add source column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sv_entitlements' AND column_name = 'source'
  ) THEN
    ALTER TABLE sv_entitlements ADD COLUMN source text NOT NULL DEFAULT 'purchase';
  END IF;
END $$;

-- Add index for locker queries (user_id + resource_type is the most common lookup)
CREATE INDEX IF NOT EXISTS idx_sv_entitlements_user_resource
  ON sv_entitlements(user_id, resource_type)
  WHERE revoked_at IS NULL;

-- INSERT policy: users can create their own entitlements
DROP POLICY IF EXISTS "sv_entitlements_insert_own" ON sv_entitlements;
CREATE POLICY "sv_entitlements_insert_own"
ON sv_entitlements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: users can update their own entitlements
DROP POLICY IF EXISTS "sv_entitlements_update_own" ON sv_entitlements;
CREATE POLICY "sv_entitlements_update_own"
ON sv_entitlements FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE policy: users can delete their own entitlements
DROP POLICY IF EXISTS "sv_entitlements_delete_own" ON sv_entitlements;
CREATE POLICY "sv_entitlements_delete_own"
ON sv_entitlements FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
