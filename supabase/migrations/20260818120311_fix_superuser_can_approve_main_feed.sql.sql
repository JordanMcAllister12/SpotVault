/*
# Allow superusers to approve/revoke Main Feed posting

## Summary
The existing `sv_approve_general_feed_posting` and `sv_revoke_general_feed_posting`
functions only allowed the 'staff' role to approve/revoke. Superusers should
also be able to manage Main Feed posting access. This updates both functions
to also accept the 'superuser', 'admin', and 'owner' roles.

## Changes
1. `sv_approve_general_feed_posting` — adds superuser/admin/owner to the authorization check
2. `sv_revoke_general_feed_posting` — adds superuser/admin/owner to the authorization check

## Security
- SECURITY DEFINER functions, search_path locked to public.
- No RLS policy changes.
*/

CREATE OR REPLACE FUNCTION public.sv_approve_general_feed_posting(p_request_id uuid, p_staff_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_user_id uuid;
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM sv_roles
  WHERE sv_roles.user_id = auth.uid()
  AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
  AND sv_roles.status = 'active'
) THEN
  RAISE EXCEPTION 'Not authorized: staff only';
END IF;

SELECT user_id INTO v_user_id FROM sv_general_feed_posting_requests WHERE id = p_request_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

UPDATE sv_general_feed_posting_requests
SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
staff_note = p_staff_note, updated_at = now()
WHERE id = p_request_id;

INSERT INTO sv_user_capabilities (user_id, capability, status, granted_by, source_request_id)
VALUES (v_user_id, 'general_feed_post', 'active', auth.uid(), p_request_id)
ON CONFLICT (user_id, capability)
DO UPDATE SET status = 'active', granted_by = auth.uid(), granted_at = now(),
revoked_by = NULL, revoked_at = NULL, source_request_id = p_request_id;

INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
VALUES (auth.uid(), 'feed_posting_approved', v_user_id,
jsonb_build_object('request_id', p_request_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_revoke_general_feed_posting(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_user_id uuid;
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM sv_roles
  WHERE sv_roles.user_id = auth.uid()
  AND sv_roles.role IN ('staff', 'superuser', 'admin', 'owner')
  AND sv_roles.status = 'active'
) THEN
  RAISE EXCEPTION 'Not authorized: staff only';
END IF;

SELECT user_id INTO v_user_id FROM sv_general_feed_posting_requests WHERE id = p_request_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

UPDATE sv_general_feed_posting_requests
SET status = 'revoked', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
WHERE id = p_request_id;

UPDATE sv_user_capabilities
SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
WHERE user_id = v_user_id AND capability = 'general_feed_post';

INSERT INTO sv_access_audit_log (actor_id, action, target_user_id, metadata)
VALUES (auth.uid(), 'feed_posting_revoked', v_user_id,
jsonb_build_object('request_id', p_request_id));
END;
$function$;
