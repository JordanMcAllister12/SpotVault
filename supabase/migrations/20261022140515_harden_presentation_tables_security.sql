/*
# Harden sv_presentation tables security

1. Security Changes
- Revoke ALL privileges from `anon` role on `sv_presentation_recordings` and `sv_presentation_attachments`.
  These tables use `auth.uid()` ownership checks in their RLS policies, which means `anon`
  can never pass the policy checks anyway. The `anon` grants were dead weight that could
  mask future policy regressions.
- Add UPDATE policy to `sv_presentation_attachments` so owners can update attachment
  metadata (e.g., is_intro flag). Previously had SELECT/INSERT/DELETE but no UPDATE,
  yet the grant included UPDATE — so updates were allowed by grant but not by policy,
  causing silent failures.
- Grant only `authenticated` role SELECT/INSERT/UPDATE/DELETE on both tables.
  `service_role` already has access via superuser bypass.

2. Tables Modified
- `sv_presentation_recordings`: revoke anon grants, grant authenticated only.
- `sv_presentation_attachments`: revoke anon grants, grant authenticated only,
  add `update_own_attachments` policy.

3. Important Notes
- RLS remains enabled on both tables (no changes to RLS enable state).
- Existing `authenticated` policies are unchanged — they already enforce `auth.uid()` ownership.
- The `sv_generate_presentation_id()` function remains SECURITY DEFINER with EXECUTE
  granted to `authenticated` only.
*/

-- Revoke anon access on recordings table
REVOKE SELECT, INSERT, UPDATE, DELETE ON sv_presentation_recordings FROM anon;

-- Revoke anon access on attachments table
REVOKE SELECT, INSERT, UPDATE, DELETE ON sv_presentation_attachments FROM anon;

-- Ensure authenticated has CRUD on both tables
GRANT SELECT, INSERT, UPDATE, DELETE ON sv_presentation_recordings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sv_presentation_attachments TO authenticated;

-- Add missing UPDATE policy on attachments (owner-scoped via recording ownership)
DROP POLICY IF EXISTS "update_own_attachments" ON sv_presentation_attachments;
CREATE POLICY "update_own_attachments"
ON sv_presentation_attachments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sv_presentation_recordings r
    WHERE r.id = sv_presentation_attachments.recording_id
    AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sv_presentation_recordings r
    WHERE r.id = sv_presentation_attachments.recording_id
    AND r.user_id = auth.uid()
  )
);
