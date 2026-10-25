/*
# Add config_hash column to solver_jobs for caching

1. Modified Tables
   - `solver_jobs`: Add `config_hash` column (text, nullable)
     - Stores a deterministic hash of the solver configuration so identical
       solve requests can be served from cache instead of re-solving.
2. Index
   - Add index on `config_hash` for fast cache lookups.
3. Security
   - No RLS changes (existing policies cover the new column automatically).
*/

ALTER TABLE solver_jobs
  ADD COLUMN IF NOT EXISTS config_hash text;

CREATE INDEX IF NOT EXISTS idx_solver_jobs_config_hash
  ON solver_jobs (config_hash)
  WHERE config_hash IS NOT NULL;
