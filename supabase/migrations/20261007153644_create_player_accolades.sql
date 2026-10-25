/*
# Create player_accolades table — visual poker accolades/showcase

## Purpose
A new image-first accolades system that lets players showcase their poker achievements
as visual cards (tournament wins, final tables, career milestones, etc.). Each accolade
has a primary image, title, result text, caption, date, optional external link, display
ordering, and a featured flag. This replaces the text-only accomplishments system with
a visual showcase experience.

## New Table: player_accolades

Columns:
- id (uuid, PK, auto-generated)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), FK to auth.users, ON DELETE CASCADE)
- image_url (text, NOT NULL) — URL to the showcase image in user-uploads storage bucket
- title (text, NOT NULL) — e.g. "WSOP Main Event"
- result_text (text, nullable) — e.g. "1st Place — $1,500,000"
- caption (text, nullable) — additional context/story
- achievement_date (date, nullable) — when the achievement happened
- external_url (text, nullable) — link to Hendon Mob, result page, etc.
- display_order (integer, NOT NULL, DEFAULT 0) — ordering for showcase layout
- is_featured (boolean, NOT NULL, DEFAULT false) — highlighted at top
- verification_status (text, NOT NULL, DEFAULT 'unverified') — future: unverified/verified/rejected
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

## Security (RLS)

- RLS enabled on player_accolades.
- SELECT: public — anyone (anon + authenticated) can view accolades (they are a public showcase).
- INSERT: authenticated only, owner check (auth.uid() = user_id).
- UPDATE: authenticated only, owner check (auth.uid() = user_id).
- DELETE: authenticated only, owner check (auth.uid() = user_id).

## Indexes

- Index on user_id for fast per-profile queries.
- Index on (user_id, display_order) for ordered showcase retrieval.
- Index on (user_id, is_featured) for featured filtering.

## Important Notes

1. The user_id column has DEFAULT auth.uid() so frontend inserts that omit user_id
   will still satisfy the INSERT WITH CHECK policy.
2. Public SELECT uses USING (true) because accolades are intentionally public content —
   they are a showcase visible to all visitors, including unauthenticated users.
3. Writes are restricted to the authenticated owner only.
4. Images are stored in the existing user-uploads Supabase storage bucket under
   accolades/{user_id}/{accolade_id}.{ext} path.
*/

CREATE TABLE IF NOT EXISTS player_accolades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text NOT NULL,
  result_text text,
  caption text,
  achievement_date date,
  external_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE player_accolades ENABLE ROW LEVEL SECURITY;

-- SELECT: public — accolades are a public showcase
DROP POLICY IF EXISTS "accolades_select_public" ON player_accolades;
CREATE POLICY "accolades_select_public"
  ON player_accolades FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: authenticated owner only
DROP POLICY IF EXISTS "accolades_insert_own" ON player_accolades;
CREATE POLICY "accolades_insert_own"
  ON player_accolades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: authenticated owner only
DROP POLICY IF EXISTS "accolades_update_own" ON player_accolades;
CREATE POLICY "accolades_update_own"
  ON player_accolades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: authenticated owner only
DROP POLICY IF EXISTS "accolades_delete_own" ON player_accolades;
CREATE POLICY "accolades_delete_own"
  ON player_accolades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_player_accolades_user_id ON player_accolades(user_id);
CREATE INDEX IF NOT EXISTS idx_player_accolades_user_order ON player_accolades(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_player_accolades_user_featured ON player_accolades(user_id, is_featured);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_accolade_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accolade_updated_at ON player_accolades;
CREATE TRIGGER trg_accolade_updated_at
  BEFORE UPDATE ON player_accolades
  FOR EACH ROW
  EXECUTE FUNCTION update_accolade_updated_at();
