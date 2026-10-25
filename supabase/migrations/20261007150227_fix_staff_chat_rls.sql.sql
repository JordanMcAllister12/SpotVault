/*
# Fix Staff/Superuser Chat RLS — Allow Posting Without Paid Membership

## Problem
Staff and superuser accounts receive "new row violates row-level security policy"
when attempting to post or reply in community chat. The INSERT policies on
network_chat_messages and community_posts do not recognize staff/superuser
privileges, blocking them unless they have a paid membership or specific
capability flag.

## Changes

### 1. network_chat_messages — INSERT policy
The existing policy `network_chat_insert_identity` only checks `author_id = auth.uid()::text`.
This is correct for identity verification but doesn't address capability gating.
Added a new policy `network_chat_insert_staff` that allows staff/superuser to
insert messages (still requiring author_id matches auth.uid()).

### 2. community_posts — INSERT policy
The existing policy `community_posts_insert` requires either the
`general_feed_post` capability OR `sv_has_universal_access()`. Staff accounts
that don't have the capability flag or universal access are blocked.
Added a new policy `community_posts_insert_staff` that allows staff/superuser
(via `sv_is_staff_or_admin()`) to insert posts while still requiring
`author_id = auth.uid()`.

## Security
- All new policies still require author_id to match auth.uid() — no anonymous posting.
- Staff recognition uses the existing `sv_is_staff_or_admin()` function, which is
  the canonical SpotVault privilege check.
- Regular users continue following the intended membership/capability rules.
- No tables or columns modified. RLS remains enabled on all tables.
*/

-- network_chat_messages: allow staff/superuser to post
-- Existing identity policy stays; this adds a staff bypass for the capability gate
DROP POLICY IF EXISTS "network_chat_insert_staff" ON network_chat_messages;
CREATE POLICY "network_chat_insert_staff"
ON network_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  sv_is_staff_or_admin()
  AND author_id = (auth.uid())::text
);

-- community_posts: allow staff/superuser to post without paid membership
DROP POLICY IF EXISTS "community_posts_insert_staff" ON community_posts;
CREATE POLICY "community_posts_insert_staff"
ON community_posts FOR INSERT
TO authenticated
WITH CHECK (
  sv_is_staff_or_admin()
  AND author_id = auth.uid()
);

-- poker_lounge_messages: allow staff/superuser to post in any lounge
DROP POLICY IF EXISTS "lounge_insert_staff" ON poker_lounge_messages;
CREATE POLICY "lounge_insert_staff"
ON poker_lounge_messages FOR INSERT
TO authenticated
WITH CHECK (
  sv_is_staff_or_admin()
  AND author_id = auth.uid()
);
