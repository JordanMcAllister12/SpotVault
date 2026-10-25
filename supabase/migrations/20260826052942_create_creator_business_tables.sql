/*
# Create creator business tables

1. Purpose
   - Stores creator business configuration: services, availability, opportunities, media kit, and contact preferences.
   - This is the "how people can work with me" data that powers the public People profile booking/opportunity interface.
   - The existing `creator_public_profiles` table stores the "who I am" identity data (name, bio, photos, socials).
   - This migration adds the business-facing tables that complement it.

2. New Tables
   - `creator_services` — bookable services with rates, durations, communication methods
   - `creator_availability` — weekly recurring availability + specific-date overrides/blocks
   - `creator_opportunities` — what the creator is open to (sponsorships, podcasts, etc.) + notes + contact preferences
   - `creator_media_kit` — social stats, promotional photos, additional profile images

3. Security
   - All tables: owner-scoped CRUD (account_id = auth.uid()).
   - SELECT is open to anon+authenticated so the public People directory can read services/availability/opportunities.
   - INSERT/UPDATE/DELETE are owner-only (authenticated, account_id = auth.uid()).
*/

-- ── creator_services ──
CREATE TABLE IF NOT EXISTS creator_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  duration_minutes integer DEFAULT 60,
  price_type text DEFAULT 'fixed', -- fixed, hourly, starting_at, negotiable, contact_for_rate, free
  price_amount integer DEFAULT 0, -- in credits; null/0 for non-fixed types
  communication_methods text[] DEFAULT '{}', -- chat, voice_call, video_call, in_person, discord, other
  is_active boolean DEFAULT true,
  requires_approval boolean DEFAULT false, -- instant booking vs request/approval
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE creator_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_creator_services" ON creator_services;
CREATE POLICY "public_select_creator_services"
ON creator_services FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_creator_services" ON creator_services;
CREATE POLICY "insert_own_creator_services"
ON creator_services FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_creator_services" ON creator_services;
CREATE POLICY "update_own_creator_services"
ON creator_services FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_creator_services" ON creator_services;
CREATE POLICY "delete_own_creator_services"
ON creator_services FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── creator_availability ──
CREATE TABLE IF NOT EXISTS creator_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'weekly', -- weekly, specific_date, blocked_date, vacation
  day_of_week smallint, -- 0=Sun..6=Sat (for weekly entries)
  specific_date date, -- for specific_date / blocked_date / vacation entries
  start_time time, -- null for full-day blocks
  end_time time,
  is_available boolean DEFAULT true, -- false for blocked/unavailable
  label text DEFAULT '', -- optional label e.g. "Vacation"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE creator_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_creator_availability" ON creator_availability;
CREATE POLICY "public_select_creator_availability"
ON creator_availability FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_creator_availability" ON creator_availability;
CREATE POLICY "insert_own_creator_availability"
ON creator_availability FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_creator_availability" ON creator_availability;
CREATE POLICY "update_own_creator_availability"
ON creator_availability FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_creator_availability" ON creator_availability;
CREATE POLICY "delete_own_creator_availability"
ON creator_availability FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── creator_opportunities ──
CREATE TABLE IF NOT EXISTS creator_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  open_to text[] DEFAULT '{}', -- sponsorships, brand_partnerships, content_collaborations, etc.
  looking_for_notes text DEFAULT '',
  contact_preference text DEFAULT 'open_to_all', -- book_directly, send_message_first, submit_opportunity, business_inquiries_only, open_to_all
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE creator_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_creator_opportunities" ON creator_opportunities;
CREATE POLICY "public_select_creator_opportunities"
ON creator_opportunities FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_creator_opportunities" ON creator_opportunities;
CREATE POLICY "insert_own_creator_opportunities"
ON creator_opportunities FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_creator_opportunities" ON creator_opportunities;
CREATE POLICY "update_own_creator_opportunities"
ON creator_opportunities FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_creator_opportunities" ON creator_opportunities;
CREATE POLICY "delete_own_creator_opportunities"
ON creator_opportunities FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── creator_media_kit ──
CREATE TABLE IF NOT EXISTS creator_media_kit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  additional_photos text[] DEFAULT '{}', -- array of image URLs
  youtube_subscribers integer,
  twitch_followers integer,
  twitter_followers integer,
  instagram_followers integer,
  avg_stream_viewers integer,
  poker_accomplishments text DEFAULT '',
  tiktok_followers integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE creator_media_kit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_creator_media_kit" ON creator_media_kit;
CREATE POLICY "public_select_creator_media_kit"
ON creator_media_kit FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_creator_media_kit" ON creator_media_kit;
CREATE POLICY "insert_own_creator_media_kit"
ON creator_media_kit FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_creator_media_kit" ON creator_media_kit;
CREATE POLICY "update_own_creator_media_kit"
ON creator_media_kit FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_creator_media_kit" ON creator_media_kit;
CREATE POLICY "delete_own_creator_media_kit"
ON creator_media_kit FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_creator_services_account ON creator_services(account_id);
CREATE INDEX IF NOT EXISTS idx_creator_availability_account ON creator_availability(account_id);
CREATE INDEX IF NOT EXISTS idx_creator_opportunities_account ON creator_opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_creator_media_kit_account ON creator_media_kit(account_id);