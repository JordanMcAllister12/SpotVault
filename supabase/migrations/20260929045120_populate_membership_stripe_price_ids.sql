-- Populate stripe_price_id on membership_tiers using existing LIVE Stripe product IDs.
-- Free tier has no Stripe price (NULL). No new products or prices are created.

UPDATE membership_tiers SET stripe_price_id = 'prod_Uyaoe3qf9gZQ0k', updated_at = now() WHERE id = 'core';
UPDATE membership_tiers SET stripe_price_id = 'prod_Uyapew76sSNk2w', updated_at = now() WHERE id = 'elite';
UPDATE membership_tiers SET stripe_price_id = 'prod_VLZFWif0vyvm5y', updated_at = now() WHERE id = 'pro';
UPDATE membership_tiers SET stripe_price_id = NULL, updated_at = now() WHERE id = 'free';
