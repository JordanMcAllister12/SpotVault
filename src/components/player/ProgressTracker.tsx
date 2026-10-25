import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Calendar, Camera, Upload, Plus, Target,
  ChevronRight, X, Image as ImageIcon, Activity, Clock,
  CheckCircle2, AlertCircle, ArrowUp, ArrowDown, ArrowRight, BarChart3,
  Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadLatestSnapshot, type AnalyticsSnapshot } from '@/lib/pokerAnalytics';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const SECTION_BG = 'rgba(8, 10, 12, 0.82)';

const WORKSPACE = 'player-demo-jordan';
const PLAYER_ID = 'stu-jordan';

const MIN_INTERVAL_DAYS = 30;

interface ProgressProfile {
  id: string;
  coaching_start_date: string;
  coach_id: string | null;
  reminder_interval_days: number;
  next_update_at: string | null;
  status: string;
  end_date: string | null;
}

interface ProgressSnapshot {
  id: string;
  profile_id: string;
  snapshot_type: string;
  captured_at: string;
  total_hands: number;
  total_games: number;
  analytics_snapshot: Record<string, number>;
  graph_snapshot_data: { index: number; profit: number }[] | null;
  external_image_url: string | null;
  student_notes: string;
}

interface ProgressImage {
  id: string;
  snapshot_id: string;
  image_url: string;
  marker_position: number;
  marker_type: string;
}

interface ProgressTarget {
  id: string;
  profile_id: string;
  metric: string;
  target_min: number | null;
  target_max: number | null;
  target_direction: string;
}

interface ProgressComment {
  id: string;
  snapshot_id: string;
  author_id: string;
  author_role: string;
  comment: string;
  created_at: string;
}

const METRIC_LABELS: Record<string, string> = {
  hands: 'Hands', games: 'Games', profit: 'Profit', bb_won: 'BB Won',
  bb100: 'BB/100', ev_bb100: 'EV BB/100', abi: 'ABI',
  vpip: 'VPIP', pfr: 'PFR', vpip_pfr_gap: 'VPIP/PFR Gap',
  three_bet: '3-Bet', fold_to_3bet: 'Fold to 3-Bet', four_bet: '4-Bet', steal: 'Steal',
  cbet_flop: 'Flop C-Bet', barrel_turn: 'Turn Barrel', barrel_river: 'River Barrel',
  wtsd: 'WTSD', wsd: 'W$SD', wwsf: 'WWSF',
};

const PCT_METRICS = new Set(['vpip', 'pfr', 'three_bet', 'fold_to_3bet', 'four_bet', 'steal', 'cbet_flop', 'barrel_turn', 'barrel_river', 'wtsd', 'wsd', 'wwsf', 'itm', 'roi']);
const BB_METRICS = new Set(['bb100', 'ev_bb100']);
const DOLLAR_METRICS = new Set(['profit', 'abi']);

function formatMetric(key: string, value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  if (BB_METRICS.has(key)) return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  if (PCT_METRICS.has(key)) return `${value.toFixed(1)}%`;
  if (DOLLAR_METRICS.has(key)) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (key === 'hands' || key === 'games' || key === 'bb_won') return value.toLocaleString();
  return value.toFixed(1);
}

function formatChange(key: string, baseline: number, current: number): string {
  const diff = current - baseline;
  if (PCT_METRICS.has(key)) return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts`;
  if (BB_METRICS.has(key)) return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
  if (DOLLAR_METRICS.has(key)) return `${diff >= 0 ? '+' : ''}$${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (key === 'hands' || key === 'games') return `${diff >= 0 ? '+' : ''}${diff.toLocaleString()}`;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
}

function getTrend(values: number[]): 'up' | 'down' | 'stable' | 'insufficient' {
  if (values.length < 2) return 'insufficient';
  const first = values[0];
  const last = values[values.length - 1];
  const diff = last - first;
  if (Math.abs(diff) < 0.3) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' | 'insufficient' }) {
  if (trend === 'up') return <ArrowUp className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />;
  if (trend === 'down') return <ArrowDown className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />;
  if (trend === 'stable') return <ArrowRight className="h-3 w-3 text-white/40" strokeWidth={2} />;
  return <span className="text-[8px] text-white/30">N/A</span>;
}

function Sparkline({ values, color = GOLD }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 48, h = 16;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function daysBetween(d1: string | Date, d2: string | Date): number {
  return Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
}

async function captureAnalytics(): Promise<{ summary: Record<string, number>; graph: { index: number; profit: number }[] | null }> {
  const snapshot = await loadLatestSnapshot(PLAYER_ID, 'mtt');
  if (!snapshot) return { summary: { hands: 0 }, graph: null };
  const summary = snapshot.summary ?? { hands: snapshot.source_hand_count ?? 0 };
  const graph = snapshot.graph_series
    ? snapshot.graph_series.map((g) => ({ index: g.index, profit: g.profit }))
    : null;
  return { summary, graph };
}

export function ProgressTracker({ coachId, coachName }: { coachId?: string | null; coachName: string }) {
  const [profile, setProfile] = useState<ProgressProfile | null>(null);
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [images, setImages] = useState<ProgressImage[]>([]);
  const [targets, setTargets] = useState<ProgressTarget[]>([]);
  const [comments, setComments] = useState<ProgressComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBaseline, setShowBaseline] = useState(false);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: profileData, error: profileError } = await supabase
      .from('coaching_progress_profiles')
      .select('id, coaching_start_date, coach_id, reminder_interval_days, next_update_at, status, end_date')
      .eq('workspace_key', WORKSPACE)
      .eq('player_id', PLAYER_ID)
      .maybeSingle();

    if (profileError) { setError('Could not load progress data.'); setLoading(false); return; }
    if (!profileData) { setProfile(null); setLoading(false); return; }

    setProfile(profileData as ProgressProfile);

    const [snapRes, imgRes, targetRes, commentRes] = await Promise.all([
      supabase.from('coaching_progress_snapshots').select('*').eq('profile_id', profileData.id).order('captured_at', { ascending: true }),
      supabase.from('coaching_progress_images').select('*').in('snapshot_id', [profileData.id]),
      supabase.from('coaching_progress_targets').select('*').eq('profile_id', profileData.id),
      supabase.from('coaching_progress_comments').select('*').in('snapshot_id', [profileData.id]).order('created_at', { ascending: true }),
    ]);

    if (snapRes.data) setSnapshots(snapRes.data as ProgressSnapshot[]);
    if (imgRes.data) setImages(imgRes.data as ProgressImage[]);
    if (targetRes.data) setTargets(targetRes.data as ProgressTarget[]);
    if (commentRes.data) setComments(commentRes.data as ProgressComment[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const baseline = useMemo(() => snapshots.find((s) => s.snapshot_type === 'baseline'), [snapshots]);
  const checkpoints = useMemo(() => snapshots.filter((s) => s.snapshot_type === 'checkpoint'), [snapshots]);
  const current = useMemo(() => snapshots[snapshots.length - 1] ?? null, [snapshots]);
  const previous = useMemo(() => snapshots.length > 1 ? snapshots[snapshots.length - 2] : null, [snapshots]);

  const allMetrics = useMemo(() => {
    if (!baseline) return [];
    return Object.keys(baseline.analytics_snapshot).filter((k) => METRIC_LABELS[k]);
  }, [baseline]);

  const daysCoaching = useMemo(() => {
    if (!profile) return 0;
    return Math.max(0, daysBetween(profile.coaching_start_date, new Date()));
  }, [profile]);

  const handsSinceStart = useMemo(() => {
    if (!baseline || !current) return 0;
    return (current.total_hands || current.analytics_snapshot.hands || 0) - (baseline.total_hands || baseline.analytics_snapshot.hands || 0);
  }, [baseline, current]);

  // 30-day enforcement
  const canUpdateNow = useMemo(() => {
    if (!profile || !current) return false;
    if (profile.status !== 'active') return false;
    const lastCapture = current.captured_at;
    const daysSince = daysBetween(lastCapture, new Date());
    return daysSince >= MIN_INTERVAL_DAYS;
  }, [profile, current]);

  const daysUntilNextUpdate = useMemo(() => {
    if (!profile || !current) return 0;
    const lastCapture = current.captured_at;
    const daysSince = daysBetween(lastCapture, new Date());
    return Math.max(0, MIN_INTERVAL_DAYS - daysSince);
  }, [profile, current]);

  const nextUpdateDate = useMemo(() => {
    if (!profile?.next_update_at) return null;
    return new Date(profile.next_update_at);
  }, [profile]);

  const isUpdateDue = useMemo(() => {
    if (!profile || !current) return false;
    if (profile.next_update_at) {
      return new Date(profile.next_update_at) <= new Date() && daysBetween(current.captured_at, new Date()) >= MIN_INTERVAL_DAYS;
    }
    return false;
  }, [profile, current]);

  const selectedSnap = useMemo(() => snapshots.find((s) => s.id === selectedSnapshot) ?? null, [snapshots, selectedSnapshot]);
  const selectedImages = useMemo(() => images.filter((i) => i.snapshot_id === selectedSnapshot), [images, selectedSnapshot]);
  const selectedComments = useMemo(() => comments.filter((c) => c.snapshot_id === selectedSnapshot), [comments, selectedSnapshot]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="h-6 w-6 animate-pulse text-white/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-[12px] text-red-300">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    );
  }

  if (!profile) {
    return <BaselineSetup coachName={coachName} onCreated={() => void loadData()} coachId={coachId} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Summary dashboard ── */}
      <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(12px)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h2 className="text-[13px] font-bold tracking-wide text-white">Coaching Progress</h2>
          </div>
          {profile.status === 'active' && (
            <button
              onClick={() => setShowCheckpoint(true)}
              disabled={!canUpdateNow}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: canUpdateNow ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.1)',
                background: canUpdateNow ? 'rgba(192,145,30,0.12)' : 'rgba(255,255,255,0.03)',
                color: canUpdateNow ? GOLD_SOFT : 'rgba(255,255,255,0.3)',
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Update Progress
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-white/50">
          <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" style={{ color: GOLD }} /> Started: {new Date(profile.coaching_start_date).toLocaleDateString()}</div>
          {baseline && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" style={{ color: GOLD }} /> Baseline: {new Date(baseline.captured_at).toLocaleDateString()}</div>}
          {current && current !== baseline && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" style={{ color: GOLD }} /> Latest: {new Date(current.captured_at).toLocaleDateString()}</div>}
          {nextUpdateDate && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" style={{ color: GOLD }} /> Next Update: {nextUpdateDate.toLocaleDateString()}</div>}
          <div className="flex items-center gap-1.5"><Activity className="h-3 w-3" style={{ color: GOLD }} /> Days Coaching: {daysCoaching}</div>
          {profile.status === 'ended' && profile.end_date && (
            <div className="flex items-center gap-1.5 text-amber-300"><AlertCircle className="h-3 w-3" /> Coaching Ended: {new Date(profile.end_date).toLocaleDateString()}</div>
          )}
        </div>
      </div>

      {/* ── Update due banner ── */}
      {isUpdateDue && profile.status === 'active' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/12 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-[#f5e6b0]">
            <Bell className="h-3.5 w-3.5" style={{ color: GOLD }} />
            Progress update due — time to capture your latest analytics.
          </div>
          <button
            onClick={() => setShowCheckpoint(true)}
            className="rounded-md border border-[#d4a52c]/50 bg-[#c0911e]/20 px-3 py-1.5 text-[9px] font-bold tracking-wide text-[#f5e6b0] uppercase hover:bg-[#c0911e]/30"
          >
            Update Progress
          </button>
        </div>
      )}

      {/* ── Update blocked banner ── */}
      {!canUpdateNow && profile.status === 'active' && current && !isUpdateDue && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <Clock className="h-3.5 w-3.5 text-white/40" />
            Next progress update available in {daysUntilNextUpdate} day{daysUntilNextUpdate !== 1 ? 's' : ''}.
          </div>
          <span className="text-[10px] text-white/30">
            {nextUpdateDate ? nextUpdateDate.toLocaleDateString() : '—'}
          </span>
        </div>
      )}

      {/* ── Metric cards ── */}
      {baseline && current && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {['bb100', 'vpip', 'three_bet', 'wwsf'].map((metric) => {
            const baseVal = baseline.analytics_snapshot[metric];
            const currVal = current.analytics_snapshot[metric];
            const trendValues = snapshots.map((s) => s.analytics_snapshot[metric]).filter((v) => v !== undefined && v !== null);
            const trend = getTrend(trendValues);
            return (
              <div key={metric} className="rounded-xl border p-3" style={{ borderColor: 'rgba(212,165,44,0.10)', background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
                <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{METRIC_LABELS[metric]}</div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[11px] text-white/40">{formatMetric(metric, baseVal)}</span>
                  <ArrowRight className="h-3 w-3 text-white/25" />
                  <span className="text-sm font-bold text-white">{formatMetric(metric, currVal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: GOLD_SOFT }}>
                    {formatChange(metric, baseVal, currVal)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Sparkline values={trendValues} />
                    <TrendIcon trend={trend} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Comparison table ── */}
      {baseline && current && (
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Baseline vs Current</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-white/40">
                  <th className="py-2 pr-3 text-left font-semibold uppercase tracking-wide">Metric</th>
                  <th className="py-2 px-3 text-right font-semibold uppercase tracking-wide">Baseline</th>
                  <th className="py-2 px-3 text-right font-semibold uppercase tracking-wide">Current</th>
                  <th className="py-2 pl-3 text-right font-semibold uppercase tracking-wide">Change</th>
                </tr>
              </thead>
              <tbody>
                {allMetrics.map((key) => {
                  const fromVal = baseline.analytics_snapshot[key];
                  const toVal = current.analytics_snapshot[key];
                  if (fromVal === undefined || toVal === undefined) return null;
                  const diff = toVal - fromVal;
                  const trendValues = snapshots.map((s) => s.analytics_snapshot[key]).filter((v) => v !== undefined);
                  const trend = getTrend(trendValues);
                  return (
                    <tr key={key} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-3 font-semibold text-white/70">{METRIC_LABELS[key]}</td>
                      <td className="py-2 px-3 text-right text-white/50">{formatMetric(key, fromVal)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-white">{formatMetric(key, toVal)}</td>
                      <td className="py-2 pl-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <span style={{ color: GOLD_SOFT }}>{formatChange(key, fromVal, toVal)}</span>
                          <TrendIcon trend={trend} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[9px] text-white/30">
            Direction shown as increased / decreased / stable — higher is not automatically better in poker.
          </p>
        </div>
      )}

      {/* ── Graph comparison ── */}
      {baseline?.graph_snapshot_data && current?.graph_snapshot_data && (
        <GraphComparison
          baselineGraph={baseline.graph_snapshot_data}
          currentGraph={current.graph_snapshot_data}
          baselineDate={baseline.captured_at}
        />
      )}

      {/* ── Sample size ── */}
      {baseline && current && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(212,165,44,0.10)', background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
            <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Hands Since Baseline</div>
            <div className="mt-1 text-lg font-bold text-white">{handsSinceStart.toLocaleString()}</div>
            <div className="text-[10px] text-white/40">new hands · {daysCoaching} days coaching</div>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(212,165,44,0.10)', background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
            <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Total Snapshots</div>
            <div className="mt-1 text-lg font-bold text-white">{snapshots.length}</div>
            <div className="text-[10px] text-white/40">{checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''} + 1 baseline</div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {snapshots.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
          <h3 className="mb-3 text-[11px] font-bold tracking-widest text-white/60 uppercase">Progress Timeline</h3>
          <div className="flex flex-col gap-2">
            {snapshots.map((snap, i) => {
              const snapImages = images.filter((img) => img.snapshot_id === snap.id);
              const isBaseline = snap.snapshot_type === 'baseline';
              const isCurrent = i === snapshots.length - 1;
              return (
                <div key={snap.id}>
                  <button
                    onClick={() => setSelectedSnapshot(snap.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${selectedSnapshot === snap.id ? 'border-[#d4a52c]/40 bg-[#c091e]/8' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: isBaseline ? GOLD : 'rgba(255,255,255,0.15)', background: isBaseline ? 'rgba(212,165,44,0.12)' : 'transparent' }}>
                      {isBaseline ? <Calendar className="h-3.5 w-3.5" style={{ color: GOLD }} /> : <CheckCircle2 className="h-3.5 w-3.5 text-white/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-white">{isBaseline ? 'Coaching Baseline' : `Month ${i} Update`}</span>
                        {isCurrent && <span className="rounded bg-[#c091e]/15 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-[#f5e6b0] uppercase">Latest</span>}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/40">
                        {new Date(snap.captured_at).toLocaleDateString()} · {(snap.total_hands || snap.analytics_snapshot.hands || 0).toLocaleString()} hands
                        {snapImages.length > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5"><Camera className="h-2.5 w-2.5" /> {snapImages.length}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                  </button>
                  {i < snapshots.length - 1 && <div className="ml-7 h-3 w-px bg-white/10" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected snapshot detail ── */}
      {selectedSnap && (
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold tracking-widest text-white/60 uppercase">
              {selectedSnap.snapshot_type === 'baseline' ? 'Baseline Details' : `Month ${snapshots.indexOf(selectedSnap)} Details`}
            </h3>
            <button onClick={() => setSelectedSnapshot(null)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(selectedSnap.analytics_snapshot).filter(([k]) => METRIC_LABELS[k]).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                <div className="text-[8px] font-semibold tracking-widest text-white/30 uppercase">{METRIC_LABELS[key]}</div>
                <div className="mt-0.5 text-[12px] font-bold text-white">{formatMetric(key, val as number)}</div>
              </div>
            ))}
          </div>

          {selectedSnap.graph_snapshot_data && (
            <div className="mt-3">
              <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">Captured Graph</div>
              <MiniGraph data={selectedSnap.graph_snapshot_data} />
            </div>
          )}

          {selectedImages.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">External Graph / Screenshot</div>
              <div className="flex flex-wrap gap-2">
                {selectedImages.map((img) => (
                  <button key={img.id} onClick={() => setViewerImage(img.image_url)} className="relative overflow-hidden rounded-lg border border-white/10">
                    <img src={img.image_url} alt="Progress graph" className="h-32 w-48 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedSnap.student_notes && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Student Notes</div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">{selectedSnap.student_notes}</p>
            </div>
          )}

          {selectedComments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {selectedComments.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wide uppercase" style={{ color: c.author_role === 'coach' ? GOLD : 'rgba(255,255,255,0.4)' }}>
                    {c.author_role === 'coach' ? 'Coach' : 'Student'}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/70">{c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showCheckpoint && profile && (
        <CheckpointModal
          profileId={profile.id}
          reminderDays={profile.reminder_interval_days}
          onClose={() => setShowCheckpoint(false)}
          onSaved={() => { setShowCheckpoint(false); void loadData(); }}
        />
      )}
      {showTargetModal && profile && (
        <TargetModal
          profileId={profile.id}
          coachId={coachId}
          onClose={() => setShowTargetModal(false)}
          onSaved={() => { setShowTargetModal(false); void loadData(); }}
        />
      )}
      {viewerImage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setViewerImage(null)}>
          <img src={viewerImage} alt="Progress graph" className="max-h-[85vh] max-w-[90vw] rounded-lg" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="h-6 w-6" /></button>
        </div>
      )}
    </div>
  );
}

// ── Graph comparison component ──
function GraphComparison({ baselineGraph, currentGraph, baselineDate }: {
  baselineGraph: { index: number; profit: number }[];
  currentGraph: { index: number; profit: number }[];
  baselineDate: string;
}) {
  // Merge both graphs, marking the coaching start point
  const baselineEnd = baselineGraph.length;
  const allPoints = [...baselineGraph, ...currentGraph];
  const w = 600, h = 160;
  const min = Math.min(...allPoints.map((p) => p.profit));
  const max = Math.max(...allPoints.map((p) => p.profit));
  const range = max - min || 1;

  const toX = (i: number) => (i / (allPoints.length - 1)) * w;
  const toY = (v: number) => h - ((v - min) / range) * h;

  const baselinePath = baselineGraph.map((p, i) => `${toX(i)},${toY(p.profit)}`).join(' ');
  const currentPath = currentGraph.map((p, i) => `${toX(baselineEnd + i)},${toY(p.profit)}`).join(' ');
  const markerX = toX(baselineEnd - 1);

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
      <h3 className="mb-3 text-[11px] font-bold tracking-widest text-white/60 uppercase">Graph Comparison</h3>
      <div className="relative overflow-x-auto">
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <polyline points={baselinePath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={currentPath} fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {/* Coaching start marker */}
          <line x1={markerX} y1={0} x2={markerX} y2={h} stroke={GOLD} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
          <circle cx={markerX} cy={10} r={3} fill={GOLD} />
        </svg>
        <div className="mt-2 flex items-center justify-center gap-4 text-[9px] text-white/40">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-white/35" /> Before Coaching</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: GOLD }} /> During Coaching</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-px" style={{ background: GOLD }} /> Coaching Start: {new Date(baselineDate).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Mini graph for snapshot detail ──
function MiniGraph({ data }: { data: { index: number; profit: number }[] }) {
  if (!data || data.length < 2) return <div className="text-[10px] text-white/30">No graph data captured.</div>;
  const w = 400, h = 80;
  const min = Math.min(...data.map((p) => p.profit));
  const max = Math.max(...data.map((p) => p.profit));
  const range = max - min || 1;
  const points = data.map((p, i) => `${(i / (data.length - 1)) * w},${h - ((p.profit - min) / range) * h}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Baseline setup ──
function BaselineSetup({ coachName, onCreated, coachId }: { coachName: string; onCreated: () => void; coachId?: string | null }) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reminderInterval, setReminderInterval] = useState(30);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    setCapturing(true);
    setError('');
    try {
      const { summary, graph } = await captureAnalytics();

      const nextUpdate = new Date();
      nextUpdate.setDate(nextUpdate.getDate() + reminderInterval);

      const { data: profileData, error: profileErr } = await supabase
        .from('coaching_progress_profiles')
        .insert({
          workspace_key: WORKSPACE,
          player_id: PLAYER_ID,
          coach_id: coachId ?? null,
          coaching_start_date: startDate,
          reminder_interval_days: reminderInterval,
          next_update_at: nextUpdate.toISOString(),
          status: 'active',
        })
        .select('id')
        .single();

      if (profileErr || !profileData) { setError('Could not create progress profile.'); setCapturing(false); return; }

      const { error: snapErr } = await supabase
        .from('coaching_progress_snapshots')
        .insert({
          profile_id: profileData.id,
          snapshot_type: 'baseline',
          total_hands: summary.hands ?? 0,
          total_games: summary.tournaments ?? summary.games ?? 0,
          analytics_snapshot: summary,
          graph_snapshot_data: graph,
          student_notes: notes,
        });

      if (snapErr) { setError('Baseline created but snapshot failed.'); setCapturing(false); return; }

      if (imageFile && imagePreview) {
        await uploadExternalImage(profileData.id, imageFile, imagePreview);
      }

      setCapturing(false);
      onCreated();
    } catch {
      setError('Something went wrong capturing baseline.');
      setCapturing(false);
    }
  };

  const uploadExternalImage = async (profileId: string, file: File, preview: string) => {
    setUploading(true);
    const { data: snapData } = await supabase
      .from('coaching_progress_snapshots')
      .select('id')
      .eq('profile_id', profileId)
      .eq('snapshot_type', 'baseline')
      .maybeSingle();
    if (!snapData) { setUploading(false); return; }

    const fileName = `progress/${profileId}/${snapData.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('user-uploads').upload(fileName, file);
    if (uploadErr) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(fileName);
    await supabase.from('coaching_progress_images').insert({
      snapshot_id: snapData.id,
      image_url: urlData.publicUrl,
      marker_position: 50,
      marker_type: 'estimated',
    });
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-full max-w-xl rounded-xl border p-5" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>
            <BarChart3 className="h-4 w-4" style={{ color: GOLD }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Create Coaching Baseline</h2>
            <p className="text-[10px] text-white/40">Capture your starting point so SpotVault can track changes throughout your coaching.</p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">Coaching Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none focus:border-[#d4a52c]/50"
            />
          </label>

          {/* Check-in cadence selector */}
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">How often would you like to check your progress?</span>
            <div className="flex gap-1.5">
              {[
                { label: '1 Month', days: 30 },
                { label: '2 Months', days: 60 },
                { label: '3 Months', days: 90 },
              ].map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setReminderInterval(opt.days)}
                  className={`flex-1 rounded-md border px-3 py-2 text-[10px] font-bold tracking-wide uppercase transition ${reminderInterval === opt.days ? 'border-[#d4a52c]/40 bg-[#c091e]/12 text-[#f5e6b0]' : 'border-white/10 bg-white/5 text-white/40 hover:text-white/60'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-white/30">Minimum 30 days between progress updates. Monthly cadence helps identify meaningful longer-term changes.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={capturing || uploading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/12 px-3 py-2.5 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 disabled:opacity-40"
            >
              <Activity className="h-3.5 w-3.5" /> {capturing ? 'Capturing...' : 'Capture SpotVault Analytics & Graph'}
            </button>
          </div>

          <div className="rounded-lg border border-dashed border-white/15 p-3">
            <div className="mb-2 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Upload External Graph / Screenshot (Optional)</div>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg border border-white/10" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white/60 hover:text-white"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-[10px] font-semibold text-white/50 uppercase hover:bg-white/10"
                >
                  <Upload className="h-3.5 w-3.5" /> Browse Files
                </button>
                <div className="mt-1.5 text-center text-[9px] text-white/25">For external trackers, other sites, or historical graphs</div>
              </>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">What do you want to improve? (Optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add context about where your game is now..."
              className="w-full resize-none rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/50"
            />
          </label>

          {error && <div className="flex items-center gap-2 text-[10px] text-red-300"><AlertCircle className="h-3.5 w-3.5" /> {error}</div>}

          <p className="text-center text-[9px] text-white/30">Your baseline is an immutable snapshot. It will not change as your analytics update.</p>
        </div>
      </div>
    </div>
  );
}

// ── Checkpoint modal ──
function CheckpointModal({ profileId, reminderDays, onClose, onSaved }: { profileId: string; reminderDays: number; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    setCapturing(true);
    setError('');
    try {
      const { summary, graph } = await captureAnalytics();

      const { data: snapData, error: snapErr } = await supabase
        .from('coaching_progress_snapshots')
        .insert({
          profile_id: profileId,
          snapshot_type: 'checkpoint',
          total_hands: summary.hands ?? 0,
          total_games: summary.tournaments ?? summary.games ?? 0,
          analytics_snapshot: summary,
          graph_snapshot_data: graph,
          student_notes: notes,
        })
        .select('id')
        .single();

      if (snapErr || !snapData) { setError('Could not create progress update.'); setCapturing(false); return; }

      // Update next_update_at on the profile
      const nextUpdate = new Date();
      nextUpdate.setDate(nextUpdate.getDate() + reminderDays);
      await supabase
        .from('coaching_progress_profiles')
        .update({ next_update_at: nextUpdate.toISOString() })
        .eq('id', profileId);

      if (imageFile && imagePreview) {
        const fileName = `progress/${profileId}/${snapData.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('user-uploads').upload(fileName, imageFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(fileName);
          await supabase.from('coaching_progress_images').insert({
            snapshot_id: snapData.id,
            image_url: urlData.publicUrl,
            marker_position: 50,
            marker_type: 'estimated',
          });
        }
      }

      setCapturing(false);
      onSaved();
    } catch {
      setError('Something went wrong.');
      setCapturing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">Update Progress</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <button
            onClick={handleCreate}
            disabled={capturing}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/12 py-2.5 text-[11px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 disabled:opacity-40"
          >
            <Activity className="h-4 w-4" /> {capturing ? 'Capturing...' : 'Capture SpotVault Analytics & Graph'}
          </button>

          <div className="rounded-lg border border-dashed border-white/15 p-3">
            <div className="mb-2 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Upload External Graph / Screenshot (Optional)</div>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg border border-white/10" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white/60 hover:text-white"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-[10px] font-semibold text-white/50 uppercase hover:bg-white/10">
                  <Upload className="h-3.5 w-3.5" /> Browse Files
                </button>
              </>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">Progress Notes (Optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What changed during this period? What have you been working on? What are you struggling with?"
              className="w-full resize-none rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/50"
            />
          </label>

          {error && <div className="flex items-center gap-2 text-[10px] text-red-300"><AlertCircle className="h-3.5 w-3.5" /> {error}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Target modal ──
function TargetModal({ profileId, coachId, onClose, onSaved }: { profileId: string; coachId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [metric, setMetric] = useState('three_bet');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [direction, setDirection] = useState('any');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const { error: insertErr } = await supabase.from('coaching_progress_targets').insert({
      profile_id: profileId,
      metric,
      target_min: minVal ? parseFloat(minVal) : null,
      target_max: maxVal ? parseFloat(maxVal) : null,
      target_direction: direction,
      coach_id: coachId ?? null,
    });
    setSaving(false);
    if (insertErr) { setError('Could not save target.'); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">Add Coach Target</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">Metric</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="w-full rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none focus:border-[#d4a52c]/50">
              {Object.entries(METRIC_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">Min</span>
              <input type="number" step="0.1" value={minVal} onChange={(e) => setMinVal(e.target.value)} placeholder="e.g. 8" className="w-full rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/50" />
            </label>
            <label className="flex-1">
              <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">Max</span>
              <input type="number" step="0.1" value={maxVal} onChange={(e) => setMaxVal(e.target.value)} placeholder="e.g. 10" className="w-full rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/50" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/45 uppercase">Direction</span>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-full rounded-md border border-white/10 bg-[#15181c] px-3 py-2.5 text-xs text-white outline-none focus:border-[#d4a52c]/50">
              <option value="any">Any</option>
              <option value="up">Trending Up</option>
              <option value="down">Trending Down</option>
            </select>
          </label>
          {error && <div className="flex items-center gap-2 text-[10px] text-red-300"><AlertCircle className="h-3.5 w-3.5" /> {error}</div>}
          <button onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 py-2.5 text-[11px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/30 disabled:opacity-40">
            <Target className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Target'}
          </button>
        </div>
      </div>
    </div>
  );
}
