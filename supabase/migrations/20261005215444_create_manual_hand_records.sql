/*
# Create durable manual hand records

1. New Tables
- `sv_manual_hand_records`
- `id` (uuid, primary key) identifies the database row.
- `hand_id` (text, unique) is the permanent public SpotVault hand identifier.
- `user_id` (uuid) identifies the signed-in owner and defaults from the active session.
- `normalized_hand` (jsonb) stores the same normalized hand object consumed by the HH Replayer.
- `source` (text) identifies the creation source and defaults to `manual`.
- `created_at` (timestamptz) records when the hand was saved.

2. Security
- Row-level security is enabled.
- Signed-in users can only read, create, update, or remove their own manual hand records.

3. Notes
- Manual hands are stored as normalized replayer data rather than a separate incompatible hand format.
- The unique hand ID is the canonical lookup key for future content attachments and share links.
*/

CREATE TABLE IF NOT EXISTS public.sv_manual_hand_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  normalized_hand jsonb NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sv_manual_hand_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_hands_select_own" ON public.sv_manual_hand_records;
CREATE POLICY "manual_hands_select_own" ON public.sv_manual_hand_records FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "manual_hands_insert_own" ON public.sv_manual_hand_records;
CREATE POLICY "manual_hands_insert_own" ON public.sv_manual_hand_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "manual_hands_update_own" ON public.sv_manual_hand_records;
CREATE POLICY "manual_hands_update_own" ON public.sv_manual_hand_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "manual_hands_delete_own" ON public.sv_manual_hand_records;
CREATE POLICY "manual_hands_delete_own" ON public.sv_manual_hand_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sv_manual_hand_records_user_created_idx ON public.sv_manual_hand_records (user_id, created_at DESC);
