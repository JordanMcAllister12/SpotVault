/*
# Add Jordan McAllister Social Feed posts

Jordan had 0 posts in network_chat_messages (the Social Feed table).
Previous migration incorrectly added to community_posts (a different table).
This adds 5 conversational founder posts to the Social Feed, intermixed with
existing Bryan Paris and Tyler content.

Jordan UUID: 17ca0743-ccdb-4d43-ab24-f84aa2821170
Jordan avatar: /assets/profiles/image.png
*/

INSERT INTO network_chat_messages (author_id, author_name, author_avatar, author_role, body, is_sponsored, created_at)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'FOUNDER', 'Welcome to SpotVault everyone. We are still early and actively polishing. Send me feedback on what feels rough or confusing — I read it all.', false, now() - interval '5 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'FOUNDER', 'The long-term goal has always been connecting players, coaches, stables, creators and poker businesses in one ecosystem instead of ten disconnected tools.', false, now() - interval '3 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'FOUNDER', 'Question for the community: which study tools do you want us to prioritize? Hand replayer, solver integration, range library, something else?', false, now() - interval '2 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'FOUNDER', 'Still grinding on the platform ahead of launch. Lots of small fixes that add up. Appreciate the patience from everyone testing things early.', false, now() - interval '1 day'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Jordan McAllister', '/assets/profiles/image.png', 'FOUNDER', 'Serious poker study has been fragmented for too long. The whole point of SpotVault is making it easier to review, learn, and collaborate without jumping between five different apps.', false, now() - interval '6 hours')
ON CONFLICT DO NOTHING;
