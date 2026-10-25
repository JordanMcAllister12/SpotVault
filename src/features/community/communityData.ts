import { supabase } from '@/lib/supabase';
import type {
  CommunityEntitlement, UserProfile, Accomplishment, AccomplishmentEvidence,
  AccomplishmentReview, FeaturedProfileItem, AccomplishmentWithEvidence,
  AccomplishmentCategory, ReviewStatus, ReviewAction, PrivacyMode,
  CommunityTier,
} from './types';
import {
  DEFAULT_FREE_PRIVILEGES, DEFAULT_MEMBER_PRIVILEGES, TIER_PRIORITY,
} from './types';

// ── Entitlements ──

export async function getEntitlement(userId: string): Promise<CommunityEntitlement | null> {
  const { data, error } = await supabase
    .from('community_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('getEntitlement:', error); return null; }
  return data as CommunityEntitlement | null;
}

export async function ensureEntitlement(userId: string): Promise<CommunityEntitlement> {
  const existing = await getEntitlement(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('community_entitlements')
    .insert({
      user_id: userId,
      tier: 'free',
      is_paid_member: false,
      privileges: DEFAULT_FREE_PRIVILEGES,
      priority_weight: TIER_PRIORITY.free,
    })
    .select('*')
    .single();
  if (error) { console.error('ensureEntitlement:', error); throw error; }
  return data as CommunityEntitlement;
}

export async function setCommunityMember(
  userId: string,
  isMember: boolean,
): Promise<CommunityEntitlement | null> {
  await ensureEntitlement(userId);
  const tier: CommunityTier = isMember ? 'member' : 'free';
  const privileges = isMember ? DEFAULT_MEMBER_PRIVILEGES : DEFAULT_FREE_PRIVILEGES;
  const { data, error } = await supabase
    .from('community_entitlements')
    .update({
      tier,
      is_paid_member: isMember,
      member_since: isMember ? new Date().toISOString() : null,
      privileges,
      priority_weight: TIER_PRIORITY[tier],
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) { console.error('setCommunityMember:', error); return null; }
  return data as CommunityEntitlement | null;
}

// ── Profiles ──

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('getProfile:', error); return null; }
  return data as UserProfile | null;
}

export async function upsertProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertProfile:', error); return null; }
  return data as UserProfile | null;
}

// ── Accomplishments ──

export async function getAccomplishments(userId: string): Promise<AccomplishmentWithEvidence[]> {
  const { data: accs, error } = await supabase
    .from('profile_accomplishments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getAccomplishments:', error); return []; }

  const accsTyped = (accs ?? []) as Accomplishment[];
  if (accsTyped.length === 0) return [];

  const ids = accsTyped.map(a => a.id);
  const { data: evidence, error: evErr } = await supabase
    .from('accomplishment_evidence')
    .select('*')
    .in('accomplishment_id', ids);
  if (evErr) { console.error('getAccomplishments evidence:', evErr); }

  const evidenceTyped = (evidence ?? []) as AccomplishmentEvidence[];
  return accsTyped.map(a => ({
    ...a,
    evidence: evidenceTyped.filter(e => e.accomplishment_id === a.id),
  }));
}

export async function createAccomplishment(
  userId: string,
  input: {
    title: string;
    description?: string;
    category: AccomplishmentCategory;
    accomplishment_date?: string;
    event_name?: string;
    finish?: string;
    prize_amount?: number;
    poker_site?: string;
    tournament_series?: string;
    ranking?: string;
    organization?: string;
  },
): Promise<Accomplishment | null> {
  const { data, error } = await supabase
    .from('profile_accomplishments')
    .insert({ user_id: userId, review_status: 'unreviewed', ...input })
    .select('*')
    .single();
  if (error) { console.error('createAccomplishment:', error); return null; }
  return data as Accomplishment;
}

export async function updateAccomplishment(
  id: string,
  updates: Partial<Accomplishment>,
): Promise<Accomplishment | null> {
  const { data, error } = await supabase
    .from('profile_accomplishments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) { console.error('updateAccomplishment:', error); return null; }
  return data as Accomplishment | null;
}

export async function deleteAccomplishment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('profile_accomplishments')
    .delete()
    .eq('id', id);
  if (error) { console.error('deleteAccomplishment:', error); return false; }
  return true;
}

export async function submitForReview(id: string, userId: string): Promise<Accomplishment | null> {
  const updated = await updateAccomplishment(id, {
    review_status: 'pending',
    submitted_for_review_at: new Date().toISOString(),
  });
  if (updated) {
    await supabase.from('accomplishment_reviews').insert({
      accomplishment_id: id,
      reviewer_id: userId,
      action: 'submit',
      previous_status: 'unreviewed',
      new_status: 'pending',
    });
  }
  return updated;
}

// ── Evidence ──

export async function addEvidence(
  accomplishmentId: string,
  input: { evidence_type: string; url?: string; label?: string; reviewer_notes?: string },
): Promise<AccomplishmentEvidence | null> {
  const { data, error } = await supabase
    .from('accomplishment_evidence')
    .insert({ accomplishment_id: accomplishmentId, ...input })
    .select('*')
    .single();
  if (error) { console.error('addEvidence:', error); return null; }
  return data as AccomplishmentEvidence;
}

export async function deleteEvidence(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('accomplishment_evidence')
    .delete()
    .eq('id', id);
  if (error) { console.error('deleteEvidence:', error); return false; }
  return true;
}

// ── Staff Review ──

export async function getPendingAccomplishments(): Promise<AccomplishmentWithEvidence[]> {
  const { data: accs, error } = await supabase
    .from('profile_accomplishments')
    .select('*')
    .in('review_status', ['pending', 'needs_info'])
    .order('submitted_for_review_at', { ascending: true });
  if (error) { console.error('getPendingAccomplishments:', error); return []; }

  const accsTyped = (accs ?? []) as Accomplishment[];
  if (accsTyped.length === 0) return [];

  const ids = accsTyped.map(a => a.id);
  const { data: evidence } = await supabase
    .from('accomplishment_evidence')
    .select('*')
    .in('accomplishment_id', ids);
  const evidenceTyped = (evidence ?? []) as AccomplishmentEvidence[];

  return accsTyped.map(a => ({
    ...a,
    evidence: evidenceTyped.filter(e => e.accomplishment_id === a.id),
  }));
}

export async function staffReviewAction(
  accomplishmentId: string,
  reviewerId: string,
  action: ReviewAction,
  newStatus: ReviewStatus,
  notes?: string,
): Promise<Accomplishment | null> {
  const { data: current } = await supabase
    .from('profile_accomplishments')
    .select('review_status')
    .eq('id', accomplishmentId)
    .maybeSingle();

  const previousStatus = (current as { review_status: string } | null)?.review_status ?? null;

  const updated = await updateAccomplishment(accomplishmentId, {
    review_status: newStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId,
    staff_notes: notes,
  });

  if (updated) {
    await supabase.from('accomplishment_reviews').insert({
      accomplishment_id: accomplishmentId,
      reviewer_id: reviewerId,
      action,
      previous_status: previousStatus,
      new_status: newStatus,
      notes: notes ?? null,
    });
  }
  return updated;
}

// ── Featured Items ──

export async function getFeaturedItems(userId: string): Promise<FeaturedProfileItem[]> {
  const { data, error } = await supabase
    .from('featured_profile_items')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true });
  if (error) { console.error('getFeaturedItems:', error); return []; }
  return (data ?? []) as FeaturedProfileItem[];
}

export async function setFeaturedItems(
  userId: string,
  accomplishmentIds: string[],
): Promise<FeaturedProfileItem[]> {
  await supabase.from('featured_profile_items').delete().eq('user_id', userId);
  if (accomplishmentIds.length === 0) return [];
  const rows = accomplishmentIds.map((id, i) => ({
    user_id: userId,
    accomplishment_id: id,
    display_order: i + 1,
  }));
  const { data, error } = await supabase
    .from('featured_profile_items')
    .insert(rows)
    .select('*');
  if (error) { console.error('setFeaturedItems:', error); return []; }
  return (data ?? []) as FeaturedProfileItem[];
}

// ── Composite fetch for hover card ──

export interface HoverCardData {
  profile: UserProfile | null;
  entitlement: CommunityEntitlement | null;
  accomplishments: AccomplishmentWithEvidence[];
  featured: FeaturedProfileItem[];
}

export async function getHoverCardData(userId: string): Promise<HoverCardData> {
  const [profile, entitlement, accomplishments, featured] = await Promise.all([
    getProfile(userId),
    getEntitlement(userId),
    getAccomplishments(userId),
    getFeaturedItems(userId),
  ]);
  return { profile, entitlement, accomplishments, featured };
}

export function getTopAccomplishments(
  accomplishments: AccomplishmentWithEvidence[],
  featured: FeaturedProfileItem[],
  max = 4,
): AccomplishmentWithEvidence[] {
  if (featured.length > 0) {
    const featuredAccs = featured
      .map(f => accomplishments.find(a => a.id === f.accomplishment_id))
      .filter((a): a is AccomplishmentWithEvidence => a !== undefined && a.review_status === 'verified');
    if (featuredAccs.length > 0) return featuredAccs.slice(0, max);
  }
  return accomplishments
    .filter(a => a.review_status === 'verified')
    .slice(0, max);
}
