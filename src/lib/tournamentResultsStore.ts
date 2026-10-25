import { supabase } from '@/lib/supabase';

export interface TournamentResult {
  id?: string;
  tournament_id: string;
  source_file_name?: string | null;
  tournament_name?: string | null;
  buy_in: number;
  entry_fee: number;
  payout: number;
  finish_position: number | null;
  total_entrants: number | null;
  is_re_entry: boolean;
  re_entry_number: number;
  poker_site?: string | null;
  played_at?: string | null;
  manually_entered: boolean;
}

export interface TournamentMetrics {
  totalEntries: number;
  totalBuyIns: number;
  totalPayout: number;
  totalCost: number;
  netProfit: number;
  roi: number;
  itmCount: number;
  itm: number;
  abi: number;
}

export async function fetchTournamentResults(userId: string): Promise<TournamentResult[]> {
  const { data, error } = await supabase
    .from('sv_tournament_results')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false });
  if (error || !data) return [];
  return data as TournamentResult[];
}

export async function saveTournamentResult(
  userId: string,
  result: TournamentResult,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('sv_tournament_results')
    .upsert({
      user_id: userId,
      tournament_id: result.tournament_id,
      source_file_name: result.source_file_name ?? null,
      tournament_name: result.tournament_name ?? null,
      buy_in: result.buy_in,
      entry_fee: result.entry_fee,
      payout: result.payout,
      finish_position: result.finish_position,
      total_entrants: result.total_entrants,
      is_re_entry: result.is_re_entry,
      re_entry_number: result.re_entry_number,
      poker_site: result.poker_site ?? null,
      played_at: result.played_at ?? new Date().toISOString(),
      manually_entered: result.manually_entered,
    }, { onConflict: 'user_id,tournament_id,source_file_name' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteTournamentResult(
  userId: string,
  resultId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('sv_tournament_results')
    .delete()
    .eq('id', resultId)
    .eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export function computeTournamentMetrics(results: TournamentResult[]): TournamentMetrics {
  const validResults = results.filter(r => r.buy_in > 0);
  const totalEntries = validResults.length;
  const totalBuyIns = validResults.reduce((sum, r) => sum + r.buy_in, 0);
  const totalFees = validResults.reduce((sum, r) => sum + (r.entry_fee || 0), 0);
  const totalCost = totalBuyIns + totalFees;
  const totalPayout = validResults.reduce((sum, r) => sum + (r.payout || 0), 0);
  const netProfit = totalPayout - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const itmCount = validResults.filter(r => (r.payout || 0) > 0).length;
  const itm = totalEntries > 0 ? (itmCount / totalEntries) * 100 : 0;
  const abi = totalEntries > 0 ? totalBuyIns / totalEntries : 0;

  return {
    totalEntries,
    totalBuyIns,
    totalPayout,
    totalCost,
    netProfit,
    roi,
    itmCount,
    itm,
    abi,
  };
}
