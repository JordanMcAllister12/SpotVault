/*
# Create AI Coach Diagnostics System

Stores frozen diagnostic windows for the SpotVault AI Coach feature.
Each diagnostic captures a 5,000-hand analysis cohort, statistical snapshot,
focus areas, relevant hand examples, and AI output.

Diagnostics are immutable once saved — no rerolling.
Progress reviews compare against the previous diagnostic's checkpoint.
*/

CREATE TABLE ai_coach_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  mode text NOT NULL DEFAULT 'mtt',
  diagnostic_type text NOT NULL DEFAULT 'baseline' CHECK (diagnostic_type IN ('baseline', 'progress_review')),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Frozen analysis window boundaries
  window_start timestamptz,
  window_end timestamptz,

  -- Deterministic hand boundaries (sequence-based, not date-based)
  window_start_hand_id uuid,
  window_end_hand_id uuid,
  window_hand_count int NOT NULL DEFAULT 0,

  -- Total classified hands at time of diagnostic
  classified_hand_count_at_checkpoint int NOT NULL DEFAULT 0,

  -- Frozen statistical snapshot for this window
  statistical_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- AI-identified focus areas (max 2)
  focus_areas jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Relevant candidate hand IDs inspected by AI
  relevant_candidate_hand_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Selected example hands surfaced to user
  selected_example_hand_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Full saved AI output
  ai_output jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Progress comparison (only for progress_review type)
  progress_comparison jsonb,

  -- Previous diagnostic this review compares against
  previous_diagnostic_id uuid,

  -- New hands accumulated since last checkpoint
  new_hands_since_last int
);

CREATE INDEX idx_ai_coach_diagnostics_user ON ai_coach_diagnostics(user_id, mode, created_at DESC);

ALTER TABLE ai_coach_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_diagnostics" ON ai_coach_diagnostics FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

CREATE POLICY "insert_own_diagnostics" ON ai_coach_diagnostics FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "update_own_diagnostics" ON ai_coach_diagnostics FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "delete_own_diagnostics" ON ai_coach_diagnostics FOR DELETE
  TO authenticated USING (auth.uid()::text = user_id);
