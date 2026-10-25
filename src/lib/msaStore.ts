import { supabase } from '@/lib/supabase';
import type { ContentSpot } from '@/lib/contentLab';
import { uploadEvidenceImage } from '@/lib/evidenceStore';

// ============================================================
// Types
// ============================================================

export interface MsaEntry {
  id: string;
  content_spot_id: string;
  hand_id: string;
  hand_user_id: string;
  sort_order: number;
  hand_title: string | null;
  creator_analysis: string;
  key_takeaway: string | null;
  evidence_url: string | null;
  evidence_caption: string | null;
  audio_url: string | null;
  video_url: string | null;
  hero_cards: string | null;
  board: string | null;
  blinds: string | null;
  net_result: number | null;
  pot_amount: number | null;
  position: string | null;
  played_at: string | null;
  tournament_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MsaEntryInput {
  hand_id: string;
  hand_user_id: string;
  hand_title?: string;
  creator_analysis?: string;
  key_takeaway?: string;
  evidence_url?: string | null;
  evidence_caption?: string;
  hero_cards?: string | null;
  board?: string | null;
  blinds?: string | null;
  net_result?: number | null;
  pot_amount?: number | null;
  position?: string | null;
  played_at?: string | null;
  tournament_id?: string | null;
}

export interface MsaPackage {
  spot: ContentSpot;
  entries: MsaEntry[];
}

// ============================================================
// CRUD — Container (content_spots with spot_type = 'multi_spot_analysis')
// ============================================================

export async function fetchMyMultiSpotAnalyses(accountId: string): Promise<ContentSpot[]> {
  const { data, error } = await supabase
    .from('content_spots')
    .select('*')
    .eq('account_id', accountId)
    .eq('spot_type', 'multi_spot_analysis')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapSpotRow);
}

export async function fetchMultiSpotAnalysis(spotId: string): Promise<MsaPackage | null> {
  const { data: spot, error: spotErr } = await supabase
    .from('content_spots')
    .select('*')
    .eq('id', spotId)
    .eq('spot_type', 'multi_spot_analysis')
    .maybeSingle();
  if (spotErr || !spot) return null;

  const entries = await fetchMsaEntries(spotId);
  return { spot: mapSpotRow(spot), entries };
}

export async function createMultiSpotAnalysis(
  accountId: string,
  creatorName: string,
  title: string,
  description: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('content_spots')
    .insert({
      account_id: accountId,
      creator_name: creatorName,
      status: 'draft',
      source: 'Multi-Spot Analysis',
      spot_type: 'multi_spot_analysis',
      title,
      subtitle: description,
      introduction: description,
      tags: {},
      image_urls: [],
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('createMultiSpotAnalysis error:', error?.message);
    return null;
  }
  return data.id;
}

export async function updateMultiSpotAnalysisDetails(
  spotId: string,
  updates: {
    title?: string;
    description?: string;
    coverImageUrl?: string | null;
    tags?: Record<string, string>;
  },
): Promise<boolean> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) {
    patch.subtitle = updates.description;
    patch.introduction = updates.description;
  }
  if (updates.coverImageUrl !== undefined) {
    const { data: spot } = await supabase
      .from('content_spots')
      .select('image_urls')
      .eq('id', spotId)
      .maybeSingle();
    const existing = (spot?.image_urls as string[]) ?? [];
    patch.image_urls = updates.coverImageUrl
      ? [updates.coverImageUrl, ...existing.slice(1)]
      : existing.slice(1);
  }
  if (updates.tags !== undefined) patch.tags = updates.tags;

  const { error } = await supabase.from('content_spots').update(patch).eq('id', spotId);
  if (error) {
    console.error('updateMultiSpotAnalysisDetails error:', error.message);
    return false;
  }
  return true;
}

// ============================================================
// CRUD — Entries (sv_msa_entries)
// ============================================================

export async function fetchMsaEntries(spotId: string): Promise<MsaEntry[]> {
  const { data, error } = await supabase
    .from('sv_msa_entries')
    .select('*')
    .eq('content_spot_id', spotId)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data.map(mapEntryRow);
}

export async function setMsaEntries(spotId: string, entries: MsaEntryInput[]): Promise<boolean> {
  await supabase.from('sv_msa_entries').delete().eq('content_spot_id', spotId);
  if (entries.length === 0) return true;

  const rows = entries.map((e, i) => ({
    content_spot_id: spotId,
    hand_id: e.hand_id,
    hand_user_id: e.hand_user_id,
    sort_order: i,
    hand_title: e.hand_title ?? null,
    creator_analysis: e.creator_analysis ?? '',
    key_takeaway: e.key_takeaway ?? null,
    evidence_url: e.evidence_url ?? null,
    evidence_caption: e.evidence_caption ?? null,
    audio_url: e.audio_url ?? null,
    video_url: e.video_url ?? null,
    hero_cards: e.hero_cards ?? null,
    board: e.board ?? null,
    blinds: e.blinds ?? null,
    net_result: e.net_result ?? null,
    pot_amount: e.pot_amount ?? null,
    position: e.position ?? null,
    played_at: e.played_at ?? null,
    tournament_id: e.tournament_id ?? null,
  }));

  const { error } = await supabase.from('sv_msa_entries').insert(rows);
  if (error) {
    console.error('setMsaEntries error:', error.message);
    return false;
  }
  return true;
}

export async function updateMsaEntry(
  entryId: string,
  patch: {
    hand_title?: string | null;
    creator_analysis?: string;
    key_takeaway?: string | null;
    evidence_url?: string | null;
    evidence_caption?: string | null;
    audio_url?: string | null;
    video_url?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_msa_entries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', entryId);
  if (error) {
    console.error('updateMsaEntry error:', error.message);
    return false;
  }
  return true;
}

export async function uploadMsaEvidenceImage(file: File): Promise<string | null> {
  return uploadEvidenceImage(file);
}

export async function uploadMsaCoverImage(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `msa-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(fileName, file, { upsert: false });
  if (error) {
    console.error('MSA cover upload error:', error.message);
    return null;
  }
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(fileName);
  return data?.publicUrl ?? null;
}

// ============================================================
// Publishing — reuses contentLab's publishWithPrice
// ============================================================

export async function publishMultiSpotAnalysis(
  spotId: string,
  isMonetized: boolean,
  priceCredits: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('content_spots')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      is_monetized: isMonetized,
      price_credits: isMonetized ? priceCredits : 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', spotId);
  if (error) {
    console.error('publishMultiSpotAnalysis error:', error.message);
    return false;
  }
  return true;
}

export async function unpublishMultiSpotAnalysis(spotId: string): Promise<boolean> {
  const { error } = await supabase
    .from('content_spots')
    .update({
      status: 'draft',
      published_at: null,
      is_monetized: false,
      price_credits: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', spotId);
  if (error) {
    console.error('unpublishMultiSpotAnalysis error:', error.message);
    return false;
  }
  return true;
}

// ============================================================
// Helpers
// ============================================================

function mapSpotRow(row: Record<string, unknown>): ContentSpot {
  return {
    id: row.id as string,
    account_id: row.account_id as string,
    creator_name: row.creator_name as string,
    status: row.status as ContentSpot['status'],
    source: row.source as string,
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    introduction: (row.introduction as string | null) ?? null,
    hand_details: (row.hand_details as string | null) ?? null,
    visual_details: (row.visual_details as Array<{ url: string; caption?: string }> | null) ?? null,
    content_html: (row.content_html as string | null) ?? null,
    image_urls: (row.image_urls as string[]) ?? [],
    tags: (row.tags as Record<string, string>) ?? {},
    is_monetized: row.is_monetized as boolean,
    price_credits: row.price_credits as number,
    show_in_courses: row.show_in_courses as boolean,
    quiz: (row.quiz as unknown) as ContentSpot['quiz'],
    spot_type: (row.spot_type as ContentSpot['spot_type']) ?? 'multi_spot_analysis',
    content_blocks: (row.content_blocks as unknown[]) ?? null,
    work_pack_stages: (row.work_pack_stages as unknown[]) ?? null,
    hand_id: (row.hand_id as string | null) ?? null,
    poker_site: (row.poker_site as string | null) ?? null,
    difficulty: (row.difficulty as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapEntryRow(row: Record<string, unknown>): MsaEntry {
  return {
    id: row.id as string,
    content_spot_id: row.content_spot_id as string,
    hand_id: row.hand_id as string,
    hand_user_id: row.hand_user_id as string,
    sort_order: row.sort_order as number,
    hand_title: (row.hand_title as string | null) ?? null,
    creator_analysis: (row.creator_analysis as string) ?? '',
    key_takeaway: (row.key_takeaway as string | null) ?? null,
    evidence_url: (row.evidence_url as string | null) ?? null,
    evidence_caption: (row.evidence_caption as string | null) ?? null,
    audio_url: (row.audio_url as string | null) ?? null,
    video_url: (row.video_url as string | null) ?? null,
    hero_cards: (row.hero_cards as string | null) ?? null,
    board: (row.board as string | null) ?? null,
    blinds: (row.blinds as string | null) ?? null,
    net_result: row.net_result != null ? Number(row.net_result) : null,
    pot_amount: row.pot_amount != null ? Number(row.pot_amount) : null,
    position: (row.position as string | null) ?? null,
    played_at: (row.played_at as string | null) ?? null,
    tournament_id: (row.tournament_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
