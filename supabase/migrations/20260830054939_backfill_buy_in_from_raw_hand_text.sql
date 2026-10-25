/*
# Backfill buy_in from raw_hand_text

1. Purpose
- All 7,028 existing tournament hand records were imported before the buy_in column
  existed, so buy_in is NULL for every row. The buy-in amount is embedded in the
  raw hand text header line, e.g.:
    "Tournament #288272825, Bounty Hunters Forty Stack $44 Hold'em No Limit"
    "Tournament #287633098, GGMasters Bounty Warm-Up $25, $100K GTD Hold'em"
    "Tournament #288244973, 299-L: $5.50 Bounty Hunters [Deepstack Turbo] Hold'em"
- This migration extracts the first dollar amount after the tournament ID/name
  portion of the header and writes it to the buy_in column.
- The regex excludes guarantee amounts like "$100K" via a negative lookahead (?!\d*K).
- Cash-game hands (tournament_id IS NULL) are left untouched (buy_in stays NULL).

2. Safety
- This is an UPDATE only — no schema changes, no data deletion.
- Idempotent: re-running on already-populated rows is a no-op (WHERE buy_in IS NULL).
*/

UPDATE poker_hand_records
SET buy_in = (
  regexp_match(raw_hand_text, 'Tournament #\S+,\s*[^$]*\$([\d]+(?:\.\d+)?)(?!\d*K)')
)[1]::numeric
WHERE buy_in IS NULL
  AND tournament_id IS NOT NULL
  AND raw_hand_text IS NOT NULL;
