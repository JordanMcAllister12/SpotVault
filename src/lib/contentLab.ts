import { supabase } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

export type ContentSpotStatus = 'draft' | 'published' | 'submitted';

export type SpotType = 'structured' | 'freeform' | 'document' | 'work_pack' | 'hand_pack' | 'hand_analysis' | 'multi_spot';

export const SPOT_TYPE_OPTIONS: { value: SpotType; label: string; description: string }[] = [
  { value: 'document', label: 'Document Studio', description: 'Write a professional article with inline interactive poker tools — ranges, exercises, solver outputs, media, and more.' },
  { value: 'structured', label: 'Structured Spot', description: "Use SpotVault's guided hand-analysis structure." },
];

const DEFAULT_WORK_PACK_STAGES: WorkPackStage[] = [
  { id: 'stage-setup', title: 'Setup', blocks: [] },
  { id: 'stage-preflop', title: 'Preflop', blocks: [] },
  { id: 'stage-flop', title: 'Flop', blocks: [] },
  { id: 'stage-turn', title: 'Turn', blocks: [] },
  { id: 'stage-river', title: 'River', blocks: [] },
];

export interface LegacyV1Image {
  id: string;
  url: string;
  name: string | null;
  image_type: string | null;
  is_featured: boolean | null;
  order_index: number | null;
}

export interface LegacyV1Data {
  insight_images?: LegacyV1Image[];
  spot_nodes?: Array<Record<string, unknown>>;
  spot_ranges?: unknown[];
  range_grids?: unknown[];
}

export interface WorkPackStage {
  id: string;
  title: string;
  blocks: ContentBlock[];
  _legacy_v1?: LegacyV1Data;
}

export interface ContentBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet_list' | 'numbered_list' | 'image' | 'callout' | 'hand_replay';
  text?: string;
  items?: string[];
  url?: string;
  caption?: string;
  variant?: 'info' | 'key_takeaway';
  hand_id?: string;
}

export interface ContentTags {
  format?: string;
  economics?: string;
  stage?: string;
  street?: string;
  pot_type?: string;
  position?: string;
  strategy?: string;
  content_type?: string;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string | null;
}

export interface VisualDetailItem {
  url: string;
  caption?: string;
}

export interface ContentSpot {
  id: string;
  account_id: string;
  creator_name: string;
  status: ContentSpotStatus;
  source: string;
  title: string;
  subtitle: string | null;
  introduction: string | null;
  hand_details: string | null;
  visual_details: VisualDetailItem[] | null;
  content_html: string | null;
  image_urls: string[];
  tags: ContentTags;
  is_monetized: boolean;
  price_credits: number;
  show_in_courses: boolean;
  quiz: QuizQuestion[] | null;
  spot_type: SpotType;
  content_blocks: ContentBlock[] | null;
  work_pack_stages: WorkPackStage[] | null;
  document_json: Record<string, unknown> | null;
  hand_id: string | null;
  poker_site: string | null;
  difficulty: string | null;
  comprehension_difficulty: string | null;
  tournament_stakes: string | null;
  published_at: string | null;
  cover_image_url: string | null;
  review_set_id: string | null;
  portal_slug: string | null;
  source_metadata: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Tag Options (canonical)
// ============================================================

export const POKER_SITE_OPTIONS = [
  'ggpoker',
  'pokerstars',
  'wpt_global',
  'coinpoker',
  '888poker',
  'partypoker',
  'acr',
  'wsop',
  'live_poker',
  'other',
  'not_applicable',
] as const;

export const POKER_SITE_LABELS: Record<string, string> = {
  ggpoker: 'GGPoker',
  pokerstars: 'PokerStars',
  wpt_global: 'WPT Global',
  coinpoker: 'CoinPoker',
  '888poker': '888poker',
  partypoker: 'PartyPoker',
  acr: 'ACR / Americas Cardroom',
  wsop: 'WSOP',
  live_poker: 'Live Poker',
  other: 'Other',
  not_applicable: 'Not Applicable',
};

export const DIFFICULTY_OPTIONS = ['quick_read', 'detailed', 'advanced_analysis'] as const;

export const DIFFICULTY_LABELS: Record<string, string> = {
  quick_read: 'Quick Read',
  detailed: 'Detailed',
  advanced_analysis: 'Advanced Analysis',
};

export type ComprehensionDifficulty = 'easy' | 'medium' | 'hard';

export const COMPREHENSION_OPTIONS: ComprehensionDifficulty[] = ['easy', 'medium', 'hard'];

export const COMPREHENSION_LABELS: Record<ComprehensionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export type TournamentStakes = 'micro' | 'low' | 'mid' | 'high' | 'nosebleed';

export const STAKES_OPTIONS: TournamentStakes[] = ['micro', 'low', 'mid', 'high', 'nosebleed'];

export const STAKES_LABELS: Record<TournamentStakes, string> = {
  micro: 'Micro Stakes',
  low: 'Low Stakes',
  mid: 'Mid Stakes',
  high: 'High Stakes',
  nosebleed: 'Nosebleed Stakes',
};

export const TAG_OPTIONS = {
  format: ['MTT', 'Cash'],
  economics: ['ChipEV', 'ICM', 'PKO'],
  stage: ['Early', 'Middle', 'Bubble', 'Final Table', 'Heads Up'],
  street: ['Preflop', 'Flop', 'Turn', 'River'],
  pot_type: ['SRP', '3BP', '4BP'],
  position: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  strategy: ['Exploit', 'Population', 'GTO', 'Bluff', 'Value', 'Check Raise', 'Float', 'Probe', 'Overbet', 'C-Bet'],
  content_type: ['Solver', 'ICM / HRC', 'Discussion', 'Video', 'Article'],
};

export const SOURCE_OPTIONS = [
  'Tournament',
  'Cash Game',
  'Hand History',
  'Solver',
  'Coaching Session',
  'Live Poker',
  'Online Poker',
  'Screenshot / Image',
  'Video',
  'Article / Written Analysis',
  'Other',
];

export const TAG_LABELS: Record<keyof ContentTags, string> = {
  format: 'Format',
  economics: 'Economics',
  stage: 'Stage',
  street: 'Street',
  pot_type: 'Pot Type',
  position: 'Position',
  strategy: 'Strategy',
  content_type: 'Content Type',
};

// ============================================================
// CRUD Functions
// ============================================================

export async function fetchMySpots(accountId: string): Promise<ContentSpot[]> {
  const { data, error } = await supabase
    .from('content_spots')
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('fetchMySpots error:', error.message, 'code:', error.code, 'details:', error.details);
    return [];
  }
  return (data || []).map(mapRow);
}

export async function fetchPublishedSpots(portalSlug?: string | null): Promise<ContentSpot[]> {
  let query = supabase
    .from('content_spots')
    .select('*')
    .eq('status', 'published');
  if (portalSlug) {
    query = query.or(`portal_slug.eq.${portalSlug},portal_slug.is.null`);
  }
  const { data, error } = await query.order('published_at', { ascending: false });
  if (error) {
    console.error('fetchPublishedSpots error:', error);
    return [];
  }
  return (data || []).map(mapRow);
}

export async function fetchSpotById(id: string): Promise<ContentSpot | null> {
  const { data, error } = await supabase
    .from('content_spots')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('fetchSpotById error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function updateExistingSpot(
  spot: Partial<ContentSpot> & { id: string; account_id: string }
): Promise<ContentSpot | null> {
  const patch = { ...toRow(spot), updated_at: new Date().toISOString() };
  delete patch.id;
  delete patch.account_id;
  const { data, error } = await supabase
    .from('content_spots')
    .update(patch)
    .eq('id', spot.id)
    .eq('account_id', spot.account_id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('updateExistingSpot error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function saveDraft(
  spot: Partial<ContentSpot> & { account_id: string }
): Promise<ContentSpot | null> {
  const row = toRow({ ...spot, status: 'draft' });
  const { data, error } = await supabase
    .from('content_spots')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('saveDraft error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function publishSpot(
  id: string,
  updates?: Partial<ContentSpot>
): Promise<ContentSpot | null> {
  const patch: Record<string, unknown> = {
    status: 'published',
    published_at: new Date().toISOString(),
    ...updates ? toRow(updates) : {},
  };
  const { data, error } = await supabase
    .from('content_spots')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('publishSpot error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function publishWithPrice(
  id: string,
  isMonetized: boolean,
  priceCredits: number
): Promise<ContentSpot | null> {
  const patch: Record<string, unknown> = {
    status: 'published',
    published_at: new Date().toISOString(),
    is_monetized: isMonetized,
    price_credits: isMonetized ? priceCredits : 0,
  updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('content_spots')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('publishWithPrice error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function updatePublishSettings(
  id: string,
  isMonetized: boolean,
  priceCredits: number
): Promise<ContentSpot | null> {
  const patch: Record<string, unknown> = {
    is_monetized: isMonetized,
    price_credits: isMonetized ? priceCredits : 0,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('content_spots')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('updatePublishSettings error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function unpublishSpot(id: string): Promise<ContentSpot | null> {
  const patch: Record<string, unknown> = {
    status: 'draft',
    published_at: null,
    is_monetized: false,
    price_credits: 0,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('content_spots')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('unpublishSpot error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function submitSpot(
  id: string,
  updates?: Partial<ContentSpot>
): Promise<ContentSpot | null> {
  const patch: Record<string, unknown> = {
    status: 'submitted',
    ...updates ? toRow(updates) : {},
  };
  const { data, error } = await supabase
    .from('content_spots')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('submitSpot error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function deleteSpot(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('content_spots')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteSpot error:', error);
    return false;
  }
  return true;
}

export async function createNewSpot(accountId: string, creatorName: string, portalSlug?: string | null): Promise<ContentSpot | null> {
  const row = toRow({
    account_id: accountId,
    creator_name: creatorName,
    status: 'draft',
    source: '',
    title: '',
    subtitle: null,
    introduction: null,
    hand_details: null,
    visual_details: null,
    content_html: '',
    image_urls: [],
    tags: {},
    is_monetized: false,
    price_credits: 0,
    show_in_courses: false,
    quiz: null,
    spot_type: 'structured',
    content_blocks: null,
    work_pack_stages: null,
    document_json: null,
    hand_id: null,
    poker_site: null,
    difficulty: null,
    comprehension_difficulty: null,
    tournament_stakes: null,
    published_at: null,
    portal_slug: portalSlug ?? null,
    source_metadata: {},
  } as ContentSpot);
  const { data, error } = await supabase
    .from('content_spots')
    .insert(row)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('createNewSpot error:', error);
    return null;
  }
  return data ? mapRow(data) : null;
}

// ============================================================
// Row mapping
// ============================================================

function sanitizeTags(raw: unknown): ContentTags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const result: ContentTags = {};
  const knownKeys: (keyof ContentTags)[] = [
    'format', 'economics', 'stage', 'street',
    'pot_type', 'position', 'strategy', 'content_type',
  ];
  for (const key of knownKeys) {
    const val = obj[key];
    if (typeof val === 'string' && val) {
      result[key] = val;
    }
  }
  return result;
}

function mapRow(row: Record<string, unknown>): ContentSpot {
  return {
    id: row.id as string,
    account_id: row.account_id as string,
    creator_name: row.creator_name as string,
    status: row.status as ContentSpotStatus,
    source: row.source as string,
    title: row.title as string,
    subtitle: row.subtitle as string | null,
    introduction: row.introduction as string | null,
    hand_details: row.hand_details as string | null,
    visual_details: (row.visual_details as VisualDetailItem[] | null) ?? null,
    content_html: row.content_html as string | null,
    image_urls: row.image_urls as string[] || [],
    tags: sanitizeTags(row.tags),
    is_monetized: row.is_monetized as boolean,
    price_credits: row.price_credits as number,
    show_in_courses: row.show_in_courses as boolean,
    quiz: row.quiz as QuizQuestion[] | null,
    spot_type: (row.spot_type as SpotType) || 'structured',
    content_blocks: (row.content_blocks as ContentBlock[] | null) ?? null,
    work_pack_stages: (row.work_pack_stages as WorkPackStage[] | null) ?? null,
    document_json: (row.document_json as Record<string, unknown> | null) ?? null,
    hand_id: (row.hand_id as string | null) ?? null,
    poker_site: (row.poker_site as string | null) ?? null,
    difficulty: (row.difficulty as string | null) ?? null,
    comprehension_difficulty: (row.comprehension_difficulty as string | null) ?? null,
    tournament_stakes: (row.tournament_stakes as string | null) ?? null,
    published_at: row.published_at as string | null,
    cover_image_url: (row.cover_image_url as string | null) ?? null,
    review_set_id: (row.review_set_id as string | null) ?? null,
    portal_slug: (row.portal_slug as string | null) ?? null,
    source_metadata: (row.source_metadata as Record<string, string> | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function toRow(spot: Partial<ContentSpot>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (spot.id !== undefined) row.id = spot.id;
  if (spot.account_id !== undefined) row.account_id = spot.account_id;
  if (spot.creator_name !== undefined) row.creator_name = spot.creator_name;
  if (spot.status !== undefined) row.status = spot.status;
  if (spot.source !== undefined) row.source = spot.source;
  if (spot.title !== undefined) row.title = spot.title;
  if (spot.subtitle !== undefined) row.subtitle = spot.subtitle;
  if (spot.introduction !== undefined) row.introduction = spot.introduction;
  if (spot.hand_details !== undefined) row.hand_details = spot.hand_details;
  if (spot.visual_details !== undefined) row.visual_details = spot.visual_details;
  if (spot.content_html !== undefined) row.content_html = spot.content_html;
  if (spot.image_urls !== undefined) row.image_urls = spot.image_urls;
  if (spot.tags !== undefined) row.tags = spot.tags;
  if (spot.is_monetized !== undefined) row.is_monetized = spot.is_monetized;
  if (spot.price_credits !== undefined) row.price_credits = spot.price_credits;
  if (spot.show_in_courses !== undefined) row.show_in_courses = spot.show_in_courses;
  if (spot.quiz !== undefined) row.quiz = spot.quiz;
  if (spot.spot_type !== undefined) row.spot_type = spot.spot_type;
  if (spot.content_blocks !== undefined) row.content_blocks = spot.content_blocks;
  if (spot.work_pack_stages !== undefined) row.work_pack_stages = spot.work_pack_stages;
  if (spot.document_json !== undefined) row.document_json = spot.document_json;
  if (spot.hand_id !== undefined) row.hand_id = spot.hand_id;
  if (spot.poker_site !== undefined) row.poker_site = spot.poker_site;
  if (spot.difficulty !== undefined) row.difficulty = spot.difficulty;
  if (spot.comprehension_difficulty !== undefined) row.comprehension_difficulty = spot.comprehension_difficulty;
  if (spot.tournament_stakes !== undefined) row.tournament_stakes = spot.tournament_stakes;
  if (spot.published_at !== undefined) row.published_at = spot.published_at;
  if (spot.cover_image_url !== undefined) row.cover_image_url = spot.cover_image_url;
  if (spot.review_set_id !== undefined) row.review_set_id = spot.review_set_id;
  if (spot.portal_slug !== undefined) row.portal_slug = spot.portal_slug;
  if (spot.source_metadata !== undefined) row.source_metadata = spot.source_metadata;
  return row;
}
