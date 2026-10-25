/*
# Add personalization & lounge branding columns

## Purpose
Extend user_preferences and lounge_configs to support:
- Site-wide personal background (type, value, fit, position, overlay)
- Default landing page preference (portal / lounge / last-visited)
- Default lounge slug for auto-routing
- Lounge accent color (per-user override)
- Lounge owner branding: owner accent, logo, cover image
- Lounge member personalization toggle (owner-controlled)

## Changes to user_preferences
- site_bg_type: text — 'default' | 'preset' | 'custom'
- site_bg_value: text — URL or preset key
- site_bg_fit: text — 'cover' | 'contain'
- site_bg_position: text — 'top' | 'center' | 'bottom'
- site_bg_overlay: text — 'none' | 'light' | 'medium' | 'dark'
- default_landing: text — 'portal' | 'lounge' | 'last_visited'
- default_lounge_slug: text — slug of preferred lounge
- lounge_accent: text — hex color or preset name

## Changes to lounge_configs
- owner_accent: text — hex color for lounge default accent
- owner_logo: text — URL for lounge logo/branding
- owner_cover: text — URL for lounge cover/hero image
- member_personalization: boolean — whether members can personalize (default true)

## Security
- user_preferences: existing owner-scoped RLS already covers new columns
- lounge_configs: existing RLS already covers the table; new columns are readable by members
*/
DO $$ BEGIN
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS site_bg_type text;
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS site_bg_value text;
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS site_bg_fit text DEFAULT 'cover';
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS site_bg_position text DEFAULT 'center';
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS site_bg_overlay text DEFAULT 'medium';
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS default_landing text DEFAULT 'portal';
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS default_lounge_slug text;
  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS lounge_accent text;
END $$;

DO $$ BEGIN
  ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS owner_accent text;
  ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS owner_logo text;
  ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS owner_cover text;
  ALTER TABLE lounge_configs ADD COLUMN IF NOT EXISTS member_personalization boolean NOT NULL DEFAULT true;
END $$;