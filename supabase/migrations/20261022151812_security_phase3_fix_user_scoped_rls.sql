/*
# Security Phase 3: Fix permissive RLS on user-scoped tables

## Summary
Replaces `USING(true)` / `WITH CHECK(true)` policies with proper ownership checks
on 32 user-scoped tables that currently allow any authenticated user to read,
modify, or delete any other user's data.

## Tables fixed (grouped by ownership pattern)

### UUID user_id tables (auth.uid() = user_id)
- business_campaigns (user_id uuid)
- business_deals (user_id uuid)
- paid_request_settings (user_id uuid)
- player_accolades (user_id uuid)
- sv_spr_scores (user_id uuid)
- sv_staff_metadata (user_id uuid) — staff-only, gated via sv_is_staff_or_admin()
- sv_staff_organizations (user_id uuid) — staff-only
- sv_staff_tag_assignments (user_id uuid) — staff-only

### TEXT user_id tables (auth.uid()::text = user_id)
- coaching_progress_comments (author_id text)
- coaching_progress_profiles (player_id text, coach_id text) — both can access
- coaching_progress_targets (coach_id text)
- coaching_session_notes (author_id text)
- coaching_session_participants (user_id text)
- coaching_sessions (coach_id text, student_id text) — both can access
- featured_profile_items (user_id text)
- jukebox_progress (user_id text)
- network_chat_boosts (user_id text)
- network_chat_reactions (user_id text)
- poker_analytics_snapshots (user_id text)
- poker_hand_records (user_id text)
- poker_import_batches (user_id text)
- poker_scene_player_reports (user_id text)
- poker_scene_reactions (user_id text)
- poker_scene_shoutouts (user_id text)
- profile_accomplishments (user_id text)
- spot_comment_likes (user_id text)
- sv_saved_community_posts (user_id text)
- sv_saved_post_tags (user_id text)
- sv_svi_honors (user_id text)
- user_profiles (user_id text)
- user_saved_spots (user_id text)
- accomplishment_reviews (reviewer_id text)

## Security changes
- Each table gets 4 CRUD policies scoped to the owner via auth.uid() comparison
- Staff-only tables (sv_staff_*) use sv_is_staff_or_admin() gate instead of ownership
- coaching_sessions and coaching_progress_profiles allow both coach and student access
- All policies use DROP POLICY IF EXISTS first for idempotency
- Grants remain unchanged (already granted to authenticated/anon as appropriate)
*/

-- ── UUID user_id tables ─────────────────────────────────────────────────────

-- business_campaigns
DROP POLICY IF EXISTS "business_campaigns_select" ON business_campaigns;
DROP POLICY IF EXISTS "business_campaigns_insert" ON business_campaigns;
DROP POLICY IF EXISTS "business_campaigns_update" ON business_campaigns;
DROP POLICY IF EXISTS "business_campaigns_delete" ON business_campaigns;
CREATE POLICY "business_campaigns_select" ON business_campaigns FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "business_campaigns_insert" ON business_campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "business_campaigns_update" ON business_campaigns FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "business_campaigns_delete" ON business_campaigns FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- business_deals
DROP POLICY IF EXISTS "business_deals_select" ON business_deals;
DROP POLICY IF EXISTS "business_deals_insert" ON business_deals;
DROP POLICY IF EXISTS "business_deals_update" ON business_deals;
DROP POLICY IF EXISTS "business_deals_delete" ON business_deals;
CREATE POLICY "business_deals_select" ON business_deals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "business_deals_insert" ON business_deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "business_deals_update" ON business_deals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "business_deals_delete" ON business_deals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- paid_request_settings
DROP POLICY IF EXISTS "paid_request_settings_select" ON paid_request_settings;
DROP POLICY IF EXISTS "paid_request_settings_insert" ON paid_request_settings;
DROP POLICY IF EXISTS "paid_request_settings_update" ON paid_request_settings;
DROP POLICY IF EXISTS "paid_request_settings_delete" ON paid_request_settings;
CREATE POLICY "paid_request_settings_select" ON paid_request_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "paid_request_settings_insert" ON paid_request_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paid_request_settings_update" ON paid_request_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paid_request_settings_delete" ON paid_request_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- player_accolades
DROP POLICY IF EXISTS "player_accolades_select" ON player_accolades;
DROP POLICY IF EXISTS "player_accolades_insert" ON player_accolades;
DROP POLICY IF EXISTS "player_accolades_update" ON player_accolades;
DROP POLICY IF EXISTS "player_accolades_delete" ON player_accolades;
CREATE POLICY "player_accolades_select" ON player_accolades FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "player_accolades_insert" ON player_accolades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "player_accolades_update" ON player_accolades FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "player_accolades_delete" ON player_accolades FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sv_spr_scores
DROP POLICY IF EXISTS "sv_spr_scores_select" ON sv_spr_scores;
DROP POLICY IF EXISTS "sv_spr_scores_insert" ON sv_spr_scores;
DROP POLICY IF EXISTS "sv_spr_scores_update" ON sv_spr_scores;
DROP POLICY IF EXISTS "sv_spr_scores_delete" ON sv_spr_scores;
CREATE POLICY "sv_spr_scores_select" ON sv_spr_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_spr_scores_insert" ON sv_spr_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_spr_scores_update" ON sv_spr_scores FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_spr_scores_delete" ON sv_spr_scores FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Staff-only tables (sv_is_staff_or_admin gate) ───────────────────────────

-- sv_staff_metadata
DROP POLICY IF EXISTS "sv_staff_metadata_select" ON sv_staff_metadata;
DROP POLICY IF EXISTS "sv_staff_metadata_insert" ON sv_staff_metadata;
DROP POLICY IF EXISTS "sv_staff_metadata_update" ON sv_staff_metadata;
DROP POLICY IF EXISTS "sv_staff_metadata_delete" ON sv_staff_metadata;
CREATE POLICY "sv_staff_metadata_select" ON sv_staff_metadata FOR SELECT TO authenticated USING (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_metadata_insert" ON sv_staff_metadata FOR INSERT TO authenticated WITH CHECK (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_metadata_update" ON sv_staff_metadata FOR UPDATE TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_metadata_delete" ON sv_staff_metadata FOR DELETE TO authenticated USING (sv_is_staff_or_admin());

-- sv_staff_organizations
DROP POLICY IF EXISTS "sv_staff_organizations_select" ON sv_staff_organizations;
DROP POLICY IF EXISTS "sv_staff_organizations_insert" ON sv_staff_organizations;
DROP POLICY IF EXISTS "sv_staff_organizations_update" ON sv_staff_organizations;
DROP POLICY IF EXISTS "sv_staff_organizations_delete" ON sv_staff_organizations;
CREATE POLICY "sv_staff_organizations_select" ON sv_staff_organizations FOR SELECT TO authenticated USING (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_organizations_insert" ON sv_staff_organizations FOR INSERT TO authenticated WITH CHECK (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_organizations_update" ON sv_staff_organizations FOR UPDATE TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_organizations_delete" ON sv_staff_organizations FOR DELETE TO authenticated USING (sv_is_staff_or_admin());

-- sv_staff_tag_assignments
DROP POLICY IF EXISTS "sv_staff_tag_assignments_select" ON sv_staff_tag_assignments;
DROP POLICY IF EXISTS "sv_staff_tag_assignments_insert" ON sv_staff_tag_assignments;
DROP POLICY IF EXISTS "sv_staff_tag_assignments_update" ON sv_staff_tag_assignments;
DROP POLICY IF EXISTS "sv_staff_tag_assignments_delete" ON sv_staff_tag_assignments;
CREATE POLICY "sv_staff_tag_assignments_select" ON sv_staff_tag_assignments FOR SELECT TO authenticated USING (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_tag_assignments_insert" ON sv_staff_tag_assignments FOR INSERT TO authenticated WITH CHECK (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_tag_assignments_update" ON sv_staff_tag_assignments FOR UPDATE TO authenticated USING (sv_is_staff_or_admin()) WITH CHECK (sv_is_staff_or_admin());
CREATE POLICY "sv_staff_tag_assignments_delete" ON sv_staff_tag_assignments FOR DELETE TO authenticated USING (sv_is_staff_or_admin());

-- ── TEXT user_id tables (auth.uid()::text = user_id) ────────────────────────

-- coaching_progress_comments (author_id text)
DROP POLICY IF EXISTS "coaching_progress_comments_select" ON coaching_progress_comments;
DROP POLICY IF EXISTS "coaching_progress_comments_insert" ON coaching_progress_comments;
DROP POLICY IF EXISTS "coaching_progress_comments_update" ON coaching_progress_comments;
DROP POLICY IF EXISTS "coaching_progress_comments_delete" ON coaching_progress_comments;
CREATE POLICY "coaching_progress_comments_select" ON coaching_progress_comments FOR SELECT TO authenticated USING (auth.uid()::text = author_id);
CREATE POLICY "coaching_progress_comments_insert" ON coaching_progress_comments FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = author_id);
CREATE POLICY "coaching_progress_comments_update" ON coaching_progress_comments FOR UPDATE TO authenticated USING (auth.uid()::text = author_id) WITH CHECK (auth.uid()::text = author_id);
CREATE POLICY "coaching_progress_comments_delete" ON coaching_progress_comments FOR DELETE TO authenticated USING (auth.uid()::text = author_id);

-- coaching_progress_profiles (player_id text, coach_id text — both can access)
DROP POLICY IF EXISTS "coaching_progress_profiles_select" ON coaching_progress_profiles;
DROP POLICY IF EXISTS "coaching_progress_profiles_insert" ON coaching_progress_profiles;
DROP POLICY IF EXISTS "coaching_progress_profiles_update" ON coaching_progress_profiles;
DROP POLICY IF EXISTS "coaching_progress_profiles_delete" ON coaching_progress_profiles;
CREATE POLICY "coaching_progress_profiles_select" ON coaching_progress_profiles FOR SELECT TO authenticated USING (auth.uid()::text = player_id OR auth.uid()::text = coach_id);
CREATE POLICY "coaching_progress_profiles_insert" ON coaching_progress_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = player_id OR auth.uid()::text = coach_id);
CREATE POLICY "coaching_progress_profiles_update" ON coaching_progress_profiles FOR UPDATE TO authenticated USING (auth.uid()::text = player_id OR auth.uid()::text = coach_id) WITH CHECK (auth.uid()::text = player_id OR auth.uid()::text = coach_id);
CREATE POLICY "coaching_progress_profiles_delete" ON coaching_progress_profiles FOR DELETE TO authenticated USING (auth.uid()::text = coach_id);

-- coaching_progress_targets (coach_id text)
DROP POLICY IF EXISTS "coaching_progress_targets_select" ON coaching_progress_targets;
DROP POLICY IF EXISTS "coaching_progress_targets_insert" ON coaching_progress_targets;
DROP POLICY IF EXISTS "coaching_progress_targets_update" ON coaching_progress_targets;
DROP POLICY IF EXISTS "coaching_progress_targets_delete" ON coaching_progress_targets;
CREATE POLICY "coaching_progress_targets_select" ON coaching_progress_targets FOR SELECT TO authenticated USING (auth.uid()::text = coach_id);
CREATE POLICY "coaching_progress_targets_insert" ON coaching_progress_targets FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = coach_id);
CREATE POLICY "coaching_progress_targets_update" ON coaching_progress_targets FOR UPDATE TO authenticated USING (auth.uid()::text = coach_id) WITH CHECK (auth.uid()::text = coach_id);
CREATE POLICY "coaching_progress_targets_delete" ON coaching_progress_targets FOR DELETE TO authenticated USING (auth.uid()::text = coach_id);

-- coaching_session_notes (author_id text)
DROP POLICY IF EXISTS "coaching_session_notes_select" ON coaching_session_notes;
DROP POLICY IF EXISTS "coaching_session_notes_insert" ON coaching_session_notes;
DROP POLICY IF EXISTS "coaching_session_notes_update" ON coaching_session_notes;
DROP POLICY IF EXISTS "coaching_session_notes_delete" ON coaching_session_notes;
CREATE POLICY "coaching_session_notes_select" ON coaching_session_notes FOR SELECT TO authenticated USING (auth.uid()::text = author_id);
CREATE POLICY "coaching_session_notes_insert" ON coaching_session_notes FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = author_id);
CREATE POLICY "coaching_session_notes_update" ON coaching_session_notes FOR UPDATE TO authenticated USING (auth.uid()::text = author_id) WITH CHECK (auth.uid()::text = author_id);
CREATE POLICY "coaching_session_notes_delete" ON coaching_session_notes FOR DELETE TO authenticated USING (auth.uid()::text = author_id);

-- coaching_session_participants (user_id text)
DROP POLICY IF EXISTS "coaching_session_participants_select" ON coaching_session_participants;
DROP POLICY IF EXISTS "coaching_session_participants_insert" ON coaching_session_participants;
DROP POLICY IF EXISTS "coaching_session_participants_update" ON coaching_session_participants;
DROP POLICY IF EXISTS "coaching_session_participants_delete" ON coaching_session_participants;
CREATE POLICY "coaching_session_participants_select" ON coaching_session_participants FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "coaching_session_participants_insert" ON coaching_session_participants FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "coaching_session_participants_update" ON coaching_session_participants FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "coaching_session_participants_delete" ON coaching_session_participants FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- coaching_sessions (coach_id text, student_id text — both can access)
DROP POLICY IF EXISTS "coaching_sessions_select" ON coaching_sessions;
DROP POLICY IF EXISTS "coaching_sessions_insert" ON coaching_sessions;
DROP POLICY IF EXISTS "coaching_sessions_update" ON coaching_sessions;
DROP POLICY IF EXISTS "coaching_sessions_delete" ON coaching_sessions;
CREATE POLICY "coaching_sessions_select" ON coaching_sessions FOR SELECT TO authenticated USING (auth.uid()::text = coach_id OR auth.uid()::text = student_id);
CREATE POLICY "coaching_sessions_insert" ON coaching_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = coach_id OR auth.uid()::text = student_id);
CREATE POLICY "coaching_sessions_update" ON coaching_sessions FOR UPDATE TO authenticated USING (auth.uid()::text = coach_id OR auth.uid()::text = student_id) WITH CHECK (auth.uid()::text = coach_id OR auth.uid()::text = student_id);
CREATE POLICY "coaching_sessions_delete" ON coaching_sessions FOR DELETE TO authenticated USING (auth.uid()::text = coach_id OR auth.uid()::text = student_id);

-- featured_profile_items (user_id text)
DROP POLICY IF EXISTS "featured_profile_items_select" ON featured_profile_items;
DROP POLICY IF EXISTS "featured_profile_items_insert" ON featured_profile_items;
DROP POLICY IF EXISTS "featured_profile_items_update" ON featured_profile_items;
DROP POLICY IF EXISTS "featured_profile_items_delete" ON featured_profile_items;
CREATE POLICY "featured_profile_items_select" ON featured_profile_items FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "featured_profile_items_insert" ON featured_profile_items FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "featured_profile_items_update" ON featured_profile_items FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "featured_profile_items_delete" ON featured_profile_items FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- jukebox_progress (user_id text)
DROP POLICY IF EXISTS "jukebox_progress_select" ON jukebox_progress;
DROP POLICY IF EXISTS "jukebox_progress_insert" ON jukebox_progress;
DROP POLICY IF EXISTS "jukebox_progress_update" ON jukebox_progress;
DROP POLICY IF EXISTS "jukebox_progress_delete" ON jukebox_progress;
CREATE POLICY "jukebox_progress_select" ON jukebox_progress FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "jukebox_progress_insert" ON jukebox_progress FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "jukebox_progress_update" ON jukebox_progress FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "jukebox_progress_delete" ON jukebox_progress FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- network_chat_boosts (user_id text)
DROP POLICY IF EXISTS "network_chat_boosts_select" ON network_chat_boosts;
DROP POLICY IF EXISTS "network_chat_boosts_insert" ON network_chat_boosts;
DROP POLICY IF EXISTS "network_chat_boosts_update" ON network_chat_boosts;
DROP POLICY IF EXISTS "network_chat_boosts_delete" ON network_chat_boosts;
CREATE POLICY "network_chat_boosts_select" ON network_chat_boosts FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "network_chat_boosts_insert" ON network_chat_boosts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "network_chat_boosts_update" ON network_chat_boosts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "network_chat_boosts_delete" ON network_chat_boosts FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- network_chat_reactions (user_id text)
DROP POLICY IF EXISTS "network_chat_reactions_select" ON network_chat_reactions;
DROP POLICY IF EXISTS "network_chat_reactions_insert" ON network_chat_reactions;
DROP POLICY IF EXISTS "network_chat_reactions_update" ON network_chat_reactions;
DROP POLICY IF EXISTS "network_chat_reactions_delete" ON network_chat_reactions;
CREATE POLICY "network_chat_reactions_select" ON network_chat_reactions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "network_chat_reactions_insert" ON network_chat_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "network_chat_reactions_update" ON network_chat_reactions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "network_chat_reactions_delete" ON network_chat_reactions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- poker_analytics_snapshots (user_id text)
DROP POLICY IF EXISTS "poker_analytics_snapshots_select" ON poker_analytics_snapshots;
DROP POLICY IF EXISTS "poker_analytics_snapshots_insert" ON poker_analytics_snapshots;
DROP POLICY IF EXISTS "poker_analytics_snapshots_update" ON poker_analytics_snapshots;
DROP POLICY IF EXISTS "poker_analytics_snapshots_delete" ON poker_analytics_snapshots;
CREATE POLICY "poker_analytics_snapshots_select" ON poker_analytics_snapshots FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "poker_analytics_snapshots_insert" ON poker_analytics_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_analytics_snapshots_update" ON poker_analytics_snapshots FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_analytics_snapshots_delete" ON poker_analytics_snapshots FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- poker_hand_records (user_id text)
DROP POLICY IF EXISTS "poker_hand_records_select" ON poker_hand_records;
DROP POLICY IF EXISTS "poker_hand_records_insert" ON poker_hand_records;
DROP POLICY IF EXISTS "poker_hand_records_update" ON poker_hand_records;
DROP POLICY IF EXISTS "poker_hand_records_delete" ON poker_hand_records;
CREATE POLICY "poker_hand_records_select" ON poker_hand_records FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "poker_hand_records_insert" ON poker_hand_records FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_hand_records_update" ON poker_hand_records FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_hand_records_delete" ON poker_hand_records FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- poker_import_batches (user_id text)
DROP POLICY IF EXISTS "poker_import_batches_select" ON poker_import_batches;
DROP POLICY IF EXISTS "poker_import_batches_insert" ON poker_import_batches;
DROP POLICY IF EXISTS "poker_import_batches_update" ON poker_import_batches;
DROP POLICY IF EXISTS "poker_import_batches_delete" ON poker_import_batches;
CREATE POLICY "poker_import_batches_select" ON poker_import_batches FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "poker_import_batches_insert" ON poker_import_batches FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_import_batches_update" ON poker_import_batches FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_import_batches_delete" ON poker_import_batches FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- poker_scene_player_reports (user_id text)
DROP POLICY IF EXISTS "poker_scene_player_reports_select" ON poker_scene_player_reports;
DROP POLICY IF EXISTS "poker_scene_player_reports_insert" ON poker_scene_player_reports;
DROP POLICY IF EXISTS "poker_scene_player_reports_update" ON poker_scene_player_reports;
DROP POLICY IF EXISTS "poker_scene_player_reports_delete" ON poker_scene_player_reports;
CREATE POLICY "poker_scene_player_reports_select" ON poker_scene_player_reports FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_player_reports_insert" ON poker_scene_player_reports FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_player_reports_update" ON poker_scene_player_reports FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_player_reports_delete" ON poker_scene_player_reports FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- poker_scene_reactions (user_id text)
DROP POLICY IF EXISTS "poker_scene_reactions_select" ON poker_scene_reactions;
DROP POLICY IF EXISTS "poker_scene_reactions_insert" ON poker_scene_reactions;
DROP POLICY IF EXISTS "poker_scene_reactions_update" ON poker_scene_reactions;
DROP POLICY IF EXISTS "poker_scene_reactions_delete" ON poker_scene_reactions;
CREATE POLICY "poker_scene_reactions_select" ON poker_scene_reactions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_reactions_insert" ON poker_scene_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_reactions_update" ON poker_scene_reactions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_reactions_delete" ON poker_scene_reactions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- poker_scene_shoutouts (user_id text)
DROP POLICY IF EXISTS "poker_scene_shoutouts_select" ON poker_scene_shoutouts;
DROP POLICY IF EXISTS "poker_scene_shoutouts_insert" ON poker_scene_shoutouts;
DROP POLICY IF EXISTS "poker_scene_shoutouts_update" ON poker_scene_shoutouts;
DROP POLICY IF EXISTS "poker_scene_shoutouts_delete" ON poker_scene_shoutouts;
CREATE POLICY "poker_scene_shoutouts_select" ON poker_scene_shoutouts FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_shoutouts_insert" ON poker_scene_shoutouts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_shoutouts_update" ON poker_scene_shoutouts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "poker_scene_shoutouts_delete" ON poker_scene_shoutouts FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- profile_accomplishments (user_id text)
DROP POLICY IF EXISTS "profile_accomplishments_select" ON profile_accomplishments;
DROP POLICY IF EXISTS "profile_accomplishments_insert" ON profile_accomplishments;
DROP POLICY IF EXISTS "profile_accomplishments_update" ON profile_accomplishments;
DROP POLICY IF EXISTS "profile_accomplishments_delete" ON profile_accomplishments;
CREATE POLICY "profile_accomplishments_select" ON profile_accomplishments FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "profile_accomplishments_insert" ON profile_accomplishments FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "profile_accomplishments_update" ON profile_accomplishments FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "profile_accomplishments_delete" ON profile_accomplishments FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- spot_comment_likes (user_id text)
DROP POLICY IF EXISTS "spot_comment_likes_select" ON spot_comment_likes;
DROP POLICY IF EXISTS "spot_comment_likes_insert" ON spot_comment_likes;
DROP POLICY IF EXISTS "spot_comment_likes_update" ON spot_comment_likes;
DROP POLICY IF EXISTS "spot_comment_likes_delete" ON spot_comment_likes;
CREATE POLICY "spot_comment_likes_select" ON spot_comment_likes FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "spot_comment_likes_insert" ON spot_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "spot_comment_likes_update" ON spot_comment_likes FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "spot_comment_likes_delete" ON spot_comment_likes FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- sv_saved_community_posts (user_id text)
DROP POLICY IF EXISTS "sv_saved_community_posts_select" ON sv_saved_community_posts;
DROP POLICY IF EXISTS "sv_saved_community_posts_insert" ON sv_saved_community_posts;
DROP POLICY IF EXISTS "sv_saved_community_posts_update" ON sv_saved_community_posts;
DROP POLICY IF EXISTS "sv_saved_community_posts_delete" ON sv_saved_community_posts;
CREATE POLICY "sv_saved_community_posts_select" ON sv_saved_community_posts FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "sv_saved_community_posts_insert" ON sv_saved_community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "sv_saved_community_posts_update" ON sv_saved_community_posts FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "sv_saved_community_posts_delete" ON sv_saved_community_posts FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- sv_saved_post_tags (user_id text)
DROP POLICY IF EXISTS "sv_saved_post_tags_select" ON sv_saved_post_tags;
DROP POLICY IF EXISTS "sv_saved_post_tags_insert" ON sv_saved_post_tags;
DROP POLICY IF EXISTS "sv_saved_post_tags_update" ON sv_saved_post_tags;
DROP POLICY IF EXISTS "sv_saved_post_tags_delete" ON sv_saved_post_tags;
CREATE POLICY "sv_saved_post_tags_select" ON sv_saved_post_tags FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "sv_saved_post_tags_insert" ON sv_saved_post_tags FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "sv_saved_post_tags_update" ON sv_saved_post_tags FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "sv_saved_post_tags_delete" ON sv_saved_post_tags FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- sv_svi_honors (user_id text)
DROP POLICY IF EXISTS "sv_svi_honors_select" ON sv_svi_honors;
DROP POLICY IF EXISTS "sv_svi_honors_insert" ON sv_svi_honors;
DROP POLICY IF EXISTS "sv_svi_honors_update" ON sv_svi_honors;
DROP POLICY IF EXISTS "sv_svi_honors_delete" ON sv_svi_honors;
CREATE POLICY "sv_svi_honors_select" ON sv_svi_honors FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "sv_svi_honors_insert" ON sv_svi_honors FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "sv_svi_honors_update" ON sv_svi_honors FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "sv_svi_honors_delete" ON sv_svi_honors FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- user_profiles (user_id text)
DROP POLICY IF EXISTS "user_profiles_select_self" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_self" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_self" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_self" ON user_profiles;
CREATE POLICY "user_profiles_select_self" ON user_profiles FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "user_profiles_insert_self" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "user_profiles_update_self" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "user_profiles_delete_self" ON user_profiles FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- user_saved_spots (user_id text)
DROP POLICY IF EXISTS "user_saved_spots_select" ON user_saved_spots;
DROP POLICY IF EXISTS "user_saved_spots_insert" ON user_saved_spots;
DROP POLICY IF EXISTS "user_saved_spots_update" ON user_saved_spots;
DROP POLICY IF EXISTS "user_saved_spots_delete" ON user_saved_spots;
CREATE POLICY "user_saved_spots_select" ON user_saved_spots FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "user_saved_spots_insert" ON user_saved_spots FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "user_saved_spots_update" ON user_saved_spots FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "user_saved_spots_delete" ON user_saved_spots FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- accomplishment_reviews (reviewer_id text)
DROP POLICY IF EXISTS "accomplishment_reviews_select" ON accomplishment_reviews;
DROP POLICY IF EXISTS "accomplishment_reviews_insert" ON accomplishment_reviews;
DROP POLICY IF EXISTS "accomplishment_reviews_update" ON accomplishment_reviews;
DROP POLICY IF EXISTS "accomplishment_reviews_delete" ON accomplishment_reviews;
CREATE POLICY "accomplishment_reviews_select" ON accomplishment_reviews FOR SELECT TO authenticated USING (auth.uid()::text = reviewer_id);
CREATE POLICY "accomplishment_reviews_insert" ON accomplishment_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = reviewer_id);
CREATE POLICY "accomplishment_reviews_update" ON accomplishment_reviews FOR UPDATE TO authenticated USING (auth.uid()::text = reviewer_id) WITH CHECK (auth.uid()::text = reviewer_id);
CREATE POLICY "accomplishment_reviews_delete" ON accomplishment_reviews FOR DELETE TO authenticated USING (auth.uid()::text = reviewer_id);