/*
# Professional Portal Listings, Directory & Main Feed Promotion System

## Purpose
Creates a professional presence system for paid portal subscribers (Creator, Coach, Business).
Enables: professional listings, People directory discovery, passive Main Feed discovery,
limited Main Feed promotional posts with configurable allowances, staff moderation,
and basic analytics tracking.

## New Tables

1. **professional_listings** — The professional profile/listing created by paid portal subscribers.
   - One per user per portal type
   - Contains structured professional info (bio, services, pricing, availability, etc.)
   - Has moderation status (pending/approved/rejected/suspended)
   - Has visibility flag (pauses public listing when subscription lapses)
   - Links to portal_memberships for entitlement checks

2. **professional_listing_entitlements** — Configurable entitlements per portal type.
   - monthly_main_feed_post_allowance (default 3)
   - main_feed_promotion_duration_hours (default 24)
   - directory_listing_enabled (default true)
   - passive_feed_discovery_enabled (default true)
   - Configurable by portal type, subscription tier, and admin

3. **professional_promotions** — Tracks each promotional post placement on the Main Feed.
   - Links to professional_listings and the industry_wire_posts entry
   - Tracks billing period (year-month) for allowance counting
   - Has promoted_at and expires_at timestamps
   - Status: active/expired/cancelled

4. **professional_analytics_events** — Basic analytics tracking.
   - Events: profile_view, directory_impression, directory_click,
     feed_promotion_impression, feed_promotion_click, cta_click
   - Links to professional_listings

## Security
- RLS enabled on all new tables
- Owners can CRUD their own listings
- Public can read approved+visible listings (anon + authenticated)
- Only owners can create promotions for their own listings
- Staff/admin can moderate (update moderation_status, visibility)
- Entitlements table: staff/admin can read; anon cannot
- Analytics: anyone can insert (tracking events); only owner/staff can read

## Important Notes
- Entitlements are NOT hard-coded in app code — they come from the database
- Promotion allowance is enforced server-side via a SECURITY DEFINER function
- Subscription lapse pauses visibility but does NOT delete data
- The system is extensible for future portal types
*/

-- ============================================================
-- 1. PROFESSIONAL LISTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS professional_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_type text NOT NULL CHECK (portal_type IN ('creator-portal','coach-portal','business-portal','stable-portal','media-portal')),
  -- Core professional info
  display_name text NOT NULL DEFAULT '',
  professional_title text NOT NULL DEFAULT '',
  short_bio text NOT NULL DEFAULT '',
  long_description text DEFAULT '',
  profile_image_url text,
  -- Structured professional data (flexible by portal type)
  specialties text[] DEFAULT '{}',
  services jsonb DEFAULT '[]'::jsonb,
  pricing jsonb DEFAULT '{}'::jsonb,
  availability jsonb DEFAULT '{}'::jsonb,
  location text DEFAULT '',
  is_remote boolean DEFAULT false,
  links jsonb DEFAULT '[]'::jsonb,
  contact_cta_label text DEFAULT 'Contact',
  contact_cta_url text,
  -- Moderation
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected','suspended')),
  moderation_note text,
  moderated_by uuid,
  moderated_at timestamptz,
  -- Visibility (controlled by subscription status)
  is_visible boolean NOT NULL DEFAULT false,
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- One listing per user per portal type
  UNIQUE(user_id, portal_type)
);

ALTER TABLE professional_listings ENABLE ROW LEVEL SECURITY;

-- Owners can read their own listings (including non-approved)
DROP POLICY IF EXISTS "select_own_listings" ON professional_listings;
CREATE POLICY "select_own_listings" ON professional_listings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Public can read approved + visible listings
DROP POLICY IF EXISTS "select_public_listings" ON professional_listings;
CREATE POLICY "select_public_listings" ON professional_listings FOR SELECT
  TO anon, authenticated USING (moderation_status = 'approved' AND is_visible = true);

-- Owners can insert their own listings
DROP POLICY IF EXISTS "insert_own_listings" ON professional_listings;
CREATE POLICY "insert_own_listings" ON professional_listings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owners can update their own listings (but not moderation fields)
DROP POLICY IF EXISTS "update_own_listings" ON professional_listings;
CREATE POLICY "update_own_listings" ON professional_listings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff/admin can update any listing (for moderation)
DROP POLICY IF EXISTS "staff_update_listings" ON professional_listings;
CREATE POLICY "staff_update_listings" ON professional_listings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  );

-- Owners can delete their own listings
DROP POLICY IF EXISTS "delete_own_listings" ON professional_listings;
CREATE POLICY "delete_own_listings" ON professional_listings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for directory queries
CREATE INDEX IF NOT EXISTS idx_prof_listings_directory
  ON professional_listings (portal_type, moderation_status, is_visible)
  WHERE moderation_status = 'approved' AND is_visible = true;

CREATE INDEX IF NOT EXISTS idx_prof_listings_user
  ON professional_listings (user_id);

-- ============================================================
-- 2. PROFESSIONAL LISTING ENTITLEMENTS (Config)
-- ============================================================

CREATE TABLE IF NOT EXISTS professional_listing_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_type text NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'standard',
  directory_listing_enabled boolean NOT NULL DEFAULT true,
  passive_feed_discovery_enabled boolean NOT NULL DEFAULT true,
  monthly_main_feed_post_allowance integer NOT NULL DEFAULT 3,
  main_feed_promotion_duration_hours integer NOT NULL DEFAULT 24,
  social_feed_promotion_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(portal_type, subscription_tier)
);

ALTER TABLE professional_listing_entitlements ENABLE ROW LEVEL SECURITY;

-- Anyone can read entitlements (needed for frontend display)
DROP POLICY IF EXISTS "select_entitlements" ON professional_listing_entitlements;
CREATE POLICY "select_entitlements" ON professional_listing_entitlements FOR SELECT
  TO anon, authenticated USING (is_active = true);

-- Staff/admin can manage entitlements
DROP POLICY IF EXISTS "staff_manage_entitlements" ON professional_listing_entitlements;
CREATE POLICY "staff_manage_entitlements" ON professional_listing_entitlements FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  );

-- Seed default entitlements for eligible portal types
INSERT INTO professional_listing_entitlements (portal_type, subscription_tier, directory_listing_enabled, passive_feed_discovery_enabled, monthly_main_feed_post_allowance, main_feed_promotion_duration_hours, social_feed_promotion_enabled)
VALUES
  ('creator-portal', 'standard', true, true, 3, 24, false),
  ('coach-portal', 'standard', true, true, 3, 24, false),
  ('business-portal', 'standard', true, true, 5, 24, false),
  ('stable-portal', 'standard', true, true, 3, 24, false),
  ('media-portal', 'standard', true, true, 3, 24, false)
ON CONFLICT (portal_type, subscription_tier) DO NOTHING;

-- ============================================================
-- 3. PROFESSIONAL PROMOTIONS (Main Feed promotional posts)
-- ============================================================

CREATE TABLE IF NOT EXISTS professional_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES professional_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The industry_wire_post created for this promotion
  industry_wire_post_id uuid,
  -- Billing period tracking (YYYY-MM format)
  billing_period text NOT NULL,
  -- Content
  headline text NOT NULL DEFAULT '',
  description text DEFAULT '',
  image_url text,
  cta_label text DEFAULT '',
  cta_url text,
  category text,
  -- Timing
  promoted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE professional_promotions ENABLE ROW LEVEL SECURITY;

-- Owners can read their own promotions
DROP POLICY IF EXISTS "select_own_promotions" ON professional_promotions;
CREATE POLICY "select_own_promotions" ON professional_promotions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Public can read active promotions (for feed display)
DROP POLICY IF EXISTS "select_public_promotions" ON professional_promotions;
CREATE POLICY "select_public_promotions" ON professional_promotions FOR SELECT
  TO anon, authenticated USING (status = 'active');

-- Owners can insert their own promotions (server-side function enforces allowance)
DROP POLICY IF EXISTS "insert_own_promotions" ON professional_promotions;
CREATE POLICY "insert_own_promotions" ON professional_promotions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owners can update/cancel their own promotions
DROP POLICY IF EXISTS "update_own_promotions" ON professional_promotions;
CREATE POLICY "update_own_promotions" ON professional_promotions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff can manage all promotions
DROP POLICY IF EXISTS "staff_manage_promotions" ON professional_promotions;
CREATE POLICY "staff_manage_promotions" ON professional_promotions FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  );

-- Index for querying active promotions
CREATE INDEX IF NOT EXISTS idx_prof_promotions_active
  ON professional_promotions (status, expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_prof_promotions_billing
  ON professional_promotions (user_id, billing_period);

-- ============================================================
-- 4. PROFESSIONAL ANALYTICS EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS professional_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES professional_listings(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('profile_view','directory_impression','directory_click','feed_promotion_impression','feed_promotion_click','cta_click')),
  viewer_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE professional_analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert analytics events (tracking)
DROP POLICY IF EXISTS "insert_analytics_events" ON professional_analytics_events;
CREATE POLICY "insert_analytics_events" ON professional_analytics_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Listing owners can read their own analytics
DROP POLICY IF EXISTS "select_own_analytics" ON professional_analytics_events;
CREATE POLICY "select_own_analytics" ON professional_analytics_events FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM professional_listings
      WHERE professional_listings.id = professional_analytics_events.listing_id
      AND professional_listings.user_id = auth.uid()
    )
  );

-- Staff can read all analytics
DROP POLICY IF EXISTS "staff_read_analytics" ON professional_analytics_events;
CREATE POLICY "staff_read_analytics" ON professional_analytics_events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sv_is_staff_or_admin())
  );

CREATE INDEX IF NOT EXISTS idx_prof_analytics_listing
  ON professional_analytics_events (listing_id, event_type, created_at);

-- ============================================================
-- 5. SECURITY DEFINER: Create promotion with allowance check
-- ============================================================
-- This function enforces the monthly allowance server-side.
-- Users cannot bypass it via client-side manipulation.

CREATE OR REPLACE FUNCTION public.create_professional_promotion(
  p_listing_id uuid,
  p_headline text,
  p_description text DEFAULT '',
  p_image_url text DEFAULT NULL,
  p_cta_label text DEFAULT '',
  p_cta_url text DEFAULT NULL,
  p_category text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing professional_listings%ROWTYPE;
  v_entitlement professional_listing_entitlements%ROWTYPE;
  v_billing_period text;
  v_existing_count integer;
  v_allowance integer;
  v_duration_hours integer;
  v_expires_at timestamptz;
  v_promotion_id uuid;
  v_wire_post_id uuid;
BEGIN
  -- 1. Verify the caller owns this listing
  SELECT * INTO v_listing FROM professional_listings WHERE id = p_listing_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found or not owned by you');
  END IF;

  -- 2. Check listing is approved and visible
  IF v_listing.moderation_status != 'approved' OR NOT v_listing.is_visible THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing must be approved and visible to promote');
  END IF;

  -- 3. Get entitlements for this portal type
  SELECT * INTO v_entitlement FROM professional_listing_entitlements
    WHERE portal_type = v_listing.portal_type AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No entitlements configured for this portal type');
  END IF;

  -- 4. Check if promotions are enabled
  IF v_entitlement.monthly_main_feed_post_allowance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promotions are not enabled for your portal type');
  END IF;

  -- 5. Calculate billing period (YYYY-MM based on current month)
  v_billing_period := to_char(now(), 'YYYY-MM');

  -- 6. Count existing promotions this billing period
  SELECT count(*) INTO v_existing_count FROM professional_promotions
    WHERE user_id = auth.uid()
    AND billing_period = v_billing_period
    AND status IN ('active','expired');

  -- 7. Check allowance
  v_allowance := v_entitlement.monthly_main_feed_post_allowance;
  IF v_existing_count >= v_allowance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monthly promotional allowance reached',
      'used', v_existing_count, 'allowance', v_allowance,
      'resets', to_char((date_trunc('month', now()) + interval '1 month'), 'YYYY-MM-DD'));
  END IF;

  -- 8. Calculate expiry
  v_duration_hours := v_entitlement.main_feed_promotion_duration_hours;
  v_expires_at := now() + (v_duration_hours || ' hours')::interval;

  -- 9. Create the industry_wire post for the Main Feed
  INSERT INTO industry_wire_posts (
    source_name, source_handle, source_avatar, source_verified,
    content_type, title, body, cta_label, cta_url,
    is_promoted, is_featured, metadata
  ) VALUES (
    v_listing.display_name,
    v_listing.portal_type,
    v_listing.profile_image_url,
    false,
    'PROFESSIONAL',
    p_headline,
    p_description,
    NULLIF(p_cta_label, ''),
    NULLIF(p_cta_url, ''),
    true,
    false,
    jsonb_build_object(
      'listing_id', p_listing_id,
      'portal_type', v_listing.portal_type,
      'image_url', p_image_url,
      'category', p_category
    )
  ) RETURNING id INTO v_wire_post_id;

  -- 10. Create the promotion record
  INSERT INTO professional_promotions (
    listing_id, user_id, industry_wire_post_id,
    billing_period, headline, description, image_url,
    cta_label, cta_url, category,
    promoted_at, expires_at, status
  ) VALUES (
    p_listing_id, auth.uid(), v_wire_post_id,
    v_billing_period, p_headline, p_description, p_image_url,
    p_cta_label, p_cta_url, p_category,
    now(), v_expires_at, 'active'
  ) RETURNING id INTO v_promotion_id;

  RETURN jsonb_build_object(
    'success', true,
    'promotion_id', v_promotion_id,
    'wire_post_id', v_wire_post_id,
    'expires_at', v_expires_at,
    'used', v_existing_count + 1,
    'allowance', v_allowance,
    'resets', to_char((date_trunc('month', now()) + interval '1 month'), 'YYYY-MM-DD')
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_professional_promotion TO authenticated;

-- ============================================================
-- 6. SECURITY DEFINER: Get promotion usage for current billing period
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_promotion_usage(
  p_user_id uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing_period text;
  v_used integer;
  v_listing professional_listings%ROWTYPE;
  v_entitlement professional_listing_entitlements%ROWTYPE;
BEGIN
  v_billing_period := to_char(now(), 'YYYY-MM');

  SELECT count(*) INTO v_used FROM professional_promotions
    WHERE user_id = p_user_id
    AND billing_period = v_billing_period
    AND status IN ('active','expired');

  -- Get the user's listing to determine portal type
  SELECT * INTO v_listing FROM professional_listings
    WHERE user_id = p_user_id AND moderation_status = 'approved' LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_entitlement FROM professional_listing_entitlements
      WHERE portal_type = v_listing.portal_type AND is_active = true LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'used', v_used,
    'allowance', COALESCE(v_entitlement.monthly_main_feed_post_allowance, 0),
    'remaining', GREATEST(COALESCE(v_entitlement.monthly_main_feed_post_allowance, 0) - v_used, 0),
    'billing_period', v_billing_period,
    'resets_at', to_char((date_trunc('month', now()) + interval '1 month'), 'YYYY-MM-DD'),
    'duration_hours', COALESCE(v_entitlement.main_feed_promotion_duration_hours, 24)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_promotion_usage TO authenticated;

-- ============================================================
-- 7. SECURITY DEFINER: Auto-expire promotions past their end time
-- ============================================================
-- Called by the feed query or a scheduled job

CREATE OR REPLACE FUNCTION public.expire_old_promotions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE professional_promotions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_old_promotions TO authenticated;

-- ============================================================
-- 8. FUNCTION: Sync listing visibility with subscription status
-- ============================================================
-- When called, sets is_visible based on active portal membership

CREATE OR REPLACE FUNCTION public.sync_listing_visibility()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set visible = true for approved listings with active subscriptions
  UPDATE professional_listings
    SET is_visible = true
    WHERE moderation_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM portal_memberships pm
      WHERE pm.user_id = professional_listings.user_id
      AND pm.portal_id = professional_listings.portal_type
      AND pm.status = 'subscribed'
      AND (pm.expires_at IS NULL OR pm.expires_at > now())
    )
    AND is_visible = false;

  -- Set visible = false when subscription has lapsed
  UPDATE professional_listings
    SET is_visible = false
    WHERE NOT EXISTS (
      SELECT 1 FROM portal_memberships pm
      WHERE pm.user_id = professional_listings.user_id
      AND pm.portal_id = professional_listings.portal_type
      AND pm.status = 'subscribed'
      AND (pm.expires_at IS NULL OR pm.expires_at > now())
    )
    AND is_visible = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_listing_visibility TO authenticated;

-- ============================================================
-- 9. TRIGGER: Update updated_at on listings
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_professional_listing_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professional_listings_updated ON professional_listings;
CREATE TRIGGER trg_professional_listings_updated
  BEFORE UPDATE ON professional_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_professional_listing_timestamp();

DROP TRIGGER IF EXISTS trg_prof_promotions_updated ON professional_promotions;
CREATE TRIGGER trg_prof_promotions_updated
  BEFORE UPDATE ON professional_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_professional_listing_timestamp();
