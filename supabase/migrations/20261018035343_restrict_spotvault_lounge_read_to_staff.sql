/*
# Restrict SpotVault lounge message reads to staff/superuser

## Purpose
The Lounges and Lounge Search feature is restricted to the Founder/CEO
(Jordan McAllister, superuser role) and StakeKings custom portal users.
Previously, the `anon_select_spotvault_lounge` policy allowed anyone
(including anon) to read `community_scope = 'spotvault'` lounge messages.
This tightens that SELECT policy so only staff/superuser/admin roles can
read SpotVault-scope lounge messages.

## Changes
- Drops the old `anon_select_spotvault_lounge` SELECT policy (was: open to anon + authenticated).
- Creates a new `sv_select_lounge_staff_only` SELECT policy restricted to
  authenticated users who pass `sv_is_staff_or_admin()` OR
  `sv_has_universal_access()`.
- The `stakekings` scope policies are unchanged (already restricted via
  partner_attributions).
- The `poker-power` scope policies are unchanged (intentionally open to
  Poker Power portal members).

## Security
- SpotVault-scope lounge messages: now staff/superuser-only reads.
- StakeKings-scope lounge messages: already restricted to active partner
  attribution holders.
- Poker Power-scope lounge messages: unchanged (portal members).
- INSERT/UPDATE/DELETE policies unchanged for all scopes.
*/

DROP POLICY IF EXISTS "anon_select_spotvault_lounge" ON poker_lounge_messages;
DROP POLICY IF EXISTS "sv_select_lounge_staff_only" ON poker_lounge_messages;

CREATE POLICY "sv_select_lounge_staff_only"
ON poker_lounge_messages FOR SELECT
TO authenticated
USING (
  community_scope = 'spotvault'::text
  AND (sv_is_staff_or_admin() OR sv_has_universal_access())
);