import { supabase } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

export interface BusinessContact {
  id: string;
  account_id: string;
  user_id: string | null;
  name: string;
  username: string | null;
  company: string | null;
  position: string | null;
  category: string;
  location: string | null;
  contact_status: string;
  relationship_strength: string;
  tags: string[];
  notes: string | null;
  last_interaction: string | null;
  next_follow_up: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessPitch {
  id: string;
  account_id: string;
  title: string;
  recipient_name: string | null;
  recipient_user_id: string | null;
  company: string | null;
  introduction: string | null;
  proposal: string | null;
  deal_value: string | null;
  requested_meeting: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessCrmDeal {
  id: string;
  account_id: string;
  deal_name: string;
  contact_name: string | null;
  contact_user_id: string | null;
  company: string | null;
  estimated_value: string | null;
  deal_type: string;
  stage: string;
  notes: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessAdRequest {
  id: string;
  account_id: string;
  company: string;
  promotion: string | null;
  desired_placement: string | null;
  target_audience: string | null;
  budget: string | null;
  start_date: string | null;
  duration: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessCrmCampaign {
  id: string;
  account_id: string;
  campaign_name: string;
  placement: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  spend: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessFile {
  id: string;
  account_id: string;
  file_name: string;
  file_path: string;
  category: string;
  notes: string | null;
  created_at: string;
}

// ============================================================
// Contacts
// ============================================================

export async function fetchContacts(accountId: string): Promise<BusinessContact[]> {
  const { data, error } = await supabase
    .from('business_contacts')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as BusinessContact[];
}

export async function addContact(accountId: string, contact: Partial<BusinessContact>): Promise<BusinessContact | null> {
  const row = {
    account_id: accountId,
    user_id: contact.user_id ?? null,
    name: contact.name ?? '',
    username: contact.username ?? null,
    company: contact.company ?? null,
    position: contact.position ?? null,
    category: contact.category ?? 'other',
    location: contact.location ?? null,
    contact_status: contact.contact_status ?? 'warm',
    relationship_strength: contact.relationship_strength ?? 'medium',
    tags: contact.tags ?? [],
    notes: contact.notes ?? null,
    last_interaction: contact.last_interaction ?? null,
    next_follow_up: contact.next_follow_up ?? null,
    is_favorite: contact.is_favorite ?? false,
  };
  const { data, error } = await supabase
    .from('business_contacts')
    .insert(row)
    .select('*')
    .single();
  if (error || !data) return null;
  return data as BusinessContact;
}

export async function updateContact(id: string, updates: Partial<BusinessContact>): Promise<boolean> {
  const { error } = await supabase
    .from('business_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase.from('business_contacts').delete().eq('id', id);
  return !error;
}

// ============================================================
// Pitches
// ============================================================

export async function fetchPitches(accountId: string): Promise<BusinessPitch[]> {
  const { data, error } = await supabase
    .from('business_pitches')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as BusinessPitch[];
}

export async function createPitch(accountId: string, pitch: Partial<BusinessPitch>): Promise<BusinessPitch | null> {
  const row = {
    account_id: accountId,
    title: pitch.title ?? '',
    recipient_name: pitch.recipient_name ?? null,
    recipient_user_id: pitch.recipient_user_id ?? null,
    company: pitch.company ?? null,
    introduction: pitch.introduction ?? null,
    proposal: pitch.proposal ?? null,
    deal_value: pitch.deal_value ?? null,
    requested_meeting: pitch.requested_meeting ?? null,
    status: pitch.status ?? 'draft',
  };
  const { data, error } = await supabase
    .from('business_pitches')
    .insert(row)
    .select('*')
    .single();
  if (error || !data) return null;
  return data as BusinessPitch;
}

export async function updatePitch(id: string, updates: Partial<BusinessPitch>): Promise<boolean> {
  const { error } = await supabase
    .from('business_pitches')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deletePitch(id: string): Promise<boolean> {
  const { error } = await supabase.from('business_pitches').delete().eq('id', id);
  return !error;
}

// ============================================================
// Deals
// ============================================================

export async function fetchCrmDeals(accountId: string): Promise<BusinessCrmDeal[]> {
  const { data, error } = await supabase
    .from('business_crm_deals')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as BusinessCrmDeal[];
}

export async function createCrmDeal(accountId: string, deal: Partial<BusinessCrmDeal>): Promise<BusinessCrmDeal | null> {
  const row = {
    account_id: accountId,
    deal_name: deal.deal_name ?? '',
    contact_name: deal.contact_name ?? null,
    contact_user_id: deal.contact_user_id ?? null,
    company: deal.company ?? null,
    estimated_value: deal.estimated_value ?? null,
    deal_type: deal.deal_type ?? 'other',
    stage: deal.stage ?? 'lead',
    notes: deal.notes ?? null,
    next_action: deal.next_action ?? null,
    follow_up_date: deal.follow_up_date ?? null,
  };
  const { data, error } = await supabase
    .from('business_crm_deals')
    .insert(row)
    .select('*')
    .single();
  if (error || !data) return null;
  return data as BusinessCrmDeal;
}

export async function updateCrmDeal(id: string, updates: Partial<BusinessCrmDeal>): Promise<boolean> {
  const { error } = await supabase
    .from('business_crm_deals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteCrmDeal(id: string): Promise<boolean> {
  const { error } = await supabase.from('business_crm_deals').delete().eq('id', id);
  return !error;
}

// ============================================================
// Ad Requests
// ============================================================

export async function fetchAdRequests(accountId: string): Promise<BusinessAdRequest[]> {
  const { data, error } = await supabase
    .from('business_crm_ad_requests')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as BusinessAdRequest[];
}

export async function createAdRequest(accountId: string, req: Partial<BusinessAdRequest>): Promise<BusinessAdRequest | null> {
  const row = {
    account_id: accountId,
    company: req.company ?? '',
    promotion: req.promotion ?? null,
    desired_placement: req.desired_placement ?? null,
    target_audience: req.target_audience ?? null,
    budget: req.budget ?? null,
    start_date: req.start_date ?? null,
    duration: req.duration ?? null,
    notes: req.notes ?? null,
    status: 'pending',
  };
  const { data, error } = await supabase
    .from('business_crm_ad_requests')
    .insert(row)
    .select('*')
    .single();
  if (error || !data) return null;
  return data as BusinessAdRequest;
}

// ============================================================
// Campaigns
// ============================================================

export async function fetchCampaigns(accountId: string): Promise<BusinessCrmCampaign[]> {
  const { data, error } = await supabase
    .from('business_crm_campaigns')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as BusinessCrmCampaign[];
}

// ============================================================
// Files
// ============================================================

export async function fetchBusinessFiles(accountId: string): Promise<BusinessFile[]> {
  const { data, error } = await supabase
    .from('business_files')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as BusinessFile[];
}

export async function addBusinessFile(accountId: string, file: { file_name: string; file_path: string; category: string; notes?: string }): Promise<BusinessFile | null> {
  const { data, error } = await supabase
    .from('business_files')
    .insert({
      account_id: accountId,
      file_name: file.file_name,
      file_path: file.file_path,
      category: file.category,
      notes: file.notes ?? null,
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return data as BusinessFile;
}

export async function deleteBusinessFile(id: string): Promise<boolean> {
  const { error } = await supabase.from('business_files').delete().eq('id', id);
  return !error;
}

export async function uploadBusinessFile(accountId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `business/${accountId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('user-uploads')
    .upload(path, file, { upsert: false });
  if (uploadError) return null;
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(path);
  return data.publicUrl;
}
