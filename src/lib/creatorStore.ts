import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

export type ApplicationType = 'video_spot' | 'multispot' | 'both';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'info_requested';

export interface CreatorPermissions {
  can_publish_video_spots: boolean;
  can_create_multispot: boolean;
}

export interface CreatorApplication {
  id: string;
  user_id: string;
  application_type: ApplicationType;
  status: ApplicationStatus;
  real_name: string;
  poker_screen_names: string;
  main_poker_sites: string;
  game_type: string;
  stakes_abi: string;
  primary_formats: string;
  years_playing: string;
  documented_results: string;
  public_profile_links: string;
  other_results: string;
  coaching_experience: string;
  social_content_links: string;
  intended_content: string;
  attachment_urls: string[];
  staff_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorApplicationInput {
  application_type: ApplicationType;
  real_name?: string;
  poker_screen_names?: string;
  main_poker_sites?: string;
  game_type?: string;
  stakes_abi?: string;
  primary_formats?: string;
  years_playing?: string;
  documented_results?: string;
  public_profile_links?: string;
  other_results?: string;
  coaching_experience?: string;
  social_content_links?: string;
  intended_content?: string;
  attachment_urls?: string[];
}

// ── Permission queries ─────────────────────────────────────────

export async function getCreatorPermissions(userId: string): Promise<CreatorPermissions> {
  const { data, error } = await supabase.rpc('sv_get_creator_permissions', { p_user_id: userId });
  if (error) {
    console.error('[creatorStore] getCreatorPermissions:', error);
    return { can_publish_video_spots: false, can_create_multispot: false };
  }
  const row = data as { can_publish_video_spots: boolean; can_create_multispot: boolean } | null;
  return {
    can_publish_video_spots: row?.can_publish_video_spots ?? false,
    can_create_multispot: row?.can_create_multispot ?? false,
  };
}

export async function canPublishVideoSpots(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_publish_video_spots', { p_user_id: userId });
  if (error) { console.error('[creatorStore] canPublishVideoSpots:', error); return false; }
  return data as boolean;
}

export async function canCreateMultispot(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_create_multispot', { p_user_id: userId });
  if (error) { console.error('[creatorStore] canCreateMultispot:', error); return false; }
  return data as boolean;
}

// ── Application queries (user) ─────────────────────────────────

export async function submitApplication(userId: string, input: CreatorApplicationInput): Promise<string | null> {
  const { data, error } = await supabase
    .from('sv_creator_applications')
    .insert({
      user_id: userId,
      application_type: input.application_type,
      real_name: input.real_name ?? '',
      poker_screen_names: input.poker_screen_names ?? '',
      main_poker_sites: input.main_poker_sites ?? '',
      game_type: input.game_type ?? '',
      stakes_abi: input.stakes_abi ?? '',
      primary_formats: input.primary_formats ?? '',
      years_playing: input.years_playing ?? '',
      documented_results: input.documented_results ?? '',
      public_profile_links: input.public_profile_links ?? '',
      other_results: input.other_results ?? '',
      coaching_experience: input.coaching_experience ?? '',
      social_content_links: input.social_content_links ?? '',
      intended_content: input.intended_content ?? '',
      attachment_urls: input.attachment_urls ?? [],
    })
    .select('id')
    .maybeSingle();

  if (error) { console.error('[creatorStore] submitApplication:', error); return null; }
  return data?.id ?? null;
}

export async function getMyApplications(userId: string): Promise<CreatorApplication[]> {
  const { data, error } = await supabase
    .from('sv_creator_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[creatorStore] getMyApplications:', error); return []; }
  return (data ?? []) as unknown as CreatorApplication[];
}

// ── Staff queries ───────────────────────────────────────────────

export async function getPendingApplications(): Promise<CreatorApplication[]> {
  const { data, error } = await supabase
    .from('sv_creator_applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) { console.error('[creatorStore] getPendingApplications:', error); return []; }
  return (data ?? []) as unknown as CreatorApplication[];
}

export async function getAllApplications(): Promise<CreatorApplication[]> {
  const { data, error } = await supabase
    .from('sv_creator_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[creatorStore] getAllApplications:', error); return []; }
  return (data ?? []) as unknown as CreatorApplication[];
}

export async function reviewApplication(
  applicationId: string,
  decision: 'approved' | 'rejected' | 'info_requested',
  staffNotes: string,
  grantVideoSpots: boolean,
  grantMultispot: boolean,
  staffUserId: string
): Promise<boolean> {
  const now = new Date().toISOString();

  // Update application status
  const { error: appError } = await supabase
    .from('sv_creator_applications')
    .update({
      status: decision,
      staff_notes: staffNotes,
      reviewed_by: staffUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', applicationId);

  if (appError) { console.error('[creatorStore] reviewApplication update:', appError); return false; }

  // If approved, grant permissions
  if (decision === 'approved') {
    // Fetch the application to get user_id
    const { data: app } = await supabase
      .from('sv_creator_applications')
      .select('user_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (app) {
      const userId = (app as { user_id: string }).user_id;
      // Upsert permissions
      const { data: existing } = await supabase
        .from('sv_creator_permissions')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('sv_creator_permissions')
          .update({
            can_publish_video_spots: grantVideoSpots,
            can_create_multispot: grantMultispot,
            granted_by: staffUserId,
            granted_at: now,
            updated_at: now,
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('sv_creator_permissions')
          .insert({
            user_id: userId,
            can_publish_video_spots: grantVideoSpots,
            can_create_multispot: grantMultispot,
            granted_by: staffUserId,
            granted_at: now,
            updated_at: now,
          });
      }
    }
  }

  return true;
}

export async function revokePermission(
  userId: string,
  revokeVideoSpots: boolean,
  revokeMultispot: boolean
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('sv_creator_permissions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) return true;

  const current = existing as { can_publish_video_spots: boolean; can_create_multispot: boolean };
  const { error } = await supabase
    .from('sv_creator_permissions')
    .update({
      can_publish_video_spots: revokeVideoSpots ? false : current.can_publish_video_spots,
      can_create_multispot: revokeMultispot ? false : current.can_create_multispot,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) { console.error('[creatorStore] revokePermission:', error); return false; }
  return true;
}

export async function getAllPermissions(): Promise<Array<{ user_id: string; can_publish_video_spots: boolean; can_create_multispot: boolean; granted_at: string | null }>> {
  const { data, error } = await supabase
    .from('sv_creator_permissions')
    .select('user_id, can_publish_video_spots, can_create_multispot, granted_at')
    .order('granted_at', { ascending: false });
  if (error) { console.error('[creatorStore] getAllPermissions:', error); return []; }
  return (data ?? []) as Array<{ user_id: string; can_publish_video_spots: boolean; can_create_multispot: boolean; granted_at: string | null }>;
}
