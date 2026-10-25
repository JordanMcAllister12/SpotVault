/*
# Create Lounge Poker Feeds (Tournaments + Cash Games)

## Purpose
Separates tournament and cash-game information from the social feed, giving each Lounge its own poker ecosystem data.
Lounges are geographic/stakes communities (e.g. "Manitoba Poker"). Admins can configure which poker rooms and data sources appear in their Lounge.

## New Tables

### lounge_tournament_feeds
- Stores tournament information cards for each Lounge.
- Each row = one tournament event posted to a Lounge's Tournament surface.
- Fields: tournament name, poker room/venue, location, date, start time, buy-in, guarantee, game type, structure, registration status, entrants, players remaining, current level, prize pool, live/upcoming/finished status, last updated.
- All fields nullable except id/lounge_slug/created_at — only display fields that have data.

### lounge_cash_game_feeds
- Stores live cash-game information cards for each Lounge.
- Each row = one cash-game session at a poker room.
- Fields: poker room, location, game, stakes, tables running, players/seats, waitlist, status, last updated.
- All fields nullable except id/lounge_slug/created_at — only display fields that have data.

### lounge_feed_sources
- Maps which poker rooms / data sources contribute to each Lounge's tournament and cash feeds.
- Allows admins to select participating rooms per Lounge.
- Fields: lounge_slug, source_type (tournament/cash), room_name, location, is_active.

## Security
- RLS enabled on all tables.
- SELECT: TO anon, authenticated (public community data, visible to all).
- INSERT/UPDATE/DELETE: TO authenticated (lounge admins/staff manage feeds).
*/

-- Tournament feed table
CREATE TABLE IF NOT EXISTS lounge_tournament_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_slug text NOT NULL,
  tournament_name text,
  poker_room text,
  location text,
  operator text,
  event_date date,
  start_time text,
  buy_in numeric,
  guarantee numeric,
  game_type text,
  structure_info text,
  registration_status text,
  entrants integer,
  players_remaining integer,
  current_level text,
  prize_pool numeric,
  status text DEFAULT 'upcoming',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lounge_tournament_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_tournament_feeds" ON lounge_tournament_feeds;
CREATE POLICY "anon_read_tournament_feeds" ON lounge_tournament_feeds FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_tournament_feeds" ON lounge_tournament_feeds;
CREATE POLICY "auth_insert_tournament_feeds" ON lounge_tournament_feeds FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_tournament_feeds" ON lounge_tournament_feeds;
CREATE POLICY "auth_update_tournament_feeds" ON lounge_tournament_feeds FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_tournament_feeds" ON lounge_tournament_feeds;
CREATE POLICY "auth_delete_tournament_feeds" ON lounge_tournament_feeds FOR DELETE
  TO authenticated USING (true);

-- Cash game feed table
CREATE TABLE IF NOT EXISTS lounge_cash_game_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_slug text NOT NULL,
  poker_room text,
  location text,
  game text,
  stakes text,
  tables_running integer,
  players integer,
  open_seats integer,
  waitlist integer,
  status text DEFAULT 'running',
  starts_at text,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lounge_cash_game_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_cash_game_feeds" ON lounge_cash_game_feeds;
CREATE POLICY "anon_read_cash_game_feeds" ON lounge_cash_game_feeds FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_cash_game_feeds" ON lounge_cash_game_feeds;
CREATE POLICY "auth_insert_cash_game_feeds" ON lounge_cash_game_feeds FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_cash_game_feeds" ON lounge_cash_game_feeds;
CREATE POLICY "auth_update_cash_game_feeds" ON lounge_cash_game_feeds FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_cash_game_feeds" ON lounge_cash_game_feeds;
CREATE POLICY "auth_delete_cash_game_feeds" ON lounge_cash_game_feeds FOR DELETE
  TO authenticated USING (true);

-- Feed sources mapping table
CREATE TABLE IF NOT EXISTS lounge_feed_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lounge_slug text NOT NULL,
  source_type text NOT NULL DEFAULT 'tournament',
  room_name text,
  location text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (lounge_slug, source_type, room_name)
);

ALTER TABLE lounge_feed_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_feed_sources" ON lounge_feed_sources;
CREATE POLICY "anon_read_feed_sources" ON lounge_feed_sources FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_feed_sources" ON lounge_feed_sources;
CREATE POLICY "auth_insert_feed_sources" ON lounge_feed_sources FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_feed_sources" ON lounge_feed_sources;
CREATE POLICY "auth_update_feed_sources" ON lounge_feed_sources FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_feed_sources" ON lounge_feed_sources;
CREATE POLICY "auth_delete_feed_sources" ON lounge_feed_sources FOR DELETE
  TO authenticated USING (true);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tournament_feeds_lounge ON lounge_tournament_feeds (lounge_slug);
CREATE INDEX IF NOT EXISTS idx_cash_game_feeds_lounge ON lounge_cash_game_feeds (lounge_slug);
CREATE INDEX IF NOT EXISTS idx_feed_sources_lounge ON lounge_feed_sources (lounge_slug);
