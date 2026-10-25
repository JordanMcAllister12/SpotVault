/*
# V1→V2 Spot Migration: INSERT Batch 4 (final 4 of 15 missing spots)

Inserts 4 missing V1 spots:
- bcfcdf23: "Theory vs. Instinct"
- 1cc16b8b: "WSOP Retro: Destined for Greatness?"
- b256c0da: "WSOP 2026: Each Street Is a New Battle"
- 2472ed54: "You Aren't Bluffing Enough"
*/

-- bcfcdf23: Theory vs. Instinct
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  'bcfcdf23-db46-4655-8e4f-272dab474c16',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'Theory vs. Instinct', 'Finding the balance between GTO and exploitative poker',
  'We all know the feeling. You fire two barrels, get called twice, and arrive on the river wondering whether to empty the clip or wave the white flag. Solver says one thing. Your instincts often say another.',
  'Hero: Jc8d | Villain: Ad6s | Stack: 50bb | Board: 5c7d9d 5h 2c',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783893969591-0zb7alha9un.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783894466836-w29nwa0850g.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783895700547-7r0uwkfu4q3.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783895861307-uh16h2nlr8.jpg'],
  jsonb_build_object('legacy_v1_spot_id','bcfcdf23-db46-4655-8e4f-272dab474c16','difficulty','medium','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','River','pot_type','SRP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','Jc8d','hero_position','BB','villain_position','BTN','villain_hand','Ad6s','effective_stack',50,'tournament_type','Late Stage','flop','["5c","7d","9d"]','turn','5h','river','2c','tags','["MTT","Bubble","SRP","Exploit","GTO","Check Raise","Float","Bluff","BB","River","ICM"]','difficulty','medium','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-12T22:38:42.804+00:00'::timestamptz, '2026-07-12T22:06:09.435876+00:00'::timestamptz, '2026-07-16T01:47:12.358+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','We defend the big blind with Jc8d against a button open, playing approximately 50 big blinds effective. The flop comes 9d7d5c, giving us an open-ended straight draw. After Villain continuation bets, I elect to check-raise, and he calls. The turn brings the 5h, pairing the board. I continue for roughly half pot, and Villain makes the call. The river is the 2c. I ultimately decide to wave the white flag and check. Villain checks behind and tables Ad6s.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','The turn is where theory and exploit begin to merge. After improving to an open-ended straight draw, Chris checks and I happily check behind. From a GTO standpoint, I realize my equity for free. From an exploitative standpoint, I also create a very unusual betting sequence. By the river, Jc8d is once again an almost pure jam according to the solver. But poker isn''t played in a vacuum. I chose instinct over theory. Whether that was ultimately the highest-EV decision isn''t something any solver can answer.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','4f04ca7e-4039-4a46-a1f1-bf0d2352b28e','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','0ccc9f78-9288-4d3e-8d0d-31e264fe2c69','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','db66483b-2a51-44b3-98a2-79f910bc2cf2','name','visual detailsJ8.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783893969591-0zb7alha9un.png','image_type','visual_detail','order_index',0),
        jsonb_build_object('id','bba58cff-7f0d-4e28-b867-7ca1de7a8649','name','gtovexploit.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783894466836-w29nwa0850g.png','image_type','visual_detail','order_index',1),
        jsonb_build_object('id','daa8cde3-67ab-4345-aaa9-da837cfe757c','name','J8o river range.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783895700547-7r0uwkfu4q3.png','image_type','evidence','order_index',2),
        jsonb_build_object('id','15e0d006-7686-4c3d-a48a-b7d05de19213','name','rivercallingrange.jpg','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783895861307-uh16h2nlr8.jpg','image_type','evidence','order_index',3)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783893969591-0zb7alha9un.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783894466836-w29nwa0850g.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-3','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783895700547-7r0uwkfu4q3.png','caption','River range','type','evidence'),
    jsonb_build_object('id','vd-4','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/bcfcdf23-db46-4655-8e4f-272dab474c16/1783895861307-uh16h2nlr8.jpg','caption','River calling range','type','evidence')
  )
) ON CONFLICT (id) DO NOTHING;

-- 1cc16b8b: WSOP Retro: Destined for Greatness?
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '1cc16b8b-02cc-41e8-b200-c9bd09d51387',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'WSOP Retro: Destined for Greatness?', 'Analyzing 2010 Play Through a GTO Lens',
  'With just 15 players remaining in the 2010 WSOP Main Event, every decision carried millions of dollars in equity. What followed between Jonathan Duhamel and Matt Affleck became one of the most iconic—and heartbreaking—hands in poker history.',
  'Hero: JdJc | Villain: AsAc | Stack: 80bb | Board: Td9c7h Qd 8d',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921614624-e321dt97mxs.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921882654-jbu6my8oflr.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921883309-jocwcrqwv1a.png'],
  jsonb_build_object('legacy_v1_spot_id','1cc16b8b-02cc-41e8-b200-c9bd09d51387','difficulty','easy','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Turn','pot_type','4BP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','JdJc','hero_position','CO','villain_position','BTN','villain_hand','AsAc','effective_stack',80,'tournament_type','Late Stage','flop','["Td","9c","7h"]','turn','Qd','river','8d','tags','["MTT","Final Table","4BP","GTO","ICM","Turn","CO","BTN"]','difficulty','easy','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-13T06:09:21.5+00:00'::timestamptz, '2026-07-13T05:08:46.521568+00:00'::timestamptz, '2026-07-13T06:09:12.37+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','Jonathan Duhamel (CO) opens with JJ. Matt Affleck (BTN) 3-bets with AA. Duhamel 4-bets, Affleck calls. Flop Td9c7h: Duhamel checks, Affleck continuation bets, Duhamel calls. Turn Qd: Duhamel checks, Affleck moves all-in, Duhamel calls. River 8d completes Duhamel''s straight.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','From a purely theoretical perspective, the call is extremely uncomfortable. Against a range consisting primarily of AA, KK, QQ, and occasionally AK, JJ is in rough shape. Sunk-cost fallacy doesn''t just exist in business — it exists in poker, too. By the turn, Duhamel had already invested over ten million chips. The only question that matters is whether calling 11.5 million to win the final pot is profitable. The river simply determines which story history remembers.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','567963c9-815e-416d-b950-c6a583fc229f','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','875c72ce-d1c8-4878-8bd3-d77a7ba0a833','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','70009683-6797-4534-9d2a-d84bec2ec93a','name','duhamelaffleck.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921614624-e321dt97mxs.png','image_type','visual_detail','order_index',0),
        jsonb_build_object('id','76417b9f-de5b-49d9-ba71-dd8ae1b7e733','name','Duhame BTN range.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921882654-jbu6my8oflr.png','image_type','evidence','order_index',1),
        jsonb_build_object('id','cb06af03-dece-4ac6-b860-f7b37b804e39','name','Affleck Facing 5b.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921883309-jocwcrqwv1a.png','image_type','evidence','order_index',2)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921614624-e321dt97mxs.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921882654-jbu6my8oflr.png','caption','Duhamel''s option v BTN 3b','type','evidence'),
    jsonb_build_object('id','vd-3','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/1cc16b8b-02cc-41e8-b200-c9bd09d51387/1783921883309-jocwcrqwv1a.png','caption','Affleck''s range facing CO 4b','type','evidence')
  )
) ON CONFLICT (id) DO NOTHING;

-- b256c0da: WSOP 2026: Each Street Is a New Battle
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  'b256c0da-90f3-49de-a7fa-e5cdaf36265e',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'WSOP 2026: Each Street Is a New Battle', 'Every street demands a fresh evaluation.',
  'Watching the 2026 WSOP Main Event, one recurring theme has become impossible to ignore. Time and time again, players appear to anchor themselves to the strength of their preflop holding instead of reassessing its value as new community cards are dealt.',
  'Hero: JsJh | Villain: QsQc | Stack: 50bb | Board: As2s6d',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/b256c0da-90f3-49de-a7fa-e5cdaf36265e/1783956084893-lco2dtvtp2f.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/b256c0da-90f3-49de-a7fa-e5cdaf36265e/1783956965677-087ry7im5orj.png'],
  jsonb_build_object('legacy_v1_spot_id','b256c0da-90f3-49de-a7fa-e5cdaf36265e','difficulty','easy','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','Preflop','pot_type','4BP',
    'legacy_v1_metadata', jsonb_build_object('hero_hand','JsJh','hero_position','UTG+1','villain_position','SB','villain_hand','QsQc','effective_stack',50,'tournament_type','Middle Stage','flop','["As","2s","6d"]','tags','["MTT","Middle","4BP","Exploit","GTO","Bluff","ICM","Preflop","UTG"]','difficulty','easy','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-13T15:58:02.621+00:00'::timestamptz, '2026-07-13T15:21:25.098079+00:00'::timestamptz, '2026-07-16T16:56:55.317+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','Sannier opens UTG+1 holding JJ. Guilbeau finds QQ in the Small Blind and 3-bets. Sannier responds with a small 4-bet. Guilbeau elects to flat call. Flop As6d2s: Guilbeau checks, Sannier bets, Guilbeau check-raises, Sannier moves all-in, Guilbeau folds QQ.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','Every street creates a brand new game with new equities, new ranges, and new incentives. Have a plan before you put chips into the pot. Before 3-betting from the small blind with 55 big blinds, Guilbeau should already know his response to every reasonable 4-bet. The best tournament players don''t survive because they refuse to fold big pairs — they survive because they''re willing to forget what their hand used to be.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','4fe29e98-621c-4512-b32a-a4153d6ac52e','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','f469eb12-19ee-4e4c-b2d7-a6c293528ef9','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','de7ff0f9-bdc2-4301-9307-28a69d83b3e8','name','bananas.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/b256c0da-90f3-49de-a7fa-e5cdaf36265e/1783956084893-lco2dtvtp2f.png','image_type','visual_detail','order_index',0),
        jsonb_build_object('id','eebd2a15-a588-43c2-8bfc-3325f6661da9','name','stalinggrad.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/b256c0da-90f3-49de-a7fa-e5cdaf36265e/1783956965677-087ry7im5orj.png','image_type','visual_detail','order_index',1)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/b256c0da-90f3-49de-a7fa-e5cdaf36265e/1783956084893-lco2dtvtp2f.png','caption',NULL,'type','visual_detail'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/b256c0da-90f3-49de-a7fa-e5cdaf36265e/1783956965677-087ry7im5orj.png','caption',NULL,'type','visual_detail')
  )
) ON CONFLICT (id) DO NOTHING;

-- 2472ed54: You Aren't Bluffing Enough
INSERT INTO content_spots (id, account_id, creator_name, status, source, title, subtitle, introduction, hand_details, image_urls, tags, is_monetized, price_credits, show_in_courses, quiz, published_at, created_at, updated_at, spot_type, content_blocks, work_pack_stages, visual_details)
VALUES (
  '2472ed54-76a0-4c06-a9fd-1ffdb6148615',
  '17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', 'published', 'spotvault_v1',
  'You Aren''t Bluffing Enough', 'The mathematics behind profitable bluffing',
  'Every player understands the importance of value betting, but many overlook the money left behind by not bluffing often enough. This simple example shows why a balanced strategy of value bets and well-selected bluffs consistently outperforms a value-only approach.',
  'Stack: ChipEV | Board: Tc4h2d 9s 7c',
  ARRAY['https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/2472ed54-76a0-4c06-a9fd-1ffdb6148615/1784306048456-b9pehqsng1m.png','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/2472ed54-76a0-4c06-a9fd-1ffdb6148615/1784306564586-8xvo5dc5fjp.png'],
  jsonb_build_object('legacy_v1_spot_id','2472ed54-76a0-4c06-a9fd-1ffdb6148615','difficulty','medium','content_type','solver_spot','game_format','mtt','source','GTO Wizard','street','River','pot_type','SRP',
    'legacy_v1_metadata', jsonb_build_object('effective_stack',NULL,'tournament_type','ChipEV','tags','["MTT","Early","Middle","Bubble","Final Table","Heads Up","SRP","Cbet","Overbet","Bluff","GTO","ChipEV","ICM","PKO","Preflop","Flop","Turn","River","BB","UTG","HJ","CO","BTN","SB"]','difficulty','medium','content_type','solver_spot','game_format','mtt','source_original','GTO Wizard','confidence_level','medium','does_generalize',true,'owner_email','jordanmcallister12@hotmail.com')
  ),
  false, 0, false, NULL,
  '2026-07-17T16:44:23.22+00:00'::timestamptz, '2026-07-17T15:59:43.923959+00:00'::timestamptz, '2026-07-17T16:44:16.207+00:00'::timestamptz,
  'work_pack',
  jsonb_build_array(
    jsonb_build_object('id','cb-1','type','paragraph','text','You defend the big blind with 5s6d against a late-position open. The flop comes Tc4h2d, you check, and call a 2.3 BB continuation bet. The turn is the 9s, both players check, and the river brings the 7c — leaving you at the absolute bottom of your range with no showdown value. The pot is now 9.9 BB. Bluffing 6.6 BB (two-thirds pot) means your opponent only needs to fold 40% of the time for the bluff to break even.'),
    jsonb_build_object('id','cb-2','type','heading','text','Why It Matters'),
    jsonb_build_object('id','cb-3','type','paragraph','text','By the river, 56o has no showdown value whatsoever. If you check, you''re almost never winning the pot. That immediately shifts the question from "Should I bluff?" to "Can I bluff profitably?" The profitability of the bluff isn''t determined by your cards — it''s determined by how often your opponent folds. River bluffing isn''t about courage — it''s about recognizing when fold equity is worth more than showdown value.')
  ),
  jsonb_build_array(jsonb_build_object('id','stage-v1-legacy','title','Legacy V1 Solver Data','blocks','[]'::jsonb,
    '_legacy_v1', jsonb_build_object(
      'spot_nodes', jsonb_build_array(
        jsonb_build_object('id','0f189fc3-b7ff-4404-a09a-47c872823c9c','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb),
        jsonb_build_object('id','d679b367-014a-49dd-b7e7-5fedec2e883d','street','flop','label','Flop Root','hero_grid_data','{}'::jsonb,'villain_grid_data','{}'::jsonb,'analytics','{}'::jsonb)
      ),
      'spot_ranges','[]'::jsonb,'range_grids','[]'::jsonb,
      'insight_images', jsonb_build_array(
        jsonb_build_object('id','92af5add-9e5c-4809-bc2c-490d9edea70f','name','56o river range.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/2472ed54-76a0-4c06-a9fd-1ffdb6148615/1784306048456-b9pehqsng1m.png','image_type','evidence','order_index',1),
        jsonb_build_object('id','cdea0fc0-e2e3-42f5-a783-46fc0a105c90','name','bluffin3.0.png','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/2472ed54-76a0-4c06-a9fd-1ffdb6148615/1784306564586-8xvo5dc5fjp.png','image_type','visual_detail','order_index',1)
      )
    )
  )),
  jsonb_build_array(
    jsonb_build_object('id','vd-1','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/2472ed54-76a0-4c06-a9fd-1ffdb6148615/1784306048456-b9pehqsng1m.png','caption','BB river range','type','evidence'),
    jsonb_build_object('id','vd-2','url','https://jjiofdiplgefvawknpnh.supabase.co/storage/v1/object/public/insight-images/2472ed54-76a0-4c06-a9fd-1ffdb6148615/1784306564586-8xvo5dc5fjp.png','caption',NULL,'type','visual_detail')
  )
) ON CONFLICT (id) DO NOTHING;