/*
# Backfill unpositioned hands using actual dealt player count

## Problem
2,237 hands remain unpositioned (NULL position column) despite having both
a button seat and hero seat in their raw hand text. The original backfill
migration (20260823050855) used the "N-max" table-size header to compute
positions. However, GG tournament tables get short-handed as players bust,
so the N-max header says "8-max" while only 6 or 7 players are actually
dealt. The original SQL CASE statement mapped seatDiff values using the
full table size, which produced NULL for seatDiff values that don't map
to any position at that table size.

## Fix
This migration re-computes positions for all unpositioned hands using the
ACTUAL count of dealt players (counted from "Seat N:" lines in the raw
hand text), not the N-max header. This matches the logic already used by
the JavaScript parser in pokerAnalytics.ts (lines 1026-1038).

## Security
No schema changes. Only UPDATE statements on existing poker_hand_records
table, setting the position column for rows where it is currently NULL.
No data is deleted or lost. RLS policies are unchanged.
*/

-- Backfill position for unpositioned hands WITH hero_seat using actual dealt player count
DO $$
DECLARE
  r RECORD;
  v_raw TEXT;
  v_button_seat INT;
  v_hero_seat INT;
  v_seat_diff INT;
  v_dealt_count INT;
  v_position TEXT;
  v_btn_match TEXT;
BEGIN
  FOR r IN SELECT id, raw_hand_text, hero_seat
           FROM poker_hand_records
           WHERE (position IS NULL OR position = '')
             AND raw_hand_text IS NOT NULL
             AND hero_seat IS NOT NULL
  LOOP
    v_raw := r.raw_hand_text;

    v_btn_match := substring(v_raw from 'Seat #(\d+) is the button');
    IF v_btn_match IS NULL THEN CONTINUE; END IF;
    v_button_seat := v_btn_match::INT;

    v_hero_seat := r.hero_seat;

    -- Count actual dealt players from unique "Seat N:" lines
    v_dealt_count := array_length(string_to_array(regexp_replace(v_raw, 'Seat \d+:', '~~SEAT~~', 'g'), '~~SEAT~~'), 1) - 1;

    IF v_dealt_count < 2 THEN CONTINUE; END IF;

    v_seat_diff := v_hero_seat - v_button_seat;
    IF v_seat_diff <= 0 THEN v_seat_diff := v_seat_diff + v_dealt_count; END IF;

    v_position := CASE
      WHEN v_seat_diff = 1 THEN 'SB'
      WHEN v_seat_diff = 2 THEN 'BB'
      WHEN v_seat_diff = v_dealt_count THEN 'BTN'
      WHEN v_seat_diff = v_dealt_count - 1 THEN 'CO'
      WHEN v_dealt_count = 4 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 5 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 6 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 6 AND v_seat_diff = 4 THEN 'HJ'
      WHEN v_dealt_count = 7 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 7 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count = 7 AND v_seat_diff = 5 THEN 'HJ'
      WHEN v_dealt_count = 8 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 8 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count = 8 AND v_seat_diff = 5 THEN 'LJ'
      WHEN v_dealt_count = 8 AND v_seat_diff = 6 THEN 'HJ'
      WHEN v_dealt_count = 9 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 9 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count = 9 AND v_seat_diff = 5 THEN 'UTG+2'
      WHEN v_dealt_count = 9 AND v_seat_diff = 6 THEN 'LJ'
      WHEN v_dealt_count = 9 AND v_seat_diff = 7 THEN 'HJ'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 5 THEN 'UTG+2'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 6 THEN 'UTG+3'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 7 THEN 'LJ'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 8 THEN 'HJ'
      ELSE NULL
    END;

    IF v_position IS NOT NULL THEN
      UPDATE poker_hand_records SET position = v_position WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Backfill hands WITHOUT hero_seat by extracting it from raw text
DO $$
DECLARE
  r RECORD;
  v_raw TEXT;
  v_button_seat INT;
  v_hero_seat INT;
  v_seat_diff INT;
  v_dealt_count INT;
  v_position TEXT;
  v_btn_match TEXT;
  v_hero_match TEXT;
BEGIN
  FOR r IN SELECT id, raw_hand_text
           FROM poker_hand_records
           WHERE (position IS NULL OR position = '')
             AND raw_hand_text IS NOT NULL
             AND hero_seat IS NULL
  LOOP
    v_raw := r.raw_hand_text;

    v_btn_match := substring(v_raw from 'Seat #(\d+) is the button');
    IF v_btn_match IS NULL THEN CONTINUE; END IF;
    v_button_seat := v_btn_match::INT;

    v_hero_match := substring(v_raw from 'Seat (\d+): Hero \(');
    IF v_hero_match IS NULL THEN CONTINUE; END IF;
    v_hero_seat := v_hero_match::INT;

    v_dealt_count := array_length(string_to_array(regexp_replace(v_raw, 'Seat \d+:', '~~SEAT~~', 'g'), '~~SEAT~~'), 1) - 1;

    IF v_dealt_count < 2 THEN CONTINUE; END IF;

    v_seat_diff := v_hero_seat - v_button_seat;
    IF v_seat_diff <= 0 THEN v_seat_diff := v_seat_diff + v_dealt_count; END IF;

    v_position := CASE
      WHEN v_seat_diff = 1 THEN 'SB'
      WHEN v_seat_diff = 2 THEN 'BB'
      WHEN v_seat_diff = v_dealt_count THEN 'BTN'
      WHEN v_seat_diff = v_dealt_count - 1 THEN 'CO'
      WHEN v_dealt_count = 4 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 5 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 6 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 6 AND v_seat_diff = 4 THEN 'HJ'
      WHEN v_dealt_count = 7 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 7 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count = 7 AND v_seat_diff = 5 THEN 'HJ'
      WHEN v_dealt_count = 8 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 8 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count = 8 AND v_seat_diff = 5 THEN 'LJ'
      WHEN v_dealt_count = 8 AND v_seat_diff = 6 THEN 'HJ'
      WHEN v_dealt_count = 9 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 9 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count = 9 AND v_seat_diff = 5 THEN 'UTG+2'
      WHEN v_dealt_count = 9 AND v_seat_diff = 6 THEN 'LJ'
      WHEN v_dealt_count = 9 AND v_seat_diff = 7 THEN 'HJ'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 4 THEN 'UTG+1'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 5 THEN 'UTG+2'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 6 THEN 'UTG+3'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 7 THEN 'LJ'
      WHEN v_dealt_count >= 10 AND v_seat_diff = 8 THEN 'HJ'
      ELSE NULL
    END;

    IF v_position IS NOT NULL THEN
      UPDATE poker_hand_records SET position = v_position, hero_seat = v_hero_seat WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
