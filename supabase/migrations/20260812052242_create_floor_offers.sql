/*
# Player Network Floor Offers — Targeted Advertising Architecture

## Purpose
Each floor of the Player Network Vegas Tower represents a different poker
audience segment (Motel = recreational, Poker Room = active players, Resort =
established grinders, High Roller = high-stakes, Penthouse = elite). This table
stores offers/advertising/coaching placements targeted to specific floors.

## Targeting Architecture
- `target_floors` (int[]) — which floors the offer appears on (e.g. [2] or [3,4] or [5])
- `offer_type` — COACHING | DEAL | SERVICE | EVENT | PRODUCT | PARTNER
- `is_sponsored` — marks paid placement (must be clearly labeled SPONSORED/PROMOTED/PARTNER)
- `sponsor_label` — text label for the sponsor
- `bookable` — if true, this offer connects to the Book Time architecture
- `provider_floor` — for coaching offers, which floor the coach resides on (upward access)
- `credits_price` — price in SpotVault credits
- `duration_minutes` — session duration for coaching bookings
- Future targeting fields prepared but not yet enforced:
  target_player_types, target_abi_min/max, target_cash_stakes, target_location, target_interests

## Privacy Rule
Advertisers purchase access to an AUDIENCE SEGMENT (e.g. "Penthouse Players"),
not individual player data. SpotVault determines eligibility and serves the
placement. No private player analytics are exposed to advertisers.

## Security
- RLS enabled. No-auth demo app: policies use TO anon, authenticated.
- SELECT is public (active offers only). INSERT/UPDATE/DELETE open for demo.

## Seed Data
- Floor 01 (Motel): 6 offers — beginner coaching, cheap Vegas deals, welcome promos
- Floor 02 (Poker Room): 6 offers — coaching from higher floors, software, promos
- Floor 03 (Resort): 5 offers — premium coaching, services, staking, tax
- Floor 04 (High Roller): 4 offers — elite coaching, wealth, VIP travel
- Floor 05 (Penthouse): 3 offers — private aviation, wealth, private games
- Higher floors have FEWER offers but HIGHER value
*/

CREATE TABLE IF NOT EXISTS floor_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_floors int[] NOT NULL DEFAULT '{}',
  offer_type text NOT NULL DEFAULT 'DEAL',
  headline text NOT NULL,
  description text,
  provider_name text NOT NULL,
  provider_handle text,
  provider_floor int,
  credits_price int,
  duration_minutes int,
  cta_label text,
  cta_url text,
  image_url text,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_label text,
  bookable boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  target_player_types text[],
  target_abi_min numeric,
  target_abi_max numeric,
  target_cash_stakes text,
  target_location text,
  target_interests text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE floor_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_floor_offers" ON floor_offers;
CREATE POLICY "anon_select_floor_offers" ON floor_offers FOR SELECT
TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "anon_insert_floor_offers" ON floor_offers;
CREATE POLICY "anon_insert_floor_offers" ON floor_offers FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_floor_offers" ON floor_offers;
CREATE POLICY "anon_update_floor_offers" ON floor_offers FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_floor_offers" ON floor_offers;
CREATE POLICY "anon_delete_floor_offers" ON floor_offers FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_floor_offers_target_floors ON floor_offers USING GIN (target_floors);
CREATE INDEX IF NOT EXISTS idx_floor_offers_sort ON floor_offers (sort_order);

-- ===== FLOOR 01 (Motel) — beginner/recreational =====
INSERT INTO floor_offers (target_floors, offer_type, headline, description, provider_name, provider_handle, provider_floor, credits_price, duration_minutes, cta_label, is_sponsored, sponsor_label, bookable, sort_order, created_at) VALUES
(ARRAY[1], 'DEAL', 'Vegas Deal: $12.99 Breakfast + Late Checkout', 'Fuel up before the grind. Diner-style breakfast at the Motel cafe, plus 2pm late checkout. No resort fees.', 'Motel Cafe', '@motelcafe', null, null, null, 'View Deal', true, 'PARTNER OFFER', false, 1, now() - interval '30 minutes'),
(ARRAY[1], 'COACHING', 'Beginner MTT Review', 'New to tournaments? Get a 30-minute hand review from a verified Floor 02 coach. Perfect for your first live series.', 'Coach Sarah Chen', '@sarahchen', 2, 75, 30, 'Book', false, null, true, 2, now() - interval '1 hour'),
(ARRAY[1], 'DEAL', 'Welcome Bonus: 50% Deposit Match', 'First-time players get a 50% deposit match up to $200 on your first tournament entry fee.', 'Vegas Poker Rooms', '@vegasrooms', null, null, null, 'Claim', true, 'PROMOTED', false, 3, now() - interval '2 hours'),
(ARRAY[1], 'DEAL', '$25 Daily Tournament Entry', 'Affordable daily tournament at downtown card rooms. $25 buy-in, 5K starting stack, 20-min levels.', 'Downtown Grind', '@downtowngrind', null, null, null, 'View Schedule', false, null, false, 4, now() - interval '3 hours'),
(ARRAY[1], 'PRODUCT', 'Free Poker Hand Tracker', 'Open-source hand tracking tool. Import your first 100 hands and start building your database.', 'SpotVault Tools', '@spotvault', null, null, null, 'Download Free', false, null, false, 5, now() - interval '5 hours'),
(ARRAY[1], 'DEAL', 'Motel Week: 3 Nights for $89', 'Stay 3 nights at the Motel for $89 total. Walking distance to downtown poker rooms. No resort fee.', 'Motel 6 Vegas', '@motel6vegas', null, null, null, 'Book Room', true, 'SPONSORED', false, 6, now() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- ===== FLOOR 02 (Poker Room) — active grinders =====
INSERT INTO floor_offers (target_floors, offer_type, headline, description, provider_name, provider_handle, provider_floor, credits_price, duration_minutes, cta_label, is_sponsored, sponsor_label, bookable, sort_order, created_at) VALUES
(ARRAY[2], 'COACHING', 'MTT Strategy Session', 'Deep-dive into tournament strategy with a verified Floor 03 Resort grinder. ICM, final table play, and bubble dynamics.', 'Marcus Webb', '@marcuswebb', 3, 150, 30, 'Book', false, null, true, 1, now() - interval '40 minutes'),
(ARRAY[2], 'COACHING', 'Database Review', 'Full hand history database review from a Floor 04 High Roller coach. Find leaks, build a study plan, and level up.', 'Elena Vasquez', '@elenav', 4, 350, 60, 'Book', false, null, true, 2, now() - interval '1 hour'),
(ARRAY[2], 'DEAL', 'Poker Room Promo: $500 Freeroll', 'Active players only. Weekly $500 freeroll for verified Poker Room members. Top 10 paid.', 'Strip Poker Room', '@strippoker', null, null, null, 'Register', true, 'PROMOTED', false, 3, now() - interval '2 hours'),
(ARRAY[2], 'PRODUCT', 'HH Analyzer Pro — 30 Day Trial', 'Advanced hand history analyzer with GTO baseline comparison. Spot leaks in your cash and tournament game.', 'PokerTech', '@pokertech', null, null, null, 'Start Trial', true, 'SPONSORED', false, 4, now() - interval '3 hours'),
(ARRAY[2], 'DEAL', 'Sunday Majors Bundle', 'Entry to 4 Sunday majors across 2 sites. $215 total value for $180. Verified active players only.', 'Tournament Stakes', '@tournstakes', null, null, null, 'View Bundle', false, null, false, 5, now() - interval '4 hours'),
(ARRAY[2], 'DEAL', 'Vegas Poker Trip: 2 Nights + Tournament Entry', '2 nights at a mid-Strip hotel + $250 tournament entry. Everything you need for a Vegas poker weekend.', 'Vegas Poker Trips', '@vegaspokertrips', null, null, null, 'View Package', true, 'PARTNER OFFER', false, 6, now() - interval '5 hours')
ON CONFLICT DO NOTHING;

-- ===== FLOOR 03 (Resort) — established grinders =====
INSERT INTO floor_offers (target_floors, offer_type, headline, description, provider_name, provider_handle, provider_floor, credits_price, duration_minutes, cta_label, is_sponsored, sponsor_label, bookable, sort_order, created_at) VALUES
(ARRAY[3], 'COACHING', 'Private Coaching — Advanced MTT', '1-on-1 advanced tournament coaching from a Floor 04 High Roller. Deep runs, final table strategy, and mental game.', 'David Kessler', '@dkessler', 4, 500, 60, 'Book', false, null, true, 1, now() - interval '50 minutes'),
(ARRAY[3], 'COACHING', 'Elite Performance Coaching', 'Mental game and performance coaching from a Floor 05 Penthouse player. Tilt management, routine building, and competitive psychology.', 'Alex Rivera', '@alexrivera', 5, 700, 45, 'Book', false, null, true, 2, now() - interval '2 hours'),
(ARRAY[3], 'SERVICE', 'Poker Tax & Accounting Consult', 'Specialized poker tax services. Tournament winnings, cash game income, and international tax compliance. 30-min initial consult.', 'Kruger Tax Partners', '@krugertax', null, 200, 30, 'Book Consult', true, 'SPONSORED', false, 3, now() - interval '3 hours'),
(ARRAY[3], 'SERVICE', 'Staking Opportunity — MTT Stable', 'Verified MTT staking stable accepting applications. 50/50 split, makeup protection, and coaching included. ABI $150+ preferred.', 'Apex Staking', '@apexstaking', null, null, null, 'Apply', false, null, false, 4, now() - interval '4 hours'),
(ARRAY[3], 'DEAL', 'Resort Stay: Suite + Tournament Entry', '3 nights in a resort suite + $1K tournament entry. Premium Strip location with poker room access.', 'Vegas Resort Partners', '@vegasresort', null, null, null, 'View Package', true, 'PARTNER OFFER', false, 5, now() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- ===== FLOOR 04 (High Roller) — high-stakes, premium =====
INSERT INTO floor_offers (target_floors, offer_type, headline, description, provider_name, provider_handle, provider_floor, credits_price, duration_minutes, cta_label, is_sponsored, sponsor_label, bookable, sort_order, created_at) VALUES
(ARRAY[4], 'COACHING', 'Elite Strategy Consultation', 'Private high-stakes strategy consultation with a Floor 05 Penthouse elite. GTO deep dives, exploitative adjustments, and game selection.', 'Phil Graves', '@philgraves', 5, 1200, 90, 'Book', false, null, true, 1, now() - interval '1 hour'),
(ARRAY[4], 'SERVICE', 'Wealth Management Consult', 'Specialized wealth management for high-stakes poker players. Investment strategy, tax optimization, and long-term financial planning.', 'Summit Wealth', '@summitwealth', null, null, null, 'Request Consult', true, 'SPONSORED', false, 2, now() - interval '3 hours'),
(ARRAY[4], 'SERVICE', 'High-Stakes Staking Network', 'Exclusive staking network for high-roller MTT and cash players. Verified volume required. Custom splits and backing terms.', 'Black Chip Staking', '@blackchip', null, null, null, 'Inquire', false, null, false, 3, now() - interval '5 hours'),
(ARRAY[4], 'DEAL', 'VIP Poker Trip — Private Suite + $5K Event', 'Private high-roller suite for 3 nights + $5K tournament entry. VIP hospitality, private transportation, and lounge access.', 'Vegas VIP', '@vegasvip', null, null, null, 'View Package', true, 'PARTNER OFFER', false, 4, now() - interval '8 hours')
ON CONFLICT DO NOTHING;

-- ===== FLOOR 05 (Penthouse) — ultra-premium, very limited (3 only) =====
INSERT INTO floor_offers (target_floors, offer_type, headline, description, provider_name, provider_handle, provider_floor, credits_price, duration_minutes, cta_label, is_sponsored, sponsor_label, bookable, sort_order, created_at) VALUES
(ARRAY[5], 'SERVICE', 'Private Aviation — Vegas Charter', 'Private jet charter to and from Las Vegas for series play. Dedicated crew, flexible scheduling, and FBO access.', 'Summit Aviation', '@summitaviation', null, null, null, 'Request Quote', true, 'PARTNER OFFER', false, 1, now() - interval '2 hours'),
(ARRAY[5], 'SERVICE', 'Elite Wealth & Tax Strategy', 'Comprehensive wealth management for elite poker professionals. International tax, entity structuring, and legacy planning.', 'Kruger Private', '@krugerprivate', null, null, null, 'Request Consult', false, null, false, 2, now() - interval '5 hours'),
(ARRAY[5], 'EVENT', 'Private High-Stakes Game Invitation', 'Exclusive private poker game. $50/$100+ NLHE. Invitation only, verified Floor 05 members. Limited seating.', 'The Vault Room', '@vaultroom', null, null, null, 'Request Invite', false, null, false, 3, now() - interval '12 hours')
ON CONFLICT DO NOTHING;