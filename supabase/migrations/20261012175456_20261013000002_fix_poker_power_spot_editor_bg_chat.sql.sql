/*
# Fix Poker Power Spot Editor Bug + Lounge Background + Chat Persistence

## Overview
This migration addresses three issues:
1. Fixes the "Knowing When to Fold" spot that opens as an empty freeform editor
2. Updates the Poker Power lounge background to the new reference image
3. Extends the poker_lounge_messages CHECK constraint to allow 'poker-power' scope
4. Adds RLS policies for persistent Poker Power group chat messages
5. Seeds demo chat messages from fictional Poker Power participants

## Changes

### 1. Fix spot_type for "Knowing When to Fold" spot
- Spot ID: 2c0256e6-213b-457b-b1d6-0f72ee7f725b
- Problem: spot_type is 'freeform' but content is in content_html (structured field),
  not content_blocks (freeform field which is null). The freeform editor reads
  content_blocks → shows empty.
- Fix: Change spot_type from 'freeform' to 'structured' so the structured editor
  loads and displays the existing content_html. No data is lost or converted.

### 2. Update Poker Power lounge background
- Update lounge_configs row for slug='poker-power'
- Set default_background to '/assets/portals/poker-power/image copy 10.png'

### 3. Extend CHECK constraint on poker_lounge_messages
- The existing constraint limits community_scope to ('spotvault', 'stakekings')
- Drop and recreate to add 'poker-power' as an allowed scope
- Also fix poker_format and stakes_level values in seed data to match constraint
  (poker_format: 'cash'|'mtt'|'live', stakes_level: 'micro'|'low'|'medium'|'high')

### 4. Add RLS policies for Poker Power chat messages
- SELECT: anon + authenticated can read poker-power messages
- INSERT: authenticated, author_id = auth.uid()
- UPDATE/DELETE: authenticated, author_id = auth.uid()

### 5. Seed demo chat messages
- 8 messages from 5 fictional participants
- Idempotent: only inserts if no poker-power messages exist yet

## Security
- No new tables — uses existing poker_lounge_messages
- RLS policies follow the same pattern as existing spotvault policies
- No destructive data operations — all changes are additive
*/

-- ── 1. Fix spot_type for "Knowing When to Fold" spot ──────────────
UPDATE content_spots
SET spot_type = 'structured',
    updated_at = now()
WHERE id = '2c0256e6-213b-457b-b1d6-0f72ee7f725b'
  AND spot_type = 'freeform';

-- ── 2. Update Poker Power lounge background ───────────────────────
UPDATE lounge_configs
SET default_background = '/assets/portals/poker-power/image copy 10.png',
    updated_at = now()
WHERE slug = 'poker-power';

-- ── 3. Extend CHECK constraint to allow 'poker-power' scope ───────
ALTER TABLE poker_lounge_messages DROP CONSTRAINT IF EXISTS poker_lounge_messages_community_scope_check;
ALTER TABLE poker_lounge_messages ADD CONSTRAINT poker_lounge_messages_community_scope_check
  CHECK (community_scope = ANY (ARRAY['spotvault'::text, 'stakekings'::text, 'poker-power'::text]));

-- ── 4. Add RLS policies for Poker Power chat messages ─────────────
DROP POLICY IF EXISTS "pp_select_lounge" ON poker_lounge_messages;
CREATE POLICY "pp_select_lounge"
ON poker_lounge_messages FOR SELECT
TO anon, authenticated
USING (community_scope = 'poker-power');

DROP POLICY IF EXISTS "pp_insert_lounge" ON poker_lounge_messages;
CREATE POLICY "pp_insert_lounge"
ON poker_lounge_messages FOR INSERT
TO authenticated
WITH CHECK (community_scope = 'poker-power' AND author_id = auth.uid());

DROP POLICY IF EXISTS "pp_update_lounge" ON poker_lounge_messages;
CREATE POLICY "pp_update_lounge"
ON poker_lounge_messages FOR UPDATE
TO authenticated
USING (community_scope = 'poker-power' AND author_id = auth.uid())
WITH CHECK (community_scope = 'poker-power' AND author_id = auth.uid());

DROP POLICY IF EXISTS "pp_delete_lounge" ON poker_lounge_messages;
CREATE POLICY "pp_delete_lounge"
ON poker_lounge_messages FOR DELETE
TO authenticated
USING (community_scope = 'poker-power' AND author_id = auth.uid());

-- ── 5. Seed demo chat messages from fictional participants ────────
INSERT INTO poker_lounge_messages (author_id, author_name, author_avatar, author_role, body, stakes_level, poker_format, community_scope, lounge_id, created_at)
SELECT * FROM (VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Sarah Chen', NULL::text, 'PLAYER', 'Welcome to the Poker Power community lounge! This is our space to discuss strategy, share insights, and learn together.', 'low'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '2 hours'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Marcus Johnson', NULL::text, 'PLAYER', 'Just finished the "Knowing When to Fold" lesson — the sunk cost fallacy section completely changed how I think about continuing with marginal hands.', 'low'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '1 hour 45 minutes'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'Elena Rodriguez', NULL::text, 'PLAYER', 'That lesson hit home for me too. I used to call too wide from the SB because I "already put money in." Now I fold and my win rate improved immediately.', 'medium'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '1 hour 30 minutes'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'David Kim', NULL::text, 'PLAYER', 'Has anyone applied the sunk cost concept to business decisions? I caught myself continuing a losing project just because of time invested.', 'high'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '1 hour 15 minutes'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Sarah Chen', NULL::text, 'PLAYER', 'Absolutely, David! The poker-to-business transfer is one of the core ideas Poker Power teaches. Sunk costs are sunk — evaluate the decision from the current state forward.', 'low'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Jennifer Park', NULL::text, 'PLAYER', 'Quick question: when facing a river overbet, is it better to use a polarized calling range or a merged one? Working on my defend frequencies.', 'low'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '45 minutes'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Marcus Johnson', NULL::text, 'PLAYER', 'Against a polarized overbet, your calling range should also be polarized — call with the top of your range and the bluff-catchers that block value hands.', 'low'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '30 minutes'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'Elena Rodriguez', NULL::text, 'PLAYER', 'Great point, Marcus. Blocker effects on river overbets are huge — holding the second-nut blocker makes calling much more attractive.', 'medium'::text, 'cash'::text, 'poker-power'::text, 'poker-power'::text, now() - interval '15 minutes')
) AS t(author_id, author_name, author_avatar, author_role, body, stakes_level, poker_format, community_scope, lounge_id, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM poker_lounge_messages WHERE community_scope = 'poker-power'
);
