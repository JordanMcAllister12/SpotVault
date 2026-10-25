/*
# Add document_json column to content_spots for document-first editor

1. Modified Tables
- `content_spots`
  - Added `document_json` column (jsonb, nullable) — stores the TipTap/ProseMirror
    document JSON for the new document-first Content Lab editor. This coexists
    with the existing `content_html` (structured mode) and `content_blocks`
    (freeform mode) columns; existing data is untouched.

2. Security
- No RLS policy changes. The column inherits the table's existing RLS policies.
  Ownership is already enforced via `account_id = auth.uid()` on all CRUD policies.

3. Important Notes
- The column is nullable so existing rows are unaffected.
- The frontend will read `document_json` when `spot_type = 'freeform'` and the
  field is non-null, falling back to `content_blocks` for legacy content.
- No data migration is performed — legacy content remains in its original format.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_spots' AND column_name = 'document_json'
  ) THEN
    ALTER TABLE content_spots ADD COLUMN document_json jsonb;
  END IF;
END $$;