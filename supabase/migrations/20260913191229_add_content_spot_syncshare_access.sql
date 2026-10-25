/*
# Content Spot Sync Share Access

1. Purpose
- Allow recipients of sync shares to read the full content_spot data
- Add a function to list all content spots shared with the current user
- Add a function to list all recipients for a given content spot (for Manage Sharing)

2. New Functions
- `sv_list_shared_spots()` — returns content_spot rows shared with the current user via active syncshares, plus the owner's display name
- `sv_list_spot_share_recipients(p_content_id uuid)` — returns recipient user IDs and names for a given content spot

3. Security
- Recipients can only read content_spots where an active sv_syncshares row exists matching their user ID
- Only the owner of a syncshare can list its recipients
- All functions require authenticated role
*/

-- Function: list content spots shared with me
CREATE OR REPLACE FUNCTION public.sv_list_shared_spots()
RETURNS TABLE (
  id uuid,
  account_id text,
  creator_name text,
  status text,
  source text,
  title text,
  subtitle text,
  introduction text,
  hand_details text,
  visual_details jsonb,
  content_html text,
  image_urls text[],
  tags jsonb,
  is_monetized boolean,
  price_credits integer,
  show_in_courses boolean,
  quiz jsonb,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  shared_by text,
  shared_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    cs.id, cs.account_id, cs.creator_name, cs.status, cs.source,
    cs.title, cs.subtitle, cs.introduction, cs.hand_details,
    cs.visual_details, cs.content_html, cs.image_urls, cs.tags,
    cs.is_monetized, cs.price_credits, cs.show_in_courses, cs.quiz,
    cs.published_at, cs.created_at, cs.updated_at,
    COALESCE(p.display_name, s.owner_id::text) AS shared_by,
    s.created_at AS shared_at
  FROM sv_syncshares s
  JOIN content_spots cs ON cs.id = s.content_id
  LEFT JOIN user_profiles p ON p.user_id = s.owner_id::text
  WHERE s.recipient_id = auth.uid()
    AND s.content_type = 'content_spot'
    AND s.status = 'active'
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.sv_list_shared_spots() TO authenticated;

-- Function: list recipients for a content spot (owner only)
CREATE OR REPLACE FUNCTION public.sv_list_spot_share_recipients(p_content_id uuid)
RETURNS TABLE (
  syncshare_id uuid,
  recipient_id uuid,
  recipient_name text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    s.id AS syncshare_id,
    s.recipient_id,
    COALESCE(p.display_name, s.recipient_id::text) AS recipient_name,
    s.status,
    s.created_at
  FROM sv_syncshares s
  LEFT JOIN user_profiles p ON p.user_id = s.recipient_id::text
  WHERE s.content_id = p_content_id
    AND s.content_type = 'content_spot'
    AND s.owner_id = auth.uid()
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.sv_list_spot_share_recipients(uuid) TO authenticated;
