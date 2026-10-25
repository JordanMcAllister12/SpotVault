import { supabase } from '@/lib/supabase';

export interface MysteryVaultReward {
  id: string;
  name: string;
  description: string | null;
  category: string;
  retail_value: number;
  actual_cost: number;
  quantity_available: number;
  unlimited_inventory: boolean;
  rarity: string;
  probability_weight: number;
  eligibility_restrictions: Record<string, unknown>;
  expiration_date: string | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface MysteryVaultDistribution {
  id: string;
  recipient_id: string | null;
  recipient_name: string | null;
  reward_id: string | null;
  reward_name: string;
  retail_value: number;
  actual_cost: number;
  source: string;
  status: string;
  staff_adjustment: string | null;
  distributed_at: string;
  redeemed_at: string | null;
}

export interface MysteryVaultAuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  staff_id: string | null;
  created_at: string;
}

export interface MysteryVaultConfig {
  id: string;
  distribution_rate: number;
  updated_at: string;
}

export interface DashboardStats {
  totalDistributed: number;
  totalRetailValue: number;
  totalActualCost: number;
  distributedToday: number;
  distributedThisWeek: number;
  distributedThisMonth: number;
  averageRewardValue: number;
  totalRedeemed: number;
  totalPending: number;
  totalRemainingInventory: number;
  projectedMonthlyRewards: number;
  projectedMonthlyRetailValue: number;
  membershipsByTier: Record<string, number>;
}

const MEMBERSHIP_TIERS = ['core', 'pro', 'elite'] as const;

export async function fetchRewards(): Promise<MysteryVaultReward[]> {
  const { data, error } = await supabase
    .from('mystery_vault_rewards')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllRewards(): Promise<MysteryVaultReward[]> {
  const { data, error } = await supabase
    .from('mystery_vault_rewards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function extractSupabaseError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Record<string, unknown>).message === 'string') {
    return (err as Record<string, { message: string }>).message;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

export async function saveReward(reward: Partial<MysteryVaultReward>): Promise<MysteryVaultReward> {
  const { data: userData } = await supabase.auth.getUser();

  const payload: Record<string, unknown> = {
    name: (reward.name ?? '').trim(),
    description: reward.description ?? null,
    category: reward.category ?? 'Custom prizes',
    retail_value: Number(reward.retail_value) || 0,
    actual_cost: Number(reward.actual_cost) || 0,
    quantity_available: reward.unlimited_inventory ? 0 : (Number(reward.quantity_available) || 0),
    unlimited_inventory: Boolean(reward.unlimited_inventory),
    rarity: reward.rarity ?? 'common',
    probability_weight: Number(reward.probability_weight) || 0,
    eligibility_restrictions: reward.eligibility_restrictions ?? {},
    expiration_date: reward.expiration_date
      ? new Date(reward.expiration_date).toISOString()
      : null,
    is_active: reward.is_active !== false,
    is_archived: reward.is_archived ?? false,
    updated_at: new Date().toISOString(),
  };

  if (!payload.name) throw new Error('Reward name is required');
  if (payload.probability_weight <= 0) throw new Error('Probability weight must be a positive number');

  if (reward.id) {
    const { data, error } = await supabase
      .from('mystery_vault_rewards')
      .update(payload)
      .eq('id', reward.id)
      .select()
      .single();
    if (error) throw new Error(extractSupabaseError(error));
    await logAudit('reward_update', 'reward', reward.id, { changes: payload }, userData.user?.id);
    return data;
  } else {
    delete payload.is_archived;
    const { data, error } = await supabase
      .from('mystery_vault_rewards')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(extractSupabaseError(error));
    await logAudit('reward_create', 'reward', data.id, { reward: payload }, userData.user?.id);
    return data;
  }
}

export async function toggleRewardActive(id: string, active: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('mystery_vault_rewards')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await logAudit('reward_toggle', 'reward', id, { is_active: active }, userData.user?.id);
}

export async function archiveReward(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('mystery_vault_rewards')
    .update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await logAudit('reward_archive', 'reward', id, {}, userData.user?.id);
}

export async function fetchDistributionLog(limit = 100): Promise<MysteryVaultDistribution[]> {
  const { data, error } = await supabase
    .from('mystery_vault_distribution')
    .select('*')
    .order('distributed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function awardReward(
  recipientId: string,
  recipientName: string,
  reward: MysteryVaultReward,
  source = 'manual',
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();

  if (!reward.unlimited_inventory && reward.quantity_available <= 0) {
    throw new Error('Inventory depleted for this reward');
  }

  const { error: distError } = await supabase
    .from('mystery_vault_distribution')
    .insert({
      recipient_id: recipientId,
      recipient_name: recipientName,
      reward_id: reward.id,
      reward_name: reward.name,
      retail_value: reward.retail_value,
      actual_cost: reward.actual_cost,
      source,
      status: 'awarded',
    });
  if (distError) throw distError;

  if (!reward.unlimited_inventory) {
    const { error: invError } = await supabase
      .from('mystery_vault_rewards')
      .update({
        quantity_available: Math.max(0, reward.quantity_available - 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reward.id);
    if (invError) throw invError;
  }

  await logAudit('reward_awarded', 'reward', reward.id, {
    recipient_id: recipientId,
    recipient_name: recipientName,
    reward_name: reward.name,
  }, userData.user?.id);
}

export async function reverseDistribution(id: string, reason: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('mystery_vault_distribution')
    .update({ status: 'reversed', staff_adjustment: reason })
    .eq('id', id);
  if (error) throw error;
  await logAudit('distribution_reversed', 'distribution', id, { reason }, userData.user?.id);
}

export async function fetchAuditLog(limit = 50): Promise<MysteryVaultAuditEntry[]> {
  const { data, error } = await supabase
    .from('mystery_vault_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown>,
  staffId?: string,
): Promise<void> {
  await supabase.from('mystery_vault_audit').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    staff_id: staffId ?? null,
  });
}

export async function fetchConfig(): Promise<MysteryVaultConfig> {
  const { data, error } = await supabase
    .from('mystery_vault_config')
    .select('*')
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateDistributionRate(rate: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('mystery_vault_config')
    .update({
      distribution_rate: Math.max(0, Math.min(100, rate)),
      updated_at: new Date().toISOString(),
      updated_by: userData.user?.id,
    })
    .eq('id', '00000000-0000-0000-0000-000000000001');
  if (error) throw error;
  await logAudit('rate_change', 'config', null, { new_rate: rate }, userData.user?.id);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [rewards, distributions, config] = await Promise.all([
    fetchAllRewards(),
    fetchDistributionLog(500),
    fetchConfig(),
  ]);

  const active = distributions.filter((d) => d.status !== 'reversed');
  const totalDistributed = active.length;
  const totalRetailValue = active.reduce((s, d) => s + Number(d.retail_value), 0);
  const totalActualCost = active.reduce((s, d) => s + Number(d.actual_cost), 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const countSince = (since: Date) =>
    active.filter((d) => new Date(d.distributed_at) >= since).length;

  const distributedToday = countSince(todayStart);
  const distributedThisWeek = countSince(weekStart);
  const distributedThisMonth = countSince(monthStart);

  const averageRewardValue = totalDistributed > 0 ? totalRetailValue / totalDistributed : 0;

  const totalRedeemed = active.filter((d) => d.redeemed_at).length;
  const totalPending = active.filter((d) => !d.redeemed_at).length;

  const totalRemainingInventory = rewards
    .filter((r) => r.is_active && !r.is_archived && !r.unlimited_inventory)
    .reduce((s, r) => s + r.quantity_available, 0);

  const membershipsByTier: Record<string, number> = {};
  for (const tier of MEMBERSHIP_TIERS) {
    membershipsByTier[tier] = active.filter(
      (d) => d.reward_name.toLowerCase().includes(tier),
    ).length;
  }

  const dailyRate = config.distribution_rate / 100;
  const projectedMonthlyRewards = Math.round(dailyRate * 30 * Math.max(1, Math.floor(totalDistributed / Math.max(1, Math.ceil((now.getTime() - new Date(distributions[distributions.length - 1]?.distributed_at || now).getTime()) / 86400000)))));
  const projectedMonthlyRetailValue = projectedMonthlyRewards * averageRewardValue;

  return {
    totalDistributed,
    totalRetailValue,
    totalActualCost,
    distributedToday,
    distributedThisWeek,
    distributedThisMonth,
    averageRewardValue,
    totalRedeemed,
    totalPending,
    totalRemainingInventory,
    projectedMonthlyRewards: isNaN(projectedMonthlyRewards) ? 0 : projectedMonthlyRewards,
    projectedMonthlyRetailValue: isNaN(projectedMonthlyRetailValue) ? 0 : projectedMonthlyRetailValue,
    membershipsByTier,
  };
}

export const REWARD_CATEGORIES = [
  'Core memberships',
  'Pro memberships',
  'Elite membership',
  'Free Spots',
  'Multi-Spot bundles',
  'Credits',
  'Merchandise',
  'Custom prizes',
] as const;

export const RARITY_LEVELS = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export const RATE_LABELS: Record<number, string> = {
  0: 'Disabled',
  25: 'Low',
  50: 'Moderate',
  75: 'High',
  100: 'Maximum',
};

export interface RewardEligibility {
  reward: MysteryVaultReward;
  isEligible: boolean;
  exclusionReason: string | null;
  normalizedProbability: number;
}

export function isRewardExpired(reward: MysteryVaultReward): boolean {
  if (!reward.expiration_date) return false;
  return new Date(reward.expiration_date).getTime() < Date.now();
}

export function isRewardOutOfStock(reward: MysteryVaultReward): boolean {
  return !reward.unlimited_inventory && reward.quantity_available <= 0;
}

export function computeEligibility(rewards: MysteryVaultReward[]): RewardEligibility[] {
  const now = Date.now();
  const eligible = rewards.filter((r) => {
    if (r.is_archived) return false;
    if (!r.is_active) return false;
    if (isRewardExpired(r)) return false;
    if (isRewardOutOfStock(r)) return false;
    return true;
  });

  const totalWeight = eligible.reduce((sum, r) => sum + Number(r.probability_weight), 0);

  return rewards.map((r) => {
    const reasons: string[] = [];
    if (r.is_archived) reasons.push('Archived');
    else if (!r.is_active) reasons.push('Inactive');
    else if (isRewardExpired(r)) reasons.push('Expired');
    else if (isRewardOutOfStock(r)) reasons.push('Out of stock');

    const isEligible = reasons.length === 0;
    const normalizedProbability = isEligible && totalWeight > 0
      ? Number(r.probability_weight) / totalWeight
      : 0;

    return {
      reward: r,
      isEligible,
      exclusionReason: reasons.length > 0 ? reasons.join(', ') : null,
      normalizedProbability,
    };
  });
}

export interface DistributionAnalytics {
  totalRewards: number;
  activeRewards: number;
  finiteInventory: number;
  unlimitedRewards: number;
  averageRewardCost: number;
  totalInventoryLiability: number;
  unlimitedExposure: number;
  eligibility: RewardEligibility[];
}

export function computeDistributionAnalytics(rewards: MysteryVaultReward[]): DistributionAnalytics {
  const nonArchived = rewards.filter((r) => !r.is_archived);
  const eligibility = computeEligibility(nonArchived);
  const eligible = eligibility.filter((e) => e.isEligible);

  const activeRewards = nonArchived.filter((r) => r.is_active).length;
  const finiteInventory = nonArchived
    .filter((r) => !r.unlimited_inventory)
    .reduce((sum, r) => sum + r.quantity_available, 0);
  const unlimitedRewards = nonArchived.filter((r) => r.unlimited_inventory).length;

  const totalEligibleWeight = eligible.reduce((sum, e) => sum + Number(e.reward.probability_weight), 0);
  const averageRewardCost = totalEligibleWeight > 0
    ? eligible.reduce((sum, e) => sum + Number(e.reward.actual_cost) * e.normalizedProbability, 0)
    : 0;

  const totalInventoryLiability = nonArchived
    .filter((r) => !r.unlimited_inventory)
    .reduce((sum, r) => sum + r.quantity_available * Number(r.actual_cost), 0);

  const unlimitedExposure = nonArchived
    .filter((r) => r.unlimited_inventory && r.is_active && !isRewardExpired(r))
    .reduce((sum, r) => sum + Number(r.actual_cost), 0);

  return {
    totalRewards: nonArchived.length,
    activeRewards,
    finiteInventory,
    unlimitedRewards,
    averageRewardCost,
    totalInventoryLiability,
    unlimitedExposure,
    eligibility,
  };
}
