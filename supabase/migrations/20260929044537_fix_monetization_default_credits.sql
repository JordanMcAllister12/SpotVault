-- Update legacy default credit quantities to match the permanent 10 credits = $1 USD conversion.
-- These are DEFAULT values only — existing rows and creator-configured prices are not affected.

-- Creator subscription default: 1000 → 100 credits ($10.00/month)
ALTER TABLE creator_subscriptions
  ALTER COLUMN price_credits SET DEFAULT 100;

-- Paid request default: 500 → 50 credits ($5.00)
ALTER TABLE paid_request_settings
  ALTER COLUMN price_credits SET DEFAULT 50;
