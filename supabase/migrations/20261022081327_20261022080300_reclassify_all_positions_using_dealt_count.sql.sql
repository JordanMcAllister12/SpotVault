/*
# Reclassify ALL hand positions using actual dealt count

## Problem
The original backfill (20260823050855) used the "N-max" table header to determine
table size. GG Poker hands always say "8-max" even when fewer players are dealt
(short-handed tournament tables). This caused:
1. 2,237 hands with NULL position (seatDiff fell outside 8-max mapping)
2. Hands that WERE positioned got wrong labels (e.g., 9-player hand mapped as 8-max)

## Fix
Reclassify ALL 8,145 hands from scratch using the actual dealt player count
(counted from "Seat N:" lines before the HOLE CARDS section). This ensures:
- Short-handed tables (4-7 players) get correct position labels
- 9-player tables get UTG+2 (not available in 8-max mapping)
- 8-player tables use: UTG, UTG+1, LJ, HJ, CO, BTN, SB, BB
- Heads-up (2 players) uses: SB, BB

## Security
No schema changes. UPDATE on poker_hand_records.position for ALL rows.
*/

-- Reclassify ALL hands with hero_seat
DO $$
DECLARE
  r RECORD;
  v_raw TEXT;
  v_header TEXT;
  v_button_seat INT;
  v_hero_seat INT;
  v_seat_diff INT;
  v_dealt_count INT;
  v_position TEXT;
  v_btn_match TEXT;
  v_hole_cards_pos INT;
BEGIN
  FOR r IN SELECT id, raw_hand_text, hero_seat
           FROM poker_hand_records
           WHERE raw_hand_text IS NOT NULL
             AND hero_seat IS NOT NULL
  LOOP
    v_raw := r.raw_hand_text;

    v_hole_cards_pos := position('*** HOLE CARDS ***' IN v_raw);
    IF v_hole_cards_pos = 0 THEN
      v_hole_cards_pos := length(v_raw) + 1;
    END IF;

    v_header := substring(v_raw from 1 for v_hole_cards_pos - 1);

    v_dealt_count := array_length(string_to_array(regexp_replace(v_header, 'Seat \d+:', '~~', 'g'), '~~'), 1) - 1;

    IF v_dealt_count < 2 THEN CONTINUE; END IF;

    v_btn_match := substring(v_raw from 'Seat #(\d+) is the button');
    IF v_btn_match IS NULL THEN CONTINUE; END IF;
    v_button_seat := v_btn_match::INT;

    v_hero_seat := r.hero_seat;

    v_seat_diff := v_hero_seat - v_button_seat;
    IF v_seat_diff <= 0 THEN v_seat_diff := v_seat_diff + v_dealt_count; END IF;

    v_position := CASE
      WHEN v_seat_diff = 1 THEN 'SB'
      WHEN v_seat_diff = 2 THEN 'BB'
      WHEN v_seat_diff = v_dealt_count THEN 'BTN'
      WHEN v_seat_diff = v_dealt_count - 1 THEN 'CO'
      WHEN v_dealt_count = 2 THEN NULL  -- heads-up: only SB/BB
      WHEN v_dealt_count = 3 AND v_seat_diff = 3 THEN 'BTN'  -- already handled above
      WHEN v_dealt_count = 4 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 5 AND v_seat_diff = 3 THEN 'UTG'
      WHEN v_dealt_count = 5 AND v_seat_diff = 4 THEN 'CO'  -- already handled
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

-- Reclassify hands WITHOUT hero_seat (extract from raw text)
DO $$
DECLARE
  r RECORD;
  v_raw TEXT;
  v_header TEXT;
  v_button_seat INT;
  v_hero_seat INT;
  v_seat_diff INT;
  v_dealt_count INT;
  v_position TEXT;
  v_btn_match TEXT;
  v_hero_match TEXT;
  v_hole_cards_pos INT;
BEGIN
  FOR r IN SELECT id, raw_hand_text
           FROM poker_hand_records
           WHERE raw_hand_text IS NOT NULL
             AND hero_seat IS NULL
  LOOP
    v_raw := r.raw_hand_text;

    v_hole_cards_pos := position('*** HOLE CARDS ***' IN v_raw);
    IF v_hole_cards_pos = 0 THEN
      v_hole_cards_pos := length(v_raw) + 1;
    END IF;

    v_header := substring(v_raw from 1 for v_hole_cards_pos - 1);

    v_dealt_count := array_length(string_to_array(regexp_replace(v_header, 'Seat \d+:', '~~', 'g'), '~~'), 1) - 1;

    IF v_dealt_count < 2 THEN CONTINUE; END IF;

    v_btn_match := substring(v_raw from 'Seat #(\d+) is the button');
    IF v_btn_match IS NULL THEN CONTINUE; END IF;
    v_button_seat := v_btn_match::INT;

    v_hero_match := substring(v_raw from 'Seat (\d+): Hero \(');
    IF v_hero_match IS NULL THEN CONTINUE; END IF;
    v_hero_seat := v_hero_match::INT;

    v_seat_diff := v_hero_seat - v_button_seat;
    IF v_seat_diff <= 0 THEN v_seat_diff := v_seat_diff + v_dealt_count; END IF;

    v_position := CASE
      WHEN v_seat_diff = 1 THEN 'SB'
      WHEN v_seat_diff = 2 THEN 'BB'
      WHEN v_seat_diff = v_dealt_count THEN 'BTN'
      WHEN v_seat_diff = v_dealt_count - 1 THEN 'CO'
      WHEN v_dealt_count = 2 THEN NULL
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
