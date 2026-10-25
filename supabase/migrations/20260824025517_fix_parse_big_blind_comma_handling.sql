
-- Fix parse_big_blind to handle comma-formatted blinds like "1,500/3,000"
-- Previously: substring(blinds_str from '/([0-9]+)') returned "3" from "3,000"
-- Now: strip commas first, then extract the big blind value
CREATE OR REPLACE FUNCTION parse_big_blind(blinds_str text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cleaned text;
BEGIN
  IF blinds_str IS NULL THEN RETURN NULL; END IF;
  -- Remove all commas and spaces
  v_cleaned := regexp_replace(blinds_str, '[, ]', '', 'g');
  -- Extract the big blind (number after the slash)
  BEGIN
    RETURN substring(v_cleaned from '/([0-9]+)')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;
