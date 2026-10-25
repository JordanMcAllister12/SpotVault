/*
# Coaching Review Sets — Isolated Hand Review Workspace

## Purpose
Creates tables for the Student Center Hand Review workspace. These store hands
uploaded for coaching review ONLY — completely isolated from Analytics. Hands
here NEVER affect hand counts, BB/100, VPIP, PFR, graphs, or any Analytics stat.

## New Tables

### sv_review_sets
A collection of hands uploaded for coaching review. Can represent a single hand,
selected hands, a full tournament, or an arbitrary HH batch.
- id (uuid, primary key)
- owner_id (uuid — the student who owns this review set)
- title (text — e.g. "$525 High Roller" or "Sunday Million")
- source_type (text: 'paste' | 'file_upload' | 'drag_drop')
- hand_count (int — total hands in the set)
- status (text: 'active' | 'archived')
- created_at, updated_at

### sv_review_hands
Individual hands within a review set. Stores the raw HH text and parsed metadata
for filtering. This is SEPARATE from poker_hand_records — no Analytics ingestion.
- id (uuid, primary key)
- review_set_id (uuid, references sv_review_sets)
- hand_id (text — the original hand ID from the HH text)
- raw_hand_text (text — the original raw hand history text)
- position (text, nullable — hero's position)
- hero_cards (text, nullable)
- board (text, nullable)
- net_result (numeric, nullable)
- stack_size (numeric, nullable)
- blinds (text, nullable)
- pot_amount (numeric, nullable)
- site (text, nullable)
- game_mode (text, nullable)
- tournament_id (text, nullable)
- played_at (timestamptz, nullable)
- saw_flop (boolean, default false)
- saw_turn (boolean, default false)
- saw_river (boolean, default false)
- showdown (boolean, default false)
- hero_name (text, nullable)
- parsed_ok (boolean, default true)
- parse_error (text, nullable)
- marked_for_coach (boolean, default false)
- created_at

### sv_review_hand_notes
Notes attached to hands in the review workspace. Supports multiple note types
(student, coach, session, private) with explicit visibility.
- id (uuid, primary key)
- review_hand_id (uuid, references sv_review_hands)
- author_id (uuid — who wrote the note)
- note_type (text: 'student' | 'coach' | 'session' | 'private')
- content (text)
- shared (boolean, default true — whether visible to other participants)
- created_at, updated_at

## Security
- All tables have RLS enabled
- sv_review_sets: owner can CRUD their own sets
- sv_review_hands: owner of the parent set can read/insert; updates through functions
- sv_review_hand_notes: author can read/write their own notes; shared notes visible to set owner
- Direct DELETE revoked on review_hands (cascade from set deletion handles cleanup)

## Important Notes
1. These tables are COMPLETELY SEPARATE from poker_hand_records and all Analytics tables.
2. No triggers, no analytics computation, no statistics derived from these hands.
3. The parser (parseHandBlock) is reused for metadata extraction, but the parsed hands
   are NOT inserted into any analytics pipeline.
4. marked_for_coach flag lets students flag specific hands within a large set.
5. Future "Add to Analytics" would be an explicit user action with duplicate detection.
*/

-- ============================================================
-- 1. REVIEW SETS
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_review_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'paste' CHECK (source_type IN ('paste', 'file_upload', 'drag_drop')),
  hand_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_review_sets_owner_idx ON sv_review_sets (owner_id, status);

ALTER TABLE sv_review_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_review_sets_select_own" ON sv_review_sets;
CREATE POLICY "sv_review_sets_select_own" ON sv_review_sets FOR SELECT
  TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "sv_review_sets_insert_own" ON sv_review_sets;
CREATE POLICY "sv_review_sets_insert_own" ON sv_review_sets FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "sv_review_sets_update_own" ON sv_review_sets;
CREATE POLICY "sv_review_sets_update_own" ON sv_review_sets FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "sv_review_sets_delete_own" ON sv_review_sets;
CREATE POLICY "sv_review_sets_delete_own" ON sv_review_sets FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============================================================
-- 2. REVIEW HANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_review_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_set_id uuid NOT NULL REFERENCES sv_review_sets(id) ON DELETE CASCADE,
  hand_id text,
  raw_hand_text text NOT NULL,
  position text,
  hero_cards text,
  board text,
  net_result numeric,
  stack_size numeric,
  blinds text,
  pot_amount numeric,
  site text,
  game_mode text,
  tournament_id text,
  played_at timestamptz,
  saw_flop boolean NOT NULL DEFAULT false,
  saw_turn boolean NOT NULL DEFAULT false,
  saw_river boolean NOT NULL DEFAULT false,
  showdown boolean NOT NULL DEFAULT false,
  hero_name text,
  parsed_ok boolean NOT NULL DEFAULT true,
  parse_error text,
  marked_for_coach boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_review_hands_set_idx ON sv_review_hands (review_set_id);
CREATE INDEX IF NOT EXISTS sv_review_hands_marked_idx ON sv_review_hands (review_set_id, marked_for_coach) WHERE marked_for_coach = true;

ALTER TABLE sv_review_hands ENABLE ROW LEVEL SECURITY;

-- Owner of the parent set can read
DROP POLICY IF EXISTS "sv_review_hands_select_own" ON sv_review_hands;
CREATE POLICY "sv_review_hands_select_own" ON sv_review_hands FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_review_sets WHERE sv_review_sets.id = sv_review_hands.review_set_id AND sv_review_sets.owner_id = auth.uid())
  );

-- Owner of the parent set can insert
DROP POLICY IF EXISTS "sv_review_hands_insert_own" ON sv_review_hands;
CREATE POLICY "sv_review_hands_insert_own" ON sv_review_hands FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM sv_review_sets WHERE sv_review_sets.id = sv_review_hands.review_set_id AND sv_review_sets.owner_id = auth.uid())
  );

-- Owner can update (for marked_for_coach toggle)
DROP POLICY IF EXISTS "sv_review_hands_update_own" ON sv_review_hands;
CREATE POLICY "sv_review_hands_update_own" ON sv_review_hands FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sv_review_sets WHERE sv_review_sets.id = sv_review_hands.review_set_id AND sv_review_sets.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM sv_review_sets WHERE sv_review_sets.id = sv_review_hands.review_set_id AND sv_review_sets.owner_id = auth.uid())
  );

-- No direct delete — cascade from set deletion handles cleanup
REVOKE DELETE ON sv_review_hands FROM anon, authenticated;

-- ============================================================
-- 3. REVIEW HAND NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_review_hand_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_hand_id uuid NOT NULL REFERENCES sv_review_hands(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'student' CHECK (note_type IN ('student', 'coach', 'session', 'private')),
  content text NOT NULL,
  shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_review_notes_hand_idx ON sv_review_hand_notes (review_hand_id);

ALTER TABLE sv_review_hand_notes ENABLE ROW LEVEL SECURITY;

-- Author can read their own notes; shared notes visible to set owner
DROP POLICY IF EXISTS "sv_review_notes_select" ON sv_review_hand_notes;
CREATE POLICY "sv_review_notes_select" ON sv_review_hand_notes FOR SELECT
  TO authenticated USING (
    author_id = auth.uid()
    OR (
      shared = true
      AND EXISTS (
        SELECT 1 FROM sv_review_hands
        JOIN sv_review_sets ON sv_review_sets.id = sv_review_hands.review_set_id
        WHERE sv_review_hands.id = sv_review_hand_notes.review_hand_id
        AND sv_review_sets.owner_id = auth.uid()
      )
    )
  );

-- Author can insert their own notes
DROP POLICY IF EXISTS "sv_review_notes_insert_own" ON sv_review_hand_notes;
CREATE POLICY "sv_review_notes_insert_own" ON sv_review_hand_notes FOR INSERT
  TO authenticated WITH CHECK (author_id = auth.uid());

-- Author can update their own notes
DROP POLICY IF EXISTS "sv_review_notes_update_own" ON sv_review_hand_notes;
CREATE POLICY "sv_review_notes_update_own" ON sv_review_hand_notes FOR UPDATE
  TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Author can delete their own notes
DROP POLICY IF EXISTS "sv_review_notes_delete_own" ON sv_review_hand_notes;
CREATE POLICY "sv_review_notes_delete_own" ON sv_review_hand_notes FOR DELETE
  TO authenticated USING (author_id = auth.uid());