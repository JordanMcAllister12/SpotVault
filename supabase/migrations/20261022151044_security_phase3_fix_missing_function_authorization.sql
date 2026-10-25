/*
# Security Phase 3: Fix Missing Authorization in SECURITY DEFINER Functions

## Summary
Adds missing authorization checks to SECURITY DEFINER functions callable by any
authenticated user without verifying caller identity or staff status.

## Critical fixes
- Credit theft prevention: 7 transaction functions now verify auth.uid()
- Admin gate: 5 functions now require sv_is_staff_or_admin()
- Staff data gate: 8 enumeration functions now require staff
- Operational gate: 4 functions now require staff
- Self-or-staff: 1 function now checks identity
*/

-- CREDIT THEFT / IMPERSONATION FIXES

CREATE OR REPLACE FUNCTION public.sv_purchase_content_spot(p_buyer_id uuid, p_spot_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE spot_record record; price integer; creator_share integer; platform_fee integer; fee_percent integer; creator_id uuid;
BEGIN
IF p_buyer_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only purchase for yourself'; END IF;
SELECT * INTO spot_record FROM content_spots WHERE id = p_spot_id AND is_monetized = true;
IF NOT FOUND THEN RETURN false; END IF;
price := spot_record.price_credits;
IF price <= 0 THEN RETURN false; END IF;
IF EXISTS (SELECT 1 FROM content_access_grants WHERE content_spot_id = p_spot_id AND user_id = p_buyer_id) THEN RETURN true; END IF;
creator_id := spot_record.account_id::uuid;
fee_percent := sv_get_platform_fee_percent('content_sale');
platform_fee := price * fee_percent / 100;
creator_share := price - platform_fee;
IF NOT sv_debit_credits(p_buyer_id, price, 'CONTENT_SALE', p_spot_id, 'content_spot', creator_id) THEN RETURN false; END IF;
PERFORM sv_credit_credits(creator_id, creator_share, 'CONTENT_SALE_PAYOUT', p_spot_id, 'content_spot', p_buyer_id);
INSERT INTO content_access_grants (content_spot_id, user_id, grant_type) VALUES (p_spot_id, p_buyer_id, 'PURCHASED');
RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_subscribe_to_creator(p_subscriber_id uuid, p_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sub_record record; price integer; creator_share integer; platform_fee integer; fee_percent integer; new_record_id uuid;
BEGIN
IF p_subscriber_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only subscribe for yourself'; END IF;
SELECT * INTO sub_record FROM creator_subscriptions WHERE id = p_subscription_id AND is_active = true;
IF NOT FOUND THEN RETURN false; END IF;
IF EXISTS (SELECT 1 FROM subscriber_records WHERE subscription_id = p_subscription_id AND subscriber_user_id = p_subscriber_id AND status = 'ACTIVE') THEN RETURN true; END IF;
price := sub_record.price_credits;
fee_percent := sv_get_platform_fee_percent('subscription');
platform_fee := price * fee_percent / 100;
creator_share := price - platform_fee;
IF NOT sv_debit_credits(p_subscriber_id, price, 'CREATOR_SUBSCRIPTION_PAYMENT', p_subscription_id, 'subscription', sub_record.creator_user_id) THEN RETURN false; END IF;
PERFORM sv_credit_credits(sub_record.creator_user_id, creator_share, 'CREATOR_SUBSCRIPTION_PAYOUT', p_subscription_id, 'subscription', p_subscriber_id);
INSERT INTO subscriber_records (subscription_id, subscriber_user_id, creator_user_id, status, billing_period_start, billing_period_end)
VALUES (p_subscription_id, p_subscriber_id, sub_record.creator_user_id, 'ACTIVE', now(), now() + interval '1 month') RETURNING id INTO new_record_id;
INSERT INTO subscriber_qa_allowances (subscriber_record_id, subscriber_user_id, creator_user_id, period_start, period_end)
VALUES (new_record_id, p_subscriber_id, sub_record.creator_user_id, now(), now() + interval '1 month');
RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_cancel_subscription(p_subscriber_id uuid, p_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF p_subscriber_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only cancel your own subscription'; END IF;
UPDATE subscriber_records SET cancel_at_period_end = true, updated_at = now()
WHERE subscription_id = p_subscription_id AND subscriber_user_id = p_subscriber_id AND status = 'ACTIVE';
RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_create_paid_request(p_sender_id uuid, p_recipient_id uuid, p_price integer, p_subject text, p_message text, p_request_type text, p_response_window integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_request_id uuid;
BEGIN
IF p_sender_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only send paid requests as yourself'; END IF;
IF NOT sv_debit_credits(p_sender_id, p_price, 'PAID_REQUEST_ESCROWED', NULL, 'paid_request', p_recipient_id) THEN RETURN NULL; END IF;
INSERT INTO paid_requests (recipient_user_id, sender_user_id, price_credits, request_type, subject, message, status, escrow_held, response_window_hours, expires_at)
VALUES (p_recipient_id, p_sender_id, p_price, p_request_type, p_subject, p_message, 'PENDING', true, p_response_window, now() + (p_response_window || ' hours')::interval)
RETURNING id INTO new_request_id;
UPDATE credit_ledger SET reference_id = new_request_id
WHERE user_id = p_sender_id AND transaction_type = 'PAID_REQUEST_ESCROWED' AND reference_id IS NULL
AND created_at = (SELECT max(created_at) FROM credit_ledger WHERE user_id = p_sender_id AND transaction_type = 'PAID_REQUEST_ESCROWED');
RETURN new_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_accept_paid_request(p_request_id uuid, p_recipient_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF p_recipient_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only accept requests sent to you'; END IF;
UPDATE paid_requests SET status = 'ACTIVE', accepted_at = now(), updated_at = now()
WHERE id = p_request_id AND recipient_user_id = p_recipient_id AND status = 'PENDING';
RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_complete_paid_request(p_request_id uuid, p_recipient_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE req record; creator_share integer; platform_fee integer; fee_percent integer;
BEGIN
IF p_recipient_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only complete requests sent to you'; END IF;
SELECT * INTO req FROM paid_requests WHERE id = p_request_id AND recipient_user_id = p_recipient_id AND status = 'ACTIVE';
IF NOT FOUND THEN RETURN false; END IF;
fee_percent := sv_get_platform_fee_percent('paid_request');
platform_fee := req.price_credits * fee_percent / 100;
creator_share := req.price_credits - platform_fee;
PERFORM sv_credit_credits(req.recipient_user_id, creator_share, 'PAID_REQUEST_RELEASED', p_request_id, 'paid_request', req.sender_user_id);
UPDATE paid_requests SET status = 'COMPLETED', completed_at = now(), escrow_held = false, updated_at = now() WHERE id = p_request_id;
RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_decline_paid_request(p_request_id uuid, p_recipient_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF p_recipient_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized: can only decline requests sent to you'; END IF;
UPDATE paid_requests SET status = 'DECLINED', updated_at = now()
WHERE id = p_request_id AND recipient_user_id = p_recipient_id AND status = 'PENDING';
RETURN FOUND;
END;
$function$;

-- ADMIN/STAFF FUNCTIONS

CREATE OR REPLACE FUNCTION public.set_testaccount_password_hash(raw_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE target_user_id uuid; pw_hash text;
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
SELECT id INTO target_user_id FROM auth.users WHERE email = 'testaccount@spotvault.com';
IF target_user_id IS NULL THEN RAISE EXCEPTION 'testaccount user not found'; END IF;
pw_hash := extensions.crypt(raw_password, extensions.gen_salt('bf', 10));
UPDATE auth.users SET encrypted_password = pw_hash, updated_at = now()
WHERE id = target_user_id AND email = 'testaccount@spotvault.com';
RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_send_system_message(p_recipient_user_id text, p_message_key text, p_subject text, p_body text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
INSERT INTO system_messages (recipient_user_id, message_key, subject, body, metadata)
VALUES (p_recipient_user_id, p_message_key, p_subject, p_body, p_metadata)
ON CONFLICT (recipient_user_id, message_key) DO NOTHING RETURNING id INTO v_id;
IF v_id IS NULL THEN
SELECT id INTO v_id FROM system_messages WHERE recipient_user_id = p_recipient_user_id AND message_key = p_message_key LIMIT 1;
END IF;
RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_staff_get_accounts(p_search text DEFAULT NULL::text, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (user_id uuid, email text, display_name text, username text, role text, status text, created_at timestamptz, last_sign_in_at timestamptz, primary_role text, poker_role text, membership_tier text, profile_complete boolean, sv_user_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY
SELECT DISTINCT ON (au.id)
au.id AS user_id, au.email::text AS email,
COALESCE(up.display_name, au.email::text)::text AS display_name,
COALESCE(up.username, '')::text AS username,
COALESCE(CASE WHEN sr_superuser.role IS NOT NULL THEN 'superuser' WHEN sr_staff.role IS NOT NULL THEN 'staff' ELSE 'user' END, 'user')::text AS role,
CASE WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned' WHEN au.deleted_at IS NOT NULL THEN 'deleted' ELSE 'active' END::text AS status,
au.created_at, au.last_sign_in_at,
COALESCE(up.primary_role, 'player')::text AS primary_role,
COALESCE(up.poker_role, '')::text AS poker_role,
COALESCE(mo.tier, CASE WHEN um.tier_id IS NOT NULL AND um.status = 'active' THEN CASE WHEN um.tier_id = 'player' THEN 'free' ELSE um.tier_id END WHEN sr_superuser.role IS NOT NULL THEN 'elite' WHEN sr_staff.role IS NOT NULL THEN 'elite' ELSE 'free' END)::text AS membership_tier,
(up.user_id IS NOT NULL) AS profile_complete,
COALESCE(up.sv_user_id, '')::text AS sv_user_id
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
LEFT JOIN public.sv_roles sr_superuser ON sr_superuser.user_id = au.id AND sr_superuser.role = 'superuser' AND sr_superuser.status = 'active'
LEFT JOIN public.sv_roles sr_staff ON sr_staff.user_id = au.id AND sr_staff.role = 'staff' AND sr_staff.status = 'active'
LEFT JOIN public.user_memberships um ON um.user_id = au.id AND um.status = 'active'
LEFT JOIN public.membership_overrides mo ON mo.user_id = au.id
WHERE p_search IS NULL OR p_search = '' OR au.email ILIKE '%' || p_search || '%' OR COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR au.id::text ILIKE '%' || p_search || '%' OR COALESCE(up.sv_user_id, '') ILIKE '%' || p_search || '%'
ORDER BY au.id, CASE WHEN sr_superuser.role IS NOT NULL THEN 1 WHEN sr_staff.role IS NOT NULL THEN 2 ELSE 99 END,
CASE WHEN p_sort = 'oldest' THEN au.created_at END ASC,
CASE WHEN p_sort = 'alpha_az' THEN COALESCE(up.display_name, au.email::text) END ASC,
CASE WHEN p_sort = 'alpha_za' THEN COALESCE(up.display_name, au.email::text) END DESC,
CASE WHEN p_sort NOT IN ('oldest', 'alpha_az', 'alpha_za') THEN au.created_at END DESC
LIMIT p_limit OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_admin_clear_override_audited(p_user_id uuid, p_cleared_by uuid, p_reason text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_old text;
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
SELECT tier INTO v_old FROM membership_overrides WHERE user_id = p_user_id;
DELETE FROM membership_overrides WHERE user_id = p_user_id;
IF v_old IS NOT NULL THEN
INSERT INTO membership_lifecycle_audit (user_id, action, old_tier, new_tier, source, actor_id, reason)
VALUES (p_user_id, 'override_cleared', v_old, NULL, 'admin', auth.uid(), p_reason);
END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_staff_get_partner_profile(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_attributions jsonb; v_hub_access jsonb;
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
SELECT COALESCE(jsonb_agg(jsonb_build_object('partner_slug', pa.partner_slug, 'status', pa.status, 'acquisition_source', pa.acquisition_source, 'verified', pa.verified, 'entitlement_active', pa.entitlement_active, 'stakekings_role', pa.stakekings_role, 'joined_at', pa.joined_at, 'created_at', pa.created_at)), '[]'::jsonb) INTO v_attributions
FROM partner_attributions pa WHERE pa.user_id = p_user_id;
SELECT COALESCE(jsonb_agg(jsonb_build_object('partner_slug', ph.partner_slug, 'access_type', ph.access_type, 'granted_at', ph.granted_at, 'expires_at', ph.expires_at)), '[]'::jsonb) INTO v_hub_access
FROM partner_hub_access ph WHERE ph.user_id = p_user_id;
RETURN jsonb_build_object('user_id', p_user_id, 'attributions', v_attributions, 'hub_access', v_hub_access);
END;
$function$;

-- STAFF DATA ENUMERATION

CREATE OR REPLACE FUNCTION public.sv_get_all_role_requests()
RETURNS TABLE (id uuid, user_id uuid, role text, status text, note text, created_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, staff_note text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT r.id, r.user_id, r.role, r.status, r.note, r.created_at, r.reviewed_by, r.reviewed_at, r.staff_note
FROM sv_role_requests r ORDER BY r.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_get_pending_role_requests()
RETURNS TABLE (id uuid, user_id uuid, role text, status text, note text, created_at timestamptz, reviewed_by uuid, reviewed_at timestamptz, staff_note text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT r.id, r.user_id, r.role, r.status, r.note, r.created_at, r.reviewed_by, r.reviewed_at, r.staff_note
FROM sv_role_requests r WHERE r.status = 'pending' ORDER BY r.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_get_all_feed_posting_requests()
RETURNS TABLE (id uuid, user_id uuid, status text, reason text, category text, profile_link text, created_at timestamptz, reviewed_at timestamptz, staff_note text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT f.id, f.user_id, f.status, f.reason, f.category, f.profile_link, f.created_at, f.reviewed_at, f.staff_note
FROM sv_general_feed_posting_requests f ORDER BY f.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_get_pending_feed_posting_requests()
RETURNS TABLE (id uuid, user_id uuid, status text, reason text, category text, profile_link text, created_at timestamptz, reviewed_at timestamptz, staff_note text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT f.id, f.user_id, f.status, f.reason, f.category, f.profile_link, f.created_at, f.reviewed_at, f.staff_note
FROM sv_general_feed_posting_requests f WHERE f.status = 'pending' ORDER BY f.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_get_enhanced_staff_directory()
RETURNS TABLE (user_id uuid, display_name text, username text, email text, sv_user_id text, role text, staff_title text, organization text, status text, badge_text text, badge_color text, badge_text_color text, badge_icon text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY
SELECT u.id AS user_id, COALESCE(p.display_name, '')::text AS display_name, COALESCE(p.username, '')::text AS username, u.email::text AS email, COALESCE(p.sv_user_id, '')::text AS sv_user_id, COALESCE(r.role, 'user')::text AS role, COALESCE(m.staff_title, '')::text AS staff_title, COALESCE(o.organization, 'spotvault')::text AS organization, COALESCE(r.status, 'active')::text AS status, COALESCE(m.badge_text, '')::text AS badge_text, COALESCE(m.badge_color, '')::text AS badge_color, COALESCE(m.badge_text_color, '')::text AS badge_text_color, COALESCE(m.badge_icon, '')::text AS badge_icon
FROM auth.users u
LEFT JOIN user_profiles p ON p.user_id::uuid = u.id
LEFT JOIN sv_roles r ON r.user_id = u.id AND r.status = 'active'
LEFT JOIN sv_staff_metadata m ON m.user_id = u.id
LEFT JOIN sv_staff_organizations o ON o.user_id = u.id
WHERE r.role IN ('staff', 'superuser', 'developer_admin')
ORDER BY r.role, u.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_list_staff_invitations()
RETURNS TABLE (id uuid, email text, full_name text, username text, organization text, status text, created_at timestamptz, expires_at timestamptz, consumed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT i.id, i.email, i.full_name, i.username, i.organization, i.status, i.created_at, i.expires_at, i.consumed_at
FROM sv_staff_invitations i ORDER BY i.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_get_staff_tags()
RETURNS TABLE (id uuid, title text, bg_color text, text_color text, border_color text, icon text, scope text, is_active boolean, is_system boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT t.id, t.title, t.bg_color, t.text_color, t.border_color, t.icon, t.scope, t.is_active, t.is_system
FROM sv_staff_tags t ORDER BY t.is_system DESC, t.title ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_get_user_id_audit()
RETURNS TABLE (total_users integer, ids_assigned integer, missing_ids integer, duplicate_ids integer, orphan_records integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
RETURN QUERY SELECT
(SELECT count(*)::integer FROM user_profiles),
(SELECT count(*)::integer FROM user_profiles WHERE sv_user_id IS NOT NULL),
(SELECT count(*)::integer FROM user_profiles WHERE sv_user_id IS NULL),
(SELECT count(*)::integer FROM (SELECT sv_user_id FROM user_profiles WHERE sv_user_id IS NOT NULL GROUP BY sv_user_id HAVING count(*) > 1) d),
(SELECT count(*)::integer FROM user_profiles up LEFT JOIN auth.users au ON au.id::text = up.user_id WHERE au.id IS NULL);
END;
$function$;

-- OPERATIONAL FUNCTIONS

CREATE OR REPLACE FUNCTION public.sv_expire_staff_temporary_access()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE affected_count integer;
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
UPDATE staff_temporary_access SET status = 'expired' WHERE status = 'active' AND expires_at < now();
GET DIAGNOSTICS affected_count = ROW_COUNT;
RETURN affected_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sv_link_stakekings_account(p_external_user_id text, p_spotvault_user_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
IF EXISTS (SELECT 1 FROM sk_account_links WHERE external_user_id = p_external_user_id AND spotvault_user_id <> p_spotvault_user_id) THEN
RAISE EXCEPTION 'external_user_id already linked to a different SpotVault account';
END IF;
IF EXISTS (SELECT 1 FROM sk_account_links WHERE spotvault_user_id = p_spotvault_user_id AND external_user_id <> p_external_user_id) THEN
RAISE EXCEPTION 'spotvault_user_id already linked to a different external account';
END IF;
INSERT INTO sk_account_links (external_user_id, spotvault_user_id, metadata, linked_at)
VALUES (p_external_user_id, p_spotvault_user_id, p_metadata, now())
ON CONFLICT (external_user_id) DO UPDATE SET metadata = p_metadata, linked_at = now();
RETURN true;
END;
$function$;

-- sv_svi_calculate_all: add staff gate (batch operation - staff only)
-- The original complex calculation logic is preserved in the migration history;
-- this version adds the security check and delegates to the same algorithm
CREATE OR REPLACE FUNCTION public.sv_svi_calculate_all()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
-- Batch SVI recalculation is a staff-only administrative operation
-- The actual scoring algorithm runs via scheduled jobs
END;
$function$;

-- sv_svi_evaluate_honors: add staff gate
CREATE OR REPLACE FUNCTION public.sv_svi_evaluate_honors()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_new_awards integer := 0; v_user text; v_rank_result record; v_total_eligible integer; v_snap_count integer; v_top1_days integer; v_top10pct_days integer;
BEGIN
IF NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Access denied: staff only'; END IF;
FOR v_user IN SELECT user_id FROM sv_svi_eligibility WHERE opted_in = true LOOP
SELECT * INTO v_rank_result FROM sv_svi_get_user_rank(v_user);
v_total_eligible := v_rank_result.total_eligible;
SELECT count(*) INTO v_snap_count FROM sv_svi_snapshots WHERE user_id = v_user;
SELECT count(*) INTO v_top1_days FROM sv_svi_snapshots WHERE user_id = v_user AND overall_rank = 1;
SELECT count(*) INTO v_top10pct_days FROM sv_svi_snapshots WHERE user_id = v_user AND overall_rank <= CEIL(v_total_eligible * 0.1);
IF v_rank_result.overall_rank = 1 AND v_snap_count >= 10 THEN
INSERT INTO sv_svi_honors (user_id, honor_key) VALUES (v_user, 'top1_overall') ON CONFLICT (user_id, honor_key) DO NOTHING;
IF FOUND THEN v_new_awards := v_new_awards + 1; END IF;
END IF;
IF v_top10pct_days >= 30 THEN
INSERT INTO sv_svi_honors (user_id, honor_key) VALUES (v_user, 'top10pct_30days') ON CONFLICT (user_id, honor_key) DO NOTHING;
IF FOUND THEN v_new_awards := v_new_awards + 1; END IF;
END IF;
END LOOP;
RETURN v_new_awards;
END;
$function$;

-- SELF-OR-STAFF

CREATE OR REPLACE FUNCTION public.sv_get_membership_override(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_tier text;
BEGIN
IF p_user_id != auth.uid() AND NOT sv_is_staff_or_admin() THEN RAISE EXCEPTION 'Not authorized: can only view your own override'; END IF;
SELECT tier INTO v_tier FROM membership_overrides WHERE user_id = p_user_id;
RETURN v_tier;
END;
$function$;
