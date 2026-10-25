/*
# Create Stable Portal tables

1. Purpose
   Build the management, recruiting, intelligence, and commercial infrastructure for poker stables.
   Stables manage rosters, review player submissions, recruit candidates, publish resources,
   and track earnings/makeup. Players do NOT live in the Stable Portal — each sponsored player
   gets their own Player Portal. The Stable Portal sits above the roster.

2. New Tables

   - `stables` — The stable organization entity (name, profile, billing seats, recruiting criteria).
   - `stable_members` — Staff/role associations (owner, admin, manager, coach, recruiter, reviewer).
   - `stable_players` — Roster entries linking a player to a stable with status, coach assignment, contract info, makeup.
   - `stable_postings` — Public recruiting advertisements published by the stable.
   - `stable_applications` — Applications from players to join a stable (linked to backing profile).
   - `stable_candidates` — Auto-discovered / saved candidates surfaced to the stable.
   - `stable_review_submissions` — Hands/packages/notes/questions submitted by players to the stable for review.
   - `stable_library_items` — Internal resource library items (private to stable, shared with roster, or published).
   - `stable_earnings` — Ledger of content sales, SpotVault fees, stable proceeds, player allocations, makeup credits.
   - `stable_activity` — Observable activity feed across the organization.

3. Columns Overview
   - `stables`: id, name, slug, description, logo_url, billing_seats (int), monthly_seat_price_cents (int),
     recruiting_criteria (jsonb), created_at, updated_at.
   - `stable_members`: id, stable_id, user_id, role (text), created_at.
   - `stable_players`: id, stable_id, user_id, display_name, screen_names (text[]), game_type, stakes, abi (numeric),
     volume_hands (int), status (text), assigned_coach_id, join_date, contract_info (jsonb), makeup_amount (numeric),
     created_at, updated_at.
   - `stable_postings`: id, stable_id, title, body, game_type, stakes, abi_min, abi_max, required_volume,
     coaching_provided, bankroll_arrangement, profit_split, makeup_terms, contract_duration, requirements (text[]),
     geographic_restrictions, is_published, created_at, updated_at.
   - `stable_applications`: id, stable_id, posting_id (nullable), user_id, backing_profile_id (nullable),
     status (text: pending/reviewing/interviewed/offer_made/accepted/rejected), created_at, updated_at.
   - `stable_candidates`: id, stable_id, user_id, source (auto/saved), status (text), match_score (int),
     notes (text), created_at, updated_at.
   - `stable_review_submissions`: id, stable_id, player_id, submission_type (text), title, body,
     hand_data (jsonb), status (text: pending/reviewing/responded/complete), reviewer_id, review_notes (text),
     created_at, reviewed_at.
   - `stable_library_items`: id, stable_id, title, description, item_type (text), storage_url,
     visibility (text: private/roster/selected/published), assigned_player_ids (uuid[]), price_cents (int),
     created_at, updated_at.
   - `stable_earnings`: id, stable_id, player_id, transaction_type (text), gross_cents (int),
     spotvault_fee_cents (int), stable_proceeds_cents (int), player_share_cents (int),
     treatment (text: payout/makeup/credit), description, created_at.
   - `stable_activity`: id, stable_id, player_id (nullable), activity_type (text), description,
     metadata (jsonb), created_at.

4. Security
   - RLS enabled on every table.
   - Policies scoped to `authenticated` users who are members of the stable (via `stable_members` check).
   - SELECT allows any stable member to read their stable's data.
   - INSERT/UPDATE/DELETE scoped to owners/admins/managers for management tables; coaches/reviewers for review tables.
   - `stable_review_submissions` allows authenticated players to INSERT their own submissions.
   - `stable_library_items` visibility 'published' is readable by all authenticated users.

5. Notes
   - All tables use `gen_random_uuid()` for primary keys.
   - Timestamps default to `now()`.
   - JSON columns use `jsonb` for flexible schema evolution.
   - Amounts stored in cents (integer) to avoid floating-point issues, except abi/makeup which use numeric(12,2).
*/

-- Stables
CREATE TABLE IF NOT EXISTS stables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  logo_url text,
  billing_seats int NOT NULL DEFAULT 0,
  monthly_seat_price_cents int NOT NULL DEFAULT 3000,
  recruiting_criteria jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stables ENABLE ROW LEVEL SECURITY;

-- Stable members (staff)
CREATE TABLE IF NOT EXISTS stable_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_members ENABLE ROW LEVEL SECURITY;

-- Stable players (roster)
CREATE TABLE IF NOT EXISTS stable_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  screen_names text[] DEFAULT '{}',
  game_type text,
  stakes text,
  abi numeric(12,2) DEFAULT 0,
  volume_hands int DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  assigned_coach_id uuid,
  join_date date,
  contract_info jsonb DEFAULT '{}'::jsonb,
  makeup_amount numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stable_players ENABLE ROW LEVEL SECURITY;

-- Stable postings (recruiting ads)
CREATE TABLE IF NOT EXISTS stable_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  game_type text,
  stakes text,
  abi_min numeric(12,2),
  abi_max numeric(12,2),
  required_volume int,
  coaching_provided boolean DEFAULT true,
  bankroll_arrangement text,
  profit_split text,
  makeup_terms text,
  contract_duration text,
  requirements text[] DEFAULT '{}',
  geographic_restrictions text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stable_postings ENABLE ROW LEVEL SECURITY;

-- Stable applications
CREATE TABLE IF NOT EXISTS stable_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  posting_id uuid REFERENCES stable_postings(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  backing_profile_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stable_applications ENABLE ROW LEVEL SECURITY;

-- Stable candidates (auto-discovered / saved)
CREATE TABLE IF NOT EXISTS stable_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'auto',
  status text NOT NULL DEFAULT 'new',
  match_score int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stable_candidates ENABLE ROW LEVEL SECURITY;

-- Stable review submissions
CREATE TABLE IF NOT EXISTS stable_review_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  submission_type text NOT NULL DEFAULT 'hand',
  title text,
  body text,
  hand_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE stable_review_submissions ENABLE ROW LEVEL SECURITY;

-- Stable library items
CREATE TABLE IF NOT EXISTS stable_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'document',
  storage_url text,
  visibility text NOT NULL DEFAULT 'private',
  assigned_player_ids uuid[] DEFAULT '{}',
  price_cents int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stable_library_items ENABLE ROW LEVEL SECURITY;

-- Stable earnings ledger
CREATE TABLE IF NOT EXISTS stable_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid,
  transaction_type text NOT NULL DEFAULT 'content_sale',
  gross_cents int NOT NULL DEFAULT 0,
  spotvault_fee_cents int NOT NULL DEFAULT 0,
  stable_proceeds_cents int NOT NULL DEFAULT 0,
  player_share_cents int NOT NULL DEFAULT 0,
  treatment text NOT NULL DEFAULT 'payout',
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_earnings ENABLE ROW LEVEL SECURITY;

-- Stable activity feed
CREATE TABLE IF NOT EXISTS stable_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id uuid NOT NULL REFERENCES stables(id) ON DELETE CASCADE,
  player_id uuid,
  activity_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stable_activity ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is a stable member
CREATE OR REPLACE FUNCTION is_stable_member(check_stable_id uuid, check_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM stable_members
    WHERE stable_id = check_stable_id AND user_id = check_user_id
  );
$$;

-- Helper function: check if user is stable owner/admin
CREATE OR REPLACE FUNCTION is_stable_admin(check_stable_id uuid, check_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM stable_members
    WHERE stable_id = check_stable_id AND user_id = check_user_id
    AND role IN ('owner', 'admin')
  );
$$;

-- Policies for stables
DROP POLICY IF EXISTS "stable_member_read_stables" ON stables;
CREATE POLICY "stable_member_read_stables" ON stables FOR SELECT
  TO authenticated USING (is_stable_member(id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_stables" ON stables;
CREATE POLICY "stable_admin_insert_stables" ON stables FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "stable_admin_update_stables" ON stables;
CREATE POLICY "stable_admin_update_stables" ON stables FOR UPDATE
  TO authenticated USING (is_stable_admin(id, auth.uid())) WITH CHECK (is_stable_admin(id, auth.uid()));

-- Policies for stable_members
DROP POLICY IF EXISTS "stable_member_read_members" ON stable_members;
CREATE POLICY "stable_member_read_members" ON stable_members FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_members" ON stable_members;
CREATE POLICY "stable_admin_insert_members" ON stable_members FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_members" ON stable_members;
CREATE POLICY "stable_admin_update_members" ON stable_members FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_members" ON stable_members;
CREATE POLICY "stable_admin_delete_members" ON stable_members FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));

-- Policies for stable_players (roster)
DROP POLICY IF EXISTS "stable_member_read_players" ON stable_players;
CREATE POLICY "stable_member_read_players" ON stable_players FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_players" ON stable_players;
CREATE POLICY "stable_admin_insert_players" ON stable_players FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_players" ON stable_players;
CREATE POLICY "stable_admin_update_players" ON stable_players FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_players" ON stable_players;
CREATE POLICY "stable_admin_delete_players" ON stable_players FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));

-- Policies for stable_postings
DROP POLICY IF EXISTS "stable_member_read_postings" ON stable_postings;
CREATE POLICY "stable_member_read_postings" ON stable_postings FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()) OR is_published);

DROP POLICY IF EXISTS "stable_admin_insert_postings" ON stable_postings;
CREATE POLICY "stable_admin_insert_postings" ON stable_postings FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_postings" ON stable_postings;
CREATE POLICY "stable_admin_update_postings" ON stable_postings FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_postings" ON stable_postings;
CREATE POLICY "stable_admin_delete_postings" ON stable_postings FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));

-- Policies for stable_applications
DROP POLICY IF EXISTS "stable_member_read_applications" ON stable_applications;
CREATE POLICY "stable_member_read_applications" ON stable_applications FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "anyone_insert_applications" ON stable_applications;
CREATE POLICY "anyone_insert_applications" ON stable_applications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "stable_admin_update_applications" ON stable_applications;
CREATE POLICY "stable_admin_update_applications" ON stable_applications FOR UPDATE
  TO authenticated USING (is_stable_member(stable_id, auth.uid())) WITH CHECK (is_stable_member(stable_id, auth.uid()));

-- Policies for stable_candidates
DROP POLICY IF EXISTS "stable_member_read_candidates" ON stable_candidates;
CREATE POLICY "stable_member_read_candidates" ON stable_candidates FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_candidates" ON stable_candidates;
CREATE POLICY "stable_admin_insert_candidates" ON stable_candidates FOR INSERT
  TO authenticated WITH CHECK (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_candidates" ON stable_candidates;
CREATE POLICY "stable_admin_update_candidates" ON stable_candidates FOR UPDATE
  TO authenticated USING (is_stable_member(stable_id, auth.uid())) WITH CHECK (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_candidates" ON stable_candidates;
CREATE POLICY "stable_admin_delete_candidates" ON stable_candidates FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));

-- Policies for stable_review_submissions
DROP POLICY IF EXISTS "stable_member_read_reviews" ON stable_review_submissions;
CREATE POLICY "stable_member_read_reviews" ON stable_review_submissions FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()) OR player_id = auth.uid());

DROP POLICY IF EXISTS "player_insert_reviews" ON stable_review_submissions;
CREATE POLICY "player_insert_reviews" ON stable_review_submissions FOR INSERT
  TO authenticated WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS "stable_member_update_reviews" ON stable_review_submissions;
CREATE POLICY "stable_member_update_reviews" ON stable_review_submissions FOR UPDATE
  TO authenticated USING (is_stable_member(stable_id, auth.uid())) WITH CHECK (is_stable_member(stable_id, auth.uid()));

-- Policies for stable_library_items
DROP POLICY IF EXISTS "stable_member_read_library" ON stable_library_items;
CREATE POLICY "stable_member_read_library" ON stable_library_items FOR SELECT
  TO authenticated USING (
    is_stable_member(stable_id, auth.uid())
    OR (visibility = 'published' AND true)
  );

DROP POLICY IF EXISTS "stable_admin_insert_library" ON stable_library_items;
CREATE POLICY "stable_admin_insert_library" ON stable_library_items FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_library" ON stable_library_items;
CREATE POLICY "stable_admin_update_library" ON stable_library_items FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_delete_library" ON stable_library_items;
CREATE POLICY "stable_admin_delete_library" ON stable_library_items FOR DELETE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid()));

-- Policies for stable_earnings
DROP POLICY IF EXISTS "stable_member_read_earnings" ON stable_earnings;
CREATE POLICY "stable_member_read_earnings" ON stable_earnings FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_insert_earnings" ON stable_earnings;
CREATE POLICY "stable_admin_insert_earnings" ON stable_earnings FOR INSERT
  TO authenticated WITH CHECK (is_stable_admin(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_admin_update_earnings" ON stable_earnings;
CREATE POLICY "stable_admin_update_earnings" ON stable_earnings FOR UPDATE
  TO authenticated USING (is_stable_admin(stable_id, auth.uid())) WITH CHECK (is_stable_admin(stable_id, auth.uid()));

-- Policies for stable_activity
DROP POLICY IF EXISTS "stable_member_read_activity" ON stable_activity;
CREATE POLICY "stable_member_read_activity" ON stable_activity FOR SELECT
  TO authenticated USING (is_stable_member(stable_id, auth.uid()));

DROP POLICY IF EXISTS "stable_member_insert_activity" ON stable_activity;
CREATE POLICY "stable_member_insert_activity" ON stable_activity FOR INSERT
  TO authenticated WITH CHECK (is_stable_member(stable_id, auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stable_members_stable_id ON stable_members(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_members_user_id ON stable_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stable_players_stable_id ON stable_players(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_players_user_id ON stable_players(user_id);
CREATE INDEX IF NOT EXISTS idx_stable_postings_stable_id ON stable_postings(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_applications_stable_id ON stable_applications(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_candidates_stable_id ON stable_candidates(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_review_submissions_stable_id ON stable_review_submissions(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_review_submissions_player_id ON stable_review_submissions(player_id);
CREATE INDEX IF NOT EXISTS idx_stable_library_items_stable_id ON stable_library_items(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_earnings_stable_id ON stable_earnings(stable_id);
CREATE INDEX IF NOT EXISTS idx_stable_activity_stable_id ON stable_activity(stable_id);
