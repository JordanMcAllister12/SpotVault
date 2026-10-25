import { supabase } from '@/lib/supabase';

export type PortalType = 'creator-portal' | 'coach-portal' | 'business-portal' | 'stable-portal' | 'media-portal';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface ServiceEntry {
  name: string;
  description?: string;
  price?: string;
  priceUnit?: string;
}

export interface PricingInfo {
  hourlyRate?: string;
  packagePricing?: string;
  contactForPricing?: boolean;
}

export interface AvailabilityInfo {
  isAvailable?: boolean;
  availabilityText?: string;
  acceptsOnline?: boolean;
  acceptsInPerson?: boolean;
}

export interface LinkEntry {
  label: string;
  url: string;
}

export interface ProfessionalListing {
  id: string;
  user_id: string;
  portal_type: PortalType;
  display_name: string;
  professional_title: string;
  short_bio: string;
  long_description: string | null;
  profile_image_url: string | null;
  specialties: string[];
  services: ServiceEntry[];
  pricing: PricingInfo;
  availability: AvailabilityInfo;
  location: string;
  is_remote: boolean;
  links: LinkEntry[];
  contact_cta_label: string;
  contact_cta_url: string | null;
  moderation_status: ModerationStatus;
  moderation_note: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalEntitlement {
  portal_type: string;
  subscription_tier: string;
  directory_listing_enabled: boolean;
  passive_feed_discovery_enabled: boolean;
  monthly_main_feed_post_allowance: number;
  main_feed_promotion_duration_hours: number;
  social_feed_promotion_enabled: boolean;
}

export interface PromotionUsage {
  used: number;
  allowance: number;
  remaining: number;
  billing_period: string;
  resets_at: string;
  duration_hours: number;
}

export interface CreateListingInput {
  portal_type: PortalType;
  display_name: string;
  professional_title: string;
  short_bio: string;
  long_description?: string;
  profile_image_url?: string;
  specialties?: string[];
  services?: ServiceEntry[];
  pricing?: PricingInfo;
  availability?: AvailabilityInfo;
  location?: string;
  is_remote?: boolean;
  links?: LinkEntry[];
  contact_cta_label?: string;
  contact_cta_url?: string;
}

export async function fetchMyListings(): Promise<ProfessionalListing[]> {
  const { data, error } = await supabase
    .from('professional_listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfessionalListing[];
}

export async function fetchMyListing(portalType: PortalType): Promise<ProfessionalListing | null> {
  const { data, error } = await supabase
    .from('professional_listings')
    .select('*')
    .eq('portal_type', portalType)
    .maybeSingle();
  if (error) throw error;
  return data as ProfessionalListing | null;
}

export async function fetchPublicListings(filters?: {
  portalType?: PortalType | 'all';
  search?: string;
}): Promise<ProfessionalListing[]> {
  let query = supabase
    .from('professional_listings')
    .select('*')
    .eq('moderation_status', 'approved')
    .eq('is_visible', true)
    .order('created_at', { ascending: false });

  if (filters?.portalType && filters.portalType !== 'all') {
    query = query.eq('portal_type', filters.portalType);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = (data ?? []) as ProfessionalListing[];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (l) =>
        l.display_name.toLowerCase().includes(q) ||
        l.professional_title.toLowerCase().includes(q) ||
        l.short_bio.toLowerCase().includes(q) ||
        l.specialties.some((s) => s.toLowerCase().includes(q))
    );
  }
  return results;
}

// ── Industry Rolodex ──

export interface RolodexResult {
  id: string;
  user_id: string;
  portal_type: PortalType;
  display_name: string;
  professional_title: string;
  short_bio: string;
  profile_image_url: string | null;
  specialties: string[];
  available_for: string[];
  pricing: PricingInfo;
  availability: AvailabilityInfo;
  location: string;
  is_remote: boolean;
  links: LinkEntry[];
  contact_cta_label: string;
  contact_cta_url: string | null;
  allow_spotvault_messages: boolean;
}

export interface RolodexDetail extends RolodexResult {
  long_description: string | null;
  services: ServiceEntry[];
}

export async function searchRolodex(params: {
  search?: string;
  portalType?: PortalType | 'all';
  viewerRole?: string;
}): Promise<RolodexResult[]> {
  const { data, error } = await supabase.rpc('sv_search_industry_rolodex', {
    p_search: params.search ?? '',
    p_portal_type: params.portalType && params.portalType !== 'all' ? params.portalType : null,
    p_viewer_role: params.viewerRole ?? null,
  });
  if (error) throw error;
  return (data ?? []) as RolodexResult[];
}

export async function getRolodexListing(id: string, viewerRole?: string): Promise<RolodexDetail | null> {
  const { data, error } = await supabase.rpc('sv_get_rolodex_listing', {
    p_listing_id: id,
    p_viewer_role: viewerRole ?? null,
  });
  if (error) throw error;
  return (data as RolodexDetail) ?? null;
}

export async function updateRolodexSettings(
  listingId: string,
  settings: {
    rolodex_opted_in: boolean;
    visible_to_roles: string[];
    available_for: string[];
    allow_spotvault_messages: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from('professional_listings')
    .update({
      rolodex_opted_in: settings.rolodex_opted_in,
      visible_to_roles: settings.visible_to_roles,
      available_for: settings.available_for,
      allow_spotvault_messages: settings.allow_spotvault_messages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);
  if (error) throw error;
}

export async function fetchPublicListing(id: string): Promise<ProfessionalListing | null> {
  const { data, error } = await supabase
    .from('professional_listings')
    .select('*')
    .eq('id', id)
    .eq('moderation_status', 'approved')
    .eq('is_visible', true)
    .maybeSingle();
  if (error) throw error;
  return data as ProfessionalListing | null;
}

export async function createListing(input: CreateListingInput): Promise<ProfessionalListing> {
  const { data, error } = await supabase
    .from('professional_listings')
    .insert({
      portal_type: input.portal_type,
      display_name: input.display_name,
      professional_title: input.professional_title,
      short_bio: input.short_bio,
      long_description: input.long_description ?? '',
      profile_image_url: input.profile_image_url ?? null,
      specialties: input.specialties ?? [],
      services: input.services ?? [],
      pricing: input.pricing ?? {},
      availability: input.availability ?? {},
      location: input.location ?? '',
      is_remote: input.is_remote ?? false,
      links: input.links ?? [],
      contact_cta_label: input.contact_cta_label ?? 'Contact',
      contact_cta_url: input.contact_cta_url ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProfessionalListing;
}

export async function updateListing(
  id: string,
  updates: Partial<CreateListingInput>
): Promise<ProfessionalListing> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
  if (updates.professional_title !== undefined) updateData.professional_title = updates.professional_title;
  if (updates.short_bio !== undefined) updateData.short_bio = updates.short_bio;
  if (updates.long_description !== undefined) updateData.long_description = updates.long_description;
  if (updates.profile_image_url !== undefined) updateData.profile_image_url = updates.profile_image_url;
  if (updates.specialties !== undefined) updateData.specialties = updates.specialties;
  if (updates.services !== undefined) updateData.services = updates.services;
  if (updates.pricing !== undefined) updateData.pricing = updates.pricing;
  if (updates.availability !== undefined) updateData.availability = updates.availability;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.is_remote !== undefined) updateData.is_remote = updates.is_remote;
  if (updates.links !== undefined) updateData.links = updates.links;
  if (updates.contact_cta_label !== undefined) updateData.contact_cta_label = updates.contact_cta_label;
  if (updates.contact_cta_url !== undefined) updateData.contact_cta_url = updates.contact_cta_url;

  const { data, error } = await supabase
    .from('professional_listings')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProfessionalListing;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('professional_listings').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchEntitlements(portalType: PortalType): Promise<ProfessionalEntitlement | null> {
  const { data, error } = await supabase
    .from('professional_listing_entitlements')
    .select('*')
    .eq('portal_type', portalType)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data as ProfessionalEntitlement | null;
}

export async function getPromotionUsage(): Promise<PromotionUsage> {
  const { data, error } = await supabase.rpc('get_promotion_usage');
  if (error) throw error;
  return data as PromotionUsage;
}

export async function createPromotion(params: {
  listingId: string;
  headline: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  category?: string;
}): Promise<{ success: boolean; error?: string; promotion_id?: string; expires_at?: string; used?: number; allowance?: number; resets?: string }> {
  const { data, error } = await supabase.rpc('create_professional_promotion', {
    p_listing_id: params.listingId,
    p_headline: params.headline,
    p_description: params.description ?? '',
    p_image_url: params.imageUrl ?? null,
    p_cta_label: params.ctaLabel ?? '',
    p_cta_url: params.ctaUrl ?? null,
    p_category: params.category ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; promotion_id?: string; expires_at?: string; used?: number; allowance?: number; resets?: string };
}

export async function trackAnalyticsEvent(
  listingId: string,
  eventType: 'profile_view' | 'directory_impression' | 'directory_click' | 'feed_promotion_impression' | 'feed_promotion_click' | 'cta_click',
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabase.from('professional_analytics_events').insert({
    listing_id: listingId,
    event_type: eventType,
    metadata: metadata ?? {},
  });
}

export async function fetchListingAnalytics(listingId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('professional_analytics_events')
    .select('event_type')
    .eq('listing_id', listingId);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const eventType = (row as { event_type: string }).event_type;
    counts[eventType] = (counts[eventType] ?? 0) + 1;
  }
  return counts;
}

export async function expireOldPromotions(): Promise<number> {
  const { data, error } = await supabase.rpc('expire_old_promotions');
  if (error) return 0;
  return data as number;
}

export const PORTAL_TYPE_LABELS: Record<PortalType, string> = {
  'creator-portal': 'Creator',
  'coach-portal': 'Coach',
  'business-portal': 'Business',
  'stable-portal': 'Stable',
  'media-portal': 'Media',
};

export const PORTAL_TYPE_PLURAL: Record<PortalType, string> = {
  'creator-portal': 'Creators',
  'coach-portal': 'Coaches',
  'business-portal': 'Businesses',
  'stable-portal': 'Stables',
  'media-portal': 'Media',
};
