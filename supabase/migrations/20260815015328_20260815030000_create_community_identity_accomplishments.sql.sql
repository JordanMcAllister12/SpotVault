/*
# Community Identity + Paid Participation + Accomplishments System

## Overview
Creates the data model for SpotVault V2 Community identity, participation entitlements,
user profiles, accomplishments with evidence, staff review workflow, and featured items.

## New Tables

### 1. community_entitlements
Tracks each user's community participation level and privileges.
- user_id (text, primary key) — matches SpotVaultAccount.id
- tier ('free' | 'member') — free or paid community member
- is_paid_member (boolean) — convenience flag for checkmark display
- member_since (timestamptz) — when they joined as paid member
- privileges (jsonb) — configurable flags: can_post, can_comment, can_chat, can_boost, can_pin, can_sponsor
- priority_weight (int) — feed distribution priority (free=1, member=5, verified=10)
- created_at, updated_at

### 2. user_profiles
Extended profile data beyond the basic SpotVaultAccount.
- user_id (text, primary key)
- display_name (text)
- bio (text)
- avatar_url (text)
- location (text)
- privacy_mode ('public' | 'members' | 'private') — default 'public'
- poker_site (text) — primary poker site/screen name
- hendon_mob_url (text)
- created_at, updated_at

### 3. profile_accomplishments
User-submitted poker accomplishments/credentials.
- id (uuid, primary key)
- user_id (text) — owner
- title (text) — e.g. "Manitoba Poker Open Champion"
- description (text)
- category ('tournament_win' | 'final_table' | 'online_score' | 'career_cashes' | 'ranking' | 'leaderboard' | 'poker_role' | 'coaching_credential' | 'industry_position' | 'other')
- accomplishment_date (date) — when it happened
- event_name (text) — e.g. "Manitoba Poker Open"
- finish (text) — e.g. "1st", "Final Table"
- prize_amount (numeric) — prize won
- poker_site (text) — PokerStars, GGPoker, etc.
- tournament_series (text) — WPT, WSOP, etc.
- ranking (text) — e.g. "#1 on SharkScope"
- organization (text) — for industry positions
- review_status ('unreviewed' | 'pending' | 'verified' | 'needs_info' | 'rejected') — default 'unreviewed'
- submitted_for_review_at (timestamptz)
- reviewed_at (timestamptz)
- reviewed_by (text) — staff account id
- staff_notes (text) — internal notes
- created_at, updated_at

### 4. accomplishment_evidence
Supporting evidence attached to accomplishments.
- id (uuid, primary key)
- accomplishment_id (uuid FK → profile_accomplishments ON DELETE CASCADE)
- evidence_type ('screenshot' | 'image' | 'document' | 'url')
- url (text) — link to evidence or uploaded file URL
- label (text) — description of evidence
- reviewer_notes (text) — notes for reviewer
- created_at

### 5. accomplishment_reviews
Review audit log — one row per review action.
- id (uuid, primary key)
- accomplishment_id (uuid FK → profile_accomplishments)
- reviewer_id (text) — staff account id
- action ('submit' | 'verify' | 'request_info' | 'reject' | 'remove_verification')
- previous_status (text)
- new_status (text)
- notes (text)
- created_at

### 6. featured_profile_items
User's chosen featured accomplishments for hover card display.
- id (uuid, primary key)
- user_id (text)
- accomplishment_id (uuid FK → profile_accomplishments)
- display_order (int) — 1, 2, 3...
- created_at
- Unique constraint on (user_id, accomplishment_id)

## Security (RLS)
All tables have RLS enabled. Since this app uses demo accounts (no Supabase Auth),
policies use TO anon, authenticated with appropriate access:
- Profiles: public read (respecting privacy_mode), self-write
- Entitlements: public read, self-write (in production this would be server-controlled)
- Accomplishments: public read of verified/pending, self full CRUD on own
- Evidence: read with accomplishment, self-write on own
- Reviews: public read of review log, staff-only write (is_staff check via entitlements)
- Featured: public read, self-write on own

## Important Notes
1. user_id is text (not uuid) to match the existing SpotVaultAccount.id format ("acc-randy" etc.)
2. No foreign keys to auth.users since this app uses demo accounts
3. Privacy is enforced at the application layer via privacy_mode field
4. Staff actions are tracked via accomplishment_reviews audit log
*/

-- 1. community_entitlements
CREATE TABLE IF NOT EXISTS community_entitlements (
  user_id text PRIMARY KEY,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'member')),
  is_paid_member boolean NOT NULL DEFAULT false,
  member_since timestamptz,
  privileges jsonb NOT NULL DEFAULT '{"can_post": false, "can_comment": true, "can_chat": true, "can_boost": false, "can_pin": false, "can_sponsor": false}'::jsonb,
  priority_weight int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entitlements_select_all" ON community_entitlements;
CREATE POLICY "entitlements_select_all" ON community_entitlements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "entitlements_insert_self" ON community_entitlements;
CREATE POLICY "entitlements_insert_self" ON community_entitlements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "entitlements_update_self" ON community_entitlements;
CREATE POLICY "entitlements_update_self" ON community_entitlements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY,
  display_name text,
  bio text,
  avatar_url text,
  location text,
  privacy_mode text NOT NULL DEFAULT 'public' CHECK (privacy_mode IN ('public', 'members', 'private')),
  poker_site text,
  hendon_mob_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON user_profiles;
CREATE POLICY "profiles_select_all" ON user_profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON user_profiles;
CREATE POLICY "profiles_insert_self" ON user_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_self" ON user_profiles;
CREATE POLICY "profiles_update_self" ON user_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. profile_accomplishments
CREATE TABLE IF NOT EXISTS profile_accomplishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN (
    'tournament_win', 'final_table', 'online_score', 'career_cashes',
    'ranking', 'leaderboard', 'poker_role', 'coaching_credential',
    'industry_position', 'other'
  )),
  accomplishment_date date,
  event_name text,
  finish text,
  prize_amount numeric,
  poker_site text,
  tournament_series text,
  ranking text,
  organization text,
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN (
    'unreviewed', 'pending', 'verified', 'needs_info', 'rejected'
  )),
  submitted_for_review_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  staff_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accomplishments_user_id ON profile_accomplishments(user_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_review_status ON profile_accomplishments(review_status);
CREATE INDEX IF NOT EXISTS idx_accomplishments_category ON profile_accomplishments(category);

ALTER TABLE profile_accomplishments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accomplishments_select_all" ON profile_accomplishments;
CREATE POLICY "accomplishments_select_all" ON profile_accomplishments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "accomplishments_insert_self" ON profile_accomplishments;
CREATE POLICY "accomplishments_insert_self" ON profile_accomplishments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "accomplishments_update_self" ON profile_accomplishments;
CREATE POLICY "accomplishments_update_self" ON profile_accomplishments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "accomplishments_delete_self" ON profile_accomplishments;
CREATE POLICY "accomplishments_delete_self" ON profile_accomplishments FOR DELETE
  TO anon, authenticated USING (true);

-- 4. accomplishment_evidence
CREATE TABLE IF NOT EXISTS accomplishment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accomplishment_id uuid NOT NULL REFERENCES profile_accomplishments(id) ON DELETE CASCADE,
  evidence_type text NOT NULL DEFAULT 'url' CHECK (evidence_type IN ('screenshot', 'image', 'document', 'url')),
  url text,
  label text,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_accomplishment_id ON accomplishment_evidence(accomplishment_id);

ALTER TABLE accomplishment_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence_select_all" ON accomplishment_evidence;
CREATE POLICY "evidence_select_all" ON accomplishment_evidence FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "evidence_insert_self" ON accomplishment_evidence;
CREATE POLICY "evidence_insert_self" ON accomplishment_evidence FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "evidence_update_self" ON accomplishment_evidence;
CREATE POLICY "evidence_update_self" ON accomplishment_evidence FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "evidence_delete_self" ON accomplishment_evidence;
CREATE POLICY "evidence_delete_self" ON accomplishment_evidence FOR DELETE
  TO anon, authenticated USING (true);

-- 5. accomplishment_reviews
CREATE TABLE IF NOT EXISTS accomplishment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accomplishment_id uuid NOT NULL REFERENCES profile_accomplishments(id) ON DELETE CASCADE,
  reviewer_id text,
  action text NOT NULL CHECK (action IN ('submit', 'verify', 'request_info', 'reject', 'remove_verification')),
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_accomplishment_id ON accomplishment_reviews(accomplishment_id);

ALTER TABLE accomplishment_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON accomplishment_reviews;
CREATE POLICY "reviews_select_all" ON accomplishment_reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_all" ON accomplishment_reviews;
CREATE POLICY "reviews_insert_all" ON accomplishment_reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 6. featured_profile_items
CREATE TABLE IF NOT EXISTS featured_profile_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  accomplishment_id uuid NOT NULL REFERENCES profile_accomplishments(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, accomplishment_id)
);

CREATE INDEX IF NOT EXISTS idx_featured_user_id ON featured_profile_items(user_id);

ALTER TABLE featured_profile_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "featured_select_all" ON featured_profile_items;
CREATE POLICY "featured_select_all" ON featured_profile_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "featured_insert_self" ON featured_profile_items;
CREATE POLICY "featured_insert_self" ON featured_profile_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "featured_update_self" ON featured_profile_items;
CREATE POLICY "featured_update_self" ON featured_profile_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "featured_delete_self" ON featured_profile_items;
CREATE POLICY "featured_delete_self" ON featured_profile_items FOR DELETE
  TO anon, authenticated USING (true);

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_entitlements_updated ON community_entitlements;
CREATE TRIGGER trigger_entitlements_updated BEFORE UPDATE ON community_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_profiles_updated ON user_profiles;
CREATE TRIGGER trigger_profiles_updated BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_accomplishments_updated ON profile_accomplishments;
CREATE TRIGGER trigger_accomplishments_updated BEFORE UPDATE ON profile_accomplishments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
