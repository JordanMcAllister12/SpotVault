import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  account_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string;
  bio: string;
  location: string;
  home_city_slug: string | null;
  poker_role: string;
  social_links: Record<string, string>;
}

export interface Accomplishment {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  accomplishment_date: string | null;
  event_name: string | null;
  prize_amount: number | null;
  review_status: string;
}

export interface AccomplishmentEvidence {
  id: string;
  accomplishment_id: string;
  evidence_type: string;
  url: string | null;
  label: string | null;
}

export interface InboxConversation {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  last_message_preview: string;
  last_message_at: string | null;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
  attachment_type?: string | null;
  attachment_url?: string | null;
  attachment_label?: string | null;
}

interface ProfileState {
  profiles: Record<string, UserProfile>;
  loading: boolean;
}

let state: ProfileState = { profiles: {}, loading: false };
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function getSnapshot() { return state; }
function setState(updater: (prev: ProfileState) => ProfileState) {
  state = updater(state);
  notify();
}

export async function fetchProfile(accountId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    account_id: data.user_id,
    display_name: data.display_name || '',
    username: data.username || null,
    avatar_url: data.avatar_url || '',
    bio: data.bio || '',
    location: data.location || '',
    home_city_slug: data.home_city_slug || null,
    poker_role: data.poker_role || '',
    social_links: data.social_links || {},
  };
}

export async function fetchProfileByUsername(username: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error || !data) return null;
  return {
    account_id: data.user_id,
    display_name: data.display_name || '',
    username: data.username || null,
    avatar_url: data.avatar_url || '',
    bio: data.bio || '',
    location: data.location || '',
    home_city_slug: data.home_city_slug || null,
    poker_role: data.poker_role || '',
    social_links: data.social_links || {},
  };
}

export interface PublicProfileEntry {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  poker_role: string | null;
  primary_role: string | null;
  title: string | null;
  is_verified: boolean;
  sv_user_id: string | null;
  is_discoverable: boolean;
}

export async function fetchPublicProfiles(limit: number = 50): Promise<PublicProfileEntry[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, username, avatar_url, bio, location, poker_role, primary_role, title, is_verified, sv_user_id, is_discoverable')
    .eq('is_discoverable', true)
    .or('is_test_account.is.false,is_test_account.is.null')
    .order('display_name', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as PublicProfileEntry[];
}

export async function fetchProfilesByDisplayNames(names: string[]): Promise<Map<string, PublicProfileEntry>> {
  if (names.length === 0) return new Map();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, username, avatar_url, bio, location, poker_role, primary_role, title, is_verified, sv_user_id, is_discoverable')
    .in('display_name', names);
  if (error || !data) return new Map();
  const map = new Map<string, PublicProfileEntry>();
  for (const row of data as PublicProfileEntry[]) {
    map.set(row.display_name, row);
  }
  return map;
}

export async function upsertProfile(profile: Partial<UserProfile> & { account_id: string }): Promise<boolean> {
  const row: Record<string, any> = {
    user_id: profile.account_id,
    display_name: profile.display_name ?? '',
    username: profile.username ?? null,
    avatar_url: profile.avatar_url ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    home_city_slug: profile.home_city_slug ?? null,
    poker_role: profile.poker_role ?? '',
    social_links: profile.social_links ?? {},
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from('user_profiles').select('user_id').eq('user_id', profile.account_id).maybeSingle();
  if (existing) {
    const { error } = await supabase.from('user_profiles').update(row).eq('user_id', profile.account_id);
    return !error;
  }
  const { error } = await supabase.from('user_profiles').insert(row);
  return !error;
}

export async function fetchAccomplishments(userId: string): Promise<Accomplishment[]> {
  const { data, error } = await supabase
    .from('profile_accomplishments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Accomplishment[];
}

export async function addAccomplishment(userId: string, title: string, description: string, category: string, accomplishmentDate: string | null, eventName: string | null, prizeAmount: number | null): Promise<Accomplishment | null> {
  const { data, error } = await supabase
    .from('profile_accomplishments')
    .insert({
      user_id: userId,
      title,
      description: description || null,
      category,
      accomplishment_date: accomplishmentDate || null,
      event_name: eventName || null,
      prize_amount: prizeAmount,
      review_status: 'unreviewed',
    })
    .select('*')
    .single();
  if (error || !data) return null;
  return data as Accomplishment;
}

export async function deleteAccomplishment(id: string): Promise<boolean> {
  const { error } = await supabase.from('profile_accomplishments').delete().eq('id', id);
  return !error;
}

export async function updateAccomplishment(id: string, updates: {
  title?: string;
  description?: string | null;
  category?: string;
  accomplishment_date?: string | null;
  event_name?: string | null;
  prize_amount?: number | null;
}): Promise<boolean> {
  const { error } = await supabase.from('profile_accomplishments').update(updates).eq('id', id);
  return !error;
}

export async function uploadAccomplishmentProof(accomplishmentId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `accomplishment-proof/${accomplishmentId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('user-uploads')
    .upload(path, file, { upsert: true });
  if (uploadError) return null;
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const { error: dbError } = await supabase.from('accomplishment_evidence').insert({
    accomplishment_id: accomplishmentId,
    evidence_type: 'screenshot',
    url: publicUrl,
    label: file.name,
  });
  if (dbError) return null;
  return publicUrl;
}

export async function deleteAccomplishmentEvidence(evidenceId: string): Promise<boolean> {
  const { error } = await supabase.from('accomplishment_evidence').delete().eq('id', evidenceId);
  return !error;
}

export async function fetchAccomplishmentEvidence(accomplishmentId: string): Promise<AccomplishmentEvidence[]> {
  const { data, error } = await supabase
    .from('accomplishment_evidence')
    .select('*')
    .eq('accomplishment_id', accomplishmentId);
  if (error || !data) return [];
  return data as AccomplishmentEvidence[];
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `avatars/${userId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('user-uploads')
    .upload(path, file, { upsert: true });
  if (uploadError) return null;
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchInboxConversations(accountId: string): Promise<InboxConversation[]> {
  const { data, error } = await supabase
    .from('user_inbox_conversations')
    .select('*')
    .or(`participant_a_id.eq.${accountId},participant_b_id.eq.${accountId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data as InboxConversation[];
}

export async function fetchSentConversations(accountId: string): Promise<InboxConversation[]> {
  const { data: msgData, error: msgErr } = await supabase
    .from('user_inbox_messages')
    .select('conversation_id')
    .eq('sender_id', accountId);
  if (msgErr || !msgData || msgData.length === 0) return [];
  const convIds = [...new Set(msgData.map((m) => m.conversation_id as string))];
  const { data: convData, error: convErr } = await supabase
    .from('user_inbox_conversations')
    .select('*')
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (convErr || !convData) return [];
  return convData as InboxConversation[];
}

export async function fetchInboxMessages(conversationId: string): Promise<InboxMessage[]> {
  const { data, error } = await supabase
    .from('user_inbox_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as InboxMessage[];
}

export async function startConversation(myId: string, otherId: string): Promise<string | null> {
  const a = myId < otherId ? myId : otherId;
  const b = myId < otherId ? otherId : myId;
  const { data: existing } = await supabase
    .from('user_inbox_conversations')
    .select('id')
    .eq('participant_a_id', a)
    .eq('participant_b_id', b)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('user_inbox_conversations')
    .insert({ participant_a_id: a, participant_b_id: b })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function sendInboxMessage(conversationId: string, senderId: string, body: string): Promise<boolean> {
  const { error } = await supabase.from('user_inbox_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
  });
  if (error) return false;
  await supabase.from('user_inbox_conversations')
    .update({ last_message_preview: body.slice(0, 100), last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
  return true;
}

export async function markMessagesRead(conversationId: string): Promise<void> {
  await supabase.from('user_inbox_messages').update({ read: true }).eq('conversation_id', conversationId).eq('read', false);
}

// ── System Messages ────────────────────────────────────────────

export interface SystemMessage {
  id: string;
  recipient_user_id: string;
  message_key: string;
  sender_type: string;
  subject: string;
  body: string;
  metadata: any;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export async function fetchSystemMessages(accountId: string): Promise<SystemMessage[]> {
  const { data, error } = await supabase
    .from('system_messages')
    .select('*')
    .eq('recipient_user_id', accountId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as SystemMessage[];
}

export async function markSystemMessageRead(messageId: string): Promise<void> {
  await supabase
    .from('system_messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('read', false);
}

export async function sendSystemMessage(
  recipientUserId: string,
  messageKey: string,
  subject: string,
  body: string,
  metadata?: Record<string, any>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('sv_send_system_message', {
    p_recipient_user_id: recipientUserId,
    p_message_key: messageKey,
    p_subject: subject,
    p_body: body,
    p_metadata: metadata ?? null,
  });
  if (error || !data) return null;
  return data as string;
}

export async function sendWelcomeMessage(_accountId: string): Promise<string | null> {
  return null;
}

export function useProfileStore(): ProfileState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Saved Community Posts ──────────────────────────────────────

export interface SavedCommunityPost {
  id: string;
  user_id: string;
  post_id: string;
  saved_at: string;
}

export interface SavedPostTag {
  id: string;
  saved_post_id: string;
  user_id: string;
  tag: string;
  created_at: string;
}

export const SUGGESTED_TAGS = [
  'READ LATER', 'HH', 'STRATEGY', 'ARTICLE', 'VIDEO',
  'ICM', 'PREFLOP', 'FLOP', 'TURN', 'RIVER',
  'COACHING', 'INDUSTRY', 'IMPORTANT',
];

export async function fetchSavedPostIds(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('sv_saved_community_posts')
    .select('post_id')
    .eq('user_id', accountId);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.post_id));
}

export async function savePost(accountId: string, postId: string): Promise<boolean> {
  const { error } = await supabase.from('sv_saved_community_posts').insert({
    user_id: accountId,
    post_id: postId,
  });
  return !error;
}

export async function unsavePost(accountId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_saved_community_posts')
    .delete()
    .eq('user_id', accountId)
    .eq('post_id', postId);
  return !error;
}

export async function fetchSavedPosts(accountId: string): Promise<Array<SavedCommunityPost & { post_data: any | null }>> {
  const { data, error } = await supabase
    .from('sv_saved_community_posts')
    .select('id, user_id, post_id, saved_at')
    .eq('user_id', accountId)
    .order('saved_at', { ascending: false });
  if (error || !data) return [];
  const saved = data as SavedCommunityPost[];
  if (saved.length === 0) return [];

  const postIds = saved.map((s) => s.post_id);
  const { data: posts } = await supabase
    .from('network_chat_messages')
    .select('*')
    .in('id', postIds);
  const postMap = new Map((posts ?? []).map((p) => [p.id, p]));
  return saved.map((s) => ({ ...s, post_data: postMap.get(s.post_id) ?? null }));
}

export async function fetchSavedPostTags(accountId: string): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('sv_saved_post_tags')
    .select('id, saved_post_id, user_id, tag, created_at')
    .eq('user_id', accountId)
    .order('created_at', { ascending: true });
  if (error || !data) return {};
  const tagsByPost: Record<string, string[]> = {};
  for (const t of data as SavedPostTag[]) {
    if (!tagsByPost[t.saved_post_id]) tagsByPost[t.saved_post_id] = [];
    tagsByPost[t.saved_post_id].push(t.tag);
  }
  return tagsByPost;
}

export async function addSavedPostTag(accountId: string, savedPostId: string, tag: string): Promise<boolean> {
  const { error } = await supabase.from('sv_saved_post_tags').insert({
    saved_post_id: savedPostId,
    user_id: accountId,
    tag: tag.toUpperCase().trim(),
  });
  return !error;
}

export async function removeSavedPostTag(accountId: string, savedPostId: string, tag: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_saved_post_tags')
    .delete()
    .eq('saved_post_id', savedPostId)
    .eq('user_id', accountId)
    .eq('tag', tag);
  return !error;
}
