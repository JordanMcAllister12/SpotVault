/*
# Create Tournament Enrichment RPC

## Purpose
Replace the client-side full-hand-scan loop in TournamentLibraryTab that
loaded every poker_hand_records row (in 1000-row pages) just to compute
per-tournament buy_in and entry dates. This RPC does the aggregation
server-side with a single GROUP BY query, eliminating ~62 round-trips for
a 62k-hand dataset.

## New Functions
- `get_tournament_enrichment(p_user_id text, p_tournament_ids text[])`
  Returns one row per tournament_id with:
  - `tournament_id` text
  - `buy_in` numeric (first non-null buy_in found)
  - `entry_dates` json array of distinct played_at timestamps (one per source_file_name)

## Security
- SECURITY DEFINER is NOT used — this is a plain function that runs as the caller.
- RLS on poker_hand_records already ensures users only see their own rows.
- EXECUTE granted to authenticated (the role that calls it from the frontend).
- REVOKE EXECUTE from PUBLIC and anon to prevent unauthenticated access.
*/

CREATE OR REPLACE FUNCTION public.get_tournament_enrichment(
  p_user_id text,
  p_tournament_ids text[]
)
RETURNS TABLE (
  tournament_id text,
  buy_in numeric,
  entry_dates json
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    h.tournament_id,
    MAX(h.buy_in) AS buy_in,
    COALESCE(
      (SELECT json_agg(d.played_at ORDER BY d.played_at ASC)
       FROM (
         SELECT DISTINCT ON (sf.source_file_name) sf.played_at
         FROM poker_hand_records sf
         WHERE sf.user_id = p_user_id
           AND sf.tournament_id = h.tournament_id
           AND sf.source_file_name IS NOT NULL
           AND sf.played_at IS NOT NULL
         ORDER BY sf.source_file_name, sf.played_at ASC
       ) d),
      '[]'::json
    ) AS entry_dates
  FROM poker_hand_records h
  WHERE h.user_id = p_user_id
    AND h.tournament_id = ANY(p_tournament_ids)
  GROUP BY h.tournament_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tournament_enrichment(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tournament_enrichment(text, text[]) TO authenticated;
