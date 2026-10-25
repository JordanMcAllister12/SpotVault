import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bell, MessageSquare, Users, Inbox, Activity,
  Newspaper, Gift, Megaphone, Check, X, ChevronRight,
} from 'lucide-react';
import { useNotifications, type Notification, type NotificationType } from '@/lib/notificationStore';
import { dispatchOpenMessaging } from '@/lib/profileEvents';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

const ICON_MAP: Record<NotificationType, typeof Bell> = {
  dm: MessageSquare,
  group_message: Users,
  inbox: Inbox,
  activity: Activity,
  info_post: Newspaper,
  mv_pull: Gift,
  announcement: Megaphone,
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function handleNavigate(destination: string | null): void {
  if (!destination) return;
  if (destination.startsWith('messaging:')) {
    const tab = destination.split(':')[1] as 'chats' | 'inbox' | 'groups' | 'activity' | undefined;
    dispatchOpenMessaging(tab);
  }
}

interface NotificationBellProps {
  userId?: string;
  variant?: 'desktop' | 'mobile';
}

export function NotificationBell({ userId, variant = 'desktop' }: NotificationBellProps) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'unread' | 'all'>('unread');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleClick = useCallback((notif: Notification) => {
    if (!notif.is_read) markRead(notif.id);
    handleNavigate(notif.destination);
    setOpen(false);
  }, [markRead]);

  const displayed = (tab === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications
  ).filter((n) => !n.dismissed_at);

  const isMobile = variant === 'mobile';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group relative flex h-7 items-center justify-center rounded-lg px-2 transition-all hover:bg-white/10"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell
          className="h-3.5 w-3.5 text-white/60 transition-colors group-hover:text-white/90"
          strokeWidth={1.5}
          style={unreadCount > 0 ? { color: GOLD } : undefined}
        />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[7px] font-bold"
            style={{ background: GOLD, color: '#080706', boxShadow: `0 0 6px ${GOLD}80` }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-[200] mt-2 flex flex-col overflow-hidden rounded-xl border bg-[#0b0a08] shadow-2xl ${
            isMobile ? 'w-[calc(100vw-24px)] max-w-[340px]' : 'w-[380px]'
          }`}
          style={{ borderColor: BORDER, maxHeight: isMobile ? '60vh' : '70vh' }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest text-white/80 uppercase">Notifications</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:bg-white/5 hover:text-white/70"
              aria-label="Close"
            >
              <X className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-2 py-1.5">
            <button
              onClick={() => setTab('unread')}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-bold tracking-wide uppercase transition-colors"
              style={{
                background: tab === 'unread' ? 'rgba(212,165,44,0.12)' : 'transparent',
                color: tab === 'unread' ? GOLD_SOFT : 'rgba(255,255,255,0.4)',
              }}
            >
              Unread
              {unreadCount > 0 && (
                <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[7px] font-bold" style={{ background: GOLD, color: '#080706' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('all')}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-bold tracking-wide uppercase transition-colors"
              style={{
                background: tab === 'all' ? 'rgba(212,165,44,0.12)' : 'transparent',
                color: tab === 'all' ? GOLD_SOFT : 'rgba(255,255,255,0.4)',
              }}
            >
              All
            </button>
            <div className="flex-1" />
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[8px] font-semibold text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                title="Mark all as read"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={1.5} />
                Mark all
              </button>
            )}
          </div>

          {/* Notification list — independently scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: isMobile ? 'calc(60vh - 80px)' : 'calc(70vh - 80px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-[10px] text-white/30">Loading...</span>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Bell className="h-7 w-7 text-white/10" strokeWidth={1} />
                <p className="text-[10px] text-white/30">
                  {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              displayed.map((notif) => {
                const Icon = ICON_MAP[notif.type] ?? Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className="group flex w-full items-start gap-2.5 border-b border-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    {/* Icon */}
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: notif.is_read ? 'rgba(255,255,255,0.06)' : `${GOLD}30`,
                        background: notif.is_read ? 'rgba(255,255,255,0.02)' : `${GOLD}08`,
                      }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        strokeWidth={1.5}
                        style={{ color: notif.is_read ? 'rgba(255,255,255,0.3)' : GOLD }}
                      />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!notif.is_read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GOLD, boxShadow: `0 0 4px ${GOLD}80` }} />
                        )}
                        <p
                          className="truncate text-[10px] font-semibold"
                          style={{ color: notif.is_read ? 'rgba(255,255,255,0.45)' : GOLD_SOFT }}
                        >
                          {notif.title}
                        </p>
                      </div>
                      {notif.body && (
                        <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-white/40">
                          {notif.body}
                        </p>
                      )}
                      <p className="mt-0.5 text-[8px] text-white/20">
                        {relativeTime(notif.created_at)}
                      </p>
                    </div>

                    {/* Navigation chevron */}
                    {notif.destination && (
                      <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-white/15 transition-colors group-hover:text-white/40" strokeWidth={1.5} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="shrink-0 border-t border-white/[0.06] px-3 py-1.5">
              <p className="text-[8px] text-white/20">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                {' · '}
                {notifications.length} total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
