/*
# Add Tool/Product Entitlements to Access Control

## Purpose
Extends the existing `sv_staff_get_user_permissions` function to also return
tool/product access information (Analytics, Solver, HH Replayer, Hand Workspace,
Multi-Spot Analysis, Creator Tools, Coach Tools) along with the source of each
tool's access (subscription plan, paid add-on, portal membership, role, etc.).

## Changes
- Replaces `sv_staff_get_user_permissions` with an updated version that adds a
  `tools` array to the returned JSON. Each tool entry includes:
  - `key`: tool identifier
  - `label`: display name
  - `status`: 'active' | 'inactive'
  - `source`: description of why the user has access (e.g. "Player Portal", "Elite Plan", "Solver Add-on", "Coach Role")

## Tool Access Logic
- **Analytics**: active if user has PLAYER or COACH portal access, or has an
  analytics entitlement. Source = portal name or entitlement.
- **Solver**: active if user has PLAYER or COACH portal access, or has a solver
  entitlement. Source = portal name or entitlement.
- **HH Replayer**: active if user has PLAYER or COACH portal access. Source = portal.
- **Hand Workspace**: active if user has PLAYER portal access. Source = portal.
- **Multi-Spot Analysis**: active if user has PLAYER or CREATOR portal access,
  or has `can_create_multispot` permission. Source = portal or permission.
- **Creator Tools**: active if user has CREATOR role. Source = role.
- **Coach Tools**: active if user has COACH role. Source = role.
- **StakeKings Tools**: active if user has active StakeKings partner attribution.
  Source = partner entitlement.

## Security
- No changes to existing RLS or security. Function remains SECURITY DEFINER,
  staff-only. No new tables. No permission enforcement changes.

## Notes
1. This is a display-only enhancement — it reads existing data and presents it.
2. Tool access enforcement is NOT changed — it continues to use the existing
   client-side `hasSolverAccess`/`hasAnalyticsAccess` functions and portal checks.
3. The source field helps staff understand WHY a user has access without needing
   to check multiple systems.
*/

CREATE OR REPLACE FUNCTION sv_staff_get_user_permissions(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_roles jsonb;
  v_portals jsonb;
  v_capabilities jsonb;
  v_feed_posting jsonb;
  v_network_posting jsonb;
  v_creator_perms jsonb;
  v_creator_apps jsonb;
  v_partner jsonb;
  v_booking jsonb;
  v_community jsonb;
  v_entitlements jsonb;
  v_profile jsonb;
  v_tools jsonb;
  v_has_player boolean;
  v_has_coach boolean;
  v_has_creator boolean;
  v_has_stakekings boolean;
  v_has_solver_ent boolean;
  v_has_analytics_ent boolean;
  v_tool_items jsonb[];
BEGIN
  IF NOT sv_is_staff_or_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Roles
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'role', role, 'status', status, 'approved_by', approved_by, 'approved_at', approved_at
  )), '[]'::jsonb) INTO v_roles
  FROM sv_roles WHERE user_id = p_user_id;

  -- Portal access
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'portal_type', portal_type, 'status', status, 'expires_at', expires_at
  )), '[]'::jsonb) INTO v_portals
  FROM sv_portal_access WHERE user_id = p_user_id;

  -- Capabilities
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'capability', capability, 'status', status, 'granted_by', granted_by, 'granted_at', granted_at
  )), '[]'::jsonb) INTO v_capabilities
  FROM sv_user_capabilities WHERE user_id = p_user_id;

  -- Feed posting requests
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'status', status, 'category', category, 'created_at', created_at, 'reviewed_at', reviewed_at
  )), '[]'::jsonb) INTO v_feed_posting
  FROM sv_general_feed_posting_requests WHERE user_id = p_user_id;

  -- Network posting approvals
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'status', status, 'category', category, 'granted_at', granted_at
  )), '[]'::jsonb) INTO v_network_posting
  FROM sv_network_posting_approvals WHERE user_id = p_user_id;

  -- Creator permissions
  SELECT COALESCE(jsonb_build_object(
    'can_publish_video_spots', can_publish_video_spots,
    'can_create_multispot', can_create_multispot,
    'granted_at', granted_at
  ), '{}'::jsonb) INTO v_creator_perms
  FROM sv_creator_permissions WHERE user_id = p_user_id;

  -- Creator applications
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'application_type', application_type, 'status', status, 'created_at', created_at, 'reviewed_at', reviewed_at
  )), '[]'::jsonb) INTO v_creator_apps
  FROM sv_creator_applications WHERE user_id = p_user_id;

  -- Partner attributions
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'partner_slug', partner_slug, 'status', status, 'verified', verified,
    'entitlement_active', entitlement_active, 'stakekings_role', stakekings_role,
    'joined_at', joined_at, 'verified_at', verified_at
  )), '[]'::jsonb) INTO v_partner
  FROM partner_attributions WHERE user_id = p_user_id;

  -- Booking provider approval
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'status', status, 'categories', categories, 'approved_at', approved_at, 'revoked_at', revoked_at
  )), '[]'::jsonb) INTO v_booking
  FROM booking_provider_approvals WHERE account_id = p_user_id;

  -- Community entitlements
  SELECT COALESCE(jsonb_build_object(
    'tier', tier, 'is_paid_member', is_paid_member, 'member_since', member_since,
    'privileges', privileges, 'priority_weight', priority_weight
  ), '{}'::jsonb) INTO v_community
  FROM community_entitlements WHERE user_id = p_user_id;

  -- Entitlements (purchases/subscriptions)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'entitlement_type', entitlement_type, 'reference_id', reference_id, 'expires_at', expires_at
  )), '[]'::jsonb) INTO v_entitlements
  FROM sv_entitlements WHERE user_id = p_user_id;

  -- Profile + account status
  SELECT jsonb_build_object(
    'display_name', up.display_name,
    'username', up.username,
    'email', COALESCE(au.email, ''),
    'avatar_url', up.avatar_url,
    'poker_role', up.poker_role,
    'created_at', up.created_at,
    'account_status', CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END
  ) INTO v_profile
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id::text = up.user_id
  WHERE up.user_id = p_user_id;

  -- ── Determine tool access ──
  v_has_player := EXISTS(
    SELECT 1 FROM sv_portal_access pa
    WHERE pa.user_id = p_user_id AND pa.portal_type = 'player' AND pa.status = 'active'
  );
  v_has_coach := EXISTS(
    SELECT 1 FROM sv_portal_access pa
    WHERE pa.user_id = p_user_id AND pa.portal_type = 'coach' AND pa.status = 'active'
  );
  v_has_creator := EXISTS(
    SELECT 1 FROM sv_portal_access pa
    WHERE pa.user_id = p_user_id AND pa.portal_type = 'creator' AND pa.status = 'active'
  );
  v_has_stakekings := EXISTS(
    SELECT 1 FROM partner_attributions pa
    WHERE pa.user_id = p_user_id AND pa.partner_slug = 'stakekings' AND pa.entitlement_active = true
  );

  -- Check for solver/analytics entitlements
  SELECT EXISTS(
    SELECT 1 FROM sv_entitlements e
    WHERE e.user_id = p_user_id
    AND (e.reference_id ILIKE '%solver%' OR e.reference_id ILIKE '%solver_addon%')
  ) INTO v_has_solver_ent;

  SELECT EXISTS(
    SELECT 1 FROM sv_entitlements e
    WHERE e.user_id = p_user_id
    AND (e.reference_id ILIKE '%analytics%' OR e.reference_id ILIKE '%elite%' OR e.reference_id ILIKE '%pro%')
  ) INTO v_has_analytics_ent;

  -- Build tool items
  v_tool_items := ARRAY[
    jsonb_build_object(
      'key', 'analytics',
      'label', 'Analytics',
      'status', CASE WHEN v_has_player OR v_has_coach OR v_has_analytics_ent THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_analytics_ent THEN 'Subscription / Add-on'
        WHEN v_has_player THEN 'Player Portal'
        WHEN v_has_coach THEN 'Coach Portal'
        ELSE 'Not Included'
      END
    ),
    jsonb_build_object(
      'key', 'solver',
      'label', 'Solver',
      'status', CASE WHEN v_has_player OR v_has_coach OR v_has_solver_ent THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_solver_ent THEN 'Solver Add-on'
        WHEN v_has_player THEN 'Player Portal'
        WHEN v_has_coach THEN 'Coach Portal'
        ELSE 'Not Included'
      END
    ),
    jsonb_build_object(
      'key', 'hh_replayer',
      'label', 'HH Replayer',
      'status', CASE WHEN v_has_player OR v_has_coach THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_player THEN 'Player Portal'
        WHEN v_has_coach THEN 'Coach Portal'
        ELSE 'Not Included'
      END
    ),
    jsonb_build_object(
      'key', 'hand_workspace',
      'label', 'Hand Workspace',
      'status', CASE WHEN v_has_player THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_player THEN 'Player Portal'
        ELSE 'Not Included'
      END
    ),
    jsonb_build_object(
      'key', 'multispot',
      'label', 'Multi-Spot Analysis',
      'status', CASE WHEN v_has_player OR v_has_creator OR COALESCE((SELECT can_create_multispot FROM sv_creator_permissions WHERE user_id = p_user_id), false) THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN COALESCE((SELECT can_create_multispot FROM sv_creator_permissions WHERE user_id = p_user_id), false) THEN 'Creator Permission'
        WHEN v_has_player THEN 'Player Portal'
        WHEN v_has_creator THEN 'Creator Portal'
        ELSE 'Not Included'
      END
    ),
    jsonb_build_object(
      'key', 'creator_tools',
      'label', 'Creator Tools',
      'status', CASE WHEN v_has_creator THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_creator THEN 'Creator Role'
        ELSE 'Not Assigned'
      END
    ),
    jsonb_build_object(
      'key', 'coach_tools',
      'label', 'Coach Tools',
      'status', CASE WHEN v_has_coach THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_coach THEN 'Coach Role'
        ELSE 'Not Assigned'
      END
    ),
    jsonb_build_object(
      'key', 'stakekings_tools',
      'label', 'StakeKings Tools',
      'status', CASE WHEN v_has_stakekings THEN 'active' ELSE 'inactive' END,
      'source', CASE
        WHEN v_has_stakekings THEN 'StakeKings Portal'
        ELSE 'Not Granted'
      END
    )
  ];

  v_tools := COALESCE(jsonb_agg(item), '[]'::jsonb)
  FROM unnest(v_tool_items) AS item;

  v_result := jsonb_build_object(
    'profile', v_profile,
    'roles', v_roles,
    'portals', v_portals,
    'capabilities', v_capabilities,
    'feed_posting', v_feed_posting,
    'network_posting', v_network_posting,
    'creator_permissions', v_creator_perms,
    'creator_applications', v_creator_apps,
    'partner', v_partner,
    'booking_provider', v_booking,
    'community', v_community,
    'entitlements', v_entitlements,
    'tools', v_tools
  );

  RETURN v_result;
END;
$$;
