import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Loader2, UserCheck } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { searchSpotVaultUsers, type DMUser } from '@/lib/dmStore';

const GOLD = '#d4a52c';
const GOLD_TEXT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface NewMessageModalProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (user: DMUser) => void;
}

export function NewMessageModal({ open, onClose, onSelectUser }: NewMessageModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DMUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const users = await searchSpotVaultUsers(q);
      setResults(users);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
  }, [open]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  const handleSelect = useCallback((user: DMUser) => {
    onSelectUser(user);
    setQuery('');
    setResults([]);
  }, [onSelectUser]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border shadow-2xl"
        style={{ borderColor: BORDER, background: 'rgba(10, 9, 8, 0.98)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-[12px] font-bold tracking-wide text-white">New Message</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/35 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3">
          <label className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-white/30" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search SpotVault users..."
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
            />
            {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />}
          </label>
          <p className="mt-1.5 text-[9px] text-white/25">Search by username or display name</p>
        </div>

        {/* Results */}
        <div className="max-h-[320px] min-h-[80px] overflow-y-auto px-2 pb-3">
          {error ? (
            <p className="px-3 py-6 text-center text-[11px] text-red-400/70">{error}</p>
          ) : !query.trim() ? (
            <p className="px-3 py-6 text-center text-[11px] text-white/25">Start typing to find SpotVault users.</p>
          ) : !loading && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] text-white/25">No users found for "{query}".</p>
          ) : (
            results.map((user) => (
              <button
                key={user.user_id}
                onClick={() => handleSelect(user)}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                <Avatar
                  userId={user.user_id}
                  name={user.display_name || user.username}
                  avatarUrl={user.avatar_url}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-semibold text-white/85">{user.display_name || user.username}</span>
                    {user.is_verified && <UserCheck className="h-3 w-3 shrink-0 text-[#d4a52c]" strokeWidth={2} />}
                  </div>
                  <span className="text-[10px] text-white/35">@{user.username}</span>
                </div>
                {(user.poker_role || user.primary_role) && (
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wide uppercase"
                    style={{ borderColor: 'rgba(212,165,44,0.2)', color: GOLD_TEXT, background: 'rgba(212,165,44,0.06)' }}
                  >
                    {user.poker_role || user.primary_role}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
