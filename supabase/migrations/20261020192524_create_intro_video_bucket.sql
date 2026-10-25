/*
# Create private intro-video bucket and upload tracking table

1. New Storage Bucket
- `intro-video` (private) — stores restricted intro videos served via signed URLs only.
- Public access is OFF. All reads require server-side authorization via edge function.

2. New Table
- `intro_video_access` — maps which auth users are allowed to access restricted intro videos.
- `user_id` (uuid, references auth.users) — the authorized user.
- `video_key` (text) — the storage object key within the intro-video bucket.
- `created_at` (timestamptz).

3. Security
- RLS enabled on `intro_video_access`.
- Only authenticated users can check their own access (SELECT on own rows).
- INSERT/UPDATE/DELETE restricted to service role only (via edge function).
- Storage bucket policies: no direct public read; only service role can read objects.
*/

-- Create private bucket for restricted intro videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('intro-video', 'intro-video', false)
ON CONFLICT (id) DO NOTHING;

-- Create access control table
CREATE TABLE IF NOT EXISTS intro_video_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_key)
);

ALTER TABLE intro_video_access ENABLE ROW LEVEL SECURITY;

-- Users can check their own access only
DROP POLICY IF EXISTS "select_own_intro_access" ON intro_video_access;
CREATE POLICY "select_own_intro_access"
  ON intro_video_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (no client policies)
DROP POLICY IF EXISTS "insert_intro_access" ON intro_video_access;
CREATE POLICY "insert_intro_access"
  ON intro_video_access FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "update_intro_access" ON intro_video_access;
CREATE POLICY "update_intro_access"
  ON intro_video_access FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "delete_intro_access" ON intro_video_access;
CREATE POLICY "delete_intro_access"
  ON intro_video_access FOR DELETE
  TO authenticated
  USING (false);

-- Storage policies: no direct access for anon/authenticated, service role bypasses RLS
-- (service role automatically bypasses storage RLS, so no explicit policy needed)

-- Seed access for the three authorized accounts
-- Jordan McAllister: 17ca0743-ccdb-4d43-ab24-f84aa2821170
-- Dylan Ellis (staff moderator): 707244f4-fe47-4065-8365-5747ba0956fc
-- Bryan Paris: d421b1bd-f8c6-4cd0-b68f-40ae275e99ba
INSERT INTO intro_video_access (user_id, video_key)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'JordanIntro_compressed.mp4'),
  ('707244f4-fe47-4065-8365-5747ba0956fc', 'JordanIntro_compressed.mp4'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'JordanIntro_compressed.mp4')
ON CONFLICT (user_id, video_key) DO NOTHING;