/*
# V1→V2 Spot Migration: INSERT Batch 3 (4 of 15 missing spots)

Inserts 4 missing V1 spots:
- 502db9f7: "WSOP Retro: Cada's Costly Call"
- 39afdca2: "WSOP Retro: Moves Like Darvin" (draft, no content/images)
- 3038d748: "WSOP Retro: Moves Like Darvin (Pt.2)"
- 121c9d4b: "WSOP Main Event 2026: How You Doin'?"
*/

-- 502db9f7: WSOP Retro: Cada's Costly Call
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '502db9f7-4acb-418e-a39e-ba9b0d1b781a',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'WSOP Retro: Cada''s Costly Call', 'Why AJo Isn''t Always Strong Enough',
  'AJo is one of the strongest hands tournament players routinely overvalue. At the 2009 WSOP Main Event Final Table, one of poker''s biggest names faced a decision that modern ICM theory completely turns on its head.',
  'Hero: AdJs | Villain: AsKh | Stack: 20bb | Tournament: Final Table',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700427427-qptkpi11g6.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700428873-p0nu7g12iy.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700923070-x5dtbb44daa.png'],
  jsonb_build_object('legacy_v1_spot_id','502db9f7-4acb-418e-a39e-ba9b0d1b781a','difficulty','easy','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Preflop','pot_type','3BP','stage','Final Table',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','AdJs','hero_position','UTG','villain_position','LJ','villain_hand','AsKh','effective_stack',20,'tournament_type','Final Table','tags','["MTT","Final Table","3BP","GTO","ICM","Preflop","CO"]','difficulty','easy','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-10T16:13:30.097+00:00'::timestamptz, '2026-07-10T15:14:43.025469+00:00'::timestamptz, '2026-07-10T16:28:42.025+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','With seven players remaining, Joe Cada sits second-last in chips with roughly 20 big blinds. Cada opens AJo from under the gun to 2.5 big blinds. Shulman responds by moving all-in, and after everyone else folds, the decision is back on Cada. Holding one of the strongest non-premium hands in poker, Cada eventually makes the call.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','In our closest simulation, AQ offsuit is only barely profitable, while AJo is a clear fold. ICM isn''t about how strong your hand looks — it''s about the value of your tournament life. As the second-shortest stack, Cada stood to lose far more tournament equity than he could gain by making a marginal call against the only player shorter than him. Cada ran into AK and lost, but mounted one of the greatest comebacks in Main Event history to become the 2009 WSOP Main Event Champion.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','c2a095f7-fbf9-4e27-9699-b8ec619c7f9e','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','63425533-f536-46d3-a74a-3a7b59ab690d','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','c2f0d762-dfee-4034-8e0c-8acb35ecf354','name','schulmanrejam.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700427427-qptkpi11g6.png','image_type','evidence','order_index',0),
        jsonb_build_object('id','7122e458-b490-4488-b7f1-00a0984403e8','name','Cadautg.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700428873-p0nu7g12iy.png','image_type','visual_detail','order_index',1),
        jsonb_build_object('id','88a8ecad-88dc-4845-af2a-bd07dcabc7e2','name','cadaCAllingrange1.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700923070-x5dtbb44daa.png','image_type','evidence','order_index',2)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700427427-qptkpi11g6.png','caption','Schulman Rejam range','type','evidence'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700428873-p0nu7g12iy.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-3','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/502db9f7-4acb-418e-a39e-ba9b0d1b781a/1783700923070-x5dtbb44daa.png','caption','Cada calling rejam range','type','evidence')
  )
) ON CONFLICT (id) DO NOTHING;

-- 39afdca2: WSOP Retro: Moves Like Darvin (draft, minimal content)
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '39afdca2-6685-4483-8da6-2d2f81913c1e',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'draft', 'spotvault_v1',
  'WSOP Retro: Moves Like Darvin', 'WSOP Solver Logic In 2009',
  'sd', 'Hero: Qh8s | Villain: KcJs | Stack: 60bb | Board: Jc5d6s',
  ARRAY[]::text[],
  jsonb_build_object('legacy_v1_spot_id','39afdca2-6685-4483-8da6-2d2f81913c1e','difficulty','easy','content_type','solver_spot','game_format','mtt','source','GTO Wizard',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','Qh8s','hero_position','BB','villain_position','SB','villain_hand','KcJs','effective_stack',60,'tournament_type','Heads-Up','flop','["Jc5d6s"]','tags','[]','difficulty','easy','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com','status','draft')
  ),
  false, 0, false, NULL,
  NULL, '2026-07-10T17:57:48.556033+00:00'::timestamptz, '2026-07-10T17:57:48.556033+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','Draft spot — minimal content.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object('spot_nodes','[]'::jsonb,'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,'insight_images','[]'::jsonb)
  )),
  jsonb_build_array()
) ON CONFLICT (id) DO NOTHING;

-- 3038d748: WSOP Retro: Moves Like Darvin (Pt.2)
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '3038d748-6a33-422d-91a2-b55df2126782',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'WSOP Retro: Moves Like Darvin (Pt.2)', 'Modern Solver Logic Hidden in a 2009 WSOP Hand',
  'Was this an unnecessary spew, or an exploit ahead of its time? Let''s see what modern theory has to say about one of the most memorable bluffs from the 2009 WSOP Main Event.',
  'Hero: Qh8s | Villain: KcJs | Stack: 60bb | Board: Jc6s5d',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/3038d748-6a33-422d-91a2-b55df2126782/1783706852660-97ptmrw9458.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/3038d748-6a33-422d-91a2-b55df2126782/1783707408976-wycporu7ew.png'],
  jsonb_build_object('legacy_v1_spot_id','3038d748-6a33-422d-91a2-b55df2126782','difficulty','easy','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Flop','pot_type','SRP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','Qh8s','hero_position','BB','villain_position','SB','villain_hand','KcJs','effective_stack',60,'tournament_type','Heads-Up','flop','["Jc","6s","5d"]','tags','["MTT","Heads Up","SRP","Check Raise","ICM","Flop","BB"]','difficulty','easy','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-10T18:16:53.981+00:00'::timestamptz, '2026-07-10T18:00:32.56297+00:00'::timestamptz, '2026-07-10T18:16:48.65+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','Heads-up in the 2009 WSOP Main Event, Darvin Moon defended Q8 and faced a 3.5 million continuation bet from Joe Cada on a Jc6s5d rainbow flop. Rather than folding, Moon turned his hand into a bluff with an 8.5 million raise, forcing Cada to decide with top pair.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','At equilibrium, Q8o is actually a pure fold in this spot. Modern solver theory loves raising hands that combine limited showdown value, one or more overcards, and backdoor potential. Q8o loses the backdoor flush draw, and that seemingly small difference is enough to push it into the folding category. Moon''s overall philosophy was surprisingly intelligent — he frequently deployed an aggressive, high-pressure style that forced opponents to define the strength of their hands early.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','a5d80da3-f345-46ee-a79e-933e440696b4','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','f72e9c81-9d95-4ac6-a615-56001659055f','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','0d91e36d-42fa-4866-a171-06f9e5082f5d','name','DarvinMoves2.0.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/3038d748-6a33-422d-91a2-b55df2126782/1783706852660-97ptmrw9458.png','image_type','visual_detail','order_index',0),
        jsonb_build_object('id','34bf6989-fb98-4c0b-98c6-d9b534e7bf01','name','darvinsrange.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/3038d748-6a33-422d-91a2-b55df2126782/1783707408976-wycporu7ew.png','image_type','evidence','order_index',1)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/3038d748-6a33-422d-91a2-b55df2126782/1783706852660-97ptmrw9458.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/3038d748-6a33-422d-91a2-b55df2126782/1783707408976-wycporu7ew.png','caption','Darvin''s flop range v. Cada c bet','type','evidence')
  )
) ON CONFLICT (id) DO NOTHING;

-- 121c9d4b: WSOP Main Event 2026: How You Doin'?
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '121c9d4b-e910-4610-a06a-0d6532152028',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'WSOP Main Event 2026: How You Doin''?', 'The Dream''s Still Alive, Cuz',
  'Every year, people wonder if poker has become "solved." Then a Day 5 Main Event hand like this comes along and reminds us that even at the highest levels, difficult decisions—and questionable ones—still exist.',
  'Hero: QdQc | Villain: AdJc | Stack: 32.5bb | Tournament: Middle Stage',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783717379026-kcmpg12cdil.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718668435-fozqc5ry269.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718720910-c7oxtg7ige.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718838423-rmjz2sy59dp.png'],
  jsonb_build_object('legacy_v1_spot_id','121c9d4b-e910-4610-a06a-0d6532152028','difficulty','medium','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Preflop','pot_type','3BP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','QdQc','hero_position','HJ','villain_position','UTG+1','villain_hand','AdJc','effective_stack',32.5,'tournament_type','Middle Stage','tags','["MTT","Middle","3BP","4BP","Population","ICM","Preflop","HJ","UTG"]','difficulty','medium','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-10T21:29:10.781+00:00'::timestamptz, '2026-07-10T20:58:19.714916+00:00'::timestamptz, '2026-07-11T15:37:51.472+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','With approximately 32.5 BB, Perry opens from UTG+1 holding AJo. Action folds to the Hijack, who finds QQ and elects to 3-bet to just 85,000 despite being around 44 BB deep. Perry barely hesitates before confidently firing back, "Two seventy-five." Despite holding queens, the Hijack eventually lets her hand go.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','The Hijack''s 4.5 BB 3-bet with QQ is likely too small. Perry''s 13.75 BB 4-bet commits nearly 40% of his stack with AJo, creating an uncomfortable situation if his opponent decides to shove. A smaller 4-bet would likely generate a very similar amount of fold equity while preserving significantly more chips. Every preflop decision should come with a plan. The Games Ain''t Dead, Cuz.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','45002c25-0d2a-4fb2-8096-8f40b6e0cc39','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','b44cf426-5f78-4069-b963-d1a7b3fa2ced','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','23a84c4a-47c7-446d-af91-4a4b149bf495','name','Buckner.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783717379026-kcmpg12cdil.png','image_type','visual_detail','order_index',0),
        jsonb_build_object('id','4bb98a6c-52c8-48e8-9d7a-7bd333bce50f','name','3betrange.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718668435-fozqc5ry269.png','image_type','evidence','order_index',1),
        jsonb_build_object('id','df875d1e-a923-4377-8e9e-a13c9e354e46','name','utg4betrange.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718720910-c7oxtg7ige.png','image_type','evidence','order_index',2),
        jsonb_build_object('id','61d3cfc2-e88d-4da7-ae12-20a97ad4594d','name','HJ range.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718838423-rmjz2sy59dp.png','image_type','evidence','order_index',3)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783717379026-kcmpg12cdil.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718668435-fozqc5ry269.png','caption','HJ 3 bet range','type','evidence'),
    jsonb_build_object('id','vd-3','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718720910-c7oxtg7ige.png','caption','UTG 4 bet range','type','evidence'),
    jsonb_build_object('id','vd-4','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/121c9d4b-e910-4610-a06a-0d6532152028/1783718838423-rmjz2sy59dp.png','caption','HJ range once being 4 bet','type','evidence')
  )
) ON CONFLICT (id) DO NOTHING;