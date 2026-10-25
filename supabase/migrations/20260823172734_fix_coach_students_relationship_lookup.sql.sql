CREATE OR REPLACE FUNCTION public.sv_get_coach_students()
RETURNS TABLE (
  student_id text,
  student_name text,
  student_username text,
  student_email text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN r.user_a = auth.uid() THEN r.user_b::text ELSE r.user_a::text END AS student_id,
    p.display_name AS student_name,
    p.username AS student_username,
    u.email AS student_email,
    r.status AS status,
    r.created_at AS created_at
  FROM sv_relationships r
  LEFT JOIN user_profiles p ON p.user_id = CASE WHEN r.user_a = auth.uid() THEN r.user_b ELSE r.user_a END
  LEFT JOIN auth.users u ON u.id = CASE WHEN r.user_a = auth.uid() THEN r.user_b ELSE r.user_a END
  WHERE r.type = 'coach_student'
    AND (r.user_a = auth.uid() OR r.user_b = auth.uid())
    AND r.status IN ('active', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.sv_get_coach_students() TO authenticated;