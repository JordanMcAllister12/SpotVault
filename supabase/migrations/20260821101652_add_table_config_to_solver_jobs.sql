ALTER TABLE solver_jobs
  ADD COLUMN IF NOT EXISTS table_config jsonb DEFAULT '{"seat_count": 8, "sb_bb": 0.5, "bb_bb": 1, "ante_type": "bb_ante", "ante_bb": 1}';