import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchDMConversations,
  fetchUnreadCounts,
  type DMConversation,
} from '@/lib/dmStore';
import { getMyContacts, type Contact } from '@/lib/authEngine';
import { useNotifications, type Notification } from '@/lib/notificationStore';
import type { SpotVaultAccount } from '@/types';

export type CommsFilter = 'all' | 'chats';

export interface UnifiedCommsItem {
  id: string;
  kind: 'dm' | 'notification';
  timestamp: string;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  unread: number;
  dismissible: boolean;
  notificationId: string | null;
  conversationId: string | null;
  otherUserId: string | null;
  notificationType: string | null;
  isRead: boolean;
  dismissed: boolean;
}

const CHAT_NOTIFICATION_TYPES = new Set(['dm', 'group_message']);

export function useUnifiedInbox(
  account: SpotVaultAccount | null,
  filter: CommsFilter = 'all',
): {
  items: UnifiedCommsItem[];
  loading: boolean;
  dismiss: (notificationId: string) => void;
  refresh: () => void;
} {
  const userId = account?.id ?? '';
  const { notifications, markRead, refresh: refreshNotifs } = useNotifications(userId || undefined);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [myContacts, convs, counts] = await Promise.all([
        getMyContacts(),
        fetchDMConversations(userId),
        fetchUnreadCounts(userId),
      ]);
      setContacts(myContacts);
      setConversations(convs);
      setUnreadCounts(counts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  const contactMap = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach((c) => m.set(c.user_id, c));
    return m;
  }, [contacts]);

  const items = useMemo<UnifiedCommsItem[]>(() => {
    const result: UnifiedCommsItem[] = [];

    // Dedup conversations by otherUserId — if duplicate rows survived
    // (pre-unique-constraint races), keep the one with the most recent activity.
    const convByUser = new Map<string, DMConversation>();
    for (const conv of conversations) {
      const existing = convByUser.get(conv.otherUserId);
      if (!existing) {
        convByUser.set(conv.otherUserId, conv);
      } else {
        const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
        const newTime = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
        if (newTime > existingTime) convByUser.set(conv.otherUserId, conv);
      }
    }

    for (const conv of convByUser.values()) {
      const unread = unreadCounts[conv.conversationId] ?? 0;
      result.push({
        id: `dm-${conv.conversationId}`,
        kind: 'dm',
        timestamp: conv.lastMessageAt ?? new Date(0).toISOString(),
        title: conv.otherDisplayName ?? conv.otherUsername,
        subtitle: conv.lastMessagePreview || 'Start a conversation',
        avatarUrl: conv.otherAvatarUrl,
        unread,
        dismissible: false,
        notificationId: null,
        conversationId: conv.conversationId,
        otherUserId: conv.otherUserId,
        notificationType: null,
        isRead: unread === 0,
        dismissed: false,
      });
    }

    const contactUserIds = new Set(convByUser.keys());

    for (const notif of notifications) {
      if (notif.dismissed_at) continue;
      if (CHAT_NOTIFICATION_TYPES.has(notif.type)) {
        const convId = notif.source_id;
        if (convId && conversations.some((c) => c.conversationId === convId)) continue;
        const matchedConv = conversations.find((c) => c.conversationId === convId);
        if (matchedConv && contactUserIds.has(matchedConv.otherUserId)) continue;
      }

      const isChatType = CHAT_NOTIFICATION_TYPES.has(notif.type);
      result.push({
        id: `notif-${notif.id}`,
        kind: 'notification',
        timestamp: notif.created_at,
        title: notif.title,
        subtitle: notif.body ?? '',
        avatarUrl: null,
        unread: notif.is_read ? 0 : 1,
        dismissible: !isChatType,
        notificationId: notif.id,
        conversationId: null,
        otherUserId: null,
        notificationType: notif.type,
        isRead: notif.is_read,
        dismissed: false,
      });
    }

    result.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });

    if (filter === 'chats') {
      return result.filter((item) => item.kind === 'dm');
    }

    return result;
  }, [conversations, unreadCounts, notifications, filter]);

  const dismiss = useCallback(
    (notificationId: string) => {
      const notif = notifications.find((n) => n.id === notificationId);
      if (notif && !notif.is_read) markRead(notificationId);
      void supabase
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', notificationId)
        .is('dismissed_at', null);
      refreshNotifs();
    },
    [notifications, markRead, refreshNotifs],
  );

  return { items, loading, dismiss, refresh: loadData };
}
