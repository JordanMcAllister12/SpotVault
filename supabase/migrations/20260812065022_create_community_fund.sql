/*
# Create SpotVault Community Fund tables

1. Purpose
   SpotVault periodically reinvests in the poker community. This table stores
   admin-controlled funding initiatives (freerolls, wellness, education, etc.).
   Funding amounts are NOT automatically calculated from company profits —
   they are admin-controlled discretionary contributions.

2. New Tables
   - `community_fund_initiatives`
     - id (uuid, primary key)
     - title (text, not null) — initiative name
     - description (text) — what was funded
     - category (text, not null) — PLAYER_DROPS | POKER_EDUCATION | PLAYER_WELLNESS |
       COMMUNITY_PROJECTS | CAREER_TRANSITIONS | CREATOR_INDUSTRY_INITIATIVES
     - amount (integer, not null) — total funding committed (USD cents)
     - amount_distributed (integer, default 0) — amount actually distributed so far
     - players_supported (integer, default 0) — number of players benefiting
     - partner (text) — optional partner organization name
     - status (text, not null, default 'active') — active | completed | upcoming
     - start_date (date) — when the initiative begins
     - end_date (date) — when it ends
     - eligibility (text) — who qualifies
     - image (text) — optional image URL
     - external_link (text) — optional learn-more link
     - is_featured (boolean, default false) — show as the featured initiative
     - created_at (timestamptz, default now())

3. Security
   - Enable RLS.
   - This is a demo/no-auth app, so all initiatives are publicly readable.
   - Writes are admin-controlled; for the demo we allow anon inserts/updates
     so the demo can seed data. In production, writes would be restricted
     to an admin role.

4. Notes
   - Amounts stored in cents to avoid float rounding issues.
   - The `category` values mirror the six categories shown in the UI.
*/

CREATE TABLE IF NOT EXISTS community_fund_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (
    category IN (
      'PLAYER_DROPS',
      'POKER_EDUCATION',
      'PLAYER_WELLNESS',
      'COMMUNITY_PROJECTS',
      'CAREER_TRANSITIONS',
      'CREATOR_INDUSTRY_INITIATIVES'
    )
  ),
  amount integer NOT NULL,
  amount_distributed integer NOT NULL DEFAULT 0,
  players_supported integer NOT NULL DEFAULT 0,
  partner text,
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('upcoming', 'active', 'completed')
  ),
  start_date date,
  end_date date,
  eligibility text,
  image text,
  external_link text,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE community_fund_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fund_initiatives" ON community_fund_initiatives;
CREATE POLICY "anon_select_fund_initiatives"
ON community_fund_initiatives FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fund_initiatives" ON community_fund_initiatives;
CREATE POLICY "anon_insert_fund_initiatives"
ON community_fund_initiatives FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fund_initiatives" ON community_fund_initiatives;
CREATE POLICY "anon_update_fund_initiatives"
ON community_fund_initiatives FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fund_initiatives" ON community_fund_initiatives;
CREATE POLICY "anon_delete_fund_initiatives"
ON community_fund_initiatives FOR DELETE
TO anon, authenticated USING (true);
