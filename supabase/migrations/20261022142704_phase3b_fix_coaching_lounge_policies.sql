-- Phase 3b: Fix coaching session table policies to be participant-scoped
-- These tables previously had USING(true) allowing any user to see/modify any session

-- ========== coaching_sessions ==========
DROP POLICY IF EXISTS "anon_select_coaching_sessions" ON coaching_sessions;
CREATE POLICY "session_select_participant" ON coaching_sessions FOR SELECT TO authenticated
  USING (auth.uid()::text = coach_id OR auth.uid()::text = student_id);

-- ========== coaching_session_notes ==========
DROP POLICY IF EXISTS "anon_select_coaching_notes" ON coaching_session_notes;
CREATE POLICY "notes_select_participant" ON coaching_session_notes FOR SELECT TO authenticated
  USING (
    auth.uid()::text = author_id
    OR EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_session_events ==========
DROP POLICY IF EXISTS "anon_select_coaching_events" ON coaching_session_events;
CREATE POLICY "events_select_participant" ON coaching_session_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_session_hands ==========
DROP POLICY IF EXISTS "anon_select_coaching_hands" ON coaching_session_hands;
CREATE POLICY "hands_select_participant" ON coaching_session_hands FOR SELECT TO authenticated
  USING (
    auth.uid()::text = marked_by
    OR EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_session_participants ==========
DROP POLICY IF EXISTS "anon_select_coaching_participants" ON coaching_session_participants;
CREATE POLICY "parts_select_participant" ON coaching_session_participants FOR SELECT TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_session_summaries ==========
DROP POLICY IF EXISTS "anon_select_coaching_summaries" ON coaching_session_summaries;
CREATE POLICY "summ_select_participant" ON coaching_session_summaries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_session_usage ==========
DROP POLICY IF EXISTS "anon_select_coaching_usage" ON coaching_session_usage;
CREATE POLICY "usage_select_participant" ON coaching_session_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_transcripts ==========
DROP POLICY IF EXISTS "anon_select_coaching_transcripts" ON coaching_transcripts;
CREATE POLICY "transcript_select_participant" ON coaching_transcripts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_recordings ==========
DROP POLICY IF EXISTS "anon_select_coaching_recordings" ON coaching_recordings;
CREATE POLICY "rec_select_participant" ON coaching_recordings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_sessions s
      WHERE s.id = session_id
      AND (s.coach_id = auth.uid()::text OR s.student_id = auth.uid()::text)
    )
  );

-- ========== coaching_progress_profiles ==========
DROP POLICY IF EXISTS "anon_select_progress_profiles" ON coaching_progress_profiles;
CREATE POLICY "progress_prof_select_own" ON coaching_progress_profiles FOR SELECT TO authenticated
  USING (auth.uid()::text = player_id OR auth.uid()::text = coach_id);

-- ========== coaching_progress_comments ==========
DROP POLICY IF EXISTS "anon_select_progress_comments" ON coaching_progress_comments;
CREATE POLICY "progress_comm_select_own" ON coaching_progress_comments FOR SELECT TO authenticated
  USING (auth.uid()::text = author_id);

-- ========== coaching_progress_targets ==========
DROP POLICY IF EXISTS "anon_select_progress_targets" ON coaching_progress_targets;
CREATE POLICY "progress_tgt_select_own" ON coaching_progress_targets FOR SELECT TO authenticated
  USING (auth.uid()::text = coach_id);

-- ========== coaching_progress_snapshots ==========
DROP POLICY IF EXISTS "anon_select_progress_snapshots" ON coaching_progress_snapshots;
CREATE POLICY "progress_snap_select_own" ON coaching_progress_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_progress_profiles p
      WHERE p.id = profile_id
      AND (p.player_id = auth.uid()::text OR p.coach_id = auth.uid()::text)
    )
  );

-- ========== coaching_progress_images ==========
DROP POLICY IF EXISTS "anon_select_progress_images" ON coaching_progress_images;
CREATE POLICY "progress_img_select_own" ON coaching_progress_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaching_progress_snapshots s
      JOIN coaching_progress_profiles p ON p.id = s.profile_id
      WHERE s.id = snapshot_id
      AND (p.player_id = auth.uid()::text OR p.coach_id = auth.uid()::text)
    )
  );

-- ========== lounge_moderation_logs ==========
-- Keep readable to lounge admins only
DROP POLICY IF EXISTS "anon_read_lounge_mod_logs" ON lounge_moderation_logs;
CREATE POLICY "modlog_select_own" ON lounge_moderation_logs FOR SELECT TO authenticated
  USING (auth.uid() = moderator_id);
