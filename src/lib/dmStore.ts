import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notificationStore';

export interface DMUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  poker_role: string;
  primary_role: string;
  is_verified: boolean;
}

export interface DMConversation {
  conversationId: string;
  otherUserId: string;
  otherUsername: string;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unread: number;
}

export interface DMMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

/**
 * Search SpotVault users by username or display name.
 * Uses the sv_search_users SECURITY DEFINER RPC.
 */
export async function searchSpotVaultUsers(query: string): Promise<DMUser[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc('sv_search_users', {
    search_query: query.trim(),
    limit_count: 10,
  });
  if (error || !data) return [];
  return data as DMUser[];
}

/**
 * Get or create a 1:1 conversation with another user.
 * Returns the conversation UUID.
 */
export async function getOrCreateConversation(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  });
  if (error || !data) return null;
  return data as string;
}

/**
 * Fetch all conversations for the current authenticated user.
 * Joins with user_profiles to get the other participant's display info.
 */
export async function fetchDMConversations(currentUserId: string): Promise<DMConversation[]> {
  const { data: convs, error } = await supabase
    .from('user_inbox_conversations')
    .select('id, participant_a_id, participant_b_id, last_message_preview, last_message_at, created_at')
    .or(`participant_a_id.eq.${currentUserId},participant_b_id.eq.${currentUserId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error || !convs) return [];

  // Dedup: if duplicate conversation rows exist for the same other user
  // (pre-unique-constraint races), keep the one with the most recent activity.
  const seen = new Map<string, typeof convs[number]>();
  for (const c of convs) {
    const otherId = c.participant_a_id === currentUserId ? c.participant_b_id : c.participant_a_id;
    const existing = seen.get(otherId);
    if (!existing) {
      seen.set(otherId, c);
    } else {
      const existingAt = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0;
      const newAt = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      if (newAt > existingAt) seen.set(otherId, c);
    }
  }

  const deduped = Array.from(seen.values());

  const otherIds = deduped.map((c: { participant_a_id: string; participant_b_id: string }) =>
    c.participant_a_id === currentUserId ? c.participant_b_id : c.participant_a_id,
  );

  if (otherIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', otherIds);

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
  (profiles ?? []).forEach((p: { user_id: string; username: string; display_name: string | null; avatar_url: string | null }) => {
    profileMap.set(p.user_id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
  });

  return deduped.map((c: { id: string; participant_a_id: string; participant_b_id: string; last_message_preview: string; last_message_at: string | null }) => {
    const otherId = c.participant_a_id === currentUserId ? c.participant_b_id : c.participant_a_id;
    const profile = profileMap.get(otherId);
    return {
      conversationId: c.id,
      otherUserId: otherId,
      otherUsername: profile?.username ?? 'Unknown',
      otherDisplayName: profile?.display_name ?? null,
      otherAvatarUrl: profile?.avatar_url ?? null,
      lastMessagePreview: c.last_message_preview ?? '',
      lastMessageAt: c.last_message_at,
      unread: 0,
    };
  });
}

/**
 * Fetch messages for a conversation, ordered oldest to newest.
 */
export async function fetchDMMessages(conversationId: string): Promise<DMMessage[]> {
  const { data, error } = await supabase
    .from('user_inbox_messages')
    .select('id, conversation_id, sender_id, body, read, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error || !data) return [];
  return data as DMMessage[];
}

/**
 * Send a DM message. Inserts into user_inbox_messages and updates
 * the conversation's last_message_preview / last_message_at.
 */
export async function sendDMMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<boolean> {
  const { error: msgError } = await supabase.from('user_inbox_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    read: false,
  });
  if (msgError) return false;

  await supabase
    .from('user_inbox_conversations')
    .update({
      last_message_preview: body.slice(0, 200),
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  const { data: conv } = await supabase
    .from('user_inbox_conversations')
    .select('participant_a_id, participant_b_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (conv) {
    const recipientId = conv.participant_a_id === senderId ? conv.participant_b_id : conv.participant_a_id;
    if (recipientId && recipientId !== senderId) {
      void createNotification({
        userId: recipientId,
        type: 'dm',
        title: 'New Private Message',
        body: body.slice(0, 120),
        icon: 'MessageSquare',
        sourceId: conversationId,
        sourceType: 'dm_conversation',
        destination: 'messaging:chats',
      });
    }
  }

  return true;
}

/**
 * Mark all messages in a conversation as read (for the non-sender).
 */
export async function markConversationRead(conversationId: string, currentUserId: string): Promise<void> {
  await supabase
    .from('user_inbox_messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', currentUserId)
    .eq('read', false);
}

/**
 * Count unread messages across all conversations for the current user.
 */
export async function fetchUnreadCounts(currentUserId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('user_inbox_messages')
    .select('conversation_id')
    .neq('sender_id', currentUserId)
    .eq('read', false);

  if (error || !data) return {};
  const counts: Record<string, number> = {};
  (data as { conversation_id: string }[]).forEach((m) => {
    counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
  });
  return counts;
}
