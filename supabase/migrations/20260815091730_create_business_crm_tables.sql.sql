/*
# Create Business CRM tables

1. New Tables
- `business_contacts` — private company rolodex. Each contact references a SpotVault
  user identity (user_id) but adds private CRM metadata (category, tags, notes,
  relationship strength, follow-up dates, favorite flag) on top of the universal profile.
- `business_pitches` — structured proposals sent from a business to industry contacts.
  Tracks title, recipient, company, intro, proposal body, deal value, status
  (draft/sent/viewed/responded/meeting_booked/closed), and optional meeting request.
- `business_pitch_attachments` — files attached to pitches. References the file vault
  by file name/path (no separate FK since files are stored in Supabase Storage).
- `business_deals` — lightweight deal pipeline. Each deal has a name, contact, company,
  estimated value, deal type, stage (lead/contacted/discussion/proposal/negotiation/won/lost),
  notes, next action, and follow-up date.
- `business_ad_requests` — advertising inquiry submissions. Company, promotion description,
  desired placement, target audience, budget, start date, duration, notes, and status
  (pending/approved/rejected/completed).
- `business_campaigns` — advertising campaign records. Campaign name, placement, start/end
  dates, status, spend, impressions, clicks, CTR. Demo data only until real tracking exists.
- `business_files` — business file vault. Stores file name, path (Supabase Storage URL),
  category (pitch_deck/logo/rate_card/sponsorship_package/image/marketing_asset/document/other),
  and optional notes.

2. Security
- All tables are single-tenant (no auth in this prototype), so policies use
  `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` — the data
  is intentionally shared/public for demo purposes.
- RLS enabled on every table.
*/

-- business_contacts
CREATE TABLE IF NOT EXISTS business_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text,
  name text NOT NULL DEFAULT '',
  username text,
  company text,
  position text,
  category text NOT NULL DEFAULT 'other',
  location text,
  contact_status text NOT NULL DEFAULT 'warm',
  relationship_strength text NOT NULL DEFAULT 'medium',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  last_interaction date,
  next_follow_up date,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_business_contacts" ON business_contacts;
CREATE POLICY "anon_select_business_contacts" ON business_contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_business_contacts" ON business_contacts;
CREATE POLICY "anon_insert_business_contacts" ON business_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_business_contacts" ON business_contacts;
CREATE POLICY "anon_update_business_contacts" ON business_contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_business_contacts" ON business_contacts;
CREATE POLICY "anon_delete_business_contacts" ON business_contacts FOR DELETE TO anon, authenticated USING (true);

-- business_pitches
CREATE TABLE IF NOT EXISTS business_pitches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  recipient_name text,
  recipient_user_id text,
  company text,
  introduction text,
  proposal text,
  deal_value text,
  requested_meeting text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_pitches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_business_pitches" ON business_pitches;
CREATE POLICY "anon_select_business_pitches" ON business_pitches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_business_pitches" ON business_pitches;
CREATE POLICY "anon_insert_business_pitches" ON business_pitches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_business_pitches" ON business_pitches;
CREATE POLICY "anon_update_business_pitches" ON business_pitches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_business_pitches" ON business_pitches;
CREATE POLICY "anon_delete_business_pitches" ON business_pitches FOR DELETE TO anon, authenticated USING (true);

-- business_pitch_attachments
CREATE TABLE IF NOT EXISTS business_pitch_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES business_pitches(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_pitch_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_pitch_attachments" ON business_pitch_attachments;
CREATE POLICY "anon_select_pitch_attachments" ON business_pitch_attachments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pitch_attachments" ON business_pitch_attachments;
CREATE POLICY "anon_insert_pitch_attachments" ON business_pitch_attachments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pitch_attachments" ON business_pitch_attachments;
CREATE POLICY "anon_delete_pitch_attachments" ON business_pitch_attachments FOR DELETE TO anon, authenticated USING (true);

-- business_deals
CREATE TABLE IF NOT EXISTS business_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  deal_name text NOT NULL DEFAULT '',
  contact_name text,
  contact_user_id text,
  company text,
  estimated_value text,
  deal_type text NOT NULL DEFAULT 'other',
  stage text NOT NULL DEFAULT 'lead',
  notes text,
  next_action text,
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_business_deals" ON business_deals;
CREATE POLICY "anon_select_business_deals" ON business_deals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_business_deals" ON business_deals;
CREATE POLICY "anon_insert_business_deals" ON business_deals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_business_deals" ON business_deals;
CREATE POLICY "anon_update_business_deals" ON business_deals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_business_deals" ON business_deals;
CREATE POLICY "anon_delete_business_deals" ON business_deals FOR DELETE TO anon, authenticated USING (true);

-- business_ad_requests
CREATE TABLE IF NOT EXISTS business_ad_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  company text NOT NULL DEFAULT '',
  promotion text,
  desired_placement text,
  target_audience text,
  budget text,
  start_date date,
  duration text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_ad_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ad_requests" ON business_ad_requests;
CREATE POLICY "anon_select_ad_requests" ON business_ad_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ad_requests" ON business_ad_requests;
CREATE POLICY "anon_insert_ad_requests" ON business_ad_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ad_requests" ON business_ad_requests;
CREATE POLICY "anon_update_ad_requests" ON business_ad_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ad_requests" ON business_ad_requests;
CREATE POLICY "anon_delete_ad_requests" ON business_ad_requests FOR DELETE TO anon, authenticated USING (true);

-- business_campaigns
CREATE TABLE IF NOT EXISTS business_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  campaign_name text NOT NULL DEFAULT '',
  placement text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'draft',
  spend text,
  impressions integer,
  clicks integer,
  ctr text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_campaigns" ON business_campaigns;
CREATE POLICY "anon_select_campaigns" ON business_campaigns FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_campaigns" ON business_campaigns;
CREATE POLICY "anon_insert_campaigns" ON business_campaigns FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_campaigns" ON business_campaigns;
CREATE POLICY "anon_update_campaigns" ON business_campaigns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_campaigns" ON business_campaigns;
CREATE POLICY "anon_delete_campaigns" ON business_campaigns FOR DELETE TO anon, authenticated USING (true);

-- business_files
CREATE TABLE IF NOT EXISTS business_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_business_files" ON business_files;
CREATE POLICY "anon_select_business_files" ON business_files FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_business_files" ON business_files;
CREATE POLICY "anon_insert_business_files" ON business_files FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_business_files" ON business_files;
CREATE POLICY "anon_delete_business_files" ON business_files FOR DELETE TO anon, authenticated USING (true);
