/*
# Allow authenticated users to read demo analytics data

## Purpose
Demo hand records stored under `user_id = '__demo__'` are meant to be visible
to all authenticated users as sample/demo data. The existing SELECT policies
require `auth.uid()::text = user_id`, which blocks demo data because no real
user has `auth.uid() = '__demo__'`.

## Changes
1. Add a new SELECT policy on `poker_hand_records` allowing authenticated users
   to read rows where `user_id = '__demo__'`.
2. This is additive — all existing policies remain unchanged. Real user data
   is still protected by the ownership check.

## Security
- Only the `__demo__` sentinel user_id is exposed. All other users' data
  remains protected by the existing `auth.uid()::text = user_id` policies.
- No write access is granted — SELECT only.
*/

DROP POLICY IF EXISTS "demo_data_select" ON poker_hand_records;
CREATE POLICY "demo_data_select"
ON poker_hand_records FOR SELECT
TO authenticated
USING (user_id = '__demo__');
