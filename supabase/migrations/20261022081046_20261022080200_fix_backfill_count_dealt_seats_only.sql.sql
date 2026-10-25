/*
# Fix backfill: count only dealt seats (before HOLE CARDS section)

## Problem
The previous migration (20261022080000) counted "Seat N:" occurrences in the
entire raw hand text, which includes both the dealt seat lines at the top AND
the summary seat lines at the bottom — doubling the count and making the
position mapping fail. Only ~81 hands were backfilled.

## Fix
Count "Seat N:" lines only in the portion of raw_hand_text BEFORE the
"*** HOLE CARDS ***" or "\\\ HOLE CARDS \\\\" marker. This gives the actual
number of dealt players.

## Security
No schema changes. Only UPDATE on poker_hand_records.position for unpositioned rows.
*/

-- Re-backfill using only dealt seats (before HOLE CARDS)
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
  FOR r IN SELECT id, raw_hand_text, hero_seat
           FROM poker_hand_records
           WHERE (position IS NULL OR position = '')
             AND raw_hand_text IS NOT NULL
             AND hero_seat IS NOT NULL
  LOOP
    v_raw := r.raw_hand_text;

    -- Find the HOLE CARDS marker — only count seats before it
    v_hole_cards_pos := position(v_raw in '*** HOLE CARDS ***');
    IF v_hole_cards_pos = 0 THEN
      v_hole_cards_pos := position(v_raw in '\+\ HOLE CARDS \+\');
    END IF;
    IF v_hole_cards_pos = 0 THEN v_hole_cards_pos := length(v_raw) + 1; END IF;

    v_header := substring(v_raw from 1 for v_hole_cards_pos - 1);

    -- Count "Seat N:" lines in the header only (dealt players)
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

-- Re-backfill hands without hero_seat
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
           WHERE (position IS NULL OR position = '')
             AND raw_hand_text IS NOT NULL
             AND hero_seat IS NULL
  LOOP
    v_raw := r.raw_hand_text;

    v_hole_cards_pos := position(v_raw in '*** HOLE CARDS ***');
    IF v_hole_cards_pos = 0 THEN
      v_hole_cards_pos := position(v_raw in '\+\ HOLE CARDS \+\');
    END IF;
    IF v_hole_cards_pos = 0 THEN v_hole_cards_pos := length(v_raw) + 1; END IF;

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
