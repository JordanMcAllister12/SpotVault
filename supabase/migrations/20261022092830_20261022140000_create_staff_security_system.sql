/*
# Staff Security & Access Control System

## Purpose
Creates the database infrastructure for:
1. Founder-controlled Google Authenticator (TOTP) requirement for Staff Console access
2. Temporary administrative access grants for non-founder staff
3. Security audit logging for all staff access events

## New Tables

### staff_security_config
- Singleton configuration row controlling the founder's MFA requirement
- `mfa_required` (boolean, default false) — when true, entering Staff Console requires a valid TOTP code
- `session_timeout_minutes` (integer, default 30) — how long an elevated staff session lasts
- `updated_by` (uuid) — the founder who last changed the setting
- `updated_at` (timestamptz) — when the setting was last changed
- Only one row exists (enforced by a singleton check)

### staff_temporary_access
- Records temporary administrative access grants for non-founder staff
- `granted_to` (uuid) — the staff member receiving access
- `granted_by` (uuid) — the founder who granted access
- `permission_level` (text) — 'read_only' | 'support_admin' | 'custom'
- `permissions` (jsonb) — specific capabilities granted (for custom level)
- `reason` (text) — why access was granted
- `expires_at` (timestamptz) — when the grant expires
- `revoked_at` (timestamptz, nullable) — when access was revoked early
- `revoked_by` (uuid, nullable) — who revoked it
- `status` (text) — 'active' | 'expired' | 'revoked'

## Security
- RLS enabled on both tables
- Only authenticated users can read
- Only the founder (superuser role) can insert/update/delete
- Uses sv_is_staff_or_admin() for founder identification

## Important Notes
1. MFA is NOT activated by default — mfa_required defaults to false
2. The founder can enroll their authenticator and test before enabling
3. Temporary access grants expire automatically based on expires_at
4. All changes are logged to sv_access_audit_log
*/