/*
# V1→V2 Spot Migration: INSERT Batch 2 (4 of 15 missing spots)

Inserts 4 missing V1 spots:
- 10344bfd: "When Calling Is No Longer An Option"
- 03dd683a: "The Suited Connector Conniption: Breaking The Threshold"
- 1321949d: "The Pocket Pair Paradox"
- c331c908: "WSOP Retro: Moves Like Darvin"
*/

-- 10344bfd: When Calling Is No Longer An Option
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '10344bfd-205c-4768-83fa-865ca54d6434',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'When Calling Is No Longer An Option', NULL,
  'UTG 2 BB open, BB defends. Flop 7d4s4h, BB checks, UTG bets 1.8 BB. BB owns the nut advantage. Strategy is heavily polarized: raise or fold. Calling is uncommon as BB frequently seizes the initiative through check-raises.',
  'Hero: KcJc | Villain: UTG | Stack: 80bb | Board: 7d4s4h',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/10344bfd-205c-4768-83fa-865ca54d6434/1782102665361-4me7gjyqg36.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/10344bfd-205c-4768-83fa-865ca54d6434/1782102667257-3lqloiknl8i.png'],
  jsonb_build_object('legacy_v1_spot_id','10344bfd-205c-4768-83fa-865ca54d6434','difficulty','medium','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Flop','pot_type','SRP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','KcJc','hero_position','BB','villain_position','BB','effective_stack',80,'tournament_type','ChipEV','flop','["7d","4s","4h"]','tags','["MTT","Early","SRP","Check Raise","ChipEV","Flop","BB"]','difficulty','medium','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-06-22T04:39:21.37+00:00'::timestamptz, '2026-06-22T04:31:05.488115+00:00'::timestamptz, '2026-06-22T04:38:55.7+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','UTG 2 BB open, BB defends. Flop 7d4s4h, BB checks, UTG bets 1.8 BB. BB owns the nut advantage. Strategy is heavily polarized: raise or fold. Calling is uncommon as BB frequently seizes the initiative through check-raises.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','The most shocking aspect of this spot isn''t that the BB raises a lot—it''s that the BB almost stops calling altogether. Because BB holds such a powerful nut advantage on 7d4s4h, the solver doesn''t want to build a large calling range. Calling leaves UTG in control of the hand. Instead, the solver prefers to immediately challenge UTG''s equity realization by raising. The result is a raising strategy containing nearly 300 raising combinations. When the board strongly favors one player, the solver often decides that calling is simply the least efficient option.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','c401c639-7797-42fa-990b-75110398d5e1','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','6b8a8d1e-b077-4ddd-8640-4049a76de865','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','d04df499-c3cf-4786-a059-b4162736c88e','name','80bb check raise.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/10344bfd-205c-4768-83fa-865ca54d6434/1782102665361-4me7gjyqg36.png','image_type','evidence','order_index',0),
        jsonb_build_object('id','f96a9ca1-ce7e-4b24-88e5-61bb7a91f8b6','name','JL.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/10344bfd-205c-4768-83fa-865ca54d6434/1782102667257-3lqloiknl8i.png','image_type','visual_detail','order_index',0)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/10344bfd-205c-4768-83fa-865ca54d6434/1782102665361-4me7gjyqg36.png','caption',NULL,'type','evidence'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/10344bfd-205c-4768-83fa-865ca54d6434/1782102667257-3lqloiknl8i.png','caption',NULL,'type','visual_detail')
  )
) ON CONFLICT (id) DO NOTHING;

-- 03dd683a: The Suited Connector Conniption
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '03dd683a-bbb8-42c5-ab8e-23ca88d4fa36',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'The Suited Connector Conniption: Breaking The Threshold', NULL,
  'UTG raise 2 bb and BB calls. Two flops: JsTs9h, Ts9s8h. Almost identical flops yet completely different strategies are suggested. On the J high flop, UTG is c betting 1.1 bb. On the Ts9s8h flop, strategy is changed to be more polarized and focused on equity denial.',
  'Hero: UTG | Villain: BB | Stack: 40bb | Board: JsTs9h / Ts9s8h',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144318683-zp6wqkqqah.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144319858-xtnm000iwf.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144596535-ikau8uyk2ee.png'],
  jsonb_build_object('legacy_v1_spot_id','03dd683a-bbb8-42c5-ab8e-23ca88d4fa36','difficulty','medium','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Flop','pot_type','SRP',
    'legacy_v1_metadata', jsonb_build_object('hero_position','UTG','villain_position','BB','effective_stack',40,'tournament_type','ChipEV','flop','["JsTs9h"]','additional_boards','["Ts9s8h"]','tags','["MTT","Early","SRP","Cbet","ChipEV","Flop","UTG"]','difficulty','medium','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-06-22T16:10:08.207+00:00'::timestamptz, '2026-06-22T16:05:18.805132+00:00'::timestamptz, '2026-06-22T16:13:08.108+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','UTG raise 2 bb and BB calls. Two flops: JsTs9h, Ts9s8h. Almost identical flops yet completely different strategies are suggested.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','On JT9, UTG''s opening range contains many strong broadway hands. The solver prefers a small, high-frequency c-bet. On T98, BB''s defending range contains far more suited connectors and disguised nutted combinations. The solver becomes more selective when betting and uses a larger sizing. As connected boards move lower, the preflop caller''s range tends to gain more nut combinations. What appears to be a minor board texture change can completely reshape the optimal strategy.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','f2cf0f45-fe11-4e51-8920-733f0abcbf32','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','a12bf60f-f94f-499a-a4ef-ba8643415c92','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','2d612bd3-eadb-4627-bb0e-4ef499c5f1a8','name','40bb JT9 flop.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144318683-zp6wqkqqah.png','image_type','evidence','order_index',0),
        jsonb_build_object('id','f46d8bcf-d4c7-4cbb-b019-6b1b3459fee5','name','40 bb utg JT9.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144319858-xtnm000iwf.png','image_type','evidence','order_index',1),
        jsonb_build_object('id','091c1736-fa01-4c65-8ecf-70e3504178c4','name','visual1.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144596535-ikau8uyk2ee.png','image_type','visual_detail','order_index',2)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144318683-zp6wqkqqah.png','caption','JsTs9h Flop C Bet Strategy','type','evidence'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144319858-xtnm000iwf.png','caption','Ts9s8h Flop C Bet Strategy','type','evidence'),
    jsonb_build_object('id','vd-3','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/03dd683a-bbb8-42c5-ab8e-23ca88d4fa36/1782144596535-ikau8uyk2ee.png','caption',NULL,'type','visual_detail')
  )
) ON CONFLICT (id) DO NOTHING;

-- 1321949d: The Pocket Pair Paradox
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '1321949d-f8e2-4e5a-a979-6e77f74c8a9b',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'The Pocket Pair Paradox', NULL,
  'Game Type: MTT ChipEV. Effective Stack: 40 BB. Preflop: HJ opens to 2 BB, BB calls. Flop: Ks6h5d. Solver Action (HJ): 73% pot at 57.5% frequency. Key Observation: Pocket 77 is a pure large c-bet, while QQ checks at very high frequency despite being the stronger hand.',
  'Hero: 7d7s | Villain: BB | Stack: 40bb | Board: Ks6h5d',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1321949d-f8e2-4e5a-a979-6e77f74c8a9b/1782406347509-91s8en1pqfu.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1321949d-f8e2-4e5a-a979-6e77f74c8a9b/1782406348767-9ny2kjjav27.png'],
  jsonb_build_object('legacy_v1_spot_id','1321949d-f8e2-4e5a-a979-6e77f74c8a9b','difficulty','medium','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Flop','pot_type','SRP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','7d7s','hero_position','HJ','villain_position','BB','effective_stack',40,'tournament_type','ChipEV','flop','["Ks","6h","5d"]','tags','["MTT","Early","SRP","Cbet","ChipEV","Flop","UTG","HJ"]','difficulty','medium','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-06-25T16:55:38.883+00:00'::timestamptz, '2026-06-25T16:37:54.14184+00:00'::timestamptz, '2026-06-25T16:54:51.395+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','Game Type: MTT ChipEV. Effective Stack: 40 BB. Preflop: HJ opens to 2 BB, BB calls. Flop: Ks6h5d. Solver Action (HJ): 73% pot at 57.5% frequency, checking 42.5%. Key Observation: Pocket 77 is a pure large c-bet, while QQ checks at very high frequency despite being the stronger hand.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','77 wants folds. By betting large, 77 denies equity from overcards, forces folds from weaker pairs, and charges gutshots. QQ doesn''t need protection — it is already one of the strongest bluff-catchers in HJ''s checking range. When QQ checks, it comfortably realizes its equity, allows BB to bluff weaker hands, and keeps dominated hands alive. The solver isn''t ranking hands by strength — it''s asking which hands gain the most EV by betting, and which gain the most EV by checking.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','c860cc80-5f06-4d86-8265-116d85b09c8c','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','8780c9d1-f2a0-43e0-8836-033473c5f68c','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','774924e2-361e-4530-a52a-2b705f4997e7','name','QQ77checkback.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1321949d-f8e2-4e5a-a979-6e77f74c8a9b/1782406347509-91s8en1pqfu.png','image_type','evidence','order_index',0),
        jsonb_build_object('id','43dcface-98ea-4b8e-b365-fe0b82304d03','name','tingy.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1321949d-f8e2-4e5a-a979-6e77f74c8a9b/1782406348767-9ny2kjjav27.png','image_type','visual_detail','order_index',1)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1321949d-f8e2-4e5a-a979-6e77f74c8a9b/1782406347509-91s8en1pqfu.png','caption','HJ range','type','evidence'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1321949d-f8e2-4e5a-a979-6e77f74c8a9b/1782406348767-9ny2kjjav27.png','caption',NULL,'type','visual_detail')
  )
) ON CONFLICT (id) DO NOTHING;

-- c331c908: WSOP Retro: Moves Like Darvin
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  'c331c908-87e8-4ca1-a0b1-0ac65a2c13c1',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'WSOP Retro: Moves Like Darvin', 'Modern Solver Logic Hidden in a 2009 WSOP Hand',
  'We''re at the 2009 WSOP Main Event Final Table. Darvin Moon begins the day with nearly 59 million chips — roughly 30% of all chips in play. Holding A3 in the cutoff, he limps before facing an isolation raise from the big blind''s pocket nines. What follows is one of the most intriguing bluffs of the final table.',
  'Hero: Ac3d | Villain: 9d9h | Stack: 200bb | Tournament: Final Table',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/c331c908-87e8-4ca1-a0b1-0ac65a2c13c1/1783694598226-e18omv89o4.png'],
  jsonb_build_object('legacy_v1_spot_id','c331c908-87e8-4ca1-a0b1-0ac65a2c13c1','difficulty','easy','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Preflop','pot_type','SRP','stage','Final Table',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','Ac3d','hero_position','CO','villain_position','SB','villain_hand','9d9h','effective_stack',200,'tournament_type','Final Table','tags','["MTT","ChipEV","ICM","Preflop","CO","Exploit","SRP","Final Table","3BP"]','difficulty','easy','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-10T14:48:36.274+00:00'::timestamptz, '2026-07-10T14:29:39.193138+00:00'::timestamptz, '2026-07-10T14:47:25.079+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','We''re at the 2009 WSOP Main Event Final Table. Darvin Moon begins the day with nearly 59 million chips. Holding A3 in the cutoff, he limps before facing an isolation raise from the big blind''s pocket nines. Darvin fires back with a limp-reraise to 3.3 million.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','Weak offsuit aces make excellent bluff candidates because they have poor postflop playability. A3 contains one of the most powerful blockers in poker: an ace. Holding an ace removes combinations of AA, AK, and AQ from Schaffel''s range. Modern solvers frequently select these weak Ax hands as bluff candidates for exactly this reason. Darvin''s 3.3 million sizing applies maximum pressure while risking the minimum amount necessary to credibly represent a monster.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','09cd461e-4c59-4de6-9a04-2ea39786ca31','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','51042dee-c96f-4e2a-b780-92f6d7a0b390','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','7d94fcdb-8f88-4507-95a2-c69c8576d667','name','darvin.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/c331c908-87e8-4ca1-a0b1-0ac65a2c13c1/1783694598226-e18omv89o4.png','image_type','visual_detail','order_index',0)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/c331c908-87e8-4ca1-a0b1-0ac65a2c13c1/1783694598226-e18omv89o4.png','caption',NULL,'type','visual_detail')
  )
) ON CONFLICT (id) DO NOTHING;