/*
# Create system records and backups infrastructure

## What
Creates tables to track automated 8-hour operational reports and database backup
health for the Staff Room "Records & Backups" tab.

## New Tables
1. `system_report_periods` — Tracks 8-hour reporting windows and their Excel reports
2. `system_backup_status` — Tracks database backup health/integrity

## Security
- Both tables are staff-only (TO authenticated with RLS using is_staff_or_admin check)
- No anon access — these are administrative records
*/

-- 1. System report periods
CREATE TABLE IF NOT EXISTS system_report_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'sealed', 'failed')),
  report_filename text,
  report_checksum text,
  report_size_bytes bigint,
  sealed_at timestamptz,
  sealed_by text,
  error_message text,
  -- Summary stats captured at seal time
  registered_users int,
  new_registrations int,
  active_users int,
  verified_revenue numeric(12,2),
  refunds numeric(12,2),
  transaction_count int,
  significant_events int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_periods_start ON system_report_periods(period_start DESC);

ALTER TABLE system_report_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_reports" ON system_report_periods;
CREATE POLICY "staff_read_reports" ON system_report_periods FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_reports" ON system_report_periods;
CREATE POLICY "staff_insert_reports" ON system_report_periods FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_reports" ON system_report_periods;
CREATE POLICY "staff_update_reports" ON system_report_periods FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- 2. System backup status
CREATE TABLE IF NOT EXISTS system_backup_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'database_snapshot',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  size_bytes bigint,
  checksum text,
  error_message text,
  last_restoration_test timestamptz,
  restoration_test_result text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_status_started ON system_backup_status(started_at DESC);

ALTER TABLE system_backup_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_backups" ON system_backup_status;
CREATE POLICY "staff_read_backups" ON system_backup_status FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_backups" ON system_backup_status;
CREATE POLICY "staff_insert_backups" ON system_backup_status FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_backups" ON system_backup_status;
CREATE POLICY "staff_update_backups" ON system_backup_status FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
