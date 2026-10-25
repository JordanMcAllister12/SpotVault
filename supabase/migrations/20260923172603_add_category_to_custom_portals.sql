-- Add category column to custom_portals for future filtering
ALTER TABLE public.custom_portals ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'community';

-- Update Manitoba portal to have category = 'community'
UPDATE public.custom_portals SET category = 'community' WHERE slug = 'manitoba-poker-network';
