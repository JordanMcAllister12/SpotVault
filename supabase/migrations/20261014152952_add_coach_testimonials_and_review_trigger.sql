/*
# Add coach testimonials table and verified review aggregation trigger

1. New Table: `coach_testimonials`
   - Stores historical testimonials separate from verified reviews.
   - Fields: id, coach_account_id, author_name, author_title, author_avatar_url,
     testimonial_text, rating (optional, nullable — does NOT affect verified average),
     is_published, created_at.
   - Testimonials are display-only and do NOT affect coach_rating_average or coach_rating_count.
   - RLS: anon + authenticated can SELECT published testimonials.
     Only authenticated users can INSERT/UPDATE/DELETE (staff-managed).

2. New Function: `update_coach_rating_aggregate()`
   - Trigger function that runs AFTER INSERT or DELETE on `coach_reviews`.
   - Recalculates coach_rating_average and coach_rating_count on the
     matching coach_listings row, counting only reviews where
     is_verified_student = true.
   - Ensures the public rating shown on coach cards and People Directory
     always reflects only verified student reviews.

3. New Trigger: `trg_coach_reviews_update_rating`
   - Fires AFTER INSERT or DELETE on coach_reviews, calls the function above.

4. Security
   - coach_testimonials: RLS enabled, anon read for published rows only.
   - No changes to existing coach_reviews RLS (already allows anon read).
   - The trigger function runs with SECURITY DEFINER to update coach_listings
     regardless of the calling user's permissions on that table.
*/

-- ── 1. coach_testimonials ──
CREATE TABLE IF NOT EXISTS coach_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_account_id text NOT NULL,
  author_name text NOT NULL,
  author_title text,
  author_avatar_url text,
  testimonial_text text NOT NULL DEFAULT '',
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coach_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_testimonials" ON coach_testimonials;
CREATE POLICY "anon_select_testimonials" ON coach_testimonials FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "auth_insert_testimonials" ON coach_testimonials;
CREATE POLICY "auth_insert_testimonials" ON coach_testimonials FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_testimonials" ON coach_testimonials;
CREATE POLICY "auth_update_testimonials" ON coach_testimonials FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_testimonials" ON coach_testimonials;
CREATE POLICY "auth_delete_testimonials" ON coach_testimonials FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_testimonials_coach ON coach_testimonials(coach_account_id, created_at DESC);

-- ── 2. Aggregate update function ──
CREATE OR REPLACE FUNCTION update_coach_rating_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_account_id text;
  v_avg numeric;
  v_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_coach_account_id := NEW.coach_account_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_coach_account_id := OLD.coach_account_id;
  ELSE
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(AVG(overall_rating), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM coach_reviews
  WHERE coach_account_id = v_coach_account_id
    AND is_verified_student = true;

  UPDATE coach_listings
  SET
    coach_rating_average = ROUND(v_avg, 1),
    coach_rating_count = v_count
  WHERE account_id = v_coach_account_id;

  RETURN NULL;
END;
$$;

-- ── 3. Trigger ──
DROP TRIGGER IF EXISTS trg_coach_reviews_update_rating ON coach_reviews;
CREATE TRIGGER trg_coach_reviews_update_rating
  AFTER INSERT OR DELETE ON coach_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_coach_rating_aggregate();
