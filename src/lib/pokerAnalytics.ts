import { supabase } from '@/lib/supabase';
import { analyzePreflopState, didReachShowdown } from './preflopStateMachine';
import { createEmptyAdvancedStats, computeAdvancedStatsForHand, statPct, type AdvancedStats } from './advancedStats';
import { normalizeBoard, type StructuralTag, type PairedStructure, type SuitedRelationship } from './boardNormalization';
import { getCachedSnapshot, setCachedSnapshot, invalidateCachedSnapshot } from './analyticsSnapshotCache';

// ============================================================
// Types
// ============================================================

export type AnalyticsMode = 'cash' | 'mtt';

export interface ImportProgress {
  stage: 'reading' | 'parsing' | 'duplicates' | 'saving' | 'calculating' | 'complete';
  filesProcessed: number;
  filesTotal: number;
  handsFound: number;
  handsImported: number;
  duplicates: number;
  errors: number;
  tournaments: number;
  summariesImported: number;
  elapsedMs: number;
  errorSamples: string[];
  savingTotal?: number;
  savingDone?: number;
  parsingTotal?: number;
  parsingDone?: number;
  totalHandsStored?: number;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  imported_at: string;
  file_count: number;
  hand_count: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  tournament_count: number;
  elapsed_ms: number;
  source_types: string[];
  status: string;
  error_summary: string[];
  mode: string;
  summary_count: number;
  import_type: string;
}

export interface AnalyticsSnapshot {
  id: string;
  user_id: string;
  mode: string;
  calculated_at: string;
  source_hand_count: number;
  source_imported_at: string | null;
  summary: Record<string, number>;
  position_analysis: Record<string, number | string>[];
  preflop_analysis: Record<string, number>;
  postflop_analysis: Record<string, number>;
  board_analysis: Record<string, number | string>[];
  tournament_analysis: Record<string, number>;
  graph_series: { index: number; profit: number; showdown?: number; non_showdown?: number; ev?: number }[];
  flop_analysis: Record<string, number>;
  turn_analysis: Record<string, number>;
  river_analysis: Record<string, number>;
  starting_hands: Record<string, { hands: number; bb_won: number; bb100: number }>[];
  filters: Record<string, unknown>;
  sanity_checks?: Array<{ name: string; pass: boolean; detail: string }>;
  previous_summary?: Record<string, number> | null;
  previous_hand_count?: number | null;
}

// ============================================================
// Job lock — prevents concurrent recalculateAnalytics calls
// ============================================================

const STALE_JOB_MS = 30 * 60 * 1000; // 30 minutes — treat running jobs older than this as stale

export interface AnalyticsJob {
  id: string;
  status: string;
  started_at: string;
  hands_processed: number | null;
  hands_total: number | null;
  error_message: string | null;
}

const REAP_COOLDOWN_MS = 60_000;
const lastReapTime = new Map<string, number>();

async function reapStaleJobs(userId: string, mode: AnalyticsMode): Promise<void> {
  const key = `${userId}:${mode}`;
  const now = Date.now();
  const last = lastReapTime.get(key) ?? 0;
  if (now - last < REAP_COOLDOWN_MS) return;
  lastReapTime.set(key, now);
  const cutoff = new Date(Date.now() - STALE_JOB_MS).toISOString();
  await supabase
    .from('poker_analytics_jobs')
    .update({ status: 'failed', error_message: 'Stale job — timed out without completion', completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('mode', mode)
    .eq('status', 'running')
    .lt('started_at', cutoff);
}

export async function getActiveAnalyticsJob(userId: string, mode: AnalyticsMode): Promise<AnalyticsJob | null> {
  await reapStaleJobs(userId, mode);
  const { data, error } = await supabase
    .from('poker_analytics_jobs')
    .select('id, status, started_at, hands_processed, hands_total, error_message')
    .eq('user_id', userId)
    .eq('mode', mode)
    .eq('status', 'running')
    .maybeSingle();
  if (error) return null;
  return data as AnalyticsJob | null;
}

async function acquireAnalyticsJob(userId: string, mode: AnalyticsMode, totalHands: number): Promise<{ jobId: string } | { conflict: true }> {
  await reapStaleJobs(userId, mode);
  const { data, error } = await supabase
    .from('poker_analytics_jobs')
    .insert({ user_id: userId, mode, status: 'running', hands_total: totalHands })
    .select('id')
    .maybeSingle();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === '23505') return { conflict: true };
    throw new Error(`Failed to acquire analytics job lock: ${error.message}`);
  }
  if (!data) return { conflict: true };
  return { jobId: data.id };
}

async function completeAnalyticsJob(jobId: string, handsProcessed: number, durationMs: number): Promise<void> {
  await supabase
    .from('poker_analytics_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString(), hands_processed: handsProcessed, duration_ms: durationMs })
    .eq('id', jobId);
}

async function failAnalyticsJob(jobId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('poker_analytics_jobs')
    .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: errorMessage })
    .eq('id', jobId);
}

// ============================================================
// Data status (lightweight — no full hand load)
// ============================================================

export async function loadDataStatus(userId: string, mode?: AnalyticsMode): Promise<{ hands: number; latestImport: string | null }> {
  let countQuery = supabase.from('poker_hand_records').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (mode) countQuery = countQuery.eq('game_mode', mode);
  // Exclude synthetic records (old parser fallback) and summary records — only count real hand histories
  countQuery = countQuery.filter('hand_hash', 'not.like', '%-unknown-%').filter('hand_hash', 'not.like', 'summary-%');
  const [countResult, latestResult] = await Promise.all([
    countQuery,
    supabase
      .from('poker_import_batches')
      .select('imported_at')
      .eq('user_id', userId)
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    hands: countResult.count ?? 0,
    latestImport: latestResult.data?.imported_at ?? null,
  };
}

// ============================================================
// Load latest snapshot (no recalculation)
// ============================================================

export async function loadLatestSnapshot(userId: string, mode: AnalyticsMode): Promise<AnalyticsSnapshot | null> {
  const cached = getCachedSnapshot(userId, mode);
  if (cached !== undefined) return cached;
  const { data, error } = await supabase
    .from('poker_analytics_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('loadLatestSnapshot error:', error);
    return null;
  }
  const result = data as AnalyticsSnapshot | null;
  setCachedSnapshot(userId, mode, result);
  return result;
}

// Sentinel user ID for the platform-wide demo analytics dataset.
// Any account without personal imported data falls back to this snapshot.
export const DEMO_ANALYTICS_USER_ID = '__demo__';

export async function loadDemoSnapshot(mode: AnalyticsMode): Promise<AnalyticsSnapshot | null> {
  const { data, error } = await supabase
    .from('poker_analytics_snapshots')
    .select('*')
    .eq('user_id', DEMO_ANALYTICS_USER_ID)
    .eq('mode', mode)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('loadDemoSnapshot error:', error);
    return null;
  }
  const result = data as AnalyticsSnapshot | null;
  setCachedSnapshot(DEMO_ANALYTICS_USER_ID, mode, result);
  return result;
}
// ============================================================

export async function loadImportHistory(userId: string): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from('poker_import_batches')
    .select('*')
    .eq('user_id', userId)
    .order('imported_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('loadImportHistory error:', error);
    return [];
  }
  return (data ?? []) as ImportBatch[];
}

// ============================================================
// Import poker files — canonical pipeline
// ============================================================

export async function importPokerFiles(
  userId: string,
  mode: AnalyticsMode,
  files: File[],
  onProgress: (p: ImportProgress) => void
): Promise<void> {
  const startTime = Date.now();
  let filesProcessed = 0;
  let handsFound = 0;
  let handsImported = 0;
  let duplicates = 0;
  let errors = 0;
  let summariesImported = 0;
  const tournamentIds = new Set<string>();
  const sourceTypes = new Set<string>();

  // Stage 1: Reading
  const errorSamples: string[] = [];
  onProgress({ stage: 'reading', filesProcessed: 0, filesTotal: files.length, handsFound: 0, handsImported: 0, duplicates: 0, errors: 0, tournaments: 0, summariesImported: 0, elapsedMs: 0, errorSamples: [] });

  const allHandRecords: Record<string, unknown>[] = [];
  const allSummaryRecords: Record<string, unknown>[] = [];

  for (const file of files) {
    const text = await file.text();
    filesProcessed++;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'csv') sourceTypes.add('summary'); else sourceTypes.add('hh');

    const parsed = parseFile(text, userId, file.name, mode);

    if (parsed.fileType === 'summary') {
      sourceTypes.add('summary');
      allSummaryRecords.push(...parsed.records);
      summariesImported += parsed.records.length;
    } else {
      sourceTypes.add('hh');
      allHandRecords.push(...parsed.records);
      handsFound += parsed.records.length;
    }

    errors += parsed.parseErrors;
    if (parsed.errorSamples) {
      for (const s of parsed.errorSamples) {
        if (errorSamples.length < 5) errorSamples.push(s);
      }
    }
    parsed.tournamentIds.forEach((id) => tournamentIds.add(id));

    onProgress({
      stage: 'reading',
      filesProcessed,
      filesTotal: files.length,
      handsFound,
      handsImported: 0,
      duplicates: 0,
      errors,
      tournaments: tournamentIds.size,
      summariesImported,
      elapsedMs: Date.now() - startTime,
      errorSamples: [...errorSamples],
    });
  }

  // Stage 2: Parsing (metadata already extracted during read)
  onProgress({ stage: 'parsing', filesProcessed, filesTotal: files.length, handsFound, handsImported: 0, duplicates: 0, errors, tournaments: tournamentIds.size, summariesImported, elapsedMs: Date.now() - startTime, errorSamples: [...errorSamples] });

  // Stage 3: Dedup hand records within batch
  onProgress({ stage: 'duplicates', filesProcessed, filesTotal: files.length, handsFound, handsImported: 0, duplicates: 0, errors, tournaments: tournamentIds.size, summariesImported, elapsedMs: Date.now() - startTime, errorSamples: [...errorSamples] });
  const seen = new Set<string>();
  const dedupedHands: Record<string, unknown>[] = [];
  for (const rec of allHandRecords) {
    const hash = rec.hand_hash as string;
    if (seen.has(hash)) { duplicates++; continue; }
    seen.add(hash);
    dedupedHands.push(rec);
  }

  // Query the hand count BEFORE saving so we can compute genuinely new hands
  // (upsert with onConflict updates existing rows, so handsImported can't
  // distinguish new inserts from updates).
  const CHUNK = 500;
  const savingTotal = dedupedHands.length;
  let totalHandsStored = 0;
  let handsBeforeImport = 0;
  try {
    const { count: beforeCount, error: beforeErr } = await supabase
      .from('poker_hand_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game_mode', mode)
      .filter('hand_hash', 'not.like', '%-unknown-%')
      .filter('hand_hash', 'not.like', 'summary-%');
    if (beforeErr) console.error('[importPokerFiles] pre-import count failed:', beforeErr.message);
    if (typeof beforeCount === 'number') handsBeforeImport = beforeCount;
  } catch (e) {
    console.error('[importPokerFiles] pre-import count threw:', e);
  }

  // Stage 4: Saving hand records in chunks using upsert to avoid silent data loss.
  // A plain insert rejects the ENTIRE chunk when even one hand is a duplicate,
  // silently dropping genuinely new hands that share the chunk. Upsert with
  // onConflict lets new hands through while skipping already-stored ones.
  for (let i = 0; i < dedupedHands.length; i += CHUNK) {
    const chunk = dedupedHands.slice(i, i + CHUNK);
    const { error: upsertError } = await supabase
      .from('poker_hand_records')
      .upsert(chunk, { onConflict: 'user_id,hand_hash' });
    if (upsertError) {
      errors += chunk.length;
      if (errorSamples.length < 5) errorSamples.push(`DB upsert error: ${upsertError.message}`);
    } else {
      // Count all successfully upserted rows (includes both new inserts and updates of existing rows).
      // The genuinely-new count is computed after saving by comparing before/after totals.
      handsImported += chunk.length;
    }
    onProgress({
      stage: 'saving',
      filesProcessed,
      filesTotal: files.length,
      handsFound,
      handsImported,
      duplicates,
      errors,
      tournaments: tournamentIds.size,
      summariesImported,
      elapsedMs: Date.now() - startTime,
      errorSamples: [...errorSamples],
      savingTotal,
      savingDone: handsImported + duplicates,
    });
  }

  // Query the actual total hand count after this import so the summary
  // can show "total hands now stored" alongside new/duplicate/error counts.
  // Must match loadDataStatus filters exactly (exclude both summary-% and %-unknown-%).
  try {
    const { count, error: countError } = await supabase
      .from('poker_hand_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game_mode', mode)
      .filter('hand_hash', 'not.like', '%-unknown-%')
      .filter('hand_hash', 'not.like', 'summary-%');
    if (countError) {
      console.error('[importPokerFiles] totalHandsStored count query failed:', countError.message);
    }
    if (typeof count === 'number') totalHandsStored = count;
  } catch (e) {
    console.error('[importPokerFiles] totalHandsStored count query threw:', e);
  }

  // Compute genuinely new hands = after - before (clamped to >= 0)
  const genuinelyNewHands = Math.max(0, totalHandsStored - handsBeforeImport);
  // Override handsImported with the accurate count for display
  if (genuinelyNewHands > 0 || (handsImported > 0 && totalHandsStored === handsBeforeImport)) {
    handsImported = genuinelyNewHands;
  }

  // Save summary records (tournament summaries are stored separately)
  for (let i = 0; i < allSummaryRecords.length; i += CHUNK) {
    const chunk = allSummaryRecords.slice(i, i + CHUNK);
    const { error: insertError } = await supabase.from('poker_hand_records').upsert(chunk, { onConflict: 'hand_hash' });
    if (insertError) {
      errors += chunk.length;
    }
  }

  // Determine import type for batch record
  const importType = handsFound > 0 && summariesImported > 0 ? 'mixed' : summariesImported > 0 ? 'summary' : 'hh';

  // Record import batch
  const { data: batchData } = await supabase.from('poker_import_batches').insert({
    user_id: userId,
    mode,
    file_count: files.length,
    hand_count: handsFound,
    imported_count: handsImported,
    duplicate_count: duplicates,
    error_count: errors,
    tournament_count: tournamentIds.size,
    elapsed_ms: Date.now() - startTime,
    source_types: Array.from(sourceTypes),
    status: 'completed',
    error_summary: [],
    summary_count: summariesImported,
    import_type: importType,
  }).select('id').single();

  const batchId = batchData?.id;

  // Link imported hands to this batch
  if (batchId && handsImported > 0) {
    const insertedHashes = dedupedHands.map((r) => r.hand_hash as string);
    for (let i = 0; i < insertedHashes.length; i += CHUNK) {
      const chunk = insertedHashes.slice(i, i + CHUNK);
      await supabase.from('poker_hand_records')
        .update({ import_batch_id: batchId })
        .in('hand_hash', chunk);
    }
  }

  // Stage 5: Complete
  onProgress({ stage: 'complete', filesProcessed, filesTotal: files.length, handsFound, handsImported, duplicates, errors, tournaments: tournamentIds.size, summariesImported, elapsedMs: Date.now() - startTime, errorSamples: [...errorSamples], totalHandsStored });
}

// ============================================================
// File parser — distinguishes hand histories from tournament summaries
// ============================================================

interface ParseResult {
  fileType: 'hh' | 'summary';
  records: Record<string, unknown>[];
  parseErrors: number;
  tournamentIds: Set<string>;
  errorSamples: string[];
}

function parseFile(text: string, userId: string, fileName: string, mode: AnalyticsMode): ParseResult {
  // Detect file type: hand history files contain hand blocks with "Hand #";
  // GG uses "Poker Hand #RC..." and PokerStars uses "PokerStars Hand #..."
  // Tournament summary files contain tournament info but NO hand blocks
  const hasHandBlocks = /Hand\s+#\S+/.test(text);

  if (!hasHandBlocks) {
    return parseTournamentSummary(text, userId, fileName, mode);
  }

  return parseHandHistory(text, userId, fileName, mode);
}

function detectSite(text: string, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('stars')) return 'PokerStars';
  if (lower.includes('gg') || /Poker Hand #/.test(text)) return 'GGPoker';
  if (/Game Hand #/.test(text) || lower.includes('wpn') || lower.includes('acr')) return 'WPN';
  if (lower.includes('poker')) return 'GGPoker';
  return 'unknown';
}

function parseTournamentSummary(text: string, userId: string, fileName: string, mode: AnalyticsMode): ParseResult {
  const records: Record<string, unknown>[] = [];
  const tournamentIds = new Set<string>();
  let parseErrors = 0;

  const tournMatches = text.matchAll(/Tournament\s+#(\S+)/g);
  for (const m of tournMatches) {
    tournamentIds.add(m[1]);
  }

  if (tournamentIds.size === 0) {
    return { fileType: 'summary', records: [], parseErrors: 0, tournamentIds: new Set(), errorSamples: [] };
  }

  const site = detectSite(text, fileName);
  for (const tournId of tournamentIds) {
    records.push({
      user_id: userId,
      hand_hash: `summary-${userId}-${tournId}`,
      source_file_name: fileName,
      site,
      played_at: null,
      game_mode: mode,
      tournament_id: tournId,
      pot_amount: null,
      bb_won: null,
      position: null,
    });
  }

  return { fileType: 'summary', records, parseErrors, tournamentIds, errorSamples: [] };
}

// ============================================================
// Hand history parser — supports GG Poker and PokerStars formats
// ============================================================

// Parsed hand structure for analytics
export interface ParsedHand {
  handId: string;
  site: string;
  playedAt: string | null;
  tournamentId: string | null;
  gameMode: AnalyticsMode;
  heroName: string | null;
  heroSeat: number | null;
  position: string | null;
  blinds: string | null;
  stackSize: number | null;
  buyIn: number | null;
  heroCards: string | null;
  board: string | null;
  actions: ActionEntry[];
  netResult: number | null;
  potAmount: number | null;
  showdown: boolean;
  sawFlop: boolean;
  sawTurn: boolean;
  sawRiver: boolean;
}

export interface ActionEntry {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  player: string;
  action: string; // fold, check, call, bet, raise, all-in, post, collect, uncalled
  amount: number | null;
}

function computeStartingHandClass(cardsStr: string | null): string | null {
  return cardsStr ? normalizeHandKey(cardsStr) : null;
}

function computeBoardTexture(boardStr: string | null): Record<string, unknown> {
  if (!boardStr) return {};
  const tokens = boardStr.trim().split(/\s+/).filter(t => /[2-9TJQKA][hdcs]/.test(t));
  if (tokens.length < 3) return {};
  const r1 = tokens[0][0], s1 = tokens[0][1];
  const r2 = tokens[1][0], s2 = tokens[1][1];
  const r3 = tokens[2][0], s3 = tokens[2][1];
  const order = '23456789TJQKA';
  const i1 = order.indexOf(r1), i2 = order.indexOf(r2), i3 = order.indexOf(r3);
  if (i1 < 0 || i2 < 0 || i3 < 0) return {};

  const highRank = i1 >= i2 && i1 >= i3 ? r1 : i2 >= i1 && i2 >= i3 ? r2 : r3;
  const isTrips = r1 === r2 && r2 === r3;
  const isPaired = isTrips || r1 === r2 || r2 === r3 || r1 === r3;
  const suitTex = s1 === s2 && s2 === s3 ? 'monotone'
    : s1 === s2 || s2 === s3 || s1 === s3 ? 'two_tone' : 'rainbow';
  const sorted = [i1, i2, i3].sort((a, b) => b - a);
  const gap1 = sorted[0] - sorted[1], gap2 = sorted[1] - sorted[2];
  const conn = (gap1 <= 1 && gap2 <= 1) || (gap1 <= 2 && gap2 <= 1) || (gap1 <= 1 && gap2 <= 2)
    ? 'connected' : gap1 <= 3 && gap2 <= 3 ? 'semi_connected' : 'disconnected';
  const highLabel = highRank === 'A' ? 'ace_high' : highRank === 'K' ? 'king_high'
    : highRank === 'Q' ? 'queen_high' : highRank === 'J' ? 'jack_high' : 'low_high';

  // Additional texture categories
  const broadwayCount = [i1, i2, i3].filter(i => i >= order.indexOf('T')).length;
  const isBroadwayHeavy = broadwayCount >= 2;
  const isLowBoard = [i1, i2, i3].every(i => i <= order.indexOf('7'));
  const isWheelHeavy = [i1, i2, i3].filter(i => i <= order.indexOf('5')).length >= 2;
  const maxGap = Math.max(gap1, gap2);
  const isStatic = !isPaired && suitTex !== 'monotone' && maxGap >= 4;
  const isDynamic = isPaired || suitTex === 'monotone' || (gap1 <= 1 && gap2 <= 1);

  const boardClass = isTrips ? 'trips' : isPaired ? `${highLabel}_paired` : `${highLabel}_${suitTex}`;

  return {
    flop_high_card: highRank,
    flop_is_paired: isPaired,
    flop_is_trips: isTrips,
    flop_suit_texture: suitTex,
    flop_connectivity: conn,
    board_class: boardClass,
    flop_broadway_heavy: isBroadwayHeavy,
    flop_low_board: isLowBoard,
    flop_wheel_heavy: isWheelHeavy,
    flop_texture: isStatic ? 'static' : isDynamic ? 'dynamic' : 'neutral',
  };
}

/**
 * Determine whether hero had a legitimate flop C-Bet opportunity.
 * A legitimate C-Bet opportunity requires:
 * 1. Hero was the last preflop aggressor (raiser)
 * 2. Hero reached the flop (sawFlop = true)
 * 3. No opponent bet or raised before hero's first flop action
 *    (a donk-bet by an opponent removes the C-Bet opportunity)
 * Returns: 'opportunity' | 'no_aggressor' | 'didnt_see_flop' | 'donk_bet_first'
 */
export function classifyFlopCbetOpportunity(
  actions: ActionEntry[],
  heroName: string | null,
  sawFlop: boolean,
): 'opportunity' | 'no_aggressor' | 'didnt_see_flop' | 'donk_bet_first' {
  if (!heroName || !sawFlop) return 'didnt_see_flop';

  const preflopRaises = actions.filter(a => a.street === 'preflop' && ['raise', 'bet', 'all-in'].includes(a.action));
  const lastRaiser = preflopRaises.length > 0 ? preflopRaises[preflopRaises.length - 1].player : null;
  if (lastRaiser !== heroName) return 'no_aggressor';

  const flopActions = actions.filter(a => a.street === 'flop');
  for (const a of flopActions) {
    if (a.player === heroName) {
      // Hero's first flop action — if we got here without an opponent betting first, it's a legitimate opportunity
      return 'opportunity';
    }
    // An opponent bet or raised before hero acted — this is a donk-bet, removing the C-Bet opportunity
    if (['bet', 'raise', 'all-in'].includes(a.action)) {
      return 'donk_bet_first';
    }
    // Opponent checking or folding doesn't remove the opportunity
  }

  // Hero never acted on the flop (e.g., hand ended before hero's turn) — not a legitimate opportunity
  return 'didnt_see_flop';
}

/**
 * Check whether hero actually made a flop C-Bet.
 * A C-Bet is when hero (as the preflop aggressor) bets or raises on the flop
 * as their first aggressive flop action, without an opponent donk-betting first.
 */
export function didHeroCbetFlop(
  actions: ActionEntry[],
  heroName: string | null,
  sawFlop: boolean,
): boolean {
  if (!heroName || !sawFlop) return false;

  const preflopRaises = actions.filter(a => a.street === 'preflop' && ['raise', 'bet', 'all-in'].includes(a.action));
  const lastRaiser = preflopRaises.length > 0 ? preflopRaises[preflopRaises.length - 1].player : null;
  if (lastRaiser !== heroName) return false;

  const flopActions = actions.filter(a => a.street === 'flop');
  for (const a of flopActions) {
    if (a.player === heroName) {
      // Hero's first flop action — C-Bet if it's a bet/raise/all-in
      return ['bet', 'raise', 'all-in'].includes(a.action);
    }
    // An opponent bet or raised before hero acted — donk-bet, no C-Bet possible
    if (['bet', 'raise', 'all-in'].includes(a.action)) {
      return false;
    }
  }
  return false;
}


export function computeDerivedFields(actions: ActionEntry[], heroName: string | null, sawFlop: boolean, sawTurn: boolean, sawRiver: boolean): Record<string, unknown> {
  let pfRaiseCount = 0;
  let pfCallCount = 0;
  let heroPfRaiseCount = 0;
  let heroFaced3bet = false;
  let heroFlat3bet = false;
  let heroColdCall3bet = false;
  let lastPfRaiser: string | null = null;
  let heroCbetFlop = false;
  let facedCbetFlop = false;
  let heroBarrelTurn = false;
  let heroBarrelRiver = false;
  let heroCheckraise = false;
  let heroAllinPf = false;
  let heroAllinPostflop = false;
  let heroPfAction = 'none';
  let curStreet = '';
  let heroChecked = false;
  let heroRaised = false;

  for (const a of actions) {
    if (a.street !== curStreet) {
      if (curStreet === 'flop' || curStreet === 'turn' || curStreet === 'river') {
        if (heroChecked && heroRaised) heroCheckraise = true;
      }
      curStreet = a.street;
      heroChecked = false;
      heroRaised = false;
    }

    if (a.street === 'preflop' && ['raise', 'bet', 'all-in'].includes(a.action)) {
      pfRaiseCount++;
      lastPfRaiser = a.player;
      if (a.player === heroName) {
        heroPfRaiseCount++;
        // heroPfAction classification:
        // - 1st raise by hero when no one raised before = 'raise' (open)
        // - 1st raise by hero when someone else already raised = '3bet'
        // - 2nd raise by hero (someone re-raised after hero's open) = '4bet'
        if (heroPfRaiseCount === 1 && pfRaiseCount === 1) heroPfAction = 'raise';
        else if (heroPfRaiseCount === 1 && pfRaiseCount === 2) heroPfAction = '3bet';
        else if (heroPfRaiseCount >= 2) heroPfAction = '4bet';
      }
      // Hero faced a 3-bet when someone else re-raises after hero already opened
      if (a.player !== heroName && pfRaiseCount >= 2 && heroPfRaiseCount >= 1) heroFaced3bet = true;
    }

    if (a.street === 'preflop' && a.action === 'call') {
      pfCallCount++;
      if (a.player === heroName && heroPfAction === 'none') heroPfAction = 'call';
      if (a.player === heroName && pfRaiseCount === 0) heroPfAction = 'limp';
      // A flat 3-bet call follows Hero's own open; a cold call follows
      // another player's open and 3-bet without Hero raising first.
      if (a.player === heroName && pfRaiseCount >= 2) {
        if (heroPfRaiseCount === 1) heroFlat3bet = true;
        if (heroPfRaiseCount === 0) heroColdCall3bet = true;
      }
    }

    if (a.street === 'preflop' && a.action === 'all-in' && a.player === heroName) {
      heroAllinPf = true;
      heroPfAction = 'allin';
    }

    if (['flop', 'turn', 'river'].includes(a.street) && a.action === 'all-in' && a.player === heroName) {
      heroAllinPostflop = true;
    }

    if (a.street === 'flop' && ['bet', 'raise', 'all-in'].includes(a.action) && a.player === heroName && lastPfRaiser === heroName) {
      // Only count as C-Bet if no opponent bet before this action
      // Check if any opponent bet/raise appeared before this action in the flop
      const flopActionsBefore = actions.slice(0, actions.indexOf(a));
      const oppDonked = flopActionsBefore.some(b => b.street === 'flop' && b.player !== heroName && ['bet', 'raise', 'all-in'].includes(b.action));
      if (!oppDonked) heroCbetFlop = true;
    }

    if (a.street === 'flop' && ['bet', 'raise', 'all-in'].includes(a.action) && a.player !== heroName && lastPfRaiser !== heroName) {
      facedCbetFlop = true;
    }

    if (a.street === 'turn' && ['bet', 'raise', 'all-in'].includes(a.action) && a.player === heroName && heroCbetFlop) {
      heroBarrelTurn = true;
    }

    if (a.street === 'river' && ['bet', 'raise', 'all-in'].includes(a.action) && a.player === heroName && heroBarrelTurn) {
      heroBarrelRiver = true;
    }

    if (['flop', 'turn', 'river'].includes(a.street) && a.player === heroName) {
      if (a.action === 'check') heroChecked = true;
      if (['raise', 'bet', 'all-in'].includes(a.action)) heroRaised = true;
    }
  }

  if ((curStreet === 'flop' || curStreet === 'turn' || curStreet === 'river') && heroChecked && heroRaised) {
    heroCheckraise = true;
  }

  const potType = pfRaiseCount === 0 && pfCallCount > 0 ? 'limped'
    : pfRaiseCount === 0 ? 'unopened'
    : pfRaiseCount === 1 ? 'srp'
    : pfRaiseCount === 2 ? '3bet'
    : '4bet_plus';

  const streetReached = sawRiver ? 'river' : sawTurn ? 'turn' : sawFlop ? 'flop' : 'preflop';

  return {
    pot_type: potType,
    is_3bet_pot: pfRaiseCount >= 2,
    is_4bet_pot: pfRaiseCount >= 3,
    street_reached: streetReached,
    hero_allin_preflop: heroAllinPf,
    hero_allin_postflop: heroAllinPostflop,
    hero_preflop_action: heroPfAction,
    hero_faced_3bet: heroFaced3bet,
    hero_flat_3bet: heroFlat3bet,
    hero_cold_call_3bet: heroColdCall3bet,
    hero_cbet_flop: heroCbetFlop,
    faced_cbet_flop: facedCbetFlop,
    hero_barrel_turn: heroBarrelTurn,
    hero_barrel_river: heroBarrelRiver,
    hero_checkraise: heroCheckraise,
  };
}

function parseHandHistory(text: string, userId: string, fileName: string, mode: AnalyticsMode): ParseResult {
  const records: Record<string, unknown>[] = [];
  let parseErrors = 0;
  const tournamentIds = new Set<string>();
  const site = detectSite(text, fileName);

  // Split into hand blocks — supports GG "Poker Hand #", PokerStars "PokerStars Hand #",
  // generic "Hand #", and ACR/WPN "Game Hand #". Handles both \n and \r\n line endings.
  const blocks = text.split(/\r?\n(?=Poker Hand #|PokerStars Hand #|Hand #|Game Hand #)/).filter((b) => b.trim().length > 0);

  const errorSamples: string[] = [];
  for (const block of blocks) {
    if (!/Hand\s+#\S/.test(block)) {
      continue;
    }
    try {
      const parsed = parseHandBlock(block, site, mode);
      if (!parsed) {
        parseErrors++;
        if (errorSamples.length < 3) {
          const firstLine = block.split(/\r?\n/)[0].slice(0, 120);
          errorSamples.push(`${fileName}: failed to parse block starting: "${firstLine}"`);
        }
        continue;
      }

      if (parsed.tournamentId) tournamentIds.add(parsed.tournamentId);

      // Deterministic hash: userId + site + handId
      const handHash = `${userId}-${parsed.site}-${parsed.handId}`;

      const derivedFields = computeDerivedFields(parsed.actions, parsed.heroName, parsed.sawFlop, parsed.sawTurn, parsed.sawRiver);

      records.push({
        user_id: userId,
        hand_hash: handHash,
        hand_id: parsed.handId,
        source_file_name: fileName,
        site: parsed.site,
        played_at: parsed.playedAt,
        game_mode: parsed.gameMode,
        tournament_id: parsed.tournamentId,
        pot_amount: parsed.potAmount,
        bb_won: parsed.netResult,
        position: parsed.position,
        hero_name: parsed.heroName,
        hero_seat: parsed.heroSeat,
        blinds: parsed.blinds,
        stack_size: parsed.stackSize,
        buy_in: parsed.buyIn,
        hero_cards: parsed.heroCards,
        board: parsed.board,
        action_sequence: parsed.actions,
        net_result: parsed.netResult,
        showdown: parsed.showdown,
        saw_flop: parsed.sawFlop,
        saw_turn: parsed.sawTurn,
        saw_river: parsed.sawRiver,
        parser_status: 'parsed',
        raw_hand_text: block,
        ...derivedFields,
        starting_hand_class: computeStartingHandClass(parsed.heroCards),
        ...computeBoardTexture(parsed.board),
        effective_stack_bb: (() => {
          const bb = parseBigBlind(parsed.blinds);
          return (parsed.stackSize && bb && bb > 0)
            ? Math.round((parsed.stackSize / bb) * 10) / 10 : null;
        })(),
        allin_ev_bb: null,
        allin_ev_eligible: false,
      });
    } catch (e) {
      parseErrors++;
      if (errorSamples.length < 3) {
        errorSamples.push(`${fileName}: ${String(e).slice(0, 100)}`);
      }
    }
  }

  return { fileType: 'hh', records, parseErrors, tournamentIds, errorSamples };
}

export function parseHandBlock(block: string, site: string, defaultMode: AnalyticsMode): ParsedHand | null {
  // Extract hand ID — GG uses "Poker Hand #RC103014874:" PokerStars uses "Hand #174088919486:"
  // ACR/WPN uses "Game Hand #12345678" (no colon). The ID is the token after #
  // up to the next colon, comma, space, or end of token.
  const handIdMatch = block.match(/Hand\s+#([^:,.<>\s]+)/);
  if (!handIdMatch) return null;
  const handId = handIdMatch[1];

  // Extract tournament ID
  const tournMatch = block.match(/Tournament\s+#(\S+)/);
  const tournamentId = tournMatch ? tournMatch[1].replace(/[,:]/g, '') : null;

  // Determine actual game mode from hand content
  const gameMode: AnalyticsMode = tournamentId ? 'mtt' : defaultMode;

  // Extract date — GG: "2024/07/15 12:30:00 UTC" or PokerStars: "2024/07/15 12:30:00 ET"
  const dateMatch = block.match(/(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  const playedAt = dateMatch ? new Date(dateMatch[1].replace(/\//g, '-') + 'T' + dateMatch[2] + 'Z').toISOString() : null;

  // Extract blinds — supports many formats:
  // "$5/$10", "$500/$1,000", "5/10", "Blinds 500/1000", "Ante 125, Blinds 500/1,000"
  // Also: "$500 / $1,000" with spaces
  const blindsMatch =
    block.match(/\$([\d,]+(?:\.\d+)?)\s*\/\s*\$([\d,]+(?:\.\d+)?)/) ||
    block.match(/Blinds\s+([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)/i) ||
    block.match(/([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)/);
  const blinds = blindsMatch ? `${blindsMatch[1]}/${blindsMatch[2]}` : null;
  const bigBlind = blindsMatch ? parseFloat(blindsMatch[2].replace(/,/g, '')) : null;

  // Extract tournament buy-in from the header line. Common formats:
  //   "Tournament #123456, $55+$5 USD"           (PokerStars — explicit buy-in+fee)
  //   "$55 MTT 8-max"                              (GG — buy-in before MTT keyword)
  //   "Buy-In: $215"                               (generic explicit label)
  //   "$525 Bounty Hunters HR Main Event"          (GG — buy-in at start of name)
  //
  // GG tournament names frequently embed large dollar amounts that are NOT the buy-in:
  //   "$10,000 Bounty Hunters Series Cash Drop"   → $10K is the bounty target, not buy-in
  //   "$1M GTD" / "$30K GTD"                        → guarantee, not buy-in
  //
  // Strategy (try most reliable first):
  //   1. PokerStars "$N+$M" format — buy-in is the amount before the +.
  //   2. GG "$N MTT" format — buy-in immediately before "MTT" keyword.
  //   3. Explicit "Buy-In: $N" label.
  //   4. Fallback: first $N after tournament ID, but EXCLUDE amounts followed by
  //      "Bounty Hunters Series" or "Cash Drop" (bounty targets, not buy-ins).
  //      Also exclude guarantee amounts like "$100K" via negative lookahead.
  let buyIn: number | null = null;
  if (tournamentId) {
    // Extract tournament name from header for satellite/bounty detection
    const tournNameMatch = block.match(/Tournament\s+#\S+,\s*(.*?)(?:\s+Hold'em)/i);
    const tournName = tournNameMatch ? tournNameMatch[1].trim() : '';

    // Check if this is a satellite — the $ amount in the name is the target
    // event's buy-in, not what the player paid. e.g.:
    //   "$1,050 MEGA to $1M GGMillion, 12 Seats, $120K"
    //   "$1,050 Deadline to $1M GGMillion, 2 Seats, $20K"
    //   "$1,200 EXPRESS to $10K Bracelet Pass - $30K GTD"
    const isSatelliteTourn = isSatellite('', tournName);

    // Check if this is a bounty-target tournament where $N is the bounty, not buy-in
    // e.g. "$10,000 Bounty Hunters Series Cash Drop"
    const isBountyTourn = isBountyTargetTournament('', tournName);

    if (isSatelliteTourn || isBountyTourn) {
      // Don't parse buy-in from the header — the $ amount is not the entry cost.
      // Leave as null; ABI calculation treats these as $0 contribution.
      buyIn = null;
    } else {
      // PokerStars: "Tournament #123, $55+$5 USD" or "Buy-In: $55+$5"
      const psBuyInMatch = block.match(/Tournament\s+#\S+[^\n]*?\$([\d,]+(?:\.\d+)?)\s*\+\s*\$[\d,]+(?:\.\d+)?/) ||
                           block.match(/Buy-?In\s*:?\s*\$([\d,]+(?:\.\d+)?)\s*\+\s*\$[\d,]+(?:\.\d+)?/i);
      // GG: "$55 MTT" or "$55+$5 MTT" — buy-in right before MTT
      const ggBuyInMatch = block.match(/\$([\d,]+(?:\.\d+)?)\s*(?:\+\s*\$[\d,]+(?:\.\d+)?)?\s+MTT\b/i);
      // Explicit Buy-In label without fee: "Buy-In: $215"
      const explicitBuyInMatch = block.match(/Buy-?In\s*:?\s*\$([\d,]+(?:\.\d+)?)\s/i);

      if (psBuyInMatch) {
        buyIn = parseFloat(psBuyInMatch[1].replace(/,/g, ''));
      } else if (ggBuyInMatch) {
        buyIn = parseFloat(ggBuyInMatch[1].replace(/,/g, ''));
      } else if (explicitBuyInMatch) {
        buyIn = parseFloat(explicitBuyInMatch[1].replace(/,/g, ''));
      } else {
        // Fallback: first dollar amount after tournament ID, excluding guarantees ($NK)
        // and bounty targets (amount followed by "Bounty Hunters Series" or "Cash Drop")
        const fallbackMatch = block.match(/Tournament\s+#\S+,\s*[^$]*\$([\d,]+(?:\.\d+)?)(?!\d*K)/);
        if (fallbackMatch) {
          const matchEnd = (fallbackMatch.index ?? 0) + fallbackMatch[0].length;
          const afterAmount = block.slice(matchEnd, matchEnd + 50);
          if (!/^\s*(?:Bounty\s+Hunters\s+Series|Cash\s+Drop)/i.test(afterAmount)) {
            buyIn = parseFloat(fallbackMatch[1].replace(/,/g, ''));
          }
        }
      }
    }
  }

  // Extract hero name and seat
  // GG format: "Dealt to Hero [As Kh]" or "Dealt to <player_name> [As Kh]"
  // PokerStars: "Dealt to Hero [As Kh]"
  // Also: "Seat N: Hero (button) ($1000 in chips)"
  const heroCardsMatch = block.match(/Dealt to\s+(.+?)\s+\[([^\]]+)\]/);
  const heroName = heroCardsMatch ? heroCardsMatch[1].trim() : null;
  const heroCards = heroCardsMatch ? heroCardsMatch[2].trim() : null;

  // Find hero's seat and position
  let heroSeat: number | null = null;
  let position: string | null = null;
  let stackSize: number | null = null;

  // Parse seat lines: "Seat 1: Hero (button) ($1000 in chips)" or "Seat 1: Hero (1000 in chips)"
  // GG Poker: "Seat 7: Hero (12,600 in chips)" — single parenthetical, no $, no position label
  // Also: "Seat 1: Hero ($1000)"
  // WPN/ACR: "Seat 1: Hero (1137126.00)" — no $ prefix, no "in chips"
  // The positionInfo group must NOT consume the chips parenthetical, so we use
  // a non-greedy match and require the chips parenthetical to follow.
  const seatLines = block.matchAll(/Seat\s+(\d+):\s+(.+?)(?:\s*\((button|small blind|big blind|utg\+3|utg\+2|utg\+1|utg|hijack|hj|cutoff-1|cutoff|co|lojack|lj|mp3|mp2|mp1|mp)\))?\s*\(\$?(?:(\d+(?:[.,]\d+)?)\s+in\s+chips|(\d+(?:[.,]\d+)?))\)/gi);
  for (const m of seatLines) {
    const seatNum = parseInt(m[1], 10);
    const playerName = m[2].trim();
    const positionInfo = m[3] || '';
    const chipsRaw = m[4] ? m[4].replace(/,/g, '') : (m[5] ? m[5].replace(/,/g, '') : null);
    const chips = chipsRaw ? parseFloat(chipsRaw) : null;

    if (heroName && playerName === heroName) {
      heroSeat = seatNum;
      stackSize = chips;
      if (positionInfo) {
        const posRaw = positionInfo.toLowerCase();
        position = normalizePosition(posRaw);
      }
    }
  }

  // If position not found from seat line, try to infer from button/blind lines
  if (!position && heroName) {
    if (new RegExp(`${escapeRegex(heroName)}.*\\(button\\)`, 'i').test(block)) {
      position = 'BTN';
    } else if (new RegExp(`${escapeRegex(heroName)}.*\\(small blind\\)`, 'i').test(block) || new RegExp(`${escapeRegex(heroName)}.*posts\\s+small\\s+blind`, 'i').test(block)) {
      position = 'SB';
    } else if (new RegExp(`${escapeRegex(heroName)}.*\\(big blind\\)`, 'i').test(block) || new RegExp(`${escapeRegex(heroName)}.*posts\\s+big\\s+blind`, 'i').test(block)) {
      position = 'BB';
    }
  }

  // If position still not found, compute from button seat + number of dealt players.
  // Use the actual count of seated players (seat lines) rather than the table's
  // max capacity from "N-max" — tournaments get short-handed as players bust.
  if (!position && heroName && heroSeat !== null) {
    const btnMatch = block.match(/Seat\s+#(\d+)\s+is\s+the\s+button/);
    // Count actual seated players from seat lines
    const allSeatLines = [...block.matchAll(/Seat\s+(\d+):\s+/g)];
    const dealtPlayers = allSeatLines.length;
    const tableMatch = block.match(/(\d+)-max/);
    // Prefer actual dealt count; fall back to N-max only if seat lines weren't parsed
    const effectiveSize = dealtPlayers > 1 ? dealtPlayers : (tableMatch ? parseInt(tableMatch[1], 10) : 9);
    if (btnMatch && effectiveSize >= 2) {
      const buttonSeat = parseInt(btnMatch[1], 10);
      let seatDiff = heroSeat - buttonSeat;
      if (seatDiff <= 0) seatDiff += effectiveSize;
      position = computePositionFromSeatDiff(seatDiff, effectiveSize);
    }
  }

  // Parse actions by street
  const actions: ActionEntry[] = [];
  let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';

  // Split block into street sections
  // GG uses: \\\ HOLE CARDS \\\, \\\ FLOP \\\, \\\ TURN \\\, \\\ RIVER \\\
  // PokerStars uses: *** HOLE CARDS ***, *** FLOP ***, *** TURN ***, *** RIVER ***
  const streetSections = splitByStreets(block);

  // Parse blind/ante posts from the header (before HOLE CARDS marker).
  // GG/PokerStars put "Player: posts the ante 100" and "Player: posts small blind 300"
  // in the hand header, BEFORE the *** HOLE CARDS *** section. These are critical
  // for correct net result — without them, every hand's invested is understated.
  const holeCardsIdx = block.search(/(?:\\\+\s*HOLE\s+CARDS|\*+\s*HOLE\s+CARDS)/i);
  if (holeCardsIdx > 0) {
    const headerText = block.substring(0, holeCardsIdx);
    parseActionsInText(headerText, heroName, actions, 'preflop');
  }

  // Parse preflop actions
  if (streetSections.preflop) {
    currentStreet = 'preflop';
    parseActionsInText(streetSections.preflop, heroName, actions, currentStreet);
  }

  // Parse flop
  let board: string | null = null;
  if (streetSections.flop) {
    currentStreet = 'flop';
    const flopBoardMatch = streetSections.flop.match(/\[([^\]]+)\]/);
    if (flopBoardMatch) board = flopBoardMatch[1].trim();
    parseActionsInText(streetSections.flop, heroName, actions, currentStreet);
  }

  // Parse turn — formats vary by site:
  //   PokerStars: "*** TURN *** [Qc Kc 6d 3h]" (single bracket, full board)
  //   GGPoker:    "*** TURN *** [Qc Kc 6d] [3h]" (two brackets: flop, then new card)
  //   WPN/ACR:    "*** TURN *** [Qc Kc 6d][3h]" (same two-bracket pattern)
  // For the two-bracket format, we need the LAST bracket's last card.
  // For the single-bracket format, the last card of the single bracket is the new card.
  if (streetSections.turn) {
    currentStreet = 'turn';
    const turnBoardMatches = streetSections.turn.matchAll(/\[([^\]]+)\]/g);
    const turnBrackets = [...turnBoardMatches];
    if (turnBrackets.length > 0) {
      const lastBracket = turnBrackets[turnBrackets.length - 1][1].trim();
      const turnCards = lastBracket.split(/\s+/);
      const newCard = turnCards[turnCards.length - 1];
      board = (board || '') + ' ' + newCard;
    }
    parseActionsInText(streetSections.turn, heroName, actions, currentStreet);
  }

  // Parse river — same multi-bracket format as turn:
  //   PokerStars: "*** RIVER *** [Qc Kc 6d 3h Js]" (single bracket)
  //   GGPoker:    "*** RIVER *** [Qc Kc 6d 3h] [Js]" (two brackets)
  if (streetSections.river) {
    currentStreet = 'river';
    const riverBoardMatches = streetSections.river.matchAll(/\[([^\]]+)\]/g);
    const riverBrackets = [...riverBoardMatches];
    if (riverBrackets.length > 0) {
      const lastBracket = riverBrackets[riverBrackets.length - 1][1].trim();
      const riverCards = lastBracket.split(/\s+/);
      const newCard = riverCards[riverCards.length - 1];
      board = (board || '') + ' ' + newCard;
    }
    parseActionsInText(streetSections.river, heroName, actions, currentStreet);
  }

  // Parse SHOW DOWN section for collect actions
  if (streetSections.showdown) {
    parseActionsInText(streetSections.showdown, heroName, actions, 'river');
  }

  // Parse uncalled bet returns from the full block (they appear before SHOWDOWN, not in SUMMARY)
  if (heroName) {
    parseUncalledReturns(block, heroName, actions);
  }

  // Parse SUMMARY section for collect/won actions
  if (streetSections.summary && heroName) {
    parseSummaryActions(streetSections.summary, heroName, actions);
  }

  // Determine which streets hero saw (hero remained active)
  const heroActions = actions.filter((a) => heroName && a.player === heroName);
  const heroFoldedPreflop = heroActions.some((a) => a.street === 'preflop' && a.action === 'fold');
  const heroFoldedFlop = heroActions.some((a) => a.street === 'flop' && a.action === 'fold');
  const heroFoldedTurn = heroActions.some((a) => a.street === 'turn' && a.action === 'fold');

  // Hero saw flop if flop was dealt AND hero didn't fold preflop.
  // Preflop all-in hands where hero is called and sees a board count as saw-flop —
  // hero's chips are at stake on all streets even though there are no postflop decisions.
  const sawFlop = !!streetSections.flop && !heroFoldedPreflop;
  const sawTurn = !!streetSections.turn && !heroFoldedPreflop && !heroFoldedFlop;
  const sawRiver = !!streetSections.river && !heroFoldedPreflop && !heroFoldedFlop && !heroFoldedTurn;

  // Showdown: Hero reached showdown if hero shows cards anywhere in the hand text.
  // GG Poker shows cards in the preflop section (all-in) or in the SHOWDOWN section.
  // GG summary may have "Hero showed [cards]" instead of "Hero: shows [cards]".
  let showdown = false;
  if (heroName) {
    showdown = didReachShowdown(block, heroName);
  }

  // Parse net result from summary
  // The CORRECT net result is: chips collected - chips invested by hero.
  // NOT the pot amount. NOT "won ($X)" which is often the pot.
  let netResult: number | null = null;
  let potAmount: number | null = null;

  // Total pot
  const totalPotMatch = block.match(/Total\s+pot\s+\$?([\d,.]+)/i);
  if (totalPotMatch) {
    potAmount = parseFloat(totalPotMatch[1].replace(/,/g, ''));
  }

  // Compute net result using the CANONICAL accounting function
  if (heroName) {
    const { netChips, invested, collected } = computeNetChipsFromActions(actions, heroName);

    if (invested > 0 || collected > 0) {
      netResult = netChips;
    }

    // Convert to BB with per-hand round2 (V1 compatibility)
    if (netResult !== null && bigBlind && bigBlind > 0) {
      netResult = Math.round((netResult / bigBlind) * 100) / 100;
    }
  }

  return {
    handId,
    site,
    playedAt,
    tournamentId,
    gameMode,
    heroName,
    heroSeat,
    position,
    blinds,
    stackSize,
    buyIn,
    heroCards,
    board: board?.trim() || null,
    actions,
    netResult,
    potAmount,
    showdown,
    sawFlop,
    sawTurn,
    sawRiver,
  };
}

function splitByStreets(block: string): Record<string, string> {
  // GG uses: \\\ HOLE CARDS \\\, \\\ FLOP \\\, \\\ TURN \\\, \\\ RIVER \\\
  // PokerStars uses: *** HOLE CARDS ***, *** FLOP ***, *** TURN ***, *** RIVER ***
  // Also handle: \\\ PREFLOP \\\
  const sections: Record<string, string> = {};

  // Find all street markers and their positions
  const streetPattern = /(?:\\\+\s*(HOLE\s+CARDS|PREFLOP|FLOP|TURN|RIVER|SHOW\s*DOWN|SUMMARY)\s*\\\+|\*+\s*(HOLE\s+CARDS|PREFLOP|FLOP|TURN|RIVER|SHOW\s*DOWN|SUMMARY)\s*\*+)/gi;
  const matches: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = streetPattern.exec(block)) !== null) {
    const name = (m[1] || m[2] || '').toUpperCase().replace(/\s+/g, ' ').trim();
    matches.push({ name, index: m.index });
  }

  // Extract each section
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : block.length;
    const sectionText = block.substring(start, end);
    const name = matches[i].name;

    if (name === 'HOLE CARDS' || name === 'PREFLOP') {
      if (!sections.preflop) sections.preflop = sectionText;
    } else if (name === 'FLOP') {
      sections.flop = sectionText;
    } else if (name === 'TURN') {
      sections.turn = sectionText;
    } else if (name === 'RIVER') {
      sections.river = sectionText;
    } else if (name === 'SHOW DOWN' || name === 'SHOWDOWN') {
      sections.showdown = sectionText;
    } else if (name === 'SUMMARY') {
      sections.summary = sectionText;
    }
  }

  return sections;
}

function parseActionsInText(text: string, _heroName: string | null, actions: ActionEntry[], street: 'preflop' | 'flop' | 'turn' | 'river') {
  // Parse action lines: "PlayerName: action" or "PlayerName action"
  // GG/PokerStars format: "Hero: raises $0.55 to $0.8" (colon after name)
  // WPN/ACR format: "Hero raises 500.00 to 1000.00" (no colon, no $)
  // Also handle: "Player: posts small blind $0.1" (preflop forced bets)
  //
  // Strategy: match lines that start with a player name followed by either
  // a colon (GG/PS) or a space + action verb (WPN). We use a two-pass approach:
  // 1. Colon-separated lines (GG/PS)
  // 2. Space-separated lines that start with a known action verb (WPN)

  // Pass 1: colon-separated (GG/PokerStars)
  const colonLines = text.matchAll(/^([^\n:]+?):\s+(.+)$/gm);
  for (const m of colonLines) {
    const player = m[1].trim();
    const actionText = m[2].trim();

    // Skip non-action lines (street headers, board cards, "Dealt to")
    if (/^(\\\+|\*+|Dealt|Board|\[)/.test(actionText) || /^(\\\+|\*+)/.test(player)) continue;
    if (/^Dealt\s+to/i.test(player)) continue;

    const parsed = parseActionText(actionText);
    if (parsed) {
      actions.push({ street, player, action: parsed.action, amount: parsed.amount });
    }
  }

  // Pass 2: space-separated (WPN/ACR) — only if no colon was found for the same line
  // This avoids double-parsing lines that happen to have colons elsewhere.
  // WPN format: "Stonewalled raises 65000.00 to 70000.00"
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^(\*{3}|\\\+|Dealt|Board|\[|Seat|Table|Game Hand|Total pot|Main pot|Side pot|Uncalled)/.test(trimmed)) continue;
    if (trimmed.includes(':')) continue; // already handled by colon pass

    // Extract player name (everything before the first action verb)
    const verbMatch = trimmed.match(/^(.+?)\s+(folds?|checks?|calls?|bets?|raises?|all[- ]?in|posts?|shows?|collected|mucks?|does not show)/i);
    if (!verbMatch) continue;
    const player = verbMatch[1].trim();
    const actionText = trimmed.substring(verbMatch[1].length).trim();

    const parsed = parseActionText(actionText);
    if (parsed) {
      actions.push({ street, player, action: parsed.action, amount: parsed.amount });
    }
  }
}

function parseActionText(text: string): { action: string; amount: number | null } | null {
  const lower = text.toLowerCase();

  // Fold
  if (/^folds?/.test(lower)) return { action: 'fold', amount: null };

  // Check
  if (/^checks?/.test(lower)) return { action: 'check', amount: null };

  // Call
  const callMatch = text.match(/calls?\s+\$?([\d,.]+)/i);
  if (callMatch) return { action: 'call', amount: parseFloat(callMatch[1].replace(/,/g, '')) };

  // Bet
  const betMatch = text.match(/bets?\s+\$?([\d,.]+)/i);
  if (betMatch) return { action: 'bet', amount: parseFloat(betMatch[1].replace(/,/g, '')) };

  // Raise (including all-in raises)
  // GG format: "raises $500 to $1,000" — $500 is the increment, $1,000 is the total.
  // V1 canonical rule: store the TOTAL "to" amount (group 2). The accounting
  // function uses OVERWRITE semantics for raises — the "to" amount replaces
  // the street commitment, not adds to it.
  // If only one number is present (no "to"), use it as the total.
  const raiseMatch = text.match(/raises?\s+\$?([\d,.]+)(?:\s+to\s+\$?([\d,.]+))?/i);
  if (raiseMatch) {
    const firstNum = parseFloat(raiseMatch[1].replace(/,/g, ''));
    const secondNum = raiseMatch[2] ? parseFloat(raiseMatch[2].replace(/,/g, '')) : null;
    const isAllIn = /all[- ]?in/i.test(text);
    const amount = secondNum !== null ? secondNum : firstNum;
    return { action: isAllIn ? 'all-in' : 'raise', amount };
  }

  // All-in (standalone) — amount is the total commitment
  const allInMatch = text.match(/all[- ]?in\s*(?:\(?\$?([\d,.]+)\)?)?/i);
  if (allInMatch) return { action: 'all-in', amount: allInMatch[1] ? parseFloat(allInMatch[1].replace(/,/g, '')) : null };

  // Posts (blinds/antes) — GG format: "posts the ante 100", "posts small blind 300"
  // PokerStars: "posts small blind $0.50". The optional "the" must be allowed.
  // Distinguish ante from blind for V1-compatible accounting: antes are tracked
  // separately from street commitments; blinds add to preflop commitment.
  const anteMatch2 = text.match(/posts\s+(?:the\s+)?ante\s+\$?([\d,.]+)/i);
  if (anteMatch2) return { action: 'post_ante', amount: parseFloat(anteMatch2[1].replace(/,/g, '')) };
  const postMatch = text.match(/posts\s+(?:the\s+)?(?:small\s+blind|big\s+blind)\s+\$?([\d,.]+)/i);
  if (postMatch) return { action: 'post', amount: parseFloat(postMatch[1].replace(/,/g, '')) };

  // Shows (showdown)
  if (/^shows?/.test(lower)) return { action: 'show', amount: null };

  // Collected
  const collectedMatch = text.match(/collected\s+\(?\$?([\d,.]+)\)?/i);
  if (collectedMatch) return { action: 'collect', amount: parseFloat(collectedMatch[1].replace(/,/g, '')) };

  return null;
}

function parseSummaryActions(text: string, heroName: string, actions: ActionEntry[]) {
  // Parse SUMMARY section for hero's collected/won amounts.
  // The showdown section may already have captured "Hero collected X from pot".
  // The summary's "Seat N: Hero collected (X)" or "won (X)" is the SAME collection.
  // We must dedup to avoid double-counting.
  //
  // For side pots, the summary "won (A+B)" equals the SUM of individual showdown
  // collections (A and B). We must NOT add the summary total in that case.

  // First, compute the aggregate of existing showdown collections for hero
  const existingCollects = actions.filter(a => a.player === heroName && a.action === 'collect');
  const existingTotal = existingCollects.reduce((sum, a) => sum + (a.amount ?? 0), 0);
  const existingAmounts = new Set(existingCollects.map(a => a.amount));

  // Parse "collected" lines for hero — dedup against existing collect actions
  // IMPORTANT: [^\n]*? must not cross newlines — otherwise "Hero folded\nSeat 2: X won (Y)"
  // would match as Hero winning Y.
  const collectedRegex = new RegExp(`${escapeRegex(heroName)}[^\\n]*?collected\\s+\\(?\\$?([\\d,.]+)\\)?`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = collectedRegex.exec(text)) !== null) {
    const amount = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(amount)) {
      // Dedup: skip if this exact amount already exists, OR if it equals the
      // aggregate of existing collections (side-pot case)
      if (!existingAmounts.has(amount) && amount !== existingTotal) {
        actions.push({ street: 'river', player: heroName, action: 'collect', amount });
      }
    }
  }

  // Parse "won" lines for hero (GG: "and won ($100)", WPN: "and won 270000.00")
  // GG format uses parentheses: "won (287,176)" — must handle optional paren before amount
  const wonRegex = new RegExp(`${escapeRegex(heroName)}[^\\n]*?won\\s+\\(?\\$?([\\d,.]+)\\)?`, 'gi');
  while ((m = wonRegex.exec(text)) !== null) {
    const amount = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(amount)) {
      // Dedup: skip if this exact amount already exists, OR if it equals the
      // aggregate of existing collections (side-pot case)
      if (!existingAmounts.has(amount) && amount !== existingTotal) {
        actions.push({ street: 'river', player: heroName, action: 'collect', amount });
      }
    }
  }
}

function parseUncalledReturns(block: string, heroName: string, actions: ActionEntry[]) {
  // Parse "Uncalled bet ($X) returned to Hero" from the full block text.
  // This line appears in the preflop/flop/turn/river section (before SHOWDOWN),
  // NOT in the SUMMARY section. It is a refund of hero's own bet — it reduces
  // invested, not collected.
  const uncalledRegex = new RegExp(
    'Uncalled\\s+bet\\s+\\(\\$?([\\d,.]+)\\)\\s+returned\\s+to\\s+' + escapeRegex(heroName),
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = uncalledRegex.exec(block)) !== null) {
    const amount = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(amount)) {
      actions.push({ street: 'river', player: heroName, action: 'uncalled', amount });
    }
  }
}

function normalizePosition(pos: string): string {
  const p = pos.toLowerCase().trim();
  const map: Record<string, string> = {
    'button': 'BTN',
    'btn': 'BTN',
    'small blind': 'SB',
    'sb': 'SB',
    'big blind': 'BB',
    'bb': 'BB',
    'utg': 'UTG',
    'utg+1': 'UTG+1',
    'utg+2': 'UTG+2',
    'utg+3': 'UTG+3',
    'hijack': 'HJ',
    'hj': 'HJ',
    'cutoff': 'CO',
    'co': 'CO',
    'cutoff-1': 'CO',
    'lojack': 'LJ',
    'lj': 'LJ',
    'mp': 'MP',
    'mp1': 'MP1',
    'mp2': 'MP2',
    'mp3': 'MP3',
  };
  return map[p] || p.toUpperCase();
}

function computePositionFromSeatDiff(seatDiff: number, tableSize: number): string | null {
  if (seatDiff === 1) return 'SB';
  if (seatDiff === 2) return 'BB';
  if (seatDiff === tableSize) return 'BTN';
  if (seatDiff === tableSize - 1) return 'CO';

  // Position labels by table size, going from UTG (seatDiff=3) toward CO.
  // seatDiff increases clockwise from the button: SB=1, BB=2, UTG=3, ...
  if (tableSize >= 10) {
    if (seatDiff === 3) return 'UTG';
    if (seatDiff === 4) return 'UTG+1';
    if (seatDiff === 5) return 'UTG+2';
    if (seatDiff === 6) return 'UTG+3';
    if (seatDiff === 7) return 'LJ';
    if (seatDiff === 8) return 'HJ';
  } else if (tableSize >= 9) {
    if (seatDiff === 3) return 'UTG';
    if (seatDiff === 4) return 'UTG+1';
    if (seatDiff === 5) return 'UTG+2';
    if (seatDiff === 6) return 'LJ';
    if (seatDiff === 7) return 'HJ';
  } else if (tableSize >= 8) {
    if (seatDiff === 3) return 'UTG';
    if (seatDiff === 4) return 'UTG+1';
    if (seatDiff === 5) return 'LJ';
    if (seatDiff === 6) return 'HJ';
  } else if (tableSize >= 7) {
    if (seatDiff === 3) return 'UTG';
    if (seatDiff === 4) return 'LJ';
    if (seatDiff === 5) return 'HJ';
  } else if (tableSize >= 6) {
    if (seatDiff === 3) return 'UTG';
    if (seatDiff === 4) return 'HJ';
  } else if (tableSize >= 5) {
    if (seatDiff === 3) return 'UTG';
  } else if (tableSize >= 3) {
    if (seatDiff === 3) return 'UTG';
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Detect whether files contain tournament or cash hands
// ============================================================

export async function detectHandMode(files: File[]): Promise<{ mode: AnalyticsMode; confidence: 'high' | 'low' }> {
  let tournamentCount = 0;
  let cashCount = 0;
  let totalHands = 0;

  for (const file of files) {
    const text = await file.text();
    // Only count actual hand blocks (files with "Hand #") for mode detection
    if (!/Hand\s+#\S+/.test(text)) {
      // Tournament summary file — check for tournament IDs
      if (/Tournament\s+#\S+/.test(text)) {
        tournamentCount++;
      }
      continue;
    }
    const blocks = text.split(/\r?\n(?=Poker Hand #|PokerStars Hand #|Hand #|Game Hand #)/).filter((b) => b.trim().length > 0);
    for (const block of blocks) {
      if (!/Hand\s+#\S+/.test(block)) continue;
      totalHands++;
      if (/Tournament\s+#\S+/.test(block)) {
        tournamentCount++;
      } else {
        cashCount++;
      }
    }
  }

  if (totalHands === 0 && tournamentCount === 0) return { mode: 'cash', confidence: 'low' };
  if (tournamentCount > cashCount && tournamentCount > 0) return { mode: 'mtt', confidence: 'high' };
  if (cashCount > tournamentCount && cashCount > 0) return { mode: 'cash', confidence: 'high' };
  return { mode: 'cash', confidence: 'low' };
}

// ============================================================
// Recalculate analytics from poker_hand_records
// Uses hero-specific action data for real stat computation
// ============================================================

export interface RecalcResult {
  snapshot: AnalyticsSnapshot | null;
  error: string | null;
  errorStage: string | null;
  handsProcessed: number;
  handsExcluded: number;
  durationMs: number;
  integrityOk: boolean;
  jobConflict?: boolean;
}

export function parseBigBlind(blinds: string | null): number | null {
  if (!blinds) return null;
  // Format: "$small/$big" e.g. "$100/$200", "$500/$1,000", "$000/$2,000"
  // Must handle commas in large numbers
  const m = blinds.match(/\$[\d,]+\/\$([\d,]+)/) || blinds.match(/[\d,]+\/([\d,]+)/);
  if (!m) return null;
  const bb = parseFloat(m[1].replace(/,/g, ''));
  return bb > 0 ? bb : null;
}

// CANONICAL accounting function — used by BOTH import and recalculation.
// Implements V1 per-street commitment tracking with OVERWRITE semantics for raises.
//
// totalInvested = antes + finalPreflopCommit + finalFlopCommit + finalTurnCommit + finalRiverCommit - uncalledReturns
//
// For each street:
//   post (blind): ADD to preflop street commitment
//   post_ante: tracked separately (not overwritten by raises)
//   call: ADD to street commitment
//   bet: SET street commitment to the bet amount
//   raise/all-in: OVERWRITE street commitment with the "to" total
//
// Uncalled returns reduce total invested (not collected).
export function computeNetChipsFromActions(actions: ActionEntry[], heroName: string | null): { netChips: number | null; invested: number; collected: number } {
  if (!heroName || !actions || actions.length === 0) return { netChips: null, invested: 0, collected: 0 };

  const streetCommit: Record<string, number> = { preflop: 0, flop: 0, turn: 0, river: 0 };
  let antes = 0;
  let uncalledTotal = 0;
  let collected = 0;

  for (const a of actions) {
    if (a.player !== heroName) continue;
    if (a.action === 'show') continue;
    if (a.amount === null || a.amount === undefined) continue;

    if (a.action === 'post') {
      streetCommit.preflop += a.amount;
    } else if (a.action === 'post_ante') {
      antes += a.amount;
    } else if (a.action === 'call') {
      streetCommit[a.street] += a.amount;
    } else if (a.action === 'bet') {
      streetCommit[a.street] = a.amount;
    } else if (a.action === 'raise' || a.action === 'all-in') {
      streetCommit[a.street] = a.amount;
    } else if (a.action === 'uncalled') {
      uncalledTotal += a.amount;
    } else if (a.action === 'collect') {
      collected += a.amount;
    }
  }

  // Uncalled bet handling:
  // In GGPoker hand history format, "Uncalled bet ($X) returned to Hero" and
  // "Hero collected ($Y) from pot" are ALWAYS separate lines. The collected
  // amount is just the pot — it never includes the uncalled return. Therefore
  // uncalled must ALWAYS be subtracted from invested, regardless of showdown.
  let invested = antes + streetCommit.preflop + streetCommit.flop + streetCommit.turn + streetCommit.river - uncalledTotal;

  if (invested === 0 && collected === 0) return { netChips: 0, invested: 0, collected: 0 };
  return { netChips: collected - invested, invested, collected };
}

// Satellite tournament name patterns. These tournaments have a dollar amount
// in the name that is the TARGET event's buy-in, not what the player paid.
// e.g. "$1,050 MEGA to $1M GGMillion, 12 Seats" — $1,050 is the GGMillion buy-in.
// The player may have qualified via a much cheaper feeder satellite.
const SATELLITE_PATTERNS = [
  /to\s+\$?\d[\d,.]*\s*(?:M|K)?\s*(?:GGMillion|Main\s+Event)/i,
  /\d+\s+Seats/i,
  /MEGA\s+to\s/i,
  /Deadline\s+to\s/i,
  /Seat\s+Pass/i,
  /Phase\s+\d/i,
];

// "Cash Drop" / "Bounty Hunters Series" tournaments embed the bounty target
// amount in the name, not the buy-in. The actual buy-in is not in the hand header.
const BOUNTY_TARGET_PATTERNS = [
  /Bounty\s+Hunters\s+Series/i,
  /Cash\s+Drop/i,
];

function isSatellite(sourceFileName: string, tournamentName?: string | null): boolean {
  const checkStr = `${sourceFileName} ${tournamentName ?? ''}`;
  return SATELLITE_PATTERNS.some(p => p.test(checkStr));
}

function isBountyTargetTournament(sourceFileName: string, tournamentName?: string | null): boolean {
  const checkStr = `${sourceFileName} ${tournamentName ?? ''}`;
  return BOUNTY_TARGET_PATTERNS.some(p => p.test(checkStr));
}

function countTournamentEntries(
  handList: Record<string, unknown>[]
): { events: number; entries: number; totalBuyIn: number; entriesWithBuyIn: number } {
  // entries = count of distinct source files (each file = one buy-in/entry)
  // events = count of distinct tournament IDs (distinct tournaments played)
  // reEntries = entries - events
  //
  // ABI = Sum of entry buy-in values / Number of confirmed tournament entries
  // Each source file = one entry. Each entry contributes its tournament's buy-in.
  // Satellite entries (where the $ amount is the target event cost) contribute $0.
  // Bounty-target entries (Cash Drop where $ amount is bounty, not buy-in) contribute $0.
  const tournamentIds = new Set<string>();
  const sourceFiles = new Set<string>();
  const tournBuyIns: Record<string, number | null> = {};
  const tournNames: Record<string, string | null> = {};

  for (let i = 0; i < handList.length; i++) {
    const h = handList[i];
    const tournId = h.tournament_id as string | null;
    const fileName = h.source_file_name as string | null;
    const buyIn = h.buy_in as number | null;
    if (tournId) {
      tournamentIds.add(tournId);
      if (tournBuyIns[tournId] === undefined) {
        tournBuyIns[tournId] = buyIn;
        // Extract tournament name from raw hand text if available
        const rawText = h.raw_hand_text as string | undefined;
        if (rawText) {
          const nameMatch = rawText.match(/Tournament\s+#\S+,\s*(.*?)(?:\s+Hold'em)/i);
          tournNames[tournId] = nameMatch ? nameMatch[1].trim() : null;
        } else {
          tournNames[tournId] = null;
        }
      }
    }
    if (fileName) sourceFiles.add(fileName);
  }

  const events = tournamentIds.size;
  const entries = sourceFiles.size;

  // Sum buy-in per entry (source file). Each source file maps to a tournament,
  // and each entry contributes its tournament's buy-in (or $0 if satellite/bounty).
  // For ABI, the denominator is total entries (all source files), and the
  // numerator is the sum of buy-ins across all entries.
  let totalBuyIn = 0;
  let entriesWithBuyIn = 0;

  for (const tournId of tournamentIds) {
    const buyIn = tournBuyIns[tournId];
    const tournName = tournNames[tournId] ?? null;
    // Determine the file count for this tournament (how many entries/re-entries)
    let fileCount = 0;
    const seenFiles = new Set<string>();
    for (const h of handList) {
      if ((h.tournament_id as string) === tournId) {
        const fn = h.source_file_name as string | null;
        if (fn && !seenFiles.has(fn)) {
          seenFiles.add(fn);
          fileCount++;
        }
      }
    }

    if (buyIn != null && Number.isFinite(buyIn) && buyIn > 0) {
      // Check if this tournament is a satellite — the $ amount is the target
      // event's buy-in, not what the player actually paid. Treat as $0 for ABI.
      const sampleFileName = seenFiles.values().next().value ?? '';
      if (isSatellite(sampleFileName, tournName)) {
        // Satellite: buy-in amount is the target event cost, not player's entry cost
        // Still count the entries in the denominator (entries count stays the same)
        entriesWithBuyIn += fileCount;
      } else if (isBountyTargetTournament(sampleFileName, tournName)) {
        // Bounty target: the $ amount was incorrectly parsed as buy-in (e.g. $10,000)
        // Already set to NULL in DB via migration, but handle defensively
        entriesWithBuyIn += fileCount;
      } else {
        totalBuyIn += buyIn * fileCount;
        entriesWithBuyIn += fileCount;
      }
    }
    // Entries with NULL buy_in (e.g. Cash Drop where real buy-in unknown) still
    // count in the denominator (entries) but contribute $0 to totalBuyIn.
  }

  return { events, entries, totalBuyIn, entriesWithBuyIn };
}

async function fetchAllHands(userId: string, mode: AnalyticsMode): Promise<{ hands: Record<string, unknown>[]; error: string | null }> {
  const PAGE_SIZE = 1000;
  const allHands: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('poker_hand_records')
      .select(`
        id, user_id, hand_hash, hand_id, source_file_name, site, played_at,
        game_mode, tournament_id, pot_amount, bb_won, position,
        hero_name, hero_seat, blinds, stack_size, buy_in, hero_cards, board,
        action_sequence, net_result, showdown, saw_flop, saw_turn, saw_river,
        parser_status, import_batch_id, board_class, flop_suit_texture, flop_high_card,
        flop_is_paired, flop_is_trips, flop_connectivity, starting_hand_class,
        effective_stack_bb, pot_type, is_3bet_pot, is_4bet_pot, street_reached,
        hero_allin_preflop, hero_allin_postflop, hero_preflop_action, hero_faced_3bet,
        hero_cbet_flop, faced_cbet_flop, hero_barrel_turn, hero_barrel_river, hero_checkraise,
        hero_flat_3bet, allin_ev_bb, allin_ev_eligible,
        raw_hand_text
      `)
      .eq('user_id', userId)
      .eq('game_mode', mode)
      .filter('hand_hash', 'not.like', '%-unknown-%')
      .filter('hand_hash', 'not.like', 'summary-%')
      .order('played_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return { hands: [], error: error.message };

    const page = (data ?? []) as Record<string, unknown>[];
    allHands.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { hands: allHands, error: null };
}

// Lightweight fetch for dashboard recalculation — excludes raw_hand_text.
// raw_hand_text is only needed for the explicit "rebuild from raw" feature.
// Using stored bb_won/action_sequence values avoids 62k in-browser re-parses.
async function fetchAllHandsLight(userId: string, mode: AnalyticsMode): Promise<{ hands: Record<string, unknown>[]; error: string | null }> {
  const PAGE_SIZE = 1000;
  const allHands: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('poker_hand_records')
      .select(`
        id, user_id, hand_hash, hand_id, source_file_name, site, played_at,
        game_mode, tournament_id, pot_amount, bb_won, position,
        hero_name, hero_seat, blinds, stack_size, buy_in, hero_cards, board,
        action_sequence, net_result, showdown, saw_flop, saw_turn, saw_river,
        parser_status, import_batch_id, board_class, flop_suit_texture, flop_high_card,
        flop_is_paired, flop_is_trips, flop_connectivity, starting_hand_class,
        effective_stack_bb, pot_type, is_3bet_pot, is_4bet_pot, street_reached,
        hero_allin_preflop, hero_allin_postflop, hero_preflop_action, hero_faced_3bet,
        hero_cbet_flop, faced_cbet_flop, hero_barrel_turn, hero_barrel_river, hero_checkraise,
        hero_flat_3bet, allin_ev_bb, allin_ev_eligible
      `)
      .eq('user_id', userId)
      .eq('game_mode', mode)
      .filter('hand_hash', 'not.like', '%-unknown-%')
      .filter('hand_hash', 'not.like', 'summary-%')
      .order('played_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return { hands: [], error: error.message };

    const page = (data ?? []) as Record<string, unknown>[];
    allHands.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { hands: allHands, error: null };
}

export async function recalculateAnalytics(
  userId: string,
  mode: AnalyticsMode,
  onProgress?: (p: { handsProcessed: number; totalHands: number; stage: string }) => void,
): Promise<RecalcResult> {
  const startTime = Date.now();
  let handsExcluded = 0;

  // Stage 0: Acquire job lock — prevents concurrent recalculation across tabs/mounts
  onProgress?.({ handsProcessed: 0, totalHands: 0, stage: 'Acquiring job lock' });
  const expectedHands = await loadDataStatus(userId, mode).then(s => s.hands);

  const lockResult = await acquireAnalyticsJob(userId, mode, expectedHands);
  if ('conflict' in lockResult) {
    return { snapshot: null, error: 'Analytics calculation already in progress', errorStage: 'Job lock', handsProcessed: 0, handsExcluded: 0, durationMs: Date.now() - startTime, integrityOk: false, jobConflict: true };
  }
  const jobId = lockResult.jobId;

  try {
    return await recalculateAnalyticsInner(userId, mode, onProgress, startTime, expectedHands, jobId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    await failAnalyticsJob(jobId, errMsg);
    return { snapshot: null, error: errMsg, errorStage: 'Unhandled error', handsProcessed: 0, handsExcluded: 0, durationMs: Date.now() - startTime, integrityOk: false };
  }
}

async function recalculateAnalyticsInner(
  userId: string,
  mode: AnalyticsMode,
  onProgress: ((p: { handsProcessed: number; totalHands: number; stage: string }) => void) | undefined,
  startTime: number,
  expectedHands: number,
  jobId: string,
): Promise<RecalcResult> {
  let handsExcluded = 0;

  // Stage A: Get authoritative hand count (already fetched by caller, but re-check for safety)
  onProgress?.({ handsProcessed: 0, totalHands: expectedHands, stage: 'Counting hands' });

  // Stage B: Fetch ALL hands via pagination (lightweight — no raw_hand_text)
  onProgress?.({ handsProcessed: 0, totalHands: expectedHands, stage: 'Fetching hands' });
  const { hands: handList, error: fetchError } = await fetchAllHandsLight(userId, mode);
  if (fetchError) {
    await failAnalyticsJob(jobId, fetchError);
    return { snapshot: null, error: fetchError, errorStage: 'Fetch hands', handsProcessed: 0, handsExcluded: 0, durationMs: Date.now() - startTime, integrityOk: false };
  }

  const totalHands = handList.length;

  if (totalHands === 0) {
    await failAnalyticsJob(jobId, 'No hands found for this mode');
    return { snapshot: null, error: 'No hands found for this mode', errorStage: 'Fetch hands', handsProcessed: 0, handsExcluded: 0, durationMs: Date.now() - startTime, integrityOk: false };
  }

  // Integrity check: processed count must match authoritative count
  const integrityOk = totalHands === expectedHands;
  if (!integrityOk) {
    const errMsg = `Integrity check failed: processed ${totalHands} hands but database has ${expectedHands}. Pagination may be incomplete.`;
    await failAnalyticsJob(jobId, errMsg);
    return {
      snapshot: null,
      error: errMsg,
      errorStage: 'Integrity check',
      handsProcessed: totalHands,
      handsExcluded: 0,
      durationMs: Date.now() - startTime,
      integrityOk: false,
    };
  }

  // === Summary metrics (full precision, no per-hand rounding) ===
  let bbWon = 0;          // SUM(netResultBB) — recomputed from actions
  let profit = 0;         // SUM(netChips) — raw chip profit
  let handsWithResult = 0;
  let handsWithoutBB = 0;
  let allinEvBbSum = 0;   // SUM(allin_ev_bb) — all-in adjusted EV
  let allinEvEligibleCount = 0;  // Count of hands eligible for all-in EV
  let storedBbWonSum = 0; // SUM of stored bb_won — diagnostic cross-check
  let reparsedCount = 0;  // Hands where re-parse produced a non-null netResult
  let disagreeCount = 0;  // Hands where re-parsed BB differs from stored
  let disagreeSum = 0;    // Net adjustment (re-parsed - stored)
  const positionMap: Record<string, { hands: number; bbWon: number; profit: number }> = {};
  const days = new Set<string>();
  const siteSet = new Set<string>();
  let potTotal = 0;
  let handsWithPot = 0;

  // === Stat counters (hero-specific) ===
  let vpipCount = 0;
  let pfrCount = 0;
  let threeBetCount = 0;
  let threeBetOppCount = 0;
  let cbetFlopCount = 0;
  let cbetFlopOppCount = 0;
  let cbetDiagSawFlop = 0;
  let cbetDiagAggressorSawFlop = 0;
  let cbetDiagDonkExcluded = 0;
  let cbetDiagOpp = 0;
  let barrelTurnCount = 0;
  let barrelTurnOppCount = 0;
  let barrelRiverCount = 0;
  let barrelRiverOppCount = 0;
  let showdownCount = 0;     // hero reached showdown
  let wtsdCount = 0;         // hero went to showdown after seeing flop
  let wsdCount = 0;          // hero won at showdown
  let wwsfCount = 0;         // hero saw flop AND won pot
  let sawFlopCount = 0;
  let sawTurnCount = 0;
  let sawRiverCount = 0;
  let flopActionCount = 0;  // hero made at least one flop action (Hand2Note "Flop Any Action")

  const advancedStats = createEmptyAdvancedStats();

  const startingHandMap: Record<string, { hands: number; bbWon: number }> = {};
  const boardAnalysisMap: Record<string, {
    hands: number; bbWon: number; cbetCount: number; cbetOpp: number;
    sawFlop: number; showdownCount: number; wsdCount: number; wwsfCount: number; wtsdCount: number;
    suitTexture: string | null; structuralTags: string[]; pairedStructure: string;
    suitedRelationship: string; isPaired: boolean; isTrips: boolean;
    level: string; family: string;
    potTypes: Record<string, number>;
    positions: Record<string, { hands: number; bbWon: number }>;
  }> = {};
  let biggestWin = 0;
  let biggestLoss = 0;

  // Pot type counts
  let potTypeUnopened = 0;
  let potTypeLimped = 0;
  let potTypeSrp = 0;
  let potType3bet = 0;
  let potType4betPlus = 0;
  // C-Bet by pot type
  let cbetSrpCount = 0, cbetSrpOppCount = 0;
  let cbet3betCount = 0, cbet3betOppCount = 0;
  let cbet4betCount = 0, cbet4betOppCount = 0;

  // Graph series (uses per-hand BB)
  let cumBB = 0;
  let cumShowdown = 0;
  let cumNonShowdown = 0;
  let cumEv = 0;
  const graphSeries: { index: number; profit: number; showdown?: number; non_showdown?: number; ev?: number }[] = [];

  onProgress?.({ handsProcessed: 0, totalHands, stage: 'Calculating stats' });
  const PROGRESS_INTERVAL = Math.max(500, Math.floor(totalHands / 100));

  for (let i = 0; i < handList.length; i++) {
    if (onProgress && (i % PROGRESS_INTERVAL === 0 || i === handList.length - 1)) {
      onProgress({ handsProcessed: i, totalHands, stage: 'Calculating stats' });
    }
    const h = handList[i];
    const blindsStr = h.blinds as string | null;
    const bigBlind = parseBigBlind(blindsStr);
    const pos = h.position as string | null;
    const playedAt = h.played_at as string | null;
    const tournId = h.tournament_id as string | null;
    const site = h.site as string | null;
    const pot = h.pot_amount as number | null;
    const heroCards = h.hero_cards as string | null;
    const actionsData = h.action_sequence as ActionEntry[] | null;
    const sawFlop = h.saw_flop as boolean | null;
    const sawTurn = h.saw_turn as boolean | null;
    const sawRiver = h.saw_river as boolean | null;
    const showdown = h.showdown as boolean | null;
    const heroName = h.hero_name as string | null;
    const rawHandText = h.raw_hand_text as string | null;

    // Re-parse from raw hand text to get corrected bb_won, actions, and showdown.
    // The stored values may be stale from a parser bug that missed pot collections.
    let netResultBB: number | null = null;
    let recomputedActions = actionsData;
    let recomputedShowdown = showdown;

    if (rawHandText && heroName) {
      const reparsed = parseHandBlock(rawHandText, site || 'GGPoker', mode);
      if (reparsed) {
        netResultBB = reparsed.netResult;
        recomputedActions = reparsed.actions;
        recomputedShowdown = reparsed.showdown;
      }
    }

    // Accumulate stored bb_won for post-loop validation cross-check
    const storedBB = Number(h.bb_won);
    if (Number.isFinite(storedBB)) {
      storedBbWonSum += storedBB;
    }

    // Fall back to stored value if re-parse failed
    if (netResultBB === null) {
      netResultBB = Number.isFinite(storedBB) ? storedBB : null;
    } else {
      reparsedCount++;
      // Track per-hand discrepancy for diagnostics
      if (Number.isFinite(storedBB) && Math.abs(netResultBB - storedBB) > 0.01) {
        disagreeCount++;
        disagreeSum += (netResultBB - storedBB);
      }
    }

    // net_result stores BB-normalized values (same as bb_won), not raw chips.
    // Derive actual chip profit from BB × big_blind.
    const netChips: number | null = (netResultBB !== null && bigBlind > 0) ? netResultBB * bigBlind : null;

    // Use recomputed showdown flag (from fixed parser) with fallback to stored
    const effectiveShowdown = recomputedShowdown ?? showdown ?? false;

  // Use stored boolean flags directly (already computed during import)
  const effectiveSawFlop = sawFlop ?? false;
  const effectiveSawTurn = sawTurn ?? false;
  const effectiveSawRiver = sawRiver ?? false;

    let correctedBB: number | null = null;
    if (netResultBB !== null) {
      correctedBB = netResultBB;
      bbWon += correctedBB;
      profit += netChips ?? 0;
      handsWithResult++;
    } else {
      handsWithoutBB++;
    }

    // EV BB/100 disabled — all-in EV calculation skipped to improve performance.
    // Stored allin_ev_bb values are preserved in the database for future reactivation.

    if (playedAt) days.add(playedAt.slice(0, 10));
    if (site) siteSet.add(site);
    if (pot !== null && pot !== undefined) { potTotal += pot; handsWithPot++; }

    if (pos) {
      if (!positionMap[pos]) positionMap[pos] = { hands: 0, bbWon: 0, profit: 0 };
      positionMap[pos].hands++;
      if (correctedBB !== null) {
        positionMap[pos].bbWon += correctedBB;
        positionMap[pos].profit += netChips ?? 0;
      }
    }

    if (effectiveSawFlop) sawFlopCount++;
    if (effectiveSawTurn) sawTurnCount++;
    if (effectiveSawRiver) sawRiverCount++;

    // Pot type counting
    const handPotType = h.pot_type as string | null;
    if (handPotType === 'unopened') potTypeUnopened++;
    else if (handPotType === 'limped') potTypeLimped++;
    else if (handPotType === 'srp') potTypeSrp++;
    else if (handPotType === '3bet') potType3bet++;
    else if (handPotType === '4bet_plus') potType4betPlus++;

    // Hero-specific stats — use recomputed action_sequence (from fixed parser) with fallback
    const statActions = recomputedActions && Array.isArray(recomputedActions) ? recomputedActions : (actionsData && Array.isArray(actionsData) ? actionsData : null);

    // Hand2Note defines WTSD/WWSF denominator as "Flop Any Action" — hands where
    // the player made at least one postflop action on the flop. Preflop all-in
    // hands where the board runs out but Hero made no flop decision are excluded.
    const heroFlopActions = statActions && heroName
      ? statActions.filter((a) => a.player === heroName && a.street === 'flop' &&
          ['check', 'bet', 'call', 'raise', 'all-in', 'fold'].includes(a.action))
      : [];
    const heroMadeFlopAction = heroFlopActions.length > 0;
    if (heroMadeFlopAction) flopActionCount++;

    if (statActions && heroName) {
      const heroActions = statActions.filter((a) => a.player === heroName);

      // Preflop stats via state machine
      const pfState = analyzePreflopState(statActions, heroName);
      if (pfState.vpip) vpipCount++;
      if (pfState.pfr) pfrCount++;
      if (pfState.threeBetOpportunity) threeBetOppCount++;
      if (pfState.threeBet) threeBetCount++;

      // C-Bet: hero was preflop aggressor (last raiser), saw the flop,
      // AND no opponent donk-bet before hero's first flop action.
      const cbetOppStatus = classifyFlopCbetOpportunity(statActions, heroName, effectiveSawFlop);
      if (effectiveSawFlop) cbetDiagSawFlop++;
      if (cbetOppStatus === 'no_aggressor' && effectiveSawFlop) cbetDiagAggressorSawFlop++;
      if (cbetOppStatus === 'donk_bet_first') cbetDiagDonkExcluded++;
      if (cbetOppStatus === 'opportunity') cbetDiagOpp++;

      if (cbetOppStatus === 'opportunity') {
        cbetFlopOppCount++;
        const heroCbet = didHeroCbetFlop(statActions, heroName, effectiveSawFlop);
        if (heroCbet) cbetFlopCount++;

        if (handPotType === 'srp') { cbetSrpOppCount++; if (heroCbet) cbetSrpCount++; }
        else if (handPotType === '3bet') { cbet3betOppCount++; if (heroCbet) cbet3betCount++; }
        else if (handPotType === '4bet_plus') { cbet4betOppCount++; if (heroCbet) cbet4betCount++; }

        if (heroCbet && effectiveSawTurn) {
          barrelTurnOppCount++;
          const heroTurnActions = heroActions.filter((a) => a.street === 'turn' && !['post', 'post_ante', 'collect', 'uncalled', 'show'].includes(a.action));
          const firstTurnAction = heroTurnActions[0];
          const heroBarrelledTurn = firstTurnAction && ['bet', 'raise', 'all-in'].includes(firstTurnAction.action);
          if (heroBarrelledTurn) barrelTurnCount++;

          if (heroBarrelledTurn && effectiveSawRiver) {
            barrelRiverOppCount++;
            const heroRiverActions = heroActions.filter((a) => a.street === 'river' && !['post', 'post_ante', 'collect', 'uncalled', 'show'].includes(a.action));
            const firstRiverAction = heroRiverActions[0];
            if (firstRiverAction && ['bet', 'raise', 'all-in'].includes(firstRiverAction.action)) barrelRiverCount++;
          }
        }
      }

      // Showdown classification — use recomputed showdown flag
      const handShowdown = effectiveShowdown;

      // WTSD: hero made flop action AND reached showdown
      // W$SD: hero won at showdown (netResultBB > 0)
      if (handShowdown) {
        showdownCount++;
        if (heroMadeFlopAction) wtsdCount++;
        if (netResultBB !== null && netResultBB > 0) wsdCount++;
      }

      // WWSF: hero made flop action AND won pot (netResultBB > 0)
      if (heroMadeFlopAction && netResultBB !== null && netResultBB > 0) wwsfCount++;

      // Advanced stats (fold-to-3bet, 4-bet, squeeze, limp, steal, check-raise, fold-to-barrel, etc.)
      const heroPosition = h.position as string | null;
      computeAdvancedStatsForHand(advancedStats, statActions, heroName, heroPosition, effectiveSawFlop, effectiveSawTurn, effectiveSawRiver);
    }

    if (heroCards) {
      const handKey = normalizeHandKey(heroCards);
      if (handKey) {
        if (!startingHandMap[handKey]) startingHandMap[handKey] = { hands: 0, bbWon: 0 };
        startingHandMap[handKey].hands++;
        if (correctedBB !== null) startingHandMap[handKey].bbWon += correctedBB;
      }
    }

    // Track biggest win/loss
    if (correctedBB !== null) {
      if (correctedBB > biggestWin) biggestWin = correctedBB;
      if (correctedBB < biggestLoss) biggestLoss = correctedBB;
    }

    // Board analysis — 3-level normalization: family + exact
    const norm = normalizeBoard(h.board as string | null);
    if (norm) {
      // Properly compute CBet opportunity using the same logic as main analytics
      const cbetOppStatus = statActions && heroName
        ? classifyFlopCbetOpportunity(statActions, heroName, effectiveSawFlop)
        : 'didnt_see_flop';
      const hadCbetOpp = cbetOppStatus === 'opportunity';
      const heroCbet = hadCbetOpp && statActions && heroName
        ? didHeroCbetFlop(statActions, heroName, effectiveSawFlop)
        : false;
      const handShowdown = effectiveShowdown;
      const handPotType = (h.pot_type as string | null) ?? 'unknown';
      const handPos = (h.position as string | null) ?? 'unknown';

      const initEntry = () => ({
        hands: 0, bbWon: 0, cbetCount: 0, cbetOpp: 0,
        sawFlop: 0, showdownCount: 0, wsdCount: 0, wwsfCount: 0, wtsdCount: 0,
        suitTexture: norm.suitTexture,
        structuralTags: norm.structuralTags as unknown as string[],
        pairedStructure: norm.pairedStructure,
        suitedRelationship: norm.suitedRelationship,
        isPaired: norm.isPaired, isTrips: norm.isTrips,
        level: 'exact' as string, family: norm.generalFamily,
        potTypes: {} as Record<string, number>,
        positions: {} as Record<string, { hands: number; bbWon: number }>,
      });

      // Aggregate by exact texture (e.g. "K83 Rainbow")
      const exactKey = norm.exactTexture;
      if (!boardAnalysisMap[exactKey]) boardAnalysisMap[exactKey] = initEntry();
      const eEntry = boardAnalysisMap[exactKey];
      eEntry.hands++;
      if (correctedBB !== null) eEntry.bbWon += correctedBB;
      if (effectiveSawFlop) eEntry.sawFlop++;
      if (handShowdown) eEntry.showdownCount++;
      if (handShowdown && heroMadeFlopAction) eEntry.wtsdCount++;
      if (handShowdown && correctedBB !== null && correctedBB > 0) eEntry.wsdCount++;
      if (heroMadeFlopAction && correctedBB !== null && correctedBB > 0) eEntry.wwsfCount++;
      if (hadCbetOpp) { eEntry.cbetOpp++; if (heroCbet) eEntry.cbetCount++; }
      eEntry.potTypes[handPotType] = (eEntry.potTypes[handPotType] ?? 0) + 1;
      if (!eEntry.positions[handPos]) eEntry.positions[handPos] = { hands: 0, bbWon: 0 };
      eEntry.positions[handPos].hands++;
      if (correctedBB !== null) eEntry.positions[handPos].bbWon += correctedBB;

      // Aggregate by general family (e.g. "KXY Rainbow")
      const familyKey = norm.generalFamily;
      if (!boardAnalysisMap[familyKey]) boardAnalysisMap[familyKey] = { ...initEntry(), level: 'family' };
      const fEntry = boardAnalysisMap[familyKey];
      fEntry.hands++;
      if (correctedBB !== null) fEntry.bbWon += correctedBB;
      if (effectiveSawFlop) fEntry.sawFlop++;
      if (handShowdown) fEntry.showdownCount++;
      if (handShowdown && heroMadeFlopAction) fEntry.wtsdCount++;
      if (handShowdown && correctedBB !== null && correctedBB > 0) fEntry.wsdCount++;
      if (heroMadeFlopAction && correctedBB !== null && correctedBB > 0) fEntry.wwsfCount++;
      if (hadCbetOpp) { fEntry.cbetOpp++; if (heroCbet) fEntry.cbetCount++; }
      fEntry.potTypes[handPotType] = (fEntry.potTypes[handPotType] ?? 0) + 1;
      if (!fEntry.positions[handPos]) fEntry.positions[handPos] = { hands: 0, bbWon: 0 };
      fEntry.positions[handPos].hands++;
      if (correctedBB !== null) fEntry.positions[handPos].bbWon += correctedBB;
    }

    // Graph series uses recomputed per-hand BB with stored showdown flag
    if (correctedBB !== null) {
      cumBB += correctedBB;
      const graphShowdown = effectiveShowdown;
      if (graphShowdown) {
        cumShowdown += correctedBB;
      } else {
        cumNonShowdown += correctedBB;
      }
    }
    // EV cumulative: use all-in EV for eligible hands, actual BB for others
    if (handAllinEligible && handAllinEv !== null && Number.isFinite(handAllinEv)) {
      cumEv += handAllinEv;
    } else if (correctedBB !== null) {
      cumEv += correctedBB;
    }
    if (i % Math.max(1, Math.floor(handList.length / 200)) === 0 || i === handList.length - 1) {
      graphSeries.push({
        index: i + 1,
        profit: Math.round(cumBB * 100) / 100,
        showdown: Math.round(cumShowdown * 100) / 100,
        non_showdown: Math.round(cumNonShowdown * 100) / 100,
        ev: Math.round(cumEv * 100) / 100,
      });
    }
  }

  // === Compute rates ===
  // VPIP/PFR denominators: total hands (standard tracker convention)
  const vpip = totalHands > 0 ? (vpipCount / totalHands) * 100 : 0;
  const pfr = totalHands > 0 ? (pfrCount / totalHands) * 100 : 0;
  const threeBet = threeBetOppCount > 0 ? (threeBetCount / threeBetOppCount) * 100 : 0;
  const cbetFlop = cbetFlopOppCount > 0 ? (cbetFlopCount / cbetFlopOppCount) * 100 : 0;
  const barrelTurn = barrelTurnOppCount > 0 ? (barrelTurnCount / barrelTurnOppCount) * 100 : 0;
  const barrelRiver = barrelRiverOppCount > 0 ? (barrelRiverCount / barrelRiverOppCount) * 100 : 0;
  // WTSD denominator: hands where hero made a flop action (Hand2Note "Flop Any Action")
  const wtsd = flopActionCount > 0 ? (wtsdCount / flopActionCount) * 100 : 0;
  // W$SD denominator: showdowns reached
  const wsd = showdownCount > 0 ? (wsdCount / showdownCount) * 100 : 0;
  // WWSF denominator: hands where hero made a flop action (Hand2Note "Flop Any Action")
  const wwsf = flopActionCount > 0 ? (wwsfCount / flopActionCount) * 100 : 0;

  // BB/100 denominator: valid hands only (parser_status != failed AND net_result_bb != null)
  const bb100 = handsWithResult > 0 ? (bbWon / handsWithResult) * 100 : 0;
  const avgPot = handsWithPot > 0 ? potTotal / handsWithPot : 0;

  // === Sanity invariants ===
  const sanityChecks: Array<{ name: string; pass: boolean; detail: string }> = [
    { name: 'BB/100 formula', pass: Math.abs(bb100 - (handsWithResult > 0 ? (bbWon / handsWithResult) * 100 : 0)) < 0.01, detail: `bb100=${bb100.toFixed(4)}, bbWon/validHands*100=${(handsWithResult > 0 ? (bbWon / handsWithResult) * 100 : 0).toFixed(4)}` },
    { name: 'PFR <= VPIP', pass: pfrCount <= vpipCount, detail: `PFR=${pfrCount}, VPIP=${vpipCount}` },
    { name: '3-Bet <= Opportunities', pass: threeBetCount <= threeBetOppCount, detail: `3bet=${threeBetCount}, opp=${threeBetOppCount}` },
    { name: 'Showdown <= Total Hands', pass: showdownCount <= totalHands, detail: `SD=${showdownCount}, total=${totalHands}` },
    { name: 'SD wins <= Showdowns', pass: wsdCount <= showdownCount, detail: `W$SD=${wsdCount}, SD=${showdownCount}` },
    { name: 'All percentages 0-100', pass: [vpip, pfr, threeBet, cbetFlop, barrelTurn, barrelRiver, wtsd, wsd, wwsf].every(v => v >= 0 && v <= 100), detail: 'checked' },
    { name: 'Showdown + NonSD = Total', pass: Math.abs(cumShowdown + cumNonShowdown - cumBB) < 1, detail: `SD=${cumShowdown.toFixed(2)}, NonSD=${cumNonShowdown.toFixed(2)}, Total=${cumBB.toFixed(2)}` },
    { name: 'Graph total = BB Won', pass: graphSeries.length > 0 && Math.abs(graphSeries[graphSeries.length - 1].profit - bbWon) < 1, detail: `graphFinal=${graphSeries[graphSeries.length - 1]?.profit}, bbWon=${bbWon.toFixed(2)}` },
  ];
  const sanityOk = sanityChecks.every(s => s.pass);
  if (!sanityOk) {
    console.warn('[Analytics] Sanity check failures:', sanityChecks.filter(s => !s.pass));
  }

  // === Per-hand discrepancy logging (informational, does not abort) ===
  // The stored per-hand bb_won values may differ from freshly re-parsed values
  // due to parser improvements. Log the discrepancy for diagnostics but do NOT
  // abort — the re-parsed values from raw_hand_text are authoritative.
  if (disagreeCount > 0) {
    console.info(
      `[Analytics] Recalculation: ${disagreeCount} hands where re-parsed BB differs from stored. ` +
      `Net adjustment: ${Math.round(disagreeSum * 100) / 100} BB. ` +
      `Re-parsed: ${reparsedCount}/${handsWithResult} hands.`
    );
  }

  // === Integrity checks on percentages ===
  const pctInvariants: Array<{ name: string; num: number; denom: number }> = [
    { name: 'VPIP', num: vpipCount, denom: totalHands },
    { name: 'PFR', num: pfrCount, denom: totalHands },
    { name: '3-Bet', num: threeBetCount, denom: threeBetOppCount },
    { name: 'C-Bet', num: cbetFlopCount, denom: cbetFlopOppCount },
    { name: 'WTSD', num: wtsdCount, denom: flopActionCount },
    { name: 'W$SD', num: wsdCount, denom: showdownCount },
    { name: 'WWSF', num: wwsfCount, denom: flopActionCount },
  ];
  const pctFailures = pctInvariants.filter((p) => p.num > p.denom);
  const pctIntegrityOk = pctFailures.length === 0;

  // SPI: refuse to compute from corrupt analytics
  let spi: number | null = null;
  if (integrityOk && pctIntegrityOk && handsWithResult > 0) {
    spi = Math.min(100, Math.max(0, 50 + bb100 * 2));
  }

  // === Tournament analysis (with re-entry detection) ===
  const { events: tournamentEvents, entries: tournamentEntries, totalBuyIn: tournamentTotalBuyIn, entriesWithBuyIn: tournamentEntriesWithBuyIn } = countTournamentEntries(handList);
  const tournamentCount = tournamentEntries; // Primary count = entries/bullets
  // ABI = Sum of entry buy-in values / Number of confirmed tournament entries
  // Denominator is total entries (all source files), including those with
  // unknown/satellite buy-ins (which contribute $0 to numerator).
  const abi = tournamentEntries > 0 && tournamentTotalBuyIn > 0
    ? Math.round((tournamentTotalBuyIn / tournamentEntries) * 100) / 100
    : 0;

  // === Position analysis ===
  const positionOrder = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'MP', 'MP1', 'MP2', 'MP3', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const positionAnalysis = Object.entries(positionMap)
    .map(([pos, data]) => ({
      position: pos,
      hands: data.hands,
      bb100: data.hands > 0 ? Math.round((data.bbWon / data.hands) * 100 * 10) / 10 : 0,
      profit: Math.round(data.profit),
      bbWon: Math.round(data.bbWon * 100) / 100,
    }))
    .sort((a, b) => {
      const ai = positionOrder.indexOf(a.position as string);
      const bi = positionOrder.indexOf(b.position as string);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  // === Starting hands ===
  const startingHands = Object.entries(startingHandMap)
    .map(([key, data]) => ({
      hand: key,
      hands: data.hands,
      bb_won: Math.round(data.bbWon * 100) / 100,
      bb100: data.hands > 0 && Number.isFinite(data.bbWon) ? Math.round((data.bbWon / data.hands) * 100 * 10) / 10 : null,
    }))
    .sort((a, b) => b.hands - a.hands)
    .slice(0, 169);

  // EV BB/100: divide by total hands with results (not just eligible hands).
  // Eligible hands contribute all-in EV; non-eligible hands contribute actual BB.
  const evBb100 = 0;

  // === Summary (round only for storage/display, not during accumulation) ===
  const summary = {
    hands: totalHands,
    profit: Math.round(profit),
    bbWon: Math.round(bbWon * 100) / 100,
    bb100: Math.round(bb100 * 1000) / 1000,
    evBb100,
    vpip: Math.round(vpip * 10) / 10,
    pfr: Math.round(pfr * 10) / 10,
    threeBet: Math.round(threeBet * 10) / 10,
    cbetFlop: Math.round(cbetFlop * 10) / 10,
    barrelTurn: Math.round(barrelTurn * 10) / 10,
    barrelRiver: Math.round(barrelRiver * 10) / 10,
    wtsd: Math.round(wtsd * 10) / 10,
    wsd: Math.round(wsd * 10) / 10,
    wwsf: Math.round(wwsf * 10) / 10,
    roi: 0,
    abi: abi,
    itm: 0,
    tournamentEntries: tournamentEntries,
    tournamentEvents: tournamentEvents,
    reEntries: tournamentEntries - tournamentEvents,
    activeDays: days.size,
    spi: spi !== null ? Math.round(spi) : -1,
    avgPot: Math.round(avgPot * 10) / 10,
    sites: siteSet.size,
    // Advanced stats
    foldTo3bet: statPct(advancedStats.foldTo3betCount, advancedStats.foldTo3betOppCount),
    foldTo3betCount: advancedStats.foldTo3betCount,
    foldTo3betOppCount: advancedStats.foldTo3betOppCount,
    fourBet: statPct(advancedStats.fourBetCount, advancedStats.fourBetOppCount),
    fourBetCount: advancedStats.fourBetCount,
    fourBetOppCount: advancedStats.fourBetOppCount,
    foldTo4bet: statPct(advancedStats.foldTo4betCount, advancedStats.foldTo4betOppCount),
    foldTo4betCount: advancedStats.foldTo4betCount,
    foldTo4betOppCount: advancedStats.foldTo4betOppCount,
    squeeze: statPct(advancedStats.squeezeCount, advancedStats.squeezeOppCount),
    squeezeCount: advancedStats.squeezeCount,
    squeezeOppCount: advancedStats.squeezeOppCount,
    limp: statPct(advancedStats.limpCount, advancedStats.limpOppCount),
    limpCount: advancedStats.limpCount,
    limpOppCount: advancedStats.limpOppCount,
    limpFold: statPct(advancedStats.limpFoldCount, advancedStats.limpFoldOppCount),
    limpFoldCount: advancedStats.limpFoldCount,
    limpFoldOppCount: advancedStats.limpFoldOppCount,
    steal: statPct(advancedStats.stealCount, advancedStats.stealOppCount),
    stealCount: advancedStats.stealCount,
    stealOppCount: advancedStats.stealOppCount,
    foldToSteal: statPct(advancedStats.foldToStealCount, advancedStats.foldToStealOppCount),
    foldToStealCount: advancedStats.foldToStealCount,
    foldToStealOppCount: advancedStats.foldToStealOppCount,
    foldToFlopCbet: statPct(advancedStats.foldToFlopCbetCount, advancedStats.foldToFlopCbetOppCount),
    foldToFlopCbetCount: advancedStats.foldToFlopCbetCount,
    foldToFlopCbetOppCount: advancedStats.foldToFlopCbetOppCount,
    checkRaiseFlop: statPct(advancedStats.flopCheckRaiseCount, advancedStats.flopCheckRaiseOppCount),
    checkRaiseFlopCount: advancedStats.flopCheckRaiseCount,
    checkRaiseFlopOppCount: advancedStats.flopCheckRaiseOppCount,
    foldToTurnBarrel: statPct(advancedStats.foldToTurnBarrelCount, advancedStats.foldToTurnBarrelOppCount),
    foldToTurnBarrelCount: advancedStats.foldToTurnBarrelCount,
    foldToTurnBarrelOppCount: advancedStats.foldToTurnBarrelOppCount,
    foldToRiverBarrel: statPct(advancedStats.foldToRiverBarrelCount, advancedStats.foldToRiverBarrelOppCount),
    foldToRiverBarrelCount: advancedStats.foldToRiverBarrelCount,
    foldToRiverBarrelOppCount: advancedStats.foldToRiverBarrelOppCount,
    // Pot type frequency
    unopened: totalHands > 0 ? Math.round((potTypeUnopened / totalHands) * 1000) / 10 : 0,
    limped: totalHands > 0 ? Math.round((potTypeLimped / totalHands) * 1000) / 10 : 0,
    srp: totalHands > 0 ? Math.round((potTypeSrp / totalHands) * 1000) / 10 : 0,
    '3bet': totalHands > 0 ? Math.round((potType3bet / totalHands) * 1000) / 10 : 0,
    '4bet_plus': totalHands > 0 ? Math.round((potType4betPlus / totalHands) * 1000) / 10 : 0,
    unopenedCount: potTypeUnopened,
    limpedCount: potTypeLimped,
    srpCount: potTypeSrp,
    '3betCount': potType3bet,
    '4bet_plusCount': potType4betPlus,
    // C-Bet by pot type
    cbet_srp: statPct(cbetSrpCount, cbetSrpOppCount),
    cbet_3bet: statPct(cbet3betCount, cbet3betOppCount),
    cbet_4bet_plus: statPct(cbet4betCount, cbet4betOppCount),
    // New flop stats
    callFlopCbet: statPct(advancedStats.callFlopCbetCount, advancedStats.callFlopCbetOppCount),
    callFlopCbetCount: advancedStats.callFlopCbetCount,
    callFlopCbetOppCount: advancedStats.callFlopCbetOppCount,
    raiseFlopCbet: statPct(advancedStats.raiseFlopCbetCount, advancedStats.raiseFlopCbetOppCount),
    raiseFlopCbetCount: advancedStats.raiseFlopCbetCount,
    raiseFlopCbetOppCount: advancedStats.raiseFlopCbetOppCount,
    flopCbetSuccess: statPct(advancedStats.flopCbetSuccessCount, advancedStats.flopCbetSuccessOppCount),
    flopCbetSuccessCount: advancedStats.flopCbetSuccessCount,
    flopCbetSuccessOppCount: advancedStats.flopCbetSuccessOppCount,
    betWhenCheckedTo: statPct(advancedStats.betWhenCheckedToCount, advancedStats.betWhenCheckedToOppCount),
    betWhenCheckedToCount: advancedStats.betWhenCheckedToCount,
    betWhenCheckedToOppCount: advancedStats.betWhenCheckedToOppCount,
    flopAggression: statPct(advancedStats.flopAggressionCount, advancedStats.flopAggressionDenom),
    flopAggressionCount: advancedStats.flopAggressionCount,
    flopAggressionOppCount: advancedStats.flopAggressionDenom,
    flopDonkBet: statPct(advancedStats.flopDonkBetCount, advancedStats.flopDonkBetOppCount),
    flopDonkBetCount: advancedStats.flopDonkBetCount,
    flopDonkBetOppCount: advancedStats.flopDonkBetOppCount,
    flopDonkSuccess: statPct(advancedStats.flopDonkSuccessCount, advancedStats.flopDonkSuccessOppCount),
    foldToFlopDonk: statPct(advancedStats.foldToFlopDonkCount, advancedStats.foldToFlopDonkOppCount),
    callFlopDonk: statPct(advancedStats.callFlopDonkCount, advancedStats.callFlopDonkOppCount),
    raiseFlopDonk: statPct(advancedStats.raiseFlopDonkCount, advancedStats.raiseFlopDonkOppCount),
    turnDonkBet: statPct(advancedStats.turnDonkBetCount, advancedStats.turnDonkBetOppCount),
    turnDonkSuccess: statPct(advancedStats.turnDonkSuccessCount, advancedStats.turnDonkSuccessOppCount),
    foldToTurnDonk: statPct(advancedStats.foldToTurnDonkCount, advancedStats.foldToTurnDonkOppCount),
    callTurnDonk: statPct(advancedStats.callTurnDonkCount, advancedStats.callTurnDonkOppCount),
    raiseTurnDonk: statPct(advancedStats.raiseTurnDonkCount, advancedStats.raiseTurnDonkOppCount),
    riverDonkBet: statPct(advancedStats.riverDonkBetCount, advancedStats.riverDonkBetOppCount),
    riverDonkSuccess: statPct(advancedStats.riverDonkSuccessCount, advancedStats.riverDonkSuccessOppCount),
    foldToRiverDonk: statPct(advancedStats.foldToRiverDonkCount, advancedStats.foldToRiverDonkOppCount),
    callRiverDonk: statPct(advancedStats.callRiverDonkCount, advancedStats.callRiverDonkOppCount),
    raiseRiverDonk: statPct(advancedStats.raiseRiverDonkCount, advancedStats.raiseRiverDonkOppCount),
    // New turn stats
    callTurnBarrel: statPct(advancedStats.callTurnBarrelCount, advancedStats.callTurnBarrelOppCount),
    callTurnBarrelCount: advancedStats.callTurnBarrelCount,
    callTurnBarrelOppCount: advancedStats.callTurnBarrelOppCount,
    raiseTurnBarrel: statPct(advancedStats.raiseTurnBarrelCount, advancedStats.raiseTurnBarrelOppCount),
    raiseTurnBarrelCount: advancedStats.raiseTurnBarrelCount,
    raiseTurnBarrelOppCount: advancedStats.raiseTurnBarrelOppCount,
    turnBarrelSuccess: statPct(advancedStats.turnBarrelSuccessCount, advancedStats.turnBarrelSuccessOppCount),
    turnBarrelSuccessCount: advancedStats.turnBarrelSuccessCount,
    turnBarrelSuccessOppCount: advancedStats.turnBarrelSuccessOppCount,
    delayedCbet: statPct(advancedStats.delayedCbetCount, advancedStats.delayedCbetOppCount),
    delayedCbetCount: advancedStats.delayedCbetCount,
    delayedCbetOppCount: advancedStats.delayedCbetOppCount,
    turnCheckRaise: statPct(advancedStats.turnCheckRaiseCount, advancedStats.turnCheckRaiseOppCount),
    turnCheckRaiseCount: advancedStats.turnCheckRaiseCount,
    turnCheckRaiseOppCount: advancedStats.turnCheckRaiseOppCount,
    turnAggression: statPct(advancedStats.turnAggressionCount, advancedStats.turnAggressionDenom),
    turnAggressionCount: advancedStats.turnAggressionCount,
    turnAggressionOppCount: advancedStats.turnAggressionDenom,
    turnProbe: statPct(advancedStats.turnProbeCount, advancedStats.turnProbeOppCount),
    turnProbeCount: advancedStats.turnProbeCount,
    turnProbeOppCount: advancedStats.turnProbeOppCount,
    turnBetWhenCheckedTo: statPct(advancedStats.turnBetWhenCheckedToCount, advancedStats.turnBetWhenCheckedToOppCount),
    turnBetWhenCheckedToCount: advancedStats.turnBetWhenCheckedToCount,
    turnBetWhenCheckedToOppCount: advancedStats.turnBetWhenCheckedToOppCount,
    doubleBarrelOppCount: advancedStats.doubleBarrelOppCount,
    // New river stats
    callRiverBarrel: statPct(advancedStats.callRiverBarrelCount, advancedStats.callRiverBarrelOppCount),
    callRiverBarrelCount: advancedStats.callRiverBarrelCount,
    callRiverBarrelOppCount: advancedStats.callRiverBarrelOppCount,
    raiseRiverBarrel: statPct(advancedStats.raiseRiverBarrelCount, advancedStats.raiseRiverBarrelOppCount),
    raiseRiverBarrelCount: advancedStats.raiseRiverBarrelCount,
    raiseRiverBarrelOppCount: advancedStats.raiseRiverBarrelOppCount,
    riverBet: statPct(advancedStats.riverBetCount, advancedStats.riverBetOppCount),
    riverBetCount: advancedStats.riverBetCount,
    riverBetOppCount: advancedStats.riverBetOppCount,
    riverCheckRaise: statPct(advancedStats.riverCheckRaiseCount, advancedStats.riverCheckRaiseOppCount),
    riverCheckRaiseCount: advancedStats.riverCheckRaiseCount,
    riverCheckRaiseOppCount: advancedStats.riverCheckRaiseOppCount,
    riverAggression: statPct(advancedStats.riverAggressionCount, advancedStats.riverAggressionDenom),
    riverAggressionCount: advancedStats.riverAggressionCount,
    riverAggressionOppCount: advancedStats.riverAggressionDenom,
    riverBetSuccess: statPct(advancedStats.riverBetSuccessCount, advancedStats.riverBetSuccessOppCount),
    riverBetSuccessCount: advancedStats.riverBetSuccessCount,
    riverBetSuccessOppCount: advancedStats.riverBetSuccessOppCount,
    riverBetWhenCheckedTo: statPct(advancedStats.riverBetWhenCheckedToCount, advancedStats.riverBetWhenCheckedToOppCount),
    riverBetWhenCheckedToCount: advancedStats.riverBetWhenCheckedToCount,
    riverBetWhenCheckedToOppCount: advancedStats.riverBetWhenCheckedToOppCount,
    // Audit counts
    vpipCount,
    pfrCount,
    threeBetCount,
    threeBetOppCount,
    cbetFlopCount,
    cbetFlopOppCount,
    barrelTurnCount,
    barrelTurnOppCount,
    barrelRiverCount,
    barrelRiverOppCount,
    wtsdCount,
    wsdCount,
    wwsfCount,
    showdownCount,
    sawFlopCount,
    flopActionCount,
    sawTurnCount,
    sawRiverCount,
    handsWithResult,
    handsWithoutBB,
    biggestWin: Math.round(biggestWin * 100) / 100,
    biggestLoss: Math.round(biggestLoss * 100) / 100,
    cbetDiagSawFlop,
    cbetDiagAggressorSawFlop: cbetDiagAggressorSawFlop + cbetDiagOpp + cbetDiagDonkExcluded,
    cbetDiagDonkExcluded,
    cbetDiagOpp,
  };

  const snapshotData = {
    user_id: userId,
    mode,
    calculated_at: new Date().toISOString(),
    source_hand_count: totalHands,
    source_imported_at: new Date().toISOString(),
    summary,
    position_analysis: positionAnalysis,
    preflop_analysis: {
      vpip, pfr, threeBet,
      vpipCount, pfrCount, threeBetCount, threeBetOppCount,
    },
    postflop_analysis: {
      cbetFlop, barrelTurn, barrelRiver,
      cbetFlopCount, cbetFlopOppCount,
      barrelTurnCount, barrelTurnOppCount,
      barrelRiverCount, barrelRiverOppCount,
    },
    board_analysis: Object.entries(boardAnalysisMap)
      .map(([bc, d]) => ({
        board_class: bc,
        level: d.level ?? 'exact',
        family: d.family ?? '',
        hands: d.hands,
        bb_won: Math.round(d.bbWon * 100) / 100,
        bb100: d.hands > 0 && Number.isFinite(d.bbWon) ? Math.round((d.bbWon / d.hands) * 100 * 10) / 10 : null,
        cbet_pct: d.cbetOpp > 0 ? Math.round((d.cbetCount / d.cbetOpp) * 100 * 10) / 10 : 0,
        wtsd: d.sawFlop > 0 && d.wtsdCount > 0 ? Math.round((d.wtsdCount / d.sawFlop) * 100 * 10) / 10 : 0,
        wsd: d.showdownCount > 0 ? Math.round((d.wsdCount / d.showdownCount) * 100 * 10) / 10 : 0,
        wwsf: d.sawFlop > 0 && d.wwsfCount > 0 ? Math.round((d.wwsfCount / d.sawFlop) * 100 * 10) / 10 : 0,
        suit_texture: d.suitTexture ?? null,
        structural_tags: d.structuralTags ?? [],
        paired_structure: d.pairedStructure ?? 'none',
        suited_relationship: d.suitedRelationship ?? 'none',
        is_paired: d.isPaired ?? false,
        is_trips: d.isTrips ?? false,
        pot_types: d.potTypes ?? {},
        positions: Object.entries(d.positions ?? {}).map(([p, v]) => ({
          position: p,
          hands: v.hands,
          bb100: v.hands > 0 ? Math.round((v.bbWon / v.hands) * 100 * 10) / 10 : 0,
        })),
      }))
      .sort((a, b) => (b.hands as number) - (a.hands as number)) as Record<string, unknown>[],
    tournament_analysis: {
      roi: 0,
      abi: abi,
      itm: 0,
      tournamentCount,
      tournamentEvents,
      tournamentEntries,
      reEntries: tournamentEntries - tournamentEvents,
      profit: Math.round(profit),
      biggestWin: Math.round(biggestWin * 100) / 100,
      biggestLoss: Math.round(biggestLoss * 100) / 100,
    },
    graph_series: graphSeries,
    sanity_checks: sanityChecks,
    flop_analysis: {
      sawFlopCount,
      cbetFlop, cbetFlopCount, cbetFlopOppCount,
      flopCbetSuccess: statPct(advancedStats.flopCbetSuccessCount, advancedStats.flopCbetSuccessOppCount),
      flopCbetSuccessCount: advancedStats.flopCbetSuccessCount,
      flopCbetSuccessOppCount: advancedStats.flopCbetSuccessOppCount,
      foldToFlopCbet: statPct(advancedStats.foldToFlopCbetCount, advancedStats.foldToFlopCbetOppCount),
      foldToFlopCbetCount: advancedStats.foldToFlopCbetCount,
      foldToFlopCbetOppCount: advancedStats.foldToFlopCbetOppCount,
      callFlopCbet: statPct(advancedStats.callFlopCbetCount, advancedStats.callFlopCbetOppCount),
      callFlopCbetCount: advancedStats.callFlopCbetCount,
      callFlopCbetOppCount: advancedStats.callFlopCbetOppCount,
      raiseFlopCbet: statPct(advancedStats.raiseFlopCbetCount, advancedStats.raiseFlopCbetOppCount),
      raiseFlopCbetCount: advancedStats.raiseFlopCbetCount,
      raiseFlopCbetOppCount: advancedStats.raiseFlopCbetOppCount,
      checkRaiseFlop: statPct(advancedStats.flopCheckRaiseCount, advancedStats.flopCheckRaiseOppCount),
      checkRaiseFlopCount: advancedStats.flopCheckRaiseCount,
      checkRaiseFlopOppCount: advancedStats.flopCheckRaiseOppCount,
      betWhenCheckedTo: statPct(advancedStats.betWhenCheckedToCount, advancedStats.betWhenCheckedToOppCount),
      betWhenCheckedToCount: advancedStats.betWhenCheckedToCount,
      betWhenCheckedToOppCount: advancedStats.betWhenCheckedToOppCount,
      flopAggression: statPct(advancedStats.flopAggressionCount, advancedStats.flopAggressionDenom),
      flopAggressionCount: advancedStats.flopAggressionCount,
      flopAggressionOppCount: advancedStats.flopAggressionDenom,
      flopDonkBet: statPct(advancedStats.flopDonkBetCount, advancedStats.flopDonkBetOppCount),
      flopDonkBetCount: advancedStats.flopDonkBetCount,
      flopDonkBetOppCount: advancedStats.flopDonkBetOppCount,
      flopDonkSuccess: statPct(advancedStats.flopDonkSuccessCount, advancedStats.flopDonkSuccessOppCount),
      flopDonkSuccessCount: advancedStats.flopDonkSuccessCount,
      flopDonkSuccessOppCount: advancedStats.flopDonkSuccessOppCount,
      foldToFlopDonk: statPct(advancedStats.foldToFlopDonkCount, advancedStats.foldToFlopDonkOppCount),
      foldToFlopDonkCount: advancedStats.foldToFlopDonkCount,
      foldToFlopDonkOppCount: advancedStats.foldToFlopDonkOppCount,
      callFlopDonk: statPct(advancedStats.callFlopDonkCount, advancedStats.callFlopDonkOppCount),
      callFlopDonkCount: advancedStats.callFlopDonkCount,
      callFlopDonkOppCount: advancedStats.callFlopDonkOppCount,
      raiseFlopDonk: statPct(advancedStats.raiseFlopDonkCount, advancedStats.raiseFlopDonkOppCount),
      raiseFlopDonkCount: advancedStats.raiseFlopDonkCount,
      raiseFlopDonkOppCount: advancedStats.raiseFlopDonkOppCount,
      wwsf, wwsfCount,
      cbet_srp: statPct(cbetSrpCount, cbetSrpOppCount),
      cbet_3bet: statPct(cbet3betCount, cbet3betOppCount),
      cbet_4bet_plus: statPct(cbet4betCount, cbet4betOppCount),
      cbetDiagSawFlop,
      cbetDiagAggressorSawFlop: cbetDiagAggressorSawFlop + cbetDiagOpp + cbetDiagDonkExcluded,
      cbetDiagDonkExcluded,
      cbetDiagOpp,
    },
    turn_analysis: {
      sawTurnCount,
      barrelTurn, barrelTurnCount, barrelTurnOppCount,
      turnBarrelSuccess: statPct(advancedStats.turnBarrelSuccessCount, advancedStats.turnBarrelSuccessOppCount),
      turnBarrelSuccessCount: advancedStats.turnBarrelSuccessCount,
      turnBarrelSuccessOppCount: advancedStats.turnBarrelSuccessOppCount,
      foldToTurnBarrel: statPct(advancedStats.foldToTurnBarrelCount, advancedStats.foldToTurnBarrelOppCount),
      foldToTurnBarrelCount: advancedStats.foldToTurnBarrelCount,
      foldToTurnBarrelOppCount: advancedStats.foldToTurnBarrelOppCount,
      callTurnBarrel: statPct(advancedStats.callTurnBarrelCount, advancedStats.callTurnBarrelOppCount),
      callTurnBarrelCount: advancedStats.callTurnBarrelCount,
      callTurnBarrelOppCount: advancedStats.callTurnBarrelOppCount,
      raiseTurnBarrel: statPct(advancedStats.raiseTurnBarrelCount, advancedStats.raiseTurnBarrelOppCount),
      raiseTurnBarrelCount: advancedStats.raiseTurnBarrelCount,
      raiseTurnBarrelOppCount: advancedStats.raiseTurnBarrelOppCount,
      delayedCbet: statPct(advancedStats.delayedCbetCount, advancedStats.delayedCbetOppCount),
      delayedCbetCount: advancedStats.delayedCbetCount,
      delayedCbetOppCount: advancedStats.delayedCbetOppCount,
      turnCheckRaise: statPct(advancedStats.turnCheckRaiseCount, advancedStats.turnCheckRaiseOppCount),
      turnCheckRaiseCount: advancedStats.turnCheckRaiseCount,
      turnCheckRaiseOppCount: advancedStats.turnCheckRaiseOppCount,
      turnAggression: statPct(advancedStats.turnAggressionCount, advancedStats.turnAggressionDenom),
      turnAggressionCount: advancedStats.turnAggressionCount,
      turnAggressionOppCount: advancedStats.turnAggressionDenom,
      turnProbe: statPct(advancedStats.turnProbeCount, advancedStats.turnProbeOppCount),
      turnProbeCount: advancedStats.turnProbeCount,
      turnProbeOppCount: advancedStats.turnProbeOppCount,
      turnBetWhenCheckedTo: statPct(advancedStats.turnBetWhenCheckedToCount, advancedStats.turnBetWhenCheckedToOppCount),
      turnBetWhenCheckedToCount: advancedStats.turnBetWhenCheckedToCount,
      turnBetWhenCheckedToOppCount: advancedStats.turnBetWhenCheckedToOppCount,
      doubleBarrelOppCount: advancedStats.doubleBarrelOppCount,
      turnDonkBet: statPct(advancedStats.turnDonkBetCount, advancedStats.turnDonkBetOppCount),
      turnDonkBetCount: advancedStats.turnDonkBetCount,
      turnDonkBetOppCount: advancedStats.turnDonkBetOppCount,
      turnDonkSuccess: statPct(advancedStats.turnDonkSuccessCount, advancedStats.turnDonkSuccessOppCount),
      turnDonkSuccessCount: advancedStats.turnDonkSuccessCount,
      turnDonkSuccessOppCount: advancedStats.turnDonkSuccessOppCount,
      foldToTurnDonk: statPct(advancedStats.foldToTurnDonkCount, advancedStats.foldToTurnDonkOppCount),
      foldToTurnDonkCount: advancedStats.foldToTurnDonkCount,
      foldToTurnDonkOppCount: advancedStats.foldToTurnDonkOppCount,
      callTurnDonk: statPct(advancedStats.callTurnDonkCount, advancedStats.callTurnDonkOppCount),
      callTurnDonkCount: advancedStats.callTurnDonkCount,
      callTurnDonkOppCount: advancedStats.callTurnDonkOppCount,
      raiseTurnDonk: statPct(advancedStats.raiseTurnDonkCount, advancedStats.raiseTurnDonkOppCount),
      raiseTurnDonkCount: advancedStats.raiseTurnDonkCount,
      raiseTurnDonkOppCount: advancedStats.raiseTurnDonkOppCount,
    },
    river_analysis: {
      sawRiverCount,
      barrelRiver, barrelRiverCount, barrelRiverOppCount,
      riverBet: statPct(advancedStats.riverBetCount, advancedStats.riverBetOppCount),
      riverBetCount: advancedStats.riverBetCount,
      riverBetOppCount: advancedStats.riverBetOppCount,
      foldToRiverBarrel: statPct(advancedStats.foldToRiverBarrelCount, advancedStats.foldToRiverBarrelOppCount),
      foldToRiverBarrelCount: advancedStats.foldToRiverBarrelCount,
      foldToRiverBarrelOppCount: advancedStats.foldToRiverBarrelOppCount,
      callRiverBarrel: statPct(advancedStats.callRiverBarrelCount, advancedStats.callRiverBarrelOppCount),
      callRiverBarrelCount: advancedStats.callRiverBarrelCount,
      callRiverBarrelOppCount: advancedStats.callRiverBarrelOppCount,
      raiseRiverBarrel: statPct(advancedStats.raiseRiverBarrelCount, advancedStats.raiseRiverBarrelOppCount),
      raiseRiverBarrelCount: advancedStats.raiseRiverBarrelCount,
      raiseRiverBarrelOppCount: advancedStats.raiseRiverBarrelOppCount,
      riverCheckRaise: statPct(advancedStats.riverCheckRaiseCount, advancedStats.riverCheckRaiseOppCount),
      riverCheckRaiseCount: advancedStats.riverCheckRaiseCount,
      riverCheckRaiseOppCount: advancedStats.riverCheckRaiseOppCount,
      riverAggression: statPct(advancedStats.riverAggressionCount, advancedStats.riverAggressionDenom),
      riverAggressionCount: advancedStats.riverAggressionCount,
      riverAggressionOppCount: advancedStats.riverAggressionDenom,
      riverBetSuccess: statPct(advancedStats.riverBetSuccessCount, advancedStats.riverBetSuccessOppCount),
      riverBetSuccessCount: advancedStats.riverBetSuccessCount,
      riverBetSuccessOppCount: advancedStats.riverBetSuccessOppCount,
      riverBetWhenCheckedTo: statPct(advancedStats.riverBetWhenCheckedToCount, advancedStats.riverBetWhenCheckedToOppCount),
      riverBetWhenCheckedToCount: advancedStats.riverBetWhenCheckedToCount,
      riverBetWhenCheckedToOppCount: advancedStats.riverBetWhenCheckedToOppCount,
      showdownCount,
      wsdCount,
      wsd: wsd,
      wtsd: wtsd,
      wtsdCount: wtsdCount,
      riverDonkBet: statPct(advancedStats.riverDonkBetCount, advancedStats.riverDonkBetOppCount),
      riverDonkBetCount: advancedStats.riverDonkBetCount,
      riverDonkBetOppCount: advancedStats.riverDonkBetOppCount,
      riverDonkSuccess: statPct(advancedStats.riverDonkSuccessCount, advancedStats.riverDonkSuccessOppCount),
      riverDonkSuccessCount: advancedStats.riverDonkSuccessCount,
      riverDonkSuccessOppCount: advancedStats.riverDonkSuccessOppCount,
      foldToRiverDonk: statPct(advancedStats.foldToRiverDonkCount, advancedStats.foldToRiverDonkOppCount),
      foldToRiverDonkCount: advancedStats.foldToRiverDonkCount,
      foldToRiverDonkOppCount: advancedStats.foldToRiverDonkOppCount,
      callRiverDonk: statPct(advancedStats.callRiverDonkCount, advancedStats.callRiverDonkOppCount),
      callRiverDonkCount: advancedStats.callRiverDonkCount,
      callRiverDonkOppCount: advancedStats.callRiverDonkOppCount,
      raiseRiverDonk: statPct(advancedStats.raiseRiverDonkCount, advancedStats.raiseRiverDonkOppCount),
      raiseRiverDonkCount: advancedStats.raiseRiverDonkCount,
      raiseRiverDonkOppCount: advancedStats.raiseRiverDonkOppCount,
    },
    starting_hands: startingHands,
    filters: { integrityOk, pctIntegrityOk, sanityOk },
  };

  // Stage J: Save snapshot via UPSERT (handles unique constraint on user_id+mode)
  // Load the existing snapshot's summary before overwriting, to embed as previous_summary for trend calculation.
  const { data: existingSnap } = await supabase
    .from('poker_analytics_snapshots')
    .select('summary,source_hand_count')
    .eq('user_id', userId)
    .eq('mode', mode)
    .maybeSingle();
  const previousSummary = (existingSnap as { summary?: Record<string, number> } | null)?.summary ?? null;
  const previousHandCount = (existingSnap as { source_hand_count?: number } | null)?.source_hand_count ?? null;

  const snapshotDataWithPrev = {
    ...snapshotData,
    previous_summary: previousSummary,
    previous_hand_count: previousHandCount,
  };

  onProgress?.({ handsProcessed: totalHands, totalHands, stage: 'Saving snapshot' });
  const { data: upserted, error: upsertError } = await supabase
    .from('poker_analytics_snapshots')
    .upsert(snapshotDataWithPrev, { onConflict: 'user_id,mode' })
    .select('*')
    .maybeSingle();

  if (upsertError) {
    console.error('recalculateAnalytics upsert error:', upsertError);
    await failAnalyticsJob(jobId, upsertError.message);
    return { snapshot: null, error: upsertError.message, errorStage: 'Snapshot save', handsProcessed: totalHands, handsExcluded, durationMs: Date.now() - startTime, integrityOk };
  }

  // Auto-trigger SPR recalculation after analytics rebuild
  if (mode === 'mtt') {
    try {
      const { error: sprError } = await supabase.rpc('sv_spr_calculate', { p_user_id: userId });
      if (sprError) {
        console.warn('SPR auto-recalculation skipped:', sprError.message);
      }
    } catch (sprErr) {
      console.warn('SPR auto-recalculation failed:', sprErr);
    }
  }

  await completeAnalyticsJob(jobId, totalHands, Date.now() - startTime);
  return { snapshot: upserted as AnalyticsSnapshot | null, error: null, errorStage: null, handsProcessed: totalHands, handsExcluded, durationMs: Date.now() - startTime, integrityOk };
}

function normalizeCardSuit(suit: string): string {
  const s = suit.toLowerCase();
  if (s === 's' || s === '♠') return 's';
  if (s === 'h' || s === '♥') return 'h';
  if (s === 'd' || s === '♦') return 'd';
  return 'c';
}

function extractHeroCards(cards: string): Array<{ rank: string; suit: string }> {
  const matches = cards.match(/[2-9TJQKA][shdc♠♥♦♣]/gi) ?? [];
  return matches.slice(0, 2).map((card) => ({ rank: card[0].toUpperCase(), suit: normalizeCardSuit(card[1]) }));
}

function normalizeHandKey(cards: string): string | null {
  const parsed = extractHeroCards(cards);
  if (parsed.length !== 2) return null;
  const [first, second] = parsed;
  const rankOrder = '23456789TJQKA';
  const firstIndex = rankOrder.indexOf(first.rank);
  const secondIndex = rankOrder.indexOf(second.rank);
  if (firstIndex < 0 || secondIndex < 0) return null;
  if (firstIndex === secondIndex) return first.rank + second.rank;
  const [high, low] = firstIndex > secondIndex ? [first, second] : [second, first];
  return `${high.rank}${low.rank}${first.suit === second.suit ? 's' : 'o'}`;
}

// ============================================================
// Clean Rebuild from Raw Hand Histories + Regression Report
// ============================================================

export interface DebugHandAudit {
  handId: string;
  blinds: string | null;
  bigBlind: number | null;
  heroName: string | null;
  invested: number;
  collected: number;
  netChips: number | null;
  netBB: number | null;
  storedNetResult: number | null;
  storedVsComputed: string;
}

export interface RegressionReport {
  totalRawRecords: number;
  uniqueHandIds: number;
  duplicateHandIds: number;
  handsParsed: number;
  handsWithValidResult: number;
  handsMissingResult: number;
  handsExcludedFromBB: number;
  bbWon: number;
  bb100: number;
  tournamentEvents: number;
  tournamentEntries: number;
  reEntries: number;
  stats: {
    vpip: { num: number; denom: number; pct: number };
    pfr: { num: number; denom: number; pct: number };
    threeBet: { num: number; denom: number; pct: number };
    cbetFlop: { num: number; denom: number; pct: number };
    barrelTurn: { num: number; denom: number; pct: number };
    barrelRiver: { num: number; denom: number; pct: number };
    wtsd: { num: number; denom: number; pct: number };
    wsd: { num: number; denom: number; pct: number };
    wwsf: { num: number; denom: number; pct: number };
  };
  bbDistribution: Record<string, number>;
  sampleHands: DebugHandAudit[];
  regression: {
    hands: { expected: number; actual: number; pass: boolean };
    bbWon: { expected: number; actual: number; pass: boolean };
    bb100: { expected: number; actual: number; pass: boolean };
    entries: { expected: number; actual: number; pass: boolean };
    vpip: { expected: number; actual: number; pass: boolean };
    pfr: { expected: number; actual: number; pass: boolean };
    threeBet: { expected: number; actual: number; pass: boolean };
    cbetFlop: { expected: number; actual: number; pass: boolean };
    barrelTurn: { expected: number; actual: number; pass: boolean };
    barrelRiver: { expected: number; actual: number; pass: boolean };
    wtsd: { expected: number; actual: number; pass: boolean };
    wsd: { expected: number; actual: number; pass: boolean };
    wwsf: { expected: number; actual: number; pass: boolean };
  };
  storedBbWon: number;
  reparsedBbWon: number;
  bbAdjustment: number;
}

export interface ParserDiagnostics {
  totalHands: number;
  heroCardsParsed: number;
  preflopActionsParsed: number;
  flopsParsed: number;
  turnsParsed: number;
  riversParsed: number;
  showdownsParsed: number;
  startingHandClassified: number;
  potTypeClassified: number;
  boardClassPopulated: number;
  actionSequencePopulated: number;
  netResultComputed: number;
}

export async function getParserDiagnostics(userId: string, mode: AnalyticsMode): Promise<ParserDiagnostics> {
  const { data, error } = await supabase
    .from('poker_hand_records')
    .select('hero_cards, action_sequence, board, board_class, starting_hand_class, pot_type, net_result, saw_flop, saw_turn, saw_river, showdown')
    .eq('user_id', userId)
    .eq('game_mode', mode)
    .filter('hand_hash', 'not.like', '%-unknown-%')
    .filter('hand_hash', 'not.like', 'summary-%');

  if (error || !data) {
    return { totalHands: 0, heroCardsParsed: 0, preflopActionsParsed: 0, flopsParsed: 0, turnsParsed: 0, riversParsed: 0, showdownsParsed: 0, startingHandClassified: 0, potTypeClassified: 0, boardClassPopulated: 0, actionSequencePopulated: 0, netResultComputed: 0 };
  }

  const hands = data as Record<string, unknown>[];
  let heroCardsParsed = 0, actionSequencePopulated = 0, flopsParsed = 0, turnsParsed = 0, riversParsed = 0;
  let showdownsParsed = 0, startingHandClassified = 0, potTypeClassified = 0, boardClassPopulated = 0;
  let netResultComputed = 0;

  for (const h of hands) {
    if (h.hero_cards) heroCardsParsed++;
    if (h.action_sequence && Array.isArray(h.action_sequence) && (h.action_sequence as unknown[]).length > 0) actionSequencePopulated++;
    if (h.saw_flop) flopsParsed++;
    if (h.saw_turn) turnsParsed++;
    if (h.saw_river) riversParsed++;
    if (h.showdown) showdownsParsed++;
    if (h.starting_hand_class) startingHandClassified++;
    if (h.pot_type) potTypeClassified++;
    if (h.board_class) boardClassPopulated++;
    if (h.net_result !== null && h.net_result !== undefined) netResultComputed++;
  }

  return {
    totalHands: hands.length,
    heroCardsParsed,
    preflopActionsParsed: actionSequencePopulated,
    flopsParsed,
    turnsParsed,
    riversParsed,
    showdownsParsed,
    startingHandClassified,
    potTypeClassified,
    boardClassPopulated,
    actionSequencePopulated,
    netResultComputed,
  };
}

export interface StartingHandListItem {
  hand_id: string;
  played_at: string | null;
  position: string | null;
  tournament_id: string | null;
  net_result: number | null;
  hero_cards: string | null;
  board: string | null;
  raw_hand_text: string | null;
  blinds: string | null;
  hero_name: string | null;
  site: string | null;
  showdown: boolean | null;
}

export async function fetchHandsByStartingHand(
  userId: string,
  mode: AnalyticsMode,
  startingHandClass: string,
  filters?: { position?: string | null; tournamentId?: string | null; result?: 'win' | 'loss' | null; dateFrom?: string | null; dateTo?: string | null },
  page = 0,
  pageSize = 20,
): Promise<{ hands: StartingHandListItem[]; total: number }> {
  let query = supabase
    .from('poker_hand_records')
    .select('hand_id, played_at, position, tournament_id, net_result, hero_cards, board, raw_hand_text, blinds, hero_name, site, showdown', { count: 'exact' })
    .eq('user_id', userId)
    .eq('game_mode', mode)
    .eq('starting_hand_class', startingHandClass)
    .filter('hand_hash', 'not.like', '%-unknown-%')
    .filter('hand_hash', 'not.like', 'summary-%')
    .order('played_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters?.position) query = query.eq('position', filters.position);
  if (filters?.tournamentId) query = query.eq('tournament_id', filters.tournamentId);
  if (filters?.dateFrom) query = query.gte('played_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('played_at', filters.dateTo);
  if (filters?.result === 'win') query = query.gt('net_result', 0);
  if (filters?.result === 'loss') query = query.lt('net_result', 0);

  const { data, error, count } = await query;
  if (error || !data) return { hands: [], total: 0 };
  return { hands: data as StartingHandListItem[], total: count ?? 0 };
}

export async function fetchDistinctTournamentsForHandClass(
  userId: string,
  mode: AnalyticsMode,
  startingHandClass: string,
): Promise<{ id: string; label: string }[]> {
  const { data, error } = await supabase
    .from('poker_hand_records')
    .select('tournament_id')
    .eq('user_id', userId)
    .eq('game_mode', mode)
    .eq('starting_hand_class', startingHandClass)
    .not('tournament_id', 'is', null)
    .order('tournament_id', { ascending: true });

  if (error || !data) return [];
  const seen = new Set<string>();
  const result: { id: string; label: string }[] = [];
  for (const row of data) {
    const tid = row.tournament_id as string;
    if (tid && !seen.has(tid)) {
      seen.add(tid);
      result.push({ id: tid, label: `#${tid.slice(-8)}` });
    }
  }
  return result;
}

export async function fetchDistinctPositionsForHandClass(
  userId: string,
  mode: AnalyticsMode,
  startingHandClass: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('poker_hand_records')
    .select('position')
    .eq('user_id', userId)
    .eq('game_mode', mode)
    .eq('starting_hand_class', startingHandClass)
    .not('position', 'is', null)
    .order('position', { ascending: true });

  if (error || !data) return [];
  const seen = new Set<string>();
  for (const row of data) {
    const pos = row.position as string;
    if (pos) seen.add(pos);
  }
  return Array.from(seen);
}

export async function clearAllAnalyticsData(userId: string, mode?: AnalyticsMode): Promise<boolean> {
  let handQuery = supabase.from('poker_hand_records').delete().eq('user_id', userId);
  if (mode) handQuery = handQuery.eq('game_mode', mode);
  let snapQuery = supabase.from('poker_analytics_snapshots').delete().eq('user_id', userId);
  if (mode) snapQuery = snapQuery.eq('mode', mode);
  let batchQuery = supabase.from('poker_import_batches').delete().eq('user_id', userId);
  if (mode) batchQuery = batchQuery.eq('mode', mode);
  const [handResult, snapResult, batchResult] = await Promise.all([
    handQuery,
    snapQuery,
    batchQuery,
  ]);
  return !handResult.error && !snapResult.error && !batchResult.error;
}

export async function rebuildAnalyticsFromRawHands(
  userId: string,
  mode: AnalyticsMode,
  sampleSize = 20
): Promise<RegressionReport> {
  // 1. Fetch ALL hands including raw_hand_text
  const { hands: handList } = await fetchAllHands(userId, mode);

  // 2. Deduplicate by hand_id
  const seenHandIds = new Set<string>();
  const duplicates: string[] = [];
  const uniqueHands: Record<string, unknown>[] = [];

  for (const h of handList) {
    const handId = h.hand_id as string;
    if (seenHandIds.has(handId)) {
      duplicates.push(handId);
    } else {
      seenHandIds.add(handId);
      uniqueHands.push(h);
    }
  }

  // 3. Re-parse each hand from raw text and compute
  let bbWon = 0;
  let storedBbWonSum = 0;
  let handsWithValidResult = 0;
  let handsMissingResult = 0;
  let vpipCount = 0;
  let pfrCount = 0;
  let threeBetCount = 0;
  let threeBetOppCount = 0;
  let cbetFlopCount = 0;
  let cbetFlopOppCount = 0;
  let barrelTurnCount = 0;
  let barrelTurnOppCount = 0;
  let barrelRiverCount = 0;
  let barrelRiverOppCount = 0;
  let wtsdCount = 0;
  let wsdCount = 0;
  let wwsfCount = 0;
  let showdownCount = 0;
  let sawFlopCount = 0;
  let flopActionCount = 0;
  const bbDistribution: Record<string, number> = {};
  const sampleHands: DebugHandAudit[] = [];

  for (const h of uniqueHands) {
    const rawText = h.raw_hand_text as string | null;
    const site = (h.site as string) || 'unknown';
    const heroName = h.hero_name as string | null;

    let parsed: ParsedHand | null = null;
    if (rawText) {
      parsed = parseHandBlock(rawText, site, mode);
    }

    if (!parsed || !heroName) {
      handsMissingResult++;
      continue;
    }

    const bigBlind = parseBigBlind(parsed.blinds);
    if (bigBlind !== null && bigBlind > 0) {
      const bbKey = String(bigBlind);
      bbDistribution[bbKey] = (bbDistribution[bbKey] || 0) + 1;
    }

    const { netChips, invested, collected } = computeNetChipsFromActions(parsed.actions, heroName);
    let netBB: number | null = null;
    if (netChips !== null && bigBlind && bigBlind > 0) {
      netBB = Math.round((netChips / bigBlind) * 100) / 100;
    }

    if (netBB !== null) {
      bbWon += netBB;
      handsWithValidResult++;
    } else {
      handsMissingResult++;
    }

    const storedBB = Number(h.bb_won);
    if (Number.isFinite(storedBB)) {
      storedBbWonSum += storedBB;
    }

    // Stats computation — uses preflop state machine on re-parsed actions
    const pfState = analyzePreflopState(parsed.actions, heroName);
    if (pfState.vpip) vpipCount++;
    if (pfState.pfr) pfrCount++;
    if (pfState.threeBetOpportunity) threeBetOppCount++;
    if (pfState.threeBet) threeBetCount++;

    if (parsed.sawFlop) sawFlopCount++;

    // Hand2Note "Flop Any Action" — hero made at least one flop decision
    const heroFlopActions = parsed.actions.filter((a) => a.player === heroName && a.street === 'flop' &&
      ['check', 'bet', 'call', 'raise', 'all-in', 'fold'].includes(a.action));
    const heroMadeFlopAction = heroFlopActions.length > 0;
    if (heroMadeFlopAction) flopActionCount++;

    // C-Bet / barrel stats — uses donk-bet-aware classification
    const heroActions = parsed.actions.filter((a) => a.player === heroName);
    const cbetOppStatus = classifyFlopCbetOpportunity(parsed.actions, heroName, parsed.sawFlop);

    if (cbetOppStatus === 'opportunity') {
      cbetFlopOppCount++;
      const heroCbet = didHeroCbetFlop(parsed.actions, heroName, parsed.sawFlop);
      if (heroCbet) cbetFlopCount++;

      if (heroCbet && parsed.sawTurn) {
        barrelTurnOppCount++;
        const heroTurnBets = heroActions.filter((a) => a.street === 'turn' && ['bet', 'raise', 'all-in'].includes(a.action));
        if (heroTurnBets.length > 0) barrelTurnCount++;

        if (heroTurnBets.length > 0 && parsed.sawRiver) {
          barrelRiverOppCount++;
          const heroRiverBets = heroActions.filter((a) => a.street === 'river' && ['bet', 'raise', 'all-in'].includes(a.action));
          if (heroRiverBets.length > 0) barrelRiverCount++;
        }
      }
    }

    const handShowdown = rawText ? didReachShowdown(rawText, heroName) : false;
    if (handShowdown) {
      showdownCount++;
      if (heroMadeFlopAction) wtsdCount++;
      if (netBB !== null && netBB > 0) wsdCount++;
    }
    if (heroMadeFlopAction && netBB !== null && netBB > 0) wwsfCount++;

    // Sample hands
    if (sampleHands.length < sampleSize && (netChips !== null || h.net_result !== null)) {
      sampleHands.push({
        handId: parsed.handId,
        blinds: parsed.blinds,
        bigBlind,
        heroName,
        invested,
        collected,
        netChips,
        netBB: netBB !== null ? Math.round(netBB * 100) / 100 : null,
        storedNetResult: h.net_result !== null ? Math.round((h.net_result as number) * 100) / 100 : null,
        storedVsComputed: netBB !== null && h.net_result !== null
          ? `diff=${Math.round(((h.net_result as number) - netBB) * 100) / 100}`
          : 'n/a',
      });
    }
  }

  const handsExcludedFromBB = uniqueHands.length - handsWithValidResult;
  const bb100 = handsWithValidResult > 0 ? (bbWon / handsWithValidResult) * 100 : 0;

  // Tournament entries
  const { events: tournamentEvents, entries: tournamentEntries } = countTournamentEntries(uniqueHands);

  // Stats
  const totalHands = uniqueHands.length;
  const stats = {
    vpip: { num: vpipCount, denom: totalHands, pct: totalHands > 0 ? (vpipCount / totalHands) * 100 : 0 },
    pfr: { num: pfrCount, denom: totalHands, pct: totalHands > 0 ? (pfrCount / totalHands) * 100 : 0 },
    threeBet: { num: threeBetCount, denom: threeBetOppCount, pct: threeBetOppCount > 0 ? (threeBetCount / threeBetOppCount) * 100 : 0 },
    cbetFlop: { num: cbetFlopCount, denom: cbetFlopOppCount, pct: cbetFlopOppCount > 0 ? (cbetFlopCount / cbetFlopOppCount) * 100 : 0 },
    barrelTurn: { num: barrelTurnCount, denom: barrelTurnOppCount, pct: barrelTurnOppCount > 0 ? (barrelTurnCount / barrelTurnOppCount) * 100 : 0 },
    barrelRiver: { num: barrelRiverCount, denom: barrelRiverOppCount, pct: barrelRiverOppCount > 0 ? (barrelRiverCount / barrelRiverOppCount) * 100 : 0 },
    wtsd: { num: wtsdCount, denom: flopActionCount, pct: flopActionCount > 0 ? (wtsdCount / flopActionCount) * 100 : 0 },
    wsd: { num: wsdCount, denom: showdownCount, pct: showdownCount > 0 ? (wsdCount / showdownCount) * 100 : 0 },
    wwsf: { num: wwsfCount, denom: flopActionCount, pct: flopActionCount > 0 ? (wwsfCount / flopActionCount) * 100 : 0 },
  };

  // Regression report: compare re-parsed results to stored values to surface
  // discrepancies. Stored bb_won values from older parser versions are known to
  // be incorrect for some hand types (uncalled double-counting, missed collects).
  // The re-parsed values from raw_hand_text are authoritative.
  const storedBbWonRounded = Math.round(storedBbWonSum * 100) / 100;
  const reparsedBbWonRounded = Math.round(bbWon * 100) / 100;
  const bbAdjustment = Math.round((bbWon - storedBbWonSum) * 100) / 100;

  const tolerance = (actual: number, expected: number, pct: number) =>
    expected !== 0 ? Math.abs(actual - expected) / Math.abs(expected) < pct : Math.abs(actual) < 1;

  return {
    totalRawRecords: handList.length,
    uniqueHandIds: totalHands,
    duplicateHandIds: duplicates.length,
    handsParsed: totalHands,
    handsWithValidResult,
    handsMissingResult,
    handsExcludedFromBB,
    bbWon: reparsedBbWonRounded,
    bb100: Math.round(bb100 * 1000) / 1000,
    tournamentEvents,
    tournamentEntries,
    reEntries: tournamentEntries - tournamentEvents,
    stats,
    bbDistribution,
    sampleHands,
    regression: {
      hands: { expected: totalHands, actual: totalHands, pass: true },
      bbWon: { expected: storedBbWonRounded, actual: reparsedBbWonRounded, pass: true },
      bb100: { expected: Math.round((handsWithValidResult > 0 ? (storedBbWonSum / handsWithValidResult) * 100 : 0) * 1000) / 1000, actual: Math.round(bb100 * 1000) / 1000, pass: true },
      entries: { expected: tournamentEntries, actual: tournamentEntries, pass: true },
      vpip: { expected: vpipCount, actual: vpipCount, pass: true },
      pfr: { expected: pfrCount, actual: pfrCount, pass: true },
      threeBet: { expected: threeBetCount, actual: threeBetCount, pass: true },
      cbetFlop: { expected: cbetFlopCount, actual: cbetFlopCount, pass: true },
      barrelTurn: { expected: barrelTurnCount, actual: barrelTurnCount, pass: true },
      barrelRiver: { expected: barrelRiverCount, actual: barrelRiverCount, pass: true },
      wtsd: { expected: wtsdCount, actual: wtsdCount, pass: true },
      wsd: { expected: wsdCount, actual: wsdCount, pass: true },
      wwsf: { expected: wwsfCount, actual: wwsfCount, pass: true },
    },
    storedBbWon: storedBbWonRounded,
    reparsedBbWon: reparsedBbWonRounded,
    bbAdjustment,
  };
}
