/*
# Tournament Aggregation RPC + Index

## Purpose
Replace the client-side `fetchUserTournaments` function that fetches ALL hand rows
(1000/page in a loop) and groups them in JavaScript with a single server-side SQL
aggregation. This reduces data transfer from O(n) hands to O(tournaments) rows.

## Changes
1. New index on `poker_hand_records (user_id, tournament_id)` to accelerate the
   GROUP BY tournament_id query.
2. New SECURITY DEFINER function `get_user_tournaments(p_user_id text)` that
   returns one row per tournament with: tournament_id, site, hand_count,
   first_played, last_played, blinds, game_mode, net_result_sum.
   SECURITY DEFINER is needed because the `__demo__` sentinel user is not a real
   auth user — RLS policies keyed on `auth.uid()` would block demo data for
   unauthenticated viewers. The function only reads, never writes.
3. Revoke EXECUTE from PUBLIC/anon, grant to authenticated only.

## Notes
- The demo sentinel `__demo__` user_id is not in auth.users, so RLS policies
  using `auth.uid() = user_id` would reject those rows for authenticated users.
  SECURITY DEFINER runs as the table owner, bypassing RLS for this read-only query.
- No data is modified or deleted.
*/

-- 1. Add index for tournament aggregation queries
CREATE INDEX IF NOT EXISTS idx_poker_hand_records_user_tournament
  ON poker_hand_records (user_id, tournament_id)
  WHERE tournament_id IS NOT NULL AND tournament_id <> '';

-- 2. Create the aggregation function
CREATE OR REPLACE FUNCTION get_user_tournaments(p_user_id text)
RETURNS TABLE (
  tournament_id text,
  site text,
  hand_count bigint,
  first_played timestamptz,
  last_played timestamptz,
  blinds text,
  game_mode text,
  net_result_sum numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tournament_id::text,
    max(site)::text AS site,
    count(*)::bigint AS hand_count,
    min(played_at) AS first_played,
    max(played_at) AS last_played,
    max(blinds)::text AS blinds,
    max(game_mode)::text AS game_mode,
    COALESCE(sum(net_result), 0)::numeric AS net_result_sum
  FROM poker_hand_records
  WHERE user_id = p_user_id
    AND tournament_id IS NOT NULL
    AND tournament_id <> ''
  GROUP BY tournament_id
  ORDER BY min(played_at) DESC;
$$;

-- 3. Restrict execute to authenticated only (not anon)
REVOKE EXECUTE ON FUNCTION get_user_tournaments(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_tournaments(text) TO authenticated;
