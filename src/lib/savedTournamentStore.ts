import { supabase } from '@/lib/supabase';
import { parseTournamentMetadata } from '@/lib/tournamentHandParser';

export interface SavedTournament {
  id: string;
  user_id: string;
  name: string;
  site: string | null;
  tournament_name: string | null;
  tournament_id: string | null;
  buy_in: string | null;
  played_at: string | null;
  hand_count: number;
  raw_hh_text: string;
  parsed_hands: unknown;
  source_file_name: string | null;
  created_at: string;
}

export interface SavedTournamentSummary {
  id: string;
  name: string;
  site: string | null;
  tournament_name: string | null;
  tournament_id: string | null;
  buy_in: string | null;
  played_at: string | null;
  hand_count: number;
  source_file_name: string | null;
  created_at: string;
}

export async function fetchSavedTournaments(userId: string): Promise<SavedTournamentSummary[]> {
  const { data, error } = await supabase
    .from('sv_saved_tournaments')
    .select('id, name, site, tournament_name, tournament_id, buy_in, played_at, hand_count, source_file_name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchSavedTournaments error:', error.message);
    return [];
  }
  return (data ?? []) as SavedTournamentSummary[];
}

export async function fetchSavedTournament(id: string): Promise<SavedTournament | null> {
  const { data, error } = await supabase
    .from('sv_saved_tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('fetchSavedTournament error:', error.message);
    return null;
  }
  return (data ?? null) as SavedTournament | null;
}

export async function saveTournament(
  userId: string,
  rawText: string,
  fileName?: string | null,
  customName?: string | null,
): Promise<SavedTournament | null> {
  const parsed = parseTournamentMetadata(rawText);
  const displayName =
    customName?.trim() ||
    parsed.tournamentName ||
    (parsed.site ? `${parsed.site} Tournament` : 'Untitled Tournament');

  const { data, error } = await supabase
    .from('sv_saved_tournaments')
    .insert({
      user_id: userId,
      name: displayName,
      site: parsed.site,
      tournament_name: parsed.tournamentName,
      tournament_id: parsed.tournamentId,
      buy_in: parsed.buyIn,
      played_at: parsed.playedAt ? parsed.playedAt.replace(/\//g, '-') : null,
      hand_count: parsed.handCount,
      raw_hh_text: rawText,
      parsed_hands: parsed.hands,
      source_file_name: fileName ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('saveTournament error:', error.message);
    return null;
  }
  return data as SavedTournament;
}

export async function reparseSavedTournament(id: string): Promise<SavedTournament | null> {
  const existing = await fetchSavedTournament(id);
  if (!existing) return null;
  const parsed = parseTournamentMetadata(existing.raw_hh_text);
  const { data, error } = await supabase
    .from('sv_saved_tournaments')
    .update({
      site: parsed.site,
      tournament_name: parsed.tournamentName,
      tournament_id: parsed.tournamentId,
      buy_in: parsed.buyIn,
      hand_count: parsed.handCount,
      parsed_hands: parsed.hands,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('reparseSavedTournament error:', error.message);
    return null;
  }
  return data as SavedTournament;
}

export async function renameSavedTournament(id: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_saved_tournaments')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('renameSavedTournament error:', error.message);
    return false;
  }
  return true;
}

export async function deleteSavedTournament(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_saved_tournaments')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteSavedTournament error:', error.message);
    return false;
  }
  return true;
}
