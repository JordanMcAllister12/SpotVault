/*
# Update sv_manual_hand_records source to allow 'constructed'

1. Changes
- Drop existing check constraint that restricted source to 'manual'.
- Add new check constraint allowing 'manual' and 'constructed'.
- Update existing rows: set source = 'constructed' where source = 'manual'.
- Change column default from 'manual' to 'constructed' so future inserts get the right value.
2. Security
- No RLS or policy changes. Table already has anon/authenticated CRUD policies.
3. Notes
- The column already exists as text. This migration only updates the constraint, data, and default.
- Constructed hands are hands built via the Construct Hand builder UI and saved by the user.
*/

ALTER TABLE sv_manual_hand_records DROP CONSTRAINT IF EXISTS sv_manual_hand_records_source_check;

ALTER TABLE sv_manual_hand_records ADD CONSTRAINT sv_manual_hand_records_source_check
  CHECK (source = 'manual' OR source = 'constructed');

UPDATE sv_manual_hand_records SET source = 'constructed' WHERE source = 'manual';

ALTER TABLE sv_manual_hand_records ALTER COLUMN source SET DEFAULT 'constructed';
