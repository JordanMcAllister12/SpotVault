import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Activity, Target, ArrowUpRight, ArrowDownRight, RefreshCw, Trophy, Database } from 'lucide-react';
import { loadLatestSnapshot, loadDataStatus, type AnalyticsSnapshot, type AnalyticsMode } from '@/lib/pokerAnalytics';
import { CumulativeLineGraph, graphSeriesToPoints, downsamplePoints } from '@/components/player/CumulativeLineGraph';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

function fmt(n: number | undefined, prefix = '', suffix = ''): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${prefix}${rounded.toLocaleString()}${suffix}`;
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return 'N/A';
  return `${Math.round(n * 10) / 10}%`;
}

interface MetricProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: typeof Activity;
}

function MetricCard({ label, value, trend, icon: Icon }: MetricProps) {
  const trendColor = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : 'rgba(255,255,255,0.4)';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-semibold tracking-[0.15em] text-white/35 uppercase">{label}</span>
        <Icon className="h-3 w-3" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-white">{value}</span>
        {trend && (
          <span className="flex items-center text-[9px] font-medium" style={{ color: trendColor }}>
            {trend === 'up' && <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={2} />}
            {trend === 'down' && <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={2} />}
          </span>
        )}
      </div>
    </div>
  );
}

function TournamentMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.04] bg-black/20 px-2.5 py-1.5">
      <span className="text-[7px] font-semibold tracking-wide text-white/30 uppercase">{label}</span>
      <p className="text-[11px] font-bold text-white/75">{value}</p>
    </div>
  );
}

export function AnalyticsWidget({ onOpenAnalytics, userId, mode = 'mtt' }: { onOpenAnalytics?: () => void; userId?: string; mode?: AnalyticsMode }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const snap = await loadLatestSnapshot(userId, mode);
      if (cancelled) return;
      setSnapshot(snap);
      if (snap) {
        const status = await loadDataStatus(userId, mode);
        if (!cancelled) setStale(status.hands > snap.source_hand_count);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, mode]);

  const s = snapshot?.summary ?? {};
  const hasData = snapshot !== null && (s.hands as number) > 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <RefreshCw className="h-5 w-5 animate-spin text-white/20" strokeWidth={1.5} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <BarChart3 className="h-8 w-8 text-white/10" strokeWidth={1} />
        <div>
          <p className="text-[12px] font-bold text-white">No analytics yet</p>
          <p className="mt-1 text-[10px] text-white/35">Import hand histories and calculate to see your performance.</p>
        </div>
        {onOpenAnalytics && (
          <button
            onClick={onOpenAnalytics}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-colors hover:bg-white/5"
            style={{ borderColor: BORDER, color: GOLD_SOFT }}
          >
            <BarChart3 className="h-3 w-3" strokeWidth={1.5} />
            Go to Analytics
          </button>
        )}
      </div>
    );
  }

  const bb100 = s.bb100 as number;
  const evBb100 = s.evBb100 as number;
  const vpip = s.vpip as number;
  const pfr = s.pfr as number;
  const threeBet = s.threeBet as number;
  const cbetFlop = s.cbetFlop as number;
  const wtsd = s.wtsd as number;
  const wsd = s.wsd as number;
  const t = snapshot.tournament_analysis ?? {};

  const topMetrics: MetricProps[] = [
    { label: 'BB/100', value: fmt(bb100, bb100 >= 0 ? '+' : ''), trend: bb100 >= 0 ? 'up' : 'down', icon: TrendingUp },
    { label: 'EV BB/100', value: evBb100 !== 0 ? fmt(evBb100, evBb100 >= 0 ? '+' : '') : 'N/A', icon: TrendingUp },
    { label: 'VPIP', value: fmtPct(vpip), icon: Activity },
    { label: 'PFR', value: fmtPct(pfr), icon: Activity },
  ];

  const secondaryMetrics: MetricProps[] = [
    { label: '3-Bet', value: fmtPct(threeBet), icon: Activity },
    { label: 'Flop C-Bet', value: fmtPct(cbetFlop), icon: Target },
    { label: 'WTSD', value: fmtPct(wtsd), icon: Activity },
    { label: 'W$SD', value: fmtPct(wsd), icon: Activity },
  ];

  const graphSeries = snapshot.graph_series ?? [];
  const allPoints = graphSeriesToPoints(graphSeries as any[]);
  const miniPoints = downsamplePoints(allPoints, 120);

  return (
    <div className="h-full overflow-y-auto p-3.5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-white">Analytics</span>
            <span className="text-[8px] tracking-wide text-white/35 uppercase">Performance Overview</span>
          </div>
          <span className="rounded border border-[#c0911e]/20 bg-[#c0911e]/10 px-1.5 py-0.5 text-[7px] font-bold tracking-wider uppercase" style={{ color: GOLD_SOFT }}>{mode}</span>
          {stale && (
            <span className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-[0.15em]" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>
              <RefreshCw className="h-2.5 w-2.5" strokeWidth={2} />UPDATE
            </span>
          )}
        </div>
        <button
          onClick={onOpenAnalytics}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: BORDER, color: GOLD_SOFT }}
        >
          <BarChart3 className="h-3 w-3" strokeWidth={1.5} />
          View Analytics
        </button>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {topMetrics.map((stat) => <MetricCard key={stat.label} {...stat} />)}
      </div>

      {/* Secondary metrics */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {secondaryMetrics.map((stat) => <MetricCard key={stat.label} {...stat} />)}
      </div>

      {/* Tournament results */}
      {mode === 'mtt' && (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
          <div className="mb-2 flex items-center gap-1.5">
            <Trophy className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[9px] font-semibold tracking-wide text-white/40 uppercase">Tournament Results</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <TournamentMetric label="Entries" value={fmt(t.tournamentEntries ?? s.tournamentEntries)} />
            <TournamentMetric label="Events" value={fmt(t.tournamentEvents ?? s.tournamentEvents)} />
            <TournamentMetric label="BB Won" value={fmt(s.bbWon, s.bbWon >= 0 ? '+' : '')} />
            <TournamentMetric label="Profit" value={fmt(s.profit, s.profit >= 0 ? '+' : '')} />
          </div>
        </div>
      )}

      {/* Hands + last calculated */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="h-3 w-3 text-white/25" strokeWidth={1.5} />
          <span className="text-[10px] text-white/40">{fmt(s.hands as number)} hands</span>
        </div>
        {snapshot && (
          <span className="text-[9px] text-white/25">
            {new Date(snapshot.calculated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Mini cumulative graph — consumes the SAME canonical dataset as the full Analytics page */}
      {miniPoints.length > 1 && (
        <div className="mt-2.5">
          <CumulativeLineGraph
            variant="compact"
            data={miniPoints}
            mode={mode === 'cash' ? 'cash' : 'mtt'}
          />
        </div>
      )}
    </div>
  );
}
