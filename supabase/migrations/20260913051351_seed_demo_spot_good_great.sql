-- Seed the "The Difference Between Good & Great?" demo spot for Jordan McAllister (acc-jordan).
-- Uses ON CONFLICT DO NOTHING via a stable UUID so re-running is safe.

INSERT INTO content_spots (
  id,
  account_id,
  creator_name,
  status,
  source,
  title,
  subtitle,
  introduction,
  hand_details,
  content_html,
  image_urls,
  tags,
  is_monetized,
  price_credits,
  show_in_courses,
  quiz,
  published_at,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'acc-jordan',
  'Jordan McAllister',
  'published',
  'Solver Tree Spot',
  'The Difference Between Good & Great?',
  'Heads Up in $1,050 Saturday PKO on GG Poker',
  'You flopped the world — a straight with a backdoor flush draw in a $1,050 PKO. Your opponent checked back the flop. The turn pairs the board. Now the river blanks. Solver says one thing. Most players do another. The gap between those two decisions is the gap between good and great.',
  E'Game: $1,050 Saturday PKO · GG Poker\nPositions: BB (Hero) vs BTN\nHero Hand: 8♠ 7♠\nBoard: J♣ T♠ 9♠  T♦  2♥\nPot Type: Single-Raised Pot\nStack Depth: ~40BB effective\nContext: PKO bounty pressure modifies BTN''s flop checking frequency and river calling range',
  '<h3>The Setup</h3><p>BTN opens to 2.5BB. You defend the BB with 8&#9824;7&#9824; — a standard defense in a PKO. Flop comes J&#9827;T&#9824;9&#9824;, giving you the nut straight immediately, plus a flush redraw. A dream flop.</p><p>You check to the aggressor. BTN checks back. This is the first decision point — BTN has a capped range by checking this board.</p><h3>Turn: T&#9830; — Board Pairs</h3><p>The turn pairs the board. Your straight is still the nuts but the board is now J&#9827;T&#9824;9&#9824;T&#9830;. BTN''s check-back on the flop means very few Tx hands in their range — most would have bet for value on that draw-heavy flop. You lead out.</p><p>BTN calls. Now you''re heads-up to the river with a paired board and a polarized range advantage.</p><h3>River: 2&#9825; — The Decision</h3><p>The 2&#9825; completes nothing. Board reads J&#9827;T&#9824;9&#9824;T&#9830;2&#9825;. You have 8&#9824;7&#9824; — the straight — and you''re first to act.</p><p>Most players check here, afraid of the paired board. Solver disagrees strongly. The correct line is a large bet — around 70-80% pot — because your value region is uncapped (straights, two pair) and BTN''s capped check-back range cannot have many boats.</p><h3>What Solver Says</h3><p>The solver tree shows BB betting at 68% frequency on this river with the nut straight, sizing between 65-90% pot. Checking is not a mistake, but it leaves significant EV on the table against BTN''s condensed range of one-pair holdings that are forced to call a bet but will rarely lead themselves.</p><p>The PKO bounty context tightens BTN''s folding frequency further — they are incentivized to call with marginal holdings to protect their own bounty. This makes our value bet even more profitable than in a standard MTT.</p><h3>The Takeaway</h3><p>Good players check the straight on the paired river board, protect against boats, and take a safe line. Great players recognize that BTN''s range is capped by their flop check-back, build the pot with the best hand, and extract full value from a range that must call but cannot raise for value. That read — seeing the invisible constraint in your opponent''s range — is the difference.</p>',
  ARRAY[
    '/assets/spots/The%20Difference%20Between%20Good%20%26%20Great%3F/image.png',
    '/assets/spots/The%20Difference%20Between%20Good%20%26%20Great%3F/image%20copy.png'
  ],
  '{"difficulty":"Advanced","format":"PKO","strategy":"Solver Tree","position":"BB","street":"River"}'::jsonb,
  false,
  0,
  false,
  NULL,
  now() - interval '3 days',
  now() - interval '28 days',
  now() - interval '3 days'
)
ON CONFLICT (id) DO NOTHING;
