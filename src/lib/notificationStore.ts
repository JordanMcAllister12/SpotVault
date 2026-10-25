import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type NotificationType =
  | 'dm'
  | 'group_message'
  | 'inbox'
  | 'activity'
  | 'info_post'
  | 'mv_pull'
  | 'announcement';

export interface Notification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  icon: string | null;
  source_id: string | null;
  source_type: string | null;
  destination: string | null;
  is_read: boolean;
  is_broadcast: boolean;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}

const listeners = new Set<(state: NotificationState) => void>();
let currentState: NotificationState = { notifications: [], unreadCount: 0, loading: true };
let activeChannel: string | null = null;
let activeUserId: string | null = null;

function setState(updater: (prev: NotificationState) => NotificationState) {
  currentState = updater(currentState);
  listeners.forEach((fn) => fn(currentState));
}

/**
 * Create a notification for a user. Checks for duplicates via source_type + source_id.
 * Broadcast announcements use is_broadcast = true with null user_id.
 */
export async function createNotification(params: {
  userId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  icon?: string;
  sourceId?: string;
  sourceType?: string;
  destination?: string;
  isBroadcast?: boolean;
}): Promise<void> {
  const {
    userId,
    type,
    title,
    body,
    icon,
    sourceId,
    sourceType,
    destination,
    isBroadcast = false,
  } = params;

  if (!userId && !isBroadcast) return;
  if (!isBroadcast && sourceId && sourceType) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId!)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle();
    if (existing) return;
  }

  await supabase.from('notifications').insert({
    user_id: userId ?? null,
    type,
    title,
    body: body ?? null,
    icon: icon ?? null,
    source_id: sourceId ?? null,
    source_type: sourceType ?? null,
    destination: destination ?? null,
    is_broadcast: isBroadcast,
  });
}

/**
 * Mark a single notification as read. Idempotent.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now })
    .eq('id', id)
    .eq('is_read', false);

  setState((prev) => ({
    ...prev,
    notifications: prev.notifications.map((n) =>
      n.id === id ? { ...n, is_read: true, read_at: now } : n,
    ),
    unreadCount: Math.max(0, prev.unreadCount - 1),
  }));
}

/**
 * Dismiss a notification from the user's unified inbox. Per-user, per-notification.
 * Does NOT delete the notification — only sets dismissed_at. The underlying
 * ticket/announcement/event is not affected. Does not affect bell read state.
 */
export async function dismissNotification(id: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('notifications')
    .update({ dismissed_at: now })
    .eq('id', id)
    .is('dismissed_at', null);

  setState((prev) => ({
    ...prev,
    notifications: prev.notifications.map((n) =>
      n.id === id ? { ...n, dismissed_at: now } : n,
    ),
  }));
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now })
    .eq('user_id', userId)
    .eq('is_read', false);

  setState((prev) => ({
    ...prev,
    notifications: prev.notifications.map((n) => ({ ...n, is_read: true, read_at: now })),
    unreadCount: 0,
  }));
}

async function fetchNotifications(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${userId},is_broadcast.eq.true`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    setState((prev) => ({ ...prev, loading: false }));
    return;
  }

  const notifications = data as Notification[];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  setState({ notifications, unreadCount, loading: false });
}

function subscribeRealtime(userId: string): void {
  if (activeChannel && activeUserId === userId) return;
  if (activeChannel) {
    supabase.channel(activeChannel).unsubscribe();
  }

  const channelName = `notifications:${userId}`;
  activeChannel = channelName;
  activeUserId = userId;

  supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const newNotif = payload.new as Notification;
        setState((prev) => {
          if (prev.notifications.some((n) => n.id === newNotif.id)) return prev;
          return {
            notifications: [newNotif, ...prev.notifications].slice(0, 100),
            unreadCount: prev.unreadCount + (newNotif.is_read ? 0 : 1),
            loading: false,
          };
        });
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const updated = payload.new as Notification;
        setState((prev) => ({
          notifications: prev.notifications.map((n) => (n.id === updated.id ? updated : n)),
          unreadCount: prev.notifications.filter((n) => n.id !== updated.id ? !n.is_read : !updated.is_read).length,
          loading: false,
        }));
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const deleted = payload.old as Notification;
        setState((prev) => ({
          notifications: prev.notifications.filter((n) => n.id !== deleted.id),
          unreadCount: prev.unreadCount - (!deleted.is_read ? 1 : 0),
          loading: false,
        }));
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'is_broadcast=eq.true' },
      (payload) => {
        const newNotif = payload.new as Notification;
        if (newNotif.user_id !== null) return;
        setState((prev) => {
          if (prev.notifications.some((n) => n.id === newNotif.id)) return prev;
          return {
            notifications: [newNotif, ...prev.notifications].slice(0, 100),
            unreadCount: prev.unreadCount + (newNotif.is_read ? 0 : 1),
            loading: false,
          };
        });
      },
    )
    .subscribe();
}

function unsubscribeRealtime(): void {
  if (activeChannel) {
    supabase.channel(activeChannel).unsubscribe();
    activeChannel = null;
    activeUserId = null;
  }
}

/**
 * React hook for the notification centre. Subscribes to real-time updates.
 */
export function useNotifications(userId: string | undefined): NotificationState & {
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
} {
  const [state, setLocalState] = useState<NotificationState>(currentState);
  const userIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    const listener = (s: NotificationState) => setLocalState(s);
    listeners.add(listener);
    setLocalState(currentState);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (userIdRef.current === userId) return;
    userIdRef.current = userId;
    if (!userId) {
      unsubscribeRealtime();
      setState({ notifications: [], unreadCount: 0, loading: false });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    void fetchNotifications(userId);
    subscribeRealtime(userId);
  }, [userId]);

  const markRead = useCallback((id: string) => {
    void markNotificationRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    void markAllNotificationsRead(userId);
  }, [userId]);

  const refresh = useCallback(() => {
    if (!userId) return;
    void fetchNotifications(userId);
  }, [userId]);

  return { ...state, markRead, markAllRead, refresh };
}
