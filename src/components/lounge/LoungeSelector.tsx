import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronDown, KeyRound, Search, Check, Loader2, Plus, X,
  Lock, ShieldCheck, Unlock, Star, Clock, Users, Hash,
} from 'lucide-react';
import {
  fetchUserLoungeMemberships, fetchAllLounges, redeemLoungeCode,
  joinLounge, setDefaultLounge, submitJoinRequest, fetchUserJoinRequests,
  verifyLoungePassword,
  type LoungeMembership, type LoungeInfo, type JoinRequest,
} from '@/lib/loungeMembershipStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  userId: string;
  selectedSlug?: string | null;
  onSelectLounge: (slug: string) => void;
  align?: 'left' | 'center' | 'right';
}

type AccessMode = 'open' | 'approval' | 'password' | 'password_approval';

function accessIcon(mode?: string) {
  switch (mode) {
    case 'open': return <Unlock className="h-3 w-3 text-emerald-400/70" strokeWidth={1.5} />;
    case 'approval': return <Clock className="h-3 w-3 text-amber-400/70" strokeWidth={1.5} />;
    case 'password': return <Lock className="h-3 w-3 text-rose-400/70" strokeWidth={1.5} />;
    case 'password_approval': return <Lock className="h-3 w-3 text-rose-400/70" strokeWidth={1.5} />;
    default: return <Unlock className="h-3 w-3 text-white/30" strokeWidth={1.5} />;
  }
}

function accessLabel(mode?: string): string {
  switch (mode) {
    case 'open': return 'OPEN';
    case 'approval': return 'APPROVAL REQUIRED';
    case 'password': return 'PRIVATE';
    case 'password_approval': return 'RESTRICTED';
    default: return 'OPEN';
  }
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function LoungeSelector({ userId, selectedSlug, onSelectLounge, align = 'center' }: Props) {
  const [open, setOpen] = useState(false);
  const [memberships, setMemberships] = useState<LoungeMembership[]>([]);
  const [allLounges, setAllLounges] = useState<LoungeInfo[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<LoungeInfo | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordVerifying, setPasswordVerifying] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mems, lounges, reqs] = await Promise.all([
      fetchUserLoungeMemberships(userId),
      fetchAllLounges(),
      fetchUserJoinRequests(userId),
    ]);
    setMemberships(mems);
    setAllLounges(lounges);
    setJoinRequests(reqs);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!open || !userId) return;
    void loadData();
  }, [open, userId, loadData]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearchQuery('');
        setCodeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) {
      const timer = setTimeout(() => searchRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const loungeName = useCallback((slug: string) => allLounges.find((l) => l.slug === slug)?.name ?? slug, [allLounges]);

  const joinedSlugs = new Set(memberships.map((m) => m.lounge_slug));
  const pendingSlugs = new Set(joinRequests.filter((r) => r.status === 'pending').map((r) => r.lounge_slug));

  const availableLounges = allLounges.filter((l) => !joinedSlugs.has(l.slug));
  const filteredAvailable = searchQuery.trim()
    ? availableLounges.filter((l) => {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q) ||
          (l.region?.toLowerCase().includes(q) ?? false) ||
          (l.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
        );
      })
    : availableLounges.slice(0, 8);

  const filteredMyLounges = searchQuery.trim()
    ? memberships.filter((m) => loungeName(m.lounge_slug).toLowerCase().includes(searchQuery.toLowerCase()))
    : memberships;

  const currentLoungeName = selectedSlug ? loungeName(selectedSlug) : (memberships[0] ? loungeName(memberships[0].lounge_slug) : 'Lounge');

  async function handleJoin(lounge: LoungeInfo) {
    if (!userId) return;
    const mode = lounge.access_mode ?? 'open';

    if (mode === 'open') {
      setActionLoading(lounge.slug);
      const result = await joinLounge(lounge.slug, userId);
      setActionLoading(null);
      if (result.success) {
        await loadData();
        onSelectLounge(lounge.slug);
        setOpen(false);
      }
    } else if (mode === 'password' || mode === 'password_approval') {
      setPasswordModal(lounge);
      setPasswordValue('');
      setPasswordError('');
    } else if (mode === 'approval') {
      setActionLoading(lounge.slug);
      const result = await submitJoinRequest(lounge.slug, userId);
      setActionLoading(null);
      if (result.success) {
        await loadData();
      }
    }
  }

  async function handlePasswordSubmit() {
    if (!passwordModal || !passwordValue.trim()) return;
    setPasswordVerifying(true);
    setPasswordError('');
    const result = await verifyLoungePassword(passwordModal.slug, passwordValue.trim());
    setPasswordVerifying(false);

    if (!result.valid) {
      setPasswordError(result.error ?? 'Incorrect password.');
      return;
    }

    const mode = passwordModal.access_mode;
    if (mode === 'password') {
      // Password only — join directly
      setActionLoading(passwordModal.slug);
      const joinResult = await joinLounge(passwordModal.slug, userId);
      setActionLoading(null);
      if (joinResult.success) {
        setPasswordModal(null);
        await loadData();
        onSelectLounge(passwordModal.slug);
        setOpen(false);
      }
    } else if (mode === 'password_approval') {
      // Password verified, now submit request
      setActionLoading(passwordModal.slug);
      const reqResult = await submitJoinRequest(passwordModal.slug, userId, true);
      setActionLoading(null);
      if (reqResult.success) {
        setPasswordModal(null);
        await loadData();
      }
    }
  }

  async function handleRedeem() {
    if (!codeValue.trim() || !userId) return;
    setCodeSubmitting(true);
    setCodeError('');
    setCodeSuccess('');
    const result = await redeemLoungeCode(codeValue.trim(), userId);
    setCodeSubmitting(false);
    if (!result.success) {
      setCodeError(result.error ?? 'Failed to redeem code');
      return;
    }
    const msg = result.already_member ? `You already belong to ${result.lounge_name}` : `Joined ${result.lounge_name}`;
    setCodeSuccess(msg);
    void loadData();
    setTimeout(() => {
      setCodeOpen(false);
      setCodeValue('');
      setCodeSuccess('');
      if (result.lounge_slug) onSelectLounge(result.lounge_slug);
    }, 1500);
  }

  async function handleSetDefault(slug: string) {
    if (!userId) return;
    setActionLoading(`default-${slug}`);
    const ok = await setDefaultLounge(userId, slug);
    setActionLoading(null);
    if (ok) {
      await loadData();
    }
  }

  function handleSelectLounge(slug: string) {
    onSelectLounge(slug);
    setOpen(false);
    setSearchQuery('');
  }

  const showResults = searchQuery.trim().length > 0;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button — compact charcoal, matches header chrome */}
      <button
        onClick={() => setOpen(!open)}
        className="hdr-gold-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all"
        style={{
          borderColor: open ? 'rgba(212,165,44,0.7)' : undefined,
          background: open ? 'rgba(20,16,8,0.85)' : undefined,
          boxShadow: open ? '0 0 10px rgba(212,165,44,0.28), 0 0 22px rgba(212,165,44,0.12)' : undefined,
          minWidth: 'auto',
        }}
      >
        <Search className="hdr-gold-icon h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        <span className="hdr-gold-text truncate text-[10px] font-bold tracking-widest uppercase">
          {currentLoungeName}
        </span>
        <ChevronDown className={`hdr-gold-icon ml-0.5 h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className={`absolute z-[600] mt-1.5 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border shadow-2xl ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.97)', backdropFilter: 'blur(16px)' }}
        >
          {/* Search bar */}
          <div className="border-b border-white/[0.06] p-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search Lounges..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white/60">
                  <X className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-white/30" />
              </div>
            )}

            {!loading && !showResults && (
              <>
                {/* MY LOUNGES */}
                {filteredMyLounges.length > 0 && (
                  <div className="py-1">
                    <div className="px-3 py-1.5">
                      <span className="text-[8px] font-bold tracking-[0.2em] text-white/40 uppercase">My Lounges</span>
                    </div>
                    {filteredMyLounges.map((m) => {
                      const lounge = allLounges.find((l) => l.slug === m.lounge_slug);
                      const isDefault = m.is_default;
                      const isSelected = selectedSlug === m.lounge_slug;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleSelectLounge(m.lounge_slug)}
                          className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                          style={{ background: isSelected ? 'rgba(212,165,44,0.06)' : undefined }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[9px] font-bold text-white/50">
                            {lounge?.name?.charAt(0).toUpperCase() ?? '?'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[11px] font-semibold text-white/85">{loungeName(m.lounge_slug)}</span>
                              {isDefault && <Star className="h-2.5 w-2.5 shrink-0 fill-current" style={{ color: GOLD }} />}
                              {m.role && m.role !== 'member' && (
                                <span
                                  className="shrink-0 rounded px-1 py-0 text-[7px] font-bold tracking-wider uppercase"
                                  style={{ background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}
                                >
                                  {m.role === 'owner' ? 'OWNER' : m.role === 'admin' ? 'ADMIN' : 'MOD'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[8px] text-white/30">
                              {lounge?.member_count != null && (
                                <span className="flex items-center gap-0.5">
                                  <Users className="h-2 w-2" strokeWidth={1.5} />
                                  {formatCount(lounge.member_count)}
                                </span>
                              )}
                              {lounge?.region && <span>· {lounge.region}</span>}
                            </div>
                          </div>
                          {!isDefault ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleSetDefault(m.lounge_slug); }}
                              disabled={actionLoading === `default-${m.lounge_slug}`}
                              className="shrink-0 rounded-md border border-white/[0.08] px-2 py-0.5 text-[7px] font-bold tracking-widest uppercase text-white/30 opacity-0 transition-all hover:text-white/60 group-hover:opacity-100"
                              title="Set as default lounge"
                            >
                              {actionLoading === `default-${m.lounge_slug}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Set Default'}
                            </button>
                          ) : (
                            <span className="shrink-0 rounded-md border px-2 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(212,165,44,0.06)' }}>
                              DEFAULT
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* No memberships */}
                {filteredMyLounges.length === 0 && (
                  <div className="px-3 py-3 text-center">
                    <p className="text-[10px] text-white/40">You haven't joined any Lounges yet.</p>
                  </div>
                )}

                {/* DISCOVER section */}
                <div className="border-t border-white/[0.04] py-1">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[8px] font-bold tracking-[0.2em] text-white/40 uppercase">Discover</span>
                    <button
                      onClick={() => { setCodeOpen(true); }}
                      className="flex items-center gap-1 text-[8px] font-bold tracking-widest uppercase text-white/30 transition-colors hover:text-[#d4a52c]"
                    >
                      <KeyRound className="h-2.5 w-2.5" strokeWidth={1.5} /> Code
                    </button>
                  </div>
                  {availableLounges.length === 0 ? (
                    <p className="px-3 py-2 text-[10px] text-white/30">No more Lounges to discover.</p>
                  ) : (
                    availableLounges.slice(0, 5).map((lounge) => (
                      <DiscoverRow
                        key={lounge.slug}
                        lounge={lounge}
                        isPending={pendingSlugs.has(lounge.slug)}
                        onJoin={() => void handleJoin(lounge)}
                        loading={actionLoading === lounge.slug}
                      />
                    ))
                  )}
                </div>
              </>
            )}

            {/* Search results */}
            {!loading && showResults && (
              <>
                {filteredAvailable.length === 0 && filteredMyLounges.length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-[10px] text-white/30">No Lounges found for "{searchQuery}"</p>
                  </div>
                )}

                {filteredMyLounges.length > 0 && (
                  <div className="py-1">
                    <div className="px-3 py-1.5">
                      <span className="text-[8px] font-bold tracking-[0.2em] text-white/40 uppercase">My Lounges</span>
                    </div>
                    {filteredMyLounges.map((m) => {
                      const lounge = allLounges.find((l) => l.slug === m.lounge_slug);
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleSelectLounge(m.lounge_slug)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[9px] font-bold text-white/50">
                            {lounge?.name?.charAt(0).toUpperCase() ?? '?'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-[11px] font-semibold text-white/85">{loungeName(m.lounge_slug)}</span>
                            <div className="text-[8px] text-white/30">{lounge?.region ?? lounge?.type}</div>
                          </div>
                          <Check className="h-3 w-3 shrink-0 text-emerald-400/60" strokeWidth={2} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredAvailable.length > 0 && (
                  <div className="border-t border-white/[0.04] py-1">
                    <div className="px-3 py-1.5">
                      <span className="text-[8px] font-bold tracking-[0.2em] text-white/40 uppercase">Discover</span>
                    </div>
                    {filteredAvailable.map((lounge) => (
                      <DiscoverRow
                        key={lounge.slug}
                        lounge={lounge}
                        isPending={pendingSlugs.has(lounge.slug)}
                        onJoin={() => void handleJoin(lounge)}
                        loading={actionLoading === lounge.slug}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Code entry */}
          {codeOpen && (
            <div className="border-t border-white/[0.06] px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Enter Lounge Code</span>
                <button onClick={() => { setCodeOpen(false); setCodeError(''); setCodeValue(''); setCodeSuccess(''); }} className="text-white/30 hover:text-white/60">
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <input
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleRedeem(); }}
                placeholder="Enter code..."
                autoFocus
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] font-mono text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30"
              />
              {codeError && <p className="mt-2 text-[10px] text-red-400">{codeError}</p>}
              {codeSuccess && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <Check className="h-3 w-3" strokeWidth={2} /> {codeSuccess}
                </div>
              )}
              <button
                onClick={() => void handleRedeem()}
                disabled={codeSubmitting || !codeValue.trim()}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
                style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.12)' }}
              >
                {codeSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Join Lounge'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Password modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/70 p-4" onClick={() => setPasswordModal(null)}>
          <div className="w-full max-w-sm rounded-xl border p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.96)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <h3 className="text-[12px] font-bold text-white">{passwordModal.name}</h3>
            </div>
            <p className="mb-3 text-[10px] text-white/40">
              {passwordModal.access_mode === 'password_approval'
                ? 'This Lounge requires a password and moderator approval.'
                : 'This Lounge requires a password to join.'}
            </p>
            <input
              type="password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handlePasswordSubmit(); }}
              placeholder="Enter Lounge password..."
              autoFocus
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30"
            />
            {passwordError && <p className="mt-2 text-[10px] text-red-400">{passwordError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setPasswordModal(null)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase transition-colors hover:text-white/80"
              >
                Cancel
              </button>
              <button
                onClick={() => void handlePasswordSubmit()}
                disabled={passwordVerifying || !passwordValue.trim()}
                className="flex-1 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
                style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.12)' }}
              >
                {passwordVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify & Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DISCOVER ROW
// ============================================================
function DiscoverRow({ lounge, isPending, onJoin, loading }: {
  lounge: LoungeInfo;
  isPending: boolean;
  onJoin: () => void;
  loading: boolean;
}) {
  const mode = lounge.access_mode ?? 'open';
  return (
    <div className="group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.04]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[9px] font-bold text-white/50">
        {lounge.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-white/80">{lounge.name}</span>
          {accessIcon(mode)}
        </div>
        <div className="flex items-center gap-1.5 text-[8px] text-white/30">
          {lounge.region && <span>{lounge.region}</span>}
          {lounge.member_count != null && (
            <span className="flex items-center gap-0.5">
              {lounge.region && <span>·</span>}
              <Users className="h-2 w-2" strokeWidth={1.5} />
              {formatCount(lounge.member_count)}
            </span>
          )}
          <span className="ml-auto rounded px-1 py-0 text-[7px] font-bold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {accessLabel(mode)}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        {isPending ? (
          <span className="flex items-center gap-1 rounded-md border border-amber-400/20 px-2 py-1 text-[7px] font-bold tracking-widest uppercase text-amber-400/60">
            <Clock className="h-2.5 w-2.5" strokeWidth={1.5} /> Pending
          </span>
        ) : (
          <button
            onClick={onJoin}
            disabled={loading}
            className="rounded-md border px-2.5 py-1 text-[8px] font-bold tracking-widest uppercase transition disabled:opacity-40"
            style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : mode === 'open' ? 'Join' : mode === 'approval' ? 'Request' : 'Enter'}
          </button>
        )}
      </div>
    </div>
  );
}
