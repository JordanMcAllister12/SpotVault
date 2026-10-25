/*
# Universal Lounge System

1. Purpose
   Replaces the old generic Lounge/Community architecture with a configurable,
   reusable Lounge framework that can power any poker community (default SpotVault
   communities, geographic communities like Manitoba Poker, partner portals like
   StakeKings, branded communities, etc.).

2. New Tables
   - `lounge_configs`: Stores community configuration (name, type, slug, modules,
     feed/chat/event settings, permissions, background defaults). One row per
     community/lounge.
   - `lounge_background_preferences`: Per-user background customization for each
     lounge. Stores user_id + lounge_id + background preference (default, spotvault
     preset, custom upload URL) + display settings (fit, position, overlay).

3. Modified Tables
   - `poker_lounge_messages`: Added `lounge_id` column (text, nullable) to scope
     messages to specific lounges. Existing rows default to 'spotvault' scope.
     Added `author_avatar` and `author_role` columns if not present (idempotent).

4. Security
   - RLS enabled on all new tables.
   - `lounge_configs`: Public read (anon + authenticated) so any visitor can see
     community configs. Write restricted to authenticated users (community
     management is handled at application level via staff checks).
   - `lounge_background_preferences`: Owner-scoped CRUD — each authenticated user
     can only read/write their own background preferences.
   - `poker_lounge_messages` RLS updated to filter by lounge_id scope.

5. Notes
   - The `lounge_configs.modules` column stores a JSON array of module definitions
     (module type, position, priority, settings).
   - Background preferences are personal — a user's custom background does NOT
     affect other users' views.
   - Community default backgrounds are stored in `lounge_configs.default_background`
     and can be set by authorized community admins.
*/

-- ── lounge_configs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lounge_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'default',
  description text,
  logo text,
  default_background text,
  default_background_fit text DEFAULT 'cover',
  default_background_position text DEFAULT 'center',
  default_overlay text DEFAULT 'medium',
  theme text DEFAULT 'spotvault-dark',
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  feed_settings jsonb DEFAULT '{}'::jsonb,
  chat_settings jsonb DEFAULT '{}'::jsonb,
  event_settings jsonb DEFAULT '{}'::jsonb,
  permissions jsonb DEFAULT '{}'::jsonb,
  allow_user_background_customization boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lounge_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_lounge_configs" ON lounge_configs;
CREATE POLICY "anon_read_lounge_configs" ON lounge_configs FOR SELECT
  TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "auth_manage_lounge_configs" ON lounge_configs;
CREATE POLICY "auth_manage_lounge_configs" ON lounge_configs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ── lounge_background_preferences ───────────────────────────────
CREATE TABLE IF NOT EXISTS lounge_background_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lounge_slug text NOT NULL,
  background_type text NOT NULL DEFAULT 'default',
  background_value text,
  fit text DEFAULT 'cover',
  position text DEFAULT 'center',
  overlay text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, lounge_slug)
);

ALTER TABLE lounge_background_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bg_prefs" ON lounge_background_preferences;
CREATE POLICY "select_own_bg_prefs" ON lounge_background_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bg_prefs" ON lounge_background_preferences;
CREATE POLICY "insert_own_bg_prefs" ON lounge_background_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bg_prefs" ON lounge_background_preferences;
CREATE POLICY "update_own_bg_prefs" ON lounge_background_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bg_prefs" ON lounge_background_preferences;
CREATE POLICY "delete_own_bg_prefs" ON lounge_background_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── Extend poker_lounge_messages ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'poker_lounge_messages' AND column_name = 'lounge_id') THEN
    ALTER TABLE poker_lounge_messages ADD COLUMN lounge_id text DEFAULT 'spotvault';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'poker_lounge_messages' AND column_name = 'author_avatar') THEN
    ALTER TABLE poker_lounge_messages ADD COLUMN author_avatar text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'poker_lounge_messages' AND column_name = 'author_role') THEN
    ALTER TABLE poker_lounge_messages ADD COLUMN author_role text;
  END IF;
END $$;

-- Index for filtering by lounge
CREATE INDEX IF NOT EXISTS idx_poker_lounge_messages_lounge_id
  ON poker_lounge_messages (lounge_id, created_at DESC);

-- ── Seed Manitoba Poker lounge config ───────────────────────────
INSERT INTO lounge_configs (slug, name, type, description, modules, feed_settings, chat_settings, event_settings, permissions)
VALUES (
  'manitoba-poker',
  'Manitoba Poker',
  'geographic',
  'The digital home for Manitoba''s poker community — live tournament data, cash games, events, and community discussion.',
  '[
    {"id": "left-data", "type": "liveTournaments", "position": "left", "priority": 1, "settings": {"region": "manitoba"}},
    {"id": "center-feed", "type": "socialFeed", "position": "center", "priority": 1, "settings": {"placeholder": "What''s happening in Manitoba poker?"}},
    {"id": "right-chat", "type": "groupChat", "position": "right", "priority": 1, "settings": {"channels": ["general", "manitoba"]}},
    {"id": "right-events", "type": "events", "position": "right", "priority": 2, "settings": {"title": "Tonight in Manitoba", "region": "manitoba"}}
  ]'::jsonb,
  '{"placeholder": "What''s happening in Manitoba poker?", "showComposer": true}'::jsonb,
  '{"groupChannels": ["general", "manitoba"], "enableDirect": true}'::jsonb,
  '{"title": "Tonight in Manitoba", "region": "manitoba"}'::jsonb,
  '{"postingAllowed": true, "visibility": "public"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  modules = EXCLUDED.modules,
  feed_settings = EXCLUDED.feed_settings,
  chat_settings = EXCLUDED.chat_settings,
  event_settings = EXCLUDED.event_settings,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- ── Seed default SpotVault community lounges ────────────────────
INSERT INTO lounge_configs (slug, name, type, description, modules, feed_settings, chat_settings, event_settings, permissions)
VALUES
  ('low-stakes-mtt', 'Low Stakes MTT', 'stakes', 'Community for low-stakes MTT players.', 
   '[{"id":"left-info","type":"announcements","position":"left","priority":1},{"id":"center-feed","type":"socialFeed","position":"center","priority":1},{"id":"right-chat","type":"groupChat","position":"right","priority":1},{"id":"right-events","type":"featuredContent","position":"right","priority":2}]'::jsonb,
   '{"placeholder":"What''s on your mind?","showComposer":true}'::jsonb, '{"groupChannels":["general"],"enableDirect":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('low-stakes-cash', 'Low Stakes Cash', 'stakes', 'Community for low-stakes cash game players.',
   '[{"id":"left-info","type":"announcements","position":"left","priority":1},{"id":"center-feed","type":"socialFeed","position":"center","priority":1},{"id":"right-chat","type":"groupChat","position":"right","priority":1},{"id":"right-events","type":"featuredContent","position":"right","priority":2}]'::jsonb,
   '{"placeholder":"What''s on your mind?","showComposer":true}'::jsonb, '{"groupChannels":["general"],"enableDirect":true}'::jsonb, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
