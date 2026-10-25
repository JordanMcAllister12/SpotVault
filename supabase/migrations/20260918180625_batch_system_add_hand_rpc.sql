/*
# Add hand to batch RPC (canonical, dedup-aware)
*/
CREATE OR REPLACE FUNCTION public.sv_add_hand_to_batch(
  p_batch_id uuid,
  p_hand_id text,
  p_raw_hand_text text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_hero_cards text DEFAULT NULL,
  p_board text DEFAULT NULL,
  p_net_result numeric DEFAULT NULL,
  p_stack_size numeric DEFAULT NULL,
  p_blinds text DEFAULT NULL,
  p_pot_amount numeric DEFAULT NULL,
  p_site text DEFAULT NULL,
  p_game_mode text DEFAULT NULL,
  p_tournament_id text DEFAULT NULL,
  p_played_at timestamptz DEFAULT NULL,
  p_saw_flop boolean DEFAULT false,
  p_saw_turn boolean DEFAULT false,
  p_saw_river boolean DEFAULT false,
  p_showdown boolean DEFAULT false,
  p_hero_name text DEFAULT NULL,
  p_hand_fingerprint text DEFAULT NULL,
  p_selection_status text DEFAULT 'candidate'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_owner uuid;
  v_existing uuid;
  v_max_sort int;
  v_new_id uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.sv_review_sets WHERE id = p_batch_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Batch not found');
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN json_build_object('ok', false, 'error', 'Not batch owner');
  END IF;

  SELECT id INTO v_existing FROM public.sv_review_hands
  WHERE review_set_id = p_batch_id AND hand_fingerprint = p_hand_fingerprint AND hand_fingerprint IS NOT NULL
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'duplicate');
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_max_sort
  FROM public.sv_review_hands WHERE review_set_id = p_batch_id;

  INSERT INTO public.sv_review_hands (
    review_set_id, hand_id, raw_hand_text, position, hero_cards, board,
    net_result, stack_size, blinds, pot_amount, site, game_mode,
    tournament_id, played_at, saw_flop, saw_turn, saw_river, showdown,
    hero_name, hand_fingerprint, marked_for_coach, sort_order,
    selection_status, added_by
  ) VALUES (
    p_batch_id, p_hand_id, p_raw_hand_text, p_position, p_hero_cards, p_board,
    p_net_result, p_stack_size, p_blinds, p_pot_amount, p_site, p_game_mode,
    p_tournament_id, p_played_at, p_saw_flop, p_saw_turn, p_saw_river, p_showdown,
    p_hero_name, p_hand_fingerprint, false, v_max_sort,
    p_selection_status, auth.uid()
  ) RETURNING id INTO v_new_id;

  UPDATE public.sv_review_sets
  SET hand_count = hand_count + 1, updated_at = now()
  WHERE id = p_batch_id;

  RETURN json_build_object('ok', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_add_hand_to_batch(uuid, text, text, text, text, text, numeric, numeric, text, numeric, text, text, text, timestamptz, boolean, boolean, boolean, boolean, text, text, text) TO authenticated;