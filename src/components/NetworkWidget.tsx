import { useState, useEffect, useCallback, useRef } from 'react';
import { AvatarImg } from '@/components/shared/Avatar';
import {
  Search, MapPin, Users, Loader2, AlertCircle,
  UserPlus, UserCheck, MessageSquare, X, TrendingUp,
} from 'lucide-react';
import { fetchProfile } from '@/lib/profileStore';
import {
  type FollowUser,
  followUser, unfollowUser, isFollowing, getUsersByHomeCity, getMyFollowing,
  blockUser, canMessageUser,
} from '@/lib/followEngine';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

type Filter = 'home-city' | 'following';

interface Props {
  currentUserId: string;
  onOpenProfile?: (accountId: string) => void;
  onMessage?: (accountId: string) => void;
}

export function NetworkWidget({ currentUserId, onOpenProfile, onMessage }: Props) {
  const [filter, setFilter] = useState<Filter>('home-city');
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [homeCitySlug, setHomeCitySlug] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<FollowUser | null>(null);
  const [followPending, setFollowPending] = useState<Set<string>>(new Set());

  // Load following list and home city on mount
  useEffect(() => {
    (async () => {
      const [following, profile] = await Promise.all([
        getMyFollowing(),
        fetchProfile(currentUserId),
      ]);
      setFollowingIds(new Set(following));
      setHomeCitySlug(profile?.home_city_slug ?? null);
    })();
  }, [currentUserId]);

  // Load users when filter or city changes
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      if (filter === 'following') {
        // Load profiles for followed user IDs
        const ids = Array.from(followingIds);
        const profiles = await Promise.all(ids.map(id => fetchProfile(id)));
        const followUsers: FollowUser[] = profiles
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map(p => ({
            user_id: p.account_id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url || null,
            poker_role: p.poker_role || null,
            bio: p.bio || null,
            home_city_slug: p.home_city_slug,
          }));
        setUsers(followUsers);
      } else if (filter === 'home-city' && homeCitySlug) {
        const cityUsers = await getUsersByHomeCity(homeCitySlug);
        setUsers(cityUsers);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }, [filter, followingIds, homeCitySlug]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleFollow = useCallback(async (userId: string) => {
    if (followPending.has(userId)) return;
    setFollowPending(prev => new Set(prev).add(userId));
    const result = await followUser(userId);
    if (result === 'following' || result === 'already_following') {
      setFollowingIds(prev => new Set(prev).add(userId));
    }
    setFollowPending(prev => { const n = new Set(prev); n.delete(userId); return n; });
  }, [followPending]);

  const handleUnfollow = useCallback(async (userId: string) => {
    if (followPending.has(userId)) return;
    setFollowPending(prev => new Set(prev).add(userId));
    const ok = await unfollowUser(userId);
    if (ok) {
      setFollowingIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
    setFollowPending(prev => { const n = new Set(prev); n.delete(userId); return n; });
  }, [followPending]);

  const filtered = search.trim()
    ? users.filter(u => {
        const q = search.toLowerCase();
        return u.display_name?.toLowerCase().includes(q)
          || u.username?.toLowerCase().includes(q)
          || u.poker_role?.toLowerCase().includes(q);
      })
    : users;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-2xl border border-[#c0911e]/12 bg-black/30 p-5 backdrop-blur-md sm:p-6" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 40px -16px rgba(0,0,0,0.7)' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
              <Users className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Network</h2>
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Discover · Follow · Connect</span>
            </div>
          </div>
          <span className="rounded-full border border-[#c0911e]/20 bg-[#c0911e]/8 px-2.5 py-1 text-[10px] font-bold text-[#f5e6b0]">
            {filtered.length} {filtered.length === 1 ? 'PERSON' : 'PEOPLE'}
          </span>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <Search className="h-4 w-4 text-white/30" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-white/30 hover:text-white">
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 flex gap-2">
          <FilterButton active={filter === 'home-city'} onClick={() => setFilter('home-city')} icon={<MapPin className="h-3 w-3" strokeWidth={1.5} />}>
            Home City
          </FilterButton>
          <FilterButton active={filter === 'following'} onClick={() => setFilter('following')} icon={<UserCheck className="h-3 w-3" strokeWidth={1.5} />}>
            Following
          </FilterButton>
        </div>

        {/* No home city */}
        {filter === 'home-city' && !homeCitySlug && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-white/40">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            Set your Home City in your Profile to discover local players.
          </div>
        )}

        {/* User list */}
        <div className="mt-4 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" strokeWidth={1.5} />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-6 w-6 text-white/15" strokeWidth={1.5} />
              <p className="mt-2 text-[12px] text-white/35">
                {filter === 'following' ? 'You are not following anyone yet.' : 'No players found in this area.'}
              </p>
            </div>
          )}

          {!loading && filtered.map((user) => (
            <UserRow
              key={user.user_id}
              user={user}
              isFollowing={followingIds.has(user.user_id)}
              followPending={followPending.has(user.user_id)}
              onFollow={() => handleFollow(user.user_id)}
              onUnfollow={() => handleUnfollow(user.user_id)}
              onClick={() => setSelectedUser(user)}
            />
          ))}
        </div>
      </div>

      {/* User preview modal */}
      {selectedUser && (
        <UserPreviewModal
          user={selectedUser}
          isFollowing={followingIds.has(selectedUser.user_id)}
          followPending={followPending.has(selectedUser.user_id)}
          onFollow={() => handleFollow(selectedUser.user_id)}
          onUnfollow={() => handleUnfollow(selectedUser.user_id)}
          onBlock={async () => { await blockUser(selectedUser.user_id); setSelectedUser(null); loadUsers(); }}
          onMessage={onMessage}
          onViewProfile={onOpenProfile}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

// ── Filter Button ──

function FilterButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-wide uppercase transition-colors"
      style={active
        ? { borderColor: GOLD, background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT }
        : { borderColor: 'rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.4)' }
      }
    >
      {icon}
      {children}
    </button>
  );
}

// ── User Row ──

function UserRow({ user, isFollowing, followPending, onFollow, onUnfollow, onClick }: {
  user: FollowUser;
  isFollowing: boolean;
  followPending: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.04]">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10 text-sm font-bold text-[#f5e6b0]">
          {user.avatar_url ? <AvatarImg src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" style={{ objectPosition: user.avatar_url === '/assets/profiles/image copy 6.png' ? 'center 30%' : undefined }} fallback={user.display_name?.charAt(0).toUpperCase()} /> : user.display_name?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/90">{user.display_name}</p>
          {user.username && <p className="truncate text-[10px] text-white/35">@{user.username}</p>}
          {user.poker_role && <p className="truncate text-[9px] text-[#c0911e]/50">{user.poker_role}</p>}
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); isFollowing ? onUnfollow() : onFollow(); }}
        disabled={followPending}
        className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase transition-colors disabled:opacity-50"
        style={isFollowing
          ? { borderColor: 'rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.4)' }
          : { borderColor: GOLD + '40', background: GOLD + '12', color: GOLD_SOFT }
        }
      >
        {followPending ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
          : isFollowing ? <UserCheck className="h-3 w-3" strokeWidth={1.5} />
          : <UserPlus className="h-3 w-3" strokeWidth={1.5} />}
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

// ── User Preview Modal ──

function UserPreviewModal({ user, isFollowing, followPending, onFollow, onUnfollow, onBlock, onMessage, onViewProfile, onClose }: {
  user: FollowUser;
  isFollowing: boolean;
  followPending: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onBlock: () => void;
  onMessage?: (accountId: string) => void;
  onViewProfile?: (accountId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-[#0a0c0e] p-5 shadow-2xl" style={{ borderColor: BORDER }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#c0911e]/30 bg-[#c0911e]/10 text-xl font-bold text-[#f5e6b0]">
              {user.avatar_url ? <AvatarImg src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" style={{ objectPosition: user.avatar_url === '/assets/profiles/image copy 6.png' ? 'center 30%' : undefined }} fallback={user.display_name?.charAt(0).toUpperCase()} /> : user.display_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{user.display_name}</h3>
              {user.username && <p className="text-[11px] text-white/40">@{user.username}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>

        {user.poker_role && (
          <div className="mt-3">
            <span className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/8 px-2.5 py-1 text-[9px] font-bold tracking-wide text-[#c0911e] uppercase">{user.poker_role}</span>
          </div>
        )}
        {user.bio && <p className="mt-3 text-[12px] leading-relaxed text-white/55">{user.bio}</p>}

        <div className="mt-5 space-y-2">
          <button
            onClick={() => isFollowing ? onUnfollow() : onFollow()}
            disabled={followPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-50"
            style={isFollowing
              ? { borderColor: 'rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.5)' }
              : { borderColor: GOLD, background: GOLD + '15', color: GOLD_SOFT }
            }
          >
            {followPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              : isFollowing ? <UserCheck className="h-3.5 w-3.5" strokeWidth={1.5} /> : <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {isFollowing ? 'Following' : 'Follow'}
          </button>

          {onMessage && (
            <button
              onClick={() => onMessage(user.user_id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold tracking-widest text-white/60 uppercase transition-colors hover:text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} /> Request Contact
            </button>
          )}

          {onViewProfile && (
            <button
              onClick={() => { onViewProfile(user.user_id); onClose(); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold tracking-widest text-white/60 uppercase transition-colors hover:text-white"
            >
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} /> View Profile
            </button>
          )}

          <button
            onClick={onBlock}
            className="w-full rounded-lg border border-red-500/20 bg-red-500/5 py-2 text-[10px] font-semibold tracking-wide text-red-400/60 uppercase transition-colors hover:text-red-400"
          >
            Block
          </button>
        </div>
      </div>
    </div>
  );
}
