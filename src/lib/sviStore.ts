import { supabase } from '@/lib/supabase';

export interface SviFactorDetail {
  raw?: number;
  adjusted?: number;
  percentile: number;
  weight?: number;
  ev_bb100?: number;
  stddev?: number;
  hands?: number;
  profitable?: number;
  total?: number;
  messages?: number;
  available?: boolean;
}

export interface SviUserData {
  user_id: string;
  opted_in: boolean;
  eligible_hands: number;
  eligible_tournaments: number;
  abi: number;
  bb100: number;
  adjusted_bb100: number;
  abi_percentile: number;
  bb100_percentile: number;
  composite_rating: number;
  svi_score: number;
  overall_rank: number;
  total_eligible: number;
  method_version: string;
  calculated_at: string;
  // v2 10-factor fields
  bb100_percentile_v2?: number;
  ev_luck_percentile?: number;
  roi_percentile?: number;
  sample_percentile?: number;
  consistency_percentile?: number;
  final_tables_percentile?: number;
  largest_score_percentile?: number;
  community_percentile?: number;
  factor_detail?: Record<string, SviFactorDetail | number | string>;
  reveal_completed?: boolean;
}

export interface SviSnapshot {
  id: string;
  svi_score: number;
  overall_rank: number;
  total_eligible: number;
  abi: number;
  bb100: number;
  adjusted_bb100: number;
  abi_percentile: number;
  bb100_percentile: number;
  composite_rating: number;
  method_version: string;
  snapshot_at: string;
  bb100_percentile_v2?: number;
  ev_luck_percentile?: number;
  roi_percentile?: number;
  sample_percentile?: number;
  consistency_percentile?: number;
  final_tables_percentile?: number;
  largest_score_percentile?: number;
  community_percentile?: number;
  factor_detail?: Record<string, SviFactorDetail | number | string>;
}

export interface SviLeaderboardEntry {
  user_id: string;
  display_name?: string;
  avatar_url?: string | null;
  privacy_mode?: string;
  svi_score: number;
  overall_rank: number;
  abi: number;
  bb100: number;
  adjusted_bb100: number;
  eligible_hands: number;
  total_eligible: number;
  rank_delta?: number | null;
  perf_delta?: number | null;
  bb100_percentile_v2?: number;
  ev_luck_percentile?: number;
  roi_percentile?: number;
  sample_percentile?: number;
  consistency_percentile?: number;
  final_tables_percentile?: number;
  largest_score_percentile?: number;
  community_percentile?: number;
  factor_detail?: Record<string, SviFactorDetail | number | string>;
  division?: string;
  division_rank?: number;
  honors?: { honor_key: string; awarded_at: string }[];
}

export interface SviDivisionCount {
  division: string;
  player_count: number;
}

export interface SviWeight {
  factor_key: string;
  weight: number;
  label: string;
  description: string;
  display_order: number;
}

export interface SviTier {
  color: string;
  label: string;
}

export const SVI_DIVISIONS = [
  { key: 'recruit',  label: 'Recruit',  min: 0,   max: 5,    color: '#9ca3af' },
  { key: 'bronze',   label: 'Bronze',   min: 5,   max: 10,   color: '#cd7f32' },
  { key: 'silver',   label: 'Silver',   min: 10,  max: 20,   color: '#c0c0c0' },
  { key: 'gold',     label: 'Gold',     min: 20,  max: 40,   color: '#ffd700' },
  { key: 'platinum', label: 'Platinum', min: 40,  max: 60,   color: '#e5e4e2' },
  { key: 'emerald',  label: 'Emerald',  min: 60,  max: 80,   color: '#50c878' },
  { key: 'sapphire', label: 'Sapphire', min: 80,  max: 100,  color: '#0f52ba' },
  { key: 'ruby',     label: 'Ruby',     min: 100, max: 200,  color: '#e0115f' },
  { key: 'diamond',  label: 'Diamond',  min: 200, max: 500,  color: '#b9f2ff' },
  { key: 'onyx',     label: 'Onyx',     min: 500, max: Infinity, color: '#1a1a2e' },
] as const;

export const SVI_RANKS = [
  { key: 'commander',  label: 'Commander',  topPct: 1,  color: '#ffd700' },
  { key: 'general',    label: 'General',    topPct: 5,  color: '#e8c547' },
  { key: 'colonel',    label: 'Colonel',    topPct: 15, color: '#c084fc' },
  { key: 'major',      label: 'Major',      topPct: 30, color: '#60a5fa' },
  { key: 'captain',    label: 'Captain',    topPct: 50, color: '#34d399' },
  { key: 'lieutenant', label: 'Lieutenant', topPct: 100, color: '#9ca3af' },
] as const;

export const SVI_HONORS = [
  { key: 'division_vanguard',   label: 'Division Vanguard',   desc: 'Held #1 in your ABI division for 7+ consecutive days' },
  { key: 'division_commander',  label: 'Division Commander',  desc: 'Earned the Commander rank in your division' },
  { key: 'elite_veteran',       label: 'Elite Veteran',       desc: 'Maintained Top 10% globally for 30+ consecutive days' },
  { key: 'global_vanguard',     label: 'Global Vanguard',     desc: 'Held #1 globally for 7+ consecutive days' },
] as const;

export function sviTier(score: number): SviTier {
  if (score >= 96) return { color: '#ffd700', label: 'Top Ranked' };
  if (score >= 81) return { color: '#d4a52c', label: 'Elite' };
  if (score >= 61) return { color: '#c084fc', label: 'Advanced' };
  if (score >= 41) return { color: '#60a5fa', label: 'Competitive' };
  if (score >= 21) return { color: '#ffffff', label: 'Emerging' };
  return { color: '#9ca3af', label: 'Developing' };
}

export function sviDivision(abi: number): typeof SVI_DIVISIONS[number] | null {
  return SVI_DIVISIONS.find(d => abi >= d.min && abi < d.max) ?? null;
}

export function sviRank(divisionRank: number, totalInDivision: number): typeof SVI_RANKS[number] {
  if (totalInDivision <= 1) return divisionRank === 1 ? SVI_RANKS[0] : SVI_RANKS[SVI_RANKS.length - 1];
  const pct = ((divisionRank - 1) / (totalInDivision - 1)) * 100;
  return SVI_RANKS.find(r => pct <= r.topPct) ?? SVI_RANKS[SVI_RANKS.length - 1];
}

export interface SviUserRank {
  division: string;
  division_rank: number;
  total_in_division: number;
  rank_key: string;
  svi_score: number;
  overall_rank: number;
  total_eligible: number;
}

export interface SviHonor {
  honor_key: string;
  awarded_at: string;
}

export async function fetchSviUser(userId: string): Promise<SviUserData | null> {
  const { data, error } = await supabase.rpc('sv_svi_get_user', { p_user_id: userId });
  if (error || !data || data.length === 0) return null;
  return data[0] as SviUserData;
}

export async function fetchSviSnapshots(userId: string, limit = 30): Promise<SviSnapshot[]> {
  const { data, error } = await supabase.rpc('sv_svi_get_snapshots', { p_user_id: userId, p_limit: limit });
  if (error || !data) return [];
  return data as SviSnapshot[];
}

export async function fetchSviLeaderboard(limit = 50, offset = 0, sortBy: 'svi' | 'abi' | 'bb100' = 'svi'): Promise<SviLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('sv_svi_get_leaderboard_named', { p_limit: limit, p_offset: offset, p_sort_by: sortBy });
  if (error || !data) return [];
  return data as SviLeaderboardEntry[];
}

export async function fetchSviDivisionLeaderboard(division: string, limit = 50, offset = 0): Promise<SviLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('sv_svi_get_division_leaderboard_named', { p_division: division, p_limit: limit, p_offset: offset });
  if (error || !data) return [];
  return data as SviLeaderboardEntry[];
}

export async function fetchSviDivisionCounts(): Promise<SviDivisionCount[]> {
  const { data, error } = await supabase.rpc('sv_svi_get_division_counts');
  if (error || !data) return [];
  return data as SviDivisionCount[];
}

export async function fetchSviWeights(): Promise<SviWeight[]> {
  const { data, error } = await supabase.rpc('sv_svi_get_weights');
  if (error || !data) return [];
  return data as SviWeight[];
}

export async function setSviOptIn(userId: string, optedIn: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('sv_svi_eligibility')
    .update({ opted_in: optedIn })
    .eq('user_id', userId);
  return !error;
}

export async function calculateSviAll(): Promise<boolean> {
  const { error } = await supabase.rpc('sv_svi_calculate_all');
  return !error;
}

export async function createSviSnapshot(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_svi_create_snapshot', { p_user_id: userId });
  return !error;
}

export async function fetchSviUserRank(userId: string): Promise<SviUserRank | null> {
  const { data, error } = await supabase.rpc('sv_svi_get_user_rank', { p_user_id: userId });
  if (error || !data || data.length === 0) return null;
  return data[0] as SviUserRank;
}

export async function fetchSviHonors(userId: string): Promise<SviHonor[]> {
  const { data, error } = await supabase.rpc('sv_svi_get_honors', { p_user_id: userId });
  if (error || !data) return [];
  return data as SviHonor[];
}

export async function revealSviScore(userId: string): Promise<SviUserData | null> {
  const { data, error } = await supabase.rpc('sv_svi_reveal_score', { p_user_id: userId });
  if (error || !data || data.length === 0) return null;
  return data[0] as SviUserData;
}

export interface SviFactorRank {
  rank: number;
  total: number;
}

export async function fetchFactorRank(userId: string, factorKey: string): Promise<SviFactorRank | null> {
  const { data, error } = await supabase.rpc('sv_svi_get_factor_rank', { p_user_id: userId, p_factor_key: factorKey });
  if (error || !data || data.length === 0) return null;
  return data[0] as SviFactorRank;
}

export async function setPrivacyMode(userId: string, mode: 'public' | 'anonymous'): Promise<boolean> {
  const { error } = await supabase.rpc('sv_svi_set_privacy_mode', { p_user_id: userId, p_mode: mode });
  return !error;
}

export async function fetchPrivacyMode(userId: string): Promise<'public' | 'anonymous'> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('privacy_mode')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return 'public';
  return (data.privacy_mode as 'public' | 'anonymous') ?? 'public';
}

// ════════════════════════════════════════════════════
// Persistent Evaluation & Cooldown System
// ════════════════════════════════════════════════════

export interface SviLatestEvaluation {
  evaluation_id: string;
  svi_score: number;
  overall_rank: number;
  total_eligible: number;
  eligible_hands: number;
  eligible_tournaments: number;
  abi: number;
  bb100: number;
  division: string | null;
  division_rank: number | null;
  method_version: string;
  factor_detail: Record<string, unknown>;
  evaluated_at: string;
  animation_unlocked: boolean;
}

export interface SviEvaluationStatus {
  has_evaluation: boolean;
  latest_evaluation: SviLatestEvaluation | null;
  cooldown_remaining_hours: number;
  next_eligible_at: string;
  new_hands_since_eval: number;
  min_new_hands_required: number;
  cooldown_hours_total: number;
  can_recalculate: boolean;
  admin_override: boolean;
  last_evaluation_at: string | null;
  hands_at_last_eval: number;
}

export async function fetchEvaluationStatus(userId: string): Promise<SviEvaluationStatus | null> {
  const { data, error } = await supabase.rpc('sv_svi_get_evaluation_status', { p_user_id: userId });
  if (error || !data) return null;
  return data as SviEvaluationStatus;
}

export async function checkRecalcEligibility(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_svi_check_recalc_eligibility', { p_user_id: userId });
  if (error) return false;
  return data as boolean;
}

export async function countNewHands(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sv_svi_count_new_hands', { p_user_id: userId });
  if (error) return 0;
  return data as number;
}

export interface HandFingerprintInput {
  fingerprint: string;
  platform_hand_id?: string;
  tournament_id?: string;
}

export async function registerHandFingerprints(userId: string, fingerprints: HandFingerprintInput[]): Promise<number> {
  const { data, error } = await supabase.rpc('sv_svi_register_hand_fingerprints', {
    p_user_id: userId,
    p_fingerprints: fingerprints,
  });
  if (error) return 0;
  return data as number;
}

export interface EvaluationDataInput {
  svi_score: number;
  overall_rank: number;
  total_eligible: number;
  eligible_hands: number;
  eligible_tournaments: number;
  abi: number;
  bb100: number;
  division?: string;
  division_rank?: number;
  method_version?: string;
  factor_detail?: Record<string, unknown>;
}

export interface ConsumeEvaluationResult {
  success: boolean;
  evaluation_id?: string;
  evaluated_at?: string;
  error?: string;
}

export async function consumeEvaluation(userId: string, evalData: EvaluationDataInput): Promise<ConsumeEvaluationResult | null> {
  const { data, error } = await supabase.rpc('sv_svi_consume_evaluation', {
    p_user_id: userId,
    p_evaluation_data: evalData,
  });
  if (error) return { success: false, error: error.message };
  return data as ConsumeEvaluationResult;
}

export async function adminOverrideCooldown(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_svi_admin_override_cooldown', { p_user_id: userId });
  return !error;
}
