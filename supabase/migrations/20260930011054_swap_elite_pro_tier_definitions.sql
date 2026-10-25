-- Swap elite/pro tier definitions so pro=mid($29.99) and elite=top($99.99)
-- The Stripe price IDs stay attached to their original price points.
-- prod_Uyapew76sSNk2w = $29.99 product → now belongs to 'pro'
-- prod_VLZFWif0vyvm5y = $99.99 product → now belongs to 'elite'

-- Step 1: Swap the row data (name, stripe_price_id, monthly_price_cents) between elite and pro
UPDATE membership_tiers SET
  name = CASE id
    WHEN 'pro' THEN 'Pro'
    WHEN 'elite' THEN 'Elite'
  END,
  stripe_price_id = CASE id
    WHEN 'pro' THEN 'prod_Uyapew76sSNk2w'   -- $29.99 product
    WHEN 'elite' THEN 'prod_VLZFWif0vyvm5y'  -- $99.99 product
  END,
  monthly_price_cents = CASE id
    WHEN 'pro' THEN 2999
    WHEN 'elite' THEN 9999
  END
WHERE id IN ('pro', 'elite');

-- Step 2: Swap existing user memberships so nobody gains or loses features
-- Users who had 'elite' (was $29.99 mid-tier) → now 'pro' (still $29.99 mid-tier)
-- Users who had 'pro' (was $99.99 top-tier) → now 'elite' (still $99.99 top-tier)
UPDATE user_memberships SET tier_id = CASE
    WHEN tier_id = 'elite' THEN 'pro'
    WHEN tier_id = 'pro' THEN 'elite'
    ELSE tier_id
  END
WHERE tier_id IN ('elite', 'pro');
