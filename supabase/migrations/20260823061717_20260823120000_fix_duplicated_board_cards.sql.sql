/*
# Fix duplicated board cards and re-derive board_class

1. Problem
   The parser appended the FULL board from turn/river sections (which repeat
   flop cards), causing board strings like "Td Tc 2h Td Tc 2h" instead of
   "Td Tc 2h Th". This corrupted board_class derivation.

2. Fix
   Deduplicate board card tokens (preserving first-occurrence order), then
   re-derive board_class and texture fields from the corrected flop cards.

3. Safety
   Data-only UPDATE. No schema changes. No destructive operations.
   Hands without board data are not touched.
*/

-- Step 1: Fix board strings by taking only unique card tokens (preserving order)
UPDATE poker_hand_records
SET board = (
  SELECT string_agg(card, ' ' ORDER BY ord)
  FROM (
    SELECT token AS card, MIN(idx) AS ord
    FROM unnest(string_to_array(board, ' ')) WITH ORDINALITY AS t(token, idx)
    GROUP BY token
  ) distinct_cards
)
WHERE board IS NOT NULL
  AND hand_hash NOT LIKE '%-unknown-%'
  AND hand_hash NOT LIKE 'summary-%'
  AND array_length(string_to_array(board, ' '), 1) > 5;

-- Step 2: Re-derive board_class and texture fields from corrected board
DO $$
DECLARE
  rec RECORD;
  flop_cards text[];
  r1 text; r2 text; r3 text;
  s1 text; s2 text; s3 text;
  i1 int; i2 int; i3 int;
  hi int; mid int; lo int;
  high_rank text;
  is_trips boolean;
  is_paired boolean;
  suit_tex text;
  gap1 int; gap2 int;
  conn text;
  high_label text;
  board_class_val text;
  rank_order text := '23456789TJQKA';
BEGIN
  FOR rec IN
    SELECT id, board
    FROM poker_hand_records
    WHERE board IS NOT NULL
      AND hand_hash NOT LIKE '%-unknown-%'
      AND hand_hash NOT LIKE 'summary-%'
  LOOP
    flop_cards := string_to_array(rec.board, ' ');
    IF array_length(flop_cards, 1) < 3 THEN
      CONTINUE;
    END IF;

    r1 := substring(flop_cards[1] from 1 for 1);
    r2 := substring(flop_cards[2] from 1 for 1);
    r3 := substring(flop_cards[3] from 1 for 1);
    s1 := substring(flop_cards[1] from 2 for 1);
    s2 := substring(flop_cards[2] from 2 for 1);
    s3 := substring(flop_cards[3] from 2 for 1);

    i1 := position(r1 in rank_order);
    i2 := position(r2 in rank_order);
    i3 := position(r3 in rank_order);

    IF i1 = 0 OR i2 = 0 OR i3 = 0 THEN
      CONTINUE;
    END IF;

    -- Sort into hi >= mid >= lo using GREATEST/LEAST
    hi := GREATEST(i1, i2, i3);
    lo := LEAST(i1, i2, i3);
    mid := i1 + i2 + i3 - hi - lo;

    gap1 := hi - mid;
    gap2 := mid - lo;

    IF hi = i1 THEN high_rank := r1;
    ELSIF hi = i2 THEN high_rank := r2;
    ELSE high_rank := r3;
    END IF;

    is_trips := (r1 = r2 AND r2 = r3);
    is_paired := is_trips OR (r1 = r2) OR (r2 = r3) OR (r1 = r3);

    IF s1 = s2 AND s2 = s3 THEN
      suit_tex := 'monotone';
    ELSIF s1 = s2 OR s2 = s3 OR s1 = s3 THEN
      suit_tex := 'two_tone';
    ELSE
      suit_tex := 'rainbow';
    END IF;

    IF (gap1 <= 1 AND gap2 <= 1) OR (gap1 <= 2 AND gap2 <= 1) OR (gap1 <= 1 AND gap2 <= 2) THEN
      conn := 'connected';
    ELSIF gap1 <= 3 AND gap2 <= 3 THEN
      conn := 'semi_connected';
    ELSE
      conn := 'disconnected';
    END IF;

    IF high_rank = 'A' THEN high_label := 'ace_high';
    ELSIF high_rank = 'K' THEN high_label := 'king_high';
    ELSIF high_rank = 'Q' THEN high_label := 'queen_high';
    ELSIF high_rank = 'J' THEN high_label := 'jack_high';
    ELSE high_label := 'low_high';
    END IF;

    IF is_trips THEN
      board_class_val := 'trips';
    ELSIF is_paired THEN
      board_class_val := high_label || '_paired';
    ELSE
      board_class_val := high_label || '_' || suit_tex;
    END IF;

    UPDATE poker_hand_records
    SET
      board_class = board_class_val,
      flop_high_card = high_rank,
      flop_is_paired = is_paired,
      flop_is_trips = is_trips,
      flop_suit_texture = suit_tex,
      flop_connectivity = conn
    WHERE id = rec.id;
  END LOOP;
END;
$$;