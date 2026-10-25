/*
# Add sv_set_svi_badge_prefs RPC

## Purpose
Allows any authenticated user to set their own SVI Class/Rank badge preferences
(display mode, badge colors, badge style) on the sv_staff_metadata table.

## Changes
1. Creates `sv_set_svi_badge_prefs(p_prefs JSONB)` SECURITY DEFINER function.
   - Derives the user from auth.uid() — the caller, not a parameter.
   - Upserts into sv_staff_metadata, setting only the svi_badge_prefs column.
   - Does NOT touch staff_title/badge_text/badge_color/etc (those are admin-only).
   - Revoke EXECUTE from anon; grant to authenticated.

## Security
- SECURITY DEFINER with SET search_path = public.
- Owner derived from auth.uid() — cannot be forged.
- Only the svi_badge_prefs column is modified, not privileged staff fields.
- anon cannot call this function.
*/

CREATE OR REPLACE FUNCTION public.sv_set_svi_badge_prefs(p_prefs JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.sv_staff_metadata (user_id, svi_badge_prefs, updated_by)
  VALUES (v_user_id, p_prefs, v_user_id)
  ON CONFLICT (user_id) DO UPDATE SET
    svi_badge_prefs = EXCLUDED.svi_badge_prefs,
    updated_by = v_user_id,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sv_set_svi_badge_prefs FROM anon;
GRANT EXECUTE ON FUNCTION public.sv_set_svi_badge_prefs TO authenticated;
