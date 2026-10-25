/*
# Fix duplicate conversations + add analytics activity log

## 1. Duplicate conversation prevention

### Problem
The `user_inbox_conversations` table has no UNIQUE constraint on the participant pair.
The `get_or_create_conversation` RPC does SELECT-then-INSERT, which races under concurrent
calls, creating duplicate conversation rows for the same pair of users (e.g. "Dylan Ellis"
appears twice in the inbox).

### Changes
- Add a canonical pair expression: `LEAST(participant_a_id, participant_b_id)` and
  `GREATEST(participant_a_id, participant_b_id)` — this normalizes (A,B) and (B,A) to the
  same pair.
- Add a UNIQUE constraint on the canonical pair so the database rejects duplicates at the
  storage level, regardless of column ordering.
- Backfill: merge existing duplicate conversations by keeping the oldest row and pointing
  all messages from newer duplicates to the kept row. This preserves all message history.
- Update `get_or_create_conversation` RPC to use the canonical pair lookup and handle
  unique-constraint violations gracefully (re-select after conflict).

## 2. Analytics activity events table

### New table: `poker_analytics_activity_events`
Persistent log of analytics-related events: uploads, calculations, data clears,
rebuilds. Each event records the user, event type, timestamp, batch/job reference,
hand counts, status, and optional error message. This survives navigation, refresh,
and data clearing.

### Security
- RLS enabled, owner-scoped CRUD (TO authenticated, auth.uid() = user_id).
- user_id defaults to auth.uid() so client inserts that omit user_id succeed.
*/

-- ============================================================
-- 1. Fix duplicate conversations
-- ============================================================

-- Step 1a: Backfill — merge duplicate conversations.
-- For each (canonical pair) group with >1 row, keep the oldest row and
-- repoint messages from newer rows to the kept row.
-- We use a DO block to avoid transaction control issues.
DO $$
DECLARE
  dup_row RECORD;
  keep_id uuid;
BEGIN
  FOR dup_row IN
    SELECT
      LEAST(participant_a_id, participant_b_id) AS pair_lo,
      GREATEST(participant_a_id, participant_b_id) AS pair_hi
    FROM user_inbox_conversations
    GROUP BY LEAST(participant_a_id, participant_b_id), GREATEST(participant_a_id, participant_b_id)
    HAVING count(*) > 1
  LOOP
    -- Keep the oldest conversation for this pair
    SELECT id INTO keep_id
    FROM user_inbox_conversations
    WHERE (participant_a_id = dup_row.pair_lo AND participant_b_id = dup_row.pair_hi)
       OR (participant_a_id = dup_row.pair_hi AND participant_b_id = dup_row.pair_lo)
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- Re-point messages from duplicate rows to the kept row
    UPDATE user_inbox_messages
    SET conversation_id = keep_id
    WHERE conversation_id IN (
      SELECT id FROM user_inbox_conversations
      WHERE id <> keep_id
        AND (
          (participant_a_id = dup_row.pair_lo AND participant_b_id = dup_row.pair_hi)
          OR (participant_a_id = dup_row.pair_hi AND participant_b_id = dup_row.pair_lo)
        )
    );

    -- Copy last_message_preview / last_message_at from the newest duplicate
    -- onto the kept row if the kept row has an older/null preview.
    UPDATE user_inbox_conversations
    SET last_message_at = sub.latest_at,
        last_message_preview = sub.latest_preview
    FROM (
      SELECT last_message_at AS latest_at, last_message_preview AS latest_preview
      FROM user_inbox_conversations
      WHERE (
        (participant_a_id = dup_row.pair_lo AND participant_b_id = dup_row.pair_hi)
        OR (participant_a_id = dup_row.pair_hi AND participant_b_id = dup_row.pair_lo)
      )
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 1
    ) sub
    WHERE user_inbox_conversations.id = keep_id;

    -- Delete the duplicate rows (messages already moved)
    DELETE FROM user_inbox_conversations
    WHERE id <> keep_id
      AND (
        (participant_a_id = dup_row.pair_lo AND participant_b_id = dup_row.pair_hi)
        OR (participant_a_id = dup_row.pair_hi AND participant_b_id = dup_row.pair_lo)
      );
  END LOOP;
END;
$$;

-- Step 1b: Add a generated column for the canonical pair + unique index.
-- Using a functional index on LEAST/GREATEST avoids adding a column.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_conversation_pair
  ON user_inbox_conversations (
    LEAST(participant_a_id, participant_b_id),
    GREATEST(participant_a_id, participant_b_id)
  );

-- Step 1c: Update get_or_create_conversation to handle unique constraint violations.
-- The function now tries INSERT ... ON CONFLICT to atomically get-or-create.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  other_user_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  me text := auth.uid()::text;
BEGIN
  IF me IS NULL OR other_user_id IS NULL OR me = other_user_id THEN
    RAISE EXCEPTION 'Invalid conversation parameters';
  END IF;

  -- Try to find an existing conversation (either direction)
  SELECT id INTO conv_id
  FROM user_inbox_conversations
  WHERE (participant_a_id = me AND participant_b_id = other_user_id)
     OR (participant_a_id = other_user_id AND participant_b_id = me)
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Insert with ON CONFLICT on the canonical pair unique index.
  -- If a race condition caused another session to insert the same pair
  -- between our SELECT and INSERT, this catches the conflict and re-selects.
  BEGIN
    INSERT INTO user_inbox_conversations (participant_a_id, participant_b_id)
    VALUES (me, other_user_id)
    RETURNING id INTO conv_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO conv_id
    FROM user_inbox_conversations
    WHERE (participant_a_id = me AND participant_b_id = other_user_id)
       OR (participant_a_id = other_user_id AND participant_b_id = me)
    LIMIT 1;
  END;

  RETURN conv_id;
END;
$$;

-- ============================================================
-- 2. Analytics activity events table
-- ============================================================

CREATE TABLE IF NOT EXISTS poker_analytics_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT auth.uid()::text,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid,
  job_id uuid,
  mode text,
  hands_submitted integer,
  hands_inserted integer,
  hands_duplicates integer,
  hands_deleted integer,
  status text NOT NULL DEFAULT 'completed',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE poker_analytics_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activity_events" ON poker_analytics_activity_events;
CREATE POLICY "select_own_activity_events"
  ON poker_analytics_activity_events FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_activity_events" ON poker_analytics_activity_events;
CREATE POLICY "insert_own_activity_events"
  ON poker_analytics_activity_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "update_own_activity_events" ON poker_analytics_activity_events;
CREATE POLICY "update_own_activity_events"
  ON poker_analytics_activity_events FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "delete_own_activity_events" ON poker_analytics_activity_events;
CREATE POLICY "delete_own_activity_events"
  ON poker_analytics_activity_events FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_created
  ON poker_analytics_activity_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_type
  ON poker_analytics_activity_events (user_id, event_type, created_at DESC);
