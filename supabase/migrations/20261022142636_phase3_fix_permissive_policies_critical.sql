-- Phase 3: Replace permissive USING(true) policies with ownership-based policies
-- on the most critical privacy tables. Any authenticated user could previously
-- read/modify/delete any other user's data on these tables.

-- ========== user_inbox_conversations ==========
DROP POLICY IF EXISTS "anon_select_conv" ON user_inbox_conversations;
DROP POLICY IF EXISTS "anon_insert_conv" ON user_inbox_conversations;
DROP POLICY IF EXISTS "anon_update_conv" ON user_inbox_conversations;
DROP POLICY IF EXISTS "anon_delete_conv" ON user_inbox_conversations;
CREATE POLICY "conv_select_own" ON user_inbox_conversations FOR SELECT TO authenticated
  USING (auth.uid()::text = participant_a_id OR auth.uid()::text = participant_b_id);
CREATE POLICY "conv_insert_own" ON user_inbox_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = participant_a_id OR auth.uid()::text = participant_b_id);
CREATE POLICY "conv_update_own" ON user_inbox_conversations FOR UPDATE TO authenticated
  USING (auth.uid()::text = participant_a_id OR auth.uid()::text = participant_b_id)
  WITH CHECK (auth.uid()::text = participant_a_id OR auth.uid()::text = participant_b_id);
CREATE POLICY "conv_delete_own" ON user_inbox_conversations FOR DELETE TO authenticated
  USING (auth.uid()::text = participant_a_id OR auth.uid()::text = participant_b_id);

-- ========== user_inbox_messages ==========
DROP POLICY IF EXISTS "anon_select_msgs" ON user_inbox_messages;
DROP POLICY IF EXISTS "anon_insert_msgs" ON user_inbox_messages;
DROP POLICY IF EXISTS "anon_update_msgs" ON user_inbox_messages;
DROP POLICY IF EXISTS "anon_delete_msgs" ON user_inbox_messages;
CREATE POLICY "msg_select_own" ON user_inbox_messages FOR SELECT TO authenticated
  USING (auth.uid()::text = sender_id OR EXISTS (
    SELECT 1 FROM user_inbox_conversations c
    WHERE c.id = conversation_id
    AND (c.participant_a_id = auth.uid()::text OR c.participant_b_id = auth.uid()::text)
  ));
CREATE POLICY "msg_insert_own" ON user_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = sender_id);
CREATE POLICY "msg_update_own" ON user_inbox_messages FOR UPDATE TO authenticated
  USING (auth.uid()::text = sender_id);
CREATE POLICY "msg_delete_own" ON user_inbox_messages FOR DELETE TO authenticated
  USING (auth.uid()::text = sender_id);

-- ========== system_messages ==========
DROP POLICY IF EXISTS "select_own_system_messages" ON system_messages;
CREATE POLICY "select_own_system_messages" ON system_messages FOR SELECT TO authenticated
  USING (auth.uid()::text = recipient_user_id);

-- ========== bookings ==========
DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_delete_bookings" ON bookings;
CREATE POLICY "booking_select_own" ON bookings FOR SELECT TO authenticated
  USING (auth.uid()::text = provider_account_id OR auth.uid()::text = requester_account_id);
CREATE POLICY "booking_insert_own" ON bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = provider_account_id OR auth.uid()::text = requester_account_id);
CREATE POLICY "booking_update_own" ON bookings FOR UPDATE TO authenticated
  USING (auth.uid()::text = provider_account_id OR auth.uid()::text = requester_account_id)
  WITH CHECK (auth.uid()::text = provider_account_id OR auth.uid()::text = requester_account_id);
CREATE POLICY "booking_delete_own" ON bookings FOR DELETE TO authenticated
  USING (auth.uid()::text = provider_account_id OR auth.uid()::text = requester_account_id);

-- ========== ai_assist_usage ==========
DROP POLICY IF EXISTS "select_ai_usage" ON ai_assist_usage;
DROP POLICY IF EXISTS "insert_ai_usage" ON ai_assist_usage;
CREATE POLICY "ai_usage_select_own" ON ai_assist_usage FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);
CREATE POLICY "ai_usage_insert_own" ON ai_assist_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- ========== analytics_snapshots ==========
DROP POLICY IF EXISTS "anon_select_snapshots" ON analytics_snapshots;
DROP POLICY IF EXISTS "anon_insert_snapshots" ON analytics_snapshots;
DROP POLICY IF EXISTS "anon_update_snapshots" ON analytics_snapshots;
DROP POLICY IF EXISTS "anon_delete_snapshots" ON analytics_snapshots;
CREATE POLICY "snap_select_own" ON analytics_snapshots FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "snap_insert_own" ON analytics_snapshots FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "snap_update_own" ON analytics_snapshots FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "snap_delete_own" ON analytics_snapshots FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== business_crm_deals ==========
DROP POLICY IF EXISTS "anon_select_crm_deals" ON business_crm_deals;
DROP POLICY IF EXISTS "anon_insert_crm_deals" ON business_crm_deals;
DROP POLICY IF EXISTS "anon_update_crm_deals" ON business_crm_deals;
DROP POLICY IF EXISTS "anon_delete_crm_deals" ON business_crm_deals;
CREATE POLICY "crm_deals_select_own" ON business_crm_deals FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "crm_deals_insert_own" ON business_crm_deals FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "crm_deals_update_own" ON business_crm_deals FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "crm_deals_delete_own" ON business_crm_deals FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== business_crm_campaigns ==========
DROP POLICY IF EXISTS "anon_select_crm_campaigns" ON business_crm_campaigns;
DROP POLICY IF EXISTS "anon_insert_crm_campaigns" ON business_crm_campaigns;
DROP POLICY IF EXISTS "anon_update_crm_campaigns" ON business_crm_campaigns;
DROP POLICY IF EXISTS "anon_delete_crm_campaigns" ON business_crm_campaigns;
CREATE POLICY "crm_camp_select_own" ON business_crm_campaigns FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "crm_camp_insert_own" ON business_crm_campaigns FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "crm_camp_update_own" ON business_crm_campaigns FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "crm_camp_delete_own" ON business_crm_campaigns FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== business_crm_ad_requests ==========
DROP POLICY IF EXISTS "anon_select_crm_ad_requests" ON business_crm_ad_requests;
DROP POLICY IF EXISTS "anon_insert_crm_ad_requests" ON business_crm_ad_requests;
DROP POLICY IF EXISTS "anon_update_crm_ad_requests" ON business_crm_ad_requests;
DROP POLICY IF EXISTS "anon_delete_crm_ad_requests" ON business_crm_ad_requests;
CREATE POLICY "crm_ad_select_own" ON business_crm_ad_requests FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "crm_ad_insert_own" ON business_crm_ad_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "crm_ad_update_own" ON business_crm_ad_requests FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "crm_ad_delete_own" ON business_crm_ad_requests FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== business_files ==========
DROP POLICY IF EXISTS "anon_select_business_files" ON business_files;
DROP POLICY IF EXISTS "anon_insert_business_files" ON business_files;
DROP POLICY IF EXISTS "anon_update_business_files" ON business_files;
DROP POLICY IF EXISTS "anon_delete_business_files" ON business_files;
CREATE POLICY "files_select_own" ON business_files FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "files_insert_own" ON business_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "files_update_own" ON business_files FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "files_delete_own" ON business_files FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== business_contacts ==========
DROP POLICY IF EXISTS "anon_select_business_contacts" ON business_contacts;
DROP POLICY IF EXISTS "anon_insert_business_contacts" ON business_contacts;
DROP POLICY IF EXISTS "anon_update_business_contacts" ON business_contacts;
DROP POLICY IF EXISTS "anon_delete_business_contacts" ON business_contacts;
CREATE POLICY "contacts_select_own" ON business_contacts FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);
CREATE POLICY "contacts_insert_own" ON business_contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "contacts_update_own" ON business_contacts FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "contacts_delete_own" ON business_contacts FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== business_ad_requests ==========
DROP POLICY IF EXISTS "anon_select_ad_requests" ON business_ad_requests;
DROP POLICY IF EXISTS "anon_insert_ad_requests" ON business_ad_requests;
DROP POLICY IF EXISTS "anon_update_ad_requests" ON business_ad_requests;
DROP POLICY IF EXISTS "anon_delete_ad_requests" ON business_ad_requests;
CREATE POLICY "ad_req_select_own" ON business_ad_requests FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "ad_req_insert_own" ON business_ad_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "ad_req_update_own" ON business_ad_requests FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "ad_req_delete_own" ON business_ad_requests FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== business_pitches ==========
DROP POLICY IF EXISTS "anon_select_business_pitches" ON business_pitches;
DROP POLICY IF EXISTS "anon_insert_business_pitches" ON business_pitches;
DROP POLICY IF EXISTS "anon_update_business_pitches" ON business_pitches;
DROP POLICY IF EXISTS "anon_delete_business_pitches" ON business_pitches;
CREATE POLICY "pitch_select_own" ON business_pitches FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);
CREATE POLICY "pitch_insert_own" ON business_pitches FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "pitch_update_own" ON business_pitches FOR UPDATE TO authenticated
  USING (auth.uid()::text = account_id)
  WITH CHECK (auth.uid()::text = account_id);
CREATE POLICY "pitch_delete_own" ON business_pitches FOR DELETE TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== student_homework ==========
DROP POLICY IF EXISTS "anon_select_homework" ON student_homework;
CREATE POLICY "homework_select_own" ON student_homework FOR SELECT TO authenticated
  USING (auth.uid()::text = student_account_id);

-- ========== import_batches ==========
DROP POLICY IF EXISTS "anon_select_imports" ON import_batches;
CREATE POLICY "imports_select_own" ON import_batches FOR SELECT TO authenticated
  USING (auth.uid()::text = account_id);

-- ========== poker_hand_records ==========
DROP POLICY IF EXISTS "anon_select_poker_hand_records" ON poker_hand_records;
CREATE POLICY "hand_records_select_own" ON poker_hand_records FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== poker_import_batches ==========
DROP POLICY IF EXISTS "anon_select_poker_import_batches" ON poker_import_batches;
CREATE POLICY "poker_imports_select_own" ON poker_import_batches FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== user_saved_spots ==========
DROP POLICY IF EXISTS "select_own_saved_spots" ON user_saved_spots;
CREATE POLICY "select_own_saved_spots" ON user_saved_spots FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== sv_saved_community_posts ==========
DROP POLICY IF EXISTS "select_own_saved_posts" ON sv_saved_community_posts;
CREATE POLICY "select_own_saved_posts" ON sv_saved_community_posts FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== sv_saved_post_tags ==========
DROP POLICY IF EXISTS "select_own_saved_tags" ON sv_saved_post_tags;
CREATE POLICY "select_own_saved_tags" ON sv_saved_post_tags FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== jukebox_progress ==========
DROP POLICY IF EXISTS "read_own_progress" ON jukebox_progress;
CREATE POLICY "read_own_progress" ON jukebox_progress FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ========== jukebox_purchases ==========
DROP POLICY IF EXISTS "read_own_purchases" ON jukebox_purchases;
CREATE POLICY "read_own_purchases" ON jukebox_purchases FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);
