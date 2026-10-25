import { supabase } from '@/lib/supabase';
import { parseHandBlock, type AnalyticsMode } from '@/lib/pokerAnalytics';

// ── Types ──────────────────────────────────────────────────────

export type BatchSourceType = 'paste' | 'file_upload' | 'drag_drop' | 'custom' | 'mixed';
export type BatchType = 'personal' | 'coaching_submission' | 'coaching_material' | 'creator_product' | 'hh_bundle';
export type SelectionStatus = 'candidate' | 'selected';

export interface HandBatch {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  source_type: BatchSourceType;
  batch_type: BatchType;
  hand_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  content_spot_id?: string | null;
  batch_mode?: string;
}

export interface BatchHand {
  id: string;
  review_set_id: string;
  hand_id: string | null;
  raw_hand_text: string;
  position: string | null;
  hero_cards: string | null;
  board: string | null;
  net_result: number | null;
  stack_size: number | null;
  blinds: string | null;
  pot_amount: number | null;
  site: string | null;
  game_mode: string | null;
  tournament_id: string | null;
  played_at: string | null;
  saw_flop: boolean;
  saw_turn: boolean;
  saw_river: boolean;
  showdown: boolean;
  hero_name: string | null;
  parsed_ok: boolean;
  parse_error: string | null;
  marked_for_coach: boolean;
  sort_order: number;
  hand_title: string | null;
  hand_fingerprint: string | null;
  selection_status: SelectionStatus;
  added_by: string | null;
  batch_note: string | null;
  created_at: string;
  hand_seq_index: number | null;
}

export interface ParsedHandRow {
  hand_id: string | null;
  raw_hand_text: string;
  position: string | null;
  hero_cards: string | null;
  board: string | null;
  net_result: number | null;
  stack_size: number | null;
  blinds: string | null;
  pot_amount: number | null;
  site: string;
  game_mode: string;
  tournament_id: string | null;
  played_at: string | null;
  saw_flop: boolean;
  saw_turn: boolean;
  saw_river: boolean;
  showdown: boolean;
  hero_name: string | null;
  parsed_ok: boolean;
  parse_error: string | null;
  hand_fingerprint: string | null;
}

// ── Parsing helpers ─────────────────────────────────────────────

export function splitIntoHandBlocks(text: string): string[] {
  return text
    .split(/\r?\n(?=Poker Hand #|PokerStars Hand #|Hand #|Game Hand #)/)
    .filter((b) => b.trim().length > 0 && /Hand\s+#\S/.test(b));
}

export function detectSite(text: string): string {
  if (/PokerStars Hand #/.test(text)) return 'PokerStars';
  if (/Poker Hand #/.test(text)) return 'GGPoker';
  if (/Game Hand #/.test(text)) return 'ACR';
  return 'unknown';
}

export function detectMode(text: string): AnalyticsMode {
  if (/Tournament|Hold'em No Limit - \$/.test(text) && /Level|Blinds-Antes/.test(text)) return 'mtt';
  return 'cash';
}

export function parseHandToRow(block: string, site: string, mode: AnalyticsMode): ParsedHandRow {
  const parsed = parseHandBlock(block, site, mode);
  if (!parsed) {
    return {
      hand_id: null,
      raw_hand_text: block,
      position: null,
      hero_cards: null,
      board: null,
      net_result: null,
      stack_size: null,
      blinds: null,
      pot_amount: null,
      site,
      game_mode: mode,
      tournament_id: null,
      played_at: null,
      saw_flop: false,
      saw_turn: false,
      saw_river: false,
      showdown: false,
      hero_name: null,
      parsed_ok: false,
      parse_error: 'Could not parse hand block',
      hand_fingerprint: null,
    };
  }
  return {
    hand_id: parsed.handId ?? null,
    raw_hand_text: block,
    position: parsed.position ?? null,
    hero_cards: parsed.heroCards ?? null,
    board: parsed.board ?? null,
    net_result: parsed.netResult ?? null,
    stack_size: parsed.stackSize ?? null,
    blinds: parsed.blinds ?? null,
    pot_amount: parsed.potAmount ?? null,
    site,
    game_mode: parsed.gameMode ?? mode,
    tournament_id: parsed.tournamentId ?? null,
    played_at: parsed.playedAt ?? null,
    saw_flop: parsed.sawFlop ?? false,
    saw_turn: parsed.sawTurn ?? false,
    saw_river: parsed.sawRiver ?? false,
    showdown: parsed.showdown ?? false,
    hero_name: parsed.heroName ?? null,
    parsed_ok: true,
    parse_error: null,
    hand_fingerprint: parsed.handId ?? null,
  };
}

export function parseRawText(rawText: string): { rows: ParsedHandRow[]; errors: number; duplicates: number } {
  const site = detectSite(rawText);
  const mode = detectMode(rawText);
  const blocks = splitIntoHandBlocks(rawText);
  const seen = new Set<string>();
  const rows: ParsedHandRow[] = [];
  let errors = 0;
  let duplicates = 0;

  for (const block of blocks) {
    const row = parseHandToRow(block, site, mode);
    if (!row.parsed_ok) {
      errors++;
      rows.push(row);
      continue;
    }
    if (row.hand_fingerprint && seen.has(row.hand_fingerprint)) {
      duplicates++;
      continue;
    }
    if (row.hand_fingerprint) seen.add(row.hand_fingerprint);
    rows.push(row);
  }
  return { rows, errors, duplicates };
}

// ── Batch CRUD ──────────────────────────────────────────────────

export async function fetchBatches(userId: string): Promise<HandBatch[]> {
  const { data, error } = await supabase
    .from('sv_review_sets')
    .select('id, owner_id, title, description, source_type, batch_type, hand_count, status, created_at, updated_at, is_tournament, tournament_site, tournament_name, tournament_ext_id, tournament_date, tournament_buy_in, tournament_game_type, tournament_stakes, tournament_hero, last_viewed_hand_id, last_viewed_index, content_spot_id, batch_mode')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .neq('batch_mode', 'working')
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchBatches:', error); return []; }
  return (data ?? []) as unknown as HandBatch[];
}

export async function createBatch(userId: string, title: string, sourceType: BatchSourceType = 'custom', description: string | null = null, batchType: BatchType = 'personal'): Promise<HandBatch | null> {
  const { data, error } = await supabase
    .from('sv_review_sets')
    .insert({
      owner_id: userId,
      title: title || 'Untitled Hand Batch',
      source_type: sourceType,
      batch_type: batchType,
      hand_count: 0,
      status: 'active',
      description,
    })
    .select('id, owner_id, title, description, source_type, batch_type, hand_count, status, created_at, updated_at')
    .maybeSingle();
  if (error) { console.error('createBatch:', error); return null; }
  return data as unknown as HandBatch | null;
}

export async function renameBatch(batchId: string, title: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_sets')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', batchId);
  if (error) { console.error('renameBatch:', error); return false; }
  return true;
}

export async function updateBatchDescription(batchId: string, description: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_sets')
    .update({ description, updated_at: new Date().toISOString() })
    .eq('id', batchId);
  if (error) { console.error('updateBatchDescription:', error); return false; }
  return true;
}

export async function deleteBatch(batchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_sets')
    .delete()
    .eq('id', batchId);
  if (error) { console.error('deleteBatch:', error); return false; }
  return true;
}

// ── Batch Hands ─────────────────────────────────────────────────

export async function fetchBatchHands(batchId: string): Promise<BatchHand[]> {
  const { data, error } = await supabase
    .from('sv_review_hands')
    .select('*')
    .eq('review_set_id', batchId)
    .order('hand_seq_index', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchBatchHands:', error); return []; }
  return (data ?? []) as unknown as BatchHand[];
}

export async function addHandsToBatch(batchId: string, rows: ParsedHandRow[], startSortOrder: number): Promise<{ added: number; duplicates: number; errors: number }> {
  let added = 0;
  let duplicates = 0;
  let errors = 0;

  // Fetch existing fingerprints in this batch for dedup
  const { data: existing } = await supabase
    .from('sv_review_hands')
    .select('hand_fingerprint')
    .eq('review_set_id', batchId)
    .not('hand_fingerprint', 'is', null);
  const existingFps = new Set(((existing ?? []) as { hand_fingerprint: string }[]).map((r) => r.hand_fingerprint));

  const insertRows: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.hand_fingerprint && existingFps.has(row.hand_fingerprint)) {
      duplicates++;
      continue;
    }
    if (row.hand_fingerprint) existingFps.add(row.hand_fingerprint);
    insertRows.push({
      review_set_id: batchId,
      hand_id: row.hand_id,
      raw_hand_text: row.raw_hand_text,
      position: row.position,
      hero_cards: row.hero_cards,
      board: row.board,
      net_result: row.net_result,
      stack_size: row.stack_size,
      blinds: row.blinds,
      pot_amount: row.pot_amount,
      site: row.site,
      game_mode: row.game_mode,
      tournament_id: row.tournament_id,
      played_at: row.played_at,
      saw_flop: row.saw_flop,
      saw_turn: row.saw_turn,
      saw_river: row.saw_river,
      showdown: row.showdown,
      hero_name: row.hero_name,
      parsed_ok: row.parsed_ok,
      parse_error: row.parse_error,
      marked_for_coach: false,
      sort_order: startSortOrder + i,
      hand_seq_index: startSortOrder + i,
      hand_fingerprint: row.hand_fingerprint,
    });
  }

  for (let i = 0; i < insertRows.length; i += 100) {
    const chunk = insertRows.slice(i, i + 100);
    const { error: insErr } = await supabase.from('sv_review_hands').insert(chunk);
    if (insErr) {
      console.error('addHandsToBatch insert:', insErr);
      errors += chunk.length;
    } else {
      added += chunk.length;
    }
  }

  // Update hand_count on the batch
  if (added > 0) {
    await supabase.rpc('sv_increment_batch_hand_count', { p_batch_id: batchId, p_delta: added }).then(() => {});
    // Fallback: direct update
    const { data: batch } = await supabase.from('sv_review_sets').select('hand_count').eq('id', batchId).maybeSingle();
    if (batch) {
      const currentCount = (batch as { hand_count: number }).hand_count;
      await supabase.from('sv_review_sets').update({ hand_count: currentCount + added, updated_at: new Date().toISOString() }).eq('id', batchId);
    }
  }

  return { added, duplicates, errors };
}

export async function removeHandFromBatch(handRowId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_hands')
    .delete()
    .eq('id', handRowId);
  if (error) { console.error('removeHandFromBatch:', error); return false; }
  return true;
}

export async function toggleMarkForCoach(handRowId: string, marked: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_hands')
    .update({ marked_for_coach: marked })
    .eq('id', handRowId);
  if (error) { console.error('toggleMarkForCoach:', error); return false; }
  return true;
}

export async function updateHandTitle(handRowId: string, title: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_hands')
    .update({ hand_title: title })
    .eq('id', handRowId);
  if (error) { console.error('updateHandTitle:', error); return false; }
  return true;
}

export async function reorderHands(batchId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('sv_review_hands').update({ sort_order: i }).eq('id', orderedIds[i]);
  }
  await supabase.from('sv_review_sets').update({ updated_at: new Date().toISOString() }).eq('id', batchId);
}

// ── Selection Status (candidate/selected) ─────────────────────

export async function setHandSelection(handRowId: string, status: SelectionStatus): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_set_hand_selection', {
    p_hand_row_id: handRowId,
    p_selection_status: status,
  });
  if (error) { console.error('setHandSelection:', error); return false; }
  return data as boolean;
}

export async function getSelectedCount(batchId: string): Promise<number> {
  const { data, error } = await supabase
    .from('sv_review_hands')
    .select('id', { count: 'exact', head: true })
    .eq('review_set_id', batchId)
    .eq('selection_status', 'selected');
  if (error) { return 0; }
  return data?.length ?? 0;
}

export async function getCandidateCount(batchId: string): Promise<number> {
  const { data, error } = await supabase
    .from('sv_review_hands')
    .select('id', { count: 'exact', head: true })
    .eq('review_set_id', batchId)
    .eq('selection_status', 'candidate');
  if (error) { return 0; }
  return data?.length ?? 0;
}

// ── Add Single Hand to Batch via RPC ────────────────────────────

export async function addSingleHandToBatch(
  batchId: string,
  hand: { hand_id: string; raw_hand_text?: string; position?: string | null; hero_cards?: string | null; board?: string | null; net_result?: number | null; stack_size?: number | null; blinds?: string | null; pot_amount?: number | null; site?: string | null; game_mode?: string | null; tournament_id?: string | null; played_at?: string | null; saw_flop?: boolean; saw_turn?: boolean; saw_river?: boolean; showdown?: boolean; hero_name?: string | null; hand_fingerprint?: string | null }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase.rpc('sv_add_hand_to_batch', {
    p_batch_id: batchId,
    p_hand_id: hand.hand_id,
    p_raw_hand_text: hand.raw_hand_text ?? null,
    p_position: hand.position ?? null,
    p_hero_cards: hand.hero_cards ?? null,
    p_board: hand.board ?? null,
    p_net_result: hand.net_result ?? null,
    p_stack_size: hand.stack_size ?? null,
    p_blinds: hand.blinds ?? null,
    p_pot_amount: hand.pot_amount ?? null,
    p_site: hand.site ?? null,
    p_game_mode: hand.game_mode ?? null,
    p_tournament_id: hand.tournament_id ?? null,
    p_played_at: hand.played_at ?? null,
    p_saw_flop: hand.saw_flop ?? false,
    p_saw_turn: hand.saw_turn ?? false,
    p_saw_river: hand.saw_river ?? false,
    p_showdown: hand.showdown ?? false,
    p_hero_name: hand.hero_name ?? null,
    p_hand_fingerprint: hand.hand_fingerprint ?? null,
    p_selection_status: 'selected',
  });
  if (error) { console.error('addSingleHandToBatch:', error); return { ok: false, error: error.message }; }
  return data as { ok: boolean; error?: string; id?: string };
}

// ── Seller Permissions ─────────────────────────────────────────

export interface SellerPermissions {
  spots: boolean;
  video: boolean;
  multi_spot_analysis: boolean;
  hh_bundles: boolean;
  approved: boolean;
}

export async function checkSellerPermissions(): Promise<SellerPermissions> {
  const { data, error } = await supabase.rpc('sv_check_seller_permissions');
  if (error) { console.error('checkSellerPermissions:', error); return { spots: false, video: false, multi_spot_analysis: false, hh_bundles: false, approved: false }; }
  return data as SellerPermissions;
}

// ── Batch Events (notifications) ───────────────────────────────

export interface BatchEvent {
  id: string;
  batch_id: string;
  event_type: string;
  actor_id: string;
  recipient_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

export async function fetchBatchInbox(): Promise<BatchEvent[]> {
  const { data, error } = await supabase
    .from('sv_batch_events')
    .select('id, batch_id, event_type, actor_id, recipient_id, payload, created_at, read_at')
    .eq('recipient_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('fetchBatchInbox:', error); return []; }
  return (data ?? []) as unknown as BatchEvent[];
}

export async function markBatchEventRead(eventId: string): Promise<void> {
  await supabase.from('sv_batch_events').update({ read_at: new Date().toISOString() }).eq('id', eventId);
}

// ── Coach Return / Follow-Up Exchange ────────────────────────────

export interface SubmissionDetails {
  id: string;
  student_id: string;
  coach_id: string;
  title: string;
  status: string;
  exchange_count: number;
  hand_count: number;
  student_note: string | null;
  coach_feedback: string | null;
  review_set_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export async function getSubmissionDetails(submissionId: string): Promise<SubmissionDetails | null> {
  const { data, error } = await supabase.rpc('sv_get_submission_details', {
    p_submission_id: submissionId,
  });
  if (error) { console.error('getSubmissionDetails:', error); return null; }
  return data as unknown as SubmissionDetails | null;
}

export async function returnFeedback(
  submissionId: string,
  message?: string
): Promise<{ ok: boolean; exchangeCount?: number; error?: string }> {
  const { data, error } = await supabase.rpc('sv_return_feedback', {
    p_submission_id: submissionId,
    p_message: message ?? null,
  });
  if (error) { console.error('returnFeedback:', error); return { ok: false, error: error.message }; }
  return { ok: true, exchangeCount: data as number };
}

export async function sendFollowUp(
  submissionId: string,
  message?: string
): Promise<{ ok: boolean; exchangeCount?: number; error?: string }> {
  const { data, error } = await supabase.rpc('sv_send_follow_up', {
    p_submission_id: submissionId,
    p_message: message ?? null,
  });
  if (error) { console.error('sendFollowUp:', error); return { ok: false, error: error.message }; }
  return { ok: true, exchangeCount: data as number };
}

// ── Multi-Author Notes (student + coach conversation) ─────────────

export interface HandNoteEntry {
  id: string;
  review_hand_id: string;
  author_id: string;
  note_type: 'student' | 'coach' | 'session' | 'private';
  content: string;
  exchange_number: number;
  is_delivered: boolean;
  created_at: string;
  updated_at: string;
}

export async function loadAllHandNotes(reviewHandId: string): Promise<HandNoteEntry[]> {
  const { data, error } = await supabase
    .from('sv_review_hand_notes')
    .select('id, review_hand_id, author_id, note_type, content, exchange_number, is_delivered, created_at, updated_at')
    .eq('review_hand_id', reviewHandId)
    .in('note_type', ['student', 'coach'])
    .order('created_at', { ascending: true });
  if (error) { console.error('loadAllHandNotes:', error); return []; }
  return (data ?? []) as unknown as HandNoteEntry[];
}

export async function saveCoachNote(
  reviewHandId: string,
  authorId: string,
  content: string,
  exchangeNumber: number = 0
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (content.length > 1000) return { ok: false, error: 'Coach note exceeds 1,000 character limit' };
  const { data: existing } = await supabase
    .from('sv_review_hand_notes')
    .select('id, is_delivered')
    .eq('review_hand_id', reviewHandId)
    .eq('author_id', authorId)
    .eq('note_type', 'coach')
    .eq('exchange_number', exchangeNumber)
    .maybeSingle();

  if (existing && (existing as { is_delivered: boolean }).is_delivered) {
    return { ok: false, error: 'This feedback has been delivered and is now immutable' };
  }

  if (existing) {
    const { error } = await supabase
      .from('sv_review_hand_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (existing as { id: string }).id };
  }

  const { data, error } = await supabase
    .from('sv_review_hand_notes')
    .insert({
      review_hand_id: reviewHandId,
      author_id: authorId,
      note_type: 'coach',
      content,
      shared: true,
      exchange_number: exchangeNumber,
      is_delivered: false,
    })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string })?.id };
}

export async function saveStudentNote(
  reviewHandId: string,
  authorId: string,
  content: string,
  exchangeNumber: number = 0
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (content.length > 1000) return { ok: false, error: 'Note exceeds 1,000 character limit' };
  const { data: existing } = await supabase
    .from('sv_review_hand_notes')
    .select('id, is_delivered')
    .eq('review_hand_id', reviewHandId)
    .eq('author_id', authorId)
    .eq('note_type', 'student')
    .eq('exchange_number', exchangeNumber)
    .maybeSingle();

  if (existing && (existing as { is_delivered: boolean }).is_delivered) {
    return { ok: false, error: 'This note has been delivered and is now immutable' };
  }

  if (existing) {
    const { error } = await supabase
      .from('sv_review_hand_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (existing as { id: string }).id };
  }

  const { data, error } = await supabase
    .from('sv_review_hand_notes')
    .insert({
      review_hand_id: reviewHandId,
      author_id: authorId,
      note_type: 'student',
      content,
      shared: true,
      exchange_number: exchangeNumber,
      is_delivered: false,
    })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string })?.id };
}

// ── Trigger Email Notification ────────────────────────────────────

export async function triggerBatchNotifyEmail(params: {
  eventType: 'coach_batch_submitted' | 'coach_batch_returned';
  recipientId: string;
  actorId: string;
  submissionId: string;
  title: string;
  handCount: number;
  exchangeCount?: number;
  isFollowUp?: boolean;
}): Promise<void> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/batch-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session?.access_token ?? ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        event_type: params.eventType,
        recipient_id: params.recipientId,
        actor_id: params.actorId,
        submission_id: params.submissionId,
        title: params.title,
        hand_count: params.handCount,
        exchange_count: params.exchangeCount,
        is_follow_up: params.isFollowUp,
      }),
    });
    if (!response.ok) {
      console.error('triggerBatchNotifyEmail:', response.status);
    }
  } catch (err) {
    console.error('triggerBatchNotifyEmail:', err);
  }
}

// ── Working Batch (HH Batch Workflow) ────────────────────────────

export interface WorkingBatchHand {
  id: string;
  review_set_id: string;
  hand_id: string | null;
  raw_hand_text: string | null;
  position: string | null;
  hero_cards: string | null;
  board: string | null;
  net_result: number | null;
  stack_size: number | null;
  blinds: string | null;
  pot_amount: number | null;
  site: string | null;
  game_mode: string | null;
  tournament_id: string | null;
  played_at: string | null;
  saw_flop: boolean;
  saw_turn: boolean;
  saw_river: boolean;
  showdown: boolean;
  hero_name: string | null;
  parsed_ok: boolean;
  parse_error: string | null;
  marked_for_coach: boolean;
  sort_order: number;
  hand_title: string | null;
  hand_fingerprint: string | null;
  selection_status: SelectionStatus;
  added_by: string | null;
  batch_note: string | null;
  created_at: string;
  hand_seq_index: number | null;
  has_note: boolean;
  note_preview: string | null;
}

export async function createWorkingBatch(userId: string): Promise<HandBatch | null> {
  const { data, error } = await supabase
    .from('sv_review_sets')
    .insert({
      owner_id: userId,
      title: 'Untitled Batch',
      source_type: 'custom',
      batch_type: 'hh_bundle',
      hand_count: 0,
      status: 'active',
      batch_mode: 'working',
    })
    .select('id, owner_id, title, description, source_type, batch_type, hand_count, status, created_at, updated_at')
    .maybeSingle();
  if (error) { console.error('createWorkingBatch:', error); return null; }
  return data as unknown as HandBatch | null;
}

export async function fetchWorkingBatch(userId: string): Promise<HandBatch | null> {
  const { data, error } = await supabase
    .from('sv_review_sets')
    .select('id, owner_id, title, description, source_type, batch_type, hand_count, status, created_at, updated_at')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .eq('batch_mode', 'working')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('fetchWorkingBatch:', error); return null; }
  return data as unknown as HandBatch | null;
}

export async function fetchWorkingBatchHands(batchId: string): Promise<WorkingBatchHand[]> {
  const { data, error } = await supabase
    .from('sv_review_hands')
    .select(`
      id, review_set_id, hand_id, raw_hand_text, position, hero_cards, board,
      net_result, stack_size, blinds, pot_amount, site, game_mode, tournament_id,
      played_at, saw_flop, saw_turn, saw_river, showdown, hero_name,
      parsed_ok, parse_error, marked_for_coach, sort_order, hand_title,
      hand_fingerprint, selection_status, added_by, batch_note, created_at, hand_seq_index
    `)
    .eq('review_set_id', batchId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchWorkingBatchHands:', error); return []; }
  const hands = (data ?? []) as unknown as Omit<WorkingBatchHand, 'has_note' | 'note_preview'>[];

  // Load note indicators for all hands in one query
  const handIds = hands.map((h) => h.id);
  let noteMap: Record<string, { has_note: boolean; note_preview: string | null }> = {};
  if (handIds.length > 0) {
    const { data: notes } = await supabase
      .from('sv_review_hand_notes')
      .select('review_hand_id, content')
      .in('review_hand_id', handIds)
      .in('note_type', ['student', 'coach'])
      .order('created_at', { ascending: true });
    if (notes) {
      for (const n of notes as { review_hand_id: string; content: string }[]) {
        if (!noteMap[n.review_hand_id]) {
          noteMap[n.review_hand_id] = {
            has_note: true,
            note_preview: n.content.slice(0, 80),
          };
        }
      }
    }
  }

  return hands.map((h) => ({
    ...h,
    has_note: noteMap[h.id]?.has_note ?? false,
    note_preview: noteMap[h.id]?.note_preview ?? null,
  }));
}

export async function addHandToWorkingBatch(
  batchId: string,
  hand: {
    hand_id: string;
    raw_hand_text?: string;
    position?: string | null;
    hero_cards?: string | null;
    board?: string | null;
    net_result?: number | null;
    stack_size?: number | null;
    blinds?: string | null;
    pot_amount?: number | null;
    site?: string | null;
    game_mode?: string | null;
    tournament_id?: string | null;
    played_at?: string | null;
    saw_flop?: boolean;
    saw_turn?: boolean;
    saw_river?: boolean;
    showdown?: boolean;
    hero_name?: string | null;
    hand_fingerprint?: string | null;
  }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  return addSingleHandToBatch(batchId, hand);
}

export async function removeWorkingBatchHand(handRowId: string): Promise<boolean> {
  return removeHandFromBatch(handRowId);
}

export async function reorderWorkingBatchHands(batchId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('sv_review_hands').update({ sort_order: i, hand_seq_index: i }).eq('id', orderedIds[i]);
  }
  await supabase.from('sv_review_sets').update({ updated_at: new Date().toISOString() }).eq('id', batchId);
}

export async function deleteWorkingBatch(batchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_sets')
    .delete()
    .eq('id', batchId)
    .eq('batch_mode', 'working');
  if (error) { console.error('deleteWorkingBatch:', error); return false; }
  return true;
}

export async function saveWorkingBatchAsMultiSpot(params: {
  userId: string;
  userName: string;
  batchId: string;
  title: string;
  coverImageUrl?: string | null;
}): Promise<{ ok: boolean; spotId?: string; error?: string }> {
  const { userId, userName, batchId, title, coverImageUrl } = params;

  // Fetch hands to get count
  const { data: handRows, error: handErr } = await supabase
    .from('sv_review_hands')
    .select('id')
    .eq('review_set_id', batchId);
  if (handErr) return { ok: false, error: handErr.message };
  const handCount = handRows?.length ?? 0;
  if (handCount === 0) return { ok: false, error: 'Cannot save an empty batch' };

  // Create content_spots row
  const { data: spotRow, error: spotErr } = await supabase
    .from('content_spots')
    .insert({
      account_id: userId,
      creator_name: userName,
      status: 'draft',
      source: 'HH Batch',
      title: title || 'Untitled Batch',
      subtitle: `${handCount} hands`,
      spot_type: 'multi_spot',
      image_urls: coverImageUrl ? [coverImageUrl] : [],
      cover_image_url: coverImageUrl ?? null,
      review_set_id: batchId,
      tags: {},
      is_monetized: false,
      price_credits: 0,
      show_in_courses: false,
    })
    .select('id')
    .maybeSingle();
  if (spotErr) return { ok: false, error: spotErr.message };

  // Link the batch to the spot and mark it as saved (not working anymore)
  await supabase
    .from('sv_review_sets')
    .update({
      content_spot_id: spotRow.id,
      batch_mode: 'review',
      title: title || 'Untitled Batch',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  return { ok: true, spotId: spotRow.id };
}

export async function fetchMultiSpotBatchBySpotId(spotId: string): Promise<HandBatch & { tournament_name?: string | null; tournament_date?: string | null; tournament_buy_in?: string | null; tournament_game_type?: string | null; is_tournament?: boolean } | null> {
  const { data, error } = await supabase
    .from('sv_review_sets')
    .select('id, owner_id, title, description, source_type, batch_type, hand_count, status, created_at, updated_at, content_spot_id, batch_mode, is_tournament, tournament_name, tournament_date, tournament_buy_in, tournament_game_type')
    .eq('content_spot_id', spotId)
    .maybeSingle();
  if (error) { console.error('fetchMultiSpotBatchBySpotId:', error); return null; }
  return data as unknown as HandBatch & { tournament_name?: string | null; tournament_date?: string | null; tournament_buy_in?: string | null; tournament_game_type?: string | null; is_tournament?: boolean } | null;
}

export async function updateMultiSpotCoverImage(spotId: string, coverImageUrl: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('content_spots')
    .update({
      cover_image_url: coverImageUrl,
      image_urls: coverImageUrl ? [coverImageUrl] : [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', spotId);
  if (error) { console.error('updateMultiSpotCoverImage:', error); return false; }
  return true;
}
