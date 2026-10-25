import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Loader2, AlertCircle, Info, XCircle,
  TrendingUp, ShieldCheck, Target, DollarSign, Percent, BarChart3,
  type LucideIcon,
} from 'lucide-react';
import {
  fetchSprUser, fetchSprHistory, fetchTournamentMetrics, calculateSpr,
  sprTierLabel, SPR_POOL_LABELS, COMPONENT_NA_REASONS,
  type SprUserData, type SprComponentDetail, type TournamentMetricsData,
} from '@/lib/sprStore';
import {
  fetchTournamentResults, saveTournamentResult, deleteTournamentResult,
  computeTournamentMetrics,
  type TournamentResult,
} from '@/lib/tournamentResultsStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.15)';
const PANEL_BG = 'rgba(8,10,12,0.85)';
const INNER_BG = 'rgba(4,5,6,0.6)';

const COMPONENT_ICONS: Record<string, LucideIcon> = {
  stack_depth: BarChart3,
  allin_adjusted: TrendingUp,
  competition_strength: Target,
  itm: Percent,
  profit_roi: DollarSign,
};

const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  stack_depth: 'Chip win rate in big blinds per 100 hands, adjusted for stack depth.',
  allin_adjusted: 'All-in adjusted EV win rate — skill independent of short-term luck.',
  competition_strength: 'Average Buy-In across verified tournaments — the stakes you compete at.',
  itm: 'In-the-money finish percentage across tournaments.',
  profit_roi: 'Return on Investment from tournament buy-ins vs payouts.',
};

interface Props {
  userId: string;
  isOwn?: boolean;
}

export function SviPerformanceBreakdown({ userId, isOwn }: Props) {
  const [data, setData] = useState<SprUserData | null>(null);
  const [history, setHistory] = useState<{ spr_score: number; percentile: number; recorded_at: string }[]>([]);
  const [tournMetrics, setTournMetrics] = useState<TournamentMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, histResult, metricsResult] = await Promise.all([
      fetchSprUser(userId),
      fetchSprHistory(userId, 20),
      fetchTournamentMetrics(userId),
    ]);
    setData(result);
    setHistory(histResult);
    setTournMetrics(metricsResult);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const handleRecalculate = useCallback(async () => {
    if (!isOwn) return;
    setCalculating(true);
    setError(null);
    const result = await calculateSpr(userId);
    setCalculating(false);
    if (result) {
      setData(result);
      const [histResult, metricsResult] = await Promise.all([
        fetchSprHistory(userId, 20),
        fetchTournamentMetrics(userId),
      ]);
      setHistory(histResult);
      setTournMetrics(metricsResult);
    } else {
      setError('Unable to calculate performance score. Make sure you have imported hand histories.');
    }
  }, [userId, isOwn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>
    );
  }

  const status = data?.status ?? 'unqualified';
  const score = data?.spr_score ?? 0;
  const percentile = data?.percentile ?? 0;
  const tier = sprTierLabel(score);
  const poolLabel = data?.estimated_pool ? SPR_POOL_LABELS[data.estimated_pool] ?? data.estimated_pool : null;
  const isUnqualified = status === 'unqualified';
  const isProvisional = status === 'provisional';
  const excludedCount = data?.excluded_components?.length ?? 0;
  const availableCount = data?.available_components?.length ?? 0;

  const handsProgress = Math.min(100, ((data?.valid_hands ?? 0) / 10000) * 100);
  const entriesProgress = Math.min(100, ((data?.tournament_entries ?? 0) / 100) * 100);
  const componentsProgress = (availableCount / 5) * 100;

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: BORDER, background: PANEL_BG }}
    >
      {/* Expandable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-[9px] font-bold tracking-[0.18em] text-white/70 uppercase">Performance Evaluation Breakdown</span>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
          : <ChevronDown className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: BORDER }}>
          {/* SVI Status badge */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest uppercase text-white/40">SVI Status:</span>
            <span
              className="flex items-center gap-1 rounded border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
              style={{
                borderColor: isUnqualified ? '#6b728030' : isProvisional ? `${GOLD}30` : '#4ade8030',
                background: isUnqualified ? '#6b728012' : isProvisional ? `${GOLD}12` : '#4ade8012',
                color: isUnqualified ? '#9ca3af' : isProvisional ? GOLD : '#4ade80',
              }}
            >
              <ShieldCheck className="h-2.5 w-2.5" strokeWidth={1.5} />
              {isUnqualified ? 'Provisional' : isProvisional ? 'Provisional' : 'Official'}
            </span>
          </div>

          {isUnqualified ? (
            <QualificationView
              data={data}
              isOwn={isOwn}
              availableCount={availableCount}
              handsProgress={handsProgress}
              entriesProgress={entriesProgress}
              componentsProgress={componentsProgress}
              onRecalculate={handleRecalculate}
              calculating={calculating}
              error={error}
            />
          ) : (
            <>
              {/* Overall SVI score with 5-component methodology */}
              <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: INNER_BG }}>
                <div className="flex items-end gap-4">
                  <div>
                    <div className="text-[9px] font-bold tracking-widest uppercase text-white/40">SVI Score</div>
                    <div className="text-3xl font-bold leading-none" style={{ color: tier.color }}>
                      {score.toFixed(1)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold tracking-wide" style={{ color: tier.color }}>
                      {tier.label}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[9px] font-bold tracking-widest uppercase text-white/40">Global Percentile</div>
                    {isProvisional ? (
                      <>
                        <div className="text-xl font-bold text-white/30">N/A</div>
                        <div className="mt-0.5 text-[10px] text-white/30">Provisional — not ranked</div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-bold text-white">{percentile > 0 ? percentile.toFixed(1) : '—'}</span>
                          {percentile > 0 && <span className="text-[10px] text-white/40">%</span>}
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/35">
                          {percentile > 0
                            ? `Top ${(100 - percentile).toFixed(1)}% of qualified players`
                            : 'Not enough qualified players for percentile'}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {isProvisional && (
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.05)' }}>
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                    <p className="text-[9px] leading-relaxed text-white/50">
                      <span className="font-bold" style={{ color: GOLD_SOFT }}>Provisional estimate.</span>{' '}
                      {excludedCount > 0
                        ? `${excludedCount} of 5 categories ${excludedCount === 1 ? 'is' : 'are'} unavailable and excluded from this score. Not compared against official global rankings.`
                        : 'Some categories use proxy data. Not compared against official global rankings.'}
                    </p>
                  </div>
                )}

                {/* Quick stats */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <PerfStat label="Valid Hands" value={data ? data.valid_hands.toLocaleString() : '—'} />
                  <PerfStat label="Tournament Entries" value={data?.tournament_entries?.toLocaleString() ?? '—'} />
                  <PerfStat label="Verified ABI" value={data ? `$${data.verified_abi.toFixed(2)}` : '—'} />
                </div>

                {/* Tournament results supporting data */}
                {tournMetrics && tournMetrics.has_results && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <SupportStat icon={<Target className="h-2.5 w-2.5" strokeWidth={1.5} />} label="Results" value={tournMetrics.entries.toString()} />
                    <SupportStat icon={<Percent className="h-2.5 w-2.5" strokeWidth={1.5} />} label="ROI" value={`${tournMetrics.roi.toFixed(1)}%`} positive={tournMetrics.net_profit > 0} negative={tournMetrics.net_profit < 0} />
                    <SupportStat icon={<DollarSign className="h-2.5 w-2.5" strokeWidth={1.5} />} label="ITM" value={`${tournMetrics.itm.toFixed(1)}%`} />
                    <SupportStat icon={<DollarSign className="h-2.5 w-2.5" strokeWidth={1.5} />} label="Net" value={formatCurrency(tournMetrics.net_profit)} positive={tournMetrics.net_profit > 0} negative={tournMetrics.net_profit < 0} />
                  </div>
                )}

                {poolLabel && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold tracking-widest uppercase text-white/30">Competition Pool:</span>
                    <span className="text-[10px] font-bold" style={{ color: GOLD }}>{poolLabel}</span>
                  </div>
                )}

                {data && data.confidence > 0 && data.confidence < 1 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold tracking-widest uppercase text-white/30">Confidence:</span>
                    <div className="h-1 w-20 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${data.confidence * 100}%`, background: GOLD }} />
                    </div>
                    <span className="text-[9px] text-white/40">{Math.round(data.confidence * 100)}%</span>
                  </div>
                )}
              </div>

              {/* Qualification progress (provisional only) */}
              {isProvisional && (
                <div className="rounded-lg border p-2.5 space-y-1.5" style={{ borderColor: BORDER, background: INNER_BG }}>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-white/30">Qualification Progress</div>
                  <QualificationBar label="Hands" current={data?.valid_hands ?? 0} target={10000} />
                  <QualificationBar label="Entries" current={data?.tournament_entries ?? 0} target={100} />
                  <QualificationBar label="Categories" current={availableCount} target={5} />
                </div>
              )}

              {/* Five-component breakdown */}
              {data && data.components && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold tracking-widest uppercase text-white/40">Five-Component Performance Engine</div>
                  {data.components.map((comp) => (
                    <ComponentBar key={comp.key} component={comp} isProvisional={isProvisional} />
                  ))}

                  {/* All-in EV supporting data */}
                  {(() => {
                    const allinComp = data.components.find(c => c.key === 'allin_adjusted');
                    const detail = allinComp?.detail as Record<string, unknown> | undefined;
                    const eligibleHands = detail?.eligible_hands as number | undefined;
                    const evTotal = detail?.ev_total_bb as number | undefined;
                    if (eligibleHands !== undefined && eligibleHands > 0) {
                      return (
                        <div className="rounded-lg border p-2.5" style={{ borderColor: BORDER, background: INNER_BG }}>
                          <div className="text-[9px] font-bold tracking-widest uppercase text-white/30 mb-1">All-In EV Detail</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[8px] text-white/30">Eligible Hands</div>
                              <div className="text-[12px] font-bold text-white/70">{eligibleHands}</div>
                            </div>
                            <div>
                              <div className="text-[8px] text-white/30">Total EV (BB)</div>
                              <div className="text-[12px] font-bold" style={{ color: (evTotal ?? 0) > 0 ? '#4ade80' : '#f87171' }}>
                                {(evTotal ?? 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex items-start gap-1.5 rounded-lg border p-2.5" style={{ borderColor: BORDER, background: INNER_BG }}>
                    <Info className="mt-0.5 h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
                    <p className="text-[9px] leading-relaxed text-white/40">
                      The SVI performance engine uses five weighted categories: Stack-Depth BB/100 (25%), All-In Adjusted BB/100 (20%),
                      ABI / Competition Strength (25%), ITM Percentage (10%), and Profit + ROI (20%).
                      Official ratings require complete verified data for all five categories.
                      {isProvisional && ' Provisional scores are renormalized across available categories only.'}
                    </p>
                  </div>
                </div>
              )}

              {/* History sparkline */}
              {history.length > 1 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="h-3 w-3 text-white/30" strokeWidth={1.5} />
                    <span className="text-[9px] font-bold tracking-widest uppercase text-white/30">Score History</span>
                  </div>
                  <Sparkline data={history.map(h => h.spr_score)} max={100} />
                </div>
              )}

              {/* Tournament results entry (own profile only) */}
              {isOwn && (
                <TournamentResultsSection userId={userId} onSaved={() => { void load(); }} />
              )}

              {/* Recalculate button (own profile only) */}
              {isOwn && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRecalculate}
                    disabled={calculating}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase transition-all disabled:opacity-50"
                    style={{ borderColor: BORDER, background: INNER_BG, color: GOLD_SOFT }}
                  >
                    {calculating
                      ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                      : <TrendingUp className="h-3 w-3" strokeWidth={1.5} />}
                    {calculating ? 'Calculating...' : 'Recalculate SVI'}
                  </button>
                  {error && <p className="text-[10px] text-red-400/70">{error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QualificationView({ data, isOwn, availableCount, handsProgress, entriesProgress, componentsProgress, onRecalculate, calculating, error }: {
  data: SprUserData | null;
  isOwn?: boolean;
  availableCount: number;
  handsProgress: number;
  entriesProgress: number;
  componentsProgress: number;
  onRecalculate: () => void;
  calculating: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-1.5 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.05)' }}>
        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
        <p className="text-[9px] leading-relaxed text-white/50">
          <span className="font-bold" style={{ color: GOLD_SOFT }}>SVI Status: Provisional.</span>{' '}
          Official SVI scoring requires at least 10,000 valid tournament hands, 100 tournament entries, and all 5 verified performance categories.
          Import your hand histories to begin building your rating.
        </p>
      </div>

      {isOwn && data && data.valid_hands > 0 && (
        <div className="space-y-2 max-w-md">
          <QualificationProgress label="Valid Hands" current={data.valid_hands} target={10000} />
          <QualificationProgress label="Tournament Entries" current={data.tournament_entries} target={100} />
          <QualificationProgress label="Verified Categories" current={availableCount} target={5} />
        </div>
      )}

      {isOwn && (
        <div className="flex items-center gap-2">
          <button
            onClick={onRecalculate}
            disabled={calculating}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase transition-all disabled:opacity-50"
            style={{ borderColor: BORDER, background: INNER_BG, color: GOLD_SOFT }}
          >
            {calculating
              ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              : <TrendingUp className="h-3 w-3" strokeWidth={1.5} />}
            {calculating ? 'Calculating...' : 'Recalculate SVI'}
          </button>
          {error && <p className="text-[10px] text-red-400/70">{error}</p>}
        </div>
      )}
    </div>
  );
}

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function QualificationProgress({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: INNER_BG }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold tracking-widest uppercase text-white/30">{label}</span>
        <span className="text-[10px] font-bold text-white/60">{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct >= 100 ? '#4ade80' : GOLD }} />
      </div>
    </div>
  );
}

function QualificationBar({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-white/40">{label}</span>
        <span className="text-[9px] font-bold text-white/50">{current.toLocaleString()}/{target.toLocaleString()}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct >= 100 ? '#4ade80' : GOLD }} />
      </div>
    </div>
  );
}

function Sparkline({ data, max }: { data: number[]; max: number }) {
  if (data.length < 2) return null;
  const w = 200;
  const h = 36;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastVal = data[data.length - 1];
  const firstVal = data[0];
  const trend = lastVal >= firstVal;
  const color = trend ? '#4ade80' : '#f87171';

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-hidden rounded">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.8}
      />
      <circle
        cx={w}
        cy={h - (lastVal / max) * h}
        r={2}
        fill={color}
      />
    </svg>
  );
}

function PerfStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: BORDER, background: INNER_BG }}>
      <div className="text-[8px] font-bold tracking-widest uppercase text-white/30">{label}</div>
      <div className="mt-0.5 text-[12px] font-bold text-white/80">{value}</div>
    </div>
  );
}

function SupportStat({ icon, label, value, positive, negative }: { icon: React.ReactNode; label: string; value: string; positive?: boolean; negative?: boolean }) {
  const color = positive ? '#4ade80' : negative ? '#f87171' : 'rgba(255,255,255,0.6)';
  return (
    <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: BORDER, background: INNER_BG }}>
      <div className="flex items-center gap-1 text-[8px] font-bold tracking-widest uppercase text-white/30">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[11px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function ComponentBar({ component, isProvisional }: { component: SprComponentDetail; isProvisional: boolean }) {
  const label = component.detail?.label ?? component.key;
  const note = component.detail?.note ?? null;
  const availability = component.detail?.availability ?? 'available';
  const score = component.score ?? 0;
  const weight = Math.round(component.weight * 100);
  const isMissing = availability === 'missing';
  const isIncomplete = availability === 'incomplete';
  const Icon = COMPONENT_ICONS[component.key] ?? BarChart3;

  if (isMissing) {
    return (
      <div className="rounded-lg border p-2.5" style={{ borderColor: 'rgba(255,255,255,0.06)', background: INNER_BG, opacity: 0.7 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 text-white/25" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold text-white/50">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold tracking-wider uppercase text-white/20">{weight}%</span>
            <span className="flex items-center gap-1 text-[12px] font-bold text-white/25">
              <XCircle className="h-3 w-3" strokeWidth={1.5} />
              N/A
            </span>
          </div>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="h-full rounded-full" style={{ width: '0%', background: 'rgba(255,255,255,0.08)' }} />
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-white/25">
          {note ?? COMPONENT_NA_REASONS[component.key] ?? COMPONENT_DESCRIPTIONS[component.key]}
        </p>
      </div>
    );
  }

  const scoreColor = score >= 75 ? '#4ade80' : score >= 50 ? GOLD : score >= 25 ? '#f2c14e' : '#f87171';

  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: BORDER, background: INNER_BG }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" style={{ color: scoreColor }} strokeWidth={1.5} />
          <span className="text-[10px] font-semibold text-white/70">
            {label}
            {isIncomplete && <span className="ml-1.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: '#f2c14e' }}>Proxy</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold tracking-wider uppercase text-white/30">{weight}%</span>
          <span className="text-[12px] font-bold" style={{ color: scoreColor }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, score)}%`, background: scoreColor }}
        />
      </div>
      <p className="mt-1 text-[9px] leading-relaxed text-white/30">
        {note ?? COMPONENT_DESCRIPTIONS[component.key]}
      </p>
      {isProvisional && isIncomplete && !note && (
        <p className="mt-1 text-[9px] leading-relaxed text-white/25">
          Using proxy data — excluded from official qualification.
        </p>
      )}
    </div>
  );
}

function TournamentResultsSection({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [tournamentName, setTournamentName] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [payout, setPayout] = useState('');
  const [finishPosition, setFinishPosition] = useState('');
  const [totalEntrants, setTotalEntrants] = useState('');
  const [playedAt, setPlayedAt] = useState('');
  const [isReEntry, setIsReEntry] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    const data = await fetchTournamentResults(userId);
    setResults(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadResults(); }, [loadResults]);

  const metrics = computeTournamentMetrics(results);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFormError(null);
    const buyInNum = parseFloat(buyIn);
    if (isNaN(buyInNum) || buyInNum <= 0) {
      setFormError('Buy-in must be a positive number');
      setSaving(false);
      return;
    }
    const tournamentId = `${tournamentName || 'tournament'}-${playedAt || new Date().toISOString().slice(0, 10)}${isReEntry ? '-re' : ''}`.toLowerCase().replace(/\s+/g, '-');
    const result: TournamentResult = {
      tournament_id: tournamentId,
      tournament_name: tournamentName || null,
      buy_in: buyInNum,
      entry_fee: parseFloat(entryFee) || 0,
      payout: parseFloat(payout) || 0,
      finish_position: finishPosition ? parseInt(finishPosition) : null,
      total_entrants: totalEntrants ? parseInt(totalEntrants) : null,
      is_re_entry: isReEntry,
      re_entry_number: isReEntry ? 1 : 0,
      poker_site: null,
      played_at: playedAt ? new Date(playedAt).toISOString() : new Date().toISOString(),
      manually_entered: true,
    };
    const { success, error: saveError } = await saveTournamentResult(userId, result);
    setSaving(false);
    if (!success) {
      setFormError(saveError ?? 'Failed to save');
      return;
    }
    setTournamentName(''); setBuyIn(''); setEntryFee(''); setPayout('');
    setFinishPosition(''); setTotalEntrants(''); setPlayedAt(''); setIsReEntry(false);
    setShowForm(false);
    await loadResults();
    onSaved();
  }, [userId, tournamentName, buyIn, entryFee, payout, finishPosition, totalEntrants, playedAt, isReEntry, loadResults, onSaved]);

  const handleDelete = useCallback(async (id: string) => {
    const { success } = await deleteTournamentResult(userId, id);
    if (success) {
      await loadResults();
      onSaved();
    }
  }, [userId, loadResults, onSaved]);

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: INNER_BG }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Target className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">Tournament Results</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-all hover:opacity-80"
          style={{ borderColor: BORDER, background: INNER_BG, color: GOLD_SOFT }}
        >
          <TrendingUp className="h-2.5 w-2.5" strokeWidth={1.5} />
          Add
        </button>
      </div>

      {results.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          <MiniStat label="Entries" value={metrics.totalEntries.toString()} />
          <MiniStat label="ROI" value={`${metrics.roi.toFixed(1)}%`} color={metrics.netProfit > 0 ? '#4ade80' : metrics.netProfit < 0 ? '#f87171' : undefined} />
          <MiniStat label="ITM" value={`${metrics.itm.toFixed(1)}%`} />
          <MiniStat label="Net" value={formatCurrency(metrics.netProfit)} color={metrics.netProfit > 0 ? '#4ade80' : metrics.netProfit < 0 ? '#f87171' : undefined} />
        </div>
      )}

      {showForm && (
        <div className="mb-3 rounded-lg border p-3 space-y-2" style={{ borderColor: BORDER, background: 'rgba(0,0,0,0.3)' }}>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Tournament Name" value={tournamentName} onChange={setTournamentName} placeholder="Bounty Hunters $55" />
            <FormField label="Date" value={playedAt} onChange={setPlayedAt} type="date" />
            <FormField label="Buy-in ($)" value={buyIn} onChange={setBuyIn} type="number" placeholder="55" />
            <FormField label="Entry Fee ($)" value={entryFee} onChange={setEntryFee} type="number" placeholder="5" />
            <FormField label="Payout ($)" value={payout} onChange={setPayout} type="number" placeholder="0" />
            <FormField label="Finish Position" value={finishPosition} onChange={setFinishPosition} type="number" placeholder="42" />
            <FormField label="Total Entrants" value={totalEntrants} onChange={setTotalEntrants} type="number" placeholder="500" />
            <label className="flex items-center gap-1.5 pt-4">
              <input type="checkbox" checked={isReEntry} onChange={(e) => setIsReEntry(e.target.checked)} className="accent-amber-500" />
              <span className="text-[10px] text-white/50">Re-entry</span>
            </label>
          </div>
          {formError && <p className="text-[10px] text-red-400/70">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all disabled:opacity-50"
              style={{ borderColor: `${GOLD}40`, background: `${GOLD}10`, color: GOLD_SOFT }}
            >
              {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={1.5} /> : <TrendingUp className="h-2.5 w-2.5" strokeWidth={1.5} />}
              Save Result
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="rounded border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40 transition-all hover:opacity-80"
              style={{ borderColor: BORDER, background: INNER_BG }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-3 w-3 animate-spin text-white/30" strokeWidth={1.5} />
        </div>
      ) : results.length === 0 ? (
        <p className="text-[10px] leading-relaxed text-white/30 py-2">
          No tournament results entered yet. Add your tournament finishes to enable ITM and ROI scoring.
        </p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {results.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border px-2 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-white/60 truncate">
                  {r.tournament_name ?? `Tournament ${r.tournament_id.slice(-8)}`}
                  {r.is_re_entry && <span className="ml-1 text-[8px] text-white/30">RE</span>}
                </div>
                <div className="text-[9px] text-white/30">
                  ${r.buy_in} entry{r.finish_position ? ` · ${r.finish_position}/${r.total_entrants ?? '?'}` : ''} · {(r.payout || 0) > 0 ? `+$${r.payout}` : 'no cash'}
                </div>
              </div>
              <button
                onClick={() => r.id && void handleDelete(r.id)}
                className="ml-2 rounded p-1 text-white/20 transition-colors hover:text-red-400/60"
              >
                <XCircle className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          {results.length > 10 && (
            <p className="text-[9px] text-white/25 pt-1 text-center">Showing 10 of {results.length}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border px-1.5 py-1" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
      <div className="text-[7px] font-bold tracking-widest uppercase text-white/25">{label}</div>
      <div className="text-[10px] font-bold" style={{ color: color ?? 'rgba(255,255,255,0.6)' }}>{value}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[9px] font-bold tracking-wider uppercase text-white/30">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded border px-2 py-1 text-[11px] text-white/70 outline-none transition-colors focus:border-amber-500/30"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}
      />
    </div>
  );
}
