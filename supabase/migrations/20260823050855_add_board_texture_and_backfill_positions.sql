/*
# Add board texture columns and backfill positions, stacks, and board classification

1. New Columns: flop_high_card, flop_is_paired, flop_is_trips, flop_suit_texture,
   flop_connectivity, board_class, starting_hand_class, effective_stack_bb
2. Helper Functions: classify_flop_board, compute_starting_hand_class
3. Backfill positions from button seat, fix stack_size, classify boards
4. Indexes for new columns
5. Security — No RLS changes
*/

ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS flop_high_card TEXT;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS flop_is_paired BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS flop_is_trips BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS flop_suit_texture TEXT;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS flop_connectivity TEXT;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS board_class TEXT;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS starting_hand_class TEXT;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS effective_stack_bb NUMERIC;

CREATE INDEX IF NOT EXISTS idx_phr_mode_handclass ON poker_hand_records (user_id, game_mode, starting_hand_class);
CREATE INDEX IF NOT EXISTS idx_phr_mode_boardclass ON poker_hand_records (user_id, game_mode, board_class);
CREATE INDEX IF NOT EXISTS idx_phr_mode_flopsuit ON poker_hand_records (user_id, game_mode, flop_suit_texture);

-- Classify flop board from card string using string_to_array (avoids regexp_matches set-return issue)
CREATE OR REPLACE FUNCTION classify_flop_board(board_str TEXT)
RETURNS TABLE (
  v_flop_high_card TEXT,
  v_flop_is_paired BOOLEAN,
  v_flop_is_trips BOOLEAN,
  v_flop_suit_texture TEXT,
  v_flop_connectivity TEXT,
  v_board_class TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tokens TEXT[];
  v_card1 TEXT; v_card2 TEXT; v_card3 TEXT;
  v_r1 TEXT; v_r2 TEXT; v_r3 TEXT;
  v_s1 TEXT; v_s2 TEXT; v_s3 TEXT;
  v_rank_order TEXT := '23456789TJQKA';
  v_high_rank TEXT;
  v_i1 INT; v_i2 INT; v_i3 INT;
  v_is_paired BOOLEAN := FALSE;
  v_is_trips BOOLEAN := FALSE;
  v_suit_tex TEXT;
  v_conn TEXT;
  v_bclass TEXT;
  v_high_label TEXT;
  v_sorted INT[];
  v_gap1 INT; v_gap2 INT;
BEGIN
  IF board_str IS NULL OR length(board_str) < 8 THEN RETURN; END IF;

  v_tokens := string_to_array(trim(board_str), ' ');
  IF array_length(v_tokens, 1) < 3 THEN RETURN; END IF;

  v_card1 := v_tokens[1];
  v_card2 := v_tokens[2];
  v_card3 := v_tokens[3];

  IF length(v_card1) < 2 OR length(v_card2) < 2 OR length(v_card3) < 2 THEN RETURN; END IF;

  v_r1 := substring(v_card1 from 1 for 1);
  v_s1 := substring(v_card1 from 2 for 1);
  v_r2 := substring(v_card2 from 1 for 1);
  v_s2 := substring(v_card2 from 2 for 1);
  v_r3 := substring(v_card3 from 1 for 1);
  v_s3 := substring(v_card3 from 2 for 1);

  v_i1 := position(v_r1 in v_rank_order);
  v_i2 := position(v_r2 in v_rank_order);
  v_i3 := position(v_r3 in v_rank_order);
  IF v_i1 = 0 OR v_i2 = 0 OR v_i3 = 0 THEN RETURN; END IF;

  IF v_i1 >= v_i2 AND v_i1 >= v_i3 THEN v_high_rank := v_r1;
  ELSIF v_i2 >= v_i1 AND v_i2 >= v_i3 THEN v_high_rank := v_r2;
  ELSE v_high_rank := v_r3;
  END IF;

  IF v_r1 = v_r2 AND v_r2 = v_r3 THEN
    v_is_trips := TRUE; v_is_paired := TRUE;
  ELSIF v_r1 = v_r2 OR v_r2 = v_r3 OR v_r1 = v_r3 THEN
    v_is_paired := TRUE;
  END IF;

  IF v_s1 = v_s2 AND v_s2 = v_s3 THEN v_suit_tex := 'monotone';
  ELSIF v_s1 = v_s2 OR v_s2 = v_s3 OR v_s1 = v_s3 THEN v_suit_tex := 'two_tone';
  ELSE v_suit_tex := 'rainbow';
  END IF;

  v_sorted := ARRAY(SELECT * FROM (VALUES (v_i1),(v_i2),(v_i3)) AS t(r) ORDER BY r DESC);
  v_gap1 := v_sorted[1] - v_sorted[2];
  v_gap2 := v_sorted[2] - v_sorted[3];

  IF (v_gap1 <= 1 AND v_gap2 <= 1) OR (v_gap1 <= 2 AND v_gap2 <= 1) OR (v_gap1 <= 1 AND v_gap2 <= 2) THEN
    v_conn := 'connected';
  ELSIF v_gap1 <= 3 AND v_gap2 <= 3 THEN
    v_conn := 'semi_connected';
  ELSE
    v_conn := 'disconnected';
  END IF;

  v_high_label := CASE v_high_rank
    WHEN 'A' THEN 'ace_high' WHEN 'K' THEN 'king_high'
    WHEN 'Q' THEN 'queen_high' WHEN 'J' THEN 'jack_high'
    ELSE 'low_high' END;

  IF v_is_trips THEN v_bclass := 'trips';
  ELSIF v_is_paired THEN v_bclass := v_high_label || '_paired';
  ELSE v_bclass := v_high_label || '_' || v_suit_tex;
  END IF;

  RETURN QUERY SELECT v_high_rank, v_is_paired, v_is_trips, v_suit_tex, v_conn, v_bclass;
END;
$$;

-- Compute starting hand class from card string
CREATE OR REPLACE FUNCTION compute_starting_hand_class(cards_str TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_r1 TEXT; v_r2 TEXT; v_s1 TEXT; v_s2 TEXT;
  v_rank_order TEXT := '23456789TJQKA';
  v_i1 INT; v_i2 INT; v_high TEXT; v_low TEXT;
BEGIN
  IF cards_str IS NULL THEN RETURN NULL; END IF;
  IF NOT (cards_str ~ '^[2-9TJQKA][hdcs]\s+[2-9TJQKA][hdcs]') THEN RETURN NULL; END IF;
  v_r1 := substring(cards_str from 1 for 1);
  v_s1 := substring(cards_str from 2 for 1);
  v_r2 := substring(cards_str from 4 for 1);
  v_s2 := substring(cards_str from 5 for 1);
  v_i1 := position(v_r1 in v_rank_order);
  v_i2 := position(v_r2 in v_rank_order);
  IF v_i1 = v_i2 THEN RETURN v_r1 || v_r2; END IF;
  IF v_i1 > v_i2 THEN v_high := v_r1; v_low := v_r2;
  ELSE v_high := v_r2; v_low := v_r1; END IF;
  IF v_s1 = v_s2 THEN RETURN v_high || v_low || 's';
  ELSE RETURN v_high || v_low || 'o'; END IF;
END;
$$;

-- Backfill positions, stack sizes, effective_stack_bb
DO $$
DECLARE
  r RECORD;
  v_button_seat INT; v_hero_seat INT; v_table_size INT; v_seat_diff INT;
  v_position TEXT; v_raw TEXT;
  v_btn_match TEXT; v_hero_match TEXT; v_table_match TEXT;
  v_stack_val NUMERIC; v_bb_val NUMERIC; v_bb_match TEXT;
BEGIN
  FOR r IN SELECT id, raw_hand_text, position, stack_size, blinds
           FROM poker_hand_records
           WHERE hand_hash NOT LIKE '%-unknown-%' AND hand_hash NOT LIKE 'summary-%'
  LOOP
    v_raw := r.raw_hand_text;
    IF v_raw IS NULL THEN CONTINUE; END IF;

    v_btn_match := substring(v_raw from 'Seat #(\d+) is the button');
    IF v_btn_match IS NULL THEN CONTINUE; END IF;
    v_button_seat := v_btn_match::INT;

    v_hero_match := substring(v_raw from 'Seat (\d+): Hero \(([\d,]+) in chips\)');
    IF v_hero_match IS NULL THEN
      v_hero_match := substring(v_raw from 'Seat (\d+): Hero \(\$([\d,]+)\)');
    END IF;
    IF v_hero_match IS NULL THEN CONTINUE; END IF;

    v_hero_seat := split_part(v_hero_match, ',', 1)::INT;
    v_stack_val := NULLIF(replace(split_part(v_hero_match, ',', 2), ',', ''), '')::NUMERIC;

    v_table_match := substring(v_raw from '(\d+)-max');
    v_table_size := CASE WHEN v_table_match IS NOT NULL THEN v_table_match::INT ELSE 9 END;

    v_seat_diff := v_hero_seat - v_button_seat;
    IF v_seat_diff <= 0 THEN v_seat_diff := v_seat_diff + v_table_size; END IF;

    v_position := CASE
      WHEN v_seat_diff = 1 THEN 'SB'
      WHEN v_seat_diff = 2 THEN 'BB'
      WHEN v_seat_diff = 3 AND v_table_size >= 7 THEN 'UTG'
      WHEN v_seat_diff = 4 AND v_table_size >= 8 THEN 'UTG+1'
      WHEN v_seat_diff = 5 AND v_table_size >= 8 THEN 'LJ'
      WHEN v_seat_diff = 6 AND v_table_size >= 7 THEN 'HJ'
      WHEN v_seat_diff = 7 AND v_table_size >= 8 THEN 'CO'
      WHEN v_seat_diff = v_table_size THEN 'BTN'
      WHEN v_seat_diff = 3 THEN 'UTG'
      WHEN v_seat_diff = 4 THEN 'HJ'
      WHEN v_seat_diff = 5 THEN 'CO'
      WHEN v_seat_diff = 6 THEN 'CO'
      ELSE NULL
    END;

    v_bb_val := NULL;
    IF r.blinds IS NOT NULL THEN
      v_bb_match := substring(r.blinds from '[\d,]+$');
      IF v_bb_match IS NOT NULL THEN
        v_bb_val := replace(v_bb_match, ',', '')::NUMERIC;
      END IF;
    END IF;

    UPDATE poker_hand_records SET
      position = COALESCE(r.position, v_position),
      stack_size = COALESCE(NULLIF(r.stack_size, 0), v_stack_val),
      effective_stack_bb = CASE
        WHEN v_stack_val IS NOT NULL AND v_bb_val IS NOT NULL AND v_bb_val > 0
        THEN round((v_stack_val / v_bb_val)::NUMERIC, 1)
        ELSE NULL END
    WHERE id = r.id;
  END LOOP;
END $$;

-- Backfill: starting hand class
UPDATE poker_hand_records
SET starting_hand_class = compute_starting_hand_class(hero_cards)
WHERE hero_cards IS NOT NULL AND starting_hand_class IS NULL;

-- Backfill: board texture classification
DO $$
DECLARE
  r RECORD;
  fc RECORD;
BEGIN
  FOR r IN SELECT id, board FROM poker_hand_records
           WHERE board IS NOT NULL AND flop_high_card IS NULL
  LOOP
    SELECT * INTO fc FROM classify_flop_board(r.board);
    IF fc.v_flop_high_card IS NOT NULL THEN
      UPDATE poker_hand_records SET
        flop_high_card = fc.v_flop_high_card,
        flop_is_paired = fc.v_flop_is_paired,
        flop_is_trips = fc.v_flop_is_trips,
        flop_suit_texture = fc.v_flop_suit_texture,
        flop_connectivity = fc.v_flop_connectivity,
        board_class = fc.v_board_class
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
