import { supabase } from '@/lib/supabase';

// ── Types ──

export interface UserSearchResult {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  poker_role: string | null;
  sv_user_id: string | null;
  is_verified: boolean;
}

export interface RelationshipStatus {
  is_self: boolean;
  is_following: boolean;
  is_followed_by: boolean;
  is_mutual: boolean;
  is_contact: boolean;
  contact_request_pending: boolean;
  contact_relationship_id: string | null;
  is_blocked: boolean;
}

// ── User Search ──

export async function searchUsers(query: string, limit: number = 10): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc('sv_search_users', {
    p_query: query,
    p_limit: limit,
  });
  if (error || !data) return [];
  return data as UserSearchResult[];
}

// ── Relationship Status ──

export async function getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus | null> {
  const { data, error } = await supabase.rpc('sv_get_relationship_status', {
    p_target_user_id: targetUserId,
  });
  if (error || !data) return null;
  return data as RelationshipStatus;
}

// ── Mutual Follows ──

export async function getMutualFollows(limit: number = 50): Promise<UserSearchResult[]> {
  const { data, error } = await supabase.rpc('sv_get_mutual_follows', {
    p_limit: limit,
  });
  if (error || !data) return [];
  return data as UserSearchResult[];
}
