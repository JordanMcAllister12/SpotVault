import { supabase } from '@/lib/supabase';

export interface SpotEvidence {
  id: string;
  spot_id: string;
  account_id: string;
  asset_url: string;
  title: string | null;
  caption: string | null;
  classification: string | null;
  display_order: number;
  display_position: string;
  created_at: string;
}

export interface PendingEvidence {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  caption: string;
  classification: string;
}

export type EvidenceInput = Omit<SpotEvidence, 'id' | 'account_id' | 'created_at' | 'display_position'> & {
  display_position?: string;
};

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export function isAcceptedImageType(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

export async function uploadEvidenceImage(file: File): Promise<string | null> {
  if (!isAcceptedImageType(file) || file.size > 10 * 1024 * 1024) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `evidence/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(fileName, file, { upsert: false });
  if (error) {
    console.error('Evidence upload error:', error);
    return null;
  }
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(fileName);
  return data?.publicUrl ?? null;
}

export async function fetchEvidence(spotId: string): Promise<SpotEvidence[]> {
  const { data, error } = await supabase
    .from('spot_evidence')
    .select('*')
    .eq('spot_id', spotId)
    .order('display_order', { ascending: true });
  if (error) {
    console.error('fetchEvidence error:', error);
    return [];
  }
  return (data || []) as SpotEvidence[];
}

export async function addEvidence(
  spotId: string,
  assetUrl: string,
  title: string | null,
  caption: string | null,
  classification: string | null = null,
): Promise<SpotEvidence | null> {
  const { data: existing } = await supabase
    .from('spot_evidence')
    .select('id')
    .eq('spot_id', spotId);
  const nextOrder = existing?.length ?? 0;

  const { data, error } = await supabase
    .from('spot_evidence')
    .insert({
      spot_id: spotId,
      asset_url: assetUrl,
      title,
      caption,
      classification,
      display_order: nextOrder,
      display_position: 'after_content',
    })
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('addEvidence error:', error);
    return null;
  }
  return data as SpotEvidence;
}

export async function updateEvidence(
  id: string,
  patch: { asset_url?: string; title?: string | null; caption?: string | null; classification?: string | null; display_order?: number },
): Promise<boolean> {
  const { error } = await supabase
    .from('spot_evidence')
    .update(patch)
    .eq('id', id);
  if (error) {
    console.error('updateEvidence error:', error);
    return false;
  }
  return true;
}

export async function deleteEvidence(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('spot_evidence')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteEvidence error:', error);
    return false;
  }
  return true;
}

export async function reorderEvidence(spotId: string, orderedIds: string[]): Promise<boolean> {
  const updates = orderedIds.map((id, idx) =>
    supabase.from('spot_evidence').update({ display_order: idx }).eq('id', id).eq('spot_id', spotId),
  );
  const results = await Promise.all(updates);
  return results.every((r) => !r.error);
}

export async function persistPendingEvidence(spotId: string, pending: PendingEvidence[]): Promise<{ failed: PendingEvidence[] }> {
  const failed: PendingEvidence[] = [];
  const existing = await fetchEvidence(spotId);
  for (const item of pending) {
    const assetUrl = await uploadEvidenceImage(item.file);
    if (!assetUrl) {
      failed.push(item);
      continue;
    }
    const saved = await addEvidence(spotId, assetUrl, item.title.trim() || null, item.caption.trim() || null, item.classification || null);
    if (!saved) failed.push(item);
  }
  if (existing.length > 0 && pending.length > 0) {
    await reorderEvidence(spotId, [...existing.map((item) => item.id)]);
  }
  return { failed };
}
