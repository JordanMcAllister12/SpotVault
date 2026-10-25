/*
# Create admin membership override system

## Purpose
Permanent admin membership overrides. Priority: override > stripe > role > free.

## New Tables
- membership_overrides (user_id uuid PK, tier text, set_by uuid, reason text, timestamps)

## Security
- RLS: staff/superuser via sv_roles can CRUD; users read own.
- SECURITY DEFINER functions: set, get, clear, resolve.

## Seeded
- Jordan (SV-000001), Cruzer (SV-000014), Bryan Paris (SV-000004) → ELITE
*/

CREATE TABLE IF NOT EXISTS membership_overrides (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('free', 'core', 'pro', 'elite')),
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE membership_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_override" ON membership_overrides;
CREATE POLICY "read_own_override"
  ON membership_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "staff_read_all_overrides" ON membership_overrides;
CREATE POLICY "staff_read_all_overrides"
  ON membership_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active'));

DROP POLICY IF EXISTS "staff_insert_override" ON membership_overrides;
CREATE POLICY "staff_insert_override"
  ON membership_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active'));

DROP POLICY IF EXISTS "staff_update_override" ON membership_overrides;
CREATE POLICY "staff_update_override"
  ON membership_overrides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active'));

DROP POLICY IF EXISTS "staff_delete_override" ON membership_overrides;
CREATE POLICY "staff_delete_override"
  ON membership_overrides FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active'));

CREATE OR REPLACE FUNCTION sv_set_membership_override(p_target_user_id uuid, p_tier text, p_reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_is_staff boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active') INTO caller_is_staff;
  IF NOT caller_is_staff THEN RAISE EXCEPTION 'Permission denied: only staff can set membership overrides'; END IF;
  IF p_tier NOT IN ('free','core','pro','elite') THEN RAISE EXCEPTION 'Invalid tier: %', p_tier; END IF;
  INSERT INTO membership_overrides (user_id, tier, set_by, reason) VALUES (p_target_user_id, p_tier, auth.uid(), p_reason)
  ON CONFLICT (user_id) DO UPDATE SET tier = EXCLUDED.tier, set_by = EXCLUDED.set_by, reason = EXCLUDED.reason, updated_at = now();
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_set_membership_override TO authenticated;

CREATE OR REPLACE FUNCTION sv_get_membership_override(p_user_id uuid) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT tier FROM membership_overrides WHERE user_id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION sv_get_membership_override TO authenticated, anon;

CREATE OR REPLACE FUNCTION sv_clear_membership_override(p_target_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_is_staff boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = auth.uid() AND sv_roles.role IN ('staff','superuser') AND sv_roles.status = 'active') INTO caller_is_staff;
  IF NOT caller_is_staff THEN RAISE EXCEPTION 'Permission denied: only staff can clear membership overrides'; END IF;
  DELETE FROM membership_overrides WHERE user_id = p_target_user_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION sv_clear_membership_override TO authenticated;

CREATE OR REPLACE FUNCTION sv_resolve_effective_membership(p_user_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE override_tier text; stripe_tier text; is_staff boolean;
BEGIN
  SELECT tier INTO override_tier FROM membership_overrides WHERE user_id = p_user_id;
  IF override_tier IS NOT NULL THEN RETURN override_tier; END IF;
  SELECT tier_id INTO stripe_tier FROM user_memberships WHERE user_id = p_user_id AND status = 'active' AND (current_period_end IS NULL OR current_period_end > now()) LIMIT 1;
  IF stripe_tier IS NOT NULL THEN RETURN CASE WHEN stripe_tier = 'player' THEN 'free' ELSE stripe_tier END; END IF;
  SELECT EXISTS (SELECT 1 FROM sv_roles WHERE sv_roles.user_id = p_user_id AND sv_roles.role IN ('superuser','staff','universal_access') AND sv_roles.status = 'active') INTO is_staff;
  IF is_staff THEN RETURN 'elite'; END IF;
  RETURN 'free';
END;
$$;
GRANT EXECUTE ON FUNCTION sv_resolve_effective_membership TO authenticated, anon;

-- Seed the three permanent ELITE overrides
INSERT INTO membership_overrides (user_id, tier, reason)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'elite', 'Permanent ELITE — founder override'),
  ('ab8cd4e7-dad2-4d5e-9b5a-3813bf195a32', 'elite', 'Permanent ELITE — admin override'),
  ('d421b1bd-f8c6-4cd0-b68f-40ae275e99ba', 'elite', 'Permanent ELITE — admin override')
ON CONFLICT (user_id) DO UPDATE SET tier = 'elite', reason = EXCLUDED.reason, updated_at = now();
