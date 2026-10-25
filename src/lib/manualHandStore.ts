import type { NormalizedHand } from '@/features/hh-replayer/types';
import { supabase } from '@/lib/supabase';

export interface ManualHandRecord {
  id: string;
  hand_id: string;
  normalized_hand: NormalizedHand;
  source: 'constructed' | 'manual';
  created_at: string;
}

export async function saveManualHand(hand: NormalizedHand): Promise<ManualHandRecord | null> {
  const { data, error } = await supabase
    .from('sv_manual_hand_records')
    .insert({ hand_id: hand.handId, normalized_hand: hand, source: 'constructed' })
    .select('id, hand_id, normalized_hand, source, created_at')
    .maybeSingle();

  if (error || !data) {
    console.error('save manual hand failed', error);
    return null;
  }

  return data as ManualHandRecord;
}

export async function findManualHand(handIdOrUrl: string): Promise<ManualHandRecord | null> {
  const handId = handIdOrUrl.trim().split('/').filter(Boolean).pop();
  if (!handId) return null;

  const { data, error } = await supabase
    .from('sv_manual_hand_records')
    .select('id, hand_id, normalized_hand, source, created_at')
    .eq('hand_id', handId.toUpperCase())
    .maybeSingle();

  if (error || !data) return null;
  return data as ManualHandRecord;
}

export async function listManualHands(): Promise<ManualHandRecord[]> {
  const { data, error } = await supabase
    .from('sv_manual_hand_records')
    .select('id, hand_id, normalized_hand, source, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as ManualHandRecord[];
}

export async function deleteManualHand(recordId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_manual_hand_records')
    .delete()
    .eq('id', recordId);
  if (error) {
    console.error('deleteManualHand error:', error);
    return false;
  }
  return true;
}

export async function renameManualHand(recordId: string, newTitle: string): Promise<boolean> {
  const { data: existing, error: fetchErr } = await supabase
    .from('sv_manual_hand_records')
    .select('normalized_hand')
    .eq('id', recordId)
    .maybeSingle();
  if (fetchErr || !existing) return false;
  const nh = existing.normalized_hand as NormalizedHand;
  nh.title = newTitle;
  const { error } = await supabase
    .from('sv_manual_hand_records')
    .update({ normalized_hand: nh })
    .eq('id', recordId);
  if (error) {
    console.error('renameManualHand error:', error);
    return false;
  }
  return true;
}

export function manualHandUrl(handId: string): string {
  return `${window.location.origin}/hand/${encodeURIComponent(handId)}`;
}
