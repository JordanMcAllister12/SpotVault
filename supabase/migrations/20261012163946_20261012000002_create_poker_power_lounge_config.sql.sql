-- Create Poker Power lounge config + grant lounge memberships to PEAK6 and Jordan
-- The lounge config row is needed so fetchLoungeConfig(slug) returns data for the poker-power lounge

INSERT INTO public.lounge_configs (
  slug, name, type, description, default_background, default_background_fit,
  default_background_position, default_overlay, theme, is_active,
  modules, feed_settings, chat_settings, permissions, allow_user_background_customization,
  access_mode, discoverability, created_at, updated_at
)
VALUES (
  'poker-power',
  'Poker Power Community',
  'branded',
  'Poker Power private community lounge',
  '/image copy 3.png',
  'cover',
  'center',
  'light',
  'poker-power-sunrise',
  true,
  jsonb_build_array(
    jsonb_build_object('id', 'left-tournaments', 'type', 'liveTournaments', 'position', 'left', 'priority', 1),
    jsonb_build_object('id', 'left-cash', 'type', 'cashGames', 'position', 'left', 'priority', 2),
    jsonb_build_object('id', 'center-feed', 'type', 'socialFeed', 'position', 'center', 'priority', 1),
    jsonb_build_object('id', 'right-group', 'type', 'groupChat', 'position', 'right', 'priority', 1),
    jsonb_build_object('id', 'right-direct', 'type', 'directMessages', 'position', 'right', 'priority', 2)
  ),
  jsonb_build_object('placeholder', 'Share a win, question, or learning moment…', 'showComposer', true),
  jsonb_build_object('groupChannels', jsonb_build_array('community'), 'enableDirect', true),
  jsonb_build_object('postingAllowed', true, 'visibility', 'members'),
  true,
  'members',
  'private',
  now(), now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  default_background = EXCLUDED.default_background,
  default_overlay = EXCLUDED.default_overlay,
  theme = EXCLUDED.theme,
  is_active = true,
  modules = EXCLUDED.modules,
  feed_settings = EXCLUDED.feed_settings,
  chat_settings = EXCLUDED.chat_settings,
  updated_at = now();

-- ── Grant lounge memberships ──────────────────────────────────
-- PEAK6 test account
INSERT INTO public.lounge_memberships (user_id, lounge_slug, status, joined_at, role, is_default)
SELECT id, 'poker-power', 'active', now(), 'member', true
FROM auth.users WHERE email = 'peak6@spotvault.app'
ON CONFLICT DO NOTHING;

-- Jordan (founder) — ensure he has membership too
INSERT INTO public.lounge_memberships (user_id, lounge_slug, status, joined_at, role, is_default)
SELECT id, 'poker-power', 'active', now(), 'admin', false
FROM auth.users WHERE email = 'jordanmcallister12@gmail.com'
ON CONFLICT DO NOTHING;
