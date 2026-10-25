/*
# Create player review hand reference images table

1. New Tables
- `sv_review_hand_images` — reference images (solver screenshots, range charts, graphs)
  attached to a specific hand in a player's review set/batch.
  - `id` (uuid PK)
  - `review_hand_id` (text, references the review hand)
  - `user_id` (uuid, owner, defaults to auth.uid())
  - `image_url` (text, public URL from storage)
  - `caption` (text, optional)
  - `sort_order` (int, default 0)
  - `created_at` (timestamptz)

2. Security
- RLS enabled.
- Owner-scoped CRUD: each authenticated user can only access their own images.
*/

CREATE TABLE IF NOT EXISTS sv_review_hand_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_hand_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sv_review_hand_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_review_images" ON sv_review_hand_images;
CREATE POLICY "select_own_review_images" ON sv_review_hand_images
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_review_images" ON sv_review_hand_images;
CREATE POLICY "insert_own_review_images" ON sv_review_hand_images
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_review_images" ON sv_review_hand_images;
CREATE POLICY "update_own_review_images" ON sv_review_hand_images
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_review_images" ON sv_review_hand_images;
CREATE POLICY "delete_own_review_images" ON sv_review_hand_images
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_review_hand_images_hand ON sv_review_hand_images(review_hand_id);
CREATE INDEX IF NOT EXISTS idx_review_hand_images_user ON sv_review_hand_images(user_id);
