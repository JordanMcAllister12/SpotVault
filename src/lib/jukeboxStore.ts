import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

export type ProductType = 'hand_pack' | 'full_tournament';
export type GameType = 'MTT' | 'Cash' | 'PKO';
export type ProductStatus = 'draft' | 'published';

export interface JukeboxProduct {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  product_type: ProductType;
  game_type: string;
  buy_in: string;
  theme: string;
  price: number;
  hand_count: number;
  status: ProductStatus;
  thumbnail_color: string;
  rating: number;
  purchase_count: number;
  created_at: string;
  published_at: string | null;
}

export interface JukeboxProductHand {
  id: string;
  product_id: string;
  hand_id: string;
  hand_order: number;
  created_at: string;
}

export interface JukeboxHandAnalysis {
  id: string;
  product_id: string;
  hand_id: string;
  analysis_text: string;
  preflop_notes: string;
  flop_notes: string;
  turn_notes: string;
  river_notes: string;
  updated_at: string;
}

export interface JukeboxDraft {
  id: string;
  creator_id: string;
  title: string;
  product_type: ProductType;
  selected_hands: string[];
  analysis_map: Record<string, {
    analysis_text: string;
    preflop: string;
    flop: string;
    turn: string;
    river: string;
  }>;
  metadata: {
    game_type: string;
    buy_in: string;
    theme: string;
    description: string;
    price: number;
    thumbnail_color: string;
  };
  created_at: string;
  updated_at: string;
}

export interface JukeboxPurchase {
  id: string;
  user_id: string;
  product_id: string;
  price_paid: number;
  purchased_at: string;
}

export interface JukeboxProgress {
  id: string;
  user_id: string;
  product_id: string;
  studied_hand_ids: string[];
  current_hand_index: number;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  is_completed: boolean;
}

// ── Permission Check ────────────────────────────────────────────

export async function canPublishJukebox(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_publish_jukebox', { p_user_id: userId });
  if (error) { console.error('canPublishJukebox:', error); return false; }
  return data as boolean;
}

// ── Marketplace ────────────────────────────────────────────────

export async function fetchPublishedProducts(filters?: {
  gameType?: string;
  productType?: string;
  sort?: 'recent' | 'popular' | 'price_low' | 'price_high' | 'rating';
}): Promise<JukeboxProduct[]> {
  let query = supabase
    .from('jukebox_products')
    .select('*')
    .eq('status', 'published');

  if (filters?.gameType && filters.gameType !== 'All') {
    query = query.eq('game_type', filters.gameType);
  }
  if (filters?.productType && filters.productType !== 'All') {
    query = query.eq('product_type', filters.productType);
  }

  switch (filters?.sort) {
    case 'popular': query = query.order('purchase_count', { ascending: false }); break;
    case 'price_low': query = query.order('price', { ascending: true }); break;
    case 'price_high': query = query.order('price', { ascending: false }); break;
    case 'rating': query = query.order('rating', { ascending: false }); break;
    default: query = query.order('published_at', { ascending: false });
  }

  const { data, error } = await query.limit(100);
  if (error) { console.error('fetchPublishedProducts:', error); return []; }
  return (data ?? []) as JukeboxProduct[];
}

export async function fetchProduct(productId: string): Promise<JukeboxProduct | null> {
  const { data, error } = await supabase
    .from('jukebox_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (error) { console.error('fetchProduct:', error); return null; }
  return data as JukeboxProduct | null;
}

export async function fetchProductHands(productId: string): Promise<JukeboxProductHand[]> {
  const { data, error } = await supabase
    .from('jukebox_product_hands')
    .select('*')
    .eq('product_id', productId)
    .order('hand_order', { ascending: true });
  if (error) { console.error('fetchProductHands:', error); return []; }
  return (data ?? []) as JukeboxProductHand[];
}

export async function fetchProductAnalysis(productId: string): Promise<JukeboxHandAnalysis[]> {
  const { data, error } = await supabase
    .from('jukebox_hand_analysis')
    .select('*')
    .eq('product_id', productId);
  if (error) { console.error('fetchProductAnalysis:', error); return []; }
  return (data ?? []) as JukeboxHandAnalysis[];
}

// ── Purchases ──────────────────────────────────────────────────

export async function fetchUserPurchases(userId: string): Promise<JukeboxPurchase[]> {
  const { data, error } = await supabase
    .from('jukebox_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });
  if (error) { console.error('fetchUserPurchases:', error); return []; }
  return (data ?? []) as JukeboxPurchase[];
}

export async function isPurchased(userId: string, productId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('jukebox_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) { console.error('isPurchased:', error); return false; }
  return data !== null;
}

export async function createPurchase(userId: string, productId: string, pricePaid: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('jukebox_purchases')
    .insert({ user_id: userId, product_id: productId, price_paid: pricePaid });
  if (error) {
    if (error.code === '23505') return { success: true };
    return { success: false, error: error.message };
  }

  // Increment purchase_count
  await supabase.rpc('increment_purchase_count', { product_id: productId }).then(() => {});
  // Fallback: direct update if RPC doesn't exist
  const { data: prod } = await supabase.from('jukebox_products').select('purchase_count').eq('id', productId).maybeSingle();
  if (prod) {
    await supabase.from('jukebox_products').update({ purchase_count: (prod as { purchase_count: number }).purchase_count + 1 }).eq('id', productId);
  }

  return { success: true };
}

// ── Progress ────────────────────────────────────────────────────

export async function fetchProgress(userId: string, productId: string): Promise<JukeboxProgress | null> {
  const { data, error } = await supabase
    .from('jukebox_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) { console.error('fetchProgress:', error); return null; }
  return data as JukeboxProgress | null;
}

export async function fetchAllProgress(userId: string): Promise<JukeboxProgress[]> {
  const { data, error } = await supabase
    .from('jukebox_progress')
    .select('*')
    .eq('user_id', userId);
  if (error) { console.error('fetchAllProgress:', error); return []; }
  return (data ?? []) as JukeboxProgress[];
}

export async function upsertProgress(userId: string, productId: string, updates: {
  studied_hand_ids?: string[];
  current_hand_index?: number;
  is_completed?: boolean;
  completed_at?: string | null;
}): Promise<void> {
  const existing = await fetchProgress(userId, productId);
  const now = new Date().toISOString();

  if (existing) {
    const updatePayload: Record<string, unknown> = { updated_at: now };
    if (updates.studied_hand_ids !== undefined) updatePayload.studied_hand_ids = updates.studied_hand_ids;
    if (updates.current_hand_index !== undefined) updatePayload.current_hand_index = updates.current_hand_index;
    if (updates.is_completed !== undefined) updatePayload.is_completed = updates.is_completed;
    if (updates.completed_at !== undefined) updatePayload.completed_at = updates.completed_at;

    const { error } = await supabase
      .from('jukebox_progress')
      .update(updatePayload)
      .eq('id', existing.id);
    if (error) console.error('upsertProgress update:', error);
  } else {
    const { error } = await supabase
      .from('jukebox_progress')
      .insert({
        user_id: userId,
        product_id: productId,
        studied_hand_ids: updates.studied_hand_ids ?? [],
        current_hand_index: updates.current_hand_index ?? 0,
        is_completed: updates.is_completed ?? false,
        completed_at: updates.completed_at ?? null,
        started_at: now,
        updated_at: now,
      });
    if (error) console.error('upsertProgress insert:', error);
  }
}

// ── Drafts ─────────────────────────────────────────────────────

export async function fetchDrafts(creatorId: string): Promise<JukeboxDraft[]> {
  const { data, error } = await supabase
    .from('jukebox_drafts')
    .select('*')
    .eq('creator_id', creatorId)
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchDrafts:', error); return []; }
  return (data ?? []) as unknown as JukeboxDraft[];
}

export async function saveDraft(draft: {
  id?: string;
  creator_id: string;
  title: string;
  product_type: ProductType;
  selected_hands: string[];
  analysis_map: Record<string, { analysis_text: string; preflop: string; flop: string; turn: string; river: string }>;
  metadata: { game_type: string; buy_in: string; theme: string; description: string; price: number; thumbnail_color: string };
}): Promise<string | null> {
  const now = new Date().toISOString();
  const payload = {
    creator_id: draft.creator_id,
    title: draft.title,
    product_type: draft.product_type,
    selected_hands: draft.selected_hands,
    analysis_map: draft.analysis_map,
    metadata: draft.metadata,
    updated_at: now,
  };

  if (draft.id) {
    const { error } = await supabase.from('jukebox_drafts').update(payload).eq('id', draft.id);
    if (error) { console.error('saveDraft update:', error); return null; }
    return draft.id;
  } else {
    const { data, error } = await supabase.from('jukebox_drafts').insert(payload).select('id').maybeSingle();
    if (error) { console.error('saveDraft insert:', error); return null; }
    return data?.id ?? null;
  }
}

export async function deleteDraft(draftId: string): Promise<void> {
  const { error } = await supabase.from('jukebox_drafts').delete().eq('id', draftId);
  if (error) console.error('deleteDraft:', error);
}

// ── Publishing ─────────────────────────────────────────────────

export async function publishProduct(params: {
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  product_type: ProductType;
  game_type: string;
  buy_in: string;
  theme: string;
  price: number;
  thumbnail_color: string;
  selected_hands: string[];
  analysis_map: Record<string, { analysis_text: string; preflop: string; flop: string; turn: string; river: string }>;
}): Promise<string | null> {
  const now = new Date().toISOString();

  // 1. Create the product
  const { data: productData, error: productError } = await supabase
    .from('jukebox_products')
    .insert({
      creator_id: params.creator_id,
      creator_name: params.creator_name,
      title: params.title,
      description: params.description,
      product_type: params.product_type,
      game_type: params.game_type,
      buy_in: params.buy_in,
      theme: params.theme,
      price: params.price,
      hand_count: params.selected_hands.length,
      status: 'published',
      thumbnail_color: params.thumbnail_color,
      published_at: now,
    })
    .select('id')
    .maybeSingle();

  if (productError || !productData) {
    console.error('publishProduct: create product:', productError);
    return null;
  }

  const productId = productData.id;

  // 2. Insert product hands (ordered)
  const handRows = params.selected_hands.map((handId, i) => ({
    product_id: productId,
    hand_id: handId,
    hand_order: i + 1,
  }));

  if (handRows.length > 0) {
    const { error: handsError } = await supabase.from('jukebox_product_hands').insert(handRows);
    if (handsError) console.error('publishProduct: insert hands:', handsError);
  }

  // 3. Insert ALL hand analysis entries
  const analysisRows = params.selected_hands
    .filter(hid => params.analysis_map[hid])
    .map(hid => {
      const a = params.analysis_map[hid];
      return {
        product_id: productId,
        hand_id: hid,
        analysis_text: a.analysis_text || '',
        preflop_notes: a.preflop || '',
        flop_notes: a.flop || '',
        turn_notes: a.turn || '',
        river_notes: a.river || '',
      };
    });

  if (analysisRows.length > 0) {
    const { error: analysisError } = await supabase.from('jukebox_hand_analysis').insert(analysisRows);
    if (analysisError) console.error('publishProduct: insert analysis:', analysisError);
  }

  return productId;
}
