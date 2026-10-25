/*
# Expand Spot System: Spot Types, Freeform Blocks, and Spot Discussions

## Summary
This migration adds support for multiple Spot types (Hand Analysis, Freeform, Solver, ICM/HRC, Question/Discussion), a freeform content-blocks column, and a full discussion/comment system for Spots with threaded replies, likes, pinning, and creator-answer marking.

## 1. Modified Tables

### content_spots
- Added `spot_type` column (text, NOT NULL, DEFAULT 'hand_analysis')
  - Supported values: 'hand_analysis', 'freeform', 'solver', 'icm_hrc', 'question'
  - Existing rows default to 'hand_analysis' so current Spots work unchanged
- Added `content_blocks` column (jsonb, nullable)
  - Stores ordered array of freeform content blocks for Freeform spots
  - Each block: { type: 'heading'|'paragraph'|'list'|'image'|'callout', ... }

## 2. New Tables

### spot_comments
- Stores discussion comments on published Spots
- `id` uuid PK
- `spot_id` uuid FK → content_spots(id) ON DELETE CASCADE
- `author_id` text NOT NULL — SpotVault account ID (matches content_spots.account_id pattern)
- `author_name` text NOT NULL — denormalized display name
- `author_avatar` text — nullable avatar URL
- `author_role` text NOT NULL DEFAULT 'PLAYER' — for badge display
- `body` text NOT NULL — comment text
- `reply_to` uuid FK → spot_comments(id) ON DELETE CASCADE — for threaded replies (NULL = top-level)
- `is_pinned` boolean NOT NULL DEFAULT false — set by Spot creator
- `is_creator_answer` boolean NOT NULL DEFAULT false — set by Spot creator to mark key insights
- `edited_at` timestamptz — set when comment is edited
- `deleted_at` timestamptz — soft delete (body replaced with placeholder in app)
- `created_at` timestamptz NOT NULL DEFAULT now()
- Indexes: spot_id + created_at, reply_to, author_id

### spot_comment_likes
- Stores likes on spot comments (one per user per comment)
- `id` uuid PK
- `comment_id` uuid FK → spot_comments(id) ON DELETE CASCADE
- `user_id` text NOT NULL — SpotVault account ID
- `created_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE (comment_id, user_id) — prevents duplicate likes

## 3. Security (RLS)

### spot_comments
- SELECT: TO anon, authenticated — only visible (non-deleted) comments on spots the viewer can access.
  Access check: spot is published (status = 'published') OR viewer is the spot creator OR viewer has a content_access_grants row for the spot.
- INSERT: TO anon, authenticated — author_id must match the current account setting AND the spot must be accessible (published or owned or granted).
- UPDATE: TO anon, authenticated — only the comment author can update (body, edited_at). Pinned/creator-answer flags are NOT updatable by commenters.
- DELETE: TO anon, authenticated — soft-delete only by comment author.

### spot_comment_likes
- SELECT: TO anon, authenticated — all likes visible (needed to render counts).
- INSERT: TO anon, authenticated — user_id must match current account.
- DELETE: TO anon, authenticated — user can only remove their own likes.

## 4. Notes
- Uses text account IDs (not auth.users uuid) to match the existing content_spots.account_id pattern and the demo-account auth model.
- The app.current_account_id setting is used for ownership checks, consistent with the existing content_spots RLS.
- Existing Hand Analysis spots work unchanged — spot_type defaults to 'hand_analysis'.
- Comment soft-deletes preserve thread structure (parent replies stay valid).
*/
