import { useState, useEffect, useCallback } from 'react';
import { fetchUnreadCounts } from '@/lib/dmStore';
import { supabase } from '@/lib/supabase';

export type MessagingTab = 'chats' | 'groups' | 'inbox' | 'activity' | 'support';

interface UnreadState {
  chats: number;
  groups: number;
  inbox: number;
  activity: number;
  support: number;
}

let unreadState: UnreadState = { chats: 0, groups: 0, inbox: 0, activity: 0, support: 0 };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function fetchInboxUnread(userId: string): Promise<number> {
  const { count } = await supabase
    .from('system_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('read', false);
  return count ?? 0;
}

async function fetchActivityUnread(userId: string): Promise<number> {
  const { count } = await supabase
    .from('system_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('read', false)
    .neq('message_key', 'new_user_welcome_v1');
  return count ?? 0;
}

async function fetchGroupsUnread(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sv_count_unread_lounge_messages', {
    p_user_id: userId,
  });
  if (error || data === null || data === undefined) return 0;
  return typeof data === 'number' ? data : 0;
}

async function fetchSupportUnread(userId: string): Promise<number> {
  const { data: issueIds } = await supabase
    .from('issues')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['new', 'in_progress', 'reopened']);
  if (!issueIds || issueIds.length === 0) return 0;
  const ids = issueIds.map((r: { id: string }) => r.id);
  const { count } = await supabase
    .from('issue_comments')
    .select('id', { count: 'exact', head: true })
    .in('issue_id', ids)
    .eq('is_internal', false)
    .neq('author_id', userId);
  return count ?? 0;
}

export async function fetchGroupUnreadBreakdown(userId: string): Promise<Map<string, number>> {
  const { data: memberships } = await supabase
    .from('lounge_memberships')
    .select('lounge_slug')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (!memberships || memberships.length === 0) return new Map();

  const slugs = memberships.map((m: { lounge_slug: string }) => m.lounge_slug);
  const { data: lastReadRows } = await supabase
    .from('lounge_read_state')
    .select('lounge_slug, last_read_at')
    .eq('user_id', userId);
  const lastReadMap = new Map<string, string>();
  (lastReadRows ?? []).forEach((r: { lounge_slug: string; last_read_at: string | null }) => {
    if (r.last_read_at) lastReadMap.set(r.lounge_slug, r.last_read_at);
  });

  // Fetch valid author IDs to exclude orphaned/demo messages
  const { data: messages } = await supabase
    .from('poker_lounge_messages')
    .select('id, author_id, lounge_id, created_at')
    .in('lounge_id', slugs);

  const result = new Map<string, number>();
  if (!messages || messages.length === 0) return result;

  // Filter out messages from non-existent users (orphaned demo records)
  const authorIds = [...new Set(messages.map((m: { author_id: string }) => m.author_id))];
  const { data: validAuthors } = await supabase
    .from('user_profiles')
    .select('user_id')
    .in('user_id', authorIds);
  const validAuthorSet = new Set((validAuthors ?? []).map((a: { user_id: string }) => a.user_id));

  for (const slug of slugs) {
    const lastRead = lastReadMap.get(slug);
    const count = messages.filter((m: { author_id: string; lounge_id: string; created_at: string }) => {
      if (m.lounge_id !== slug) return false;
      if (m.author_id === userId) return false;
      if (!validAuthorSet.has(m.author_id)) return false;
      if (lastRead && m.created_at <= lastRead) return false;
      return true;
    }).length;
    if (count > 0) result.set(slug, count);
  }
  return result;
}

export async function refreshUnreadCounts(userId: string): Promise<void> {
  const [chatCounts, inbox, groups, activity, support] = await Promise.all([
    fetchUnreadCounts(userId)
      .then((counts) => Object.values(counts).reduce((s, c) => s + c, 0))
      .catch(() => 0),
    fetchInboxUnread(userId).catch(() => 0),
    fetchGroupsUnread(userId).catch(() => 0),
    fetchActivityUnread(userId).catch(() => 0),
    fetchSupportUnread(userId).catch(() => 0),
  ]);

  unreadState = { chats: chatCounts, groups, inbox, activity, support };
  notify();
}

export function useMessagingUnread(userId: string | undefined) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const fn = () => force((v) => v + 1);
    listeners.add(fn);
    void refreshUnreadCounts(userId);
    const interval = setInterval(() => void refreshUnreadCounts(userId), 15000);

    const channel = supabase
      .channel('messaging-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_messages', filter: `recipient_user_id=eq.${userId}` },
        () => void refreshUnreadCounts(userId),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_inbox_messages' },
        () => void refreshUnreadCounts(userId),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poker_lounge_messages' },
        () => void refreshUnreadCounts(userId),
      )
      .subscribe();

    return () => {
      listeners.delete(fn);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
  return { ...unreadState, total: unreadState.chats + unreadState.groups + unreadState.inbox + unreadState.activity + unreadState.support };
}

export function useMessagingCenterState() {
  const [activeTab, setActiveTab] = useState<MessagingTab>('chats');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null);
  const [initialConversationUserId, setInitialConversationUserId] = useState<string | null>(null);

  const openConversation = useCallback((otherUserId: string) => {
    setInitialConversationUserId(otherUserId);
    setActiveTab('chats');
  }, []);

  const switchTab = useCallback((tab: MessagingTab) => {
    setActiveTab(tab);
    setSelectedConversationId(null);
    setSelectedOtherUserId(null);
  }, []);

  return {
    activeTab, switchTab,
    selectedConversationId, setSelectedConversationId,
    selectedOtherUserId, setSelectedOtherUserId,
    initialConversationUserId, setInitialConversationUserId,
    openConversation,
  };
}
