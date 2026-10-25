/*
# Create business portal tables

1. Purpose
   - Stores business profile, services, content submissions for Industry Feed distribution,
     and entitlement tracking for Business Portal subscribers.
   - Business Profile = company identity (name, logo, category, about, open-to, social links)
   - Business Services = optional professional services the business sells
   - Business Content Submissions = promotional media submitted for staff approval → Industry Feed
   - Business Entitlements = configurable Industry Feed post allowance per billing period

2. New Tables
   - `business_profiles` — one row per business account
   - `business_services` — bookable professional services
   - `business_content_submissions` — promotional content for Industry Feed (draft → pending → approved → live)
   - `business_entitlements` — Industry Feed post allowance tracking

3. Security
   - All tables: owner-scoped CRUD (account_id = auth.uid()).
   - SELECT on business_profiles + business_services is public (anon, authenticated) so People directory can read them.
   - Content submissions: owner can read their own; staff can read all (via existing staff role checks).
   - Entitlements: owner-only (authenticated, account_id = auth.uid()).
*/

-- ── business_profiles ──
CREATE TABLE IF NOT EXISTS business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text DEFAULT '',
  logo_url text DEFAULT '',
  cover_url text DEFAULT '',
  category text DEFAULT 'other', -- operator, brand, agency, service_provider, software, poker_room, staking, media, other
  location text DEFAULT '',
  website text DEFAULT '',
  about text DEFAULT '',
  description text DEFAULT '',
  products_services text DEFAULT '',
  poker_involvement text DEFAULT '',
  team_members jsonb DEFAULT '[]',
  social_links jsonb DEFAULT '{}',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  open_to text[] DEFAULT '{}',
  verified boolean DEFAULT false,
  show_in_directory boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_business_profiles" ON business_profiles;
CREATE POLICY "public_select_business_profiles"
ON business_profiles FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_business_profile" ON business_profiles;
CREATE POLICY "insert_own_business_profile"
ON business_profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_business_profile" ON business_profiles;
CREATE POLICY "update_own_business_profile"
ON business_profiles FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_business_profile" ON business_profiles;
CREATE POLICY "delete_own_business_profile"
ON business_profiles FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── business_services ──
CREATE TABLE IF NOT EXISTS business_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  duration_minutes integer DEFAULT 60,
  price_type text DEFAULT 'fixed', -- fixed, hourly, custom_quote, free
  price_amount integer DEFAULT 0,
  communication_methods text[] DEFAULT '{}', -- chat, video, phone, email, in_person, other
  is_active boolean DEFAULT true,
  requires_inquiry boolean DEFAULT false, -- book directly vs inquire first
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_business_services" ON business_services;
CREATE POLICY "public_select_business_services"
ON business_services FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_business_services" ON business_services;
CREATE POLICY "insert_own_business_services"
ON business_services FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_business_services" ON business_services;
CREATE POLICY "update_own_business_services"
ON business_services FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_business_services" ON business_services;
CREATE POLICY "delete_own_business_services"
ON business_services FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── business_content_submissions ──
CREATE TABLE IF NOT EXISTS business_content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft', -- draft, pending, changes_requested, approved, scheduled, live, rejected, expired
  content_type text DEFAULT 'announcement', -- text, image, video, link, announcement, promotion, event, hiring, sponsorship, partnership
  headline text NOT NULL,
  body text DEFAULT '',
  images text[] DEFAULT '{}',
  video_url text DEFAULT '',
  link_url text DEFAULT '',
  cta_label text DEFAULT '',
  cta_url text DEFAULT '',
  is_promoted boolean DEFAULT true,
  scheduled_for timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  staff_notes text DEFAULT '',
  reviewed_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_content_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_business_content" ON business_content_submissions;
CREATE POLICY "select_own_business_content"
ON business_content_submissions FOR SELECT
TO authenticated USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "insert_own_business_content" ON business_content_submissions;
CREATE POLICY "insert_own_business_content"
ON business_content_submissions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_business_content" ON business_content_submissions;
CREATE POLICY "update_own_business_content"
ON business_content_submissions FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_business_content" ON business_content_submissions;
CREATE POLICY "delete_own_business_content"
ON business_content_submissions FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── business_entitlements ──
CREATE TABLE IF NOT EXISTS business_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  industry_posts_included integer DEFAULT 5,
  industry_posts_used integer DEFAULT 0,
  allowance_reset_period text DEFAULT 'monthly', -- monthly, quarterly, annual
  last_reset_at timestamptz DEFAULT now(),
  next_reset_at timestamptz,
  additional_post_price integer DEFAULT 100, -- in credits
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_business_entitlements" ON business_entitlements;
CREATE POLICY "select_own_business_entitlements"
ON business_entitlements FOR SELECT
TO authenticated USING (auth.uid() = account_id);

DROP POLICY IF EXISTS "insert_own_business_entitlements" ON business_entitlements;
CREATE POLICY "insert_own_business_entitlements"
ON business_entitlements FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "update_own_business_entitlements" ON business_entitlements;
CREATE POLICY "update_own_business_entitlements"
ON business_entitlements FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

DROP POLICY IF EXISTS "delete_own_business_entitlements" ON business_entitlements;
CREATE POLICY "delete_own_business_entitlements"
ON business_entitlements FOR DELETE
TO authenticated USING (auth.uid() = account_id);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_business_profiles_account ON business_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_business_services_account ON business_services(account_id);
CREATE INDEX IF NOT EXISTS idx_business_content_account ON business_content_submissions(account_id);
CREATE INDEX IF NOT EXISTS idx_business_content_status ON business_content_submissions(status);
CREATE INDEX IF NOT EXISTS idx_business_entitlements_account ON business_entitlements(account_id);