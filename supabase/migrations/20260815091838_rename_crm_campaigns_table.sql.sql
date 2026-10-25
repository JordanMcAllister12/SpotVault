/*
# Rename CRM campaign and ad request tables to avoid conflicts

1. Renamed Tables
- `business_crm_campaigns` — replaces `business_campaigns` from the previous migration
  to avoid a naming conflict with the pre-existing `business_campaigns` table (which
  is a different concept — ad campaign management, not the CRM campaign tracker).
- `business_crm_ad_requests` — replaces `business_ad_requests` for consistency.

2. Security
- Same RLS policies: anon + authenticated full CRUD.
*/

CREATE TABLE IF NOT EXISTS business_crm_campaigns (
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
ALTER TABLE business_crm_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_crm_campaigns" ON business_crm_campaigns;
CREATE POLICY "anon_select_crm_campaigns" ON business_crm_campaigns FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_crm_campaigns" ON business_crm_campaigns;
CREATE POLICY "anon_insert_crm_campaigns" ON business_crm_campaigns FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_crm_campaigns" ON business_crm_campaigns;
CREATE POLICY "anon_update_crm_campaigns" ON business_crm_campaigns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_crm_campaigns" ON business_crm_campaigns;
CREATE POLICY "anon_delete_crm_campaigns" ON business_crm_campaigns FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS business_crm_ad_requests (
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
ALTER TABLE business_crm_ad_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_crm_ad_requests" ON business_crm_ad_requests;
CREATE POLICY "anon_select_crm_ad_requests" ON business_crm_ad_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_crm_ad_requests" ON business_crm_ad_requests;
CREATE POLICY "anon_insert_crm_ad_requests" ON business_crm_ad_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_crm_ad_requests" ON business_crm_ad_requests;
CREATE POLICY "anon_update_crm_ad_requests" ON business_crm_ad_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_crm_ad_requests" ON business_crm_ad_requests;
CREATE POLICY "anon_delete_crm_ad_requests" ON business_crm_ad_requests FOR DELETE TO anon, authenticated USING (true);
