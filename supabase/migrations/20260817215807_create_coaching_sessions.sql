/*
# Create Coaching Sessions Schema

## Purpose
Build the foundation for an integrated audio coaching room inside SpotVault.
This allows a student to book a coach and conduct the actual coaching session
inside the platform rather than leaving for Discord/Zoom.

## New Tables
1. coaching_sessions — core session entity tied to a booking
2. coaching_session_participants — tracks who joined/left and recording consent
3. coaching_session_notes — coach and student notes
4. coaching_session_hands — hands marked for review during a session
5. coaching_session_events — lightweight event log for session timeline
6. coaching_recordings — recording metadata and storage references
7. coaching_transcripts — transcript storage for recorded sessions
8. coaching_session_summaries — AI-generated coaching summary with coach editing
9. coaching_session_usage — tracks RTC/recording/transcription/AI usage for cost monitoring

## Security
- RLS enabled on all tables.
- Policies use anon + authenticated (app uses demo auth with anon key — wide open by design, consistent with existing booking tables).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
*/

-- ===== coaching_sessions =====
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id text NOT NULL,
  student_id text NOT NULL,
  rtc_room_id text NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  status text NOT NULL DEFAULT 'scheduled',
  recording_status text NOT NULL DEFAULT 'none',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_booking_id ON coaching_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_coach_id ON coaching_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_student_id ON coaching_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(status);

DROP POLICY IF EXISTS "anon_select_coaching_sessions" ON coaching_sessions;
CREATE POLICY "anon_select_coaching_sessions" ON coaching_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_sessions" ON coaching_sessions;
CREATE POLICY "anon_insert_coaching_sessions" ON coaching_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_sessions" ON coaching_sessions;
CREATE POLICY "anon_update_coaching_sessions" ON coaching_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_sessions" ON coaching_sessions;
CREATE POLICY "anon_delete_coaching_sessions" ON coaching_sessions FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_session_participants =====
CREATE TABLE IF NOT EXISTS coaching_session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  joined_at timestamptz,
  left_at timestamptz,
  recording_consent boolean NOT NULL DEFAULT false,
  consent_timestamp timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_session_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_participants_session ON coaching_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_participants_user ON coaching_session_participants(user_id);

DROP POLICY IF EXISTS "anon_select_coaching_participants" ON coaching_session_participants;
CREATE POLICY "anon_select_coaching_participants" ON coaching_session_participants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_participants" ON coaching_session_participants;
CREATE POLICY "anon_insert_coaching_participants" ON coaching_session_participants FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_participants" ON coaching_session_participants;
CREATE POLICY "anon_update_coaching_participants" ON coaching_session_participants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_participants" ON coaching_session_participants;
CREATE POLICY "anon_delete_coaching_participants" ON coaching_session_participants FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_session_notes =====
CREATE TABLE IF NOT EXISTS coaching_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  note_type text NOT NULL DEFAULT 'coach',
  content text NOT NULL DEFAULT '',
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_session_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_notes_session ON coaching_session_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_notes_author ON coaching_session_notes(author_id);

DROP POLICY IF EXISTS "anon_select_coaching_notes" ON coaching_session_notes;
CREATE POLICY "anon_select_coaching_notes" ON coaching_session_notes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_notes" ON coaching_session_notes;
CREATE POLICY "anon_insert_coaching_notes" ON coaching_session_notes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_notes" ON coaching_session_notes;
CREATE POLICY "anon_update_coaching_notes" ON coaching_session_notes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_notes" ON coaching_session_notes;
CREATE POLICY "anon_delete_coaching_notes" ON coaching_session_notes FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_session_hands =====
CREATE TABLE IF NOT EXISTS coaching_session_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  hand_id text NOT NULL,
  marked_by text NOT NULL,
  session_timestamp int NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_session_hands ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_hands_session ON coaching_session_hands(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_hands_hand ON coaching_session_hands(hand_id);

DROP POLICY IF EXISTS "anon_select_coaching_hands" ON coaching_session_hands;
CREATE POLICY "anon_select_coaching_hands" ON coaching_session_hands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_hands" ON coaching_session_hands;
CREATE POLICY "anon_insert_coaching_hands" ON coaching_session_hands FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_hands" ON coaching_session_hands;
CREATE POLICY "anon_update_coaching_hands" ON coaching_session_hands FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_hands" ON coaching_session_hands;
CREATE POLICY "anon_delete_coaching_hands" ON coaching_session_hands FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_session_events =====
CREATE TABLE IF NOT EXISTS coaching_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  session_timestamp int NOT NULL DEFAULT 0,
  hand_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_session_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_events_session ON coaching_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_events_type ON coaching_session_events(event_type);

DROP POLICY IF EXISTS "anon_select_coaching_events" ON coaching_session_events;
CREATE POLICY "anon_select_coaching_events" ON coaching_session_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_events" ON coaching_session_events;
CREATE POLICY "anon_insert_coaching_events" ON coaching_session_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_events" ON coaching_session_events;
CREATE POLICY "anon_update_coaching_events" ON coaching_session_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_events" ON coaching_session_events;
CREATE POLICY "anon_delete_coaching_events" ON coaching_session_events FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_recordings =====
CREATE TABLE IF NOT EXISTS coaching_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  provider_recording_id text,
  storage_path text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_recordings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_recordings_session ON coaching_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_recordings_status ON coaching_recordings(status);

DROP POLICY IF EXISTS "anon_select_coaching_recordings" ON coaching_recordings;
CREATE POLICY "anon_select_coaching_recordings" ON coaching_recordings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_recordings" ON coaching_recordings;
CREATE POLICY "anon_insert_coaching_recordings" ON coaching_recordings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_recordings" ON coaching_recordings;
CREATE POLICY "anon_update_coaching_recordings" ON coaching_recordings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_recordings" ON coaching_recordings;
CREATE POLICY "anon_delete_coaching_recordings" ON coaching_recordings FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_transcripts =====
CREATE TABLE IF NOT EXISTS coaching_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  recording_id uuid REFERENCES coaching_recordings(id) ON DELETE SET NULL,
  raw_transcript text,
  structured_transcript jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_transcripts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_transcripts_session ON coaching_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_transcripts_status ON coaching_transcripts(status);

DROP POLICY IF EXISTS "anon_select_coaching_transcripts" ON coaching_transcripts;
CREATE POLICY "anon_select_coaching_transcripts" ON coaching_transcripts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_transcripts" ON coaching_transcripts;
CREATE POLICY "anon_insert_coaching_transcripts" ON coaching_transcripts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_transcripts" ON coaching_transcripts;
CREATE POLICY "anon_update_coaching_transcripts" ON coaching_transcripts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_transcripts" ON coaching_transcripts;
CREATE POLICY "anon_delete_coaching_transcripts" ON coaching_transcripts FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_session_summaries =====
CREATE TABLE IF NOT EXISTS coaching_session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  generated_summary jsonb,
  edited_summary jsonb,
  approval_status text NOT NULL DEFAULT 'draft',
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_session_summaries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_summaries_session ON coaching_session_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_summaries_approval ON coaching_session_summaries(approval_status);

DROP POLICY IF EXISTS "anon_select_coaching_summaries" ON coaching_session_summaries;
CREATE POLICY "anon_select_coaching_summaries" ON coaching_session_summaries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_summaries" ON coaching_session_summaries;
CREATE POLICY "anon_insert_coaching_summaries" ON coaching_session_summaries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_summaries" ON coaching_session_summaries;
CREATE POLICY "anon_update_coaching_summaries" ON coaching_session_summaries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_summaries" ON coaching_session_summaries;
CREATE POLICY "anon_delete_coaching_summaries" ON coaching_session_summaries FOR DELETE TO anon, authenticated USING (true);

-- ===== coaching_session_usage =====
CREATE TABLE IF NOT EXISTS coaching_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  live_audio_minutes int NOT NULL DEFAULT 0,
  recorded_minutes int NOT NULL DEFAULT 0,
  storage_mb numeric NOT NULL DEFAULT 0,
  transcription_minutes int NOT NULL DEFAULT 0,
  ai_summary_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE coaching_session_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coaching_usage_session ON coaching_session_usage(session_id);

DROP POLICY IF EXISTS "anon_select_coaching_usage" ON coaching_session_usage;
CREATE POLICY "anon_select_coaching_usage" ON coaching_session_usage FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coaching_usage" ON coaching_session_usage;
CREATE POLICY "anon_insert_coaching_usage" ON coaching_session_usage FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coaching_usage" ON coaching_session_usage;
CREATE POLICY "anon_update_coaching_usage" ON coaching_session_usage FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coaching_usage" ON coaching_session_usage;
CREATE POLICY "anon_delete_coaching_usage" ON coaching_session_usage FOR DELETE TO anon, authenticated USING (true);

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION update_coaching_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coaching_sessions_updated ON coaching_sessions;
CREATE TRIGGER trg_coaching_sessions_updated BEFORE UPDATE ON coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION update_coaching_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_notes_updated ON coaching_session_notes;
CREATE TRIGGER trg_coaching_notes_updated BEFORE UPDATE ON coaching_session_notes
  FOR EACH ROW EXECUTE FUNCTION update_coaching_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_transcripts_updated ON coaching_transcripts;
CREATE TRIGGER trg_coaching_transcripts_updated BEFORE UPDATE ON coaching_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_coaching_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_summaries_updated ON coaching_session_summaries;
CREATE TRIGGER trg_coaching_summaries_updated BEFORE UPDATE ON coaching_session_summaries
  FOR EACH ROW EXECUTE FUNCTION update_coaching_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_usage_updated ON coaching_session_usage;
CREATE TRIGGER trg_coaching_usage_updated BEFORE UPDATE ON coaching_session_usage
  FOR EACH ROW EXECUTE FUNCTION update_coaching_updated_at();
