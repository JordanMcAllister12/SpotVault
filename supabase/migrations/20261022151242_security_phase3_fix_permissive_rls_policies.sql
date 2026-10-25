/*
# Security Phase 3: Fix Permissive RLS Policies on Sensitive Tables

## Summary
Tightens RLS policies on tables that had USING(true) or WITH CHECK(true),
allowing any authenticated user to read/modify financial and entitlement data.

## Changes
1. community_entitlements: restrict to own rows (user_id is text)
2. jukebox_purchases: restrict INSERT to own user_id (user_id is text)
3. creator_subscriptions: restrict SELECT to own subscriptions
4. subscription_benefits: restrict SELECT to own subscription benefits
5. subscription_qa_config: restrict SELECT to own QA config
6. content_access_grants: add DELETE for own grants
*/

-- 1. community_entitlements (user_id is text)
DROP POLICY IF EXISTS "entitlements_select_all" ON community_entitlements;
DROP POLICY IF EXISTS "entitlements_insert_self" ON community_entitlements;
DROP POLICY IF EXISTS "entitlements_update_self" ON community_entitlements;

CREATE POLICY "entitlements_select_own" ON community_entitlements
FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

CREATE POLICY "entitlements_insert_own" ON community_entitlements
FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "entitlements_update_own" ON community_entitlements
FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- 2. jukebox_purchases (user_id is text)
DROP POLICY IF EXISTS "insert_own_purchases" ON jukebox_purchases;

CREATE POLICY "insert_own_purchases" ON jukebox_purchases
FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

-- 3. creator_subscriptions: restrict SELECT to own
DROP POLICY IF EXISTS "select_subscriptions" ON creator_subscriptions;

CREATE POLICY "select_own_subscriptions" ON creator_subscriptions
FOR SELECT TO authenticated USING (auth.uid() = creator_user_id);

-- 4. subscription_benefits: restrict SELECT
DROP POLICY IF EXISTS "select_benefits" ON subscription_benefits;

CREATE POLICY "select_own_benefits" ON subscription_benefits
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.id = subscription_benefits.subscription_id AND cs.creator_user_id = auth.uid())
);

-- 5. subscription_qa_config: restrict SELECT
DROP POLICY IF EXISTS "select_qa_config" ON subscription_qa_config;

CREATE POLICY "select_own_qa_config" ON subscription_qa_config
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.id = subscription_qa_config.subscription_id AND cs.creator_user_id = auth.uid())
);

-- 6. content_access_grants: add DELETE for own grants (user_id is uuid)
DROP POLICY IF EXISTS "delete_own_access_grants" ON content_access_grants;
CREATE POLICY "delete_own_access_grants" ON content_access_grants
FOR DELETE TO authenticated USING (auth.uid() = user_id);
