/*
# Create page_views table for website traffic tracking

1. New Tables
- `page_views`
  - `id` (uuid, primary key)
  - `path` (text, the page path visited)
  - `visitor_id` (text, anonymous visitor identifier from cookie/localStorage)
  - `created_at` (timestamptz, when the visit occurred)

2. Purpose
- Tracks anonymous page views for the Staff Room "Website Traffic" section.
- No user_id or personal data — just path + visitor hash + timestamp.
- The frontend records a page view on each navigation/route change.

3. Security
- RLS enabled.
- INSERT: anyone (anon + authenticated) can record a page view — this is
  intentional public analytics tracking, like a hit counter.
- SELECT: staff-only via a SECURITY DEFINER function that checks sv_is_staff_or_admin().
  The table itself has no direct SELECT policy so no client can read raw rows.

4. Functions
- `staff_traffic_summary()` — SECURITY DEFINER, staff-only.
  Returns today's visits, last 7 days, last 30 days, and a 30-day daily breakdown.
*/

CREATE TABLE IF NOT EXISTS page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL DEFAULT '/',
  visitor_id text NOT NULL DEFAULT 'anonymous',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a page view (public analytics tracking)
DROP POLICY IF EXISTS "anon_insert_page_views" ON page_views;
CREATE POLICY "anon_insert_page_views"
ON page_views FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No SELECT policy: raw page views are never readable by any client role.
-- Staff access is only through the SECURITY DEFINER function below.

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at);

-- Staff-only traffic summary function
CREATE OR REPLACE FUNCTION public.staff_traffic_summary()
RETURNS TABLE (
  today bigint,
  last_7_days bigint,
  last_30_days bigint,
  daily JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today bigint;
  v_7d bigint;
  v_30d bigint;
  v_daily JSONB;
BEGIN
  -- Verify caller is staff or admin
  IF NOT public.sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;

  SELECT count(*) INTO v_today
  FROM page_views
  WHERE created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_7d
  FROM page_views
  WHERE created_at >= now() - interval '7 days';

  SELECT count(*) INTO v_30d
  FROM page_views
  WHERE created_at >= now() - interval '30 days';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d::date, 'visits', c) ORDER BY d), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT date_trunc('day', created_at)::date AS d, count(*) AS c
    FROM page_views
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1
  ) t;

  RETURN QUERY SELECT v_today, v_7d, v_30d, v_daily;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_traffic_summary() TO authenticated;
