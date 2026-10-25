/*
# Add is_discoverable flag to user_profiles

## Purpose
People → Discover should only show profiles that are intentionally eligible for public discovery
(coaches, creators, businesses, verified users). Ordinary registered users should NOT appear
in the directory by default.

## Changes
1. New column: `is_discoverable` (boolean, default false)
   - Ordinary accounts default to NOT discoverable
   - Coaches, creators, businesses, and verified users are discoverable
2. Backfill: set is_discoverable = true for existing profiles where:
   - primary_role IN ('coach', 'creator', 'business')
   - OR is_verified = true
3. RLS: keep existing user_profiles policies unchanged — the new column is read-only
   via the existing SELECT policy. No new policies needed.

## Security
- No RLS changes. The column is covered by existing SELECT policies on user_profiles.
- Users cannot self-set is_discoverable through the frontend (no update path exposed).
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT false;

-- Backfill: make coaches, creators, businesses, and verified users discoverable
UPDATE user_profiles
  SET is_discoverable = true
  WHERE primary_role IN ('coach', 'creator', 'business')
     OR is_verified = true;
