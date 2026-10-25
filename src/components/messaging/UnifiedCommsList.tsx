import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, Plus, X, MessageSquare, Bell, Mail,
  AlertTriangle, Info, Megaphone, Trophy, MoreVertical,
  Eye, UserCircle, Check, CheckCheck, Archive, Trash2, Ban,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUnifiedInbox, type UnifiedCommsItem, type CommsFilter } from '@/lib/unifiedCommsStore';
import { UserIdentityHoverCard } from '@/components/community/UserIdentityHoverCard';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { NewMessageModal } from './NewMessageModal';
import { searchSpotVaultUsers, getOrCreateConversation, fetchDMConversations, fetchUnreadCounts, markConversationRead, type DMUser, type DMConversation } from '@/lib/dmStore';
import { getMyContacts, type Contact } from '@/lib/authEngine';
import { markNotificationRead, dismissNotification } from '@/lib/notificationStore';
import { refreshUnreadCounts } from '@/lib/messagingCenterStore';
import type { SpotVaultAccount } from '@/types';
import type { ContactListItem } from './ConversationListPane';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function notifIcon(type: string | null): typeof Bell {
  switch (type) {
    case 'announcement': return Megaphone;
    case 'inbox': return Mail;
    case 'activity': return Trophy;
    case 'info_post': return Info;
    case 'mv_pull': return AlertTriangle;
    default: return Bell;
  }
}

function notifAccent(type: string | null): string {
  switch (type) {
    case 'announcement': return '#d4a52c';
    case 'inbox': return '#60a5fa';
    case 'activity': return '#34d399';
    case 'info_post': return '#a8c4b8';
    case 'mv_pull': return '#f59e0b';
    default: return '#8a9ab5';
  }
}

interface Props {
  account: SpotVaultAccount | null;
  selectedUserId: string | null;
  onSelectContact: (contact: ContactListItem) => void;
  onActivate?: () => void;
  compact?: boolean;
}

export function UnifiedCommsList({ account, selectedUserId, onSelectContact, onActivate, compact }: Props) {
  const [filter, setFilter] = useState<CommsFilter>('all');
  const [search, setSearch] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [friends, setFriends] = useState<{ userId: string; displayName: string; username: string; avatarUrl: string | null; pokerRole: string; online: boolean }[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);

  const { items, loading, dismiss, refresh } = useUnifiedInbox(account, filter);

  const loadAuxData = useCallback(async () => {
    if (!account?.id) return;
    try {
      const [contacts, convs] = await Promise.all([getMyContacts(), fetchDMConversations(account.id)]);
      setAllContacts(contacts);
      const active = contacts.filter((c: Contact) => c.status === 'active');
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, username, display_name, avatar_url, poker_role')
        .in('user_id', active.map((c: Contact) => c.user_id));
      const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; poker_role: string | null }>();
      (profiles ?? []).forEach((p) => profileMap.set(p.user_id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, poker_role: p.poker_role }));
      setFriends(active.map((c) => {
        const p = profileMap.get(c.user_id);
        return { userId: c.user_id, displayName: p?.display_name ?? p?.username ?? 'Unknown', username: p?.username ?? 'unknown', avatarUrl: p?.avatar_url ?? null, pokerRole: p?.poker_role ?? 'Player', online: false };
      }));
      setConversations(convs);
    } catch {
      // silent
    }
  }, [account?.id]);

  useEffect(() => {
    if (account?.id) void loadAuxData();
  }, [account?.id, loadAuxData]);

  const filteredItems = search
    ? items.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const handleItemClick = useCallback(
    (item: UnifiedCommsItem) => {
      if (item.kind === 'dm' && item.otherUserId) {
        onSelectContact({
          userId: item.otherUserId,
          displayName: item.title,
          username: item.title,
          avatarUrl: item.avatarUrl,
          pokerRole: '',
          online: false,
          lastMessagePreview: item.subtitle,
          lastMessageAt: item.timestamp,
          conversationId: item.conversationId,
          unread: item.unread,
        });
      }
    },
    [onSelectContact],
  );

  const handleNewMessageSuccess = useCallback((userId: string, convId: string, user: DMUser) => {
    const newConv: DMConversation = {
      conversationId: convId, otherUserId: user.user_id, otherUsername: user.username,
      otherDisplayName: user.display_name, otherAvatarUrl: user.avatar_url,
      lastMessagePreview: '', lastMessageAt: null, unread: 0,
    };
    setConversations((prev) => prev.some((c) => c.conversationId === convId) ? prev : [newConv, ...prev]);
    setShowNewMessage(false);
    refresh();
  }, [refresh]);

  const handleMarkRead = useCallback(async (item: UnifiedCommsItem) => {
    if (item.kind === 'notification' && item.notificationId && !item.isRead) {
      markNotificationRead(item.notificationId);
    } else if (item.kind === 'dm' && item.conversationId && account?.id) {
      await markConversationRead(item.conversationId, account.id);
      void refreshUnreadCounts(account.id);
    }
    refresh();
  }, [account?.id, refresh]);

  const handleMarkUnread = useCallback(async (item: UnifiedCommsItem) => {
    if (item.kind === 'notification' && item.notificationId) {
      await supabase.from('notifications').update({ is_read: false, read_at: null }).eq('id', item.notificationId);
    } else if (item.kind === 'dm' && item.conversationId && account?.id) {
      await supabase.from('user_inbox_messages').update({ read: false }).eq('conversation_id', item.conversationId).neq('sender_id', account.id);
    }
    refresh();
  }, [account?.id, refresh]);

  const handleDismiss = useCallback((item: UnifiedCommsItem) => {
    if (item.kind === 'notification' && item.notificationId) {
      dismiss(item.notificationId);
    }
  }, [dismiss]);

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      onMouseDown={onActivate}
      onTouchStart={onActivate}
    >
      {/* Header with compact filter buttons beside the heading */}
      <div className="shrink-0 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
              <MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div className="flex items-center gap-1.5">
              <p className={`font-bold tracking-wide text-white ${compact ? 'text-[10px]' : 'text-[12px]'}`}>INBOX</p>
              {/* Compact filter pills */}
              <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-black/25 p-0.5">
                <button
                  onClick={() => setFilter('all')}
                  className="rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase transition-all"
                  style={{
                    background: filter === 'all' ? 'rgba(212,165,44,0.15)' : 'transparent',
                    color: filter === 'all' ? GOLD_SOFT : 'rgba(255,255,255,0.35)',
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('chats')}
                  className="rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase transition-all"
                  style={{
                    background: filter === 'chats' ? 'rgba(212,165,44,0.15)' : 'transparent',
                    color: filter === 'chats' ? GOLD_SOFT : 'rgba(255,255,255,0.35)',
                  }}
                >
                  Chats
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setShowNewMessage(true); void loadAuxData(); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 hover:bg-white/5"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
            title="New Message"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2.5 pb-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5">
          <Search className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages & notifications…"
            className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/25"
          />
        </div>
      </div>

      {/* Unified list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-[10px] text-white/30">Loading…</p>
          </div>
        )}
        {!loading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <p className="text-[10px] text-white/30">
              {filter === 'chats' ? 'No conversations yet.' : 'No messages or notifications.'}
            </p>
            <p className="mt-1 text-[9px] text-white/20">
              {filter === 'chats' ? 'Tap the + button to message a friend.' : 'New activity will appear here.'}
            </p>
          </div>
        )}
        {!loading && filteredItems.map((item) => {
          const isSelected = item.kind === 'dm' && item.otherUserId === selectedUserId;
          const timeLabel = formatRelative(item.timestamp);

          if (item.kind === 'notification') {
            return (
              <NotificationRow
                key={item.id}
                item={item}
                timeLabel={timeLabel}
                onDismiss={() => handleDismiss(item)}
                onMarkRead={() => handleMarkRead(item)}
                onMarkUnread={() => handleMarkUnread(item)}
              />
            );
          }

          return (
            <DMRow
              key={item.id}
              item={item}
              isSelected={isSelected}
              timeLabel={timeLabel}
              onClick={() => handleItemClick(item)}
              onMarkRead={() => handleMarkRead(item)}
              onMarkUnread={() => handleMarkUnread(item)}
              onViewProfile={item.otherUserId ?? undefined}
            />
          );
        })}
      </div>

      {showNewMessage && (
        <NewMessageModal
          account={account}
          conversations={conversations}
          allContacts={allContacts}
          friends={friends}
          onSelectExisting={(contact) => { setShowNewMessage(false); onSelectContact(contact); }}
          onCreateNew={handleNewMessageSuccess}
          onClose={() => setShowNewMessage(false)}
        />
      )}
    </div>
  );
}

function DMRow({
  item,
  isSelected,
  timeLabel,
  onClick,
  onMarkRead,
  onMarkUnread,
  onViewProfile,
}: {
  item: UnifiedCommsItem;
  isSelected: boolean;
  timeLabel: string;
  onClick: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onViewProfile?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
  };

  return (
    <div
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
      style={isSelected ? { background: 'rgba(212,165,44,0.08)' } : undefined}
    >
      <div className="relative shrink-0">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" style={{ border: `1px solid ${BORDER}` }} />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border text-[9px] font-bold text-white/80" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)' }}>
            {initials(item.title)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* Name: hover opens profile card, but click opens chat (stopPropagation) */}
          <UserIdentityHoverCard userId={item.otherUserId ?? ''} fallbackName={item.title}>
            <span
              className="truncate text-[11px] font-semibold text-white/90"
              onClick={stopPropagation}
            >
              {item.title}
            </span>
          </UserIdentityHoverCard>
          {item.otherUserId && <UserIdentityFlag userId={item.otherUserId} size="sm" />}
        </div>
        <p className={`truncate text-[9px] ${item.unread > 0 ? 'text-white/60 font-medium' : 'text-white/35'}`}>
          {item.subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex flex-col items-end gap-0.5">
          {timeLabel && <span className="text-[8px] text-white/25">{timeLabel}</span>}
          {item.unread > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold" style={{ background: 'rgba(212,165,44,0.15)', color: GOLD }}>
              {item.unread}
            </span>
          )}
        </div>
        {/* Three-dot menu */}
        <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="flex h-5 w-5 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
            title="Options"
          >
            <MoreVertical className="h-3 w-3" strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-[300] mt-1 min-w-[150px] rounded-lg border border-white/[0.08] bg-[#0a0908] py-1 shadow-2xl">
              <MenuItem icon={MessageSquare} label="Open Chat" onClick={(e) => stopPropagation(e)} />
              {onViewProfile && (
                <MenuItem icon={UserCircle} label="View Profile" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} profileUserId={onViewProfile} />
              )}
              {item.unread > 0 ? (
                <MenuItem icon={CheckCheck} label="Mark Read" onClick={(e) => { stopPropagation(e); onMarkRead(); }} />
              ) : (
                <MenuItem icon={Check} label="Mark Unread" onClick={(e) => { stopPropagation(e); onMarkUnread(); }} />
              )}
              <MenuItem icon={Archive} label="Archive" onClick={(e) => stopPropagation(e)} disabled />
              <MenuItem icon={Ban} label="Block" onClick={(e) => stopPropagation(e)} disabled danger />
              <MenuItem icon={Trash2} label="Delete" onClick={(e) => stopPropagation(e)} disabled danger />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  timeLabel,
  onDismiss,
  onMarkRead,
  onMarkUnread,
}: {
  item: UnifiedCommsItem;
  timeLabel: string;
  onDismiss: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = notifIcon(item.notificationType);
  const accent = notifAccent(item.notificationType);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissing(true);
    onDismiss();
  };

  return (
    <div
      className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
      style={{
        background: item.unread > 0 ? 'rgba(212,165,44,0.04)' : undefined,
        opacity: dismissing ? 0.4 : 1,
      }}
    >
      <div className="relative shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border"
          style={{ borderColor: `${accent}30`, background: `${accent}12` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={1.5} />
        </div>
        {item.unread > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border" style={{ background: accent, borderColor: 'rgba(10,12,14,0.9)' }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] ${item.unread > 0 ? 'font-bold text-white/90' : 'font-semibold text-white/70'}`}>
          {item.title}
        </p>
        <p className="truncate text-[9px] text-white/35">{item.subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex flex-col items-end gap-0.5">
          {timeLabel && <span className="text-[8px] text-white/25">{timeLabel}</span>}
          {item.dismissible && !dismissing && (
            <button
              onClick={handleDismiss}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.06] bg-black/30 text-white/30 transition-all hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-400"
              title="Dismiss"
            >
              <X className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
        </div>
        {/* Three-dot menu */}
        <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="flex h-5 w-5 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
            title="Options"
          >
            <MoreVertical className="h-3 w-3" strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-[300] mt-1 min-w-[150px] rounded-lg border border-white/[0.08] bg-[#0a0908] py-1 shadow-2xl">
              <MenuItem icon={Eye} label="Open" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              {item.unread > 0 ? (
                <MenuItem icon={CheckCheck} label="Mark Read" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMarkRead(); }} />
              ) : (
                <MenuItem icon={Check} label="Mark Unread" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMarkUnread(); }} />
              )}
              {item.dismissible && (
                <MenuItem icon={X} label="Dismiss" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDismiss(); }} danger />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  profileUserId,
}: {
  icon: typeof Bell;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
  profileUserId?: string;
}) {
  if (profileUserId) {
    return (
      <UserIdentityHoverCard userId={profileUserId} fallbackName={label}>
        <button
          onClick={onClick}
          disabled={disabled}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold transition-colors hover:bg-white/10 disabled:opacity-40"
          style={{ color: danger ? '#fca5a5' : 'rgba(255,255,255,0.65)' }}
        >
          <Icon className="h-3 w-3" strokeWidth={1.5} /> {label}
        </button>
      </UserIdentityHoverCard>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold transition-colors hover:bg-white/10 disabled:opacity-40"
      style={{ color: danger ? '#fca5a5' : 'rgba(255,255,255,0.65)' }}
    >
      <Icon className="h-3 w-3" strokeWidth={1.5} /> {label}
    </button>
  );
}
