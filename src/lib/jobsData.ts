import { supabase } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

export interface PokerResume {
  id: string;
  account_id: string;
  display_name: string;
  username: string;
  avatar_initials: string | null;
  location: string | null;
  languages: string[];
  bio: string | null;
  years_playing: number;
  primary_format: string;
  plays_mtt: boolean;
  plays_cash: boolean;
  plays_live: boolean;
  plays_online: boolean;
  plays_mixed: boolean;
  abi: number | null;
  buy_in_range: string | null;
  tournaments_per_month: number | null;
  preferred_sites: string[];
  live_online_split: string | null;
  cash_stakes: string | null;
  cash_primary_game: string | null;
  hands_played: number | null;
  hands_per_month: number | null;
  total_cashes: string | null;
  estimated_profit: string | null;
  roi: string | null;
  bb100: string | null;
  ev_bb100: string | null;
  largest_score: string | null;
  final_tables: number | null;
  accomplishments: string | null;
  credentials: Credential[];
  looking_for: string[];
  desired_stakes: string | null;
  desired_formats: string[];
  desired_sites: string[];
  volume_commitment: string | null;
  availability: string | null;
  looking_description: string | null;
  analytics_attached: boolean;
  analytics_snapshot: AnalyticsSnapshot | null;
  is_published: boolean;
  is_looking: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSnapshot {
  hands?: number;
  tournaments?: number;
  abi?: number;
  roi?: number;
  bb100?: number;
  ev_bb100?: number;
  vpip?: number;
  pfr?: number;
  three_bet?: number;
  data_through?: string;
}

export interface Credential {
  type: string;
  title: string;
  year?: string;
  description?: string;
}

export interface StableProfile {
  id: string;
  account_id: string;
  stable_name: string;
  logo_initials: string | null;
  description: string | null;
  formats: string[];
  typical_stakes: string | null;
  what_they_provide: string | null;
  what_they_expect: string | null;
  website: string | null;
  social_links: Record<string, string>;
  contact_username: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface StableOpportunity {
  id: string;
  stable_id: string;
  account_id: string;
  title: string;
  format: string;
  abi_range: string | null;
  min_volume: string | null;
  includes: string[];
  description: string | null;
  status: string;
  created_at: string;
}

export interface CoachListing {
  id: string;
  account_id: string;
  display_name: string;
  username: string | null;
  avatar_initials: string | null;
  bio: string | null;
  specialties: string[];
  credentials: Credential[];
  formats_coached: string[];
  stakes_coached: string[];
  languages: string[];
  rate_per_hour: number;
  session_durations: number[];
  coaching_methods: string[];
  accomplishments: string | null;
  availability_summary: string | null;
  is_published: boolean;
  shareable_slug: string | null;
  created_at: string;
  updated_at: string;
  coach_rating_average?: number;
  coach_rating_count?: number;
  available_for_coaching?: boolean;
  is_featured?: boolean;
  profile_photo_url?: string | null;
  coaching_description?: string | null;
  primary_games?: string[];
}

export interface JobPosting {
  id: string;
  account_id: string;
  company: string;
  company_logo: string | null;
  job_title: string;
  job_description: string | null;
  location: string | null;
  work_type: string | null;
  employment_type: string | null;
  salary_range: string | null;
  required_experience: string | null;
  preferred_experience: string | null;
  skills: string[];
  application_deadline: string | null;
  contact_person: string | null;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface JobCandidate {
  id: string;
  account_id: string;
  name: string;
  avatar_initials: string | null;
  location: string | null;
  open_to_remote: boolean;
  poker_background: string | null;
  other_background: string | null;
  skills: string[];
  interested_roles: string[];
  employment_preference: string | null;
  availability: string | null;
  introduction: string | null;
  resume_url: string | null;
  transition_support: string[];
  is_published: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Constants
// ============================================================

export const LOOKING_FOR_OPTIONS = [
  'Full backing',
  'Partial backing',
  'Coaching + backing',
  'Live staking',
  'Online staking',
  'MTT stable',
  'Cash stable',
];

export const COACH_SPECIALTY_OPTIONS = [
  'MTT', 'Cash', 'Live Poker', 'Online Poker', 'ICM', 'PKO',
  'GTO', 'Exploitative Play', 'Mental Game', 'Database Review',
  'Hand History Review', 'Tournament Review',
];

export const COACH_METHOD_OPTIONS = ['Video', 'Voice', 'Chat/Messaging', 'In Person'];

export const STABLE_FORMAT_OPTIONS = ['MTT', 'Cash', 'Live', 'Online'];

// ============================================================
// Poker Resume CRUD
// ============================================================

export async function fetchMyResume(accountId: string): Promise<PokerResume | null> {
  const { data, error } = await supabase
    .from('poker_resumes')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) { console.error('fetchMyResume:', error); return null; }
  return data ? mapResume(data) : null;
}

export async function fetchPublishedResumes(): Promise<PokerResume[]> {
  const { data, error } = await supabase
    .from('poker_resumes')
    .select('*')
    .eq('is_published', true)
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchPublishedResumes:', error); return []; }
  return (data || []).map(mapResume);
}

export async function upsertResume(resume: Partial<PokerResume> & { account_id: string }): Promise<PokerResume | null> {
  const row = toResumeRow(resume);
  const { data, error } = await supabase
    .from('poker_resumes')
    .upsert(row, { onConflict: 'account_id' })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertResume:', error); return null; }
  return data ? mapResume(data) : null;
}

// ============================================================
// Stable Profile CRUD
// ============================================================

export async function fetchMyStableProfile(accountId: string): Promise<StableProfile | null> {
  const { data, error } = await supabase
    .from('stable_profiles')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) { console.error('fetchMyStableProfile:', error); return null; }
  return data ? mapStable(data) : null;
}

export async function fetchPublishedStables(): Promise<StableProfile[]> {
  const { data, error } = await supabase
    .from('stable_profiles')
    .select('*')
    .eq('is_published', true)
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchPublishedStables:', error); return []; }
  return (data || []).map(mapStable);
}

export async function upsertStableProfile(profile: Partial<StableProfile> & { account_id: string }): Promise<StableProfile | null> {
  const row = toStableRow(profile);
  const { data, error } = await supabase
    .from('stable_profiles')
    .upsert(row, { onConflict: 'account_id' })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertStableProfile:', error); return null; }
  return data ? mapStable(data) : null;
}

// ============================================================
// Stable Opportunities CRUD
// ============================================================

export async function fetchActiveOpportunities(): Promise<StableOpportunity[]> {
  const { data, error } = await supabase
    .from('stable_opportunities')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchActiveOpportunities:', error); return []; }
  return (data || []).map(mapOpportunity);
}

export async function fetchMyOpportunities(accountId: string): Promise<StableOpportunity[]> {
  const { data, error } = await supabase
    .from('stable_opportunities')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchMyOpportunities:', error); return []; }
  return (data || []).map(mapOpportunity);
}

export async function createOpportunity(opp: Partial<StableOpportunity> & { account_id: string; stable_id: string }): Promise<StableOpportunity | null> {
  const { data, error } = await supabase
    .from('stable_opportunities')
    .insert(toOppRow(opp))
    .select('*')
    .maybeSingle();
  if (error) { console.error('createOpportunity:', error); return null; }
  return data ? mapOpportunity(data) : null;
}

export async function deleteOpportunity(id: string): Promise<boolean> {
  const { error } = await supabase.from('stable_opportunities').delete().eq('id', id);
  if (error) { console.error('deleteOpportunity:', error); return false; }
  return true;
}

// ============================================================
// Coach Listing CRUD
// ============================================================

export async function fetchMyCoachListing(accountId: string): Promise<CoachListing | null> {
  const { data, error } = await supabase
    .from('coach_listings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) { console.error('fetchMyCoachListing:', error); return null; }
  return data ? mapCoach(data) : null;
}

export async function fetchPublishedCoaches(): Promise<CoachListing[]> {
  const { data, error } = await supabase
    .from('coach_listings')
    .select('*')
    .eq('is_published', true)
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchPublishedCoaches:', error); return []; }
  return (data || []).map(mapCoach);
}

export async function fetchCoachBySlug(slug: string): Promise<CoachListing | null> {
  const { data, error } = await supabase
    .from('coach_listings')
    .select('*')
    .eq('shareable_slug', slug)
    .maybeSingle();
  if (error) { console.error('fetchCoachBySlug:', error); return null; }
  return data ? mapCoach(data) : null;
}

export async function upsertCoachListing(listing: Partial<CoachListing> & { account_id: string }): Promise<CoachListing | null> {
  const row = toCoachRow(listing);
  const { data, error } = await supabase
    .from('coach_listings')
    .upsert(row, { onConflict: 'account_id' })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertCoachListing:', error); return null; }
  return data ? mapCoach(data) : null;
}

// ============================================================
// Job Postings CRUD (v2)
// ============================================================

export async function fetchActiveJobPostings(): Promise<JobPosting[]> {
  const { data, error } = await supabase
    .from('job_postings_v2')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchActiveJobPostings:', error); return []; }
  return (data || []).map(mapJobPosting);
}

export async function fetchMyJobPostings(accountId: string): Promise<JobPosting[]> {
  const { data, error } = await supabase
    .from('job_postings_v2')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchMyJobPostings:', error); return []; }
  return (data || []).map(mapJobPosting);
}

export async function createJobPosting(posting: Partial<JobPosting> & { account_id: string }): Promise<JobPosting | null> {
  const { data, error } = await supabase
    .from('job_postings_v2')
    .insert(toJobPostingRow(posting))
    .select('*')
    .maybeSingle();
  if (error) { console.error('createJobPosting:', error); return null; }
  return data ? mapJobPosting(data) : null;
}

export async function deleteJobPosting(id: string): Promise<boolean> {
  const { error } = await supabase.from('job_postings_v2').delete().eq('id', id);
  if (error) { console.error('deleteJobPosting:', error); return false; }
  return true;
}

// ============================================================
// Job Candidates CRUD (v2)
// ============================================================

export async function fetchPublishedCandidates(): Promise<JobCandidate[]> {
  const { data, error } = await supabase
    .from('job_candidates_v2')
    .select('*')
    .eq('is_published', true)
    .eq('is_hidden', false)
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchPublishedCandidates:', error); return []; }
  return (data || []).map(mapJobCandidate);
}

export async function fetchMyCandidateProfile(accountId: string): Promise<JobCandidate | null> {
  const { data, error } = await supabase
    .from('job_candidates_v2')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) { console.error('fetchMyCandidateProfile:', error); return null; }
  return data ? mapJobCandidate(data) : null;
}

export async function upsertCandidateProfile(profile: Partial<JobCandidate> & { account_id: string }): Promise<JobCandidate | null> {
  const { data, error } = await supabase
    .from('job_candidates_v2')
    .upsert(toCandidateRow(profile), { onConflict: 'account_id' })
    .select('*')
    .maybeSingle();
  if (error) { console.error('upsertCandidateProfile:', error); return null; }
  return data ? mapJobCandidate(data) : null;
}

// ============================================================
// Row Mappers
// ============================================================

function mapResume(row: Record<string, unknown>): PokerResume {
  return {
    id: row.id as string, account_id: row.account_id as string,
    display_name: row.display_name as string, username: row.username as string,
    avatar_initials: row.avatar_initials as string | null, location: row.location as string | null,
    languages: row.languages as string[] || [], bio: row.bio as string | null,
    years_playing: row.years_playing as number, primary_format: row.primary_format as string,
    plays_mtt: row.plays_mtt as boolean, plays_cash: row.plays_cash as boolean,
    plays_live: row.plays_live as boolean, plays_online: row.plays_online as boolean,
    plays_mixed: row.plays_mixed as boolean, abi: row.abi as number | null,
    buy_in_range: row.buy_in_range as string | null, tournaments_per_month: row.tournaments_per_month as number | null,
    preferred_sites: row.preferred_sites as string[] || [], live_online_split: row.live_online_split as string | null,
    cash_stakes: row.cash_stakes as string | null, cash_primary_game: row.cash_primary_game as string | null,
    hands_played: row.hands_played as number | null, hands_per_month: row.hands_per_month as number | null,
    total_cashes: row.total_cashes as string | null, estimated_profit: row.estimated_profit as string | null,
    roi: row.roi as string | null,
    bb100: row.bb100 as string | null, ev_bb100: row.ev_bb100 as string | null,
    largest_score: row.largest_score as string | null, final_tables: row.final_tables as number | null,
    accomplishments: row.accomplishments as string | null,
    credentials: row.credentials as Credential[] || [],
    looking_for: row.looking_for as string[] || [],
    desired_stakes: row.desired_stakes as string | null,
    desired_formats: row.desired_formats as string[] || [],
    desired_sites: row.desired_sites as string[] || [],
    volume_commitment: row.volume_commitment as string | null,
    availability: row.availability as string | null,
    looking_description: row.looking_description as string | null,
    analytics_attached: row.analytics_attached as boolean,
    analytics_snapshot: row.analytics_snapshot as AnalyticsSnapshot | null,
    is_published: row.is_published as boolean, is_looking: row.is_looking as boolean,
    created_at: row.created_at as string, updated_at: row.updated_at as string,
  };
}

function toResumeRow(r: Partial<PokerResume>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (r.account_id !== undefined) row.account_id = r.account_id;
  if (r.display_name !== undefined) row.display_name = r.display_name;
  if (r.username !== undefined) row.username = r.username;
  if (r.avatar_initials !== undefined) row.avatar_initials = r.avatar_initials;
  if (r.location !== undefined) row.location = r.location;
  if (r.languages !== undefined) row.languages = r.languages;
  if (r.bio !== undefined) row.bio = r.bio;
  if (r.years_playing !== undefined) row.years_playing = r.years_playing;
  if (r.primary_format !== undefined) row.primary_format = r.primary_format;
  if (r.plays_mtt !== undefined) row.plays_mtt = r.plays_mtt;
  if (r.plays_cash !== undefined) row.plays_cash = r.plays_cash;
  if (r.plays_live !== undefined) row.plays_live = r.plays_live;
  if (r.plays_online !== undefined) row.plays_online = r.plays_online;
  if (r.plays_mixed !== undefined) row.plays_mixed = r.plays_mixed;
  if (r.abi !== undefined) row.abi = r.abi;
  if (r.buy_in_range !== undefined) row.buy_in_range = r.buy_in_range;
  if (r.tournaments_per_month !== undefined) row.tournaments_per_month = r.tournaments_per_month;
  if (r.preferred_sites !== undefined) row.preferred_sites = r.preferred_sites;
  if (r.live_online_split !== undefined) row.live_online_split = r.live_online_split;
  if (r.cash_stakes !== undefined) row.cash_stakes = r.cash_stakes;
  if (r.cash_primary_game !== undefined) row.cash_primary_game = r.cash_primary_game;
  if (r.hands_played !== undefined) row.hands_played = r.hands_played;
  if (r.hands_per_month !== undefined) row.hands_per_month = r.hands_per_month;
  if (r.total_cashes !== undefined) row.total_cashes = r.total_cashes;
  if (r.estimated_profit !== undefined) row.estimated_profit = r.estimated_profit;
  if (r.roi !== undefined) row.roi = r.roi;
  if (r.bb100 !== undefined) row.bb100 = r.bb100;
  if (r.ev_bb100 !== undefined) row.ev_bb100 = r.ev_bb100;
  if (r.largest_score !== undefined) row.largest_score = r.largest_score;
  if (r.final_tables !== undefined) row.final_tables = r.final_tables;
  if (r.accomplishments !== undefined) row.accomplishments = r.accomplishments;
  if (r.credentials !== undefined) row.credentials = r.credentials;
  if (r.looking_for !== undefined) row.looking_for = r.looking_for;
  if (r.desired_stakes !== undefined) row.desired_stakes = r.desired_stakes;
  if (r.desired_formats !== undefined) row.desired_formats = r.desired_formats;
  if (r.desired_sites !== undefined) row.desired_sites = r.desired_sites;
  if (r.volume_commitment !== undefined) row.volume_commitment = r.volume_commitment;
  if (r.availability !== undefined) row.availability = r.availability;
  if (r.looking_description !== undefined) row.looking_description = r.looking_description;
  if (r.analytics_attached !== undefined) row.analytics_attached = r.analytics_attached;
  if (r.analytics_snapshot !== undefined) row.analytics_snapshot = r.analytics_snapshot;
  if (r.is_published !== undefined) row.is_published = r.is_published;
  if (r.is_looking !== undefined) row.is_looking = r.is_looking;
  return row;
}

function mapStable(row: Record<string, unknown>): StableProfile {
  return {
    id: row.id as string, account_id: row.account_id as string,
    stable_name: row.stable_name as string, logo_initials: row.logo_initials as string | null,
    description: row.description as string | null, formats: row.formats as string[] || [],
    typical_stakes: row.typical_stakes as string | null,
    what_they_provide: row.what_they_provide as string | null,
    what_they_expect: row.what_they_expect as string | null,
    website: row.website as string | null,
    social_links: row.social_links as Record<string, string> || {},
    contact_username: row.contact_username as string | null,
    is_published: row.is_published as boolean,
    created_at: row.created_at as string, updated_at: row.updated_at as string,
  };
}

function toStableRow(s: Partial<StableProfile>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (s.account_id !== undefined) row.account_id = s.account_id;
  if (s.stable_name !== undefined) row.stable_name = s.stable_name;
  if (s.logo_initials !== undefined) row.logo_initials = s.logo_initials;
  if (s.description !== undefined) row.description = s.description;
  if (s.formats !== undefined) row.formats = s.formats;
  if (s.typical_stakes !== undefined) row.typical_stakes = s.typical_stakes;
  if (s.what_they_provide !== undefined) row.what_they_provide = s.what_they_provide;
  if (s.what_they_expect !== undefined) row.what_they_expect = s.what_they_expect;
  if (s.website !== undefined) row.website = s.website;
  if (s.social_links !== undefined) row.social_links = s.social_links;
  if (s.contact_username !== undefined) row.contact_username = s.contact_username;
  if (s.is_published !== undefined) row.is_published = s.is_published;
  return row;
}

function mapOpportunity(row: Record<string, unknown>): StableOpportunity {
  return {
    id: row.id as string, stable_id: row.stable_id as string,
    account_id: row.account_id as string, title: row.title as string,
    format: row.format as string, abi_range: row.abi_range as string | null,
    min_volume: row.min_volume as string | null,
    includes: row.includes as string[] || [],
    description: row.description as string | null,
    status: row.status as string, created_at: row.created_at as string,
  };
}

function toOppRow(o: Partial<StableOpportunity>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (o.stable_id !== undefined) row.stable_id = o.stable_id;
  if (o.account_id !== undefined) row.account_id = o.account_id;
  if (o.title !== undefined) row.title = o.title;
  if (o.format !== undefined) row.format = o.format;
  if (o.abi_range !== undefined) row.abi_range = o.abi_range;
  if (o.min_volume !== undefined) row.min_volume = o.min_volume;
  if (o.includes !== undefined) row.includes = o.includes;
  if (o.description !== undefined) row.description = o.description;
  if (o.status !== undefined) row.status = o.status;
  return row;
}

function mapCoach(row: Record<string, unknown>): CoachListing {
  return {
    id: row.id as string, account_id: row.account_id as string,
    display_name: row.display_name as string, username: row.username as string | null,
    avatar_initials: row.avatar_initials as string | null, bio: row.bio as string | null,
    specialties: row.specialties as string[] || [],
    credentials: row.credentials as Credential[] || [],
    formats_coached: row.formats_coached as string[] || [],
    stakes_coached: row.stakes_coached as string[] || [],
    languages: row.languages as string[] || [],
    rate_per_hour: row.rate_per_hour as number,
    session_durations: row.session_durations as number[] || [60],
    coaching_methods: row.coaching_methods as string[] || [],
    accomplishments: row.accomplishments as string | null,
    availability_summary: row.availability_summary as string | null,
    is_published: row.is_published as boolean,
    shareable_slug: row.shareable_slug as string | null,
    created_at: row.created_at as string, updated_at: row.updated_at as string,
    coach_rating_average: row.coach_rating_average as number | undefined,
    coach_rating_count: row.coach_rating_count as number | undefined,
    available_for_coaching: row.available_for_coaching as boolean | undefined,
    is_featured: row.is_featured as boolean | undefined,
    profile_photo_url: row.profile_photo_url as string | null | undefined,
    coaching_description: row.coaching_description as string | null | undefined,
    primary_games: row.primary_games as string[] | undefined,
  };
}

function toCoachRow(c: Partial<CoachListing>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (c.account_id !== undefined) row.account_id = c.account_id;
  if (c.display_name !== undefined) row.display_name = c.display_name;
  if (c.username !== undefined) row.username = c.username;
  if (c.avatar_initials !== undefined) row.avatar_initials = c.avatar_initials;
  if (c.bio !== undefined) row.bio = c.bio;
  if (c.specialties !== undefined) row.specialties = c.specialties;
  if (c.credentials !== undefined) row.credentials = c.credentials;
  if (c.formats_coached !== undefined) row.formats_coached = c.formats_coached;
  if (c.stakes_coached !== undefined) row.stakes_coached = c.stakes_coached;
  if (c.languages !== undefined) row.languages = c.languages;
  if (c.rate_per_hour !== undefined) row.rate_per_hour = c.rate_per_hour;
  if (c.session_durations !== undefined) row.session_durations = c.session_durations;
  if (c.coaching_methods !== undefined) row.coaching_methods = c.coaching_methods;
  if (c.accomplishments !== undefined) row.accomplishments = c.accomplishments;
  if (c.availability_summary !== undefined) row.availability_summary = c.availability_summary;
  if (c.is_published !== undefined) row.is_published = c.is_published;
  if (c.shareable_slug !== undefined) row.shareable_slug = c.shareable_slug;
  return row;
}

function mapJobPosting(row: Record<string, unknown>): JobPosting {
  return {
    id: row.id as string, account_id: row.account_id as string,
    company: row.company as string, company_logo: row.company_logo as string | null,
    job_title: row.job_title as string, job_description: row.job_description as string | null,
    location: row.location as string | null, work_type: row.work_type as string | null,
    employment_type: row.employment_type as string | null,
    salary_range: row.salary_range as string | null,
    required_experience: row.required_experience as string | null,
    preferred_experience: row.preferred_experience as string | null,
    skills: row.skills as string[] || [],
    application_deadline: row.application_deadline as string | null,
    contact_person: row.contact_person as string | null,
    category: row.category as string | null, status: row.status as string,
    created_at: row.created_at as string, updated_at: row.updated_at as string,
  };
}

function toJobPostingRow(j: Partial<JobPosting>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (j.account_id !== undefined) row.account_id = j.account_id;
  if (j.company !== undefined) row.company = j.company;
  if (j.company_logo !== undefined) row.company_logo = j.company_logo;
  if (j.job_title !== undefined) row.job_title = j.job_title;
  if (j.job_description !== undefined) row.job_description = j.job_description;
  if (j.location !== undefined) row.location = j.location;
  if (j.work_type !== undefined) row.work_type = j.work_type;
  if (j.employment_type !== undefined) row.employment_type = j.employment_type;
  if (j.salary_range !== undefined) row.salary_range = j.salary_range;
  if (j.required_experience !== undefined) row.required_experience = j.required_experience;
  if (j.preferred_experience !== undefined) row.preferred_experience = j.preferred_experience;
  if (j.skills !== undefined) row.skills = j.skills;
  if (j.application_deadline !== undefined) row.application_deadline = j.application_deadline;
  if (j.contact_person !== undefined) row.contact_person = j.contact_person;
  if (j.category !== undefined) row.category = j.category;
  if (j.status !== undefined) row.status = j.status;
  return row;
}

function mapJobCandidate(row: Record<string, unknown>): JobCandidate {
  return {
    id: row.id as string, account_id: row.account_id as string,
    name: row.name as string, avatar_initials: row.avatar_initials as string | null,
    location: row.location as string | null, open_to_remote: row.open_to_remote as boolean,
    poker_background: row.poker_background as string | null,
    other_background: row.other_background as string | null,
    skills: row.skills as string[] || [],
    interested_roles: row.interested_roles as string[] || [],
    employment_preference: row.employment_preference as string | null,
    availability: row.availability as string | null,
    introduction: row.introduction as string | null,
    resume_url: row.resume_url as string | null,
    transition_support: row.transition_support as string[] || [],
    is_published: row.is_published as boolean, is_hidden: row.is_hidden as boolean,
    created_at: row.created_at as string, updated_at: row.updated_at as string,
  };
}

function toCandidateRow(c: Partial<JobCandidate>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (c.account_id !== undefined) row.account_id = c.account_id;
  if (c.name !== undefined) row.name = c.name;
  if (c.avatar_initials !== undefined) row.avatar_initials = c.avatar_initials;
  if (c.location !== undefined) row.location = c.location;
  if (c.open_to_remote !== undefined) row.open_to_remote = c.open_to_remote;
  if (c.poker_background !== undefined) row.poker_background = c.poker_background;
  if (c.other_background !== undefined) row.other_background = c.other_background;
  if (c.skills !== undefined) row.skills = c.skills;
  if (c.interested_roles !== undefined) row.interested_roles = c.interested_roles;
  if (c.employment_preference !== undefined) row.employment_preference = c.employment_preference;
  if (c.availability !== undefined) row.availability = c.availability;
  if (c.introduction !== undefined) row.introduction = c.introduction;
  if (c.resume_url !== undefined) row.resume_url = c.resume_url;
  if (c.transition_support !== undefined) row.transition_support = c.transition_support;
  if (c.is_published !== undefined) row.is_published = c.is_published;
  if (c.is_hidden !== undefined) row.is_hidden = c.is_hidden;
  return row;
}
