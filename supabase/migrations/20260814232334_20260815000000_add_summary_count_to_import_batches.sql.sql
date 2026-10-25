-- Add separate counters for tournament summaries and import type
ALTER TABLE poker_import_batches ADD COLUMN IF NOT EXISTS summary_count integer DEFAULT 0;
ALTER TABLE poker_import_batches ADD COLUMN IF NOT EXISTS import_type text DEFAULT 'hh';
