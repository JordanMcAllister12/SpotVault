import { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import {
  searchSpotVaultUsers,
  getOrCreateConversation,
  type DMUser,
  type DMConversation,
} from '@/lib/dmStore';
import { canMessageUser } from '@/lib/followEngine';
import { requestContact, type Contact } from '@/lib/authEngine';
import type { ContactListItem } from './ConversationListPane';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

interface Props {
  account: SpotVaultAccount | null;
  conversations: DMConversation[];
  allContacts: Contact[];
  friends: { userId: string }[];
  onSelectExisting: (contact: ContactListItem) => void;
  onCreateNew: (userId: string, convId: string, user: DMUser) => void;
  onClose: () => void;
}

export function NewMessageModal({ account, conversations, allContacts, friends, onSelectExisting, onCreateNew, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DMUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<DMUser | null>(null);
  const [reminderSent, setReminderSent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchSpotVaultUsers(search);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  const REMINDER_KEY = (uid: string) => `sv_reminder_sent_${uid}`;

  const handleSendReminder = async (user: DMUser) => {
    const key = REMINDER_KEY(user.user_id);
    const last = localStorage.getItem(key);
    if (last && Date.now() - Number(last) < 24 * 60 * 60 * 1000) { setReminderSent(true); return; }
    await requestContact(user.user_id);
    localStorage.setItem(key, String(Date.now()));
    setReminderSent(true);
  };

  const handleSelect = async (user: DMUser) => {
    setError(null);
    setPendingUserId(null);
    setReminderSent(false);

    const pendingContact = allContacts.find(c => c.user_id === user.user_id && c.status === 'pending');
    if (pendingContact) {
      setPendingUserId(user.user_id);
      setPendingUser(user);
      setError('__pending__');
      return;
    }

    const allowed = await canMessageUser(user.user_id);
    if (!allowed) { setError('This user does not accept messages from you.'); return; }

    const existing = conversations.find(c => c.otherUserId === user.user_id);
    if (existing) {
      onSelectExisting({
        userId: user.user_id,
        displayName: user.display_name ?? user.username,
        username: user.username,
        avatarUrl: user.avatar_url,
        pokerRole: user.poker_role,
        online: false,
        lastMessagePreview: existing.lastMessagePreview,
        lastMessageAt: existing.lastMessageAt,
        conversationId: existing.conversationId,
        unread: 0,
      });
      return;
    }

    const convId = await getOrCreateConversation(user.user_id);
    if (!convId) { setError('Could not create conversation. Please try again.'); return; }
    onCreateNew(user.user_id, convId, user);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 p-4 pt-16" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border p-4" style={{ borderColor: BORDER, background: '#0d0f12' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <UserPlus size={16} style={{ color: GOLD }} /> New Message
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={16} /></button>
        </div>
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or username…"
            className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
            autoFocus
          />
        </div>
        {error === '__pending__' && pendingUser ? (
          <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
            <p className="text-[10px] leading-relaxed text-amber-300/90">
              Your contact request to <span className="font-semibold text-amber-200">{pendingUser.display_name ?? pendingUser.username}</span> is still pending. They must accept your request before you can exchange messages.
            </p>
            {reminderSent ? (
              <p className="mt-1.5 text-[9px] text-amber-400/60">Reminder sent. You can send another in 24 hours.</p>
            ) : (
              <button onClick={() => handleSendReminder(pendingUser)} className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/25">
                Send Reminder
              </button>
            )}
          </div>
        ) : error ? (
          <p className="mb-2 text-[10px] text-red-400/80">{error}</p>
        ) : null}
        <div className="flex flex-col gap-1" style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {searching && <p className="py-3 text-center text-[10px] text-white/30">Searching…</p>}
          {!searching && search.trim() && results.length === 0 && <p className="py-3 text-center text-[10px] text-white/30">No users found.</p>}
          {!searching && !search.trim() && <p className="py-3 text-center text-[10px] text-white/30">Type a name to search for friends.</p>}
          {results.map((user) => {
            const isFriend = friends.some(f => f.userId === user.user_id);
            return (
              <button
                key={user.user_id}
                onClick={() => handleSelect(user)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:scale-[1.02]"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold text-white/80" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)' }}>
                  {initials(user.display_name ?? user.username)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-white/90">{user.display_name ?? user.username}</p>
                  <p className="truncate text-[9px] text-white/35">{user.username}{user.poker_role ? ` · ${user.poker_role}` : ''}</p>
                </div>
                {isFriend && <span className="shrink-0 text-[8px] font-bold" style={{ color: GOLD }}>FRIEND</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
