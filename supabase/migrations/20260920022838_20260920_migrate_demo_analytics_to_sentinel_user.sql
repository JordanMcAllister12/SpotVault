/*
# Migrate demo analytics dataset to canonical sentinel user ID

The original 7,028-hand demo dataset was stored under user_id = 'acc-jordan',
a legacy demo ID that no longer matches any auth.users row. The real Jordan
auth UUID is '17ca0743-ccdb-4d43-ab24-f84aa2821170'.

To make this dataset available as a platform-wide demo fallback without
attributing it to any specific user, migrate all rows to the canonical
sentinel ID: '__demo__'

Personal user snapshots (Bryan's real UUID) are left untouched.
*/

-- Migrate the demo snapshot
UPDATE poker_analytics_snapshots
SET user_id = '__demo__'
WHERE user_id = 'acc-jordan';

-- Migrate the demo import batches
UPDATE poker_import_batches
SET user_id = '__demo__'
WHERE user_id = 'acc-jordan';

-- Migrate the demo hand records (needed for recalculation queries)
UPDATE poker_hand_records
SET user_id = '__demo__'
WHERE user_id = 'acc-jordan';
