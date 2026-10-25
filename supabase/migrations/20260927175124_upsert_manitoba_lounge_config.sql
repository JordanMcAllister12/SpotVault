INSERT INTO lounge_configs (
  slug, name, type, description,
  default_background, default_background_fit, default_background_position, default_overlay,
  modules, feed_settings, chat_settings,
  allow_user_background_customization
) VALUES (
  'manitoba-poker',
  'Manitoba Poker',
  'geographic',
  'Manitoba Poker community lounge — tournaments, cash games, feed, and chat for the Manitoba poker scene.',
  '/image%20copy%205.png',
  'cover',
  'center',
  'medium',
  '[
    {"id":"left-tournaments","type":"liveTournaments","position":"left","priority":1},
    {"id":"left-cash","type":"cashGames","position":"left","priority":2},
    {"id":"center-feed","type":"socialFeed","position":"center","priority":1},
    {"id":"right-group","type":"groupChat","position":"right","priority":1},
    {"id":"right-direct","type":"directMessages","position":"right","priority":2}
  ]'::jsonb,
  '{"placeholder":"What''s happening in Manitoba?","showComposer":true}'::jsonb,
  '{"groupChannels":["general"],"enableDirect":true}'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  default_background = EXCLUDED.default_background,
  default_background_fit = EXCLUDED.default_background_fit,
  default_background_position = EXCLUDED.default_background_position,
  default_overlay = EXCLUDED.default_overlay,
  modules = EXCLUDED.modules,
  feed_settings = EXCLUDED.feed_settings,
  chat_settings = EXCLUDED.chat_settings,
  allow_user_background_customization = EXCLUDED.allow_user_background_customization;