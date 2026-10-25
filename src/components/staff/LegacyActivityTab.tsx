import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Activity, Calculator, ShoppingBag, CalendarCheck,
  RefreshCw, AlertCircle, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type ActivityFilter = 'all' | 'solver' | 'booking' | 'spot_library' | 'portal_signup';

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
    case 'portal_signup': return Users;
    default: return Activity;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'signup': return '#d4a52c';
    case 'solver': return '#3b82f6';
    case 'booking': return '#22c55e';
    case 'spot_library': return '#f97316';
    case 'portal_signup': return '#d4a52c';
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

export function LegacyActivityTab({ filter }: { filter: ActivityFilter }) {
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
