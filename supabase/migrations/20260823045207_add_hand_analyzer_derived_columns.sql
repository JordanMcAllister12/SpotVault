/*
# Add derived columns for Hand Analyzer filtering

1. New Columns on poker_hand_records
- pot_type TEXT — 'unopened', 'limped', 'srp', '3bet', '4bet_plus'
- is_3bet_pot BOOLEAN — true if 2+ preflop raises
- is_4bet_pot BOOLEAN — true if 3+ preflop raises
- street_reached TEXT — 'preflop', 'flop', 'turn', 'river'
- hero_allin_preflop BOOLEAN — hero went all-in preflop
- hero_allin_postflop BOOLEAN — hero went all-in postflop
- hero_preflop_action TEXT — 'raise', 'call', '3bet', '4bet', 'allin', 'limp', 'fold', 'none'
- hero_faced_3bet BOOLEAN — hero faced a 3-bet after raising
- hero_cbet_flop BOOLEAN — hero c-bet the flop as preflop raisor
- faced_cbet_flop BOOLEAN — hero faced a flop c-bet
- hero_barrel_turn BOOLEAN — hero barreled the turn after flop c-bet
- hero_barrel_river BOOLEAN — hero barreled the river after turn barrel
- hero_checkraise BOOLEAN — hero check-raised any postflop street

2. Indexes for hand analyzer queries

3. Backfill from action_sequence JSONB

4. Security — No RLS changes
*/

ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS pot_type TEXT DEFAULT 'unopened';
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS is_3bet_pot BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS is_4bet_pot BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS street_reached TEXT DEFAULT 'preflop';
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_allin_preflop BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_allin_postflop BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_preflop_action TEXT DEFAULT 'none';
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_faced_3bet BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_cbet_flop BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS faced_cbet_flop BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_barrel_turn BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_barrel_river BOOLEAN DEFAULT FALSE;
ALTER TABLE poker_hand_records ADD COLUMN IF NOT EXISTS hero_checkraise BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_phr_mode_played ON poker_hand_records (user_id, game_mode, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_phr_mode_netresult ON poker_hand_records (user_id, game_mode, net_result);
CREATE INDEX IF NOT EXISTS idx_phr_mode_potamount ON poker_hand_records (user_id, game_mode, pot_amount);
CREATE INDEX IF NOT EXISTS idx_phr_mode_position ON poker_hand_records (user_id, game_mode, position);
CREATE INDEX IF NOT EXISTS idx_phr_mode_3bet ON poker_hand_records (user_id, game_mode, is_3bet_pot);
CREATE INDEX IF NOT EXISTS idx_phr_mode_street ON poker_hand_records (user_id, game_mode, street_reached);
CREATE INDEX IF NOT EXISTS idx_phr_mode_pottype ON poker_hand_records (user_id, game_mode, pot_type);

UPDATE poker_hand_records SET street_reached =
  CASE WHEN saw_river THEN 'river'
       WHEN saw_turn THEN 'turn'
       WHEN saw_flop THEN 'flop'
       ELSE 'preflop' END;

DO $$
DECLARE
  r RECORD;
  a jsonb;
  v_pf_raise_count int;
  v_pf_call_count int;
  v_hero_name text;
  v_hero_pf_action text;
  v_hero_pf_raise_count int;
  v_hero_faced_3bet boolean;
  v_last_pf_raiser text;
  v_hero_cbet_flop boolean;
  v_faced_cbet_flop boolean;
  v_hero_barrel_turn boolean;
  v_hero_barrel_river boolean;
  v_hero_checkraise boolean;
  v_hero_allin_pf boolean;
  v_hero_allin_postflop boolean;
  v_cur_street text;
  v_hero_checked boolean;
  v_hero_raised boolean;
BEGIN
  FOR r IN SELECT id, action_sequence, hero_name AS hname FROM poker_hand_records WHERE action_sequence IS NOT NULL
  LOOP
    v_pf_raise_count := 0;
    v_pf_call_count := 0;
    v_hero_name := r.hname;
    v_hero_pf_action := 'none';
    v_hero_pf_raise_count := 0;
    v_hero_faced_3bet := false;
    v_last_pf_raiser := null;
    v_hero_cbet_flop := false;
    v_faced_cbet_flop := false;
    v_hero_barrel_turn := false;
    v_hero_barrel_river := false;
    v_hero_checkraise := false;
    v_hero_allin_pf := false;
    v_hero_allin_postflop := false;
    v_cur_street := '';
    v_hero_checked := false;
    v_hero_raised := false;

    FOR a IN SELECT * FROM jsonb_array_elements(r.action_sequence) LOOP
      IF a->>'street' IS DISTINCT FROM v_cur_street THEN
        IF v_cur_street IN ('flop', 'turn', 'river') AND v_hero_checked AND v_hero_raised THEN
          v_hero_checkraise := true;
        END IF;
        v_cur_street := a->>'street';
        v_hero_checked := false;
        v_hero_raised := false;
      END IF;

      IF a->>'street' = 'preflop' AND a->>'action' IN ('raise', 'bet', 'all-in') THEN
        v_pf_raise_count := v_pf_raise_count + 1;
        v_last_pf_raiser := a->>'player';
        IF a->>'player' = v_hero_name THEN
          v_hero_pf_raise_count := v_hero_pf_raise_count + 1;
          IF v_hero_pf_raise_count = 1 THEN v_hero_pf_action := 'raise';
          ELSIF v_hero_pf_raise_count = 2 THEN v_hero_pf_action := '3bet';
          ELSIF v_hero_pf_raise_count >= 3 THEN v_hero_pf_action := '4bet';
          END IF;
        END IF;
        IF a->>'player' != v_hero_name AND v_pf_raise_count >= 2 AND v_hero_pf_raise_count >= 1 THEN
          v_hero_faced_3bet := true;
        END IF;
      END IF;

      IF a->>'street' = 'preflop' AND a->>'action' = 'call' THEN
        v_pf_call_count := v_pf_call_count + 1;
        IF a->>'player' = v_hero_name AND v_hero_pf_action = 'none' THEN
          v_hero_pf_action := 'call';
        END IF;
        IF a->>'player' = v_hero_name AND v_pf_raise_count = 0 THEN
          v_hero_pf_action := 'limp';
        END IF;
      END IF;

      IF a->>'street' = 'preflop' AND a->>'action' = 'all-in' AND a->>'player' = v_hero_name THEN
        v_hero_allin_pf := true;
        v_hero_pf_action := 'allin';
      END IF;

      IF a->>'street' IN ('flop', 'turn', 'river') AND a->>'action' = 'all-in' AND a->>'player' = v_hero_name THEN
        v_hero_allin_postflop := true;
      END IF;

      IF a->>'street' = 'flop' AND a->>'action' IN ('bet', 'raise', 'all-in') AND a->>'player' = v_hero_name AND v_last_pf_raiser = v_hero_name THEN
        v_hero_cbet_flop := true;
      END IF;

      IF a->>'street' = 'flop' AND a->>'action' IN ('bet', 'raise', 'all-in') AND a->>'player' != v_hero_name AND v_last_pf_raiser != v_hero_name THEN
        v_faced_cbet_flop := true;
      END IF;

      IF a->>'street' = 'turn' AND a->>'action' IN ('bet', 'raise', 'all-in') AND a->>'player' = v_hero_name AND v_hero_cbet_flop THEN
        v_hero_barrel_turn := true;
      END IF;

      IF a->>'street' = 'river' AND a->>'action' IN ('bet', 'raise', 'all-in') AND a->>'player' = v_hero_name AND v_hero_barrel_turn THEN
        v_hero_barrel_river := true;
      END IF;

      IF a->>'street' IN ('flop', 'turn', 'river') AND a->>'player' = v_hero_name THEN
        IF a->>'action' = 'check' THEN v_hero_checked := true; END IF;
        IF a->>'action' IN ('raise', 'bet', 'all-in') THEN v_hero_raised := true; END IF;
      END IF;
    END LOOP;

    IF v_cur_street IN ('flop', 'turn', 'river') AND v_hero_checked AND v_hero_raised THEN
      v_hero_checkraise := true;
    END IF;

    UPDATE poker_hand_records SET
      pot_type = CASE
        WHEN v_pf_raise_count = 0 AND v_pf_call_count > 0 THEN 'limped'
        WHEN v_pf_raise_count = 0 THEN 'unopened'
        WHEN v_pf_raise_count = 1 THEN 'srp'
        WHEN v_pf_raise_count = 2 THEN '3bet'
        ELSE '4bet_plus' END,
      is_3bet_pot = v_pf_raise_count >= 2,
      is_4bet_pot = v_pf_raise_count >= 3,
      hero_allin_preflop = v_hero_allin_pf,
      hero_allin_postflop = v_hero_allin_postflop,
      hero_preflop_action = v_hero_pf_action,
      hero_faced_3bet = v_hero_faced_3bet,
      hero_cbet_flop = v_hero_cbet_flop,
      faced_cbet_flop = v_faced_cbet_flop,
      hero_barrel_turn = v_hero_barrel_turn,
      hero_barrel_river = v_hero_barrel_river,
      hero_checkraise = v_hero_checkraise
    WHERE id = r.id;
  END LOOP;
END $$;
