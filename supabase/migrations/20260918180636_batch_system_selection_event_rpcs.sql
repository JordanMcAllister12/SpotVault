/*
# Set hand selection status RPC + create batch event RPC
*/
CREATE OR REPLACE FUNCTION public.sv_set_hand_selection(
  p_hand_row_id uuid,
  p_selection_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF p_selection_status NOT IN ('candidate', 'selected') THEN
    RAISE EXCEPTION 'Invalid selection status';
  END IF;

  UPDATE public.sv_review_hands
  SET selection_status = p_selection_status
  WHERE id = p_hand_row_id
    AND EXISTS (
      SELECT 1 FROM public.sv_review_sets
      WHERE sv_review_sets.id = sv_review_hands.review_set_id
        AND sv_review_sets.owner_id = auth.uid()
    );

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_set_hand_selection(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sv_create_batch_event(
  p_batch_id uuid,
  p_event_type text,
  p_recipient_id uuid,
  p_payload jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.sv_batch_events (batch_id, event_type, actor_id, recipient_id, payload)
  VALUES (p_batch_id, p_event_type, auth.uid(), p_recipient_id, p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_create_batch_event(uuid, text, uuid, jsonb) TO authenticated;