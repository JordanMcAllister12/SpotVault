/*
# Add attachment columns to poker_lounge_messages for HH sharing

## Purpose
The Lounge sharing feature needs to attach hand references to lounge posts.
Currently poker_lounge_messages doesn't have attachment columns.

## Changes
- ALTER TABLE poker_lounge_messages ADD COLUMN attachment_type text
- ALTER TABLE poker_lounge_messages ADD COLUMN attachment_url text
- ALTER TABLE poker_lounge_messages ADD COLUMN attachment_label text

These are nullable so existing messages are unaffected.
*/

ALTER TABLE poker_lounge_messages
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_label text;
