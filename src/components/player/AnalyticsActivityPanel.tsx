import { useState, useCallback, useEffect, useRef } from 'react';
import {
  History, ChevronDown, ChevronUp, Filter, Upload, CheckCircle2,
  AlertTriangle, Copy, Calculator, Trash2, RefreshCw, Hammer,
  Activity, X, Loader2,
} from 'lucide-react';
import type { AnalyticsSnapshot } from '@/lib/pokerAnalytics';
import {
  fetchAnalyticsActivity,
  getEventLabel,
  type AnalyticsActivityEvent,
  type AnalyticsEventType,
  type AnalyticsActivityFilter,
} from '@/lib/analyticsActivityStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const ICON_MAP: Record<string, typeof History> = {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Calculator,
  Trash2,
  RefreshCw,
  Hammer,
  Activity,
};

const STATUS_COLORS: Record<string, string> = {
  started: '#60a5fa',
  completed: '#34d399',
  failed: '#f87171',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = `${h}:${m} ${ampm}`;
  if (isToday) return `Today ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}

function handsSummary(e: AnalyticsActivityEvent): string {
  const parts: string[] = [];
  if (e.hands_submitted != null) parts.push(`${e.hands_submitted.toLocaleString()} submitted`);
  if (e.hands_inserted != null) parts.push(`${e.hands_inserted.toLocaleString()} imported`);
  if (e.hands_duplicates != null && e.hands_duplicates > 0) parts.push(`${e.hands_duplicates.toLocaleString()} dupes`);
  if (e.hands_deleted != null && e.hands_deleted > 0) parts.push(`${e.hands_deleted.toLocaleString()} deleted`);
  return parts.join(' · ');
}

export interface ActivityPanelStatus {
  recalculating: boolean;
  recalcStage?: string;
  recalcFailed: boolean;
  isStale: boolean;
  newHandsCount: number;
  totalHands: number;
  snapshot: AnalyticsSnapshot | null;
}

interface Props {
  userId: string;
  status?: ActivityPanelStatus;
}

export function AnalyticsActivityPanel({ userId, status }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<AnalyticsActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<AnalyticsActivityFilter>({ type: 'all', dateRange: 'all' });
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchAnalyticsActivity(userId, filter);
      setEvents(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => {
    if (expanded) void loadEvents();
  }, [expanded, loadEvents]);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterMenuOpen]);

  const typeLabel = filter.type === 'all' ? 'All Activity' :
    filter.type === 'uploads' ? 'Uploads' :
    filter.type === 'calculations' ? 'Calculations' : 'Data Clears';
  const dateLabel = filter.dateRange === 'today' ? 'Today' :
    filter.dateRange === '7d' ? 'Last 7d' :
    filter.dateRange === '30d' ? 'Last 30d' : 'All Time';

  return (
    <div
      className="rounded-xl backdrop-blur-md transition-all"
      style={{
        background: 'rgba(6, 8, 10, 0.55)',
        border: `1px solid ${BORDER}`,
        boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
          <span className="text-[12px] font-bold tracking-tight text-white">Analytics Activity & Upload History</span>
          {events.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(212,165,44,0.12)', color: GOLD }}>
              {events.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status && !expanded && (
            <span className="flex items-center gap-1 text-[9px] font-medium">
              {status.recalculating ? (
                <><Loader2 className="h-3 w-3 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} /><span style={{ color: GOLD }}>{status.recalcStage ?? 'Updating'}...</span></>
              ) : status.recalcFailed ? (
                <><AlertTriangle className="h-3 w-3" style={{ color: '#f59e0b' }} strokeWidth={1.5} /><span style={{ color: '#f59e0b' }}>Update failed</span></>
              ) : status.isStale ? (
                <><AlertTriangle className="h-3 w-3" style={{ color: '#f59e0b' }} strokeWidth={1.5} /><span style={{ color: '#f59e0b' }}>{status.newHandsCount.toLocaleString()} new</span></>
              ) : (
                <><CheckCircle2 className="h-3 w-3" style={{ color: '#ffffff' }} strokeWidth={1.5} /><span className="text-white/40">Up to Date</span></>
              )}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-white/40" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40" strokeWidth={1.5} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-3 py-2">
          {/* Calculation status summary */}
          {status && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2 text-[10px]">
              {status.recalculating ? (
                <><Loader2 className="h-3 w-3 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} /><span className="font-medium" style={{ color: GOLD }}>{status.recalcStage ?? 'Updating'}...</span></>
              ) : status.recalcFailed ? (
                <><AlertTriangle className="h-3 w-3" style={{ color: '#f59e0b' }} strokeWidth={1.5} /><span className="font-medium" style={{ color: '#f59e0b' }}>Update failed</span></>
              ) : status.isStale ? (
                <><AlertTriangle className="h-3 w-3" style={{ color: '#f59e0b' }} strokeWidth={1.5} /><span className="font-medium" style={{ color: '#f59e0b' }}>{status.newHandsCount.toLocaleString()} new hands pending</span></>
              ) : (
                <><CheckCircle2 className="h-3 w-3" style={{ color: '#ffffff' }} strokeWidth={1.5} /><span className="font-medium text-white/50">Up to date · {status.totalHands.toLocaleString()} hands</span></>
              )}
              {status.snapshot && (
                <span className="text-white/25">
                  · Last calculated {new Date(status.snapshot.calculated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(status.snapshot.calculated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {status.snapshot.source_hand_count > 0 && ` · ${status.snapshot.source_hand_count.toLocaleString()} hands`}
                </span>
              )}
            </div>
          )}
          {/* Filter bar */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setFilterMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-[9px] font-bold tracking-wider uppercase text-white/50 transition-colors hover:text-white/70"
              >
                <Filter className="h-3 w-3" strokeWidth={1.5} />
                {typeLabel} · {dateLabel}
                <ChevronDown className="h-2.5 w-2.5" strokeWidth={1.5} />
              </button>
              {filterMenuOpen && (
                <div className="absolute left-0 top-full z-[300] mt-1 min-w-[180px] rounded-lg border border-white/[0.08] bg-[#0a0908] py-1 shadow-2xl">
                  <p className="px-3 py-1 text-[8px] font-bold tracking-wider uppercase text-white/30">Activity Type</p>
                  {([
                    { id: 'all', label: 'All Activity' },
                    { id: 'uploads', label: 'Uploads' },
                    { id: 'calculations', label: 'Calculations' },
                    { id: 'data_clears', label: 'Data Clears' },
                  ] as { id: AnalyticsActivityFilter['type']; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setFilter((f) => ({ ...f, type: opt.id })); setFilterMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/[0.04]"
                      style={{ color: filter.type === opt.id ? GOLD_SOFT : 'rgba(255,255,255,0.5)' }}
                    >
                      {filter.type === opt.id && <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />}
                      {opt.label}
                    </button>
                  ))}
                  <div className="my-1 border-t border-white/[0.06]" />
                  <p className="px-3 py-1 text-[8px] font-bold tracking-wider uppercase text-white/30">Date Range</p>
                  {([
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: '30d', label: 'Last 30 Days' },
                    { id: 'all', label: 'All Time' },
                  ] as { id: AnalyticsActivityFilter['dateRange']; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setFilter((f) => ({ ...f, dateRange: opt.id })); setFilterMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/[0.04]"
                      style={{ color: filter.dateRange === opt.id ? GOLD_SOFT : 'rgba(255,255,255,0.5)' }}
                    >
                      {filter.dateRange === opt.id && <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => void loadEvents()}
              className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-[9px] font-semibold text-white/40 transition-colors hover:text-white/70"
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>

          {/* Events table */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-white/30" strokeWidth={1.5} />
            </div>
          ) : events.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[10px] text-white/30">No activity recorded yet.</p>
              <p className="mt-0.5 text-[9px] text-white/20">Upload hands or recalculate analytics to build history.</p>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto rounded-lg border border-white/[0.04]">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-[#0a0908]">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-2.5 py-1.5 text-[8px] font-bold tracking-wider uppercase text-white/40">Date / Time</th>
                    <th className="px-2.5 py-1.5 text-[8px] font-bold tracking-wider uppercase text-white/40">Activity</th>
                    <th className="px-2.5 py-1.5 text-[8px] font-bold tracking-wider uppercase text-white/40">Hands</th>
                    <th className="px-2.5 py-1.5 text-[8px] font-bold tracking-wider uppercase text-white/40">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const iconName = getEventIconName(e.event_type as AnalyticsEventType);
                    const Icon = ICON_MAP[iconName] ?? Activity;
                    const statusColor = STATUS_COLORS[e.status] ?? '#8a9ab5';
                    const hands = handsSummary(e);
                    return (
                      <tr key={e.id} className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-2.5 py-2 text-[9px] text-white/40">
                          {formatDateTime(e.created_at)}
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3 w-3 shrink-0" strokeWidth={1.5} style={{ color: statusColor }} />
                            <span className="text-[10px] font-semibold text-white/70">
                              {getEventLabel(e.event_type as AnalyticsEventType)}
                            </span>
                            {e.mode && (
                              <span className="rounded px-1 py-0.5 text-[7px] font-bold uppercase text-white/30" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                {e.mode}
                              </span>
                            )}
                          </div>
                          {e.error_message && (
                            <p className="mt-0.5 text-[8px] text-red-400/60">{e.error_message}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-[9px] text-white/40">
                          {hands || '—'}
                        </td>
                        <td className="px-2.5 py-2">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"
                            style={{ background: `${statusColor}15`, color: statusColor }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
