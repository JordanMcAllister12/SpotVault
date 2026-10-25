import { supabase } from '@/lib/supabase';

// ── Transaction Type Codes ──────────────────────────────────────

export const TRANSACTION_TYPES = {
  MEM: 'Membership',
  CRD: 'Credits',
  SPT: 'Spot / Individual Content',
  CRS: 'Course',
  COA: 'Coaching',
  MSA: 'Multi-Spot Analysis',
  MER: 'Merchandise',
  PRT: 'Portal / Partner Fee',
  RWD: 'Reward / Promotional Credit',
  TRF: 'Credit Transfer',
  REF: 'Refund',
  PAY: 'Partner/Creator/Referral Payout',
  OTH: 'Other',
} as const;

export type TransactionTypeCode = keyof typeof TRANSACTION_TYPES;

export const PAYMENT_STATUS = {
  pending: { label: 'PENDING', color: '#f59e0b' },
  complete: { label: 'COMPLETE', color: '#22c55e' },
  refunded: { label: 'REFUNDED', color: '#3b82f6' },
  failed: { label: 'FAILED', color: '#ef4444' },
  reversed: { label: 'REVERSED', color: '#a855f7' },
} as const;

export const CODE_STATUS = {
  active: { label: 'ACTIVE', color: '#22c55e' },
  inactive: { label: 'INACTIVE', color: '#71717a' },
  scheduled: { label: 'SCHEDULED', color: '#f59e0b' },
  expired: { label: 'EXPIRED', color: '#ef4444' },
} as const;

export const CREDIT_REASON_LABELS: Record<string, string> = {
  purchase: 'Credits Purchased',
  grant: 'Credits Granted',
  promotional: 'Promotional Credits',
  spend: 'Credits Spent',
  transfer: 'Credits Transferred',
  refund: 'Credits Refunded',
  expire: 'Credits Expired',
  admin_adjust: 'Admin Adjustment',
};

// ── Types ───────────────────────────────────────────────────────

export interface SvTransaction {
  id: string;
  transaction_id: string;
  user_id: string | null;
  type_code: string;
  gross_amount: number;
  credit_amount: number;
  currency: string;
  product_name: string | null;
  product_id: string | null;
  destination: string | null;
  recipient: string | null;
  payment_status: string;
  payment_provider_ref: string | null;
  attribution_id: string | null;
  deal_id: string | null;
  group_code: string | null;
  p1_code: string | null;
  p2_code: string | null;
  original_transaction_id: string | null;
  notes: string | null;
  system_metadata: Record<string, unknown>;
  created_at: string;
  refund_for_transaction_id: string | null;
  refund_reason: string | null;
  refund_stripe_id: string | null;
}

export interface SvTransactionSnapshot {
  id: string;
  transaction_id: string;
  attribution_id: string | null;
  deal_id: string | null;
  deal_code: string | null;
  transaction_type: string;
  gross_amount: number;
  credit_amount: number;
  partner_amount: number;
  p1_amount: number;
  p2_amount: number;
  creator_amount: number;
  spotvault_amount: number;
  platform_fee: number;
  deal_version: Record<string, unknown>;
  snapshot_timestamp: string;
}

export interface SvCreditLedgerEntry {
  id: string;
  ledger_id: string;
  transaction_id: string | null;
  user_id: string;
  source: string | null;
  destination: string | null;
  amount: number;
  reason: string;
  reason_type: string;
  related_content: string | null;
  status: string;
  created_at: string;
}

export interface SvAttributionRecord {
  id: string;
  attribution_id: string;
  user_id: string;
  group_code: string;
  p1_code: string;
  p2_code: string;
  deal_id: string | null;
  acquisition_code: string | null;
  acquisition_source: string | null;
  acquisition_date: string;
  associated_lounge: string | null;
  associated_skin: string | null;
  preferred_content_partner: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SvAcquisitionCode {
  id: string;
  code: string;
  group_code: string;
  p1_code: string;
  p2_code: string;
  deal_id: string | null;
  lounge: string | null;
  skin: string | null;
  content_priority: string | null;
  reward_config: Record<string, unknown>;
  status: string;
  start_date: string | null;
  end_date: string | null;
  max_uses: number | null;
  use_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SvDeal {
  id: string;
  deal_code: string;
  label: string;
  description: string | null;
  group_code: string;
  status: string;
  effective_date: string;
  expiration_date: string | null;
  qualification_requirements: Record<string, unknown>;
  lifetime_rules: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SvDealSplit {
  id: string;
  deal_id: string;
  transaction_type: string;
  partner_rule: { type: string; value: number };
  p1_rule: { type: string; value: number };
  p2_rule: { type: string; value: number };
  creator_rule: { type: string; value: number };
  spotvault_rule: { type: string; value: number };
  platform_fee: { type: string; value: number };
  notes: string | null;
}

// ── Fetch functions ─────────────────────────────────────────────

// ── Ledger View Tabs ─────────────────────────────────────────────

export type LedgerView = 'all' | 'payments' | 'credits' | 'subscriptions';

export const LEDGER_VIEWS: { id: LedgerView; label: string }[] = [
  { id: 'all', label: 'All Activity' },
  { id: 'payments', label: 'Payments' },
  { id: 'credits', label: 'Credits & Economy' },
  { id: 'subscriptions', label: 'Subscriptions' },
];

// ── Transaction Category Taxonomy ─────────────────────────────────

export type TransactionCategory =
  | 'credit_purchase' | 'credit_redemption' | 'credit_award' | 'credit_refund' | 'credit_adjustment'
  | 'membership_purchase' | 'membership_renewal' | 'membership_upgrade' | 'membership_downgrade'
  | 'membership_cancellation' | 'membership_expiration'
  | 'marketplace_purchase' | 'creator_earnings' | 'platform_commission' | 'creator_payout'
  | 'payment_refund' | 'chargeback' | 'failed_payment'
  | 'partner_revenue_share' | 'administrative_adjustment'
  | 'other';

export const TRANSACTION_CATEGORIES: Record<TransactionCategory, { label: string; view: LedgerView | 'all' }> = {
  credit_purchase: { label: 'Credit Purchase', view: 'payments' },
  credit_redemption: { label: 'Credit Redemption', view: 'credits' },
  credit_award: { label: 'Credit Award', view: 'credits' },
  credit_refund: { label: 'Credit Refund', view: 'credits' },
  credit_adjustment: { label: 'Credit Adjustment', view: 'credits' },
  membership_purchase: { label: 'Membership Purchase', view: 'payments' },
  membership_renewal: { label: 'Membership Renewal', view: 'payments' },
  membership_upgrade: { label: 'Membership Upgrade', view: 'subscriptions' },
  membership_downgrade: { label: 'Membership Downgrade', view: 'subscriptions' },
  membership_cancellation: { label: 'Membership Cancellation', view: 'subscriptions' },
  membership_expiration: { label: 'Membership Expiration', view: 'subscriptions' },
  marketplace_purchase: { label: 'Marketplace Purchase', view: 'payments' },
  creator_earnings: { label: 'Creator Earnings', view: 'all' },
  platform_commission: { label: 'Platform Commission', view: 'all' },
  creator_payout: { label: 'Creator Payout', view: 'payments' },
  payment_refund: { label: 'Payment Refund', view: 'payments' },
  chargeback: { label: 'Chargeback', view: 'payments' },
  failed_payment: { label: 'Failed Payment', view: 'payments' },
  partner_revenue_share: { label: 'Partner Revenue Share', view: 'all' },
  administrative_adjustment: { label: 'Administrative Adjustment', view: 'all' },
  other: { label: 'Other', view: 'all' },
};

const PAYMENT_TYPE_CODES = new Set(['MEM', 'CRD', 'SPT', 'CRS', 'MER', 'PRT', 'PAY', 'REF']);
const CREDIT_TYPE_CODES = new Set(['CRD', 'RWD', 'TRF', 'SPT', 'MSA']);
const SUBSCRIPTION_TYPE_CODES = new Set(['MEM']);

export function classifyTransaction(txn: SvTransaction): TransactionCategory {
  const code = txn.type_code;
  const status = txn.payment_status;
  if (status === 'failed') return 'failed_payment';
  if (status === 'reversed' || txn.refund_for_transaction_id) return 'payment_refund';
  if (code === 'REF') return 'payment_refund';
  if (code === 'PAY') return 'creator_payout';
  if (code === 'RWD') return 'credit_award';
  if (code === 'TRF') return 'credit_adjustment';
  if (code === 'CRD' && txn.gross_amount > 0) return 'credit_purchase';
  if (code === 'CRD' && txn.credit_amount > 0 && txn.gross_amount === 0) return 'credit_redemption';
  if (code === 'SPT' || code === 'MSA' || code === 'CRS') return 'marketplace_purchase';
  if (code === 'MEM') {
    if (txn.system_metadata?.lifecycle_event === 'renewal') return 'membership_renewal';
    if (txn.system_metadata?.lifecycle_event === 'upgrade') return 'membership_upgrade';
    if (txn.system_metadata?.lifecycle_event === 'downgrade') return 'membership_downgrade';
    if (txn.system_metadata?.lifecycle_event === 'cancellation') return 'membership_cancellation';
    if (txn.system_metadata?.lifecycle_event === 'expiration') return 'membership_expiration';
    return 'membership_purchase';
  }
  if (code === 'PRT') return 'partner_revenue_share';
  return 'other';
}

export function getCategoryLabel(cat: TransactionCategory): string {
  return TRANSACTION_CATEGORIES[cat]?.label ?? cat;
}

export function viewMatchesType(view: LedgerView, txn: SvTransaction): boolean {
  if (view === 'all') return true;
  if (view === 'payments') return PAYMENT_TYPE_CODES.has(txn.type_code) || txn.gross_amount > 0;
  if (view === 'credits') return CREDIT_TYPE_CODES.has(txn.type_code) || txn.credit_amount > 0;
  if (view === 'subscriptions') return SUBSCRIPTION_TYPE_CODES.has(txn.type_code);
  return true;
}

export interface TransactionFilter {
  search?: string;
  typeCode?: string;
  status?: string;
  groupCode?: string;
  creditsOnly?: boolean;
  cashOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  view?: LedgerView;
  limit?: number;
  offset?: number;
}

export async function fetchTransactions(filter: TransactionFilter = {}): Promise<{ rows: SvTransaction[]; total: number }> {
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  let query = supabase
    .from('sv_transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.typeCode && filter.typeCode !== 'all') {
    query = query.eq('type_code', filter.typeCode);
  }
  if (filter.status && filter.status !== 'all') {
    query = query.eq('payment_status', filter.status);
  }
  if (filter.groupCode && filter.groupCode !== 'all') {
    query = query.eq('group_code', filter.groupCode);
  }
  if (filter.creditsOnly) {
    query = query.gt('credit_amount', 0);
  }
  if (filter.cashOnly) {
    query = query.gt('gross_amount', 0);
  }
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }
  if (filter.view === 'payments') {
    query = query.gt('gross_amount', 0);
  } else if (filter.view === 'credits') {
    query = query.gt('credit_amount', 0);
  } else if (filter.view === 'subscriptions') {
    query = query.eq('type_code', 'MEM');
  }
  if (filter.search) {
    const s = filter.search.trim();
    query = query.or(`transaction_id.ilike.%${s}%,attribution_id.ilike.%${s}%,group_code.ilike.%${s}%,p1_code.ilike.%${s}%,p2_code.ilike.%${s}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data as unknown as SvTransaction[]) ?? [], total: count ?? 0 };
}

export interface TransactionSummary {
  gross: number;
  refunds: number;
  net: number;
  failed: number;
  pending: number;
  complete: number;
  creditsIssued: number;
  creditsRedeemed: number;
  creditsBalance: number;
  newMemberships: number;
  renewals: number;
  cancellations: number;
  expirations: number;
}

export async function fetchTransactionSummary(filter: TransactionFilter = {}): Promise<TransactionSummary> {
  let query = supabase
    .from('sv_transactions')
    .select('gross_amount, payment_status');

  if (filter.typeCode && filter.typeCode !== 'all') {
    query = query.eq('type_code', filter.typeCode);
  }
  if (filter.status && filter.status !== 'all') {
    query = query.eq('payment_status', filter.status);
  }
  if (filter.groupCode && filter.groupCode !== 'all') {
    query = query.eq('group_code', filter.groupCode);
  }
  if (filter.creditsOnly) {
    query = query.gt('credit_amount', 0);
  }
  if (filter.cashOnly) {
    query = query.gt('gross_amount', 0);
  }
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }
  if (filter.view === 'payments') {
    query = query.gt('gross_amount', 0);
  } else if (filter.view === 'credits') {
    query = query.gt('credit_amount', 0);
  } else if (filter.view === 'subscriptions') {
    query = query.eq('type_code', 'MEM');
  }
  if (filter.search) {
    const s = filter.search.trim();
    query = query.or(`transaction_id.ilike.%${s}%,attribution_id.ilike.%${s}%,group_code.ilike.%${s}%,p1_code.ilike.%${s}%,p2_code.ilike.%${s}%`);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;

  const rows = (data as { gross_amount: number; credit_amount: number; payment_status: string; type_code: string; system_metadata: Record<string, unknown> }[]) ?? [];
  let gross = 0, refunds = 0, failed = 0, pending = 0, complete = 0;
  let creditsIssued = 0, creditsRedeemed = 0, creditsBalance = 0;
  let newMemberships = 0, renewals = 0, cancellations = 0, expirations = 0;
  for (const r of rows) {
    gross += r.gross_amount ?? 0;
    if (r.payment_status === 'refunded') refunds += r.gross_amount ?? 0;
    if (r.payment_status === 'failed') failed++;
    if (r.payment_status === 'pending') pending++;
    if (r.payment_status === 'complete') complete++;
    const cred = r.credit_amount ?? 0;
    if (cred > 0) creditsIssued += cred;
    else creditsRedeemed += Math.abs(cred);
    creditsBalance += cred;
    if (r.type_code === 'MEM') {
      const lifecycle = r.system_metadata?.lifecycle_event as string | undefined;
      if (lifecycle === 'renewal') renewals++;
      else if (lifecycle === 'cancellation') cancellations++;
      else if (lifecycle === 'expiration') expirations++;
      else newMemberships++;
    }
  }
  return { gross, refunds, net: gross - refunds, failed, pending, complete, creditsIssued, creditsRedeemed, creditsBalance, newMemberships, renewals, cancellations, expirations };
}

export async function fetchTransactionDetail(transactionId: string): Promise<{ transaction: SvTransaction | null; snapshot: SvTransactionSnapshot | null }> {
  const { data: txn, error: txnError } = await supabase
    .from('sv_transactions')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (txnError) throw txnError;

  const { data: snap, error: snapError } = await supabase
    .from('sv_transaction_snapshots')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (snapError) throw snapError;

  return {
    transaction: txn as unknown as SvTransaction | null,
    snapshot: snap as unknown as SvTransactionSnapshot | null,
  };
}

export async function fetchCreditLedger(userId?: string, limit = 50): Promise<SvCreditLedgerEntry[]> {
  let query = supabase
    .from('sv_credit_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as SvCreditLedgerEntry[]) ?? [];
}

export async function fetchAttributions(limit = 50): Promise<SvAttributionRecord[]> {
  const { data, error } = await supabase
    .from('sv_attribution_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as SvAttributionRecord[]) ?? [];
}

export async function fetchAcquisitionCodes(): Promise<SvAcquisitionCode[]> {
  const { data, error } = await supabase
    .from('sv_acquisition_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as SvAcquisitionCode[]) ?? [];
}

export async function fetchDeals(): Promise<SvDeal[]> {
  const { data, error } = await supabase
    .from('sv_deals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as SvDeal[]) ?? [];
}

export async function fetchDealSplits(dealId: string): Promise<SvDealSplit[]> {
  const { data, error } = await supabase
    .from('sv_deal_splits')
    .select('*')
    .eq('deal_id', dealId)
    .order('transaction_type', { ascending: true });
  if (error) throw error;
  return (data as unknown as SvDealSplit[]) ?? [];
}

// ── Mutation functions ──────────────────────────────────────────

export async function createAcquisitionCode(params: {
  code: string;
  groupCode: string;
  p1Code: string;
  p2Code?: string;
  dealId?: string;
  lounge?: string;
  skin?: string;
  contentPriority?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  maxUses?: number;
}): Promise<SvAcquisitionCode | null> {
  const { data, error } = await supabase
    .from('sv_acquisition_codes')
    .insert({
      code: params.code.toUpperCase().trim(),
      group_code: params.groupCode,
      p1_code: params.p1Code,
      p2_code: params.p2Code ?? '0',
      deal_id: params.dealId || null,
      lounge: params.lounge || null,
      skin: params.skin || null,
      content_priority: params.contentPriority || null,
      status: params.status ?? 'active',
      start_date: params.startDate || null,
      end_date: params.endDate || null,
      max_uses: params.maxUses ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SvAcquisitionCode;
}

export async function updateAcquisitionCode(id: string, updates: Partial<SvAcquisitionCode>): Promise<boolean> {
  const { error } = await supabase
    .from('sv_acquisition_codes')
    .update({
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.lounge !== undefined && { lounge: updates.lounge }),
      ...(updates.skin !== undefined && { skin: updates.skin }),
      ...(updates.content_priority !== undefined && { content_priority: updates.content_priority }),
      ...(updates.max_uses !== undefined && { max_uses: updates.max_uses }),
      ...(updates.end_date !== undefined && { end_date: updates.end_date }),
      ...(updates.start_date !== undefined && { start_date: updates.start_date }),
    })
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function createDeal(params: {
  dealCode: string;
  label: string;
  description?: string;
  groupCode?: string;
  notes?: string;
}): Promise<SvDeal | null> {
  const { data, error } = await supabase
    .from('sv_deals')
    .insert({
      deal_code: params.dealCode.toUpperCase().trim(),
      label: params.label,
      description: params.description || null,
      group_code: params.groupCode ?? '0',
      notes: params.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SvDeal;
}

export async function updateDealSplit(id: string, updates: {
  partnerRule?: { type: string; value: number };
  p1Rule?: { type: string; value: number };
  p2Rule?: { type: string; value: number };
  creatorRule?: { type: string; value: number };
  spotvaultRule?: { type: string; value: number };
}): Promise<boolean> {
  const { error } = await supabase
    .from('sv_deal_splits')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function createAttribution(params: {
  userId: string;
  groupCode: string;
  p1Code: string;
  p2Code?: string;
  dealId?: string;
  acquisitionCode?: string;
  acquisitionSource?: string;
  associatedLounge?: string;
  associatedSkin?: string;
  preferredContentPartner?: string;
  notes?: string;
}): Promise<{ attributionId: string } | null> {
  const { data: attrId } = await supabase.rpc('sv_generate_attribution_id');
  if (!attrId) throw new Error('Failed to generate attribution ID');

  const { error } = await supabase
    .from('sv_attribution_records')
    .insert({
      attribution_id: attrId,
      user_id: params.userId,
      group_code: params.groupCode,
      p1_code: params.p1Code,
      p2_code: params.p2Code ?? '0',
      deal_id: params.dealId || null,
      acquisition_code: params.acquisitionCode || null,
      acquisition_source: params.acquisitionSource || 'admin_grant',
      associated_lounge: params.associatedLounge || null,
      associated_skin: params.associatedSkin || null,
      preferred_content_partner: params.preferredContentPartner || null,
      notes: params.notes || null,
    });
  if (error) throw error;
  return { attributionId: attrId };
}

export async function testAcquisitionCode(code: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('sv_test_acquisition_code', { p_code: code });
  if (error) throw error;
  return data as unknown as Record<string, unknown> | null;
}
