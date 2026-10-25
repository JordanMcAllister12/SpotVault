/*
# Create PokerScene System

## Overview
Creates the PokerScene system: city-specific live poker information feeds for cash games, tournaments, and community shoutouts. Designed to scale to hundreds of cities.

## New Tables

### poker_scene_cities
- `id` (uuid, PK) — city identifier
- `city_name` (text) — display name e.g. "Winnipeg"
- `region` (text) — province/state e.g. "Manitoba"
- `country` (text) — e.g. "Canada"
- `slug` (text, unique) — URL-safe identifier e.g. "winnipeg"
- `active` (boolean, default true) — whether this scene is live

### poker_scene_venues
- `id` (uuid, PK)
- `city_id` (uuid, FK → poker_scene_cities)
- `name` (text) — venue/room name
- `address` (text, nullable)
- `phone` (text, nullable)
- `website` (text, nullable)
- `verified_operator` (boolean, default false) — whether this venue has an approved operator account
- `latitude` (numeric, nullable)
- `longitude` (numeric, nullable)

### poker_scene_cash_games
- `id` (uuid, PK)
- `venue_id` (uuid, FK → poker_scene_venues)
- `game_type` (text) — e.g. "NLHE", "PLO"
- `stakes` (text) — e.g. "1/3", "2/5"
- `tables_running` (int, default 0)
- `seats_available` (int, nullable)
- `waitlist` (int, default 0)
- `status` (text) — 'live' | 'forming' | 'ended' | 'unknown'
- `source_type` (text) — 'verified_operator' | 'public_listing' | 'player_report'
- `source_reference` (text, nullable) — who/what provided this info
- `is_demo` (boolean, default false) — marks demo/mock data
- `confirmed_at` (timestamptz, nullable) — when info was last confirmed
- `updated_at` (timestamptz, default now())

### poker_scene_tournaments
- `id` (uuid, PK)
- `venue_id` (uuid, FK → poker_scene_venues)
- `name` (text) — tournament name
- `buy_in` (numeric, nullable)
- `start_time` (timestamptz, nullable)
- `registration_status` (text, nullable) — 'open' | 'closed' | 'unknown'
- `late_registration_end` (timestamptz, nullable)
- `entries` (int, nullable)
- `status` (text) — 'upcoming' | 'registering' | 'running' | 'late_reg_open' | 'late_reg_closed' | 'completed'
- `source_type` (text) — 'verified_operator' | 'public_listing' | 'player_report'
- `source_reference` (text, nullable)
- `is_demo` (boolean, default false)
- `updated_at` (timestamptz, default now())

### poker_scene_shoutouts
- `id` (uuid, PK)
- `city_id` (uuid, FK → poker_scene_cities)
- `user_id` (text) — SpotVault account ID
- `user_name` (text) — display name
- `user_avatar` (text, nullable)
- `venue_id` (uuid, nullable, FK → poker_scene_venues)
- `message` (text) — the shoutout text
- `game_type` (text, nullable) — optional tagged game
- `stakes` (text, nullable) — optional tagged stakes
- `created_at` (timestamptz, default now())

### poker_scene_reactions
- `id` (uuid, PK)
- `shoutout_id` (uuid, FK → poker_scene_shoutouts, CASCADE)
- `user_id` (text)
- `emoji` (text)
- `created_at` (timestamptz, default now())
- UNIQUE(shoutout_id, user_id, emoji)

### poker_scene_player_reports
- `id` (uuid, PK)
- `cash_game_id` (uuid, nullable, FK → poker_scene_cash_games)
- `tournament_id` (uuid, nullable, FK → poker_scene_tournaments)
- `user_id` (text)
- `user_name` (text)
- `report_type` (text) — 'still_running' | 'game_ended' | 'seats_available' | 'game_forming'
- `detail` (text, nullable)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on all tables.
- All tables use `TO anon, authenticated` with open CRUD (no-auth demo app pattern).
- This is intentionally public/shared data — the PokerScene feed is visible to all SpotVault users.
*/

CREATE TABLE IF NOT EXISTS poker_scene_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  region text,
  country text,
  slug text UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE poker_scene_cities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS poker_scene_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES poker_scene_cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  website text,
  verified_operator boolean DEFAULT false,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE poker_scene_venues ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS poker_scene_cash_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES poker_scene_venues(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  stakes text NOT NULL,
  tables_running int DEFAULT 0,
  seats_available int,
  waitlist int DEFAULT 0,
  status text DEFAULT 'unknown',
  source_type text DEFAULT 'public_listing',
  source_reference text,
  is_demo boolean DEFAULT false,
  confirmed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE poker_scene_cash_games ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS poker_scene_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES poker_scene_venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  buy_in numeric,
  start_time timestamptz,
  registration_status text,
  late_registration_end timestamptz,
  entries int,
  status text DEFAULT 'upcoming',
  source_type text DEFAULT 'public_listing',
  source_reference text,
  is_demo boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE poker_scene_tournaments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS poker_scene_shoutouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES poker_scene_cities(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_avatar text,
  venue_id uuid REFERENCES poker_scene_venues(id) ON DELETE SET NULL,
  message text NOT NULL,
  game_type text,
  stakes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE poker_scene_shoutouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS poker_scene_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoutout_id uuid NOT NULL REFERENCES poker_scene_shoutouts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shoutout_id, user_id, emoji)
);
ALTER TABLE poker_scene_reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS poker_scene_player_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_game_id uuid REFERENCES poker_scene_cash_games(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES poker_scene_tournaments(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  report_type text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE poker_scene_player_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: open CRUD for anon + authenticated (no-auth demo app)
-- Cities
DROP POLICY IF EXISTS "ps_cities_select" ON poker_scene_cities;
CREATE POLICY "ps_cities_select" ON poker_scene_cities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_cities_insert" ON poker_scene_cities;
CREATE POLICY "ps_cities_insert" ON poker_scene_cities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_cities_update" ON poker_scene_cities;
CREATE POLICY "ps_cities_update" ON poker_scene_cities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ps_cities_delete" ON poker_scene_cities;
CREATE POLICY "ps_cities_delete" ON poker_scene_cities FOR DELETE TO anon, authenticated USING (true);

-- Venues
DROP POLICY IF EXISTS "ps_venues_select" ON poker_scene_venues;
CREATE POLICY "ps_venues_select" ON poker_scene_venues FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_venues_insert" ON poker_scene_venues;
CREATE POLICY "ps_venues_insert" ON poker_scene_venues FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_venues_update" ON poker_scene_venues;
CREATE POLICY "ps_venues_update" ON poker_scene_venues FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ps_venues_delete" ON poker_scene_venues;
CREATE POLICY "ps_venues_delete" ON poker_scene_venues FOR DELETE TO anon, authenticated USING (true);

-- Cash games
DROP POLICY IF EXISTS "ps_cash_select" ON poker_scene_cash_games;
CREATE POLICY "ps_cash_select" ON poker_scene_cash_games FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_cash_insert" ON poker_scene_cash_games;
CREATE POLICY "ps_cash_insert" ON poker_scene_cash_games FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_cash_update" ON poker_scene_cash_games;
CREATE POLICY "ps_cash_update" ON poker_scene_cash_games FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ps_cash_delete" ON poker_scene_cash_games;
CREATE POLICY "ps_cash_delete" ON poker_scene_cash_games FOR DELETE TO anon, authenticated USING (true);

-- Tournaments
DROP POLICY IF EXISTS "ps_tourn_select" ON poker_scene_tournaments;
CREATE POLICY "ps_tourn_select" ON poker_scene_tournaments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_tourn_insert" ON poker_scene_tournaments;
CREATE POLICY "ps_tourn_insert" ON poker_scene_tournaments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_tourn_update" ON poker_scene_tournaments;
CREATE POLICY "ps_tourn_update" ON poker_scene_tournaments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ps_tourn_delete" ON poker_scene_tournaments;
CREATE POLICY "ps_tourn_delete" ON poker_scene_tournaments FOR DELETE TO anon, authenticated USING (true);

-- Shoutouts
DROP POLICY IF EXISTS "ps_shout_select" ON poker_scene_shoutouts;
CREATE POLICY "ps_shout_select" ON poker_scene_shoutouts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_shout_insert" ON poker_scene_shoutouts;
CREATE POLICY "ps_shout_insert" ON poker_scene_shoutouts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_shout_update" ON poker_scene_shoutouts;
CREATE POLICY "ps_shout_update" ON poker_scene_shoutouts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ps_shout_delete" ON poker_scene_shoutouts;
CREATE POLICY "ps_shout_delete" ON poker_scene_shoutouts FOR DELETE TO anon, authenticated USING (true);

-- Reactions
DROP POLICY IF EXISTS "ps_react_select" ON poker_scene_reactions;
CREATE POLICY "ps_react_select" ON poker_scene_reactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_react_insert" ON poker_scene_reactions;
CREATE POLICY "ps_react_insert" ON poker_scene_reactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ps_react_delete" ON poker_scene_reactions;
CREATE POLICY "ps_react_delete" ON poker_scene_reactions FOR DELETE TO anon, authenticated USING (true);

-- Player reports
DROP POLICY IF EXISTS "ps_report_select" ON poker_scene_player_reports;
CREATE POLICY "ps_report_select" ON poker_scene_player_reports FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ps_report_insert" ON poker_scene_player_reports;
CREATE POLICY "ps_report_insert" ON poker_scene_player_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_venue ON poker_scene_cash_games(venue_id);
CREATE INDEX IF NOT EXISTS idx_tourn_venue ON poker_scene_tournaments(venue_id);
CREATE INDEX IF NOT EXISTS idx_shout_city ON poker_scene_shoutouts(city_id);
CREATE INDEX IF NOT EXISTS idx_venues_city ON poker_scene_venues(city_id);
CREATE INDEX IF NOT EXISTS idx_react_shoutout ON poker_scene_reactions(shoutout_id);
