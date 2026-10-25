import { supabase } from '@/lib/supabase';

export interface PlayerAccolade {
  id: string;
  user_id: string;
  image_url: string;
  title: string;
  result_text: string | null;
  caption: string | null;
  achievement_date: string | null;
  external_url: string | null;
  display_order: number;
  is_featured: boolean;
  verification_status: string;
  created_at: string;
  updated_at: string;
}

export async function fetchAccolades(userId: string): Promise<PlayerAccolade[]> {
  const { data, error } = await supabase
    .from('player_accolades')
    .select('*')
    .eq('user_id', userId)
    .order('is_featured', { ascending: false })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as PlayerAccolade[];
}

export async function addAccolade(
  userId: string,
  fields: {
    image_url: string;
    title: string;
    result_text?: string | null;
    caption?: string | null;
    achievement_date?: string | null;
    external_url?: string | null;
    is_featured?: boolean;
  },
): Promise<PlayerAccolade | null> {
  const { data, error } = await supabase
    .from('player_accolades')
    .insert({
      user_id: userId,
      image_url: fields.image_url,
      title: fields.title,
      result_text: fields.result_text ?? null,
      caption: fields.caption ?? null,
      achievement_date: fields.achievement_date ?? null,
      external_url: fields.external_url ?? null,
      is_featured: fields.is_featured ?? false,
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return data as PlayerAccolade;
}

export async function updateAccolade(
  id: string,
  updates: {
    image_url?: string;
    title?: string;
    result_text?: string | null;
    caption?: string | null;
    achievement_date?: string | null;
    external_url?: string | null;
    is_featured?: boolean;
    display_order?: number;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from('player_accolades')
    .update(updates)
    .eq('id', id);
  return !error;
}

export async function deleteAccolade(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('player_accolades')
    .delete()
    .eq('id', id);
  return !error;
}

export async function reorderAccolades(userId: string, orderedIds: string[]): Promise<boolean> {
  const updates = orderedIds.map((id, index) => ({ id, display_order: index }));
  const { error } = await supabase
    .from('player_accolades')
    .upsert(updates, { onConflict: 'id' });
  if (error) {
    for (const u of updates) {
      await supabase
        .from('player_accolades')
        .update({ display_order: u.display_order })
        .eq('id', u.id)
        .eq('user_id', userId);
    }
  }
  return true;
}

export async function uploadAccoladeImage(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const path = `accolades/${userId}/${timestamp}-${randomSuffix}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('user-uploads')
    .upload(path, file, { upsert: false });
  if (uploadError) return null;
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(path);
  return data.publicUrl;
}

export async function toggleAccoladeFeatured(id: string, isFeatured: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('player_accolades')
    .update({ is_featured: isFeatured })
    .eq('id', id);
  return !error;
}
