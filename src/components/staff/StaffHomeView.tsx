import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Users, Activity, Calculator, ShoppingBag, Crown,
  CalendarCheck, BarChart3, Image as ImageIcon, Video,
  RefreshCw, AlertCircle, Zap,
  Shield, RefreshCw as RefreshIcon,
  ChevronDown, MoreHorizontal, Lock, Wallet, Newspaper,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';
import { AccountTrafficSection, AssetManagerSection, UserAccessSection } from '@/components/staff/StaffSections';
import { MediaManagerSection } from '@/components/staff/MediaManagerSection';
import { LiveTransactionHUD, type TransactionHUDHandle } from '@/components/staff/LiveTransactionHUD';
import { AccessUsageHUD } from '@/components/staff/AccessUsageHUD';
import { MainFeedSection } from '@/components/staff/MainFeedSection';
import { StaffManagementSection } from '@/components/staff/StaffManagementSection';

// ── Tab definitions ──

type PrimaryTab = 'users' | 'transactions' | 'access' | 'main_feed' | 'staff';
type SecondaryTab = 'solver' | 'spot_library' | 'booking' | 'portal_signup' | 'all' | 'traffic' | 'assets' | 'media';
type ActiveTab = PrimaryTab | SecondaryTab;

const PRIMARY_TABS: { id: PrimaryTab; label: string; icon: LucideIcon; disabled?: boolean }[] = [
  { id: 'users', label: 'Users / Login', icon: Users },
  { id: 'transactions', label: 'Transactions', icon: Wallet },
  { id: 'access', label: 'Access & Gating', icon: Lock },
  { id: 'main_feed', label: 'Info', icon: Newspaper },
  { id: 'staff', label: 'Staff', icon: Shield },
];

const SECONDARY_TABS: { id: SecondaryTab; label: string; icon: LucideIcon }[] = [
  { id: 'solver', label: 'Solver', icon: Calculator },
  { id: 'spot_library', label: 'Spot Library', icon: ShoppingBag },
  { id: 'booking', label: 'Bookings', icon: CalendarCheck },
  { id: 'portal_signup', label: 'Portals', icon: Crown },
  { id: 'all', label: 'Activity', icon: Activity },
  { id: 'traffic', label: 'Website Traffic', icon: BarChart3 },
  { id: 'assets', label: 'Asset Manager', icon: ImageIcon },
  { id: 'media', label: 'Media Manager', icon: Video },
];

// ── Staff Home View ──

export function StaffHomeView({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [moreOpen, setMoreOpen] = useState(false);
  const txnHudRef = useRef<TransactionHUDHandle>(null);
  const [refreshAllLoading, setRefreshAllLoading] = useState(false);
  const [refreshAllTime, setRefreshAllTime] = useState<Date | null>(null);

  const handleRefreshAll = useCallback(() => {
    setRefreshAllLoading(true);
    txnHudRef.current?.refresh();
    setTimeout(() => {
      setRefreshAllLoading(false);
      setRefreshAllTime(new Date());
    }, 1000);
  }, []);

  const isPrimary = (id: ActiveTab): id is PrimaryTab =>
    PRIMARY_TABS.some(t => t.id === id);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3 lg:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#c0911e]/25 bg-[#0a0c0e]/95 shadow-2xl">
        {/* Primary tab bar — large, prominent, opaque */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#c0911e]/15 bg-[#0a0c0e] p-2 sm:p-3">
          <div className="flex items-center gap-1.5 overflow-x-auto sm:gap-2">
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { if (!tab.disabled) setActiveTab(tab.id); }}
                  disabled={tab.disabled}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                    active
                      ? 'border-[#d4a52c]/50 bg-[#d4a52c]/15 text-[#f5e6b0]'
                      : tab.disabled
                        ? 'border-white/5 text-white/20 cursor-not-allowed'
                        : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white/80'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  {tab.disabled && (
                    <span className="ml-1 hidden rounded bg-white/5 px-1 text-[7px] font-bold text-white/30 uppercase lg:inline">Soon</span>
                  )}
                </button>
              );
            })}

            {/* More / All Tools dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen(o => !o)}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                  !isPrimary(activeTab)
                    ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white/80'
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">More / All Tools</span>
                <span className="sm:hidden">More</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-[#c0911e]/20 bg-[#0d1115] p-1.5 shadow-2xl">
                    <div className="mb-1 px-2 py-1 text-[8px] font-bold tracking-widest text-white/30 uppercase">
                      All Tools
                    </div>
                    {SECONDARY_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[11px] font-semibold transition-colors ${
                            active
                              ? 'bg-[#d4a52c]/15 text-[#f5e6b0]'
                              : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Refresh All — only on Users tab */}
          {activeTab === 'users' && (
            <button
              type="button"
              onClick={handleRefreshAll}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/20"
            >
              <RefreshIcon className={`h-3.5 w-3.5 ${refreshAllLoading ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Refresh All</span>
            </button>
          )}
        </div>

        {/* Console body — large, dark, opaque */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0a0c0e] sv-staff-scroll" style={{ overscrollBehavior: 'contain' }}>
          {activeTab === 'users' ? (
            <UserAccessSection />
          ) : activeTab === 'transactions' ? (
            <div className="flex h-full min-h-0 flex-col">
              <LiveTransactionHUD ref={txnHudRef} />
            </div>
          ) : activeTab === 'access' ? (
            <div className="flex h-full min-h-0 flex-col">
              <AccessUsageHUD />
            </div>
          ) : activeTab === 'main_feed' ? (
            <MainFeedSection />
          ) : activeTab === 'staff' ? (
            <StaffManagementSection />
          ) : activeTab === 'traffic' ? (
            <AccountTrafficSection />
          ) : activeTab === 'assets' ? (
            <AssetManagerSection staffAccount={staffAccount} />
          ) : activeTab === 'media' ? (
            <MediaManagerSection staffAccountId={staffAccount.id} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <LegacyActivityTab filter={activeTab as SecondaryTab} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Legacy activity tab ─────────────────────────────────────────

interface ActivityRow {
  activity_type: string;
  user_id: string;
  user_name: string;
  description: string;
  amount: number | null;
  platform_fee: number | null;
  portal: string;
  created_at: string;
}

const ACTIVITY_PAGE_SIZE = 40;
const POLL_INTERVAL = 30_000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatCredits(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toLocaleString();
}

function getActivityIcon(type: string): typeof Activity {
  switch (type) {
    case 'signup': return Users;
    case 'solver': return Calculator;
    case 'booking': return CalendarCheck;
    case 'spot_library': return ShoppingBag;
    case 'portal_signup': return Crown;
    default: return Activity;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'signup': return '#d4a52c';
    case 'solver': return '#3b82f6';
    case 'booking': return '#22c55e';
    case 'spot_library': return '#f97316';
    case 'portal_signup': return '#8b5cf6';
    default: return '#71717a';
  }
}

function getActivityLabel(type: string): string {
  switch (type) {
    case 'signup': return 'NEW SIGN UP';
    case 'solver': return 'SOLVER RUN';
    case 'booking': return 'BOOKING';
    case 'spot_library': return 'SPOT LIBRARY';
    case 'portal_signup': return 'PORTAL SIGN UP';
    default: return type.toUpperCase();
  }
}

export function LegacyActivityTab({ filter }: { filter: 'all' | 'solver' | 'booking' | 'spot_library' | 'portal_signup' }) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchActivities = useCallback(async (filterVal: typeof filter, append: boolean = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const limit = ACTIVITY_PAGE_SIZE;
      const offset = append ? activities.length : 0;
      const { data, error: rpcError } = await supabase.rpc('sv_staff_activity_feed', {
        p_filter: filterVal,
        p_limit: limit + 1,
        p_offset: offset,
      });
      if (rpcError) throw rpcError;
      const rows = (data as unknown as ActivityRow[]) ?? [];
      setHasMore(rows.length > limit);
      const trimmed = rows.slice(0, limit);
      if (append) {
        setActivities((prev) => [...prev, ...trimmed]);
      } else {
        setActivities(trimmed);
      }
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activities.length]);

  useEffect(() => {
    setActivities([]);
    fetchActivities(filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      fetchActivities(filterRef.current);
    }, POLL_INTERVAL);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchActivities]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        {lastUpdate && (
          <span className="flex items-center gap-1 text-[9px] text-white/25">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Updated {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        {error ? (
          <div className="flex items-center gap-2 p-6 text-[11px] text-red-300">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-white/40">No activity found.</div>
        ) : (
          <div className="divide-y divide-white/[0.02]">
            {activities.map((a, i) => {
              const Icon = getActivityIcon(a.activity_type);
              const color = getActivityColor(a.activity_type);
              return (
                <div key={`${a.activity_type}-${a.user_id}-${a.created_at}-${i}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.015]">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: `${color}30`, background: `${color}10` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color }}>{getActivityLabel(a.activity_type)}</span>
                      <span className="text-[10px] text-white/60">{a.user_name}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/40">{a.description}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-[9px] text-white/25">{formatTime(a.created_at)}</span>
                      {a.portal && <span className="text-[9px] text-white/25">{a.portal}</span>}
                      {a.amount !== null && a.amount !== undefined && (
                        <span className="text-[9px] font-semibold text-white/50">{formatCredits(a.amount)} credits</span>
                      )}
                      {a.platform_fee !== null && a.platform_fee !== undefined && (
                        <span className="text-[9px] font-semibold" style={{ color: '#d4a52c' }}>SV Take: {formatCredits(a.platform_fee)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasMore && !loading && !error && (
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={() => fetchActivities(filter, true)}
            disabled={loadingMore}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/5 disabled:opacity-50"
          >
            {loadingMore ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
