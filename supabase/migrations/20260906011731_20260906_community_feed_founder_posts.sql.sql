/*
# Community Feed: Add pinned posts, founder role, and seed founder posts

1. Changes to `industry_wire_posts` (Main Feed)
- Add `is_pinned` boolean column (default false) — pinned posts render first
- Add `author_role` text column — supports FOUNDER badge rendering
- Add `is_featured` boolean column (default false) — for curated highlighting

2. Seed founder posts into `industry_wire_posts`
- 6 posts from Jordan McAllister (FOUNDER role)
- Post 1 is pinned (Welcome to SpotVault)
- Posts cover platform updates, features, and community info

3. Seed social posts into `network_chat_messages` (Social Feed)
- 5 conversational posts from Jordan McAllister
- Covers strategy thoughts, study approaches, feature discussions

4. Security
- No RLS policy changes (existing policies remain)
- Seeded posts are clearly identifiable as founder content

5. Notes
- All seeded posts use a stable UUID for Jordan's author_id
- Posts are marked with author_role = 'FOUNDER' for badge rendering
- Pinned post (Post 1) will render first in the Main Feed
- Seeded content does NOT affect financial data, analytics, or staff metrics
*/

-- Add columns to industry_wire_posts
ALTER TABLE industry_wire_posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS author_role text DEFAULT null,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Seed founder posts into industry_wire_posts (Main Feed)
-- Use a stable UUID for Jordan McAllister
DO $$
BEGIN
  -- Post 1 — PINNED: Welcome to SpotVault
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'Welcome to SpotVault.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_avatar, source_verified, content_type, title, body, is_promoted, is_pinned, author_role, created_at)
    VALUES (
      'Jordan McAllister',
      'jordanmcallister12',
      null,
      true,
      'announcement',
      'Welcome to SpotVault.',
      'After a lot of long nights and a ridiculous amount of work, we''re finally getting close.

This has always been about building the best place in poker to study, improve, connect, and share knowledge.

We''re still polishing things before launch, so if you find a bug or have an idea, send it through Feedback. Every suggestion gets reviewed.

Thanks to everyone who''s followed the journey so far.',
      false, true, 'FOUNDER', now() - interval '7 days'
    );
  END IF;

  -- Post 2: SpotVault V2 is now live
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'SpotVault V2 is now live on the production domain.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_verified, content_type, title, body, author_role, created_at)
    VALUES (
      'Jordan McAllister',
      'jordanmcallister12',
      true,
      'announcement',
      'SpotVault V2 is now live on the production domain.',
      'We''re moving the platform into the next phase and continuing to tighten up the experience across the Player Room, study tools, marketplace, community and partner integrations.

There is still a lot being built behind the scenes.',
      'FOUNDER', now() - interval '6 days'
    );
  END IF;

  -- Post 3: Making SpotVault the central place for poker knowledge
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'Making SpotVault the central place for poker knowledge.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_verified, content_type, title, body, author_role, created_at)
    VALUES (
      'Jordan McAllister',
      'jordanmcallister12',
      true,
      'announcement',
      'Making SpotVault the central place for poker knowledge.',
      'One of the biggest things we''re working toward is making SpotVault the central place for poker knowledge.

Create your own Spots. Keep them private. SyncShare them with people you trust. Or publish them to Spot Library for the broader community.

The goal is to make poker knowledge easier to create, organize, share and monetize.',
      'FOUNDER', now() - interval '5 days'
    );
  END IF;

  -- Post 4: Multi-Spot Analysis
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'Multi-Spot Analysis is one of the features I''m most excited about.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_verified, content_type, title, body, author_role, created_at)
    VALUES (
      'Jordan McAllister',
      'jordanmcallister12',
      true,
      'feature',
      'Multi-Spot Analysis is one of the features I''m most excited about.',
      'Instead of studying one isolated hand, creators can package an entire tournament run, a focused hand set, or a specific strategic theme and walk people through every decision.

Think:

25 hands from a Sunday deep run.
50 hands focused on 3-bet pots.
An entire final table with creator analysis attached hand-by-hand.',
      'FOUNDER', now() - interval '4 days'
    );
  END IF;

  -- Post 5: Partner portals and community integrations
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'We''re actively building out partner portals and deeper community integrations.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_verified, content_type, title, body, author_role, created_at)
    VALUES (
      'Jordan McAllister',
      'jordanmcallister12',
      true,
      'announcement',
      'We''re actively building out partner portals and deeper community integrations.',
      'Some portals will show as Coming Soon while we finish them properly.

Player Portal is the main live experience right now, while Staff continues building and testing the rest behind the scenes.',
      'FOUNDER', now() - interval '3 days'
    );
  END IF;

  -- Post 6: Feedback
  IF NOT EXISTS (SELECT 1 FROM industry_wire_posts WHERE title = 'If something feels off, tell us.') THEN
    INSERT INTO industry_wire_posts (source_name, source_handle, source_verified, content_type, title, body, author_role, created_at)
    VALUES (
      'Jordan McAllister',
      'jordanmcallister12',
      true,
      'announcement',
      'If something feels off, tell us.',
      'SpotVault is still evolving quickly and feedback at this stage matters a lot.

Whether it''s a bug, confusing flow, missing feature, or something you think would simply make the platform better — send it in.',
      'FOUNDER', now() - interval '2 days'
    );
  END IF;
END $$;

-- Seed social posts into network_chat_messages (Social Feed)
-- author_id is text, so we use 'acc-jordan' to match the demo account
DO $$
BEGIN
  -- Post A: How poker players actually study
  IF NOT EXISTS (SELECT 1 FROM network_chat_messages WHERE author_id = 'acc-jordan' AND body LIKE 'Been thinking a lot about how poker players actually study.%') THEN
    INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, created_at)
    VALUES ('acc-jordan', 'Jordan McAllister', 'FOUNDER',
      'Been thinking a lot about how poker players actually study.

Most of us don''t need another giant information dump.

We need a way to capture useful ideas, revisit them, share them with the right people and connect them directly to real hands.

That''s a big part of what we''re trying to solve here.',
      false, now() - interval '5 days');
  END IF;

  -- Post B: Final table spots
  IF NOT EXISTS (SELECT 1 FROM network_chat_messages WHERE author_id = 'acc-jordan' AND body LIKE 'Working through some final-table spots today.%') THEN
    INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, created_at)
    VALUES ('acc-jordan', 'Jordan McAllister', 'FOUNDER',
      'Working through some final-table spots today.

The more I study these situations, the more I think a lot of edge comes from understanding where people deviate from what they''re "supposed" to do rather than just memorizing outputs.',
      false, now() - interval '4 days');
  END IF;

  -- Post C: Learn from people who actually play
  IF NOT EXISTS (SELECT 1 FROM network_chat_messages WHERE author_id = 'acc-jordan' AND body LIKE 'One thing I want SpotVault to do really well:%') THEN
    INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, created_at)
    VALUES ('acc-jordan', 'Jordan McAllister', 'FOUNDER',
      'One thing I want SpotVault to do really well:

Make it easy to learn from people who actually play the games you''re trying to beat.

Not just polished courses — actual hands, actual thought process, actual decisions.',
      false, now() - interval '3 days');
  END IF;

  -- Post D: Feature wish
  IF NOT EXISTS (SELECT 1 FROM network_chat_messages WHERE author_id = 'acc-jordan' AND body LIKE 'What''s one feature you wish existed in poker software%') THEN
    INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, created_at)
    VALUES ('acc-jordan', 'Jordan McAllister', 'FOUNDER',
      'What''s one feature you wish existed in poker software that nobody has built properly yet?',
      false, now() - interval '2 days');
  END IF;

  -- Post E: Hand Workspace testing
  IF NOT EXISTS (SELECT 1 FROM network_chat_messages WHERE author_id = 'acc-jordan' AND body LIKE 'Testing some of the new Hand Workspace flow today.%') THEN
    INSERT INTO network_chat_messages (author_id, author_name, author_role, body, is_sponsored, created_at)
    VALUES ('acc-jordan', 'Jordan McAllister', 'FOUNDER',
      'Testing some of the new Hand Workspace flow today.

The goal is for it to feel less like opening another study tool and more like having a real working desk for your poker.',
      false, now() - interval '1 day');
  END IF;
END $$;
