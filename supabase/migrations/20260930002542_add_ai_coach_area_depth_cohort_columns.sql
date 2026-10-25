ALTER TABLE ai_coach_diagnostics
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'complete_game',
  ADD COLUMN IF NOT EXISTS depth text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS cohort_hand_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_provider text,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_raw_output jsonb;

COMMENT ON COLUMN ai_coach_diagnostics.area IS 'Analysis area: complete_game, preflop, postflop';
COMMENT ON COLUMN ai_coach_diagnostics.depth IS 'Analysis depth: standard, deep';
COMMENT ON COLUMN ai_coach_diagnostics.cohort_hand_ids IS 'Frozen array of hand IDs in the diagnostic cohort';
COMMENT ON COLUMN ai_coach_diagnostics.ai_provider IS 'AI provider used (e.g. openai)';
COMMENT ON COLUMN ai_coach_diagnostics.ai_model IS 'AI model identifier';
COMMENT ON COLUMN ai_coach_diagnostics.ai_raw_output IS 'Raw validated structured output from the AI provider';
