/*
# Spot Discussion: Pin & Creator Answer functions

## Changes
- Add sv_toggle_spot_comment_pin() — SECURITY DEFINER function
  Only the Spot creator can pin/unpin a comment.
- Add sv_toggle_spot_comment_creator_answer() — SECURITY DEFINER function
  Only the Spot creator can mark/unmark a comment as Creator Answer / Key Insight.

## Security
- Both functions verify that the caller (app.current_account_id) is the content_spots.account_id of the spot the comment belongs to.
- Uses SET search_path for security.
*/

CREATE OR REPLACE FUNCTION sv_toggle_spot_comment_pin(p_comment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spot_owner text;
  v_caller text;
  v_current boolean;
BEGIN
  v_caller := current_setting('app.current_account_id', true);

  SELECT cs.account_id
  INTO v_spot_owner
  FROM spot_comments sc
  JOIN content_spots cs ON cs.id = sc.spot_id
  WHERE sc.id = p_comment_id;

  IF v_spot_owner IS NULL THEN
    RETURN false;
  END IF;

  IF v_spot_owner != v_caller THEN
    RETURN false;
  END IF;

  SELECT sc.is_pinned INTO v_current
  FROM spot_comments sc
  WHERE sc.id = p_comment_id;

  UPDATE spot_comments
  SET is_pinned = NOT v_current
  WHERE id = p_comment_id;

  RETURN NOT v_current;
END;
$$;

CREATE OR REPLACE FUNCTION sv_toggle_spot_comment_creator_answer(p_comment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spot_owner text;
  v_caller text;
  v_current boolean;
BEGIN
  v_caller := current_setting('app.current_account_id', true);

  SELECT cs.account_id
  INTO v_spot_owner
  FROM spot_comments sc
  JOIN content_spots cs ON cs.id = sc.spot_id
  WHERE sc.id = p_comment_id;

  IF v_spot_owner IS NULL THEN
    RETURN false;
  END IF;

  IF v_spot_owner != v_caller THEN
    RETURN false;
  END IF;

  SELECT sc.is_creator_answer INTO v_current
  FROM spot_comments sc
  WHERE sc.id = p_comment_id;

  UPDATE spot_comments
  SET is_creator_answer = NOT v_current
  WHERE id = p_comment_id;

  RETURN NOT v_current;
END;
$$;

-- Grant execute to anon + authenticated (the app uses anon key)
GRANT EXECUTE ON FUNCTION sv_toggle_spot_comment_pin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_toggle_spot_comment_creator_answer(uuid) TO anon, authenticated;
