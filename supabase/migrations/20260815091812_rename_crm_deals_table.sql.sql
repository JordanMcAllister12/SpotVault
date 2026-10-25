/*
# Rename CRM deal table to avoid conflict with existing business_deals

1. Renamed Tables
- `business_crm_deals` — replaces the `business_deals` table from the previous migration
  to avoid a naming conflict with the pre-existing `business_deals` table (which is a
  different concept — deal postings, not pipeline deals).

2. Security
- Same RLS policies as before: anon + authenticated full CRUD.
*/

CREATE TABLE IF NOT EXISTS business_crm_deals (
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
ALTER TABLE business_crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_crm_deals" ON business_crm_deals;
CREATE POLICY "anon_select_crm_deals" ON business_crm_deals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_crm_deals" ON business_crm_deals;
CREATE POLICY "anon_insert_crm_deals" ON business_crm_deals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_crm_deals" ON business_crm_deals;
CREATE POLICY "anon_update_crm_deals" ON business_crm_deals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_crm_deals" ON business_crm_deals;
CREATE POLICY "anon_delete_crm_deals" ON business_crm_deals FOR DELETE TO anon, authenticated USING (true);
