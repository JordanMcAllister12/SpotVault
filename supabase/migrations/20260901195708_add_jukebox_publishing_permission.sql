/*
# Add HH Jukebox Publishing Permission

## Purpose
Restrict who can publish HH Jukebox products. Only approved creators with the
`hh_jukebox_publish` capability may publish. This enforces server-side what the
frontend hides visually.

## Changes

### 1. New permission function
- `sv_can_publish_jukebox(p_user_id text)` — SECURITY DEFINER function that
  returns true if the user has an active `hh_jukebox_publish` capability in
  `sv_user_capabilities`, OR has a staff/superuser/admin/owner role in `sv_roles`.

### 2. Tightened RLS on jukebox_products
- INSERT: now requires `sv_can_publish_jukebox(creator_id)` to be true.
- UPDATE: now requires `sv_can_publish_jukebox(creator_id)`.
- DELETE: now requires `sv_can_publish_jukebox(creator_id)`.
- SELECT: unchanged (published products OR own drafts).

### 3. Tightened RLS on jukebox_product_hands
- INSERT: now requires the parent product's creator to have jukebox publish permission.
- DELETE: same check.

### 4. Tightened RLS on jukebox_hand_analysis
- INSERT: now requires the parent product's creator to have jukebox publish permission.
- UPDATE: same check.

### Important notes
1. The app uses mock auth — `creator_id` is a text column, not a UUID FK.
   The function accepts a text parameter and checks `sv_user_capabilities` and
   `sv_roles` by casting the uuid `user_id` columns to text for comparison.
2. SELECT policies remain unchanged — existing published products and drafts
   are still readable.
*/

-- ============================================================
-- 1. Permission function
-- ============================================================

CREATE OR REPLACE FUNCTION sv_can_publish_jukebox(p_user_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id::text = p_user_id
        AND capability = 'hh_jukebox_publish'
        AND status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM sv_roles
      WHERE user_id::text = p_user_id
        AND role IN ('staff', 'superuser', 'admin', 'owner')
        AND status = 'active'
    );
$$;

-- ============================================================
-- 2. Tighten jukebox_products RLS
-- ============================================================

DROP POLICY IF EXISTS "insert_products" ON jukebox_products;
CREATE POLICY "insert_products"
  ON jukebox_products FOR INSERT
  TO anon, authenticated
  WITH CHECK (sv_can_publish_jukebox(creator_id));

DROP POLICY IF EXISTS "update_own_products" ON jukebox_products;
CREATE POLICY "update_own_products"
  ON jukebox_products FOR UPDATE
  TO anon, authenticated
  USING (sv_can_publish_jukebox(creator_id))
  WITH CHECK (sv_can_publish_jukebox(creator_id));

DROP POLICY IF EXISTS "delete_own_products" ON jukebox_products;
CREATE POLICY "delete_own_products"
  ON jukebox_products FOR DELETE
  TO anon, authenticated
  USING (sv_can_publish_jukebox(creator_id));

-- ============================================================
-- 3. Tighten jukebox_product_hands RLS
-- ============================================================

DROP POLICY IF EXISTS "insert_product_hands" ON jukebox_product_hands;
CREATE POLICY "insert_product_hands"
  ON jukebox_product_hands FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jukebox_products
      WHERE jukebox_products.id = jukebox_product_hands.product_id
        AND sv_can_publish_jukebox(jukebox_products.creator_id)
    )
  );

DROP POLICY IF EXISTS "delete_product_hands" ON jukebox_product_hands;
CREATE POLICY "delete_product_hands"
  ON jukebox_product_hands FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jukebox_products
      WHERE jukebox_products.id = jukebox_product_hands.product_id
        AND sv_can_publish_jukebox(jukebox_products.creator_id)
    )
  );

-- ============================================================
-- 4. Tighten jukebox_hand_analysis RLS
-- ============================================================

DROP POLICY IF EXISTS "insert_hand_analysis" ON jukebox_hand_analysis;
CREATE POLICY "insert_hand_analysis"
  ON jukebox_hand_analysis FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jukebox_products
      WHERE jukebox_products.id = jukebox_hand_analysis.product_id
        AND sv_can_publish_jukebox(jukebox_products.creator_id)
    )
  );

DROP POLICY IF EXISTS "update_hand_analysis" ON jukebox_hand_analysis;
CREATE POLICY "update_hand_analysis"
  ON jukebox_hand_analysis FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jukebox_products
      WHERE jukebox_products.id = jukebox_hand_analysis.product_id
        AND sv_can_publish_jukebox(jukebox_products.creator_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jukebox_products
      WHERE jukebox_products.id = jukebox_hand_analysis.product_id
        AND sv_can_publish_jukebox(jukebox_products.creator_id)
    )
  );