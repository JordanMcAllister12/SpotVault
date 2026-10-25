/*
# Spot Comment Moderator Delete

1. Purpose
- Allows staff/admin/moderator accounts to soft-delete ANY spot comment,
  not just their own. The existing UPDATE RLS policy only lets the author
  edit/delete their own comment, so a privileged function is needed for
  moderation.
2. New Functions
- `sv_delete_spot_comment(p_comment_id uuid)` — SECURITY DEFINER function
  that soft-deletes a comment (sets deleted_at + body to '[deleted]')
  after verifying the caller is staff/admin/moderator.
3. Security
- Caller derived from auth.uid() — never a parameter.
- search_path pinned to public.
- EXECUTE revoked from anon, granted to authenticated.
- Re-checks staff/admin status inside the function body.
*/
CREATE OR REPLACE FUNCTION sv_delete_spot_comment(p_comment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_mod boolean;
BEGIN
  SELECT sv_is_staff_or_admin() INTO v_is_mod;
  IF NOT v_is_mod THEN
    RAISE EXCEPTION 'Not authorized to moderate comments';
  END IF;

  UPDATE spot_comments
  SET deleted_at = now(), body = '[deleted]', edited_at = now()
  WHERE id = p_comment_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION sv_delete_spot_comment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION sv_delete_spot_comment(uuid) TO authenticated;
