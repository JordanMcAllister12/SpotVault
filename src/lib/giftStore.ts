import { supabase } from '@/lib/supabase';

// ── Types ──

export interface GiftableSpot {
  id: string;
  title: string;
  creator_name: string | null;
  price_credits: number;
  account_id: string;
}

export interface GiftResult {
  status: 'success' | 'not_found' | 'already_owns' | 'blocked' | 'insufficient_credits' | 'self_gift' | 'error';
  gift_id?: string;
  spot_title?: string;
  price_credits?: number;
}

// ── Fetch spots the user can gift (monetized spots they own or have access to) ──

export async function fetchGiftableSpots(): Promise<GiftableSpot[]> {
  const { data, error } = await supabase
    .from('content_spots')
    .select('id, title, creator_name, price_credits, account_id')
    .eq('is_monetized', true)
    .gt('price_credits', 0)
    .order('title');

  if (error || !data) return [];
  return data as GiftableSpot[];
}

// ── Check if a user already owns a spot ──

export async function checkSpotOwnership(userId: string, spotId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_check_spot_ownership', {
    p_user_id: userId,
    p_spot_id: spotId,
  });
  if (error) return false;
  return data as boolean;
}

// ── Gift a spot ──

export async function giftContentSpot(
  recipientId: string,
  spotId: string,
  giftMessage?: string,
): Promise<GiftResult> {
  const { data, error } = await supabase.rpc('sv_gift_content_spot', {
    p_recipient_id: recipientId,
    p_spot_id: spotId,
    p_gift_message: giftMessage ?? null,
  });

  if (error || !data) {
    return { status: 'error' };
  }

  return data as GiftResult;
}

// ── Search spots by title for the gift selector ──

export async function searchGiftableSpots(query: string): Promise<GiftableSpot[]> {
  const spots = await fetchGiftableSpots();
  if (!query.trim()) return spots;
  const q = query.toLowerCase();
  return spots.filter(s =>
    s.title?.toLowerCase().includes(q) ||
    s.creator_name?.toLowerCase().includes(q),
  );
}
