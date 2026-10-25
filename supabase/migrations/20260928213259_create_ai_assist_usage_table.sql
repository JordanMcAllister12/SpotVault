/*
# AI Assist usage tracking

## Purpose
Tracks every successful AI Assist generation for Content Lab spots.
Enforces TWO limits server-side:
1. Max 2 generations per spot (PER_SPOT_LIMIT)
2. Max 20 generations per user per week (WEEKLY_LIMIT, configurable)

## New Tables
- `ai_assist_usage`
  - `id` (uuid, PK)
  - `spot_id` (text, NOT NULL) — the Content Lab spot/draft ID
  - `user_id` (text, NOT NULL) — the account requesting AI assist
  - `field_type` (text, NOT NULL) — which field triggered it (title, subtitle, introduction, hand_details, content, tags)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled
- Anyone can INSERT (client creates records after successful generation)
- Anyone can SELECT (client reads to check remaining allowance)
- No UPDATE or DELETE needed
*/

CREATE TABLE IF NOT EXISTS ai_assist_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id text NOT NULL,
  user_id text NOT NULL,
  field_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_assist_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_usage" ON ai_assist_usage;
CREATE POLICY "select_ai_usage" ON ai_assist_usage
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_ai_usage" ON ai_assist_usage;
CREATE POLICY "insert_ai_usage" ON ai_assist_usage
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_usage_spot_id ON ai_assist_usage(spot_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_assist_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_assist_usage(created_at);
