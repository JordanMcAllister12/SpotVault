/*
# Create Guided Presentation V1 persistence

1. New Tables
- `public.guided_presentations`: one interactive presentation attached to an existing hand ID and creator.
  - Stores title, status, audio storage path, duration, and timestamps.
- `public.guided_presentation_cues`: timed hand, street, pause, and visual events belonging to a presentation.
  - Stores cue type, timestamp, optional end timestamp, hand event index, media reference, and label.
- `public.guided_presentation_media`: uploaded presentation images/screenshots belonging to a presentation.
  - Stores the private storage path, title, caption, and media type.
- `public.guided_presentation_comments`: viewer comments attached to a presentation.
  - Stores the authenticated author, comment text, and creation time.

2. Modified Storage
- Creates the private `presentation-media` bucket for narration and supporting images.
- Enforces a 50 MB object limit and an allowlist of audio/image MIME types.

3. Security
- Enables row-level security on all new tables.
- Creators can manage only their own presentations and child records.
- Published presentations are readable by authenticated users; draft presentations remain private to their creator.
- Published presentation comments are readable by authenticated users; authenticated users can add comments using their session identity.
- Storage paths must begin with the authenticated creator ID and the matching presentation ID.

4. Important Notes
- Existing hand records are referenced by `hand_id`; no hand data is copied or changed.
- Audio and images remain structured assets, not rendered video files.
- All policies are separated by CRUD operation and use `auth.uid()` for ownership.
*/

CREATE TABLE IF NOT EXISTS public.guided_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id text NOT NULL,
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Guided Presentation',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  audio_storage_path text,
  audio_duration numeric(10,3) CHECK (audio_duration IS NULL OR (audio_duration >= 0 AND audio_duration <= 86400)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guided_presentation_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.guided_presentations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  title text NOT NULL DEFAULT 'Presentation image',
  caption text,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guided_presentation_cues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.guided_presentations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_seconds numeric(10,3) NOT NULL DEFAULT 0 CHECK (timestamp_seconds >= 0),
  end_timestamp_seconds numeric(10,3) CHECK (end_timestamp_seconds IS NULL OR end_timestamp_seconds >= timestamp_seconds),
  cue_type text NOT NULL CHECK (cue_type IN ('action_reaches_hero', 'next_action', 'deal_flop', 'deal_turn', 'deal_river', 'pause_hand', 'resume_hand', 'hand_event', 'visual')),
  hand_event_index integer CHECK (hand_event_index IS NULL OR hand_event_index >= 0),
  media_id uuid REFERENCES public.guided_presentation_media(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT 'Cue',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guided_presentation_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.guided_presentations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guided_presentations_creator_idx ON public.guided_presentations (creator_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS guided_presentations_public_idx ON public.guided_presentations (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS guided_presentation_cues_timeline_idx ON public.guided_presentation_cues (presentation_id, timestamp_seconds);
CREATE INDEX IF NOT EXISTS guided_presentation_media_presentation_idx ON public.guided_presentation_media (presentation_id, created_at);
CREATE INDEX IF NOT EXISTS guided_presentation_comments_presentation_idx ON public.guided_presentation_comments (presentation_id, created_at);

ALTER TABLE public.guided_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_presentation_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_presentation_cues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_presentation_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presentation_select_owner_or_published" ON public.guided_presentations;
CREATE POLICY "presentation_select_owner_or_published" ON public.guided_presentations FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR status = 'published');
DROP POLICY IF EXISTS "presentation_insert_owner" ON public.guided_presentations;
CREATE POLICY "presentation_insert_owner" ON public.guided_presentations FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
DROP POLICY IF EXISTS "presentation_update_owner" ON public.guided_presentations;
CREATE POLICY "presentation_update_owner" ON public.guided_presentations FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
DROP POLICY IF EXISTS "presentation_delete_owner" ON public.guided_presentations;
CREATE POLICY "presentation_delete_owner" ON public.guided_presentations FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "presentation_media_select_owner_or_published" ON public.guided_presentation_media;
CREATE POLICY "presentation_media_select_owner_or_published" ON public.guided_presentation_media FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guided_presentations p WHERE p.id = presentation_id AND p.status = 'published'));
DROP POLICY IF EXISTS "presentation_media_insert_owner" ON public.guided_presentation_media;
CREATE POLICY "presentation_media_insert_owner" ON public.guided_presentation_media FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND EXISTS (SELECT 1 FROM public.guided_presentations p WHERE p.id = presentation_id AND p.creator_id = auth.uid()));
DROP POLICY IF EXISTS "presentation_media_update_owner" ON public.guided_presentation_media;
CREATE POLICY "presentation_media_update_owner" ON public.guided_presentation_media FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
DROP POLICY IF EXISTS "presentation_media_delete_owner" ON public.guided_presentation_media;
CREATE POLICY "presentation_media_delete_owner" ON public.guided_presentation_media FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "presentation_cue_select_owner_or_published" ON public.guided_presentation_cues;
CREATE POLICY "presentation_cue_select_owner_or_published" ON public.guided_presentation_cues FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guided_presentations p WHERE p.id = presentation_id AND p.status = 'published'));
DROP POLICY IF EXISTS "presentation_cue_insert_owner" ON public.guided_presentation_cues;
CREATE POLICY "presentation_cue_insert_owner" ON public.guided_presentation_cues FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND EXISTS (SELECT 1 FROM public.guided_presentations p WHERE p.id = presentation_id AND p.creator_id = auth.uid()));
DROP POLICY IF EXISTS "presentation_cue_update_owner" ON public.guided_presentation_cues;
CREATE POLICY "presentation_cue_update_owner" ON public.guided_presentation_cues FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
DROP POLICY IF EXISTS "presentation_cue_delete_owner" ON public.guided_presentation_cues;
CREATE POLICY "presentation_cue_delete_owner" ON public.guided_presentation_cues FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "presentation_comment_select_owner_or_published" ON public.guided_presentation_comments;
CREATE POLICY "presentation_comment_select_owner_or_published" ON public.guided_presentation_comments FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guided_presentations p WHERE p.id = presentation_id AND p.status = 'published'));
DROP POLICY IF EXISTS "presentation_comment_insert_authenticated" ON public.guided_presentation_comments;
CREATE POLICY "presentation_comment_insert_authenticated" ON public.guided_presentation_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.guided_presentations p WHERE p.id = presentation_id AND p.status = 'published'));
DROP POLICY IF EXISTS "presentation_comment_update_author" ON public.guided_presentation_comments;
CREATE POLICY "presentation_comment_update_author" ON public.guided_presentation_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "presentation_comment_delete_author" ON public.guided_presentation_comments;
CREATE POLICY "presentation_comment_delete_author" ON public.guided_presentation_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('presentation-media', 'presentation-media', false, 52428800, ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800, allowed_mime_types = ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

DROP POLICY IF EXISTS "presentation_storage_select_owner" ON storage.objects;
CREATE POLICY "presentation_storage_select_owner" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'presentation-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "presentation_storage_insert_owner" ON storage.objects;
CREATE POLICY "presentation_storage_insert_owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'presentation-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "presentation_storage_update_owner" ON storage.objects;
CREATE POLICY "presentation_storage_update_owner" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'presentation-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'presentation-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "presentation_storage_delete_owner" ON storage.objects;
CREATE POLICY "presentation_storage_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'presentation-media' AND (storage.foldername(name))[1] = auth.uid()::text);
