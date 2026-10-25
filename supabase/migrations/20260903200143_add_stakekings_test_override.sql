/*
# Add StakeKings test override and background config

## Purpose
Adds a `stakekings_test_override` boolean column to `partner_attributions`
so an owner/test account can access BOTH StakeKings Player Portal and
StakeKings Management Hub without needing to change roles back and forth.

Also adds a `stakekings_player_background` and `stakekings_manager_background`
text column to `partner_attributions` metadata for future custom wallpaper
support (initially NULL = neutral dark background).

## Changes
- Adds `stakekings_test_override` boolean DEFAULT false
- Adds `stakekings_player_background` text (nullable — future wallpaper URL)
- Adds `stakekings_manager_background` text (nullable — future wallpaper URL)

## Security
- `stakekings_test_override` is a privileged column — users must NOT be able
  to set it themselves. We REVOKE UPDATE on this column from authenticated
  and only allow service role (admin) to set it.
- The existing UPDATE policy allows users to update their own row, but
  column-level privileges are checked BEFORE policies, so the REVOKE
  prevents users from granting themselves the override.

## Important Notes
1. Only an admin using the service role can enable test_override
2. Normal users cannot self-grant the override
3. Background columns are for future use — NULL means use neutral dark background
4. These columns are scoped to the StakeKings partner only
*/

ALTER TABLE partner_attributions
  ADD COLUMN IF NOT EXISTS stakekings_test_override boolean NOT NULL DEFAULT false;

ALTER TABLE partner_attributions
  ADD COLUMN IF NOT EXISTS stakekings_player_background text;

ALTER TABLE partner_attributions
  ADD COLUMN IF NOT EXISTS stakekings_manager_background text;

-- Revoke the ability for users to set the test_override or background columns themselves
REVOKE UPDATE (stakekings_test_override) ON partner_attributions FROM authenticated;
REVOKE UPDATE (stakekings_player_background) ON partner_attributions FROM authenticated;
REVOKE UPDATE (stakekings_manager_background) ON partner_attributions FROM authenticated;
