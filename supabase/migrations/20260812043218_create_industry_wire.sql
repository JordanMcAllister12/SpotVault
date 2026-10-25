/*
# Industry Wire — Curated Poker Industry Information Stream

## Purpose
A higher-signal information stream for the SpotVault Community Center.
Unlike the open Community Live Feed, Industry Wire content comes from
approved industry accounts, verified professionals, poker companies,
tournament operators, media, creators, coaches, stables, and SpotVault itself.
Normal users cannot freely publish here. Businesses/creators can purchase
promoted placement (clearly labeled). Paying buys distribution, not credibility.

## New Table

### industry_wire_posts
- `id` (uuid, PK)
- `source_name` (text, NOT NULL) — e.g. "WSOP", "GGPoker", "Kevin Martin", "PokerGO"
- `source_handle` (text) — optional handle/identifier
- `source_avatar` (text, nullable) — avatar URL
- `source_verified` (boolean, default false) — true for approved/verified industry accounts
- `content_type` (text, NOT NULL) — NEWS | MEDIA | TOURNAMENT | RESULT | JOB | HH | VIDEO | SPOT | COURSE | EVENT | ANNOUNCEMENT | PROMOTED
- `title` (text, NOT NULL) — headline
- `body` (text, nullable) — optional description/context
- `cta_label` (text, nullable) — call-to-action button text
- `cta_url` (text, nullable) — call-to-action URL
- `is_promoted` (boolean, default false) — marks paid placement (must be clearly labeled)
- `metadata` (jsonb, nullable) — flexible field for extra info (prize pools, dates, etc.)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled.
- This is a no-auth demo app, so policies use `TO anon, authenticated`.
- SELECT is public (everyone sees the wire).
- INSERT/UPDATE/DELETE are also open for demo purposes (in production these
  would be restricted to approved industry accounts via server-side checks).

## Seed Data
- Inserts ~12 demo industry wire posts covering various content types
  (news, tournament, result, job, video, event, announcement, promoted).
*/

CREATE TABLE IF NOT EXISTS industry_wire_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_handle text,
  source_avatar text,
  source_verified boolean NOT NULL DEFAULT false,
  content_type text NOT NULL DEFAULT 'NEWS',
  title text NOT NULL,
  body text,
  cta_label text,
  cta_url text,
  is_promoted boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE industry_wire_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wire_posts" ON industry_wire_posts;
CREATE POLICY "anon_select_wire_posts" ON industry_wire_posts FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wire_posts" ON industry_wire_posts;
CREATE POLICY "anon_insert_wire_posts" ON industry_wire_posts FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wire_posts" ON industry_wire_posts;
CREATE POLICY "anon_update_wire_posts" ON industry_wire_posts FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wire_posts" ON industry_wire_posts;
CREATE POLICY "anon_delete_wire_posts" ON industry_wire_posts FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_wire_posts_created_at ON industry_wire_posts (created_at DESC);

-- Seed demo data
INSERT INTO industry_wire_posts (source_name, source_handle, source_verified, content_type, title, body, cta_label, is_promoted, created_at) VALUES
('WSOP', '@wsop', true, 'NEWS', '2027 Main Event schedule released', 'The World Series of Poker has officially released the full schedule for the 2027 Main Event, running May 26 through July 14.', 'View Schedule', false, now() - interval '5 minutes'),
('GGPoker', '@ggpoker', true, 'TOURNAMENT', '$10M Championship Series announced', 'GGPoker announces a $10,000,000 guaranteed championship series with events running across two weeks.', 'View Series', false, now() - interval '12 minutes'),
('Kevin Martin', '@kevinmartin', true, 'VIDEO', 'New Final Table breakdown published', 'Kevin Martin breaks down the key hands from last nights final table with detailed ICM analysis.', 'Watch Now', false, now() - interval '25 minutes'),
('PokerGO', '@pokergo', true, 'EVENT', 'Final table begins at 8PM ET', 'Live coverage of the High Roller final table starts tonight at 8PM ET on PokerGO.', 'Set Reminder', false, now() - interval '40 minutes'),
('SpotVault Jobs', '@spotvault', true, 'JOB', 'New Product Manager position posted', 'SpotVault is hiring a Product Manager to lead the Player Portal experience. Full-time, remote.', 'View Listing', false, now() - interval '1 hour'),
('Hendon Mob', '@hendonmob', true, 'RESULT', 'Tournament results updated', 'Final table results for the $5K Warm-Up have been posted. 1st: $89,200.', 'View Results', false, now() - interval '1 hour 30 minutes'),
('GGPoker', '@ggpoker', true, 'PROMOTED', '$10M Championship Series — Registration Open', 'Early registration is now open for the GGPoker Championship Series. Secure your seat.', 'Register Now', true, now() - interval '2 hours'),
('SpotVault', '@spotvault', true, 'ANNOUNCEMENT', 'New Hand History feature launched', 'SpotVault has launched a new Hand History replay tool available to all Player Portal members.', 'Learn More', false, now() - interval '3 hours'),
('Coach Mike', '@coachmike', true, 'COURSE', 'New course: Performing Under Pressure', 'A 6-module deep course on decision-making under stress is now available in the Coach Hub.', 'View Course', false, now() - interval '4 hours'),
('PokerNews', '@pokernews', true, 'NEWS', 'Record-breaking field at Summer Series', 'This years summer series drew 8,732 entries, making it the largest field in the events history.', 'Read Article', false, now() - interval '5 hours'),
('WPT', '@wpt', true, 'EVENT', 'WPT Tour stop announced for Toronto', 'The World Poker Tour has added a Toronto stop to its 2027 schedule, marking its first Canadian event in five years.', 'View Details', false, now() - interval '6 hours'),
('Stable One', '@stableone', true, 'SPOT', 'New staking spot available', 'Stable One has opened a new backing spot for MTT players with 30%+ ROI over 500+ games.', 'Apply Now', false, now() - interval '8 hours')
ON CONFLICT DO NOTHING;
