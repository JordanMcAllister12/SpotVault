/*
# Rename Manitoba Poker Network → Manitoba Poker

Update the portal name and slug for the Manitoba custom portal.
The slug changes from 'manitoba-poker-network' to 'manitoba-poker'.
Existing memberships reference the portal_id (UUID), not the slug,
so renaming the slug is safe — memberships remain intact.
*/

UPDATE custom_portals
SET name = 'Manitoba Poker',
    slug = 'manitoba-poker',
    updated_at = now()
WHERE slug = 'manitoba-poker-network';
