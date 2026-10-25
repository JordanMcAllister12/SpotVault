/*
# Restore the existing default SpotVault Lounge configuration

1. Existing Table
- Updates or inserts only the `lounge_configs` row with slug `spotvault`.
- Does not delete, rename, or overwrite any other lounge record.

2. Lounge Experience
- Restores the established five-area Lounge layout: live tournaments, cash games, social feed, group chat, and direct messages.
- Restores the SpotVault high-roller lounge wallpaper and dark presentation settings.
- Keeps the Lounge public, with user posting and direct chat enabled.

3. Security
- Uses the existing public-read policy on `lounge_configs`.
- No new permissions or access paths are introduced.
*/

INSERT INTO public.lounge_configs (
  slug, name, type, description, default_background, default_background_fit,
  default_background_position, default_overlay, theme, modules, feed_settings,
  chat_settings, event_settings, permissions, allow_user_background_customization,
  is_active, updated_at
)
VALUES (
  'spotvault',
  'SpotVault Lounge',
  'default',
  'The general SpotVault poker room for players to connect, study, discuss games, and find live poker destinations.',
  '/player-portal-high-roller-lounge.png',
  'cover',
  'center',
  'medium',
  'spotvault-dark',
  '[
    {"id":"left-tournaments","type":"liveTournaments","position":"left","priority":1},
    {"id":"left-cash","type":"cashGames","position":"left","priority":2},
    {"id":"center-feed","type":"socialFeed","position":"center","priority":1},
    {"id":"right-group","type":"groupChat","position":"right","priority":1},
    {"id":"right-direct","type":"directMessages","position":"right","priority":2}
  ]'::jsonb,
  '{"placeholder":"What''s happening in poker?","showComposer":true}'::jsonb,
  '{"groupChannels":["general"],"enableDirect":true}'::jsonb,
  '{}'::jsonb,
  '{"postingAllowed":true,"visibility":"public"}'::jsonb,
  true,
  true,
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  default_background = EXCLUDED.default_background,
  default_background_fit = EXCLUDED.default_background_fit,
  default_background_position = EXCLUDED.default_background_position,
  default_overlay = EXCLUDED.default_overlay,
  theme = EXCLUDED.theme,
  modules = EXCLUDED.modules,
  feed_settings = EXCLUDED.feed_settings,
  chat_settings = EXCLUDED.chat_settings,
  permissions = EXCLUDED.permissions,
  allow_user_background_customization = EXCLUDED.allow_user_background_customization,
  is_active = true,
  updated_at = now();
