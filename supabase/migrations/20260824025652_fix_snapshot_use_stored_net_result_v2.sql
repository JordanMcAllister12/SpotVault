
-- Fix: Use stored net_result (already in BB) instead of recomputing from raw actions.
-- The action-based recomputation was missing some chip flows, understating BB Won by ~30%.
DO $$
DECLARE
  fn text;
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

  -- Replace line: "v_net_chips := 0; v_net_bb := NULL;"
  fn := replace(fn, 'v_net_chips := 0; v_net_bb := NULL;', 'v_net_bb := NULL; v_net_chips := 0;');

  -- Replace the IF block that recomputes from actions with stored net_result usage
  -- We replace the condition and body by targeting unique substrings
  fn := replace(fn, 'IF v_actions IS NOT NULL AND jsonb_typeof(v_actions) = ''array'' AND v_hero_name IS NOT NULL THEN',
    'IF v_hand.net_result IS NOT NULL THEN');

  -- Replace the SELECT ... INTO v_net_chips block with direct net_result assignment
  fn := replace(fn,
    'SELECT COALESCE(SUM(CASE' || chr(10) ||
    '        WHEN elem.val->>''player'' = v_hero_name AND elem.val->>''action'' IN (''post'',''post_ante'',''bet'',''call'',''raise'',''all-in'') THEN -COALESCE((elem.val->>''amount'')::numeric,0)' || chr(10) ||
    '        WHEN elem.val->>''player'' = v_hero_name AND elem.val->>''action'' IN (''uncalled'',''collect'',''won'') THEN COALESCE((elem.val->>''amount'')::numeric,0)' || chr(10) ||
    '        ELSE 0 END), 0) INTO v_net_chips' || chr(10) ||
    '      FROM jsonb_array_elements(v_actions) WITH ORDINALITY AS elem(val, ord);',
    'v_net_bb := round((v_hand.net_result)::numeric * 100) / 100;' || chr(10) ||
    '      IF v_big_blind IS NOT NULL AND v_big_blind > 0 THEN' || chr(10) ||
    '        v_net_chips := v_net_bb * v_big_blind;');

  -- Remove the now-redundant BB division (was: v_net_bb := round((v_net_chips / v_big_blind) * 100) / 100;)
  fn := replace(fn, 'v_net_bb := round((v_net_chips / v_big_blind) * 100) / 100;', '-- v_net_bb already set from stored net_result');

  EXECUTE fn;
END $$;
