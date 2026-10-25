/*
# Grant Dylan Ellis (SV-000017) Staff + Moderator access with Elite membership and custom badge

## Purpose
Grants Dylan Ellis permanent complimentary Elite membership, Staff + Moderator roles,
Staff Room portal access, and a custom gold "STAFF • MODERATOR" badge.

## Target user
- Auth user ID: 707244f4-fe47-4065-8365-5747ba0956fc
- Username: Ellis204
- SV ID: SV-000017
- Email: ellis2044@hotmail.com

## Changes (all idempotent via ON CONFLICT)
1. sv_roles: Insert 'staff' and 'moderator' roles (status='active')
   - Does NOT grant superuser, founder, or billing/financial permissions
2. membership_overrides: Insert 'elite' tier (permanent, no Stripe subscription)
3. sv_staff_metadata: Insert custom badge with text 'STAFF • MODERATOR', gold colors
4. sv_portal_access: Grant 'player', 'staff', 'creator', 'coach', 'media' portals
   - Covers Staff Room (staff portal) and standard content portals

## Security
- These inserts run via the migration system (service role), bypassing RLS.
- Frontend Staff management interface can edit these rows afterwards because:
  - membership_overrides has staff/superuser RLS policies for CRUD
  - sv_staff_metadata has superuser-write RLS policy
  - sv_roles mutations go through sv_grant_role SECURITY DEFINER function
- No Stripe subscription is created — membership_overrides provides complimentary access
- No superuser, founder, admin, or owner role is granted

## Important Notes
1. All inserts use ON CONFLICT DO UPDATE for idempotency
2. No financial/billing permissions granted
3. Badge is configurable through Staff management interface (sv_staff_metadata)
4. Role assignments are editable through Staff management (sv_roles via sv_grant_role/sv_revoke_role)
*/

-- ============================================================
-- 1. ROLES: staff + moderator (NOT superuser/founder/admin)
-- ============================================================
INSERT INTO sv_roles (user_id, role, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'staff', 'active', now())
ON CONFLICT (user_id, role) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

INSERT INTO sv_roles (user_id, role, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'moderator', 'active', now())
ON CONFLICT (user_id, role) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

-- ============================================================
-- 2. MEMBERSHIP OVERRIDE: Permanent complimentary Elite (no Stripe)
-- ============================================================
INSERT INTO membership_overrides (user_id, tier, reason)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'elite', 'Permanent complimentary Elite — Staff/Moderator access')
ON CONFLICT (user_id) DO UPDATE
  SET tier = 'elite', reason = 'Permanent complimentary Elite — Staff/Moderator access', updated_at = now();

-- ============================================================
-- 3. STAFF BADGE: Custom gold "STAFF • MODERATOR" badge
-- ============================================================
INSERT INTO sv_staff_metadata (user_id, staff_title, badge_text, badge_color, badge_text_color, badge_icon, updated_at)
VALUES (
  '707244f4-fe47-4065-8365-5747ba0956fc',
  'Staff • Moderator',
  'STAFF • MODERATOR',
  '#d4a52c',
  '#0a0908',
  'shield-check',
  now()
)
ON CONFLICT (user_id) DO UPDATE
  SET staff_title = 'Staff • Moderator',
      badge_text = 'STAFF • MODERATOR',
      badge_color = '#d4a52c',
      badge_text_color = '#0a0908',
      badge_icon = 'shield-check',
      updated_at = now();

-- ============================================================
-- 4. PORTAL ACCESS: Staff Room + standard portals
-- ============================================================
INSERT INTO sv_portal_access (user_id, portal_type, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'player', 'active', now())
ON CONFLICT (user_id, portal_type) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

INSERT INTO sv_portal_access (user_id, portal_type, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'staff', 'active', now())
ON CONFLICT (user_id, portal_type) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

INSERT INTO sv_portal_access (user_id, portal_type, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'creator', 'active', now())
ON CONFLICT (user_id, portal_type) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

INSERT INTO sv_portal_access (user_id, portal_type, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'coach', 'active', now())
ON CONFLICT (user_id, portal_type) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();

INSERT INTO sv_portal_access (user_id, portal_type, status, approved_at)
VALUES ('707244f4-fe47-4065-8365-5747ba0956fc', 'media', 'active', now())
ON CONFLICT (user_id, portal_type) DO UPDATE
  SET status = 'active', approved_at = now(), updated_at = now();
