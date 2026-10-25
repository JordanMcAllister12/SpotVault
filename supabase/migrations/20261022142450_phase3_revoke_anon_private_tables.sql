-- Phase 3: Revoke anon access on 42 high-risk tables containing private user data
-- These tables have USING(true) policies accessible to anon, exposing private data
-- (coaching sessions, bookings, hand records, messages, homework, business CRM, etc.)
-- Revoking anon privileges locks them down. Authenticated users retain access via existing policies.

REVOKE SELECT, INSERT, UPDATE, DELETE ON ai_assist_usage FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON analytics_snapshots FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON booking_time_slots FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON bookings FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_ad_requests FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_contacts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_crm_ad_requests FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_crm_campaigns FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_crm_deals FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_files FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_pitch_attachments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON business_pitches FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_progress_comments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_progress_images FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_progress_profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_progress_snapshots FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_progress_targets FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_recordings FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_session_events FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_session_hands FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_session_notes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_session_participants FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_session_summaries FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_session_usage FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_sessions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON coaching_transcripts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON import_batches FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON jukebox_drafts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON jukebox_hand_analysis FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON jukebox_product_hands FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON jukebox_progress FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON jukebox_purchases FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON poker_analytics_snapshots FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON poker_hand_records FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON poker_import_batches FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON student_homework FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON sv_saved_community_posts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON sv_saved_post_tags FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON system_messages FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON user_inbox_conversations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON user_inbox_messages FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON user_saved_spots FROM anon;
