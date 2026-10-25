-- Phase 1.6: Enable RLS on exposed tables
-- bb_accounting_audit: internal audit table, no direct user access
-- sv_spr_competition_pools: reference/config table, read-only for users

-- bb_accounting_audit: revoke all access from anon and authenticated, service_role only
REVOKE ALL ON bb_accounting_audit FROM anon, authenticated;
ALTER TABLE bb_accounting_audit ENABLE ROW LEVEL SECURITY;
-- No policies needed: only service_role (which bypasses RLS) should access audit data
CREATE POLICY "no_user_access_audit" ON bb_accounting_audit
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- sv_spr_competition_pools: revoke all from anon, restrict authenticated to SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON sv_spr_competition_pools FROM anon, authenticated;
REVOKE ALL ON sv_spr_competition_pools FROM anon;
GRANT SELECT ON sv_spr_competition_pools TO authenticated;
ALTER TABLE sv_spr_competition_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_competition_pools" ON sv_spr_competition_pools
  FOR SELECT TO authenticated
  USING (true);
