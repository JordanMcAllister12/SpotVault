/*
# Batch events table
*/
CREATE TABLE IF NOT EXISTS public.sv_batch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.sv_review_sets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE public.sv_batch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batch_events_select_participant" ON public.sv_batch_events;
CREATE POLICY "batch_events_select_participant"
  ON public.sv_batch_events FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "batch_events_insert_own" ON public.sv_batch_events;
CREATE POLICY "batch_events_insert_own"
  ON public.sv_batch_events FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "batch_events_update_own" ON public.sv_batch_events;
CREATE POLICY "batch_events_update_own"
  ON public.sv_batch_events FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_batch_events_recipient
  ON public.sv_batch_events(recipient_id, read_at);