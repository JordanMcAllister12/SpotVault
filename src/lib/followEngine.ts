import { supabase } from '@/lib/supabase';

// ── Types ──

export interface FollowUser {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  poker_role: string | null;
  bio: string | null;
  home_city_slug: string | null;
}

export interface PrivacySettings {
  who_can_follow: 'everyone' | 'approval_required' | 'nobody';
  who_can_message: 'contacts_only' | 'people_i_follow' | 'everyone';
  share_current_city: boolean;
}

export type FollowResult = 'following' | 'requested' | 'already_following';

// ── Follow / Unfollow ──

export async function followUser(targetUserId: string): Promise<FollowResult | null> {
  const { data, error } = await supabase.rpc('sv_follow_user', {
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error('Failed to follow:', error);
    return null;
  }
  return data as FollowResult;
}

export async function unfollowUser(targetUserId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_unfollow_user', {
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error('Failed to unfollow:', error);
    return false;
  }
  return true;
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_is_following', {
    p_target_user_id: targetUserId,
  });
  if (error) return false;
  return data as boolean;
}

// ── Follow Requests ──

export async function acceptFollowRequest(requesterId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_accept_follow_request', {
    p_requester_id: requesterId,
  });
  return !error;
}

export async function declineFollowRequest(requesterId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_decline_follow_request', {
    p_requester_id: requesterId,
  });
  return !error;
}

export async function getPendingFollowRequests(): Promise<Array<{ requester_id: string; created_at: string }>> {
  const { data, error } = await supabase.rpc('sv_get_pending_follow_requests');
  if (error || !data) return [];
  return data as Array<{ requester_id: string; created_at: string }>;
}

// ── Following / Followers Lists ──

export async function getMyFollowing(): Promise<string[]> {
  const { data, error } = await supabase.rpc('sv_get_my_following');
  if (error || !data) return [];
  return (data as Array<{ user_id: string }>).map(r => r.user_id);
}

export async function getMyFollowers(): Promise<string[]> {
  const { data, error } = await supabase.rpc('sv_get_my_followers');
  if (error || !data) return [];
  return (data as Array<{ user_id: string }>).map(r => r.user_id);
}

export async function getFollowersEnriched(targetUserId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase.rpc('sv_get_followers_enriched', {
    target_uuid: targetUserId,
  });
  if (error || !data) return [];
  return data as FollowUser[];
}

export async function getFollowingEnriched(targetUserId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase.rpc('sv_get_following_enriched', {
    target_uuid: targetUserId,
  });
  if (error || !data) return [];
  return data as FollowUser[];
}

export async function getFollowerCount(targetUserId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sv_get_follower_count', {
    target_uuid: targetUserId,
  });
  if (error || data === null) return 0;
  return data as number;
}

export async function getFollowingCount(targetUserId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sv_get_following_count', {
    target_uuid: targetUserId,
  });
  if (error || data === null) return 0;
  return data as number;
}

// ── Block / Unblock ──

export async function blockUser(targetUserId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_block_user', {
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error('Failed to block:', error);
    return false;
  }
  return true;
}

export async function unblockUser(targetUserId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_unblock_user', {
    p_target_user_id: targetUserId,
  });
  return !error;
}

export async function isBlocked(targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_is_blocked', {
    p_target_user_id: targetUserId,
  });
  if (error) return false;
  return data as boolean;
}

export async function getMyBlockedUsers(): Promise<string[]> {
  const { data, error } = await supabase.rpc('sv_get_my_blocked_users');
  if (error || !data) return [];
  return (data as Array<{ user_id: string }>).map(r => r.user_id);
}

// ── City-based Discovery ──

export async function getUsersByHomeCity(citySlug: string): Promise<FollowUser[]> {
  const { data, error } = await supabase.rpc('sv_get_users_by_home_city', {
    p_city_slug: citySlug,
  });
  if (error || !data) return [];
  return data as FollowUser[];
}

// ── Privacy Settings ──

export async function getMyPrivacySettings(): Promise<PrivacySettings> {
  const { data, error } = await supabase.rpc('sv_get_my_privacy_settings');
  if (error || !data || data.length === 0) {
    return { who_can_follow: 'everyone', who_can_message: 'contacts_only', share_current_city: false };
  }
  const row = data[0];
  return {
    who_can_follow: row.who_can_follow as PrivacySettings['who_can_follow'],
    who_can_message: row.who_can_message as PrivacySettings['who_can_message'],
    share_current_city: row.share_current_city,
  };
}

export async function updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<boolean> {
  const { error } = await supabase.rpc('sv_update_privacy_settings', {
    p_who_can_follow: settings.who_can_follow ?? null,
    p_who_can_message: settings.who_can_message ?? null,
    p_share_current_city: settings.share_current_city ?? null,
  });
  if (error) {
    console.error('Failed to update privacy settings:', error);
    return false;
  }
  return true;
}

// ── Can Message Check ──

export async function canMessageUser(targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_can_message_user', {
    p_target_user_id: targetUserId,
  });
  if (error) return false;
  return data as boolean;
}
