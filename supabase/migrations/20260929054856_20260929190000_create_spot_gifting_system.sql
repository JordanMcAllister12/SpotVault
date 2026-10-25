/*
# Spot Gifting System — Database Layer

## Purpose
Adds the server-side infrastructure for gifting Spots between users.
A gift is a REAL purchase — the sender pays credits, the creator gets their
normal payout, and the recipient receives permanent access.

## New Table: sv_spot_gifts
Ledger of all gift transactions. Records:
- sender_id (the purchaser)
- recipient_id (the person receiving the gift)
- spot_id (the content spot)
- price_credits (what was paid)
- creator_id (who created the spot)
- platform_fee_credits
- creator_payout_credits
- gift_message (optional short note from sender)
- metadata (jsonb for future multi-copy/giveaway support)

## New Function: sv_gift_content_spot
SECURITY DEFINER RPC that atomically:
1. Validates the spot is monetized and has a positive price
2. Checks recipient doesn't already own the spot (returns 'already_owns')
3. Checks neither user has blocked the other (returns 'blocked')
4. Debits sender's credits (returns 'insufficient_credits' if balance too low)
5. Credits creator's payout share
6. Inserts content_access_grants for the recipient (grant_type = 'GIFTED')
7. Inserts sv_entitlements for the recipient (source = 'gift')
8. Inserts sv_spot_gifts ledger row
9. Creates a system_messages notification for the recipient
10. Returns 'success' with the gift record ID

## Security
- SECURITY DEFINER, SET search_path = public
- GRANT EXECUTE to authenticated only
- All credit mutations go through existing sv_debit_credits / sv_credit_credits
- Block checks query sv_relationships
- No client-side credit manipulation possible
*/

-- ─────────────────────────────────────────────────────────────
-- 1. sv_spot_gifts ledger table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sv_spot_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  spot_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  price_credits integer NOT NULL,
  platform_fee_credits integer NOT NULL DEFAULT 0,
  creator_payout_credits integer NOT NULL DEFAULT 0,
  gift_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: sender and recipient can see their own gifts; staff can see all
ALTER TABLE sv_spot_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_gifts"
  ON sv_spot_gifts FOR SELECT TO authenticated
  USING (
    sender_id::text = auth.uid()::text
    OR recipient_id::text = auth.uid()::text
  );

-- No direct INSERT/UPDATE/DELETE from client — only the SECURITY DEFINER function writes

-- Index for looking up gifts received by a user
CREATE INDEX IF NOT EXISTS idx_spot_gifts_recipient ON sv_spot_gifts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_spot_gifts_sender ON sv_spot_gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_spot_gifts_spot ON sv_spot_gifts(spot_id);

-- ─────────────────────────────────────────────────────────────
-- 2. sv_gift_content_spot RPC
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sv_gift_content_spot(
  p_recipient_id uuid,
  p_spot_id uuid,
  p_gift_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_spot record;
  v_price integer;
  v_creator_id uuid;
  v_fee_percent integer;
  v_platform_fee integer;
  v_creator_share integer;
  v_gift_id uuid;
  v_is_blocked boolean;
BEGIN
  -- Validate spot
  SELECT * INTO v_spot FROM content_spots WHERE id = p_spot_id AND is_monetized = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_price := v_spot.price_credits;
  IF v_price IS NULL OR v_price <= 0 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_creator_id := v_spot.account_id::uuid;

  -- Can't gift to yourself
  IF v_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('status', 'self_gift');
  END IF;

  -- Check if recipient already owns the spot
  IF EXISTS(
    SELECT 1 FROM content_access_grants
    WHERE content_spot_id = p_spot_id AND user_id = p_recipient_id
  ) OR EXISTS(
    SELECT 1 FROM sv_entitlements
    WHERE resource_type = 'content_spot' AND resource_id = p_spot_id
      AND user_id = p_recipient_id AND revoked_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'already_owns');
  END IF;

  -- Check block (either direction)
  SELECT EXISTS(
    SELECT 1 FROM sv_relationships
    WHERE type = 'block' AND status = 'active'
      AND ((user_a = v_sender_id AND user_b = p_recipient_id)
        OR (user_a = p_recipient_id AND user_b = v_sender_id))
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  -- Compute economics
  v_fee_percent := sv_get_platform_fee_percent('content_sale');
  v_platform_fee := v_price * v_fee_percent / 100;
  v_creator_share := v_price - v_platform_fee;

  -- Debit sender
  IF NOT sv_debit_credits(v_sender_id, v_price, 'CONTENT_SALE_GIFT', p_spot_id, 'content_spot', p_recipient_id) THEN
    RETURN jsonb_build_object('status', 'insufficient_credits');
  END IF;

  -- Credit creator
  PERFORM sv_credit_credits(v_creator_id, v_creator_share, 'CONTENT_SALE_PAYOUT', p_spot_id, 'content_spot', v_sender_id);

  -- Grant access to recipient (content_access_grants)
  INSERT INTO content_access_grants (content_spot_id, user_id, grant_type)
  VALUES (p_spot_id, p_recipient_id, 'GIFTED');

  -- Grant entitlement (sv_entitlements) so it appears in My Spots
  INSERT INTO sv_entitlements (user_id, resource_type, resource_id, entitlement_type, source, metadata)
  VALUES (
    p_recipient_id,
    'content_spot',
    p_spot_id,
    'access',
    'gift',
    jsonb_build_object(
      'gifted_by', v_sender_id::text,
      'gift_message', p_gift_message,
      'price_credits', v_price
    )
  );

  -- Record in gift ledger
  INSERT INTO sv_spot_gifts (sender_id, recipient_id, spot_id, creator_id, price_credits, platform_fee_credits, creator_payout_credits, gift_message, metadata)
  VALUES (v_sender_id, p_recipient_id, p_spot_id, v_creator_id, v_price, v_platform_fee, v_creator_share, p_gift_message, jsonb_build_object('spot_title', v_spot.title, 'creator_name', v_spot.creator_name))
  RETURNING id INTO v_gift_id;

  -- Create system notification for recipient
  INSERT INTO system_messages (recipient_user_id, message_key, sender_type, subject, body, metadata)
  VALUES (
    p_recipient_id::text,
    'spot_gift',
    'system',
    'You received a Spot gift!',
    COALESCE(p_gift_message, ''),
    jsonb_build_object(
      'gift_id', v_gift_id::text,
      'spot_id', p_spot_id::text,
      'spot_title', v_spot.title,
      'creator_name', v_spot.creator_name,
      'sender_id', v_sender_id::text,
      'gift_message', p_gift_message,
      'actions', '["open_spot"]'::jsonb
    )
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'gift_id', v_gift_id::text,
    'spot_title', v_spot.title,
    'price_credits', v_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sv_gift_content_spot(uuid, uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. sv_check_spot_ownership — quick check if a user owns a spot
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sv_check_spot_ownership(p_user_id uuid, p_spot_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM content_access_grants
    WHERE content_spot_id = p_spot_id AND user_id = p_user_id
  ) OR EXISTS(
    SELECT 1 FROM sv_entitlements
    WHERE resource_type = 'content_spot' AND resource_id = p_spot_id
      AND user_id = p_user_id AND revoked_at IS NULL
  ) OR EXISTS(
    SELECT 1 FROM content_spots
    WHERE id = p_spot_id AND account_id::text = p_user_id::text
  );
$$;

GRANT EXECUTE ON FUNCTION sv_check_spot_ownership(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. sv_get_gifted_spots — spots a user has received as gifts
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sv_get_gifted_spots(p_limit int DEFAULT 50)
RETURNS TABLE (
  gift_id text,
  spot_id text,
  spot_title text,
  creator_name text,
  sender_id text,
  gift_message text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id::text,
    g.spot_id::text,
    cs.title,
    cs.creator_name,
    g.sender_id::text,
    g.gift_message,
    g.created_at
  FROM sv_spot_gifts g
  INNER JOIN content_spots cs ON cs.id = g.spot_id
  WHERE g.recipient_id = auth.uid()
  ORDER BY g.created_at DESC
  LIMIT LEAST(p_limit, 100);
END;
$$;

GRANT EXECUTE ON FUNCTION sv_get_gifted_spots(int) TO authenticated;
