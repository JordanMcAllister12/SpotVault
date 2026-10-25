import { supabase } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

export type BenefitType =
  | 'CONTENT' | 'CHAT' | 'Q&A' | 'DISCOUNT' | 'SWAG' | 'PROMOTION'
  | 'GIVEAWAY' | 'EVENT' | 'EXPERIENCE' | 'BOOKING' | 'PAID_MESSAGE_DISCOUNT' | 'OTHER';

export type DeliveryType =
  | 'GUARANTEED' | 'INCLUDED' | 'DISCOUNTED' | 'EARLY_ACCESS'
  | 'ELIGIBLE' | 'OPPORTUNITY' | 'GIVEAWAY';

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
export type PaidRequestStatus = 'PENDING' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'REFUNDED' | 'DISPUTED';
export type QAThreadStatus = 'OPEN' | 'ANSWERED' | 'OVERDUE' | 'CLOSED';

export interface CreatorSubscription {
  id: string;
  creator_user_id: string;
  name: string;
  description: string | null;
  price_credits: number;
  banner_url: string | null;
  is_active: boolean;
  tier: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionBenefit {
  id: string;
  subscription_id: string;
  title: string;
  description: string | null;
  benefit_type: BenefitType;
  delivery_type: DeliveryType;
  sort_order: number;
  created_at: string;
}

export interface SubscriptionQAConfig {
  id: string;
  subscription_id: string;
  questions_per_month: number;
  follow_ups_per_question: number;
  response_target_hours: number;
}

export interface SubscriberRecord {
  id: string;
  subscription_id: string;
  subscriber_user_id: string;
  creator_user_id: string;
  status: SubscriptionStatus;
  billing_period_start: string;
  billing_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
}

export interface PaidRequest {
  id: string;
  recipient_user_id: string;
  sender_user_id: string;
  price_credits: number;
  request_type: string | null;
  subject: string;
  message: string;
  status: PaidRequestStatus;
  escrow_held: boolean;
  response_window_hours: number;
  expires_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaidRequestSettings {
  id: string;
  user_id: string;
  is_enabled: boolean;
  price_credits: number;
  subscriber_price_credits: number | null;
  request_types: string[];
  max_requests_per_week: number;
  response_window_hours: number;
  who_can_send: string;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  counterparty_id: string | null;
  transaction_type: string;
  amount: number;
  reference_id: string | null;
  reference_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface QAThread {
  id: string;
  allowance_id: string;
  subscriber_user_id: string;
  creator_user_id: string;
  subject: string | null;
  status: QAThreadStatus;
  follow_ups_used: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Credit Balance
// ============================================================

export async function getCreditBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sv_get_credit_balance', { p_user_id: userId });
  if (error) { console.error('getCreditBalance:', error); return 0; }
  return (data as number) ?? 0;
}

export async function getCreditLedger(userId: string, limit = 50): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getCreditLedger:', error); return []; }
  return (data ?? []) as CreditLedgerEntry[];
}

// ============================================================
// Creator Subscriptions — Setup & Management
// ============================================================

export async function fetchCreatorSubscription(creatorUserId: string): Promise<CreatorSubscription | null> {
  const { data, error } = await supabase
    .from('creator_subscriptions')
    .select('*')
    .eq('creator_user_id', creatorUserId)
    .maybeSingle();
  if (error) { console.error('fetchCreatorSubscription:', error); return null; }
  return data as CreatorSubscription | null;
}

export async function fetchSubscriptionById(subId: string): Promise<CreatorSubscription | null> {
  const { data, error } = await supabase
    .from('creator_subscriptions')
    .select('*')
    .eq('id', subId)
    .maybeSingle();
  if (error) { console.error('fetchSubscriptionById:', error); return null; }
  return data as CreatorSubscription | null;
}

export async function upsertCreatorSubscription(
  creatorUserId: string,
  fields: { name: string; description?: string; price_credits: number; banner_url?: string; is_active?: boolean }
): Promise<CreatorSubscription | null> {
  const existing = await fetchCreatorSubscription(creatorUserId);
  if (existing) {
    const { data, error } = await supabase
      .from('creator_subscriptions')
      .update({
        name: fields.name,
        description: fields.description ?? null,
        price_credits: fields.price_credits,
        banner_url: fields.banner_url ?? null,
        is_active: fields.is_active ?? existing.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) { console.error('upsertCreatorSubscription update:', error); return null; }
    return data as CreatorSubscription | null;
  }
  const { data, error } = await supabase
    .from('creator_subscriptions')
    .insert({
      creator_user_id: creatorUserId,
      name: fields.name,
      description: fields.description ?? null,
      price_credits: fields.price_credits,
      banner_url: fields.banner_url ?? null,
      is_active: fields.is_active ?? false,
    })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertCreatorSubscription insert:', error); return null; }
  return data as CreatorSubscription | null;
}

export async function setSubscriptionActive(subId: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('creator_subscriptions')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', subId);
  if (error) { console.error('setSubscriptionActive:', error); return false; }
  return true;
}

// ============================================================
// Subscription Benefits
// ============================================================

export async function fetchBenefits(subscriptionId: string): Promise<SubscriptionBenefit[]> {
  const { data, error } = await supabase
    .from('subscription_benefits')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('sort_order', { ascending: true });
  if (error) { console.error('fetchBenefits:', error); return []; }
  return (data ?? []) as SubscriptionBenefit[];
}

export async function addBenefit(
  subscriptionId: string,
  fields: { title: string; description?: string; benefit_type: BenefitType; delivery_type: DeliveryType }
): Promise<SubscriptionBenefit | null> {
  const { data: existing } = await supabase
    .from('subscription_benefits')
    .select('sort_order')
    .eq('subscription_id', subscriptionId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('subscription_benefits')
    .insert({
      subscription_id: subscriptionId,
      title: fields.title,
      description: fields.description ?? null,
      benefit_type: fields.benefit_type,
      delivery_type: fields.delivery_type,
      sort_order: nextSort,
    })
    .select('*')
    .maybeSingle();
  if (error) { console.error('addBenefit:', error); return null; }
  return data as SubscriptionBenefit | null;
}

export async function deleteBenefit(benefitId: string): Promise<boolean> {
  const { error } = await supabase.from('subscription_benefits').delete().eq('id', benefitId);
  if (error) { console.error('deleteBenefit:', error); return false; }
  return true;
}

// ============================================================
// Subscription Q&A Config
// ============================================================

export async function fetchQAConfig(subscriptionId: string): Promise<SubscriptionQAConfig | null> {
  const { data, error } = await supabase
    .from('subscription_qa_config')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .maybeSingle();
  if (error) { console.error('fetchQAConfig:', error); return null; }
  return data as SubscriptionQAConfig | null;
}

export async function upsertQAConfig(
  subscriptionId: string,
  fields: { questions_per_month: number; follow_ups_per_question: number; response_target_hours: number }
): Promise<SubscriptionQAConfig | null> {
  const existing = await fetchQAConfig(subscriptionId);
  if (existing) {
    const { data, error } = await supabase
      .from('subscription_qa_config')
      .update({
        questions_per_month: fields.questions_per_month,
        follow_ups_per_question: fields.follow_ups_per_question,
        response_target_hours: fields.response_target_hours,
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) { console.error('upsertQAConfig update:', error); return null; }
    return data as SubscriptionQAConfig | null;
  }
  const { data, error } = await supabase
    .from('subscription_qa_config')
    .insert({ subscription_id: subscriptionId, ...fields })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertQAConfig insert:', error); return null; }
  return data as SubscriptionQAConfig | null;
}

// ============================================================
// Subscriber Operations
// ============================================================

export async function subscribeToCreator(subscriberId: string, subscriptionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_subscribe_to_creator', {
    p_subscriber_id: subscriberId,
    p_subscription_id: subscriptionId,
  });
  if (error) { console.error('subscribeToCreator:', error); return false; }
  return data as boolean;
}

export async function cancelSubscription(subscriberId: string, subscriptionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_cancel_subscription', {
    p_subscriber_id: subscriberId,
    p_subscription_id: subscriptionId,
  });
  if (error) { console.error('cancelSubscription:', error); return false; }
  return data as boolean;
}

export async function checkSubscriptionActive(userId: string, creatorId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_check_subscription_active', {
    p_user_id: userId,
    p_creator_id: creatorId,
  });
  if (error) { console.error('checkSubscriptionActive:', error); return false; }
  return data as boolean;
}

export async function fetchMySubscriptions(userId: string): Promise<SubscriberRecord[]> {
  const { data, error } = await supabase
    .from('subscriber_records')
    .select('*')
    .eq('subscriber_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchMySubscriptions:', error); return []; }
  return (data ?? []) as SubscriberRecord[];
}

export async function fetchCreatorSubscribers(creatorUserId: string): Promise<SubscriberRecord[]> {
  const { data, error } = await supabase
    .from('subscriber_records')
    .select('*')
    .eq('creator_user_id', creatorUserId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchCreatorSubscribers:', error); return []; }
  return (data ?? []) as SubscriberRecord[];
}

export async function fetchSubscriberCount(creatorUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from('subscriber_records')
    .select('*', { count: 'exact', head: true })
    .eq('creator_user_id', creatorUserId)
    .eq('status', 'ACTIVE');
  if (error) { console.error('fetchSubscriberCount:', error); return 0; }
  return count ?? 0;
}

// ============================================================
// Q&A
// ============================================================

export async function getQaAllowance(subscriberId: string, creatorId: string): Promise<{
  questions_used: number;
  questions_limit: number;
  follow_ups_limit: number;
  response_target_hours: number;
} | null> {
  const { data, error } = await supabase.rpc('sv_get_qa_allowance', {
    p_subscriber_id: subscriberId,
    p_creator_id: creatorId,
  });
  if (error) { console.error('getQaAllowance:', error); return null; }
  if (!data || (data as unknown[]).length === 0) return null;
  const row = (data as unknown[])[0] as Record<string, number>;
  return {
    questions_used: row.questions_used ?? 0,
    questions_limit: row.questions_limit ?? 0,
    follow_ups_limit: row.follow_ups_limit ?? 0,
    response_target_hours: row.response_target_hours ?? 48,
  };
}

export async function createQaThread(subscriberId: string, creatorId: string, subject: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_create_qa_thread', {
    p_subscriber_id: subscriberId,
    p_creator_id: creatorId,
    p_subject: subject,
  });
  if (error) { console.error('createQaThread:', error); return null; }
  return data as string | null;
}

export async function fetchQaThreadsForCreator(creatorUserId: string): Promise<QAThread[]> {
  const { data, error } = await supabase
    .from('qa_threads')
    .select('*')
    .eq('creator_user_id', creatorUserId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchQaThreadsForCreator:', error); return []; }
  return (data ?? []) as QAThread[];
}

// ============================================================
// Paid Requests
// ============================================================

export async function fetchPaidRequestSettings(userId: string): Promise<PaidRequestSettings | null> {
  const { data, error } = await supabase
    .from('paid_request_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('fetchPaidRequestSettings:', error); return null; }
  return data as PaidRequestSettings | null;
}

export async function upsertPaidRequestSettings(
  userId: string,
  fields: {
    is_enabled: boolean;
    price_credits: number;
    subscriber_price_credits?: number | null;
    request_types?: string[];
    max_requests_per_week?: number;
    response_window_hours?: number;
    who_can_send?: string;
  }
): Promise<PaidRequestSettings | null> {
  const existing = await fetchPaidRequestSettings(userId);
  const payload = {
    user_id: userId,
    is_enabled: fields.is_enabled,
    price_credits: fields.price_credits,
    subscriber_price_credits: fields.subscriber_price_credits ?? null,
    request_types: fields.request_types ?? existing?.request_types ?? [],
    max_requests_per_week: fields.max_requests_per_week ?? existing?.max_requests_per_week ?? 0,
    response_window_hours: fields.response_window_hours ?? existing?.response_window_hours ?? 48,
    who_can_send: fields.who_can_send ?? existing?.who_can_send ?? 'everyone',
  };
  if (existing) {
    const { data, error } = await supabase
      .from('paid_request_settings')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) { console.error('upsertPaidRequestSettings update:', error); return null; }
    return data as PaidRequestSettings | null;
  }
  const { data, error } = await supabase
    .from('paid_request_settings')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertPaidRequestSettings insert:', error); return null; }
  return data as PaidRequestSettings | null;
}

export async function createPaidRequest(
  senderId: string,
  recipientId: string,
  price: number,
  subject: string,
  message: string,
  requestType: string,
  responseWindowHours: number
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_create_paid_request', {
    p_sender_id: senderId,
    p_recipient_id: recipientId,
    p_price: price,
    p_subject: subject,
    p_message: message,
    p_request_type: requestType,
    p_response_window: responseWindowHours,
  });
  if (error) { console.error('createPaidRequest:', error); return null; }
  return data as string | null;
}

export async function fetchReceivedPaidRequests(recipientId: string): Promise<PaidRequest[]> {
  const { data, error } = await supabase
    .from('paid_requests')
    .select('*')
    .eq('recipient_user_id', recipientId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchReceivedPaidRequests:', error); return []; }
  return (data ?? []) as PaidRequest[];
}

export async function fetchSentPaidRequests(senderId: string): Promise<PaidRequest[]> {
  const { data, error } = await supabase
    .from('paid_requests')
    .select('*')
    .eq('sender_user_id', senderId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchSentPaidRequests:', error); return []; }
  return (data ?? []) as PaidRequest[];
}

export async function acceptPaidRequest(requestId: string, recipientId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_accept_paid_request', {
    p_request_id: requestId,
    p_recipient_id: recipientId,
  });
  if (error) { console.error('acceptPaidRequest:', error); return false; }
  return data as boolean;
}

export async function declinePaidRequest(requestId: string, recipientId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_decline_paid_request', {
    p_request_id: requestId,
    p_recipient_id: recipientId,
  });
  if (error) { console.error('declinePaidRequest:', error); return false; }
  return data as boolean;
}

export async function completePaidRequest(requestId: string, recipientId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_complete_paid_request', {
    p_request_id: requestId,
    p_recipient_id: recipientId,
  });
  if (error) { console.error('completePaidRequest:', error); return false; }
  return data as boolean;
}

// ============================================================
// Content Access
// ============================================================

export async function checkContentAccess(userId: string, spotId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_check_content_access', {
    p_user_id: userId,
    p_spot_id: spotId,
  });
  if (error) { console.error('checkContentAccess:', error); return false; }
  return data as boolean;
}

export async function purchaseContentSpot(buyerId: string, spotId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_purchase_content_spot', {
    p_buyer_id: buyerId,
    p_spot_id: spotId,
  });
  if (error) { console.error('purchaseContentSpot:', error); return false; }
  return data as boolean;
}

// ============================================================
// Constants
// ============================================================

export const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  CONTENT: 'Content',
  CHAT: 'Chat',
  'Q&A': 'Q&A',
  DISCOUNT: 'Discount',
  SWAG: 'Swag',
  PROMOTION: 'Promotion',
  GIVEAWAY: 'Giveaway',
  EVENT: 'Event',
  EXPERIENCE: 'Experience',
  BOOKING: 'Booking',
  PAID_MESSAGE_DISCOUNT: 'Paid Message Discount',
  OTHER: 'Other',
};

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  GUARANTEED: 'Guaranteed',
  INCLUDED: 'Included',
  DISCOUNTED: 'Discounted',
  EARLY_ACCESS: 'Early Access',
  ELIGIBLE: 'Eligible',
  OPPORTUNITY: 'Opportunity',
  GIVEAWAY: 'Giveaway / Chance',
};

export const PAID_REQUEST_LABELS: Record<string, string[]> = {
  creator: ['Ask the Creator', 'Poker Question', 'Industry Question', 'Other'],
  coach: ['Strategy Question', 'Hand Question', 'Study Question', 'Coaching Question'],
  media: ['Media Question', 'Interview Inquiry', 'Poker Industry Question'],
  business: ['Business Inquiry', 'Partnership Question', 'Product Question', 'Consultation'],
};

export const RESPONSE_WINDOW_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 72, label: '72 hours' },
  { value: 168, label: '7 days' },
];

export const QA_QUESTIONS_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1 / month' },
  { value: 2, label: '2 / month' },
  { value: 4, label: '4 / month' },
  { value: -1, label: 'Unlimited' },
];

export const QA_FOLLOWUPS_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: -1, label: 'Unlimited' },
];
