/*
# StakeKings Phase 1: Seed SK deal, acquisition code, and create auto-attribution RPC

## Purpose
Sets up the canonical StakeKings GROUP=SK attribution infrastructure so users
who sign up through the /sk entry route automatically receive StakeKings
attribution in the existing sv_attribution_records system.

## 1. Seed Data
- Re-seeds the `SK-001` deal (StakeKings Standard Deal, group_code='SK') if missing.
- Re-seeds the `SK` acquisition code (group_code='SK', p1='0', p2='0') if missing.
- These are idempotent — existing records are not overwritten.

## 2. New Function: sv_acquire_user_attribution
- SECURITY DEFINER function that auto-creates an `sv_attribution_records` row
  for a user based on an acquisition code (e.g. 'SK').
- Calls `sv_generate_attribution_id()` for the ATTR-NNNNNNN ID.
- Does NOT overwrite existing attribution if one already exists for the same
  group_code (safe for existing users visiting the /sk route).
- Returns the attribution_id on success, or NULL if attribution already exists.
- Granted to anon + authenticated (called during signup flow).

## 3. New Function: sv_get_user_group_attribution
- SECURITY DEFINER function that returns a user's primary group attribution
  (group_code, p1_code, p2_code, deal_code, attribution_id).
- Used by the frontend to determine if a user has SK attribution and should
  see SK branding + the SK PLAYER DEV badge.
- Only returns rows where status='active'.
- Granted to anon + authenticated.
*/

-- 1. Seed SK deal (idempotent)
INSERT INTO sv_deals (deal_code, label, description, group_code, status)
VALUES ('SK-001', 'StakeKings Standard Deal', 'Standard StakeKings partnership deal', 'SK', 'active')
ON CONFLICT (deal_code) DO NOTHING;

-- 2. Seed SK acquisition code (idempotent)
INSERT INTO sv_acquisition_codes (code, group_code, p1_code, p2_code, deal_id, lounge, skin, content_priority, status)
SELECT 'SK', 'SK', '0', '0', d.id, 'StakeKings', 'StakeKings', 'StakeKings', 'active'
FROM sv_deals d WHERE d.deal_code = 'SK-001'
ON CONFLICT (code) DO NOTHING;

-- 3. Create auto-attribution function
CREATE OR REPLACE FUNCTION public.sv_acquire_user_attribution(p_acquisition_code text DEFAULT 'SK')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  attr_id text;
  existing_id text;
  acq RECORD;
BEGIN
  IF me IS NULL THEN
    RETURN NULL;
  END IF;

  -- Resolve the acquisition code
  SELECT * INTO acq FROM sv_acquisition_codes WHERE code = upper(trim(p_acquisition_code)) AND status = 'active';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check if user already has an attribution with this group_code
  -- Do NOT overwrite existing attribution (safe for existing users)
  SELECT attribution_id INTO existing_id
  FROM sv_attribution_records
  WHERE user_id = me AND group_code = acq.group_code AND status = 'active'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  -- Generate a new attribution ID
  SELECT sv_generate_attribution_id() INTO attr_id;

  -- Insert the attribution record
  INSERT INTO sv_attribution_records (
    attribution_id, user_id, group_code, p1_code, p2_code, deal_id,
    acquisition_code, acquisition_source, status
  ) VALUES (
    attr_id, me, acq.group_code, acq.p1_code, acq.p2_code, acq.deal_id,
    acq.code, 'signup_code', 'active'
  );

  RETURN attr_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_acquire_user_attribution(text) TO anon, authenticated;

-- 4. Create user group attribution lookup function
CREATE OR REPLACE FUNCTION public.sv_get_user_group_attribution()
RETURNS TABLE (
  attribution_id text,
  group_code text,
  p1_code text,
  p2_code text,
  deal_code text,
  acquisition_code text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ar.attribution_id,
    ar.group_code,
    ar.p1_code,
    ar.p2_code,
    d.deal_code,
    ar.acquisition_code,
    ar.status
  FROM sv_attribution_records ar
  LEFT JOIN sv_deals d ON d.id = ar.deal_id
  WHERE ar.user_id = me AND ar.status = 'active'
  ORDER BY
    CASE WHEN ar.group_code <> '0' THEN 0 ELSE 1 END,
    ar.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_get_user_group_attribution() TO anon, authenticated;
