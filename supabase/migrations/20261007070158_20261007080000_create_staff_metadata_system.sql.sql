/*
# Create Staff Metadata System

## Purpose
Store staff titles and public badge configurations separately from account role
and membership. This enables SUPERUSER to assign custom staff titles and design
public staff badges that appear across the platform's identity system.

## New Tables

### sv_staff_metadata
- user_id (uuid, PK, references auth.users)
- staff_title (text) — public staff title like "Moderator", "Community Manager"
- badge_text (text) — badge label text like "MODERATOR"
- badge_color (text) — hex color for badge background
- badge_text_color (text) — hex color for badge text
- badge_icon (text, nullable) — optional lucide icon name
- updated_at (timestamptz)
- updated_by (uuid, nullable) — superuser who last modified

## Security
- RLS enabled
- SELECT: any authenticated user can read (needed for badge display)
- INSERT/UPDATE/DELETE: only superuser (via sv_is_staff_or_admin check for superuser)
- A SECURITY DEFINER function sv_set_staff_metadata allows superuser to set metadata
- A SECURITY DEFINER function sv_remove_staff_role allows superuser to demote staff

## Functions
- sv_set_staff_metadata(p_user_id, p_staff_title, p_badge_text, p_badge_color, p_badge_text_color, p_badge_icon)
  Superuser-only. Upserts staff metadata.
- sv_remove_staff(p_user_id)
  Superuser-only. Removes staff role, sets staff_title to null, cleans up metadata.
- sv_get_staff_directory()
  Staff/superuser-only. Returns all staff + superuser accounts with their metadata.
- sv_promote_staff(p_user_id, p_staff_title)
  Superuser-only. Adds 'staff' role to sv_roles if not present.
*/

CREATE TABLE IF NOT EXISTS public.sv_staff_metadata (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_title text NOT NULL DEFAULT '',
  badge_text text NOT NULL DEFAULT '',
  badge_color text NOT NULL DEFAULT '#d4a52c',
  badge_text_color text NOT NULL DEFAULT '#0a0908',
  badge_icon text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.sv_staff_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_metadata_select_all" ON public.sv_staff_metadata;
CREATE POLICY "staff_metadata_select_all"
ON public.sv_staff_metadata FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "staff_metadata_superuser_write" ON public.sv_staff_metadata;
CREATE POLICY "staff_metadata_superuser_write"
ON public.sv_staff_metadata FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'superuser'
    AND sv_roles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE sv_roles.user_id = auth.uid()
    AND sv_roles.role = 'superuser'
    AND sv_roles.status = 'active'
  )
);

-- Function: sv_is_superuser
CREATE OR REPLACE FUNCTION public.sv_is_superuser()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = auth.uid()
    AND role = 'superuser'
    AND status = 'active'
  );
END;
$function$;

-- Function: sv_set_staff_metadata
CREATE OR REPLACE FUNCTION public.sv_set_staff_metadata(
  p_user_id uuid,
  p_staff_title text DEFAULT '',
  p_badge_text text DEFAULT '',
  p_badge_color text DEFAULT '#d4a52c',
  p_badge_text_color text DEFAULT '#0a0908',
  p_badge_icon text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.sv_is_superuser() THEN
    RAISE EXCEPTION 'Only superuser can set staff metadata';
  END IF;

  INSERT INTO public.sv_staff_metadata (user_id, staff_title, badge_text, badge_color, badge_text_color, badge_icon, updated_by)
  VALUES (p_user_id, p_staff_title, p_badge_text, p_badge_color, p_badge_text_color, p_badge_icon, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    staff_title = EXCLUDED.staff_title,
    badge_text = EXCLUDED.badge_text,
    badge_color = EXCLUDED.badge_color,
    badge_text_color = EXCLUDED.badge_text_color,
    badge_icon = EXCLUDED.badge_icon,
    updated_by = auth.uid(),
    updated_at = now();
END;
$function$;

-- Function: sv_promote_staff
CREATE OR REPLACE FUNCTION public.sv_promote_staff(
  p_user_id uuid,
  p_staff_title text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.sv_is_superuser() THEN
    RAISE EXCEPTION 'Only superuser can promote staff';
  END IF;

  INSERT INTO public.sv_roles (user_id, role, status, approved_by, approved_at)
  VALUES (p_user_id, 'staff', 'active', auth.uid(), now())
  ON CONFLICT DO NOTHING;

  -- Set staff title in metadata
  INSERT INTO public.sv_staff_metadata (user_id, staff_title, updated_by)
  VALUES (p_user_id, p_staff_title, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    staff_title = EXCLUDED.staff_title,
    updated_by = auth.uid(),
    updated_at = now();
END;
$function$;

-- Function: sv_demote_staff
CREATE OR REPLACE FUNCTION public.sv_demote_staff(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.sv_is_superuser() THEN
    RAISE EXCEPTION 'Only superuser can demote staff';
  END IF;

  -- Cannot demote another superuser
  IF EXISTS (
    SELECT 1 FROM public.sv_roles
    WHERE user_id = p_user_id AND role = 'superuser' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot demote a superuser — remove superuser role first';
  END IF;

  -- Remove staff role
  DELETE FROM public.sv_roles
  WHERE user_id = p_user_id AND role = 'staff';

  -- Clear staff metadata
  DELETE FROM public.sv_staff_metadata
  WHERE user_id = p_user_id;
END;
$function$;

-- Function: sv_promote_superuser
CREATE OR REPLACE FUNCTION public.sv_promote_superuser(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.sv_is_superuser() THEN
    RAISE EXCEPTION 'Only superuser can promote another superuser';
  END IF;

  INSERT INTO public.sv_roles (user_id, role, status, approved_by, approved_at)
  VALUES (p_user_id, 'superuser', 'active', auth.uid(), now())
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Function: sv_demote_superuser
CREATE OR REPLACE FUNCTION public.sv_demote_superuser(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.sv_is_superuser() THEN
    RAISE EXCEPTION 'Only superuser can demote superuser';
  END IF;

  -- Prevent removing the last superuser
  SELECT count(*) INTO v_count
  FROM public.sv_roles
  WHERE role = 'superuser' AND status = 'active';

  IF v_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last superuser';
  END IF;

  DELETE FROM public.sv_roles
  WHERE user_id = p_user_id AND role = 'superuser';
END;
$function$;

-- Function: sv_get_staff_directory
CREATE OR REPLACE FUNCTION public.sv_get_staff_directory()
RETURNS TABLE(
  user_id text,
  display_name text,
  username text,
  email text,
  sv_user_id text,
  role text,
  staff_title text,
  badge_text text,
  badge_color text,
  badge_text_color text,
  badge_icon text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (au.id)
    au.id::text AS user_id,
    COALESCE(up.display_name, au.email)::text AS display_name,
    COALESCE(up.username, '')::text AS username,
    au.email::text AS email,
    COALESCE(up.sv_user_id, '')::text AS sv_user_id,
    CASE
      WHEN sr_su.role IS NOT NULL THEN 'superuser'
      WHEN sr_st.role IS NOT NULL THEN 'staff'
      ELSE 'user'
    END::text AS role,
    COALESCE(sm.staff_title, '')::text AS staff_title,
    COALESCE(sm.badge_text, '')::text AS badge_text,
    COALESCE(sm.badge_color, '#d4a52c')::text AS badge_color,
    COALESCE(sm.badge_text_color, '#0a0908')::text AS badge_text_color,
    sm.badge_icon,
    CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      ELSE 'active'
    END::text AS status
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
  LEFT JOIN public.sv_roles sr_su ON sr_su.user_id = au.id AND sr_su.role = 'superuser' AND sr_su.status = 'active'
  LEFT JOIN public.sv_roles sr_st ON sr_st.user_id = au.id AND sr_st.role = 'staff' AND sr_st.status = 'active'
  LEFT JOIN public.sv_staff_metadata sm ON sm.user_id = au.id
  WHERE sr_su.role IS NOT NULL OR sr_st.role IS NOT NULL
  ORDER BY au.id,
    CASE WHEN sr_su.role IS NOT NULL THEN 1 ELSE 2 END,
    COALESCE(up.display_name, au.email);
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sv_is_superuser() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_set_staff_metadata(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_promote_staff(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_demote_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_promote_superuser(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_demote_superuser(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sv_get_staff_directory() TO authenticated;

-- Seed Cruzer's staff metadata
INSERT INTO public.sv_staff_metadata (user_id, staff_title, badge_text, badge_color, badge_text_color)
VALUES ('ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32', 'Moderator', 'MODERATOR', '#3b82f6', '#ffffff')
ON CONFLICT (user_id) DO UPDATE SET
  staff_title = EXCLUDED.staff_title,
  badge_text = EXCLUDED.badge_text,
  badge_color = EXCLUDED.badge_color,
  badge_text_color = EXCLUDED.badge_text_color;
