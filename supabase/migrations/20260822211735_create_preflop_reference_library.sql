/*
# Create Preflop Reference Range Library

1. Purpose
   - Stores curated/reference preflop poker strategies (ChipEV, ICM) at the
     1,326-combo level for exact nodes identified by game configuration +
     structured action history.
   - Supports versioning: multiple versions per node, one marked active.
   - Designed to feed DeepSolver postflop solves with exact weighted ranges.

2. New Tables
   - `preflop_reference_nodes`: metadata identifying a unique preflop
     decision point (format, table size, stack, ante, position, action history).
     Has a deterministic `node_hash` for fast lookup.
   - `preflop_reference_ranges`: the actual strategy data for a node, stored
     as JSONB at 1,326-combo level. Multiple versions per node. One is active.
   - `preflop_reference_imports`: batch import tracking for audit trail.

3. node_hash computation
   - Deterministic SHA-1 of a canonical JSON string built from:
     format|solve_type|table_size|stack_bb|ante_type|ante_bb|hero_position|action_history_canonical
   - action_history_canonical = JSON array of {position, action, size_bb}
     sorted by insertion order (the order actions occurred at the table).

4. Security
   - RLS enabled on all tables.
   - This is an admin/curated library — read access for anon+authenticated
     (the solver needs to read ranges without sign-in), write access for
     authenticated only (admin import tool requires login).

5. Important Notes
   - The `strategy_data` JSONB stores per-combo action frequencies:
     { "AhKh": {"raise_2.2": 0.95, "all-in": 0.05}, ... }
   - Missing combos are treated as 100% fold — NOT fabricated.
   - The `is_partial` flag marks ranges that don't cover all 1,326 combos.
*/

-- ===== Nodes table =====
CREATE TABLE IF NOT EXISTS preflop_reference_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_hash text NOT NULL,
  format text NOT NULL DEFAULT 'tournament',
  solve_type text NOT NULL DEFAULT 'chipev',
  table_size integer NOT NULL,
  stack_bb numeric NOT NULL,
  ante_type text NOT NULL DEFAULT 'bb_ante',
  ante_bb numeric NOT NULL DEFAULT 1,
  hero_position text NOT NULL,
  action_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  node_type text NOT NULL DEFAULT 'preflop_decision',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint on node_hash so the same node can't be inserted twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_preflop_nodes_hash
  ON preflop_reference_nodes (node_hash);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_preflop_nodes_lookup
  ON preflop_reference_nodes (format, solve_type, table_size, stack_bb, hero_position);

-- ===== Ranges table (versioned strategy data) =====
CREATE TABLE IF NOT EXISTS preflop_reference_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES preflop_reference_nodes(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  is_partial boolean NOT NULL DEFAULT false,
  available_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- strategy_data: { "AhKh": {"raise_2.2": 0.95, "all-in": 0.05}, ... }
  -- Keys are canonical combo strings from solver_hand_order.txt
  -- Values are {action_label: frequency} maps, frequencies 0..1
  strategy_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_name text NOT NULL DEFAULT 'manual-import',
  source_version text,
  notes text,
  imported_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- One active range per node
CREATE UNIQUE INDEX IF NOT EXISTS idx_preflop_ranges_active
  ON preflop_reference_ranges (node_id) WHERE is_active = true;

-- Index for node lookups
CREATE INDEX IF NOT EXISTS idx_preflop_ranges_node
  ON preflop_reference_ranges (node_id);

-- ===== Import batch tracking =====
CREATE TABLE IF NOT EXISTS preflop_reference_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_version text,
  import_format text NOT NULL DEFAULT 'json',
  nodes_imported integer NOT NULL DEFAULT 0,
  nodes_updated integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ===== RLS =====
ALTER TABLE preflop_reference_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE preflop_reference_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE preflop_reference_imports ENABLE ROW LEVEL SECURITY;

-- Nodes: read for all (solver needs access), write for authenticated only
DROP POLICY IF EXISTS "anon_read_preflop_nodes" ON preflop_reference_nodes;
CREATE POLICY "anon_read_preflop_nodes" ON preflop_reference_nodes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_write_preflop_nodes" ON preflop_reference_nodes;
CREATE POLICY "auth_write_preflop_nodes" ON preflop_reference_nodes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Ranges: read for all, write for authenticated only
DROP POLICY IF EXISTS "anon_read_preflop_ranges" ON preflop_reference_ranges;
CREATE POLICY "anon_read_preflop_ranges" ON preflop_reference_ranges FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_write_preflop_ranges" ON preflop_reference_ranges;
CREATE POLICY "auth_write_preflop_ranges" ON preflop_reference_ranges FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Imports: read for all, write for authenticated only
DROP POLICY IF EXISTS "anon_read_preflop_imports" ON preflop_reference_imports;
CREATE POLICY "anon_read_preflop_imports" ON preflop_reference_imports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_write_preflop_imports" ON preflop_reference_imports;
CREATE POLICY "auth_write_preflop_imports" ON preflop_reference_imports FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ===== updated_at triggers =====
CREATE OR REPLACE FUNCTION update_preflop_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_preflop_nodes_updated ON preflop_reference_nodes;
CREATE TRIGGER trg_preflop_nodes_updated BEFORE UPDATE ON preflop_reference_nodes
  FOR EACH ROW EXECUTE FUNCTION update_preflop_timestamp();

DROP TRIGGER IF EXISTS trg_preflop_ranges_updated ON preflop_reference_ranges;
CREATE TRIGGER trg_preflop_ranges_updated BEFORE UPDATE ON preflop_reference_ranges
  FOR EACH ROW EXECUTE FUNCTION update_preflop_timestamp();
