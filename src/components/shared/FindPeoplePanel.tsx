import { useState, useCallback, useRef } from 'react';
import { Search, UserPlus, Loader2, BadgeCheck, ArrowLeft } from 'lucide-react';
import { searchUsers, type UserSearchResult } from '@/lib/socialGraphStore';
import { requestContact, getPendingContactRequests, getMyContacts } from '@/lib/authEngine';
import { dispatchOpenProfile } from '@/lib/profileEvents';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

type ContactState = 'none' | 'pending' | 'contact' | 'sent';

interface SearchResultRow extends UserSearchResult {
  contactState: ContactState;
}

export function FindPeoplePanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const [users, pending, contacts] = await Promise.all([
      searchUsers(q, 15),
      getPendingContactRequests(),
      getMyContacts(),
    ]);
    const pendingIds = new Set(pending.map(p => p.requester_id));
    const contactIds = new Set(contacts.map(c => c.user_id));
    setResults(
      users.map(u => ({
        ...u,
        contactState: contactIds.has(u.user_id)
          ? ('contact' as ContactState)
          : pendingIds.has(u.user_id)
            ? ('pending' as ContactState)
            : ('none' as ContactState),
      }))
    );
    setLoading(false);
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleAddContact = async (userId: string) => {
    setSendingTo(userId);
    const result = await requestContact(userId);
    if (result) {
      setResults(prev =>
        prev.map(r => r.user_id === userId ? { ...r, contactState: 'sent' as ContactState } : r)
      );
    }
    setSendingTo(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <h2 className="text-sm font-bold text-white">Find People</h2>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            placeholder="Search by username, name, or SV-ID..."
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/30 focus:outline-none"
            autoFocus
          />
        </div>
        <p className="mt-1.5 text-[10px] text-white/30">
          Search by @username, display name, or SpotVault ID (SV-XXXXXX). Email addresses are never exposed.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        )}
        {!loading && results.length === 0 && query.trim() && (
          <p className="py-8 text-center text-[11px] text-white/30">
            No users found for "{query}"
          </p>
        )}
        {!loading && results.length === 0 && !query.trim() && (
          <p className="py-8 text-center text-[11px] text-white/30">
            Search to find people on SpotVault.
          </p>
        )}
        {results.map(user => (
          <div
            key={user.user_id}
            className="mb-2 flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5 transition-colors hover:border-white/[0.08]"
          >
            <button
              onClick={() => { onClose(); dispatchOpenProfile(user.user_id); }}
              className="shrink-0"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/60">
                  {(user.display_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onClose(); dispatchOpenProfile(user.user_id); }}
                  className="truncate text-[12px] font-semibold text-white hover:underline"
                >
                  {user.display_name}
                </button>
                {user.is_verified && <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: GOLD }} />}
              </div>
              {user.username && (
                <p className="truncate text-[10px] text-white/40">@{user.username}</p>
              )}
              {user.poker_role && (
                <p className="truncate text-[9px] text-white/30">{user.poker_role}</p>
              )}
            </div>

            <div className="shrink-0">
              {user.contactState === 'contact' ? (
                <span className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: GOLD_SOFT }}>
                  Contact
                </span>
              ) : user.contactState === 'pending' ? (
                <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
                  Pending
                </span>
              ) : user.contactState === 'sent' ? (
                <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
                  Request Sent
                </span>
              ) : (
                <button
                  onClick={() => handleAddContact(user.user_id)}
                  disabled={sendingTo === user.user_id}
                  className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-[#c0911e]/[0.15]"
                  style={{ color: GOLD_SOFT }}
                >
                  {sendingTo === user.user_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserPlus className="h-3 w-3" />
                  )}
                  Add
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
