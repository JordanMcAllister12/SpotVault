/*
# Community Giveback Settings

Single-row settings table for the Community Giveback percentage.
Admin-controlled value that the frontend reads to display the meter.
Future-expandable with additional fields (lifetimeGivebackAmount, etc).
*/

CREATE TABLE IF NOT EXISTS community_settings (
  id text PRIMARY KEY DEFAULT 'global',
  community_giveback_percent numeric NOT NULL DEFAULT 5.0,
  lifetime_giveback_amount numeric,
  current_year_giveback_amount numeric,
  number_of_giveaways integer,
  players_helped integer,
  support_programs_funded integer,
  latest_community_initiative text,
  updated_at timestamptz DEFAULT now()
);

-- Seed default row
INSERT INTO community_settings (id, community_giveback_percent)
VALUES ('global', 5.0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE community_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_community_settings" ON community_settings;
CREATE POLICY "read_community_settings" ON community_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "update_community_settings" ON community_settings;
CREATE POLICY "update_community_settings" ON community_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "insert_community_settings" ON community_settings;
CREATE POLICY "insert_community_settings" ON community_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
