import { supabase } from '@/lib/supabase';

export interface CanonicalHandNote {
  id: string;
  user_id: string;
  hand_id: string;
  hand_user_id: string;
  note_text: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchCanonicalHandNote(
  userId: string,
  handId: string,
  handUserId: string,
): Promise<CanonicalHandNote | null> {
  const { data, error } = await supabase
    .from('sv_canonical_hand_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('hand_id', handId)
    .eq('hand_user_id', handUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CanonicalHandNote;
}

export async function fetchAllCanonicalNotes(
  userId: string,
): Promise<CanonicalHandNote[]> {
  const { data, error } = await supabase
    .from('sv_canonical_hand_notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as CanonicalHandNote[];
}

export async function fetchFlaggedCanonicalNotes(
  userId: string,
): Promise<CanonicalHandNote[]> {
  const { data, error } = await supabase
    .from('sv_canonical_hand_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_flagged', true)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as CanonicalHandNote[];
}

export async function saveCanonicalNote(
  userId: string,
  handId: string,
  handUserId: string,
  noteText: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_canonical_hand_notes')
    .upsert(
      {
        user_id: userId,
        hand_id: handId,
        hand_user_id: handUserId,
        note_text: noteText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,hand_id,hand_user_id' },
    );
  return !error;
}

export async function toggleCanonicalFlag(
  userId: string,
  handId: string,
  handUserId: string,
  flagged: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_canonical_hand_notes')
    .upsert(
      {
        user_id: userId,
        hand_id: handId,
        hand_user_id: handUserId,
        is_flagged: flagged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,hand_id,hand_user_id' },
    );
  return !error;
}

export async function deleteCanonicalNote(
  userId: string,
  handId: string,
  handUserId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_canonical_hand_notes')
    .delete()
    .eq('user_id', userId)
    .eq('hand_id', handId)
    .eq('hand_user_id', handUserId);
  return !error;
}
