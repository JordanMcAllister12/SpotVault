import { supabase } from '@/lib/supabase';

function notifySavedHandChange(userId: string, handId: string, saved: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spotvault:saved-hand-changed', { detail: { userId, handId, saved } }));
  }
}

export interface SavedHand {
  id: string;
  hand_id: string;
  hand_user_id: string;
  saved_at: string;
}

export async function fetchSavedHandIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('sv_saved_hands')
    .select('hand_id')
    .eq('user_id', userId);
  if (error) {
    console.error('fetchSavedHandIds error:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map(r => (r as { hand_id: string }).hand_id));
}

export async function fetchSavedHands(userId: string): Promise<SavedHand[]> {
  const { data, error } = await supabase
    .from('sv_saved_hands')
    .select('id, hand_id, hand_user_id, saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) {
    console.error('fetchSavedHands error:', error.message);
    return [];
  }
  return (data ?? []) as SavedHand[];
}

export async function saveHand(userId: string, handId: string, handUserId?: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_saved_hands')
    .insert({
      user_id: userId,
      hand_id: handId,
      hand_user_id: handUserId ?? userId,
    });
  if (error) {
    if (error.code === '23505') return true;
    console.error('saveHand error:', error.message);
    return false;
  }
  notifySavedHandChange(userId, handId, true);
  return true;
}

export async function unsaveHand(userId: string, handId: string, handUserId?: string): Promise<boolean> {
  let query = supabase
    .from('sv_saved_hands')
    .delete()
    .eq('user_id', userId)
    .eq('hand_id', handId);
  if (handUserId) query = query.eq('hand_user_id', handUserId);
  const { error } = await query;
  if (error) {
    console.error('unsaveHand error:', error.message);
    return false;
  }
  notifySavedHandChange(userId, handId, false);
  return true;
}

export async function isHandSaved(userId: string, handId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sv_saved_hands')
    .select('id')
    .eq('user_id', userId)
    .eq('hand_id', handId)
    .maybeSingle();
  if (error) {
    console.error('isHandSaved error:', error.message);
    return false;
  }
  return !!data;
}
