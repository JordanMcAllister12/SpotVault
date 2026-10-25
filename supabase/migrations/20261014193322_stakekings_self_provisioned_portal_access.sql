/*
# StakeKings Self-Provisioned Portal Access

## Purpose
Creates a SECURITY DEFINER function that allows a newly-onboarded StakeKings user
to grant themselves `partner_hub_access` for the `stakekings` partner — but ONLY
if a valid `sk_account_links` row exists linking their SpotVault user_id to a
StakeKings external_user_id. This replaces the previous client-side upsert into
`partner_hub_access`, which was silently failing because the table has deny-all
INSERT/UPDATE RLS policies for the `authenticated` role.

## Security
- The function is SECURITY DEFINER with `search_path = public`.
- It checks `auth.uid()` matches the caller and that a valid `sk_account_links`
  row exists for that user before inserting/updating `partner_hub_access`.
- No parameters accept external input for the target user — the caller's own
  `auth.uid()` is used, preventing privilege escalation.
- Executable by `authenticated` only (not `anon`).
- Also revokes execute from `anon` explicitly.

## Important Notes
1. This function does NOT allow regular SpotVault users to self-grant SK access —
   they would have no `sk_account_links` row, so the function returns an error.
2. The existing `sv_grant_partner_hub_access` admin function remains unchanged
   for staff/admin use.
3. The function is idempotent — if access already exists, it simply returns success.
*/

CREATE OR REPLACE FUNCTION sv_self_provision_stakekings_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_link_exists boolean;
  v_existing partner_hub_access%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  -- Verify the caller has a valid StakeKings account link
  SELECT EXISTS(
    SELECT 1 FROM sk_account_links
      WHERE spotvault_user_id = v_user_id
  ) INTO v_link_exists;

  IF NOT v_link_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No StakeKings account association found.');
  END IF;

  -- Check if access already exists
  SELECT * INTO v_existing FROM partner_hub_access
    WHERE user_id = v_user_id AND partner_slug = 'stakekings'
    FOR UPDATE;

  IF FOUND THEN
    -- Ensure access is granted (in case it was previously revoked)
    IF NOT v_existing.access_granted THEN
      UPDATE partner_hub_access
        SET access_granted = true,
            revoked_by = NULL,
            revoked_at = NULL,
            granted_at = now(),
            updated_at = now()
        WHERE id = v_existing.id;
    END IF;
  ELSE
    INSERT INTO partner_hub_access (user_id, partner_slug, access_granted, granted_at)
      VALUES (v_user_id, 'stakekings', true, now());
  END IF;

  -- Audit the self-provisioning
  INSERT INTO sk_provisioning_audit (event_type, user_id, detail)
    VALUES ('self_provisioned_portal_access', v_user_id,
            jsonb_build_object('partner_slug', 'stakekings', 'method', 'self_provision'));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute only to authenticated (not anon)
REVOKE EXECUTE ON FUNCTION sv_self_provision_stakekings_access() FROM anon;
GRANT EXECUTE ON FUNCTION sv_self_provision_stakekings_access() TO authenticated;
