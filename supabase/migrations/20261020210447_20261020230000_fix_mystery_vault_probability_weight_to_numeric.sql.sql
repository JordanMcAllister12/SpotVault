/*
# Fix Mystery Vault probability_weight column type

## Problem
The `probability_weight` column on `mystery_vault_rewards` was defined as `integer`,
but the reward creation form sends fractional values (e.g. 0.01). Postgres rejects
the insert/update with "invalid input syntax for type integer" or rounds to 0,
causing the "Failed to save reward" error.

## Changes
1. Alter `mystery_vault_rewards.probability_weight` from `integer` to `numeric(10,4)`.
   - Using `USING probability_weight::numeric` to safely convert existing integer data.
   - Default remains 100 to preserve existing behavior for rewards created with the
     old integer default.
2. No RLS policy changes — all existing policies remain intact.

## Security
- No RLS changes. Existing staff-only CRUD policies on mystery_vault_rewards are preserved.
*/

ALTER TABLE mystery_vault_rewards
  ALTER COLUMN probability_weight TYPE numeric(10,4) USING probability_weight::numeric;

ALTER TABLE mystery_vault_rewards
  ALTER COLUMN probability_weight SET DEFAULT 100;