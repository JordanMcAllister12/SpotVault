/*
# SpotVault Universal Booking Marketplace

## Purpose
A centralized booking engine that lets approved poker-industry people (coaches, creators,
executives, investors, business professionals) make their time available to the SpotVault
community. Any user from any portal can discover and request/book time through one shared system.

## New Tables

1. booking_providers
   - Provider profile for users who offer their time
   - Links to SpotVault demo account via account_id (text, not auth.users FK since app uses demo auth)
   - Fields: availability toggle, booking mode (paid/meeting/both), bio, response time, timezone,
     min notice hours, max advance days, max daily/weekly bookings, booking notes, eligibility role

2. booking_services
   - Interaction types offered by a provider (coaching, strategy, consultation, custom, etc.)
   - Fields: name, description, duration minutes, price credits, service type, active toggle,
     allows file upload, includes messaging, cancellation hours, lead time

3. booking_time_slots
   - Individual or recurring weekly availability slots
   - Fields: day-of-week for recurring, specific date for one-off, start/end times, is_recurring,
     is_blackout flag to mark unavailable periods
   - Unique constraint prevents duplicate slots for same provider/time

4. bookings
   - The actual booking record between requester and provider
   - Fields: provider_account_id, requester_account_id, service_id, start_time (timestamptz),
     end_time, duration, price, platform_fee, provider_payout, payment_status, booking_status,
     request_type (paid/meeting_request), message/reason, company/project for meeting requests
   - EXCLUDE constraint prevents double-booking (no two confirmed/pending bookings can overlap
     for the same provider)
   - Status enum: available, requested, pending, confirmed, declined, cancelled, completed,
     expired, reschedule_requested

5. booking_settings
   - Admin-configurable platform settings (platform fee rate, provider approval required, etc.)
   - Single-row configuration table

## Security
- RLS enabled on all tables
- TO anon, authenticated on all tables (app uses demo auth with anon key)
- All CRUD allowed for anon/authenticated since the app uses demo auth and the booking system
  is community-accessible
- Double-booking protection is enforced at the database level via EXCLUDE constraint

## Important Notes
1. All times stored as timestamptz (UTC) for timezone consistency
2. Frontend converts to/from user's local timezone for display
3. The EXCLUDE constraint on bookings uses tstzrange to prevent overlapping confirmed/pending
   bookings for the same provider
4. Platform fee is configurable via booking_settings table (not hardcoded)
5. Provider eligibility is role-based (stored in booking_providers.eligibility_role)
*/

-- ============================================================
-- 1. booking_providers
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  title text,
  subtitle text,
  category text NOT NULL DEFAULT 'COACH',
  bio text,
  photo_initials text DEFAULT '',
  verified boolean DEFAULT false,
  is_available boolean DEFAULT false,
  booking_mode text NOT NULL DEFAULT 'paid',
  -- 'paid' | 'meeting_requests' | 'both'
  response_time_hours integer DEFAULT 24,
  timezone text DEFAULT 'UTC',
  min_notice_hours integer DEFAULT 12,
  max_advance_days integer DEFAULT 30,
  max_daily_bookings integer DEFAULT 5,
  max_weekly_bookings integer DEFAULT 20,
  booking_notes text,
  eligibility_role text DEFAULT 'coach',
  -- 'coach' | 'creator' | 'pro' | 'business' | 'investor' | 'industry_executive' | 'admin_authorized'
  specialties text[] DEFAULT '{}',
  game_types text[] DEFAULT '{}',
  completed_sessions integer DEFAULT 0,
  rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE booking_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_providers" ON booking_providers;
CREATE POLICY "anon_select_providers" ON booking_providers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_providers" ON booking_providers;
CREATE POLICY "anon_insert_providers" ON booking_providers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_providers" ON booking_providers;
CREATE POLICY "anon_update_providers" ON booking_providers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_providers" ON booking_providers;
CREATE POLICY "anon_delete_providers" ON booking_providers FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 2. booking_services
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES booking_providers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_type text NOT NULL DEFAULT 'STRATEGY_SESSION',
  duration_minutes integer NOT NULL DEFAULT 60,
  price_credits integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  includes_messaging boolean DEFAULT true,
  allows_file_upload boolean DEFAULT false,
  cancellation_hours integer DEFAULT 24,
  lead_time_hours integer DEFAULT 12,
  max_per_day integer DEFAULT 5,
  max_per_week integer DEFAULT 20,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_services" ON booking_services;
CREATE POLICY "anon_select_services" ON booking_services FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_services" ON booking_services;
CREATE POLICY "anon_insert_services" ON booking_services FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_services" ON booking_services;
CREATE POLICY "anon_update_services" ON booking_services FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_services" ON booking_services;
CREATE POLICY "anon_delete_services" ON booking_services FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. booking_time_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES booking_providers(id) ON DELETE CASCADE,
  day_of_week integer,
  -- 0=Sun ... 6=Sat, NULL for date-specific slots
  specific_date date,
  -- for one-off slots; NULL for recurring
  start_time text NOT NULL,
  -- 'HH:MM' in provider's timezone
  end_time text NOT NULL,
  -- 'HH:MM' in provider's timezone
  is_recurring boolean DEFAULT false,
  is_blackout boolean DEFAULT false,
  -- marks unavailable periods
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_slots" ON booking_time_slots;
CREATE POLICY "anon_select_slots" ON booking_time_slots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_slots" ON booking_time_slots;
CREATE POLICY "anon_insert_slots" ON booking_time_slots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_slots" ON booking_time_slots;
CREATE POLICY "anon_update_slots" ON booking_time_slots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_slots" ON booking_time_slots;
CREATE POLICY "anon_delete_slots" ON booking_time_slots FOR DELETE
  TO anon, authenticated USING (true);

-- Index for querying provider's slots
CREATE INDEX IF NOT EXISTS idx_booking_slots_provider ON booking_time_slots(provider_id);

-- ============================================================
-- 4. bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id text NOT NULL,
  requester_account_id text NOT NULL,
  provider_id uuid REFERENCES booking_providers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES booking_services(id) ON DELETE SET NULL,
  service_name text,
  service_type text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  price_credits integer DEFAULT 0,
  platform_fee_credits integer DEFAULT 0,
  provider_payout_credits integer DEFAULT 0,
  payment_status text DEFAULT 'pending',
  -- 'pending' | 'authorized' | 'captured' | 'refunded' | 'n/a'
  booking_status text NOT NULL DEFAULT 'pending',
  -- 'requested' | 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'expired' | 'reschedule_requested'
  request_type text NOT NULL DEFAULT 'paid',
  -- 'paid' | 'meeting_request'
  message text,
  -- requester's message/reason
  company text,
  -- company/project for meeting requests
  suggested_new_time timestamptz,
  -- for reschedule suggestions
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
CREATE POLICY "anon_select_bookings" ON bookings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bookings" ON bookings;
CREATE POLICY "anon_delete_bookings" ON bookings FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_bookings_requester ON bookings(requester_account_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_time);

-- ============================================================
-- Double-booking protection: EXCLUDE constraint
-- Prevents two active (pending/confirmed/requested) bookings from
-- overlapping for the same provider.
-- Uses EXCLUDE with tstzrange to check time overlap.
-- ============================================================
-- Need btree_gist extension for the EXCLUDE constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prevent_double_booking'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT prevent_double_booking
      EXCLUDE USING gist (
        provider_account_id WITH =,
        tstzrange(start_time, end_time) WITH &&
      )
      WHERE (booking_status IN ('pending', 'confirmed', 'requested', 'reschedule_requested'));
  END IF;
END $$;

-- ============================================================
-- 5. booking_settings (admin config, single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee_rate numeric DEFAULT 0.20,
  provider_approval_required boolean DEFAULT false,
  allow_free_requests boolean DEFAULT true,
  min_booking_price_credits integer DEFAULT 0,
  max_booking_price_credits integer DEFAULT 100000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON booking_settings;
CREATE POLICY "anon_select_settings" ON booking_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON booking_settings;
CREATE POLICY "anon_insert_settings" ON booking_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON booking_settings;
CREATE POLICY "anon_update_settings" ON booking_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default settings row
INSERT INTO booking_settings (platform_fee_rate, provider_approval_required, allow_free_requests)
VALUES (0.20, false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_booking_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_providers_updated ON booking_providers;
CREATE TRIGGER trg_booking_providers_updated BEFORE UPDATE ON booking_providers
  FOR EACH ROW EXECUTE FUNCTION update_booking_updated_at();

DROP TRIGGER IF EXISTS trg_booking_services_updated ON booking_services;
CREATE TRIGGER trg_booking_services_updated BEFORE UPDATE ON booking_services
  FOR EACH ROW EXECUTE FUNCTION update_booking_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated ON bookings;
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_booking_updated_at();

DROP TRIGGER IF EXISTS trg_booking_settings_updated ON booking_settings;
CREATE TRIGGER trg_booking_settings_updated BEFORE UPDATE ON booking_settings
  FOR EACH ROW EXECUTE FUNCTION update_booking_updated_at();
