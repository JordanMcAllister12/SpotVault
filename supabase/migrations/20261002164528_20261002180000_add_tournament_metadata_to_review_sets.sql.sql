/*
# Add Tournament Metadata to Review Sets

## Purpose
Extends the existing sv_review_sets (hand-review batches) with optional tournament
metadata so that Workspace can support importing, storing, and reopening complete
tournament hand histories as first-class objects — a "tournament library".

## New Columns on sv_review_sets
- tournament_site       text  — poker site (e.g. "PokerStars", "GGPoker")
- tournament_name       text  — parsed tournament name from HH header
- tournament_ext_id     text  — external tournament ID parsed from HH
- tournament_date       timestamptz — date the tournament was played
- tournament_buy_in     text  — buy-in string (e.g. "$530+$30")
- tournament_game_type  text  — game type (e.g. "No Limit Hold'em")
- tournament_stakes     text  — blind levels / stakes string
- tournament_hero       text  — hero player name parsed from HH
- is_tournament         boolean DEFAULT false — flag: this batch represents a tournament
- last_viewed_hand_id   uuid  — last hand the user was reviewing (FK to sv_review_hands)
- last_viewed_index     integer — 0-based index of last viewed hand within the set

## New Column on sv_review_hands
- hand_seq_index        integer — sequence number of this hand within its tournament/batch (1-based)

## Security
- No RLS policy changes needed: existing owner-scoped policies on sv_review_sets
  already cover SELECT/INSERT/UPDATE/DELETE.  The new columns are writable by the
  owner through the existing UPDATE policy.
- last_viewed_hand_id references sv_review_hands(id) with ON DELETE SET NULL so
  removing a hand doesn't block updating review state.

## Notes
1. All new columns are nullable / have defaults so existing batches remain valid.
2. No data is lost; this is purely additive.
3. UNIQUE constraint on (owner_id, tournament_ext_id, tournament_site) prevents
   duplicate tournament imports where reliable external IDs exist.
*/

-- Add tournament metadata columns to sv_review_sets
ALTER TABLE sv_review_sets
  ADD COLUMN IF NOT EXISTS tournament_site text,
  ADD COLUMN IF NOT EXISTS tournament_name text,
  ADD COLUMN IF NOT EXISTS tournament_ext_id text,
  ADD COLUMN IF NOT EXISTS tournament_date timestamptz,
  ADD COLUMN IF NOT EXISTS tournament_buy_in text,
  ADD COLUMN IF NOT EXISTS tournament_game_type text,
  ADD COLUMN IF NOT EXISTS tournament_stakes text,
  ADD COLUMN IF NOT EXISTS tournament_hero text,
  ADD COLUMN IF NOT EXISTS is_tournament boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_viewed_hand_id uuid REFERENCES sv_review_hands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_viewed_index integer;

-- Add hand sequence index to sv_review_hands
ALTER TABLE sv_review_hands
  ADD COLUMN IF NOT EXISTS hand_seq_index integer;

-- Unique constraint to prevent duplicate tournament imports
-- Only applies when both tournament_ext_id and tournament_site are present
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_dedup
  ON sv_review_sets (owner_id, tournament_site, tournament_ext_id)
  WHERE tournament_ext_id IS NOT NULL AND tournament_site IS NOT NULL;