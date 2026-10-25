/*
# Fix network_chat_messages RLS + Separate ROLE from MEMBERSHIP

## Part 1: Fix network_chat_messages INSERT RLS

### Problem
Chat message sends fail with "new row violates row-level security policy for table 'network_chat_messages'".

Root cause: The `author_id` column is `text NOT NULL` with NO default. The INSERT policy
`network_chat_insert_identity` checks `author_id = auth.uid()::text`. If the frontend ever
sends an `author_id` that doesn't match `auth.uid()` (e.g. a demo account ID like 'acc-randy'),
the WITH CHECK fails and the insert is rejected.

### Fix
1. Add `DEFAULT auth.uid()::text` to `author_id` so even if the frontend omits it, the
   insert succeeds with the authenticated user's ID.
2. Consolidate the duplicate policy sets — there are two overlapping sets of policies
   (`chat_messages_*` and `network_chat_*`). Drop the old `chat_messages_*` policies
   and keep one clean set.
3. The INSERT policy remains `author_id = auth.uid()::text` — authenticated users can
   only insert messages as themselves.
4. SELECT policy: authenticated users can see all visible messages (same as before).
5. Add a `network_chat_insert_anon` policy is NOT needed — the app requires sign-in.

### Columns modified
- `network_chat_messages.author_id`: added `DEFAULT auth.uid()::text`

### Policies
- Drop old duplicates: `chat_messages_delete_own`, `chat_messages_select_anon`,
  `chat_messages_select_auth`, `chat_messages_update_own`
- Keep and recreate clean: `network_chat_select`, `network_chat_insert_identity`,
  `network_chat_update`, `network_chat_delete`

## Part 2: Separate ROLE (USER/STAFF/SUPERUSER) from MEMBERSHIP (PLAYER/CORE/PRO/ELITE)

### Problem
The `sv_staff_get_accounts` function returns `role` as the top role from `sv_roles`,
falling back to `'member'`. Users with only a `player` role row show as `member` (ROLE MISSING)
because the function's CASE doesn't recognize `player` as a real role — it falls through to
the ELSE 'member' branch.

The user wants:
- ACCOUNT ROLE: USER / STAFF / SUPERUSER (administrative identity)
- MEMBERSHIP: PLAYER / CORE / PRO / ELITE (paid access level)
- These are independent concepts that must not be inferred from each other.

### Fix
1. Update `sv_staff_get_accounts` to return:
   - `role`: USER / STAFF / SUPERUSER (derived from sv_roles: superuser→SUPERUSER,
     staff→STAFF, everything else→USER). No more 'member' fallback — default is USER.
   - `membership_tier`: PLAYER / CORE / PRO / ELITE (from user_memberships.tier_id,
     default PLAYER when no active membership)
2. Backfill: Insert `role='player'` into sv_roles for any authenticated user who has
   no sv_roles row at all, so they show as USER | PLAYER instead of ROLE MISSING.
3. The `user_profiles.primary_role` column stays as-is (portal preference, not admin role).

### Functions modified
- `sv_staff_get_accounts`: updated role derivation logic

### Data changes
- Backfill missing sv_roles rows with `role='player', status='active'` for users who
  have an auth.users account but no sv_roles entry.
*/

-- ═══════════════════════════════════════════════════════════════
-- Part 1: Fix network_chat_messages RLS
-- ═══════════════════════════════════════════════════════════════

-- Add default to author_id so inserts that omit it still work
ALTER TABLE public.network_chat_messages
  ALTER COLUMN author_id SET DEFAULT auth.uid()::text;

-- Drop old duplicate policies
DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.network_chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_anon" ON public.network_chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_auth" ON public.network_chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_own" ON public.network_chat_messages;

-- Recreate clean SELECT policy (authenticated sees all visible, anon sees visible)
DROP POLICY IF EXISTS "network_chat_select" ON public.network_chat_messages;
CREATE POLICY "network_chat_select"
ON public.network_chat_messages FOR SELECT
TO anon, authenticated
USING (moderation_status = 'visible' OR moderation_status IS NULL);

-- Recreate clean INSERT policy (authenticated users insert as themselves)
DROP POLICY IF EXISTS "network_chat_insert_identity" ON public.network_chat_messages;
CREATE POLICY "network_chat_insert_identity"
ON public.network_chat_messages FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid()::text);

-- Recreate clean UPDATE policy (own messages only)
DROP POLICY IF EXISTS "network_chat_update" ON public.network_chat_messages;
CREATE POLICY "network_chat_update"
ON public.network_chat_messages FOR UPDATE
TO authenticated
USING (author_id = auth.uid()::text)
WITH CHECK (author_id = auth.uid()::text);

-- Recreate clean DELETE policy (own messages only)
DROP POLICY IF EXISTS "network_chat_delete" ON public.network_chat_messages;
CREATE POLICY "network_chat_delete"
ON public.network_chat_messages FOR DELETE
TO authenticated
USING (author_id = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════
-- Part 2: Separate ROLE from MEMBERSHIP in sv_staff_get_accounts
-- ═══════════════════════════════════════════════════════════════

-- Backfill: ensure every auth user has at least a 'player' role row
-- so they show as USER | PLAYER instead of ROLE MISSING
INSERT INTO public.sv_roles (user_id, role, status)
SELECT au.id, 'player', 'active'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.sv_roles sr WHERE sr.user_id = au.id
)
ON CONFLICT DO NOTHING;

-- Recreate the function with clean role/membership separation
CREATE OR REPLACE FUNCTION public.sv_staff_get_accounts(
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id text,
  email text,
  display_name text,
  username text,
  role text,
  status text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  primary_role text,
  poker_role text,
  membership_tier text,
  profile_complete boolean,
  sv_user_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_is_staff boolean;
BEGIN
  v_uid := auth.uid();
  v_is_staff := public.sv_is_staff_or_admin();

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Permission denied (uid=%, staff=%)', v_uid, v_is_staff;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (au.id)
    au.id::text AS user_id,
    au.email::text AS email,
    COALESCE(up.display_name, au.email::text)::text AS display_name,
    COALESCE(up.username, '')::text AS username,
    -- ACCOUNT ROLE: SUPERUSER / STAFF / USER (never 'member')
    COALESCE(
      CASE
        WHEN sr_superuser.role IS NOT NULL THEN 'superuser'
        WHEN sr_staff.role IS NOT NULL THEN 'staff'
        ELSE 'user'
      END,
      'user'
    )::text AS role,
    CASE
      WHEN au.banned_until IS NOT NULL AND au.banned_until > now() THEN 'banned'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END::text AS status,
    au.created_at AS created_at,
    au.last_sign_in_at AS last_sign_in_at,
    COALESCE(up.primary_role, 'player')::text AS primary_role,
    COALESCE(up.poker_role, '')::text AS poker_role,
    -- MEMBERSHIP: PLAYER / CORE / PRO / ELITE (from user_memberships, default PLAYER)
    COALESCE(um.tier_id, 'player')::text AS membership_tier,
    (up.user_id IS NOT NULL) AS profile_complete,
    COALESCE(up.sv_user_id, '')::text AS sv_user_id
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.user_id = au.id::text
  LEFT JOIN public.sv_roles sr_superuser ON sr_superuser.user_id = au.id AND sr_superuser.role = 'superuser' AND sr_superuser.status = 'active'
  LEFT JOIN public.sv_roles sr_staff ON sr_staff.user_id = au.id AND sr_staff.role = 'staff' AND sr_staff.status = 'active'
  LEFT JOIN public.user_memberships um ON um.user_id = au.id AND um.status = 'active'
  WHERE
    p_search IS NULL OR p_search = '' OR
    au.email ILIKE '%' || p_search || '%' OR
    COALESCE(up.display_name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(up.username, '') ILIKE '%' || p_search || '%' OR
    au.id::text ILIKE '%' || p_search || '%' OR
    COALESCE(up.sv_user_id, '') ILIKE '%' || p_search || '%'
  ORDER BY
    au.id,
    CASE
      WHEN sr_superuser.role IS NOT NULL THEN 1
      WHEN sr_staff.role IS NOT NULL THEN 2
      ELSE 99
    END,
    CASE WHEN p_sort = 'oldest' THEN au.created_at END ASC,
    CASE WHEN p_sort = 'alpha_az' THEN COALESCE(up.display_name, au.email::text) END ASC,
    CASE WHEN p_sort = 'alpha_za' THEN COALESCE(up.display_name, au.email::text) END DESC,
    CASE WHEN p_sort NOT IN ('oldest', 'alpha_az', 'alpha_za') THEN au.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
