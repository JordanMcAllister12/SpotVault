/*
# Migrate home_widgets and player_room_layout to per-portal format

Existing data is in flat format. Wrap it under the "player" key so
per-portal persistence can work without losing existing layouts.
Idempotent: skips rows already in the new keyed format.
*/

UPDATE user_preferences
SET home_widgets = jsonb_build_object('player', home_widgets)
WHERE home_widgets IS NOT NULL
  AND home_widgets != '{}'::jsonb
  AND NOT (home_widgets ? 'player')
  AND NOT (home_widgets ? 'coach')
  AND NOT (home_widgets ? 'creator');

UPDATE user_preferences
SET player_room_layout = jsonb_build_object('player', player_room_layout)
WHERE player_room_layout IS NOT NULL
  AND player_room_layout != '{}'::jsonb
  AND NOT (player_room_layout ? 'player')
  AND NOT (player_room_layout ? 'coach')
  AND NOT (player_room_layout ? 'creator');
