/*
# Configurable Report System & Transaction Reconciliation

## Purpose
Extends the existing system_report_periods table with configurable frequency,
report content categories, and reconciliation tracking. Adds a new
system_report_config table for persisting scheduling and category settings.

## 1. New Tables
- `system_report_config` — Single-row configuration table for report scheduling
  and category selection. Stores frequency_hours, enabled_categories (JSON array),
  last_run_at, next_run_at, last_error, and updated_by/updated_at for audit.

## 2. Modified Tables
- `system_report_periods` — Adds columns:
  - `categories_included` (jsonb): which categories were captured in this report
  - `category_counts` (jsonb): per-category record counts at seal time
  - `reconciliation_status` (text): matched / difference / pending / unavailable
  - `reconciliation_data` (jsonb): comparison between report and live transaction totals
  - `generation_notes` (text): optional notes about generation

## 3. Security
- `system_report_config` uses same RLS pattern as system_report_periods (authenticated only)
- Existing policies on system_report_periods remain unchanged; new columns inherit existing access

## 4. Important Notes
1. Existing report rows are unaffected — new columns are nullable
2. A default config row is inserted with frequency_hours=8 and all categories enabled
3. Category configuration controls what appears in scheduled reports only —
   it does NOT disable underlying security, financial, or audit logging
4. Reconciliation status defaults to 'pending' for new reports and is updated
   when an administrator views transactions for that report's window
*/

-- 1. Create report configuration table (single-row)
CREATE TABLE IF NOT EXISTS system_report_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency_hours int NOT NULL DEFAULT 8 CHECK (frequency_hours IN (1, 2, 4, 8, 12, 24)),
  enabled_categories jsonb NOT NULL DEFAULT '["financial","users","platform","support","security"]'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_report_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_report_config" ON system_report_config;
CREATE POLICY "staff_read_report_config" ON system_report_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_report_config" ON system_report_config;
CREATE POLICY "staff_insert_report_config" ON system_report_config
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_report_config" ON system_report_config;
CREATE POLICY "staff_update_report_config" ON system_report_config
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Insert default config row if none exists
INSERT INTO system_report_config (frequency_hours, enabled_categories)
SELECT 8, '["financial","users","platform","support","security"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM system_report_config);

-- 2. Add columns to system_report_periods
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_report_periods' AND column_name = 'categories_included') THEN
    ALTER TABLE system_report_periods ADD COLUMN categories_included jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_report_periods' AND column_name = 'category_counts') THEN
    ALTER TABLE system_report_periods ADD COLUMN category_counts jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_report_periods' AND column_name = 'reconciliation_status') THEN
    ALTER TABLE system_report_periods ADD COLUMN reconciliation_status text DEFAULT 'pending' CHECK (reconciliation_status IN ('matched', 'difference', 'pending', 'unavailable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_report_periods' AND column_name = 'reconciliation_data') THEN
    ALTER TABLE system_report_periods ADD COLUMN reconciliation_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_report_periods' AND column_name = 'generation_notes') THEN
    ALTER TABLE system_report_periods ADD COLUMN generation_notes text;
  END IF;
END $$;
