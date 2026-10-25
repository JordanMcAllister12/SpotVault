/*
# Add solver diagnostics columns to solver_jobs

1. Changes
- Adds `outbound_payload` (jsonb, nullable) — the exact JSON body sent to DeepSolver.
- Adds `provider_http_status` (integer, nullable) — the HTTP status code returned by DeepSolver.
- Adds `provider_error_body` (text, nullable) — the raw error response text from DeepSolver.

These columns are populated by the edge function immediately after the schedule call,
regardless of success or failure, so failures are always inspectable after the fact
without relying on the in-flight diagnostics object returned to the frontend.

2. Security
- No RLS policy changes. Existing solver_jobs policies remain unchanged.
- Columns are nullable so existing rows are unaffected.
*/

ALTER TABLE solver_jobs
  ADD COLUMN IF NOT EXISTS outbound_payload jsonb,
  ADD COLUMN IF NOT EXISTS provider_http_status integer,
  ADD COLUMN IF NOT EXISTS provider_error_body text;
