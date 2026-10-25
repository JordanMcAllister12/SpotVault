/* Fix snapshot 3-bet opportunity denominator while preserving the existing function. */
DO $$
DECLARE
  original_definition text;
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO original_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'rebuild_analytics_snapshot'
    AND n.nspname = 'public'
    AND pg_get_function_identity_arguments(p.oid) = 'p_user_id text, p_mode text';

  IF original_definition IS NULL THEN
    RAISE EXCEPTION 'rebuild_analytics_snapshot(text, text) was not found';
  END IF;

  function_definition := original_definition;
  function_definition := replace(function_definition, 'v_hero_opened boolean; v_hero_3bet boolean;', 'v_hero_opened boolean; v_hero_3bet boolean; v_hero_had_3bet_opp boolean;');
  function_definition := replace(function_definition, 'v_raise_level := 0; v_first_raiser := NULL; v_hero_opened := false; v_hero_3bet := false;', 'v_raise_level := 0; v_first_raiser := NULL; v_hero_opened := false; v_hero_3bet := false; v_hero_had_3bet_opp := false;');
  function_definition := replace(function_definition, 'IF v_raise_level = 0 AND v_is_raiser THEN v_raise_level := 1;', 'IF v_raise_level = 1 AND v_is_hero AND NOT v_hero_opened AND NOT v_hero_had_3bet_opp THEN v_hero_had_3bet_opp := true; END IF;' || chr(10) || '          IF v_raise_level = 0 AND v_is_raiser THEN v_raise_level := 1;');
  function_definition := replace(function_definition, 'IF v_raise_level >= 2 THEN v_3bet_opp_count := v_3bet_opp_count + 1; IF v_hero_3bet THEN v_3bet_count := v_3bet_count + 1; END IF; END IF;', 'IF v_hero_had_3bet_opp THEN v_3bet_opp_count := v_3bet_opp_count + 1; IF v_hero_3bet THEN v_3bet_count := v_3bet_count + 1; END IF; END IF;');

  IF function_definition = original_definition THEN
    RAISE EXCEPTION 'No changes were made to rebuild_analytics_snapshot';
  END IF;

  EXECUTE function_definition;
END $$;
