/*
# V1→V2 Spot Migration: INSERT Batch 1 (3 of 15 missing spots)

Inserts 3 missing V1 spots into content_spots:
- 5cd2c0fd: "Why Does A2 Call More Than AT?"
- 37837ef8: "Turn Barrel Spot: Third Pair vs Open-Ended Straight Draw"
- a5d159c5: "Why Is One ICM Range Linear While The Other Is Polarized?"

All spots map to Jordan's account (17ca0743-ccdb-4d43-ab24-f84aa2821170).
source='spotvault_v1', quiz=NULL, no quiz data migrated.
Solver data preserved in work_pack_stages[0]._legacy_v1.
Legacy metadata preserved in tags.legacy_v1_metadata.
*/

INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
SELECT
  sp.id,
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  'Jordan McAllister',
  sp.status,
  'spotvault_v1',
  sp.title,
  sp.subtitle,
  sp.introduction,
  sp.hand_details,
  sp.image_urls,
  sp.tags,
  false,
  0,
  sp.show_in_courses,
  NULL,
  sp.published_at::timestamptz,
  sp.created_at::timestamptz,
  sp.updated_at::timestamptz,
  sp.spot_type,
  sp.content_blocks,
  sp.work_pack_stages,
  sp.visual_details
FROM (VALUES
  (
    '5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0'::uuid,
    'Why Does A2 Call More Than AT?',
    NULL::text,
    'UTG min raise open to 2 bb. Folds to BB who completes. Flop comes AsQs9h: BB checks, UTG bets 4 bb, BB calls. Turn 7d: BB checks, UTG bets 9.8 bb, BB calls. River 3d: BB checks, UTG bets all in for 24.2 bb, action on BB.'::text,
    'Hero: Ad2c | Villain: UTG | Stack: 40bb | Board: AsQs9h 7d 3d'::text,
    ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0/1781885993070-igwgrmlhys.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0/1781885994864-w9itb35nf4.png']::text[],
    jsonb_build_object(
      'legacy_v1_spot_id', '5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0',
      'difficulty', 'medium',
      'content_type', 'solver_spot',
      'game_format', 'mtt',
      'source', 'GTO Wizard',
      'street', 'River',
      'pot_type', 'SRP',
      'legacy_v1_metadata', jsonb_build_object(
        'hero_hand', 'Ad2c',
        'hero_position', 'BB',
        'villain_position', 'UTG',
        'effective_stack', 40,
        'tournament_type', 'ChipEV',
        'flop', '["As","Qs","9h","7d","3d"]',
        'tags', '["MTT","Early","SRP","GTO","ChipEV","River","BB"]',
        'difficulty', 'medium',
        'content_type', 'solver_spot',
        'game_format', 'mtt',
        'source_original', 'GTO Wizard',
        'confidence_level', 'medium',
        'does_generalize', true,
        'owner_email', 'jordanmcallister12@hotmail.com'
      )
    ),
    false,
    false,
    'published'::text,
    '2026-06-19T16:19:52.763+00:00'::text,
    '2026-06-19T16:19:52.763+00:00'::text,
    '2026-06-19T16:19:52.763+00:00'::text,
    'work_pack'::text,
    jsonb_build_array(
      jsonb_build_object('id', 'cb-1', 'type', 'paragraph', 'text', 'UTG min raise open to 2 bb. Folds to BB who completes. Flop comes AsQs9h: BB checks, UTG bets 4 bb, BB calls. Turn 7d: BB checks, UTG bets 9.8 bb, BB calls. River 3d: BB checks, UTG bets all in for 24.2 bb, action on BB.'),
      jsonb_build_object('id', 'cb-2', 'type', 'heading', 'text', 'Core Lesson'),
      jsonb_build_object('id', 'cb-3', 'type', 'paragraph', 'text', 'This hand examines a river decision in a 40 BB Chip EV scenario. UTG opens the action and BB defends. After reaching the flop on A♠ Q♠ 9♥, UTG continues betting and applies pressure across multiple streets. The turn brings the 7♦ before the river completes with the 3♦. By the river, there is approximately 33.1 BB in the pot and UTG has 24.2 BB remaining. UTG elects to move all-in, forcing BB to decide which bluff-catchers can profitably continue.'),
      jsonb_build_object('id', 'cb-4', 'type', 'heading', 'text', 'Why It Matters'),
      jsonb_build_object('id', 'cb-5', 'type', 'paragraph', 'text', 'Most players instinctively think AT should be a better bluff-catcher than A2, because it is the stronger hand. The solver disagrees. When facing a river jam on A♠ Q♠ 9♥ 7♦ 3♦, our goal isn''t to beat value hands—we''re trying to catch bluffs. AT blocks some of Villain''s natural bluffs (KT, JT, T8). A2 does the opposite — the deuce rarely appears in Villain''s bluffing region, so A2 allows Villain to arrive at the river with more busted draws and bluff combinations. In other words, A2 "unblocks" bluffs. AT is the stronger hand, but A2 is the better bluff-catcher.')
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'stage-v1-legacy',
        'title', 'Legacy V1 Solver Data',
        'blocks', '[]'::jsonb,
        '_legacy_v1', jsonb_build_object(
          'spot_nodes', jsonb_build_array(
            jsonb_build_object('id', 'b4079d5f-1d3d-4bb0-a6a8-6b15c5024ccd', 'street', 'flop', 'label', 'Flop Root', 'hero_grid_data', '{}'::jsonb, 'villain_grid_data', '{}'::jsonb, 'analytics', '{}'::jsonb),
            jsonb_build_object('id', 'acdfe1ca-976f-4fe2-bb54-9cb4d42c311f', 'street', 'flop', 'label', 'Flop Root', 'hero_grid_data', '{}'::jsonb, 'villain_grid_data', '{}'::jsonb, 'analytics', '{}'::jsonb)
          ),
          'spot_ranges', '[]'::jsonb,
          'range_grids', '[]'::jsonb,
          'insight_images', jsonb_build_array(
            jsonb_build_object('id', '8d99ff10-a9df-40c1-b87b-52e242ff68de', 'name', 'rangefinal.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0/1781885993070-igwgrmlhys.png', 'image_type', 'evidence', 'order_index', 0, 'is_featured', false),
            jsonb_build_object('id', '4413af8b-6c81-44e0-ab54-fea53ca78153', 'name', 'A2.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0/1781885994864-w9itb35nf4.png', 'image_type', 'visual_detail', 'order_index', 0, 'is_featured', false)
          )
        )
      )
    ),
    jsonb_build_array(
      jsonb_build_object('id', 'vd-1', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0/1781885993070-igwgrmlhys.png', 'caption', 'River calling range', 'type', 'evidence'),
      jsonb_build_object('id', 'vd-2', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/5cd2c0fd-2adb-4dbb-8f43-f414f84fd2d0/1781885994864-w9itb35nf4.png', 'caption', NULL, 'type', 'visual_detail')
    )
  )
) AS sp(id, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, show_in_courses, status, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
ON CONFLICT (id) DO NOTHING;

-- Spot 37837ef8: Turn Barrel Spot
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '37837ef8-543d-462f-b1e0-43bf5c0f518d',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  'Jordan McAllister',
  'published',
  'spotvault_v1',
  'Turn Barrel Spot: Third Pair vs Open-Ended Straight Draw',
  NULL,
  'UTG min raises preflop and BB completes. Flop AsQs9h: BB check, UTG bet 4 bb, BB call. Turn 7d: UTG faced with decision to bet or check. He is given this option for two hands Jd9d and 10s8s. Which one bets & which one checks?',
  'Hero: Jd9d | Villain: BB | Stack: 40bb | Board: AsQs9h 7d',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/37837ef8-543d-462f-b1e0-43bf5c0f518d/1781890098448-h4c28qwtcmp.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/37837ef8-543d-462f-b1e0-43bf5c0f518d/1781890099599-tbpq253lmod.png'],
  jsonb_build_object(
    'legacy_v1_spot_id', '37837ef8-543d-462f-b1e0-43bf5c0f518d',
    'difficulty', 'hard',
    'content_type', 'solver_spot',
    'game_format', 'mtt',
    'source', 'GTO Wizard',
    'street', 'Turn',
    'pot_type', 'SRP',
    'legacy_v1_metadata', jsonb_build_object(
      'hero_hand', 'Jd9d', 'hero_position', 'UTG', 'villain_position', 'BB',
      'effective_stack', 40, 'tournament_type', 'ChipEV',
      'flop', '["AsQs9h7d"]', 'tags', '["MTT","Early","SRP","Bluff","ChipEV","Turn","UTG"]',
      'difficulty', 'hard', 'content_type', 'solver_spot', 'game_format', 'mtt',
      'source_original', 'GTO Wizard', 'confidence_level', 'medium', 'does_generalize', true,
      'owner_email', 'jordanmcallister12@hotmail.com'
    )
  ),
  false, 0, false, NULL,
  '2026-06-19T17:15:58.951+00:00'::timestamptz,
  '2026-06-19T17:15:58.988329+00:00'::timestamptz,
  '2026-06-19T19:25:25.334+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id', 'cb-1', 'type', 'paragraph', 'text', 'UTG min raises preflop and BB completes. Flop AsQs9h: BB check, UTG bet 4 bb, BB call. Turn 7d: UTG faced with decision to bet or check. He is given this option for two hands Jd9d and 10s8s. Which one bets & which one checks?'),
    jsonb_build_object('id', 'cb-2', 'type', 'heading', 'text', 'Core Lesson'),
    jsonb_build_object('id', 'cb-3', 'type', 'paragraph', 'text', 'Positions: UTG vs BB. Stack Depth: 40 BB Effective. Board: A♠ Q♠ 9♥ 7♦. UTG opens to 2 BB and BB defends. The flop comes A♠ Q♠ 9♥. BB checks, UTG c-bets 4 BB, and BB calls. The turn is the 7♦. BB checks again, and action is back on UTG.'),
    jsonb_build_object('id', 'cb-4', 'type', 'heading', 'text', 'Why It Matters'),
    jsonb_build_object('id', 'cb-5', 'type', 'paragraph', 'text', 'At first glance, most players assume T♠8♠ should be the more aggressive hand. It has an open-ended straight draw, a flush draw, and substantial equity. Surprisingly, the solver prefers checking this hand much more often than J♦9♦. The reason is that T♠8♠ already realizes equity exceptionally well. J♦9♦ faces a different problem — while it has showdown value, that value is relatively fragile. By betting the turn, J♦9♦ can fold out hands with meaningful equity while preventing BB from freely realizing overcards, gutshots, straight draws, and flush draws. The stronger draw prefers to check, while the weaker made hand prefers to bet.')
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', 'stage-v1-legacy', 'title', 'Legacy V1 Solver Data', 'blocks', '[]'::jsonb,
      '_legacy_v1', jsonb_build_object(
        'spot_nodes', jsonb_build_array(
          jsonb_build_object('id', 'd76bc230-16fb-462e-886c-895507898e7f', 'street', 'flop', 'label', 'Flop Root', 'hero_grid_data', '{}'::jsonb, 'villain_grid_data', '{}'::jsonb, 'analytics', '{}'::jsonb),
          jsonb_build_object('id', '22f5fbe2-cff2-420e-8210-5d046709a42f', 'street', 'flop', 'label', 'Flop Root', 'hero_grid_data', '{}'::jsonb, 'villain_grid_data', '{}'::jsonb, 'analytics', '{}'::jsonb)
        ),
        'spot_ranges', '[]'::jsonb, 'range_grids', '[]'::jsonb,
        'insight_images', jsonb_build_array(
          jsonb_build_object('id', '2fbcd3b7-b188-40a8-8883-0296ec075ace', 'name', 'turnbarrelrange.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/37837ef8-543d-462f-b1e0-43bf5c0f518d/1781890098448-h4c28qwtcmp.png', 'image_type', 'evidence', 'order_index', 0, 'is_featured', false),
          jsonb_build_object('id', '5f33c584-c386-4436-bb1f-9816b52afc91', 'name', 'turnvisual.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/37837ef8-543d-462f-b1e0-43bf5c0f518d/1781890099599-tbpq253lmod.png', 'image_type', 'visual_detail', 'order_index', 1, 'is_featured', false)
        )
      )
    )
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'vd-1', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/37837ef8-543d-462f-b1e0-43bf5c0f518d/1781890098448-h4c28qwtcmp.png', 'caption', NULL, 'type', 'evidence'),
    jsonb_build_object('id', 'vd-2', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/37837ef8-543d-462f-b1e0-43bf5c0f518d/1781890099599-tbpq253lmod.png', 'caption', NULL, 'type', 'visual_detail')
  )
)
ON CONFLICT (id) DO NOTHING;

-- Spot a5d159c5: Why Is One ICM Range Linear While The Other Is Polarized?
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  'a5d159c5-c6b1-4248-99c3-4a1f00a37a1b',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  'Jordan McAllister',
  'published',
  'spotvault_v1',
  'Why Is One ICM Range Linear While The Other Is Polarized?',
  NULL,
  'Scenario 1: 8-handed final table. We are tied for 7th place with 18bb. UTG opens 23bb and we respond with a highly polarized range containing many blocker-heavy holdings. Scenario 2: 5-handed. We again have roughly 18-20bb and sit near the bottom of the chip counts. Facing an open from the chip leader, our strategy becomes much more linear and concentrated around stronger hands.',
  'Stack: 18bb | Tournament: Final Table | ICM',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782070660396-95uxf4v13q.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782070661841-sqg1gsg6dyk.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782072297192-93e5mlq62pk.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782085116269-k98pxn0zhp.png'],
  jsonb_build_object(
    'legacy_v1_spot_id', 'a5d159c5-c6b1-4248-99c3-4a1f00a37a1b',
    'difficulty', 'medium', 'content_type', 'solver_spot', 'game_format', 'mtt',
    'source', 'GTO Wizard', 'street', 'Preflop', 'pot_type', 'SRP', 'stage', 'Final Table',
    'legacy_v1_metadata', jsonb_build_object(
      'effective_stack', 18, 'tournament_type', 'Final Table',
      'tags', '["MTT","Final Table","SRP","GTO","ICM","Preflop","BTN"]',
      'difficulty', 'medium', 'content_type', 'solver_spot', 'game_format', 'mtt',
      'source_original', 'GTO Wizard', 'confidence_level', 'medium', 'does_generalize', true,
      'owner_email', 'jordanmcallister12@hotmail.com'
    )
  ),
  false, 0, false, NULL,
  '2026-06-22T00:46:15.656+00:00'::timestamptz,
  '2026-06-21T19:37:36.054483+00:00'::timestamptz,
  '2026-06-21T23:38:35.792+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id', 'cb-1', 'type', 'paragraph', 'text', 'Scenario 1: 8-handed final table. We are tied for 7th place with 18bb. UTG opens 23bb and we respond with a highly polarized range. Scenario 2: 5-handed. We again have roughly 18-20bb and sit near the bottom of the chip counts. Facing an open from the chip leader, our strategy becomes much more linear.'),
    jsonb_build_object('id', 'cb-2', 'type', 'heading', 'text', 'Why It Matters'),
    jsonb_build_object('id', 'cb-3', 'type', 'paragraph', 'text', 'In the 8-handed example, the aggressive portion of the range becomes highly polarized and includes many blocker-heavy holdings such as suited Ax. In the 5-handed example, the range becomes much more linear. Facing a chip leader who can apply maximum ICM pressure and continue more aggressively, blocker value decreases and fold equity becomes harder to generate. The solver instead prioritizes hands that perform well when called. The value of a blocker depends heavily on an opponent''s ability to fold.')
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', 'stage-v1-legacy', 'title', 'Legacy V1 Solver Data', 'blocks', '[]'::jsonb,
      '_legacy_v1', jsonb_build_object(
        'spot_nodes', jsonb_build_array(
          jsonb_build_object('id', 'a4a2dab1-f0f7-47d7-a4db-a3332992fc6e', 'street', 'flop', 'label', 'Flop Root', 'hero_grid_data', '{}'::jsonb, 'villain_grid_data', '{}'::jsonb, 'analytics', '{}'::jsonb),
          jsonb_build_object('id', '620af3dd-b535-45e3-8d73-5b1071900108', 'street', 'flop', 'label', 'Flop Root', 'hero_grid_data', '{}'::jsonb, 'villain_grid_data', '{}'::jsonb, 'analytics', '{}'::jsonb)
        ),
        'spot_ranges', '[]'::jsonb, 'range_grids', '[]'::jsonb,
        'insight_images', jsonb_build_array(
          jsonb_build_object('id', '5a421a02-9d2b-4cbd-acf5-fed64a38a88b', 'name', '8 left FT.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782070660396-95uxf4v13q.png', 'image_type', 'evidence', 'order_index', 0),
          jsonb_build_object('id', '70da4eed-0da7-479b-9e7a-f121b303150e', 'name', 'ICM5leftCL.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782070661841-sqg1gsg6dyk.png', 'image_type', 'evidence', 'order_index', 1),
          jsonb_build_object('id', 'eee454e9-cf79-4ff8-9636-1a004c5c526f', 'name', 'visual.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782072297192-93e5mlq62pk.png', 'image_type', 'visual_detail', 'order_index', 2),
          jsonb_build_object('id', 'fbdb634f-3e5b-4ece-beab-3e3ba456b46a', 'name', 'visual2.png', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782085116269-k98pxn0zhp.png', 'image_type', 'visual_detail', 'order_index', 3)
        )
      )
    )
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'vd-1', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782070660396-95uxf4v13q.png', 'caption', NULL, 'type', 'evidence'),
    jsonb_build_object('id', 'vd-2', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782070661841-sqg1gsg6dyk.png', 'caption', NULL, 'type', 'evidence'),
    jsonb_build_object('id', 'vd-3', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782072297192-93e5mlq62pk.png', 'caption', NULL, 'type', 'visual_detail'),
    jsonb_build_object('id', 'vd-4', 'url', 'https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/a5d159c5-c6b1-4248-99c3-4a1f00a37a1b/1782085116269-k98pxn0zhp.png', 'caption', NULL, 'type', 'visual_detail')
  )
)
ON CONFLICT (id) DO NOTHING;