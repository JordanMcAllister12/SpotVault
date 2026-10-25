-- Add non-mutating BB sanity warnings to analytics snapshots.
DO $$
DECLARE
  fn text;
  old_text text;
  new_text text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'rebuild_analytics_snapshot'
    AND n.nspname = 'public'
    AND pg_get_function_identity_arguments(p.oid) = 'p_user_id text, p_mode text';

  IF fn IS NULL THEN RAISE EXCEPTION 'rebuild_analytics_snapshot not found'; END IF;

  old_text := 'v_summary := v_s1 || v_s2 || v_s3;';
  new_text := old_text || chr(10) ||
    'v_summary := v_summary || jsonb_build_object(' || chr(10) ||
    '  ''bbSanityWarning'', ABS(r_bb100) > 500 OR EXISTS (SELECT 1 FROM poker_hand_records WHERE user_id = p_user_id AND game_mode = p_mode AND hand_hash NOT LIKE ''%-unknown-%'' AND hand_hash NOT LIKE ''summary-%'' AND ABS(net_result) > 500),' || chr(10) ||
    '  ''bbSanityReason'', CASE WHEN ABS(r_bb100) > 500 THEN ''Dataset BB/100 exceeds 500'' WHEN EXISTS (SELECT 1 FROM poker_hand_records WHERE user_id = p_user_id AND game_mode = p_mode AND hand_hash NOT LIKE ''%-unknown-%'' AND hand_hash NOT LIKE ''summary-%'' AND ABS(net_result) > 500) THEN ''Individual hand exceeds 500 BB'' ELSE NULL END,' || chr(10) ||
    '  ''suspiciousHandCount'', (SELECT COUNT(*) FROM poker_hand_records WHERE user_id = p_user_id AND game_mode = p_mode AND hand_hash NOT LIKE ''%-unknown-%'' AND hand_hash NOT LIKE ''summary-%'' AND ABS(net_result) > 500),' || chr(10) ||
    '  ''maxAbsHandBB'', (SELECT COALESCE(MAX(ABS(net_result)), 0) FROM poker_hand_records WHERE user_id = p_user_id AND game_mode = p_mode AND hand_hash NOT LIKE ''%-unknown-%'' AND hand_hash NOT LIKE ''summary-%'')' || chr(10) ||
    ');';

  IF position(old_text IN fn) = 0 THEN RAISE EXCEPTION 'Summary insertion point not found'; END IF;
  fn := replace(fn, old_text, new_text);
  EXECUTE fn;
END $$;
