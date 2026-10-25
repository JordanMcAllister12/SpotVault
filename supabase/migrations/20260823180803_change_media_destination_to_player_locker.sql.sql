/*
# Media flow: Staff publishes to Player Locker, not direct to Media Center

## Changes
1. Drop the unique partial index that only allowed one active assignment per destination.
2. Allow multiple active assignments for destination 'player_locker' (Staff can publish multiple videos).
3. Migrate existing 'media_center_primary' assignments to 'player_locker'.
4. Add a unique constraint on (media_asset_id, destination) WHERE status='active' to prevent duplicate active assignments of the same asset to the same destination.

## Rationale
- Staff Media Manager publishes videos to the Player Locker (destination = 'player_locker').
- Players see published videos in their Locker and choose what to play.
- The Media Center becomes a pure playback destination, not a content library.
- Multiple videos can be published simultaneously.
*/

-- 1. Drop the old unique-per-destination index
DROP INDEX IF EXISTS idx_media_assignments_unique_active;

-- 2. Migrate existing assignments to the new destination
UPDATE media_assignments SET destination = 'player_locker' WHERE destination = 'media_center_primary';

-- 3. Allow multiple active assignments per destination (no unique constraint on destination alone)
--    But prevent duplicate active assignment of the same asset to the same destination
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assignments_unique_asset_dest
  ON media_assignments(media_asset_id, destination) WHERE status = 'active';
