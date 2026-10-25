/*
# Add notification dismissal + new issue categories

## Purpose
1. Adds a `dismissed_at` column to the `notifications` table so users can
   individually dismiss non-chat notifications (support ticket alerts,
   announcements, system notices) from their unified communications inbox.
   Dismissal is per-user and per-notification — the underlying ticket or
   announcement is NOT deleted.
2. Adds two new categories to the `issues` table CHECK constraint:
   `feature_suggestion` and `report_user_safety`, replacing the old
   three-card support selection with a single universal form.

## Modified Tables

### `notifications`
- Added `dismissed_at` (timestamptz, nullable). When non-null, the
  notification is hidden from the user's unified inbox list. The row is
  NOT deleted — it can still be accessed through its authoritative
  destination (ticket, announcement, etc.).
- Added `idx_notifications_user_undismissed` index for efficient querying
  of undismissed notifications (WHERE dismissed_at IS NULL).

### `issues`
- Category CHECK constraint expanded to include `feature_suggestion`
  and `report_user_safety`.

## Security
- The existing RLS policies on `notifications` already allow users to
  UPDATE their own rows — the new `dismissed_at` column is covered by
  the existing UPDATE policy. No new policies needed.
- The existing `issues` RLS policies are unchanged.

## Important Notes
1. `dismissed_at` is separate from `is_read`/`read_at`. A notification
   can be read (bell count cleared) but not dismissed (still visible in
   the unified inbox), or dismissed (hidden from inbox) but the bell
   read state is unchanged.
2. DM notifications (type = 'dm') should NEVER be dismissed by the UI —
   the dismiss button is only shown for non-chat notifications. No DB
   constraint prevents it, but the frontend enforces this distinction.
3. The migration is idempotent — uses IF NOT EXISTS for the column and
   DO $$ block for the constraint swap.
*/

-- Add dismissed_at to notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'dismissed_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN dismissed_at timestamptz;
  END IF;
END $$;

-- Index for efficient querying of undismissed notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_undismissed
  ON notifications (user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

-- Expand issues category CHECK constraint to include new categories
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'issues' AND constraint_name = 'issues_category_check'
  ) THEN
    ALTER TABLE issues DROP CONSTRAINT issues_category_check;
  END IF;
END $$;

-- Add the new constraint with expanded categories
ALTER TABLE issues ADD CONSTRAINT issues_category_check
  CHECK (category IN (
    'bug_technical',
    'hand_history',
    'analytics_spr',
    'solver',
    'spots_marketplace',
    'payments_membership',
    'account_login',
    'feature_suggestion',
    'report_user_safety',
    'other'
  ));
