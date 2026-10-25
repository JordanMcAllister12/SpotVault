/*
# Restrict Industry Wire posting to approved accounts

## Changes
1. Replace the open INSERT policy on industry_wire_posts with one that
   only allows users with the 'network_post' capability or staff roles.
2. Replace the open UPDATE/DELETE policies similarly.
3. Keep SELECT public (everyone can read the wire).

## Security
- INSERT: only authenticated users with network_post capability or staff role
- UPDATE: only authenticated users with network_post capability or staff role
- DELETE: only authenticated users with network_post capability or staff role
- SELECT: remains public (anon + authenticated)
*/

-- Drop old open policies
DROP POLICY IF EXISTS "anon_insert_wire_posts" ON industry_wire_posts;
DROP POLICY IF EXISTS "anon_update_wire_posts" ON industry_wire_posts;
DROP POLICY IF EXISTS "anon_delete_wire_posts" ON industry_wire_posts;

-- INSERT: only approved network posters or staff
CREATE POLICY "network_post_insert_wire" ON industry_wire_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id = auth.uid()
      AND capability = 'network_post'
      AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'superuser', 'admin', 'owner')
      AND status = 'active'
    )
  );

-- UPDATE: only approved network posters or staff
CREATE POLICY "network_post_update_wire" ON industry_wire_posts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id = auth.uid()
      AND capability = 'network_post'
      AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'superuser', 'admin', 'owner')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id = auth.uid()
      AND capability = 'network_post'
      AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'superuser', 'admin', 'owner')
      AND status = 'active'
    )
  );

-- DELETE: only approved network posters or staff
CREATE POLICY "network_post_delete_wire" ON industry_wire_posts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sv_user_capabilities
      WHERE user_id = auth.uid()
      AND capability = 'network_post'
      AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM sv_roles
      WHERE user_id = auth.uid()
      AND role IN ('staff', 'superuser', 'admin', 'owner')
      AND status = 'active'
    )
  );
