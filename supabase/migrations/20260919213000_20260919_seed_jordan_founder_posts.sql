/*
# Add Jordan founder community posts

Adds 4 more community_posts from Jordan McAllister to reinforce the SpotVault
story throughout the social feed. These mix naturally with existing Bryan and
SpotVault content.

Jordan UUID: 17ca0743-ccdb-4d43-ab24-f84aa2821170
*/

INSERT INTO community_posts (author_id, body, is_sponsored, moderation_status, created_at)
VALUES
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'We have spent a lot of time thinking about how fragmented poker has become. Study tools, coaching, content, analytics, staking and community all live in different places. SpotVault is being built to bring that ecosystem together.', false, 'visible', now() - interval '7 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'One of the biggest parts of the SpotVault vision is the portal system. Players, coaches, stables and poker businesses each get an environment built around how they actually operate while still being connected through one network.', false, 'visible', now() - interval '3 days'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'We are getting closer to launch and continuing to tighten everything across the platform. If something feels unnecessarily complicated, tell us. The goal is to make serious poker study and collaboration easier, not add another layer of friction.', false, 'visible', now() - interval '18 hours'),
  ('17ca0743-ccdb-4d43-ab24-f84aa2821170', 'Poker has an enormous global community but very little shared digital infrastructure. SpotVault is being built as a place where players, coaches, creators, stables and businesses can actually operate and connect inside the same ecosystem.', false, 'visible', now() - interval '3 hours')
ON CONFLICT DO NOTHING;
