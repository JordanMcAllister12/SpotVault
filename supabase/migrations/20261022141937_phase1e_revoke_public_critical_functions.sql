-- Revoke EXECUTE from PUBLIC on the 6 critical SECURITY DEFINER functions
-- PUBLIC grants execute to all roles including anon; must revoke from PUBLIC explicitly

REVOKE EXECUTE ON FUNCTION sv_add_credits(p_user_id uuid, p_amount integer, p_reason text, p_reference text, p_counterparty text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sv_admin_override_membership_audited(p_user_id uuid, p_tier text, p_reason text, p_set_by uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sv_apply_membership_lifecycle(p_user_id uuid, p_action text, p_tier text, p_stripe_customer_id text, p_stripe_subscription_id text, p_stripe_price_id text, p_status text, p_renewal_count integer, p_actor_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sv_credit_credits(p_user_id uuid, p_amount integer, p_reason text, p_reference text, p_counterparty text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sv_debit_credits(p_user_id uuid, p_amount integer, p_reason text, p_reference text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sv_grant_entitlement(p_user_id uuid, p_resource_id uuid, p_entitlement_type text, p_source text) FROM PUBLIC;
