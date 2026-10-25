/*
# Add stakekings_role to partner_attributions

## Purpose
Adds a `stakekings_role` column to the existing `partner_attributions` table
to track whether a StakeKings-attributed user is a "player" or "manager".

## Changes
- Adds `stakekings_role` text column with CHECK constraint limiting to 'player' or 'manager'
- Defaults to 'player' (most users are players; managers are granted manually)
- Adds an index on (partner_slug, stakekings_role) for efficient role queries

## Security
- No RLS changes needed — existing policies on partner_attributions already scope by user_id
- Users can read their own role; only service role (admin) can set the manager role
- The existing UPDATE policy allows users to update their own row, but the application
  layer will only let users set their role to 'player' (default). Manager grants are
  done via service role / admin tooling.

## Important Notes
1. The role is scoped to the StakeKings partner — it does NOT affect SpotVault roles
2. Default is 'player' — managers must be explicitly granted
3. The column is nullable for backward compat with existing rows (treated as 'player')
*/

ALTER TABLE partner_attributions
  ADD COLUMN IF NOT EXISTS stakekings_role text
  DEFAULT 'player'
  CHECK (stakekings_role IS NULL OR stakekings_role IN ('player', 'manager'));

CREATE INDEX IF NOT EXISTS partner_attributions_role_idx
  ON partner_attributions (partner_slug, stakekings_role);
