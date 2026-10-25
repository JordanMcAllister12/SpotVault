-- Access & Usage HUD: Resource Events, Plan Entitlements, Usage Tracking
-- Creates infrastructure for monitoring user access, entitlements, gating, usage.
-- Tables: sv_plan_entitlements, sv_resource_events, sv_usage_totals, sv_admin_overrides
-- Security: All RLS-enabled, staff-only via sv_is_staff_or_admin(), users read own data.

-- 1. SV_PLAN_ENTITLEMENTS
CREATE TABLE IF NOT EXISTS sv_plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  allowances jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sv_plan_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_plan_entitlements" ON sv_plan_entitlements;
CREATE POLICY "staff_select_plan_entitlements" ON sv_plan_entitlements FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "anon_select_plan_entitlements" ON sv_plan_entitlements;
CREATE POLICY "anon_select_plan_entitlements" ON sv_plan_entitlements FOR SELECT
  TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "staff_modify_plan_entitlements" ON sv_plan_entitlements;
CREATE POLICY "staff_modify_plan_entitlements" ON sv_plan_entitlements FOR ALL
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- 2. SV_RESOURCE_EVENTS
CREATE TABLE IF NOT EXISTS sv_resource_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  event_type text NOT NULL,
  plan text,
  usage_before integer,
  usage_after integer,
  usage_limit integer,
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failed', 'blocked', 'rate_limited', 'timeout')),
  failure_reason text,
  estimated_cost numeric(10,4),
  cost_unit text DEFAULT 'USD',
  related_id text,
  system_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_resource_events_user_idx ON sv_resource_events (user_id);
CREATE INDEX IF NOT EXISTS sv_resource_events_feature_idx ON sv_resource_events (feature);
CREATE INDEX IF NOT EXISTS sv_resource_events_type_idx ON sv_resource_events (event_type);
CREATE INDEX IF NOT EXISTS sv_resource_events_result_idx ON sv_resource_events (result);
CREATE INDEX IF NOT EXISTS sv_resource_events_created_idx ON sv_resource_events (created_at DESC);

ALTER TABLE sv_resource_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_resource_events" ON sv_resource_events;
CREATE POLICY "staff_select_resource_events" ON sv_resource_events FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "user_select_own_resource_events" ON sv_resource_events;
CREATE POLICY "user_select_own_resource_events" ON sv_resource_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_insert_resource_events" ON sv_resource_events;
CREATE POLICY "auth_insert_resource_events" ON sv_resource_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. SV_USAGE_TOTALS
CREATE TABLE IF NOT EXISTS sv_usage_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  period text NOT NULL DEFAULT 'weekly' CHECK (period IN ('daily', 'weekly', 'monthly', 'lifetime')),
  period_start date NOT NULL,
  period_end date,
  count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  rate_limited_count integer NOT NULL DEFAULT 0,
  current_limit integer,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sv_usage_totals_user_feature_period_unique UNIQUE (user_id, feature, period, period_start)
);

CREATE INDEX IF NOT EXISTS sv_usage_totals_user_idx ON sv_usage_totals (user_id);
CREATE INDEX IF NOT EXISTS sv_usage_totals_feature_idx ON sv_usage_totals (feature);
CREATE INDEX IF NOT EXISTS sv_usage_totals_period_idx ON sv_usage_totals (period_start DESC);

ALTER TABLE sv_usage_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_usage_totals" ON sv_usage_totals;
CREATE POLICY "staff_select_usage_totals" ON sv_usage_totals FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "user_select_own_usage_totals" ON sv_usage_totals;
CREATE POLICY "user_select_own_usage_totals" ON sv_usage_totals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_upsert_usage_totals" ON sv_usage_totals;
CREATE POLICY "auth_upsert_usage_totals" ON sv_usage_totals FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. SV_ADMIN_OVERRIDES
CREATE TABLE IF NOT EXISTS sv_admin_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  normal_limit integer,
  override_limit integer,
  reason text NOT NULL,
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sv_admin_overrides_user_idx ON sv_admin_overrides (user_id);
CREATE INDEX IF NOT EXISTS sv_admin_overrides_feature_idx ON sv_admin_overrides (feature);
CREATE INDEX IF NOT EXISTS sv_admin_overrides_active_idx ON sv_admin_overrides (is_active) WHERE is_active = true;

ALTER TABLE sv_admin_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_admin_overrides" ON sv_admin_overrides;
CREATE POLICY "staff_select_admin_overrides" ON sv_admin_overrides FOR SELECT
  TO authenticated USING (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_insert_admin_overrides" ON sv_admin_overrides;
CREATE POLICY "staff_insert_admin_overrides" ON sv_admin_overrides FOR INSERT
  TO authenticated WITH CHECK (public.sv_is_staff_or_admin());

DROP POLICY IF EXISTS "staff_update_admin_overrides" ON sv_admin_overrides;
CREATE POLICY "staff_update_admin_overrides" ON sv_admin_overrides FOR UPDATE
  TO authenticated
  USING (public.sv_is_staff_or_admin())
  WITH CHECK (public.sv_is_staff_or_admin());

-- 5. SEED: Plan entitlements
INSERT INTO sv_plan_entitlements (plan_code, label, display_order, allowances, features) VALUES
  ('FREE', 'Free', 1,
   '{"ai_assist_weekly": 3, "solver_daily": 0, "storage_mb": 100, "lounge_limit": 1, "monetization": false, "sync_share": 0, "content_upload": false, "export": false}'::jsonb,
   '["ai_assist", "basic_lounge", "public_library"]'::jsonb),
  ('CORE', 'Core', 2,
   '{"ai_assist_weekly": 10, "solver_daily": 2, "storage_mb": 500, "lounge_limit": 2, "monetization": false, "sync_share": 5, "content_upload": true, "export": false}'::jsonb,
   '["ai_assist", "solver", "lounges", "content_lab", "sync_share"]'::jsonb),
  ('ELITE', 'Elite', 3,
   '{"ai_assist_weekly": 50, "solver_daily": 10, "storage_mb": 2000, "lounge_limit": 4, "monetization": true, "sync_share": 20, "content_upload": true, "export": true}'::jsonb,
   '["ai_assist", "solver", "lounges", "content_lab", "monetization", "sync_share", "export"]'::jsonb),
  ('PRO', 'Pro', 4,
   '{"ai_assist_weekly": 200, "solver_daily": 50, "storage_mb": 10000, "lounge_limit": 99, "monetization": true, "sync_share": 100, "content_upload": true, "export": true}'::jsonb,
   '["ai_assist", "solver", "lounges", "content_lab", "monetization", "sync_share", "export", "priority_support"]'::jsonb)
ON CONFLICT (plan_code) DO NOTHING;
