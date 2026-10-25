/*
# Add David C. to Staff and Moderator access

## Purpose
Grant the existing David Converse account the limited Staff and Moderator access requested for SpotVault.

## Confirmed account
- Existing auth user ID: 552566a4-8ecf-49ad-a392-dac99dea94c9
- Existing email: dawg8688@yahoo.ca
- Existing username: Converse
- Existing SpotVault ID: SV-000013

## Changes
1. `sv_roles`
   - Add or reactivate the `staff` role.
   - Add or reactivate the `moderator` role.
2. `sv_staff_metadata`
   - Add or update the display title to `Support / Moderator`.
   - Add the standard gold staff/moderator badge metadata.
3. `sv_portal_access`
   - Add or reactivate `staff` portal access for the Staff Room.

## Data preservation
- Uses the existing account only; no account is created.
- Does not modify membership, credits, posts, profile history, or financial permissions.
- Does not grant administrator, owner, founder, superuser, billing, or financial-management roles.

## Security
- Role and portal changes are applied through the migration system with the existing server-side access model.
- No new tables, policies, or public access paths are created.

## Important notes
1. The statements are idempotent and safe to re-run.
2. Existing account and membership information is preserved.
3. The frontend staff directory separately controls the public Our Team presentation.
*/

INSERT INTO public.sv_roles (user_id, role, status, approved_at)
VALUES
  ('552566a4-8ecf-49ad-a392-dac99dea94c9'::uuid, 'staff', 'active', now()),
  ('552566a4-8ecf-49ad-a392-dac99dea94c9'::uuid, 'moderator', 'active', now())
ON CONFLICT (user_id, role) DO UPDATE
SET status = 'active', approved_at = now(), updated_at = now();

INSERT INTO public.sv_staff_metadata (
  user_id,
  staff_title,
  badge_text,
  badge_color,
  badge_text_color,
  badge_icon,
  organization,
  updated_at
)
VALUES (
  '552566a4-8ecf-49ad-a392-dac99dea94c9'::uuid,
  'Support / Moderator',
  'STAFF • MODERATOR',
  '#d4a52c',
  '#0a0908',
  'shield-check',
  'SpotVault',
  now()
)
ON CONFLICT (user_id) DO UPDATE
SET staff_title = 'Support / Moderator',
    badge_text = 'STAFF • MODERATOR',
    badge_color = '#d4a52c',
    badge_text_color = '#0a0908',
    badge_icon = 'shield-check',
    organization = 'SpotVault',
    updated_at = now();

INSERT INTO public.sv_portal_access (user_id, portal_type, status, approved_at)
VALUES (
  '552566a4-8ecf-49ad-a392-dac99dea94c9'::uuid,
  'staff',
  'active',
  now()
)
ON CONFLICT (user_id, portal_type) DO UPDATE
SET status = 'active', approved_at = now(), updated_at = now();