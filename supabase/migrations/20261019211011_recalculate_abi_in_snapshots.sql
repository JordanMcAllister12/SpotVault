/*
# Recalculate ABI in stored snapshots

Update the stored MTT snapshots with the corrected ABI value.
With satellite buy-ins set to NULL (GGMillion feeders) and Cash Drop
entries already NULL, the correct ABI is computed as:
  total_buyin (non-null per-entry) / total_entries (all source files)
*/
DO $$
DECLARE
  v_total_buyin numeric;
  v_total_entries int;
  v_abi numeric;
BEGIN
  -- Compute correct ABI from current data
  WITH file_buyins AS (
    SELECT DISTINCT 
      source_file_name, 
      tournament_id, 
      FIRST_VALUE(buy_in) OVER (PARTITION BY tournament_id ORDER BY buy_in NULLS LAST) as tourn_buy_in
    FROM poker_hand_records
    WHERE game_mode = 'mtt'
      AND hand_hash NOT LIKE '%-unknown-%'
      AND hand_hash NOT LIKE 'summary-%'
  )
  SELECT 
    COALESCE(sum(CASE WHEN tourn_buy_in IS NOT NULL THEN tourn_buy_in ELSE 0 END), 0),
    count(*)
  INTO v_total_buyin, v_total_entries
  FROM file_buyins;

  IF v_total_entries > 0 AND v_total_buyin > 0 THEN
    v_abi := round((v_total_buyin / v_total_entries) * 100) / 100;
  ELSE
    v_abi := 0;
  END IF;

  -- Update all MTT snapshots
  UPDATE poker_analytics_snapshots
  SET 
    summary = jsonb_set(summary, '{abi}', to_jsonb(v_abi)),
    tournament_analysis = jsonb_set(tournament_analysis, '{abi}', to_jsonb(v_abi))
  WHERE mode = 'mtt';

  RAISE NOTICE 'ABI recalculated: % (total_buyin=%, entries=%)', v_abi, v_total_buyin, v_total_entries;
END $$;
