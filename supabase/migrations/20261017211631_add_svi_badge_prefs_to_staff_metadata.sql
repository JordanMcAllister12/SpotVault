/*
# Add SVI badge preferences column to sv_staff_metadata

## Purpose
Supports the customizable military Class/Rank badge system (Profile §2, Community §6).
Users who have earned an SVI division/rank can choose which title/badge appears beside
their username across SpotVault, and customize badge background fill and text colors.

## Changes
1. Adds `svi_badge_prefs` JSONB column to `sv_staff_metadata`.
   - Stores: { selectedDisplay: 'player'|'rank'|'badge'|'title', badgeBg: string, badgeText: string, badgeStyle: number }
   - Nullable (defaults to NULL). Only set for users who have customized their badge.
   - Readable by all (anon + authenticated) so community username tags can render.
   - Writable only by the owner via the existing `sv_set_staff_metadata` RPC.

## Security
- No new RLS policies needed. The column inherits the table's existing policies.
- The existing `sv_set_staff_metadata` SECURITY DEFINER RPC already enforces
  that only the owner (auth.uid() = p_user_id) or an admin can set metadata.
- Column-level UPDATE grant: the table already allows authenticated to UPDATE all
  columns via policy, but actual writes go through the RPC which validates ownership.
*/

ALTER TABLE sv_staff_metadata
  ADD COLUMN IF NOT EXISTS svi_badge_prefs JSONB DEFAULT NULL;

COMMENT ON COLUMN sv_staff_metadata.svi_badge_prefs IS
  'JSONB: { selectedDisplay, badgeBg, badgeText, badgeStyle } — user-customized SVI Class/Rank badge preferences for public username display';
