-- Fix the wrapper function: cast snapshot id to text for comparison
CREATE OR REPLACE FUNCTION rebuild_analytics_snapshot_with_corrected_cbet(p_user_id text, p_mode text)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_corrected jsonb;
  v_snapshot_id uuid;
BEGIN
  v_result := rebuild_analytics_snapshot(p_user_id, p_mode);
  
  SELECT id INTO v_snapshot_id
  FROM poker_analytics_snapshots
  WHERE user_id = p_user_id AND mode = p_mode
  ORDER BY calculated_at DESC LIMIT 1;
  
  v_corrected := compute_corrected_cbet_stats(p_user_id, p_mode);
  
  UPDATE poker_analytics_snapshots
  SET 
    summary = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      summary,
      '{cbetFlopCount}', to_jsonb((v_corrected->>'cbetFlopCount')::int)),
      '{cbetFlopOppCount}', to_jsonb((v_corrected->>'cbetFlopOppCount')::int)),
      '{cbetFlop}', to_jsonb((v_corrected->>'cbetFlop')::numeric)),
      '{barrelTurnCount}', to_jsonb((v_corrected->>'barrelTurnCount')::int)),
      '{barrelTurnOppCount}', to_jsonb((v_corrected->>'barrelTurnOppCount')::int)),
      '{barrelTurn}', to_jsonb((v_corrected->>'barrelTurn')::numeric)),
      '{barrelRiverCount}', to_jsonb((v_corrected->>'barrelRiverCount')::int)),
      '{barrelRiverOppCount}', to_jsonb((v_corrected->>'barrelRiverOppCount')::int)),
    flop_analysis = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      flop_analysis,
      '{cbetFlopCount}', to_jsonb((v_corrected->>'cbetFlopCount')::int)),
      '{cbetFlopOppCount}', to_jsonb((v_corrected->>'cbetFlopOppCount')::int)),
      '{cbetFlop}', to_jsonb((v_corrected->>'cbetFlop')::numeric)),
      '{cbetDiagSawFlop}', to_jsonb((v_corrected->>'cbetDiagSawFlop')::int)),
      '{cbetDiagAggressorSawFlop}', to_jsonb((v_corrected->>'cbetDiagAggressorSawFlop')::int)),
      '{cbetDiagDonkExcluded}', to_jsonb((v_corrected->>'cbetDiagDonkExcluded')::int)),
      '{cbetDiagOpp}', to_jsonb((v_corrected->>'cbetDiagOpp')::int))
  WHERE id = v_snapshot_id;
  
  UPDATE poker_analytics_snapshots
  SET summary = jsonb_set(jsonb_set(
      summary,
      '{barrelRiver}', to_jsonb((v_corrected->>'barrelRiver')::numeric)),
      '{barrelRiverOppCount}', to_jsonb((v_corrected->>'barrelRiverOppCount')::int))
  WHERE id = v_snapshot_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
