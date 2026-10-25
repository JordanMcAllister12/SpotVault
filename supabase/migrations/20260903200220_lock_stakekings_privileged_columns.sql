/*
# Lock StakeKings role and test override columns

## Purpose
Prevents regular authenticated users from changing StakeKings permission
fields through the browser-facing data API.

## Modified Table
- `partner_attributions.stakekings_role` — manager/player permission, admin-controlled only
- `partner_attributions.stakekings_test_override` — owner/testing access switch, admin-controlled only
- `partner_attributions.stakekings_player_background` — future asset slot, admin-controlled only
- `partner_attributions.stakekings_manager_background` — future asset slot, admin-controlled only

## Security
- Revokes UPDATE access to all four privileged/configuration columns from `authenticated`.
- Existing row-level policies remain unchanged for ordinary attribution reads and verification.
- Service role retains administrative access for explicit owner/manager grants.

## Important Notes
1. Normal users cannot self-promote to StakeKings Manager.
2. Normal users cannot self-enable the testing override.
3. Background references remain separate from SpotVault backgrounds.
4. No SpotVault portal permissions are changed.
*/

REVOKE UPDATE (stakekings_role) ON partner_attributions FROM authenticated;
REVOKE UPDATE (stakekings_test_override) ON partner_attributions FROM authenticated;
REVOKE UPDATE (stakekings_player_background) ON partner_attributions FROM authenticated;
REVOKE UPDATE (stakekings_manager_background) ON partner_attributions FROM authenticated;
