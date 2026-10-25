/*
# Backfill Jordan's StakeKings partner hub access

Jordan (superuser) should have StakeKings hub access in the database,
not just in the frontend DEMO_ACCOUNTS array. This ensures consistency
between the database and the frontend when Jordan logs in via auth.
*/

INSERT INTO public.partner_hub_access (user_id, partner_slug, access_granted, granted_by, granted_at)
VALUES (
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  'stakekings',
  true,
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  now()
)
ON CONFLICT (user_id, partner_slug) DO NOTHING;
