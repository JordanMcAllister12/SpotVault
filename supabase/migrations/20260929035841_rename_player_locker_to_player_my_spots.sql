/*
# Rename media_assignments destination from 'player_locker' to 'player_my_spots'

## Summary
Renames the `destination` column value `'player_locker'` to `'player_my_spots'`
in the `media_assignments` table. This aligns the internal database value with
the product terminology rename from "Locker" to "My Spots".

## Changes
1. Updates all existing rows where `destination = 'player_locker'` to `'player_my_spots'`.
2. No schema changes — column type, constraints, and RLS policies remain unchanged.

## Data Safety
- This is an in-place UPDATE of a text column value, not a schema change.
- No data is lost — existing assignments retain all their metadata, timestamps,
  and relationships. Only the destination string changes.
- Idempotent: running again has no effect since no rows will match 'player_locker'.
*/

UPDATE media_assignments
SET destination = 'player_my_spots'
WHERE destination = 'player_locker';
