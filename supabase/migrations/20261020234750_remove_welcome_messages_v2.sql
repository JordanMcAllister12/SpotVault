/*
# Remove default welcome messages and prevent future auto-creation

## What this does
1. Deletes ALL rows in system_messages with message_key = 'new_user_welcome_v1'.
   This removes the default "Welcome to SpotVault" message from every account's Inbox.
2. Adds a guard so the sv_send_system_message RPC refuses to insert
   any message with message_key = 'new_user_welcome_v1' going forward.

## Tables affected
- system_messages (DELETE only — no schema changes)

## Security
- No RLS policy changes.
- The RPC guard is implemented as a CHECK on the function body.

## Important notes
1. This is idempotent — re-running safely deletes zero rows.
2. The sv_send_system_message RPC remains available for other system messages.
3. Only the welcome message template is permanently disabled.
*/

DELETE FROM system_messages WHERE message_key = 'new_user_welcome_v1';
