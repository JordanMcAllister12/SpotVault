import { supabase } from '@/lib/supabase';

export type ComponentAvailability = 'available' | 'incomplete' | 'missing';

export interface SprComponentDetail {
  key: string;
  weight: number;
  raw_value: number;
  score: number;
  detail: {
    label?: string;
    note?: string | null;
    pool?: string | null;
    raw_label?: string;
    availability?: ComponentAvailability;
  };
}

export interface SprUserData {
  status: 'official' | 'provisional' | 'unqualified';
  spr_score: number;
  percentile: number;
  valid_hands: number;
  tournament_entries: number;
  verified_abi: number;
  estimated_pool: string | null;
  confidence: number;
  model_version: string;
  calculated_at: string;
  components: SprComponentDetail[];
  available_components?: string[];
  excluded_components?: string[];
}

export const COMPONENT_NA_REASONS: Record<string, string> = {
  stack_depth: 'No hand data available to compute stack-depth bb/100.',
  allin_adjusted: 'All-in adjusted EV requires showdown data not yet available in hand histories.',
  competition_strength: 'No verified tournament entries to determine ABI.',
  itm: 'Tournament finish positions are not available from hand histories alone.',
  profit_roi: 'Tournament winnings and entry costs require verified tournament results.',
};

export interface SprWeight {
  key: string;
  weight: number;
  label: string;
}

export const SPR_POOL_LABELS: Record<string, string> = {
  micro: 'Micro',
  low: 'Low',
  small: 'Small',
  mid: 'Mid',
  high: 'High',
  elite: 'Elite',
  super_high: 'Super High',
};

export function sprTierLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Elite', color: '#ffd700' };
  if (score >= 75) return { label: 'Advanced', color: '#d4a52c' };
  if (score >= 60) return { label: 'Competitive', color: '#60a5fa' };
  if (score >= 40) return { label: 'Developing', color: '#34d399' };
  if (score >= 20) return { label: 'Emerging', color: '#9ca3af' };
  return { label: 'Unrated', color: '#6b7280' };
}

export function sprStatusBadge(status: string): { label: string; color: string } {
  if (status === 'official') return { label: 'Official', color: '#4ade80' };
  if (status === 'provisional') return { label: 'Provisional', color: '#d4a52c' };
  return { label: 'Unqualified', color: '#6b7280' };
}

export async function fetchSprUser(userId: string): Promise<SprUserData | null> {
  const { data, error } = await supabase.rpc('sv_spr_get_user', { p_user_id: userId });
  if (error || !data) return null;
  return data as SprUserData;
}

export async function calculateSpr(userId: string): Promise<SprUserData | null> {
  const { data, error } = await supabase.rpc('sv_spr_calculate', { p_user_id: userId });
  if (error || !data) return null;
  return data as SprUserData;
}

export async function fetchSprWeights(): Promise<SprWeight[]> {
  const { data, error } = await supabase.rpc('sv_spr_get_weights');
  if (error || !data) return [];
  return data as SprWeight[];
}

export async function fetchSprHistory(userId: string, limit = 30): Promise<{ spr_score: number; percentile: number; recorded_at: string }[]> {
  const { data, error } = await supabase
    .from('sv_spr_history')
    .select('spr_score, percentile, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data;
}

export interface TournamentMetricsData {
  entries: number;
  total_buyins: number;
  total_payout: number;
  total_cost: number;
  net_profit: number;
  roi: number;
  itm: number;
  itm_count: number;
  abi: number;
  has_results: boolean;
}

export async function fetchTournamentMetrics(userId: string): Promise<TournamentMetricsData | null> {
  const { data, error } = await supabase.rpc('sv_spr_get_tournament_metrics', { p_user_id: userId });
  if (error || !data) return null;
  return data as TournamentMetricsData;
}
