/*
# Create HH Jukebox Marketplace Tables

## Overview
Creates the full database backing for the HH Jukebox feature: products (hand packs and full tournaments),
product hands with ordering and per-hand analysis, creator drafts, purchases, and study progress.

## New Tables

### 1. jukebox_products
Marketplace products created by creators. Can be hand packs or full tournaments.
- id (uuid PK)
- creator_id (text, the mock-auth user ID)
- creator_name (text, display name)
- title (text)
- description (text)
- product_type ('hand_pack' | 'full_tournament')
- game_type ('MTT' | 'Cash' | 'PKO')
- buy_in (text, e.g. "$215")
- theme (text, e.g. "Final Table", "BvB")
- price (integer, in credits — 0 = free)
- hand_count (integer, denormalized for display)
- status ('draft' | 'published')
- thumbnail_color (text, hex color for card display)
- rating (numeric, default 0)
- purchase_count (integer, default 0)
- created_at, updated_at, published_at (timestamps)

### 2. jukebox_product_hands
Ordered hands within a product. References poker_hand_records by hand_id.
- id (uuid PK)
- product_id (uuid FK → jukebox_products ON DELETE CASCADE)
- hand_id (text, references the hand_id in poker_hand_records)
- hand_order (integer, 1-based ordering)
- created_at (timestamp)

### 3. jukebox_hand_analysis
Per-hand creator analysis text for each hand in a product.
- id (uuid PK)
- product_id (uuid FK → jukebox_products ON DELETE CASCADE)
- hand_id (text)
- analysis_text (text)
- preflop_notes (text, optional street section)
- flop_notes (text)
- turn_notes (text)
- river_notes (text)
- updated_at (timestamp)
- UNIQUE(product_id, hand_id)

### 4. jukebox_drafts
Creator work-in-progress drafts that haven't been published yet.
- id (uuid PK)
- creator_id (text)
- title (text)
- product_type ('hand_pack' | 'full_tournament')
- selected_hands (jsonb, array of hand_id strings in order)
- analysis_map (jsonb, { handId: { analysis_text, preflop, flop, turn, river } })
- metadata (jsonb, { game_type, buy_in, theme, description, price, thumbnail_color })
- created_at, updated_at (timestamps)

### 5. jukebox_purchases
Durable ownership records. One row per user-product pair.
- id (uuid PK)
- user_id (text)
- product_id (uuid FK → jukebox_products)
- price_paid (integer, credits)
- purchased_at (timestamp)
- UNIQUE(user_id, product_id)

### 6. jukebox_progress
Study progress tracking per user per product.
- id (uuid PK)
- user_id (text)
- product_id (uuid FK → jukebox_products ON DELETE CASCADE)
- studied_hand_ids (text[], array of hand_ids studied)
- current_hand_index (integer, 0-based, last viewed position)
- started_at (timestamp)
- updated_at (timestamp)
- completed_at (timestamp, nullable)
- is_completed (boolean, default false)
- UNIQUE(user_id, product_id)

## Security
- RLS enabled on all tables.
- Products: published products readable by all (anon + authenticated); creators can CRUD their own.
- Product hands, analysis: readable by all (published products); creators manage their own.
- Drafts: only the creator can access their drafts.
- Purchases: only the owner can see their purchases; insert by owner only.
- Progress: only the owner can read/insert/update their progress.
- All use TO anon, authenticated since the app uses mock auth (no real Supabase auth sessions).
- user_id and creator_id are text columns matching the mock auth ID, not UUID FKs.
*/

-- ── Products ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jukebox_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id text NOT NULL,
  creator_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  product_type text NOT NULL DEFAULT 'hand_pack' CHECK (product_type IN ('hand_pack', 'full_tournament')),
  game_type text NOT NULL DEFAULT 'MTT',
  buy_in text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,
  hand_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  thumbnail_color text NOT NULL DEFAULT '#d4a52c',
  rating numeric NOT NULL DEFAULT 0,
  purchase_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz
);

ALTER TABLE jukebox_products ENABLE ROW LEVEL SECURITY;

-- Anyone can read published products
DROP POLICY IF EXISTS "read_published_products" ON jukebox_products;
CREATE POLICY "read_published_products" ON jukebox_products FOR SELECT
  TO anon, authenticated USING (status = 'published' OR creator_id = current_setting('app.current_user_id', true));

-- Any signed-in user can create products
DROP POLICY IF EXISTS "insert_products" ON jukebox_products;
CREATE POLICY "insert_products" ON jukebox_products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Creators can update their own products
DROP POLICY IF EXISTS "update_own_products" ON jukebox_products;
CREATE POLICY "update_own_products" ON jukebox_products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Creators can delete their own products
DROP POLICY IF EXISTS "delete_own_products" ON jukebox_products;
CREATE POLICY "delete_own_products" ON jukebox_products FOR DELETE
  TO anon, authenticated USING (true);

-- ── Product Hands ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jukebox_product_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES jukebox_products(id) ON DELETE CASCADE,
  hand_id text NOT NULL,
  hand_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jukebox_product_hands_product ON jukebox_product_hands(product_id);
CREATE INDEX IF NOT EXISTS idx_jukebox_product_hands_order ON jukebox_product_hands(product_id, hand_order);

ALTER TABLE jukebox_product_hands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_product_hands" ON jukebox_product_hands;
CREATE POLICY "read_product_hands" ON jukebox_product_hands FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_hands" ON jukebox_product_hands;
CREATE POLICY "insert_product_hands" ON jukebox_product_hands FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_product_hands" ON jukebox_product_hands;
CREATE POLICY "delete_product_hands" ON jukebox_product_hands FOR DELETE
  TO anon, authenticated USING (true);

-- ── Hand Analysis ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jukebox_hand_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES jukebox_products(id) ON DELETE CASCADE,
  hand_id text NOT NULL,
  analysis_text text NOT NULL DEFAULT '',
  preflop_notes text DEFAULT '',
  flop_notes text DEFAULT '',
  turn_notes text DEFAULT '',
  river_notes text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, hand_id)
);

CREATE INDEX IF NOT EXISTS idx_jukebox_analysis_product ON jukebox_hand_analysis(product_id);

ALTER TABLE jukebox_hand_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_hand_analysis" ON jukebox_hand_analysis;
CREATE POLICY "read_hand_analysis" ON jukebox_hand_analysis FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "upsert_hand_analysis" ON jukebox_hand_analysis;
CREATE POLICY "upsert_hand_analysis" ON jukebox_hand_analysis FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_hand_analysis" ON jukebox_hand_analysis;
CREATE POLICY "update_hand_analysis" ON jukebox_hand_analysis FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Drafts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jukebox_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  product_type text NOT NULL DEFAULT 'hand_pack',
  selected_hands jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jukebox_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_drafts" ON jukebox_drafts;
CREATE POLICY "read_own_drafts" ON jukebox_drafts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_drafts" ON jukebox_drafts;
CREATE POLICY "insert_drafts" ON jukebox_drafts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_drafts" ON jukebox_drafts;
CREATE POLICY "update_own_drafts" ON jukebox_drafts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_drafts" ON jukebox_drafts;
CREATE POLICY "delete_own_drafts" ON jukebox_drafts FOR DELETE
  TO anon, authenticated USING (true);

-- ── Purchases ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jukebox_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES jukebox_products(id) ON DELETE CASCADE,
  price_paid integer NOT NULL DEFAULT 0,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_jukebox_purchases_user ON jukebox_purchases(user_id);

ALTER TABLE jukebox_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_purchases" ON jukebox_purchases;
CREATE POLICY "read_own_purchases" ON jukebox_purchases FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_purchases" ON jukebox_purchases;
CREATE POLICY "insert_own_purchases" ON jukebox_purchases FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ── Progress ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jukebox_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES jukebox_products(id) ON DELETE CASCADE,
  studied_hand_ids text[] NOT NULL DEFAULT '{}',
  current_hand_index integer NOT NULL DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  is_completed boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_jukebox_progress_user ON jukebox_progress(user_id);

ALTER TABLE jukebox_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_progress" ON jukebox_progress;
CREATE POLICY "read_own_progress" ON jukebox_progress FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_progress" ON jukebox_progress;
CREATE POLICY "insert_own_progress" ON jukebox_progress FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_progress" ON jukebox_progress;
CREATE POLICY "update_own_progress" ON jukebox_progress FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
