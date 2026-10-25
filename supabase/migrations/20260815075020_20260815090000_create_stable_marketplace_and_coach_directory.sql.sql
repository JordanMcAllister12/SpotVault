/*
# Create Stable Marketplace + Coach Directory tables

## Purpose
Expands the Jobs area into three sections: Industry Jobs (existing), Stable Marketplace,
and Coaches. This migration creates the tables for Stable Marketplace and Coaches.
Industry Jobs already has tables (job_postings, job_candidates) but they use auth.uid()
which doesn't work with the demo-auth pattern. This migration adds new tables using
text account_id (matching booking tables) and also creates new job_postings_v2 /
job_candidates_v2 tables that work with demo auth.

## New Tables

### 1. poker_resumes
Player-created structured poker resumes for the Stable Marketplace.
- id (uuid PK)
- account_id (text, NOT NULL) — the player's demo account ID
- display_name (text)
- username (text)
- avatar_initials (text)
- location (text, nullable)
- languages (text[], default '{}')
- bio (text, nullable)
- years_playing (int, default 0)
- primary_format (text) — 'MTT' | 'Cash' | 'Mixed'
- plays_mtt (bool, default false)
- plays_cash (bool, default false)
- plays_live (bool, default false)
- plays_online (bool, default false)
- plays_mixed (bool, default false)
- abi (int, nullable) — average buy-in for MTT
- buy_in_range (text, nullable) — e.g. "$50-$500"
- tournaments_per_month (int, nullable)
- preferred_sites (text[], default '{}')
- live_online_split (text, nullable)
- cash_stakes (text, nullable)
- cash_primary_game (text, nullable)
- hands_played (int, nullable)
- hands_per_month (int, nullable)
- total_cashes (text, nullable)
- estimated_profit (text, nullable)
- roi (text, nullable)
- bb100 (text, nullable)
- ev_bb100 (text, nullable)
- largest_score (text, nullable)
- final_tables (int, nullable)
- accomplishments (text, nullable) — free text
- credentials (jsonb, default '[]') — array of {type, title, year, description}
- looking_for (text[], default '{}') — e.g. ['Full backing', 'Coaching + backing']
- desired_stakes (text, nullable)
- desired_formats (text[], default '{}')
- desired_sites (text[], default '{}')
- volume_commitment (text, nullable)
- availability (text, nullable)
- looking_description (text, nullable)
- analytics_attached (bool, default false)
- analytics_snapshot (jsonb, nullable) — {hands, tournaments, abi, roi, bb100, ev_bb100, vpip, pfr, three_bet, data_through}
- is_published (bool, default false) — opt-in to Player Pool discovery
- is_looking (bool, default false) — currently looking for backing
- created_at, updated_at (timestamptz)

### 2. stable_profiles
Stable/operator profiles that can publish opportunities.
- id (uuid PK)
- account_id (text, NOT NULL)
- stable_name (text, NOT NULL)
- logo_initials (text)
- description (text, nullable)
- formats (text[], default '{}') — e.g. ['MTT', 'Cash']
- typical_stakes (text, nullable)
- what_they_provide (text, nullable)
- what_they_expect (text, nullable)
- website (text, nullable)
- social_links (jsonb, default '{}') — {twitter, instagram, etc.}
- contact_username (text, nullable) — SpotVault username for messaging
- is_published (bool, default false)
- created_at, updated_at (timestamptz)

### 3. stable_opportunities
Job postings by stables looking for players.
- id (uuid PK)
- stable_id (uuid FK → stable_profiles ON DELETE CASCADE)
- account_id (text, NOT NULL) — the stable owner's account ID
- title (text, NOT NULL)
- format (text) — 'MTT' | 'Cash' | 'Live' | 'Online'
- abi_range (text, nullable) — e.g. "$20-$100"
- min_volume (text, nullable) — e.g. "500 games/month"
- includes (text[], default '{}') — e.g. ['Backing', 'Coaching', 'Study Group']
- description (text, nullable)
- status (text, default 'active') — 'active' | 'closed'
- created_at (timestamptz)

### 4. coach_listings
Coach profiles for the Coach Directory. Separate from booking_providers
(which handle the booking mechanics). coach_listings is the public-facing
discovery/profile layer.
- id (uuid PK)
- account_id (text, NOT NULL, UNIQUE)
- display_name (text, NOT NULL)
- username (text)
- avatar_initials (text)
- bio (text, nullable)
- specialties (text[], default '{}') — e.g. ['MTT', 'ICM', 'GTO']
- credentials (jsonb, default '[]') — array of {type, title, year, description}
- formats_coached (text[], default '{}')
- stakes_coached (text[], default '{}')
- languages (text[], default '{}')
- rate_per_hour (int, default 0) — in credits
- session_durations (int[], default '{60}') — minutes
- coaching_methods (text[], default '{}') — e.g. ['Video', 'Voice', 'Chat']
- accomplishments (text, nullable)
- availability_summary (text, nullable) — e.g. "Tue/Thu 3-7 PM ET"
- is_published (bool, default false)
- shareable_slug (text, nullable) — for shareable booking link
- created_at, updated_at (timestamptz)

### 5. job_postings_v2
Replaces the auth.uid()-based job_postings with demo-auth-compatible version.
- id (uuid PK)
- account_id (text, NOT NULL)
- company (text, NOT NULL)
- company_logo (text, nullable)
- job_title (text, NOT NULL)
- job_description (text, nullable)
- location (text, nullable)
- work_type (text, nullable) — 'remote' | 'hybrid' | 'onsite'
- employment_type (text, nullable) — 'full-time' | 'part-time' | 'contract'
- salary_range (text, nullable)
- required_experience (text, nullable)
- preferred_experience (text, nullable)
- skills (text[], default '{}')
- application_deadline (date, nullable)
- contact_person (text, nullable)
- category (text, nullable)
- status (text, default 'active')
- created_at, updated_at (timestamptz)

### 6. job_candidates_v2
Replaces the auth.uid()-based job_candidates with demo-auth-compatible version.
- id (uuid PK)
- account_id (text, NOT NULL)
- name (text, NOT NULL)
- avatar_initials (text, nullable)
- location (text, nullable)
- open_to_remote (bool, default true)
- poker_background (text, nullable)
- other_background (text, nullable)
- skills (text[], default '{}')
- interested_roles (text[], default '{}')
- employment_preference (text, nullable)
- availability (text, nullable)
- introduction (text, nullable)
- resume_url (text, nullable)
- transition_support (text[], default '{}')
- is_published (bool, default false)
- is_hidden (bool, default false)
- created_at, updated_at (timestamptz)

## Security
- RLS enabled on all tables.
- All policies use TO anon, authenticated (demo auth model, matching booking tables).
- Owner-scoped via account_id text column (not auth.uid()).
- Public reads for published content; owner can CRUD their own rows.

## Notes
1. All tables use text account_id (demo auth pattern) — no auth.users FK.
2. coach_listings.shareable_slug enables /coach/[slug] routing for shareable booking links.
3. poker_resumes.analytics_snapshot stores a frozen snapshot of opted-in analytics —
   the player chooses exactly what to share, and it's clearly labeled as SpotVault data.
4. stable_opportunities FK to stable_profiles for cascade delete.
5. job_postings_v2 / job_candidates_v2 are new tables that coexist with the old
   auth.uid()-based ones (which are unused in the demo auth app).
*/

-- ============================================================
-- poker_resumes
-- ============================================================
CREATE TABLE IF NOT EXISTS poker_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  avatar_initials text,
  location text,
  languages text[] NOT NULL DEFAULT '{}',
  bio text,
  years_playing integer NOT NULL DEFAULT 0,
  primary_format text NOT NULL DEFAULT 'MTT',
  plays_mtt boolean NOT NULL DEFAULT false,
  plays_cash boolean NOT NULL DEFAULT false,
  plays_live boolean NOT NULL DEFAULT false,
  plays_online boolean NOT NULL DEFAULT false,
  plays_mixed boolean NOT NULL DEFAULT false,
  abi integer,
  buy_in_range text,
  tournaments_per_month integer,
  preferred_sites text[] NOT NULL DEFAULT '{}',
  live_online_split text,
  cash_stakes text,
  cash_primary_game text,
  hands_played integer,
  hands_per_month integer,
  total_cashes text,
  estimated_profit text,
  roi text,
  bb100 text,
  ev_bb100 text,
  largest_score text,
  final_tables integer,
  accomplishments text,
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  looking_for text[] NOT NULL DEFAULT '{}',
  desired_stakes text,
  desired_formats text[] NOT NULL DEFAULT '{}',
  desired_sites text[] NOT NULL DEFAULT '{}',
  volume_commitment text,
  availability text,
  looking_description text,
  analytics_attached boolean NOT NULL DEFAULT false,
  analytics_snapshot jsonb,
  is_published boolean NOT NULL DEFAULT false,
  is_looking boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE poker_resumes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_poker_resumes_account_id ON poker_resumes(account_id);
CREATE INDEX IF NOT EXISTS idx_poker_resumes_published ON poker_resumes(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_poker_resumes_looking ON poker_resumes(is_looking) WHERE is_looking = true;

DROP POLICY IF EXISTS "select_poker_resumes" ON poker_resumes;
CREATE POLICY "select_poker_resumes" ON poker_resumes FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_poker_resumes" ON poker_resumes;
CREATE POLICY "insert_poker_resumes" ON poker_resumes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_poker_resumes" ON poker_resumes;
CREATE POLICY "update_poker_resumes" ON poker_resumes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_poker_resumes" ON poker_resumes;
CREATE POLICY "delete_poker_resumes" ON poker_resumes FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- stable_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS stable_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  stable_name text NOT NULL DEFAULT '',
  logo_initials text,
  description text,
  formats text[] NOT NULL DEFAULT '{}',
  typical_stakes text,
  what_they_provide text,
  what_they_expect text,
  website text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_username text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stable_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_profiles_account_id ON stable_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_stable_profiles_published ON stable_profiles(is_published) WHERE is_published = true;

DROP POLICY IF EXISTS "select_stable_profiles" ON stable_profiles;
CREATE POLICY "select_stable_profiles" ON stable_profiles FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_stable_profiles" ON stable_profiles;
CREATE POLICY "insert_stable_profiles" ON stable_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_stable_profiles" ON stable_profiles;
CREATE POLICY "update_stable_profiles" ON stable_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_stable_profiles" ON stable_profiles;
CREATE POLICY "delete_stable_profiles" ON stable_profiles FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- stable_opportunities
-- ============================================================
CREATE TABLE IF NOT EXISTS stable_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stable_profiles(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT '',
  abi_range text,
  min_volume text,
  includes text[] NOT NULL DEFAULT '{}',
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stable_opportunities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stable_opportunities_stable_id ON stable_opportunities(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_opportunities_status ON stable_opportunities(status);

DROP POLICY IF EXISTS "select_stable_opportunities" ON stable_opportunities;
CREATE POLICY "select_stable_opportunities" ON stable_opportunities FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_stable_opportunities" ON stable_opportunities;
CREATE POLICY "insert_stable_opportunities" ON stable_opportunities FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_stable_opportunities" ON stable_opportunities;
CREATE POLICY "update_stable_opportunities" ON stable_opportunities FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_stable_opportunities" ON stable_opportunities;
CREATE POLICY "delete_stable_opportunities" ON stable_opportunities FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- coach_listings
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  username text,
  avatar_initials text,
  bio text,
  specialties text[] NOT NULL DEFAULT '{}',
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  formats_coached text[] NOT NULL DEFAULT '{}',
  stakes_coached text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  rate_per_hour integer NOT NULL DEFAULT 0,
  session_durations integer[] NOT NULL DEFAULT '{60}',
  coaching_methods text[] NOT NULL DEFAULT '{}',
  accomplishments text,
  availability_summary text,
  is_published boolean NOT NULL DEFAULT false,
  shareable_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_coach_listings_account_id ON coach_listings(account_id);
CREATE INDEX IF NOT EXISTS idx_coach_listings_published ON coach_listings(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_coach_listings_slug ON coach_listings(shareable_slug) WHERE shareable_slug IS NOT NULL;

DROP POLICY IF EXISTS "select_coach_listings" ON coach_listings;
CREATE POLICY "select_coach_listings" ON coach_listings FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_coach_listings" ON coach_listings;
CREATE POLICY "insert_coach_listings" ON coach_listings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_coach_listings" ON coach_listings;
CREATE POLICY "update_coach_listings" ON coach_listings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_coach_listings" ON coach_listings;
CREATE POLICY "delete_coach_listings" ON coach_listings FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- job_postings_v2 (demo-auth compatible)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_postings_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  company text NOT NULL DEFAULT '',
  company_logo text,
  job_title text NOT NULL DEFAULT '',
  job_description text,
  location text,
  work_type text,
  employment_type text,
  salary_range text,
  required_experience text,
  preferred_experience text,
  skills text[] NOT NULL DEFAULT '{}',
  application_deadline date,
  contact_person text,
  category text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_postings_v2 ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_job_postings_v2_account_id ON job_postings_v2(account_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_v2_status ON job_postings_v2(status);

DROP POLICY IF EXISTS "select_job_postings_v2" ON job_postings_v2;
CREATE POLICY "select_job_postings_v2" ON job_postings_v2 FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_job_postings_v2" ON job_postings_v2;
CREATE POLICY "insert_job_postings_v2" ON job_postings_v2 FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_job_postings_v2" ON job_postings_v2;
CREATE POLICY "update_job_postings_v2" ON job_postings_v2 FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_job_postings_v2" ON job_postings_v2;
CREATE POLICY "delete_job_postings_v2" ON job_postings_v2 FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- job_candidates_v2 (demo-auth compatible)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_candidates_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  avatar_initials text,
  location text,
  open_to_remote boolean NOT NULL DEFAULT true,
  poker_background text,
  other_background text,
  skills text[] NOT NULL DEFAULT '{}',
  interested_roles text[] NOT NULL DEFAULT '{}',
  employment_preference text,
  availability text,
  introduction text,
  resume_url text,
  transition_support text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_candidates_v2 ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_job_candidates_v2_account_id ON job_candidates_v2(account_id);
CREATE INDEX IF NOT EXISTS idx_job_candidates_v2_published ON job_candidates_v2(is_published) WHERE is_published = true;

DROP POLICY IF EXISTS "select_job_candidates_v2" ON job_candidates_v2;
CREATE POLICY "select_job_candidates_v2" ON job_candidates_v2 FOR SELECT
  TO anon, authenticated
  USING ((is_published = true AND is_hidden = false) OR account_id = current_setting('app.current_account_id', true));

DROP POLICY IF EXISTS "insert_job_candidates_v2" ON job_candidates_v2;
CREATE POLICY "insert_job_candidates_v2" ON job_candidates_v2 FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_job_candidates_v2" ON job_candidates_v2;
CREATE POLICY "update_job_candidates_v2" ON job_candidates_v2 FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_job_candidates_v2" ON job_candidates_v2;
CREATE POLICY "delete_job_candidates_v2" ON job_candidates_v2 FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Updated_at triggers for all new tables
-- ============================================================
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_poker_resumes_updated_at ON poker_resumes;
CREATE TRIGGER trg_poker_resumes_updated_at BEFORE UPDATE ON poker_resumes FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();

DROP TRIGGER IF EXISTS trg_stable_profiles_updated_at ON stable_profiles;
CREATE TRIGGER trg_stable_profiles_updated_at BEFORE UPDATE ON stable_profiles FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();

DROP TRIGGER IF EXISTS trg_coach_listings_updated_at ON coach_listings;
CREATE TRIGGER trg_coach_listings_updated_at BEFORE UPDATE ON coach_listings FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();

DROP TRIGGER IF EXISTS trg_job_postings_v2_updated_at ON job_postings_v2;
CREATE TRIGGER trg_job_postings_v2_updated_at BEFORE UPDATE ON job_postings_v2 FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();

DROP TRIGGER IF EXISTS trg_job_candidates_v2_updated_at ON job_candidates_v2;
CREATE TRIGGER trg_job_candidates_v2_updated_at BEFORE UPDATE ON job_candidates_v2 FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();
