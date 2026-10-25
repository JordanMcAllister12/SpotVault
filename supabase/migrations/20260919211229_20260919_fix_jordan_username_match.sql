/*
# Fix Jordan's username to match login identifier

Root cause: Jordan's user_profiles.username is 'JordanMcAllister' but the user
authenticates with 'jordanmcallister12'. The sv_resolve_login_email RPC uses ILIKE
which is case-insensitive but requires an exact string match (no substring).
'jordanmcallister12' != 'JordanMcAllister' so resolution returns null.

Fix: Update Jordan's username to 'jordanmcallister12' to match the actual login identifier.
*/

UPDATE user_profiles
SET username = 'jordanmcallister12',
    updated_at = now()
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170';
