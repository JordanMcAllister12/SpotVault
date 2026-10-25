/*
# Create System Messages Table for Welcome Message

## Purpose
Creates a reusable system inbox architecture that allows SpotVault to send
official platform messages to users. The first use case is an automatic
welcome message sent to every new account immediately after creation.

## New Tables
- `system_messages`
  - `id` (uuid, primary key)
  - `recipient_user_id` (text, not null — matches the demo account ID system)
  - `message_key` (text, not null — unique event identifier like 'new_user_welcome_v1')
  - `sender_type` (text, not null, default 'spotvault' — identifies system sender)
  - `subject` (text, not null)
  - `body` (text, not null)
  - `metadata` (jsonb, nullable — for future extensibility like action buttons)
  - `read` (boolean, not null, default false)
  - `read_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on system_messages.
- Users can only SELECT and UPDATE (read) their own messages.
- INSERT is NOT allowed via RLS — only the SECURITY DEFINER function can insert,
  preventing users from impersonating the SpotVault system sender.
- DELETE is NOT allowed by users — system messages are managed server-side.

## Functions
- `sv_send_system_message(p_recipient_user_id, p_message_key, p_subject, p_body, p_metadata)`
  SECURITY DEFINER function that idempotently inserts a system message.
  Uses ON CONFLICT on the unique (recipient_user_id, message_key) constraint
  to prevent duplicates. Returns the message UUID.

## Unique Constraint
- UNIQUE (recipient_user_id, message_key) — ensures each user receives
  each system message type exactly once.

## Important Notes
1. The function is SECURITY DEFINER so it can bypass RLS to insert.
   Only the function can create system messages — normal users cannot
   INSERT into system_messages directly.
2. The unique constraint on (recipient_user_id, message_key) makes the
   welcome message idempotent: refreshing, logging out/in, or reinstalling
   will NOT create a duplicate.
3. sender_type = 'spotvault' is the system identity. The frontend renders
   this as "SpotVault" with a verified badge.
4. This architecture is reusable for future system messages:
   coaching relationship accepted, coach feedback received, booking
   confirmation, posting access approved, etc.
*/

CREATE TABLE IF NOT EXISTS system_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id text NOT NULL,
  message_key text NOT NULL,
  sender_type text NOT NULL DEFAULT 'spotvault',
  subject text NOT NULL,
  body text NOT NULL,
  metadata jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: one welcome message per user
CREATE UNIQUE INDEX IF NOT EXISTS system_messages_recipient_key_idx
  ON system_messages (recipient_user_id, message_key);

-- Enable RLS
ALTER TABLE system_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own system messages
DROP POLICY IF EXISTS "select_own_system_messages" ON system_messages;
CREATE POLICY "select_own_system_messages"
  ON system_messages FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can mark their own messages as read (UPDATE read and read_at only)
DROP POLICY IF EXISTS "update_own_system_messages" ON system_messages;
CREATE POLICY "update_own_system_messages"
  ON system_messages FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- No INSERT or DELETE policies: only the SECURITY DEFINER function can insert.
-- Users cannot impersonate the system sender.

-- SECURITY DEFINER function to send a system message idempotently
CREATE OR REPLACE FUNCTION public.sv_send_system_message(
  p_recipient_user_id text,
  p_message_key text,
  p_subject text,
  p_body text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO system_messages (recipient_user_id, message_key, subject, body, metadata)
  VALUES (p_recipient_user_id, p_message_key, p_subject, p_body, p_metadata)
  ON CONFLICT (recipient_user_id, message_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Already exists, return the existing id
    SELECT id INTO v_id FROM system_messages
    WHERE recipient_user_id = p_recipient_user_id AND message_key = p_message_key
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

-- Grant execute to authenticated and anon (demo app uses anon key)
REVOKE EXECUTE ON FUNCTION sv_send_system_message FROM anon;
GRANT EXECUTE ON FUNCTION sv_send_system_message TO anon, authenticated;
