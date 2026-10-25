import { useState, useEffect, useCallback } from 'react';
import { AvatarImg } from '@/components/shared/Avatar';
import {
  Users, UserPlus, UserCheck, MessageSquare, Search, Navigation, MapPin,
  Loader2, AlertCircle, X, Inbox, Send, Bell,
  Shield, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import {
  type FollowUser, type PrivacySettings,
  followUser, unfollowUser, getMyFollowing, getMyFollowers, getMyBlockedUsers,
  getPendingFollowRequests, acceptFollowRequest, declineFollowRequest,
  getUsersByHomeCity, getMyPrivacySettings, updatePrivacySettings,
  blockUser, unblockUser,
} from '@/lib/followEngine';
import {
  requestContact, acceptContact, declineContact, removeContact,
  getMyContacts, getPendingContactRequests, type Contact,
} from '@/lib/contactsEngine';
import { fetchProfile, fetchSystemMessages } from '@/lib/profileStore';
import { resolveCoordinates, fetchAllCities, formatCityShort } from '@/lib/cityDatabase';
import { MessagingWorkspace } from '@/components/MessagingWorkspace';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

type NetworkSubTab = 'messages' | 'notifications' | 'following' | 'followers' | 'contacts' | 'requests' | 'blocked' | 'discover' | 'privacy';
type CityMode = 'home' | 'current';

interface Props {
  accountId: string;
  account?: SpotVaultAccount | null;
  initialSubTab?: NetworkSubTab;
  initialConversationWith?: string | null;
}

export function NetworkSection({ accountId, account, initialSubTab = 'messages', initialConversationWith }: Props) {
  const [subTab, setSubTab] = useState<NetworkSubTab>(initialSubTab);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followRequests, setFollowRequests] = useState<Array<{ requester_id: string; created_at: string }>>([]);
  const [contactRequests, setContactRequests] = useState<Array<{ relationship_id: string; requester_id: string; created_at: string }>>([]);
  const [privacy, setPrivacy] = useState<PrivacySettings>({ who_can_follow: 'everyone', who_can_message: 'contacts_only', share_current_city: false });
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  const loadAll = useCallback(async () => {
    const [following, followers, blocked, conts, fReqs, cReqs, priv] = await Promise.all([
      getMyFollowing(),
      getMyFollowers(),
      getMyBlockedUsers(),
      getMyContacts(),
      getPendingFollowRequests(),
      getPendingContactRequests(),
      getMyPrivacySettings(),
    ]);
    setFollowingIds(new Set(following));
    setFollowerIds(new Set(followers));
    setBlockedIds(new Set(blocked));
    setContacts(conts);
    setFollowRequests(fReqs);
    setContactRequests(cReqs);
    setPrivacy(priv);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleFollow = useCallback(async (userId: string) => {
    if (followPending.has(userId)) return;
    setFollowPending(prev => new Set(prev).add(userId));
    const result = await followUser(userId);
    if (result === 'following' || result === 'already_following' || result === 'requested') {
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

  const handleBlock = useCallback(async (userId: string) => {
    const ok = await blockUser(userId);
    if (ok) {
      setBlockedIds(prev => new Set(prev).add(userId));
      setFollowingIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }, []);

  const handleUnblock = useCallback(async (userId: string) => {
    const ok = await unblockUser(userId);
    if (ok) {
      setBlockedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }, []);

  const handleAcceptFollow = useCallback(async (requesterId: string) => {
    const ok = await acceptFollowRequest(requesterId);
    if (ok) {
      setFollowRequests(prev => prev.filter(r => r.requester_id !== requesterId));
      setFollowingIds(prev => new Set(prev).add(requesterId));
    }
  }, []);

  const handleDeclineFollow = useCallback(async (requesterId: string) => {
    const ok = await declineFollowRequest(requesterId);
    if (ok) {
      setFollowRequests(prev => prev.filter(r => r.requester_id !== requesterId));
    }
  }, []);

  const handleAcceptContact = useCallback(async (relId: string) => {
    const ok = await acceptContact(relId);
    if (ok) {
      setContactRequests(prev => prev.filter(r => r.relationship_id !== relId));
      const conts = await getMyContacts();
      setContacts(conts);
    }
  }, []);

  const handleDeclineContact = useCallback(async (relId: string) => {
    const ok = await declineContact(relId);
    if (ok) {
      setContactRequests(prev => prev.filter(r => r.relationship_id !== relId));
    }
  }, []);

  const handleRemoveContact = useCallback(async (relId: string) => {
    const ok = await removeContact(relId);
    if (ok) {
      setContacts(prev => prev.filter(c => c.relationship_id !== relId));
    }
  }, []);

  const handleRequestContact = useCallback(async (userId: string) => {
    await requestContact(userId);
  }, []);

  const totalRequests = followRequests.length + contactRequests.length;

  return (
    <div className="mt-5 space-y-4">
      {/* Sub-tabs — wrap on narrow, scroll on very narrow */}
      <div className="flex flex-wrap gap-0.5 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <SubTabButton active={subTab === 'messages'} onClick={() => setSubTab('messages')} label="Messages" count={unreadCount > 0 ? unreadCount : undefined} />
        <SubTabButton active={subTab === 'notifications'} onClick={() => setSubTab('notifications')} label="Notifications" />
        <SubTabButton active={subTab === 'following'} onClick={() => setSubTab('following')} label="Following" count={followingIds.size} />
        <SubTabButton active={subTab === 'followers'} onClick={() => setSubTab('followers')} label="Followers" count={followerIds.size} />
        <SubTabButton active={subTab === 'contacts'} onClick={() => setSubTab('contacts')} label="Contacts" count={contacts.length} />
        <SubTabButton active={subTab === 'requests'} onClick={() => setSubTab('requests')} label="Requests" count={totalRequests} />
        <SubTabButton active={subTab === 'blocked'} onClick={() => setSubTab('blocked')} label="Blocked" count={blockedIds.size} />
        <SubTabButton active={subTab === 'discover'} onClick={() => setSubTab('discover')} label="Discover" />
        <SubTabButton active={subTab === 'privacy'} onClick={() => setSubTab('privacy')} label="Privacy" />
      </div>

      {/* Content */}
      {subTab === 'messages' ? (
        <div className="h-[600px] overflow-hidden rounded-xl border border-white/[0.06]">
          <MessagingWorkspace
            accountId={accountId}
            account={account ?? undefined}
            initialConversationWith={initialConversationWith}
            onUnreadChange={setUnreadCount}
          />
        </div>
      ) : subTab === 'notifications' ? (
        <NotificationsPanel accountId={accountId} />
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      ) : (
        <>
          {subTab === 'following' && (
            <UserList
              userIds={Array.from(followingIds)}
              followingIds={followingIds}
              blockedIds={blockedIds}
              followPending={followPending}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              onBlock={handleBlock}
              onRequestContact={handleRequestContact}
              emptyMessage="You're not following anyone yet."
            />
          )}
          {subTab === 'followers' && (
            <UserList
              userIds={Array.from(followerIds)}
              followingIds={followingIds}
              blockedIds={blockedIds}
              followPending={followPending}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              onBlock={handleBlock}
              onRequestContact={handleRequestContact}
              emptyMessage="No followers yet."
            />
          )}
          {subTab === 'contacts' && (
            <ContactList
              contacts={contacts}
              onRemove={handleRemoveContact}
              onMessage={(userId) => { setSubTab('messages'); }}
            />
          )}
          {subTab === 'requests' && (
            <RequestsList
              followRequests={followRequests}
              contactRequests={contactRequests}
              onAcceptFollow={handleAcceptFollow}
              onDeclineFollow={handleDeclineFollow}
              onAcceptContact={handleAcceptContact}
              onDeclineContact={handleDeclineContact}
            />
          )}
          {subTab === 'blocked' && (
            <BlockedList
              blockedIds={Array.from(blockedIds)}
              onUnblock={handleUnblock}
            />
          )}
          {subTab === 'discover' && (
            <DiscoverPanel
              accountId={accountId}
              followingIds={followingIds}
              blockedIds={blockedIds}
              followPending={followPending}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
            />
          )}
          {subTab === 'privacy' && (
            <PrivacySettingsCard privacy={privacy} onUpdate={setPrivacy} />
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-tab button ──

function SubTabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 whitespace-nowrap border-b-2 px-2.5 py-2 text-[9px] font-bold tracking-wider uppercase transition-colors lg:px-3"
      style={{ borderColor: active ? GOLD : 'transparent', color: active ? GOLD_SOFT : 'rgba(255,255,255,0.35)' }}
    >
      {label}
      {count != null && count > 0 && (
        <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: GOLD + '20', color: GOLD_SOFT }}>{count}</span>
      )}
    </button>
  );
}

// ── User list (following / followers) ──

function UserList({ userIds, followingIds, blockedIds, followPending, onFollow, onUnfollow, onBlock, onRequestContact, emptyMessage = 'No users found.' }: {
  userIds: string[];
  followingIds: Set<string>;
  blockedIds: Set<string>;
  followPending: Set<string>;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  onBlock: (id: string) => void;
  onRequestContact: (id: string) => void;
  emptyMessage?: string;
}) {
  const [profiles, setProfiles] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<FollowUser | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const profs = await Promise.all(userIds.map(id => fetchProfile(id)));
      const valid = profs.filter((p): p is NonNullable<typeof p> => p !== null).map(p => ({
        user_id: p.account_id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url || null,
        poker_role: p.poker_role || null,
        bio: p.bio || null,
        home_city_slug: p.home_city_slug,
      }));
      setProfiles(valid);
      setLoading(false);
    })();
  }, [userIds.join(',')]);

  const filtered = search.trim()
    ? profiles.filter(u => {
        const q = search.toLowerCase();
        return u.display_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.poker_role?.toLowerCase().includes(q);
      })
    : profiles;

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/20" strokeWidth={1.5} /></div>;
  }

  if (profiles.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search…" />
      <div className="mt-3 space-y-1.5">
        {filtered.map(user => (
          <UserRow
            key={user.user_id}
            user={user}
            isFollowing={followingIds.has(user.user_id)}
            isBlocked={blockedIds.has(user.user_id)}
            followPending={followPending.has(user.user_id)}
            onFollow={() => onFollow(user.user_id)}
            onUnfollow={() => onUnfollow(user.user_id)}
            onBlock={() => onBlock(user.user_id)}
            onRequestContact={() => onRequestContact(user.user_id)}
            onClick={() => setSelectedUser(user)}
          />
        ))}
      </div>
      {selectedUser && (
        <UserPreviewModal
          user={selectedUser}
          isFollowing={followingIds.has(selectedUser.user_id)}
          followPending={followPending.has(selectedUser.user_id)}
          onFollow={() => onFollow(selectedUser.user_id)}
          onUnfollow={() => onUnfollow(selectedUser.user_id)}
          onBlock={() => { onBlock(selectedUser.user_id); setSelectedUser(null); }}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

// ── Contact list ──

function ContactList({ contacts, onRemove, onMessage }: {
  contacts: Contact[];
  onRemove: (relId: string) => void;
  onMessage: (userId: string) => void;
}) {
  const [profiles, setProfiles] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const profs = await Promise.all(contacts.map(c => fetchProfile(c.user_id)));
      const valid = profs.filter((p): p is NonNullable<typeof p> => p !== null).map(p => ({
        user_id: p.account_id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url || null,
        poker_role: p.poker_role || null,
        bio: p.bio || null,
        home_city_slug: p.home_city_slug,
      }));
      setProfiles(valid);
      setLoading(false);
    })();
  }, [contacts.map(c => c.relationship_id).join(',')]);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/20" strokeWidth={1.5} /></div>;
  if (profiles.length === 0) return <EmptyState message="No contacts yet. Request contact from people you want to message directly." />;

  return (
    <div className="space-y-1.5">
      {profiles.map(user => {
        const contact = contacts.find(c => c.user_id === user.user_id);
        return (
          <div key={user.user_id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
            <Avatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/90">{user.display_name}</p>
              {user.username && <p className="truncate text-[10px] text-white/35">@{user.username}</p>}
            </div>
            <button
              onClick={() => onMessage(user.user_id)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase text-white/50 transition-colors hover:text-white"
            >
              <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> Message
            </button>
            {contact && (
              <button
                onClick={() => onRemove(contact.relationship_id)}
                className="shrink-0 text-white/20 transition-colors hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Requests list ──

function RequestsList({ followRequests, contactRequests, onAcceptFollow, onDeclineFollow, onAcceptContact, onDeclineContact }: {
  followRequests: Array<{ requester_id: string; created_at: string }>;
  contactRequests: Array<{ relationship_id: string; requester_id: string; created_at: string }>;
  onAcceptFollow: (id: string) => void;
  onDeclineFollow: (id: string) => void;
  onAcceptContact: (relId: string) => void;
  onDeclineContact: (relId: string) => void;
}) {
  const [profiles, setProfiles] = useState<Record<string, FollowUser>>({});

  useEffect(() => {
    const allIds = [...new Set([...followRequests.map(r => r.requester_id), ...contactRequests.map(r => r.requester_id)])];
    (async () => {
      const profs = await Promise.all(allIds.map(id => fetchProfile(id)));
      const map: Record<string, FollowUser> = {};
      profs.forEach((p, i) => {
        if (p) {
          map[allIds[i]] = {
            user_id: p.account_id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url || null,
            poker_role: p.poker_role || null,
            bio: p.bio || null,
            home_city_slug: p.home_city_slug,
          };
        }
      });
      setProfiles(map);
    })();
  }, [followRequests.map(r => r.requester_id).join(','), contactRequests.map(r => r.requester_id).join(',')]);

  if (followRequests.length === 0 && contactRequests.length === 0) {
    return <EmptyState message="No pending requests." />;
  }

  return (
    <div className="space-y-2">
      {followRequests.map(req => {
        const user = profiles[req.requester_id];
        return (
          <div key={req.requester_id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
            <Avatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/90">{user?.display_name ?? 'Unknown'}</p>
              <p className="text-[9px] text-white/30">Follow request</p>
            </div>
            <button onClick={() => onAcceptFollow(req.requester_id)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase" style={{ borderColor: GOLD + '40', background: GOLD + '12', color: GOLD_SOFT }}>
              <UserCheck className="h-3 w-3" strokeWidth={1.5} /> Accept
            </button>
            <button onClick={() => onDeclineFollow(req.requester_id)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase text-white/40 hover:text-white">
              Decline
            </button>
          </div>
        );
      })}
      {contactRequests.map(req => {
        const user = profiles[req.requester_id];
        return (
          <div key={req.relationship_id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
            <Avatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/90">{user?.display_name ?? 'Unknown'}</p>
              <p className="text-[9px] text-white/30">Contact request</p>
            </div>
            <button onClick={() => onAcceptContact(req.relationship_id)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase" style={{ borderColor: GOLD + '40', background: GOLD + '12', color: GOLD_SOFT }}>
              <UserCheck className="h-3 w-3" strokeWidth={1.5} /> Accept
            </button>
            <button onClick={() => onDeclineContact(req.relationship_id)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase text-white/40 hover:text-white">
              Decline
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Blocked list ──

function BlockedList({ blockedIds, onUnblock }: {
  blockedIds: string[];
  onUnblock: (id: string) => void;
}) {
  const [profiles, setProfiles] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const profs = await Promise.all(blockedIds.map(id => fetchProfile(id)));
      const valid = profs.filter((p): p is NonNullable<typeof p> => p !== null).map(p => ({
        user_id: p.account_id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url || null,
        poker_role: p.poker_role || null,
        bio: p.bio || null,
        home_city_slug: p.home_city_slug,
      }));
      setProfiles(valid);
      setLoading(false);
    })();
  }, [blockedIds.join(',')]);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/20" strokeWidth={1.5} /></div>;
  if (profiles.length === 0) return <EmptyState message="No blocked users." />;

  return (
    <div className="space-y-1.5">
      {profiles.map(user => (
        <div key={user.user_id} className="flex items-center gap-3 rounded-lg border border-red-500/10 bg-red-500/[0.02] p-2.5">
          <Avatar user={user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white/70">{user.display_name}</p>
            {user.username && <p className="truncate text-[10px] text-white/30">@{user.username}</p>}
          </div>
          <button
            onClick={() => onUnblock(user.user_id)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase text-white/50 transition-colors hover:text-white"
          >
            <ShieldAlert className="h-3 w-3" strokeWidth={1.5} /> Unblock
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Discover panel (Home City / Current City) ──

function DiscoverPanel({ accountId, followingIds, blockedIds, followPending, onFollow, onUnfollow }: {
  accountId: string;
  followingIds: Set<string>;
  blockedIds: Set<string>;
  followPending: Set<string>;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
}) {
  const [mode, setMode] = useState<CityMode>('home');
  const [suggestions, setSuggestions] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [cityLabel, setCityLabel] = useState('');
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [homeCitySlug, setHomeCitySlug] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const profile = await fetchProfile(accountId);
      setHomeCitySlug(profile?.home_city_slug ?? null);
    })();
  }, [accountId]);

  const loadSuggestions = useCallback(async (slug: string) => {
    setLoading(true);
    const users = await getUsersByHomeCity(slug);
    const filtered = users.filter(u => u.user_id !== accountId && !followingIds.has(u.user_id) && !blockedIds.has(u.user_id));
    setSuggestions(filtered);
    setLoading(false);
  }, [accountId, followingIds, blockedIds]);

  useEffect(() => {
    if (mode === 'home' && homeCitySlug) {
      setCitySlug(homeCitySlug);
      (async () => {
        const cities = await fetchAllCities();
        const city = cities.find(c => c.slug === homeCitySlug);
        setCityLabel(city ? formatCityShort(city) : homeCitySlug.replace(/-/g, ' '));
        loadSuggestions(homeCitySlug);
      })();
    } else if (mode === 'home' && !homeCitySlug) {
      setCitySlug(null);
      setSuggestions([]);
      setCityLabel('');
    }
  }, [mode, homeCitySlug, loadSuggestions]);

  const detectCurrentCity = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const city = await resolveCoordinates(pos.coords.latitude, pos.coords.longitude);
        if (city) {
          setCitySlug(city.slug);
          setCityLabel(formatCityShort(city));
          loadSuggestions(city.slug);
        } else {
          setLocationError('Could not identify a nearby city from your location.');
        }
        setLocating(false);
      },
      (err) => {
        setLocationError(err.code === err.PERMISSION_DENIED ? 'Location permission denied.' : 'Could not determine your location.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, [loadSuggestions]);

  useEffect(() => {
    if (mode === 'current' && !citySlug && !locating && !locationError) {
      detectCurrentCity();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* City mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
        <button
          onClick={() => setMode('home')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-[10px] font-bold tracking-wider uppercase transition-all"
          style={{ background: mode === 'home' ? 'rgba(212,165,44,0.15)' : 'transparent', color: mode === 'home' ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}
        >
          <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> Home City
        </button>
        <button
          onClick={() => setMode('current')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-[10px] font-bold tracking-wider uppercase transition-all"
          style={{ background: mode === 'current' ? 'rgba(212,165,44,0.15)' : 'transparent', color: mode === 'current' ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}
        >
          <Navigation className="h-3.5 w-3.5" strokeWidth={1.5} /> Current City
        </button>
      </div>

      {/* City label */}
      <div className="mt-3">
        {cityLabel ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-white/30" strokeWidth={1.5} />
            <span className="text-[12px] font-semibold text-white/60">{cityLabel}</span>
          </div>
        ) : mode === 'home' && !homeCitySlug ? (
          <p className="text-[11px] leading-relaxed text-white/35">Set your Home City in your profile to discover local players.</p>
        ) : null}
      </div>

      {/* Current city: locating */}
      {mode === 'current' && locating && (
        <div className="mt-3 flex items-center gap-2 text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[11px]">Finding your city...</span>
        </div>
      )}

      {/* Current city: error */}
      {mode === 'current' && locationError && (
        <div className="mt-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-300/70">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            {locationError}
          </div>
          <button
            onClick={detectCurrentCity}
            className="mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-wider uppercase transition-all hover:scale-105"
            style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}
          >
            <Navigation className="h-3 w-3" strokeWidth={1.5} /> Use My Location
          </button>
          <p className="mt-2 max-w-[280px] text-[9px] leading-relaxed text-white/25">
            Your precise location is not displayed or stored. Location is used only to identify your current city.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && !locating && (
        <div className="mt-4 flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      )}

      {/* Suggestions */}
      {!loading && !locating && suggestions.length === 0 && cityLabel && (
        <div className="mt-4">
          <EmptyState message={`No new SpotVault players found in ${cityLabel}.`} />
        </div>
      )}

      {!loading && !locating && suggestions.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {suggestions.map(user => (
            <UserRow
              key={user.user_id}
              user={user}
              isFollowing={followingIds.has(user.user_id)}
              isBlocked={false}
              followPending={followPending.has(user.user_id)}
              onFollow={() => onFollow(user.user_id)}
              onUnfollow={() => onUnfollow(user.user_id)}
              onBlock={() => {}}
              onRequestContact={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Privacy settings card ──

function PrivacySettingsCard({ privacy, onUpdate }: { privacy: PrivacySettings; onUpdate: (p: PrivacySettings) => void }) {
  const [local, setLocal] = useState(privacy);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(privacy); }, [privacy]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updatePrivacySettings(local);
    if (ok) onUpdate(local);
    setSaving(false);
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="mb-3 flex items-center gap-1.5">
        <Shield className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <h3 className="text-[11px] font-bold tracking-widest text-white/40 uppercase">Privacy Settings</h3>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Who Can Follow You</label>
          <select
            value={local.who_can_follow}
            onChange={(e) => setLocal({ ...local, who_can_follow: e.target.value as PrivacySettings['who_can_follow'] })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a52c]/40"
          >
            <option value="everyone">Everyone</option>
            <option value="approval_required">Approval Required</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Who Can Message You</label>
          <select
            value={local.who_can_message}
            onChange={(e) => setLocal({ ...local, who_can_message: e.target.value as PrivacySettings['who_can_message'] })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a52c]/40"
          >
            <option value="contacts_only">Contacts Only</option>
            <option value="people_i_follow">People I Follow</option>
            <option value="everyone">Everyone</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="share-city"
            checked={local.share_current_city}
            onChange={(e) => setLocal({ ...local, share_current_city: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-white/5"
          />
          <label htmlFor="share-city" className="text-[11px] text-white/50">Share my current city for nearby discovery</label>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-50"
          style={{ borderColor: GOLD + '40', background: GOLD + '12', color: GOLD_SOFT }}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />}
          Save Privacy
        </button>
      </div>
    </div>
  );
}

// ── Shared components ──

function Avatar({ user, size = 'sm' }: { user?: FollowUser; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-14 w-14' : 'h-9 w-9';
  const text = size === 'md' ? 'text-xl' : 'text-sm';
  if (!user) return <div className={`${dim} shrink-0 rounded-full border border-white/10 bg-white/5`} />;
  return (
    <div className={`${dim} shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10 ${text} font-bold text-[#f5e6b0]`}>
      {user.avatar_url ? <AvatarImg src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" style={{ objectPosition: user.avatar_url === '/assets/profiles/image copy 6.png' ? 'center 30%' : undefined }} fallback={user.display_name?.charAt(0).toUpperCase()} /> : user.display_name?.charAt(0).toUpperCase()}
    </div>
  );
}

function UserRow({ user, isFollowing, isBlocked, followPending, onFollow, onUnfollow, onBlock, onRequestContact, onClick }: {
  user: FollowUser;
  isFollowing: boolean;
  isBlocked: boolean;
  followPending: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onBlock: () => void;
  onRequestContact: () => void;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.04]">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar user={user} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/90">{user.display_name}</p>
          {user.username && <p className="truncate text-[10px] text-white/35">@{user.username}</p>}
          {user.poker_role && <p className="truncate text-[9px] text-[#c0911e]/50">{user.poker_role}</p>}
        </div>
      </button>
      {!isBlocked && (
        <button
          onClick={(e) => { e.stopPropagation(); isFollowing ? onUnfollow() : onFollow(); }}
          disabled={followPending}
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold tracking-wide uppercase transition-colors disabled:opacity-50"
          style={isFollowing
            ? { borderColor: 'rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.4)' }
            : { borderColor: GOLD + '40', background: GOLD + '12', color: GOLD_SOFT }}
        >
          {followPending ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            : isFollowing ? <UserCheck className="h-3 w-3" strokeWidth={1.5} />
            : <UserPlus className="h-3 w-3" strokeWidth={1.5} />}
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

function UserPreviewModal({ user, isFollowing, followPending, onFollow, onUnfollow, onBlock, onClose }: {
  user: FollowUser;
  isFollowing: boolean;
  followPending: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onBlock: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-[#0a0c0e] p-5 shadow-2xl" style={{ borderColor: BORDER }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar user={user} size="md" />
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
              : { borderColor: GOLD, background: GOLD + '15', color: GOLD_SOFT }}
          >
            {followPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              : isFollowing ? <UserCheck className="h-3.5 w-3.5" strokeWidth={1.5} /> : <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {isFollowing ? 'Following' : 'Follow'}
          </button>
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

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <Search className="h-4 w-4 text-white/30" strokeWidth={1.5} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-white/30 hover:text-white">
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Users className="h-6 w-6 text-white/15" strokeWidth={1.5} />
      <p className="mt-2 text-[12px] text-white/35">{message}</p>
    </div>
  );
}

// ── Notifications panel ──

function NotificationsPanel({ accountId }: { accountId: string }) {
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; body: string; created_at: string; read: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sysMsgs, fReqs, cReqs] = await Promise.all([
        fetchSystemMessages(accountId),
        getPendingFollowRequests(),
        getPendingContactRequests(),
      ]);
      if (cancelled) return;
      const items: Array<{ id: string; type: string; title: string; body: string; created_at: string; read: boolean }> = [
        ...sysMsgs.map((m) => ({
          id: m.id,
          type: 'system',
          title: m.subject,
          body: m.body.slice(0, 120),
          created_at: m.created_at,
          read: m.read,
        })),
        ...fReqs.map((r) => ({
          id: `follow-${r.requester_id}`,
          type: 'follow_request',
          title: 'New follow request',
          body: 'Someone wants to follow you',
          created_at: r.created_at,
          read: false,
        })),
        ...cReqs.map((r) => ({
          id: `contact-${r.relationship_id}`,
          type: 'contact_request',
          title: 'New contact request',
          body: 'Someone wants to connect',
          created_at: r.created_at,
          read: false,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(items);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/20" strokeWidth={1.5} /></div>;
  }
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="h-8 w-8 text-white/15" strokeWidth={1.5} />
        <p className="mt-3 text-[12px] text-white/35">No notifications yet</p>
        <p className="mt-1 text-[10px] text-white/20">Follow requests, contact requests, and platform messages will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
          style={{ borderColor: n.read ? 'rgba(255,255,255,0.04)' : 'rgba(212,165,44,0.12)' }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: n.read ? 'rgba(255,255,255,0.03)' : 'rgba(192,145,30,0.1)' }}>
            <Bell className="h-3.5 w-3.5" style={{ color: n.read ? 'rgba(255,255,255,0.25)' : GOLD }} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white/90">{n.title}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/40">{n.body}</p>
            <p className="mt-1 text-[9px] text-white/20">{new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GOLD }} />}
        </div>
      ))}
    </div>
  );
}
