-- Add mode column to poker_import_batches to track MTT/CASH destination
ALTER TABLE poker_import_batches ADD COLUMN IF NOT EXISTS mode text DEFAULT 'cash';
