import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Users, Activity,
  Calculator, CalendarCheck, ShoppingBag, Crown, Zap,
  RefreshCw, AlertCircle, BarChart3, Image as ImageIcon, Video,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';
import { AccountTrafficSection, AssetManagerSection, UserAccessSection } from '@/components/staff/StaffSections';
import { MediaManagerSection } from '@/components/staff/MediaManagerSection';

// ── Types ──────────────────────────────────────────────────────

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

interface DashboardSummary {
  users_today: number;
  users_total: number;
  solver_runs_today: number;
  solver_runs_month: number;
  bookings_today: number;
  bookings_total: number;
  spot_library_sales_today: number;
  spot_library_sales_total: number;
  portal_signups_today: number;
  portal_signups_total: number;
  activity_today: number;
}

type HudTab = 'users' | 'solver' | 'spot_library' | 'booking' | 'portal_signup' | 'all' | 'traffic' | 'assets' | 'media';

const PAGE_SIZE = 20;
const ACTIVITY_PAGE_SIZE = 40;
const POLL_INTERVAL = 30_000;

const HUD_TABS: { id: HudTab; label: string; icon: typeof Users }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'solver', label: 'Solver', icon: Calculator },
  { id: 'spot_library', label: 'Spot Library', icon: ShoppingBag },
  { id: 'booking', label: 'Bookings', icon: CalendarCheck },
  { id: 'portal_signup', label: 'Portals', icon: Crown },
  { id: 'all', label: 'Activity', icon: Activity },
  { id: 'traffic', label: 'Website Traffic', icon: BarChart3 },
  { id: 'assets', label: 'Asset Manager', icon: ImageIcon },
  { id: 'media', label: 'Media Manager', icon: Video },
];

// ── Helpers ─────────────────────────────────────────────────────

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

// ── Main Component ──────────────────────────────────────────────

export function StaffLiveDashboard({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [activeTab, setActiveTab] = useState<HudTab>('users');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const fetchSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc('sv_staff_dashboard_summary');
    if (error) { console.error('[Staff Dashboard] Summary error:', error.code, error.message); return; }
    setSummary(data as unknown as DashboardSummary);
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const tabCounts: Partial<Record<HudTab, number>> = summary
    ? {
        solver: summary.solver_runs_today,
        spot_library: summary.spot_library_sales_today,
        booking: summary.bookings_today,
        portal_signup: summary.portal_signups_today,
        all: summary.activity_today,
      }
    : {};

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#c0911e]/20 bg-black/70 backdrop-blur-md md:overflow-hidden">
        {/* Tab bar */}
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] p-2">
          {HUD_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all ${
                  active
                    ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]'
                    : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                {count !== undefined && count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${active ? 'bg-[#d4a52c]/20 text-[#f5e6b0]' : 'bg-white/5 text-white/40'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
          {activeTab === 'traffic' ? (
            <AccountTrafficSection />
          ) : activeTab === 'assets' ? (
            <AssetManagerSection staffAccount={staffAccount} />
          ) : activeTab === 'media' ? (
            <MediaManagerSection staffAccountId={staffAccount.id} />
          ) : activeTab === 'users' ? (
            <UserAccessSection />
          ) : activeTab === 'signup' ? (
            <ActivityTab filter={'signup'} />
          ) : (
            <ActivityTab filter={activeTab} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────

function ActivityTab({ filter }: { filter: 'all' | 'signup' | 'solver' | 'booking' | 'spot_library' | 'portal_signup' }) {
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

  // Reset + fetch on filter change
  useEffect(() => {
    setActivities([]);
    fetchActivities(filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling
  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      fetchActivities(filterRef.current);
    }, POLL_INTERVAL);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchActivities]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Status bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        {lastUpdate && (
          <span className="flex items-center gap-1 text-[9px] text-white/25">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Updated {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Activity list — internally scrollable */}
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
                      {a.portal && (
                        <span className="text-[9px] text-white/25">{a.portal}</span>
                      )}
                      {a.amount !== null && a.amount !== undefined && (
                        <span className="text-[9px] font-semibold text-white/50">
                          {a.activity_type === 'spot_library' ? `Gross: ${formatCredits(a.amount)} credits` : `${formatCredits(a.amount)} credits`}
                        </span>
                      )}
                      {a.platform_fee !== null && a.platform_fee !== undefined && (
                        <span className="text-[9px] font-semibold" style={{ color: '#d4a52c' }}>
                          SV Take: {formatCredits(a.platform_fee)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load more */}
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
