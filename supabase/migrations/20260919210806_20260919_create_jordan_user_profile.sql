/*
# Create Jordan's user_profiles row

Jordan's auth account exists (17ca0743-ccdb-4d43-ab24-f84aa2821170) but has no
user_profiles row. This creates the canonical profile with photo and title.
primary_role must be one of: player, coach, creator, stable, business, investor.
Jordan's base portal is Player, so primary_role = 'player'.
*/

INSERT INTO user_profiles (user_id, display_name, username, avatar_url, poker_role, title, primary_role, bio, privacy_mode)
VALUES (
  '17ca0743-ccdb-4d43-ab24-f84aa2821170',
  'Jordan McAllister',
  'JordanMcAllister',
  '/assets/profiles/image.png',
  'Founder / CEO',
  'Founder / CEO',
  'player',
  'Founder and CEO of SpotVault. Building the connected poker study and community platform.',
  'public'
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  poker_role = EXCLUDED.poker_role,
  title = EXCLUDED.title,
  primary_role = EXCLUDED.primary_role,
  bio = EXCLUDED.bio,
  updated_at = now();
