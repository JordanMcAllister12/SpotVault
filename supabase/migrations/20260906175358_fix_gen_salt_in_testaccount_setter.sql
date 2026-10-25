DROP FUNCTION IF EXISTS public.set_testaccount_password_hash(text);

CREATE OR REPLACE FUNCTION public.set_testaccount_password_hash(raw_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
  pw_hash text;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'testaccount@spotvault.com';
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'testaccount user not found';
  END IF;

  -- Use pgcrypto functions with explicit schema qualification
  pw_hash := public.crypt(raw_password, public.gen_salt('bf', 10));

  UPDATE auth.users
  SET encrypted_password = pw_hash,
      updated_at = now(),
      password_change_at = now()
  WHERE id = target_user_id AND email = 'testaccount@spotvault.com';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_testaccount_password_hash(text) TO service_role;
