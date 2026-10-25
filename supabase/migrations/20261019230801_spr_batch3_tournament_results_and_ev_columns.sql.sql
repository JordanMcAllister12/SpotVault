/*
# SPR Batch 3: Tournament Results Table & All-In EV Column

## Purpose
1. Create `sv_tournament_results` table for storing verified tournament outcomes
   (finish position, payout, entry count) — the authoritative source for
   ROI, ITM, and tournament-dollar performance in SPR scoring.
2. Add `allin_ev_bb` column to `poker_hand_records` for per-hand all-in
   adjusted EV (in big blinds), computed during import when showdown
   hole cards are known.
3. Add `allin_ev_eligible` boolean flag to identify which all-in hands
   had sufficient data for EV computation (vs excluded due to missing
   opponent cards).

## New Table: sv_tournament_results
- Stores per-tournament verified results data.
- Each row = one tournament entry result for a user.
- Fields: tournament_id, source_file_name (links to import batch),
  tournament_name, buy_in, entry_fee, payout, finish_position,
  total_entrants, is_re_entry, re_entry_number, poker_site,
  played_at, manually_entered, created_at.
- Unique constraint on (user_id, tournament_id, source_file_name) to
  prevent duplicate tournament records from inflating results.

## Modified Table: poker_hand_records
- ADD COLUMN allin_ev_bb numeric (nullable) — computed all-in EV in BB.
- ADD COLUMN allin_ev_eligible boolean DEFAULT false — whether this
  hand had sufficient data for EV computation.

## Security
- RLS enabled on sv_tournament_results with owner-scoped CRUD.
- No RLS changes to poker_hand_records (existing policies preserved).
*/

-- ============================================================
-- Tournament results table
-- ============================================================
CREATE TABLE IF NOT EXISTS sv_tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tournament_id text NOT NULL,
  source_file_name text,
  tournament_name text,
  buy_in numeric NOT NULL DEFAULT 0,
  entry_fee numeric NOT NULL DEFAULT 0,
  payout numeric NOT NULL DEFAULT 0,
  finish_position int,
  total_entrants int,
  is_re_entry boolean NOT NULL DEFAULT false,
  re_entry_number int NOT NULL DEFAULT 0,
  poker_site text,
  played_at timestamptz,
  manually_entered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id, source_file_name)
);

ALTER TABLE sv_tournament_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tournament_results" ON sv_tournament_results;
CREATE POLICY "select_own_tournament_results" ON sv_tournament_results FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tournament_results" ON sv_tournament_results;
CREATE POLICY "insert_own_tournament_results" ON sv_tournament_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tournament_results" ON sv_tournament_results;
CREATE POLICY "update_own_tournament_results" ON sv_tournament_results FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tournament_results" ON sv_tournament_results;
CREATE POLICY "delete_own_tournament_results" ON sv_tournament_results FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tourn_results_user ON sv_tournament_results(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_tourn_results_user_tourn ON sv_tournament_results(user_id, tournament_id);

-- ============================================================
-- Add all-in EV columns to poker_hand_records
-- ============================================================
ALTER TABLE poker_hand_records
  ADD COLUMN IF NOT EXISTS allin_ev_bb numeric,
  ADD COLUMN IF NOT EXISTS allin_ev_eligible boolean NOT NULL DEFAULT false;