-- Add columns for hero-specific normalized hand data needed for real analytics
ALTER TABLE poker_hand_records
  ADD COLUMN IF NOT EXISTS hero_name TEXT,
  ADD COLUMN IF NOT EXISTS hero_seat INTEGER,
  ADD COLUMN IF NOT EXISTS blinds TEXT,
  ADD COLUMN IF NOT EXISTS stack_size NUMERIC,
  ADD COLUMN IF NOT EXISTS hero_cards TEXT,
  ADD COLUMN IF NOT EXISTS board TEXT,
  ADD COLUMN IF NOT EXISTS action_sequence JSONB,
  ADD COLUMN IF NOT EXISTS net_result NUMERIC,
  ADD COLUMN IF NOT EXISTS showdown BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS saw_flop BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS saw_turn BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS saw_river BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parser_status TEXT DEFAULT 'parsed',
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES poker_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hand_id TEXT;

-- Add index for faster mode-filtered queries
CREATE INDEX IF NOT EXISTS idx_poker_hand_records_user_mode ON poker_hand_records(user_id, game_mode);
CREATE INDEX IF NOT EXISTS idx_poker_hand_records_hash ON poker_hand_records(hand_hash);
