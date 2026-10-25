/*
# Fix spot discussion pin/creator-answer functions to use auth.uid()

## Problem
Both sv_toggle_spot_comment_pin and sv_toggle_spot_comment_creator_answer used
`current_setting('app.current_account_id', true)` to identify the caller.
This GUC is never set anywhere in the application, so the functions always
read NULL for the caller ID, causing them to silently fail (return false)
because the owner comparison always fails.

## Fix
Replace `current_setting('app.current_account_id', true)` with `auth.uid()::text`.
The functions are SECURITY DEFINER, so auth.uid() returns the authenticated
caller's UUID even though the function runs as the owner. This is the correct
way to identify the caller in Supabase RPC functions.

## Security
- Both functions still verify that the caller is the content_spots.account_id
  (the spot creator) before allowing the toggle.
- SET search_path = public is preserved.
- EXECUTE grants are preserved.
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
  v_caller := auth.uid()::text;

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
  v_caller := auth.uid()::text;

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

-- Preserve execute grants
REVOKE EXECUTE ON FUNCTION sv_toggle_spot_comment_pin(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_toggle_spot_comment_pin(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION sv_toggle_spot_comment_creator_answer(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION sv_toggle_spot_comment_creator_answer(uuid) TO anon, authenticated;
