ALTER TABLE ai_coach_diagnostics
  ADD COLUMN IF NOT EXISTS lifetime_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_eligible_at_checkpoint integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excess_new_hands integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN ai_coach_diagnostics.lifetime_snapshot IS 'Statistical snapshot computed from ALL eligible hands at checkpoint time, used for candidate identification';
COMMENT ON COLUMN ai_coach_diagnostics.total_eligible_at_checkpoint IS 'Total eligible hands in the database when the diagnostic ran';
COMMENT ON COLUMN ai_coach_diagnostics.excess_new_hands IS 'New eligible hands beyond the 5,000 window that were not analyzed (for progress reviews)';
