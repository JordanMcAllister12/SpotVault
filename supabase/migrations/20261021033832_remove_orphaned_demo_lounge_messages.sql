/*
# Remove orphaned demo messages from poker_lounge_messages

## Problem
The poker-power lounge contains 8 messages authored by fake seed account IDs
(a0000000-0000-0000-0000-00000000000X) that do not exist in auth.users.
These were inserted during initial demo setup and have no real authors.
They cause a false unread notification count of 8 for any real user who
is a member of the poker-power lounge.

## Changes
1. DELETE all poker_lounge_messages rows where the author_id does not
   correspond to a real auth.users account.
2. This is safe because:
   - All 8 messages are from non-existent demo accounts
   - No real user authored any of these messages
   - No real conversation data is lost
   - The messages are seed/demo data, not user-generated content

## Verification
- After deletion, poker_lounge_messages should have 0 rows
- The Groups unread badge should show no count for poker-power members
*/

DELETE FROM poker_lounge_messages
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id::text = poker_lounge_messages.author_id::text
);
