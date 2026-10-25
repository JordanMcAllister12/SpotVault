import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, ChevronDown, Globe, Plus, MessageSquare,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  searchSpotVaultUsers,
  getOrCreateConversation,
  fetchDMConversations,
  fetchUnreadCounts,
  type DMUser,
  type DMConversation,
} from '@/lib/dmStore';
import { canMessageUser } from '@/lib/followEngine';
import { getMyContacts, requestContact, type Contact } from '@/lib/authEngine';
import { UserIdentityHoverCard } from '@/components/community/UserIdentityHoverCard';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { NewMessageModal } from './NewMessageModal';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export interface ContactListItem {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  pokerRole: string;
  online: boolean;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  conversationId: string | null;
  unread: number;
}

interface Props {
  account: SpotVaultAccount | null;
  selectedUserId: string | null;
  onSelect: (contact: ContactListItem) => void;
  onActivate?: () => void;
  compact?: boolean;
}

export function ConversationListPane({ account, selectedUserId, onSelect, onActivate, compact }: Props) {
  const [friends, setFriends] = useState<{ userId: string; displayName: string; username: string; avatarUrl: string | null; pokerRole: string; online: boolean }[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const currentUserId = account?.id ?? '';

  const loadData = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [contacts, convs] = await Promise.all([getMyContacts(), fetchDMConversations(currentUserId)]);
      setAllContacts(contacts);
      const activeContacts = contacts.filter((c: Contact) => c.status === 'active');
      const contactUserIds = activeContacts.map((c: Contact) => c.user_id);
      let friendProfiles: typeof friends = [];
      if (contactUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, username, display_name, avatar_url, poker_role')
          .in('user_id', contactUserIds);
        const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; poker_role: string | null }>();
        (profiles ?? []).forEach((p) => profileMap.set(p.user_id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, poker_role: p.poker_role }));
        friendProfiles = activeContacts.map((c) => {
          const p = profileMap.get(c.user_id);
          return {
            userId: c.user_id,
            displayName: p?.display_name ?? p?.username ?? 'Unknown',
            username: p?.username ?? 'unknown',
            avatarUrl: p?.avatar_url ?? null,
            pokerRole: p?.poker_role ?? 'Player',
            online: false,
          };
        });
      }
      setFriends(friendProfiles);
      setConversations(convs);
      const counts = await fetchUnreadCounts(currentUserId);
      setUnreadCounts(counts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { if (account) loadData(); }, [account, loadData]);

  useEffect(() => {
    if (!networkDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) setNetworkDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [networkDropdownOpen]);

  const networkOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [{ id: 'all', label: 'All Networks' }];
    if (account) {
      const activeGrants = account.grants.filter(g => g.level !== 'none');
      for (const g of activeGrants) {
        if (g.portal === 'PLAYER') options.push({ id: 'spotvault', label: 'SpotVault' });
        else if (g.portal === 'STAKEKINGS_PLAYER' || g.portal === 'STAKEKINGS_ADMIN') options.push({ id: 'stakekings', label: 'StakeKings' });
        else if (g.portal === 'COACH') options.push({ id: 'coach', label: 'Coach Network' });
        else if (g.portal === 'CREATOR') options.push({ id: 'creator', label: 'Creator Network' });
        else if (g.portal === 'BUSINESS') options.push({ id: 'business', label: 'Business Network' });
        else if (g.portal === 'STABLE') options.push({ id: 'stable', label: 'Stable Network' });
        else if (g.portal === 'MEDIA') options.push({ id: 'media', label: 'Media Network' });
      }
    }
    const seen = new Set<string>();
    return options.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
  }, [account]);

  const selectedNetworkLabel = networkOptions.find(o => o.id === networkFilter)?.label ?? 'All Networks';

  const contactList = useMemo<ContactListItem[]>(() => {
    const convMap = new Map(conversations.map(c => [c.otherUserId, c]));
    const seen = new Set<string>();
    const items: ContactListItem[] = [];
    for (const f of friends) {
      seen.add(f.userId);
      const conv = convMap.get(f.userId);
      items.push({
        userId: f.userId, displayName: f.displayName, username: f.username,
        avatarUrl: f.avatarUrl, pokerRole: f.pokerRole, online: f.online,
        lastMessagePreview: conv?.lastMessagePreview ?? '',
        lastMessageAt: conv?.lastMessageAt ?? null,
        conversationId: conv?.conversationId ?? null,
        unread: conv ? (unreadCounts[conv.conversationId] ?? 0) : 0,
      });
    }
    for (const c of conversations) {
      if (seen.has(c.otherUserId)) continue;
      seen.add(c.otherUserId);
      items.push({
        userId: c.otherUserId, displayName: c.otherDisplayName ?? c.otherUsername,
        username: c.otherUsername, avatarUrl: c.otherAvatarUrl, pokerRole: '', online: false,
        lastMessagePreview: c.lastMessagePreview, lastMessageAt: c.lastMessageAt,
        conversationId: c.conversationId, unread: unreadCounts[c.conversationId] ?? 0,
      });
    }
    return items;
  }, [friends, conversations, unreadCounts]);

  const filteredContacts = contactList.filter((c) => {
    if (search && !c.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleNewMessageSuccess = useCallback((userId: string, convId: string, user: DMUser) => {
    const newConv: DMConversation = {
      conversationId: convId, otherUserId: user.user_id, otherUsername: user.username,
      otherDisplayName: user.display_name, otherAvatarUrl: user.avatar_url,
      lastMessagePreview: '', lastMessageAt: null, unread: 0,
    };
    setConversations(prev => {
      if (prev.some(c => c.conversationId === convId)) return prev;
      return [newConv, ...prev];
    });
    setShowNewMessage(false);
  }, []);

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      onMouseDown={onActivate}
      onTouchStart={onActivate}
    >
      {/* Header */}
      <div className="shrink-0 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
              <MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <p className={`font-bold tracking-wide text-white ${compact ? 'text-[10px]' : 'text-[12px]'}`}>CHATS</p>
              <p className="text-[7px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Private Messages</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewMessage(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 hover:bg-white/5"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
            title="New Message"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search + Network filter */}
      <div className="shrink-0 px-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5">
            <Search className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/25"
            />
          </div>
          <div ref={networkDropdownRef} className="relative shrink-0">
            <button
              onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
              className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-[9px] font-semibold text-white/50 transition-colors hover:text-white/70"
            >
              <Globe className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              <span className="max-w-[80px] truncate">{selectedNetworkLabel}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
            </button>
            {networkDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-white/[0.08] bg-[#0a0908] py-1 shadow-xl">
                {networkOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setNetworkFilter(opt.id); setNetworkDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/[0.04]"
                    style={{ color: networkFilter === opt.id ? GOLD_SOFT : 'rgba(255,255,255,0.5)' }}
                  >
                    {networkFilter === opt.id && <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {loading && <div className="py-6 text-center"><p className="text-[10px] text-white/30">Loading conversations…</p></div>}
        {!loading && filteredContacts.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <p className="text-[10px] text-white/30">No conversations yet.</p>
            <p className="mt-1 text-[9px] text-white/20">Tap the + button to message a friend.</p>
          </div>
        )}
        {!loading && filteredContacts.map((contact) => {
          const lastTime = contact.lastMessageAt ? formatTime(contact.lastMessageAt) : '';
          const isSelected = selectedUserId === contact.userId;
          return (
            <button
              key={contact.userId}
              onClick={() => onSelect(contact)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
              style={isSelected ? { background: 'rgba(212,165,44,0.08)' } : undefined}
            >
              <div className="relative shrink-0">
                {contact.avatarUrl ? (
                  <img src={contact.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" style={{ border: `1px solid ${BORDER}` }} />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border text-[9px] font-bold text-white/80" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)' }}>
                    {initials(contact.displayName)}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border" style={{ background: contact.online ? '#34d399' : '#475569', borderColor: 'rgba(10,12,14,0.9)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <UserIdentityHoverCard userId={contact.userId} fallbackName={contact.displayName}>
                    <p className="truncate text-[11px] font-semibold text-white/90">{contact.displayName}</p>
                  </UserIdentityHoverCard>
                  <UserIdentityFlag userId={contact.userId} size="sm" />
                </div>
                <p className="truncate text-[9px] text-white/35">{contact.lastMessagePreview || (contact.pokerRole || 'Friend')}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                {lastTime && <span className="text-[8px] text-white/25">{lastTime}</span>}
                {contact.unread > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold" style={{ background: 'rgba(212,165,44,0.15)', color: GOLD }}>
                    {contact.unread}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {showNewMessage && (
        <NewMessageModal
          account={account}
          conversations={conversations}
          allContacts={allContacts}
          friends={friends}
          onSelectExisting={(contact) => { setShowNewMessage(false); onSelect(contact); }}
          onCreateNew={handleNewMessageSuccess}
          onClose={() => setShowNewMessage(false)}
        />
      )}
    </div>
  );
}
