import { supabase } from '@/lib/supabase';

export interface TournamentSummary {
  tournament_id: string;
  site: string | null;
  hand_count: number;
  first_played: string | null;
  last_played: string | null;
  blinds: string | null;
  game_mode: string | null;
  net_result_sum: number | null;
}

export async function fetchUserTournaments(userId: string): Promise<TournamentSummary[]> {
  const { data, error } = await supabase
    .rpc('get_user_tournaments', { p_user_id: userId });

  if (error || !data) return [];

  return (data as Array<{
    tournament_id: string;
    site: string | null;
    hand_count: number;
    first_played: string | null;
    last_played: string | null;
    blinds: string | null;
    game_mode: string | null;
    net_result_sum: number | null;
  }>).map(row => ({
    tournament_id: row.tournament_id,
    site: row.site,
    hand_count: Number(row.hand_count),
    first_played: row.first_played,
    last_played: row.last_played,
    blinds: row.blinds,
    game_mode: row.game_mode,
    net_result_sum: row.net_result_sum !== null ? Number(row.net_result_sum) : null,
  }));
}

export interface TournamentHand {
  hand_id: string;
  played_at: string | null;
  blinds: string | null;
  position: string | null;
  net_result: number | null;
  pot_amount: number | null;
  showdown: boolean | null;
  tournament_id: string | null;
  hero_cards: string | null;
  board: string | null;
}

export async function fetchTournamentHands(
  userId: string,
  tournamentId: string,
  limit = 500,
): Promise<TournamentHand[]> {
  const { data, error } = await supabase
    .from('poker_hand_records')
    .select('hand_id, played_at, blinds, position, net_result, pot_amount, showdown, tournament_id, hero_cards, board')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .order('played_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as TournamentHand[];
}

export async function fetchHandCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('poker_hand_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error || count === null) return 0;
  return count;
}

// ── Legacy tournament batch system (sv_review_sets with is_tournament=true) ──
// These functions are used by StudentCenter / TournamentLibrary / HandReviewWorkspace
// to manage tournament review sets that contain full hand copies.

import type { HandBatch, ParsedHandRow } from '@/lib/batchStore';

export type TournamentBatch = HandBatch & {
  is_tournament: boolean;
  tournament_site: string | null;
  tournament_name: string | null;
  tournament_ext_id: string | null;
  tournament_date: string | null;
  tournament_buy_in: string | null;
  tournament_game_type: string | null;
  tournament_stakes: string | null;
  tournament_hero: string | null;
  last_viewed_hand_id: string | null;
  last_viewed_index: number | null;
};

export interface TournamentImportResult {
  tournament: TournamentBatch | null;
  added: number;
  duplicates: number;
  errors: number;
  rejected: boolean;
  rejectedHandCount: number;
  isDuplicate: boolean;
  duplicateName: string | null;
}

export async function fetchTournaments(userId: string): Promise<TournamentBatch[]> {
  const { data, error } = await supabase
    .from('sv_review_sets')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_tournament', true)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as TournamentBatch[];
}

export async function importTournament(
  userId: string,
  rawText: string,
  sourceType: 'paste' | 'file_upload',
  fileName?: string,
): Promise<TournamentImportResult> {
  const { parseRawText, addHandsToBatch, detectMode } = await import('@/lib/batchStore');
  const { rows, errors, duplicates: dupCount } = parseRawText(rawText);

  if (rows.length > 1000) {
    return {
      tournament: null, added: 0, duplicates: 0, errors: 0,
      rejected: true, rejectedHandCount: rows.length,
      isDuplicate: false, duplicateName: null,
    };
  }

  if (rows.length === 0) {
    return {
      tournament: null, added: 0, duplicates: dupCount, errors,
      rejected: false, rejectedHandCount: 0,
      isDuplicate: false, duplicateName: null,
    };
  }

  const firstRow = rows[0] as ParsedHandRow;
  const tournamentId = firstRow.tournament_id ?? 'unknown';
  const site = firstRow.site ?? null;
  const tournamentName = fileName ?? `${site ?? 'Tournament'} #${tournamentId.slice(-6)}`;

  const { data: existing } = await supabase
    .from('sv_review_sets')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_tournament', true)
    .eq('tournament_site', site ?? '')
    .eq('tournament_ext_id', tournamentId)
    .maybeSingle();

  let batchId: string;
  let isDuplicate = false;
  let duplicateName: string | null = null;

  if (existing) {
    batchId = (existing as { id: string }).id;
    isDuplicate = true;
    duplicateName = (existing as { title: string }).title;
  } else {
    const { data: newSet, error: createErr } = await supabase
      .from('sv_review_sets')
      .insert({
        owner_id: userId,
        title: tournamentName,
        source_type: sourceType,
        batch_type: 'personal',
        hand_count: 0,
        status: 'active',
        is_tournament: true,
        tournament_site: site,
        tournament_name: tournamentName,
        tournament_ext_id: tournamentId,
        tournament_hero: firstRow.hero_name ?? null,
        tournament_stakes: firstRow.blinds ?? null,
      })
      .select('*')
      .single();

    if (createErr || !newSet) {
      return {
        tournament: null, added: 0, duplicates: 0, errors: rows.length,
        rejected: false, rejectedHandCount: 0,
        isDuplicate: false, duplicateName: null,
      };
    }
    batchId = (newSet as { id: string }).id;
  }

  const result = await addHandsToBatch(batchId, rows, 0);

  const { data: updated } = await supabase
    .from('sv_review_sets')
    .select('*')
    .eq('id', batchId)
    .single();

  return {
    tournament: (updated as unknown as TournamentBatch) ?? null,
    added: result.added,
    duplicates: result.duplicates,
    errors: result.errors,
    rejected: false,
    rejectedHandCount: 0,
    isDuplicate,
    duplicateName,
  };
}

export async function renameTournament(id: string, title: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_review_sets')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteTournament(id: string): Promise<boolean> {
  // Delete hands first, then the set
  await supabase.from('sv_review_hands').delete().eq('review_set_id', id);
  const { error } = await supabase.from('sv_review_sets').delete().eq('id', id);
  return !error;
}

export async function saveLastViewedHand(
  batchId: string,
  handId: string | null,
  index: number | null,
): Promise<void> {
  await supabase
    .from('sv_review_sets')
    .update({
      last_viewed_hand_id: handId,
      last_viewed_index: index,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
}
