-- Fix the broken BB calculation block - no indentation in function body
DO $$
DECLARE
  fn text;
  broken_block text;
  fixed_block text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'rebuild_analytics_snapshot'
    AND n.nspname = 'public'
    AND pg_get_function_identity_arguments(p.oid) = 'p_user_id text, p_mode text';

  IF fn IS NULL THEN
    RAISE EXCEPTION 'rebuild_analytics_snapshot not found';
  END IF;

  -- The broken block (exact text - no leading spaces)
  broken_block := 'v_net_bb := NULL; v_net_chips := 0;' || chr(10) ||
    'IF v_hand.net_result IS NOT NULL THEN' || chr(10) ||
    'SELECT COALESCE(SUM(CASE' || chr(10) ||
    'WHEN elem.val->>''player'' = v_hero_name AND elem.val->>''action'' IN (''post'',''post_ante'',''bet'',''call'',''raise'',''all-in'') THEN -COALESCE((elem.val->>''amount'')::numeric,0)' || chr(10) ||
    'WHEN elem.val->>''player'' = v_hero_name AND elem.val->>''action'' IN (''uncalled'',''collect'',''won'') THEN COALESCE((elem.val->>''amount'')::numeric,0)' || chr(10) ||
    'ELSE 0 END), 0) INTO v_net_chips' || chr(10) ||
    'FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord);' || chr(10) ||
    'IF v_big_blind IS NOT NULL AND v_big_blind > 0 THEN' || chr(10) ||
    '-- v_net_bb already set from stored net_result' || chr(10) ||
    'END IF;' || chr(10) ||
    'END IF;';

  fixed_block := 'v_net_bb := NULL; v_net_chips := 0;' || chr(10) ||
    'IF v_hand.net_result IS NOT NULL THEN' || chr(10) ||
    'v_net_bb := round((v_hand.net_result)::numeric * 100) / 100;' || chr(10) ||
    'IF v_big_blind IS NOT NULL AND v_big_blind > 0 THEN' || chr(10) ||
    'v_net_chips := v_net_bb * v_big_blind;' || chr(10) ||
    'END IF;' || chr(10) ||
    'END IF;';

  IF position(broken_block IN fn) = 0 THEN
    RAISE EXCEPTION 'Broken block not found';
  END IF;

  fn := replace(fn, broken_block, fixed_block);

  EXECUTE fn;
END $$;
