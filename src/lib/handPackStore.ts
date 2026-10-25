import { supabase } from '@/lib/supabase';
import type { ContentSpot } from '@/lib/contentLab';

export interface HandPackEntry {
  hand_id: string;
  hand_user_id: string;
  sort_order: number;
  creator_note: string;
  hero_cards: string | null;
  board: string | null;
  blinds: string | null;
  net_result: number | null;
  pot_amount: number | null;
  position: string | null;
  played_at: string | null;
  tournament_id: string | null;
}

export interface HandPack {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published';
  hand_count: number;
  entries: HandPackEntry[];
  created_at: string;
  updated_at: string;
}

// ── Fetch hand packs as content_spots ─────────────────────────────

export async function fetchHandPacks(accountId: string): Promise<ContentSpot[]> {
  const { data, error } = await supabase
    .from('content_spots')
    .select('*')
    .eq('account_id', accountId)
    .eq('spot_type', 'hand_pack')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  // Use the same mapRow as contentLab — inline minimal mapping
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    account_id: r.account_id as string,
    creator_name: r.creator_name as string,
    status: r.status as string,
    source: r.source as string,
    title: r.title as string,
    subtitle: r.subtitle as string | null,
    introduction: r.introduction as string | null,
    hand_details: r.hand_details as string | null,
    content_html: r.content_html as string | null,
    image_urls: (r.image_urls as string[]) ?? [],
    tags: r.tags as Record<string, string>,
    is_monetized: r.is_monetized as boolean,
    price_credits: r.price_credits as number,
    show_in_courses: r.show_in_courses as boolean,
    quiz: r.quiz as Record<string, unknown> | null,
    published_at: r.published_at as string | null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    video_url: r.video_url as string | null,
    visual_details: r.visual_details as Array<{ url: string; caption?: string }> | null,
    spot_type: r.spot_type as string,
    content_blocks: r.content_blocks as unknown[] | null,
    work_pack_stages: r.work_pack_stages as unknown[] | null,
  }));
}

// ── Fetch entries for a hand pack ─────────────────────────────────

export async function fetchHandPackEntries(spotId: string): Promise<HandPackEntry[]> {
  const { data, error } = await supabase
    .from('sv_hand_pack_entries')
    .select('*')
    .eq('content_spot_id', spotId)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    hand_id: r.hand_id as string,
    hand_user_id: r.hand_user_id as string,
    sort_order: r.sort_order as number,
    creator_note: (r.creator_note as string) ?? '',
    hero_cards: (r.hero_cards as string) ?? null,
    board: (r.board as string) ?? null,
    blinds: (r.blinds as string) ?? null,
    net_result: r.net_result != null ? Number(r.net_result) : null,
    pot_amount: r.pot_amount != null ? Number(r.pot_amount) : null,
    position: (r.position as string) ?? null,
    played_at: (r.played_at as string) ?? null,
    tournament_id: (r.tournament_id as string) ?? null,
  }));
}

// ── Create a hand pack as a content_spot + entries ────────────────

export async function createHandPack(
  accountId: string,
  creatorName: string,
  title: string,
  description: string,
  entries: Array<{
    hand_id: string;
    hand_user_id: string;
    creator_note?: string;
    hero_cards?: string | null;
    board?: string | null;
    blinds?: string | null;
    net_result?: number | null;
    pot_amount?: number | null;
    position?: string | null;
    played_at?: string | null;
    tournament_id?: string | null;
  }>,
): Promise<string | null> {
  // 1. Create the content_spot
  const { data: spot, error: spotErr } = await supabase
    .from('content_spots')
    .insert({
      account_id: accountId,
      creator_name: creatorName,
      status: 'draft',
      source: 'Hand Pack',
      spot_type: 'hand_pack',
      title,
      subtitle: description,
      introduction: description,
      tags: {},
      image_urls: [],
    })
    .select('id')
    .single();

  if (spotErr || !spot) {
    console.error('createHandPack spot error:', spotErr?.message);
    return null;
  }

  const spotId = spot.id;

  // 2. Insert entries
  if (entries.length > 0) {
    const rows = entries.map((e, i) => ({
      content_spot_id: spotId,
      hand_id: e.hand_id,
      hand_user_id: e.hand_user_id,
      sort_order: i,
      creator_note: e.creator_note ?? '',
      hero_cards: e.hero_cards ?? null,
      board: e.board ?? null,
      blinds: e.blinds ?? null,
      net_result: e.net_result ?? null,
      pot_amount: e.pot_amount ?? null,
      position: e.position ?? null,
      played_at: e.played_at ?? null,
      tournament_id: e.tournament_id ?? null,
    }));

    const { error: entryErr } = await supabase
      .from('sv_hand_pack_entries')
      .insert(rows);

    if (entryErr) {
      console.error('createHandPack entries error:', entryErr.message);
    }
  }

  return spotId;
}

// ── Update hand pack entries (reorder, add, remove) ───────────────

export async function updateHandPackEntries(
  spotId: string,
  entries: Array<{
    hand_id: string;
    hand_user_id: string;
    creator_note?: string;
    sort_order: number;
    hero_cards?: string | null;
    board?: string | null;
    blinds?: string | null;
    net_result?: number | null;
    pot_amount?: number | null;
    position?: string | null;
    played_at?: string | null;
    tournament_id?: string | null;
  }>,
): Promise<boolean> {
  // Delete existing entries, then re-insert
  await supabase.from('sv_hand_pack_entries').delete().eq('content_spot_id', spotId);

  if (entries.length === 0) return true;

  const rows = entries.map((e) => ({
    content_spot_id: spotId,
    hand_id: e.hand_id,
    hand_user_id: e.hand_user_id,
    sort_order: e.sort_order,
    creator_note: e.creator_note ?? '',
    hero_cards: e.hero_cards ?? null,
    board: e.board ?? null,
    blinds: e.blinds ?? null,
    net_result: e.net_result ?? null,
    pot_amount: e.pot_amount ?? null,
    position: e.position ?? null,
    played_at: e.played_at ?? null,
    tournament_id: e.tournament_id ?? null,
  }));

  const { error } = await supabase.from('sv_hand_pack_entries').insert(rows);
  return !error;
}

// ── Fetch a single hand pack with entries ─────────────────────────

export async function fetchHandPack(spotId: string): Promise<HandPack | null> {
  const { data: spot, error: spotErr } = await supabase
    .from('content_spots')
    .select('*')
    .eq('id', spotId)
    .eq('spot_type', 'hand_pack')
    .maybeSingle();

  if (spotErr || !spot) return null;

  const entries = await fetchHandPackEntries(spotId);

  return {
    id: spot.id,
    title: spot.title,
    description: spot.subtitle ?? spot.introduction ?? '',
    status: spot.status as 'draft' | 'published',
    hand_count: entries.length,
    entries,
    created_at: spot.created_at,
    updated_at: spot.updated_at,
  };
}
