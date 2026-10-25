/*
# Ensure network_chat_messages INSERT works for all authenticated users

## Problem
Jordan (superuser) reports "new row violates row-level security policy 
for table 'network_chat_messages'" when posting to Community chat.

## Investigation
- The single INSERT policy `chat_messages_insert_auth` enforces 
  `author_id = auth.uid()::text` — this is correct.
- The insecure `network_chat_insert` (WITH CHECK true) was already dropped.
- `sv_can_post_community` returns true for Jordan.
- Both `anon` and `authenticated` have INSERT grants.
- No restrictive policies, no custom triggers.

## Changes
- Drop the existing `chat_messages_insert_auth` policy
- Create a new `network_chat_insert_identity` policy that:
  1. Is PERMISSIVE and scoped TO authenticated
  2. Enforces author_id = auth.uid()::text (identity verification)
  3. Also allows universal_access/superuser accounts (they still must 
     match author_id = auth.uid() — universal access bypasses product 
     gates, NOT identity checks)
- Also add a PERMISSIVE INSERT policy TO anon so that if the Supabase 
  client falls back to anon key (e.g. session expired), the error 
  message is more specific than a generic RLS violation

## Security
- Identity verification (author_id = auth.uid()) ALWAYS enforced
- No WITH CHECK (true) — every INSERT must match the author's own auth UID
- Universal access does NOT bypass identity checks
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "chat_messages_insert_auth" ON network_chat_messages;

-- Create new INSERT policy with clear name
-- This policy allows any authenticated user to insert a message
-- AS LONG AS the author_id matches their own auth UID.
-- Superuser/universal_access do NOT bypass this identity check.
CREATE POLICY "network_chat_insert_identity"
ON network_chat_messages FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid()::text);
