/*
# Add attachment columns to user_inbox_messages for HH sharing

## Purpose
The DM sharing feature needs to attach hand references to inbox messages.
Currently user_inbox_messages only has body text — no attachment support.

## Changes
- ALTER TABLE user_inbox_messages ADD COLUMN attachment_type text
- ALTER TABLE user_inbox_messages ADD COLUMN attachment_url text
- ALTER TABLE user_inbox_messages ADD COLUMN attachment_label text

These are nullable so existing messages are unaffected. The columns mirror
the same pattern used on network_chat_messages and community_posts.

## Security
No RLS changes needed — existing policies on user_inbox_messages already
control access based on conversation participation.
*/

ALTER TABLE user_inbox_messages
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_label text;
