import { useState, useMemo, Fragment, useEffect, useRef, useCallback } from 'react';
import { Eye, TrendingUp, TrendingDown, Minus, Info, Loader2, X, ChevronLeft, ChevronRight, Filter, Play, type LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { AnalyticsSnapshot, AnalyticsMode } from '@/lib/pokerAnalytics';
import { STAT_GUIDANCE, type StatGuidance } from '@/data/statGuidance';
import { SviTab } from '@/components/player/SviTab';
import { fetchHandsByStartingHand, fetchDistinctTournamentsForHandClass, fetchDistinctPositionsForHandClass, type StartingHandListItem } from '@/lib/pokerAnalytics';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface AbiTier { color: string; label: string; }
function abiTier(abi: number | null): AbiTier | null {
  if (abi == null || !Number.isFinite(abi) || abi <= 0) return null;
  if (abi < 5) return { color: '#9ca3af', label: 'Micro Stakes' };
  if (abi < 25) return { color: '#5aa7e8', label: 'Low Stakes' };
  if (abi < 50) return { color: '#35c6bd', label: 'Mid Stakes' };
  if (abi < 100) return { color: '#f2c14e', label: 'Upper Stakes' };
  if (abi < 250) return { color: '#f28a32', label: 'High Stakes' };
  if (abi < 500) return { color: '#ed5a29', label: 'Flame Stakes' };
  if (abi < 1000) return { color: '#f04432', label: 'Intense Stakes' };
  if (abi < 2500) return { color: '#fff1a8', label: 'White-Hot Stakes' };
  return { color: '#e8f4ff', label: 'White-Hot High Roller' };
}

// Translucent glass surfaces — let portal wallpaper show through
const SHELL_BG = 'rgba(6, 8, 10, 0.55)';
const SHELL_BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)';

// Single-open tooltip enforcement — only one stat tooltip can be open at a time
let activeTooltipClose: (() => void) | null = null;

// ── Heat Rating System for BB/100 ──
type HeatLevel = 'cold' | 'warm' | 'hot' | 'blazing' | 'molten' | 'unrated';

interface HeatConfig {
  label: string;
  color: string;
  segments: number; // 0-5 filled segments
}

const HEAT_CONFIG: Record<HeatLevel, HeatConfig> = {
  cold: { label: 'COLD', color: '#6b7e94', segments: 1 },
  warm: { label: 'WARM', color: '#c4a830', segments: 2 },
  hot: { label: 'HOT', color: '#e8822e', segments: 3 },
  blazing: { label: 'BLAZING', color: '#e8552e', segments: 4 },
  molten: { label: 'MOLTEN', color: '#e8302e', segments: 5 },
  unrated: { label: 'UNRATED', color: '#6b7280', segments: 0 },
};

function computeHeatLevel(bb100: number | null, hands: number, abi: number | null): HeatLevel {
  if (bb100 == null || !Number.isFinite(bb100)) return 'unrated';
  if (hands < 200) return 'unrated';
  // Provisional threshold: need at least 500 hands for a full rating
  const provisional = hands < 500;
  // Base rating on bb100, with buy-in consideration for MTT context
  // Higher buy-in doesn't automatically increase rating, but sustained
  // positive bb/100 at higher stakes is weighted more
  const buyInFactor = abi && abi > 100 ? 1.15 : abi && abi > 50 ? 1.05 : 1.0;
  const adjusted = bb100 * buyInFactor;
  if (provisional) return adjusted > 0 ? 'warm' : 'cold';
  if (adjusted >= 30) return 'molten';
  if (adjusted >= 15) return 'blazing';
  if (adjusted >= 5) return 'hot';
  if (adjusted >= 0) return 'warm';
  return 'cold';
}

function HeatIndicator({ level, bb100, hands }: { level: HeatLevel; bb100: number | null; hands: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const cfg = HEAT_CONFIG[level];

  const closeTooltip = useCallback(() => {
    setShowTooltip(false);
    if (activeTooltipClose === closeTooltip) activeTooltipClose = null;
  }, []);

  const openTooltip = useCallback(() => {
    if (activeTooltipClose && activeTooltipClose !== closeTooltip) activeTooltipClose();
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) {
      const w = 256;
      const left = Math.min(rect.right - w, window.innerWidth - w - 8);
      setTooltipPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setShowTooltip(true);
    activeTooltipClose = closeTooltip;
  }, [closeTooltip]);

  useEffect(() => {
    if (!showTooltip) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (tooltipRef.current?.contains(t) || iconRef.current?.contains(t)) return;
      closeTooltip();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTooltip(); };
    const onScroll = () => closeTooltip();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [showTooltip, closeTooltip]);

  useEffect(() => {
    return () => { if (activeTooltipClose === closeTooltip) activeTooltipClose = null; };
  }, [closeTooltip]);

  return (
    <div className="relative">
      <button
        ref={iconRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (showTooltip) closeTooltip(); else openTooltip(); }}
        className="flex items-center gap-1"
        title="Performance Heat Rating"
      >
        {/* Segmented heat bar */}
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-sm transition-all"
              style={{
                background: i < cfg.segments ? cfg.color : 'rgba(255,255,255,0.08)',
                boxShadow: i < cfg.segments && level !== 'unrated' ? `0 0 3px ${cfg.color}80` : 'none',
              }}
            />
          ))}
        </div>
        <span className="text-[7px] font-bold tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
      </button>
      {showTooltip && tooltipPos && createPortal(
        <div
          ref={tooltipRef}
          className="fixed w-64 rounded-lg border p-3.5 text-left"
          style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, zIndex: 9999, borderColor: SHELL_BORDER, background: 'rgba(6, 8, 10, 0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-bold tracking-wider uppercase" style={{ color: cfg.color }}>{cfg.label}</p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-white/80">
            Performance Heat Rating evaluates chip-based BB/100 in context of sample size and buy-in level.
          </p>
          <div className="mt-3 border-t border-white/[0.06] pt-2.5 space-y-1 text-[10px]">
            <div className="flex items-center justify-between"><span className="text-white/60">COLD</span><span className="font-mono text-white/70">&lt; 0 BB/100</span></div>
            <div className="flex items-center justify-between"><span className="text-white/60">WARM</span><span className="font-mono text-white/70">0-5 BB/100</span></div>
            <div className="flex items-center justify-between"><span className="text-white/60">HOT</span><span className="font-mono text-white/70">5-15 BB/100</span></div>
            <div className="flex items-center justify-between"><span className="text-white/60">BLAZING</span><span className="font-mono text-white/70">15-30 BB/100</span></div>
            <div className="flex items-center justify-between"><span className="text-white/60">MOLTEN</span><span className="font-mono text-white/70">30+ BB/100</span></div>
          </div>
          <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[9px] leading-relaxed text-white/60">
            Based on {hands.toLocaleString()} hands. BB/100 in tournaments measures chip win rate, not monetary ROI. Ratings above WARM require 500+ hands. Buy-in level provides a modest adjustment but does not guarantee a higher rating.
          </p>
          {level === 'unrated' && (
            <p className="mt-1.5 text-[9px] text-amber-400/70">Insufficient sample for a reliable rating. Import more hands to receive a heat classification.</p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeTooltip(); }}
            className="mt-3 w-full rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/50 transition-colors hover:text-white/70"
          >Close</button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Guidance status dot (green/gold/red/grey) ──
function guidanceStatusColor(value: number | null | undefined, guidance: StatGuidance | undefined, mode: AnalyticsMode): string {
  if (!guidance || value == null || !Number.isFinite(value)) return '#6b7280';
  const ranges = guidance.referenceRanges;
  if (!ranges || ranges.length === 0) return '#6b7280';
  // Find a range matching the current mode, fall back to 'all'
  const modeRanges = ranges.filter(r => r.context === mode || r.context === 'all');
  if (modeRanges.length === 0) return '#6b7280';
  // Use the first matching range to determine if in-range
  const firstRange = modeRanges[0];
  const nums = firstRange.range.match(/\d+\.?\d*/g);
  if (!nums || nums.length < 2) return '#6b7280';
  const lo = parseFloat(nums[0]);
  const hi = parseFloat(nums[1]);
  if (value >= lo && value <= hi) return '#4ade80';
  // Close to range = gold, far = red
  const dist = value < lo ? lo - value : value - hi;
  return dist <= 5 ? '#d4a52c' : '#f87171';
}

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  statKey?: string;
  trendDelta?: number | null;
  trendLabel?: string;
  trendAlwaysVisible?: boolean;
  heatLevel?: HeatLevel;
  heatHands?: number;
  mode?: AnalyticsMode;
  statValue?: number;
  bb100Guide?: boolean;
  onTrendClick?: (statKey: string, label: string, currentValue: number | null, prevValue: number | null, delta: number | null) => void;
}

export function StatCard({ label, value, sub, color, statKey, trendDelta, trendLabel, trendAlwaysVisible, heatLevel, heatHands, mode, statValue, bb100Guide, onTrendClick }: StatCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const guidance = statKey ? STAT_GUIDANCE[statKey] : undefined;
  const hasTrend = trendDelta != null || trendAlwaysVisible;
  const hasGuidance = !!guidance || !!heatLevel;

  const closeTooltip = useCallback(() => {
    setShowTooltip(false);
    if (activeTooltipClose === closeTooltip) activeTooltipClose = null;
  }, []);

  const openTooltip = useCallback(() => {
    if (activeTooltipClose && activeTooltipClose !== closeTooltip) activeTooltipClose();
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) {
      const w = 256;
      const left = Math.min(rect.right - w, window.innerWidth - w - 8);
      setTooltipPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setShowTooltip(true);
    activeTooltipClose = closeTooltip;
  }, [closeTooltip]);

  useEffect(() => {
    if (!showTooltip) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (tooltipRef.current?.contains(t) || iconRef.current?.contains(t)) return;
      closeTooltip();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTooltip(); };
    const onScroll = () => closeTooltip();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [showTooltip, closeTooltip]);

  useEffect(() => {
    return () => { if (activeTooltipClose === closeTooltip) activeTooltipClose = null; };
  }, [closeTooltip]);
  const statusColor = guidance && statValue != null && mode
    ? guidanceStatusColor(statValue, guidance, mode)
    : '#6b7280';

  const trendIcon = trendDelta == null || trendDelta === 0
    ? <Minus className="h-3 w-3 text-white/30" strokeWidth={2} />
    : trendDelta > 0
      ? <TrendingUp className="h-3 w-3" strokeWidth={2} style={{ color: '#4ade80' }} />
      : <TrendingDown className="h-3 w-3" strokeWidth={2} style={{ color: '#f87171' }} />;

  const trendText = trendDelta == null
    ? '— No baseline'
    : typeof trendDelta === 'number' && Math.abs(trendDelta) >= 100
      ? `${trendDelta > 0 ? '+' : ''}${Math.round(trendDelta)}`
      : `${trendDelta > 0 ? '+' : ''}${trendDelta.toFixed(1)} pp`;

  const showRightSection = hasTrend || hasGuidance;

  return (
    <div
      className="relative rounded-lg border px-1.5 py-1 backdrop-blur-md sm:px-3 sm:py-2"
      style={{ borderColor: SHELL_BORDER, background: SHELL_BG, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
    >
      {/* Mobile: vertical stack; Desktop: side-by-side grid */}
      <div
        className="flex flex-col gap-1 sm:grid sm:items-stretch"
        style={showRightSection ? { ['gridTemplateColumns' as string]: '65% 35%' } : undefined}
      >
        {/* LEFT SECTION — stat info */}
        <div className="flex min-w-0 flex-col justify-center pr-2">
          <div className="text-[7px] font-semibold tracking-widest text-white/45 uppercase sm:text-[9px]">{label}</div>
          <div className="mt-0.5 text-xs font-bold sm:text-[18px]" style={{ color: color ?? '#fff' }}>{value}</div>
          {sub && <div className="text-[6px] font-mono text-white/35 sm:text-[9px]">{sub}</div>}
        </div>

        {/* RIGHT SECTION — trend + guidance, horizontal on mobile, stacked on desktop */}
        {showRightSection && (
          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5 sm:grid"
            style={hasTrend && hasGuidance ? { ['gridTemplateRows' as string]: 'minmax(0,1fr) minmax(0,1fr)' } : undefined}
          >
            {/* Trend — clickable to open Import Impact Analysis */}
            {hasTrend && (
              <div
                className={`flex items-center justify-center gap-0.5 px-1 py-0.5 sm:border-b sm:border-[rgba(184,145,53,0.35)] ${onTrendClick && trendDelta != null ? 'cursor-pointer rounded transition-colors hover:bg-white/[0.06]' : ''}`}
                title={trendDelta == null ? 'No previous snapshot to compare against' : (trendLabel ?? 'Click for import impact analysis')}
                onClick={onTrendClick && statKey && trendDelta != null ? (e) => { e.stopPropagation(); onTrendClick(statKey, label, statValue ?? null, null, trendDelta); } : undefined}
              >
                {trendIcon}
                <span className="text-[7px] font-mono sm:text-[8px]" style={{ color: trendDelta == null ? 'rgba(255,255,255,0.25)' : trendDelta > 0 ? '#4ade80' : trendDelta < 0 ? '#f87171' : 'rgba(255,255,255,0.3)' }}>
                  {trendText}
                </span>
              </div>
            )}
            {/* Heat indicator OR guidance dot + info icon */}
            {hasGuidance && (
              <div className="flex items-center justify-center px-1 py-0.5">
                {heatLevel && (
                  <HeatIndicator level={heatLevel} bb100={statValue ?? null} hands={heatHands ?? 0} />
                )}
                {guidance && !heatLevel && (
                  <div className="flex items-center gap-1">
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}60` }}
                    />
                    <button
                      ref={iconRef}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (showTooltip) closeTooltip(); else openTooltip(); }}
                      className="text-white/30 transition-colors hover:text-white/60"
                      title={guidance.definition}
                    >
                      <Info className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* BB/100 compact reference guide — bottom-right */}
      {bb100Guide && mode && (
        <div className="pointer-events-none absolute bottom-0.5 right-1 hidden gap-1.5 sm:flex" title="BB/100 reference ranges">
          {(mode === 'cash'
            ? [
                { label: 'Acceptable', range: '-5 to +5', color: '#6b7e94' },
                { label: 'Good', range: '+2 to +8', color: '#c4a830' },
                { label: 'Great', range: '+8 to +15', color: '#e8822e' },
                { label: 'Elite', range: '+15+', color: '#4ade80' },
              ]
            : [
                { label: 'Acceptable', range: '0 to +5', color: '#6b7e94' },
                { label: 'Good', range: '+5 to +10', color: '#c4a830' },
                { label: 'Great', range: '+10 to +20', color: '#e8822e' },
                { label: 'Exceptional', range: '+20+', color: '#4ade80' },
              ]
          ).map((r) => (
            <div key={r.label} className="flex items-center gap-0.5">
              <div className="h-1 w-1 rounded-full" style={{ background: r.color }} />
              <span className="text-[6px] font-mono tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>{r.range}</span>
            </div>
          ))}
        </div>
      )}
      {/* Guidance tooltip */}
      {showTooltip && guidance && tooltipPos && createPortal(
        <div
          ref={tooltipRef}
          className="fixed w-64 rounded-lg border p-3.5 text-left"
          style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, zIndex: 9999, borderColor: SHELL_BORDER, background: 'rgba(6, 8, 10, 0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] leading-relaxed text-white/85">{guidance.definition}</p>
          {guidance.referenceRanges && guidance.referenceRanges.length > 0 && (
            <div className="mt-3 border-t border-white/[0.06] pt-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-widest text-white/60 uppercase">Reference Ranges</p>
                {mode && (
                  <span className="rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase" style={{ color: '#f5d660', background: 'rgba(212,165,44,0.1)' }}>
                    {mode === 'mtt' ? 'MTT' : 'Cash'}
                  </span>
                )}
              </div>
              {guidance.referenceRanges.map((r, i) => {
                const isCurrentMode = !mode || r.context === 'all' || r.context === mode;
                return (
                  <div key={i} className="mt-1 flex items-center justify-between text-[10px]" style={{ opacity: isCurrentMode ? 1 : 0.35 }}>
                    <span className="text-white/75">{r.label}</span>
                    <span className="font-mono font-bold" style={{ color: isCurrentMode ? '#f5d660' : 'rgba(245,214,96,0.35)' }}>{r.range}</span>
                  </div>
                );
              })}
            </div>
          )}
          {guidance.contextNotes && (
            <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[10px] leading-relaxed text-white/60">{guidance.contextNotes}</p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeTooltip(); }}
            className="mt-3 w-full rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/50 transition-colors hover:text-white/70"
          >
            Close
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

interface ComparisonBarProps {
  label: string;
  pct: number | null;
  count?: number | null;
  onClick?: () => void;
}

function ComparisonBar({ label, pct, count, onClick }: ComparisonBarProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/[0.03]"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <span className="w-24 text-[10px] text-white/55">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-white/[0.04]">
        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: GOLD }} />
      </div>
      <span className="w-20 text-right text-[10px] font-mono text-white/60">
        {pct != null ? `${pct.toFixed(1)}%` : '—'}
        {count != null && ` (${count})`}
      </span>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5">
      <span className="text-[10px] text-white/55">{label}</span>
      <span className="text-[11px] font-mono font-semibold" style={{ color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">{children}</h4>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-4 backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{children}</div>;
}

// Defensive formatting: never show undefined, never show 0.0% when data is missing
const fmt = (v: number | null | undefined, d = 1) => v == null ? '—' : Number(v).toFixed(d);
const fmtPct = (v: number | null | undefined, d = 1) => v == null ? '—' : `${Number(v).toFixed(d)}%`;
const fmtInt = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString();
const fmtRatio = (num: number | null | undefined, denom: number | null | undefined, pct: number | null | undefined) => {
  if (num == null || denom == null || denom === 0) return '—';
  const p = pct != null ? `${pct.toFixed(1)}%` : `${(num / denom * 100).toFixed(1)}%`;
  return `${num.toLocaleString()}/${denom.toLocaleString()} — ${p}`;
};
const resultColor = (v: number | null | undefined) => v == null ? '#6b7280' : v > 0 ? '#4ade80' : v < 0 ? '#f87171' : '#9ca3af';

export type TrendMap = Record<string, { delta: number | null; label: string }>;

export function computeTrends(snapshot: AnalyticsSnapshot): TrendMap {
  const prev = snapshot.previous_summary;
  if (!prev) return {};
  const curr = snapshot.summary;
  const result: TrendMap = {};
  const pctKeys = [
    'vpip', 'pfr', 'threeBet', 'foldTo3bet', 'fourBet', 'foldTo4bet', 'squeeze', 'steal', 'foldToSteal',
    'cbetFlop', 'barrelTurn', 'barrelRiver', 'wtsd', 'wsd', 'wwsf',
    'foldToFlopCbet', 'callFlopCbet', 'raiseFlopCbet', 'flopCbetSuccess', 'checkRaiseFlop', 'flopAggression',
    'flopDonkBet', 'flopDonkSuccess', 'foldToFlopDonk', 'callFlopDonk', 'raiseFlopDonk',
    'foldToTurnBarrel', 'callTurnBarrel', 'raiseTurnBarrel', 'turnBarrelSuccess', 'delayedCbet', 'turnCheckRaise', 'turnAggression', 'turnProbe',
    'turnDonkBet', 'turnDonkSuccess', 'foldToTurnDonk', 'callTurnDonk', 'raiseTurnDonk',
    'foldToRiverBarrel', 'callRiverBarrel', 'raiseRiverBarrel', 'riverAggression', 'riverBet', 'riverCheckRaise',
    'riverDonkBet', 'riverDonkSuccess', 'foldToRiverDonk', 'callRiverDonk', 'raiseRiverDonk',
  ];
  for (const key of pctKeys) {
    const c = curr[key];
    const p = prev[key];
    if (typeof c === 'number' && typeof p === 'number' && Number.isFinite(c) && Number.isFinite(p)) {
      result[key] = { delta: Math.round((c - p) * 10) / 10, label: `vs ${p.toFixed(1)}% (prev import)` };
    }
  }
  // Count-based trends
  const countKeys = ['hands', 'activeDays', 'vpipCount', 'pfrCount'];
  for (const key of countKeys) {
    const c = curr[key];
    const p = prev[key];
    if (typeof c === 'number' && typeof p === 'number' && Number.isFinite(c) && Number.isFinite(p)) {
      const diff = c - p;
      result[key] = { delta: diff, label: `${diff > 0 ? '+' : ''}${diff} since prev import` };
    }
  }
  // Non-percentage numeric trends (BB/100, BB Won, EV BB/100)
  const numericKeys = ['bb100', 'bbWon', 'evBb100', 'profit'];
  for (const key of numericKeys) {
    const c = curr[key];
    const p = prev[key];
    if (typeof c === 'number' && typeof p === 'number' && Number.isFinite(c) && Number.isFinite(p)) {
      const diff = Math.round((c - p) * 100) / 100;
      const suffix = key === 'bb100' ? ' BB/100' : key === 'bbWon' ? ' BB' : key === 'profit' ? ' chips' : '';
      result[key] = { delta: diff, label: `vs ${Number(p).toFixed(2)}${suffix} (prev import)` };
    }
  }
  return result;
}

export interface TabProps {
  snapshot: AnalyticsSnapshot;
  mode: AnalyticsMode;
  userId?: string;
  onJumpToAnalyzer?: (filters: Record<string, unknown>) => void;
  isDemo?: boolean;
  trends?: TrendMap;
}

function tr(trends: TrendMap | undefined, key: string, onTrendClick?: (statKey: string, label: string, currentValue: number | null, prevValue: number | null, delta: number | null) => void): { trendDelta?: number | null; trendLabel?: string; onTrendClick?: typeof onTrendClick } {
  if (!trends || !trends[key]) return onTrendClick ? { onTrendClick } : {};
  return { trendDelta: trends[key].delta, trendLabel: trends[key].label, onTrendClick };
}

// ── Shared Analytics SVI Summary (rendered above tab navigation in AnalyticsView) ──
export function AnalyticsSviSummary({ snapshot, mode, trends, street = 'all', onTrendClick }: {
  snapshot: AnalyticsSnapshot;
  mode: AnalyticsMode;
  trends?: TrendMap;
  street?: KeyStatsStreet;
  onTrendClick?: (statKey: string, label: string, currentValue: number | null, prevValue: number | null, delta: number | null) => void;
}) {
  const s = snapshot.summary;
  const f = snapshot.flop_analysis;
  const t = snapshot.turn_analysis;
  const r = snapshot.river_analysis;
  const abi = snapshot.tournament_analysis?.abi ?? null;
  const bb100Num = typeof s.bb100 === 'number' ? s.bb100 : null;
  const entries = snapshot.tournament_analysis?.tournamentEntries ?? s.tournamentEntries ?? 0;
  const events = snapshot.tournament_analysis?.tournamentEvents ?? s.tournamentEvents ?? 0;
  const reEntries = snapshot.tournament_analysis?.reEntries ?? (entries - events);

  if (street === 'preflop') {
    return (
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="VPIP" value={fmtPct(s.vpip)} sub={fmtRatio(s.vpipCount, s.hands, s.vpip)} statKey="vpip" {...tr(trends, 'vpip', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.vpip ?? undefined} />
        <StatCard label="PFR" value={fmtPct(s.pfr)} sub={fmtRatio(s.pfrCount, s.hands, s.pfr)} statKey="pfr" {...tr(trends, 'pfr', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.pfr ?? undefined} />
        <StatCard label="3-Bet" value={fmtPct(s.threeBet)} sub={fmtRatio(s.threeBetCount, s.threeBetOppCount, s.threeBet)} statKey="threeBet" {...tr(trends, 'threeBet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.threeBet ?? undefined} />
        <StatCard label="Fold to 3-Bet" value={fmtPct(s.foldTo3bet)} sub={fmtRatio(s.foldTo3betCount, s.foldTo3betOppCount, s.foldTo3bet)} statKey="foldTo3bet" {...tr(trends, 'foldTo3bet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.foldTo3bet ?? undefined} />
        <StatCard label="4-Bet" value={fmtPct(s.fourBet)} sub={fmtRatio(s.fourBetCount, s.fourBetOppCount, s.fourBet)} statKey="fourBet" {...tr(trends, 'fourBet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.fourBet ?? undefined} />
        <StatCard label="Fold to 4-Bet" value={fmtPct(s.foldTo4bet)} sub={fmtRatio(s.foldTo4betCount, s.foldTo4betOppCount, s.foldTo4bet)} statKey="foldTo4bet" {...tr(trends, 'foldTo4bet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.foldTo4bet ?? undefined} />
        <StatCard label="Squeeze" value={fmtPct(s.squeeze)} sub={fmtRatio(s.squeezeCount, s.squeezeOppCount, s.squeeze)} statKey="squeeze" {...tr(trends, 'squeeze', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.squeeze ?? undefined} />
        <StatCard label="Steal" value={fmtPct(s.steal)} sub={fmtRatio(s.stealCount, s.stealOppCount, s.steal)} statKey="steal" {...tr(trends, 'steal', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.steal ?? undefined} />
        <StatCard label="Fold to Steal" value={fmtPct(s.foldToSteal)} sub={fmtRatio(s.foldToStealCount, s.foldToStealOppCount, s.foldToSteal)} statKey="foldToSteal" {...tr(trends, 'foldToSteal', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.foldToSteal ?? undefined} />
        <StatCard label="Limp" value={fmtPct(s.limp)} sub={fmtRatio(s.limpCount, s.limpOppCount, s.limp)} />
        <StatCard label="Limp Fold" value={fmtPct(s.limpFold)} sub={fmtRatio(s.limpFoldCount, s.limpFoldOppCount, s.limpFold)} />
        <StatCard label="Hands" value={fmtInt(s.hands)} />
      </div>
    );
  }

  if (street === 'flop') {
    return (
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Flops Seen" value={fmtInt(f.sawFlopCount)} sub={f.sawFlopCount != null ? `${((f.sawFlopCount / (snapshot.source_hand_count || 1)) * 100).toFixed(1)}%` : '—'} />
        <StatCard label="Flop C-Bet" value={fmtPct(f.cbetFlop)} sub={fmtRatio(f.cbetFlopCount, f.cbetFlopOppCount, f.cbetFlop)} statKey="cbetFlop" {...tr(trends, 'cbetFlop', onTrendClick)} trendAlwaysVisible mode={mode} statValue={f.cbetFlop ?? undefined} />
        <StatCard label="C-Bet Success" value={fmtPct(f.flopCbetSuccess)} sub={fmtRatio(f.flopCbetSuccessCount, f.flopCbetSuccessOppCount, f.flopCbetSuccess)} statKey="flopCbetSuccess" {...tr(trends, 'flopCbetSuccess', onTrendClick)} trendAlwaysVisible mode={mode} statValue={f.flopCbetSuccess ?? undefined} />
        <StatCard label="Fold vs C-Bet" value={fmtPct(f.foldToFlopCbet)} sub={fmtRatio(f.foldToFlopCbetCount, f.foldToFlopCbetOppCount, f.foldToFlopCbet)} statKey="foldToFlopCbet" {...tr(trends, 'foldToFlopCbet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={f.foldToFlopCbet ?? undefined} />
        <StatCard label="WWSF" value={fmtPct(s.wwsf)} sub={fmtRatio(s.wwsfCount, f.sawFlopCount, s.wwsf)} statKey="wwsf" {...tr(trends, 'wwsf', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.wwsf ?? undefined} />
        <StatCard label="Check-Raise" value={fmtPct(f.checkRaiseFlop)} sub={fmtRatio(f.checkRaiseFlopCount, f.checkRaiseFlopOppCount, f.checkRaiseFlop)} statKey="checkRaiseFlop" {...tr(trends, 'checkRaiseFlop', onTrendClick)} trendAlwaysVisible mode={mode} statValue={f.checkRaiseFlop ?? undefined} />
        <StatCard label="Flop Aggression" value={fmtPct(f.flopAggression)} sub={fmtRatio(f.flopAggressionCount, f.flopAggressionOppCount, f.flopAggression)} statKey="flopAggression" {...tr(trends, 'flopAggression', onTrendClick)} trendAlwaysVisible mode={mode} statValue={f.flopAggression ?? undefined} />
        <StatCard label="Donk Bet" value={fmtPct(f.flopDonkBet)} sub={fmtRatio(f.flopDonkBetCount, f.flopDonkBetOppCount, f.flopDonkBet)} statKey="flopDonkBet" {...tr(trends, 'flopDonkBet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={f.flopDonkBet ?? undefined} />
      </div>
    );
  }

  if (street === 'turn') {
    return (
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Turns Seen" value={fmtInt(t.sawTurnCount)} sub={t.sawTurnCount != null ? `${((t.sawTurnCount / (snapshot.source_hand_count || 1)) * 100).toFixed(1)}%` : '—'} />
        <StatCard label="Turn Barrel" value={fmtPct(t.barrelTurn)} sub={fmtRatio(t.barrelTurnCount, t.barrelTurnOppCount, t.barrelTurn)} statKey="barrelTurn" {...tr(trends, 'barrelTurn', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.barrelTurn ?? undefined} />
        <StatCard label="Barrel Success" value={fmtPct(t.turnBarrelSuccess)} sub={fmtRatio(t.turnBarrelSuccessCount, t.turnBarrelSuccessOppCount, t.turnBarrelSuccess)} statKey="turnBarrelSuccess" {...tr(trends, 'turnBarrelSuccess', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.turnBarrelSuccess ?? undefined} />
        <StatCard label="Fold to Barrel" value={fmtPct(t.foldToTurnBarrel)} sub={fmtRatio(t.foldToTurnBarrelCount, t.foldToTurnBarrelOppCount, t.foldToTurnBarrel)} statKey="foldToTurnBarrel" {...tr(trends, 'foldToTurnBarrel', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.foldToTurnBarrel ?? undefined} />
        <StatCard label="Delayed C-Bet" value={fmtPct(t.delayedCbet)} sub={fmtRatio(t.delayedCbetCount, t.delayedCbetOppCount, t.delayedCbet)} statKey="delayedCbet" {...tr(trends, 'delayedCbet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.delayedCbet ?? undefined} />
        <StatCard label="Turn Check-Raise" value={fmtPct(t.turnCheckRaise)} sub={fmtRatio(t.turnCheckRaiseCount, t.turnCheckRaiseOppCount, t.turnCheckRaise)} statKey="turnCheckRaise" {...tr(trends, 'turnCheckRaise', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.turnCheckRaise ?? undefined} />
        <StatCard label="Turn Probe" value={fmtPct(t.turnProbe)} sub={fmtRatio(t.turnProbeCount, t.turnProbeOppCount, t.turnProbe)} statKey="turnProbe" {...tr(trends, 'turnProbe', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.turnProbe ?? undefined} />
        <StatCard label="Turn Aggression" value={fmtPct(t.turnAggression)} sub={fmtRatio(t.turnAggressionCount, t.turnAggressionOppCount, t.turnAggression)} statKey="turnAggression" {...tr(trends, 'turnAggression', onTrendClick)} trendAlwaysVisible mode={mode} statValue={t.turnAggression ?? undefined} />
      </div>
    );
  }

  if (street === 'river') {
    return (
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Rivers Seen" value={fmtInt(r.sawRiverCount)} sub={r.sawRiverCount != null ? `${((r.sawRiverCount / (snapshot.source_hand_count || 1)) * 100).toFixed(1)}%` : '—'} />
        <StatCard label="River Barrel" value={fmtPct(r.barrelRiver)} sub={fmtRatio(r.barrelRiverCount, r.barrelRiverOppCount, r.barrelRiver)} statKey="barrelRiver" {...tr(trends, 'barrelRiver', onTrendClick)} trendAlwaysVisible mode={mode} statValue={r.barrelRiver ?? undefined} />
        <StatCard label="River Bet" value={fmtPct(r.riverBet)} sub={fmtRatio(r.riverBetCount, r.riverBetOppCount, r.riverBet)} statKey="riverBet" {...tr(trends, 'riverBet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={r.riverBet ?? undefined} />
        <StatCard label="Fold to River Bet" value={fmtPct(r.foldToRiverBarrel)} sub={fmtRatio(r.foldToRiverBarrelCount, r.foldToRiverBarrelOppCount, r.foldToRiverBarrel)} statKey="foldToRiverBarrel" {...tr(trends, 'foldToRiverBarrel', onTrendClick)} trendAlwaysVisible mode={mode} statValue={r.foldToRiverBarrel ?? undefined} />
        <StatCard label="W$SD" value={fmtPct(r.wsd)} sub={fmtRatio(r.wsdCount, r.showdownCount, r.wsd)} statKey="wsd" {...tr(trends, 'wsd', onTrendClick)} trendAlwaysVisible mode={mode} statValue={r.wsd ?? undefined} />
        <StatCard label="River Check-Raise" value={fmtPct(r.riverCheckRaise)} sub={fmtRatio(r.riverCheckRaiseCount, r.riverCheckRaiseOppCount, r.riverCheckRaise)} statKey="riverCheckRaise" {...tr(trends, 'riverCheckRaise', onTrendClick)} trendAlwaysVisible mode={mode} statValue={r.riverCheckRaise ?? undefined} />
        <StatCard label="River Aggression" value={fmtPct(r.riverAggression)} sub={fmtRatio(r.riverAggressionCount, r.riverAggressionOppCount, r.riverAggression)} statKey="riverAggression" {...tr(trends, 'riverAggression', onTrendClick)} trendAlwaysVisible mode={mode} statValue={r.riverAggression ?? undefined} />
        <StatCard label="Showdowns" value={fmtInt(r.showdownCount)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
      {/* Row 1 — Performance: Hands | BB/100 | BB Won */}
      <StatCard label="Hands" value={fmtInt(s.hands)} />
      <StatCard
        label="BB/100"
        value={fmt(s.bb100, 2)}
        color="#fff"
        statKey="bb100"
        trendDelta={trends?.bb100?.delta ?? null}
        trendLabel={trends?.bb100?.label}
        trendAlwaysVisible
        mode={mode}
        statValue={bb100Num ?? undefined}
        bb100Guide
        onTrendClick={onTrendClick}
      />
      <StatCard label="BB Won" value={fmt(s.bbWon)} />

      {/* Row 2 — Tournament Activity: Events | Total Entries | Avg Buy-In | Re-Entries */}
      <StatCard label="Events" value={fmtInt(events)} />
      <StatCard label="Total Entries" value={fmtInt(entries)} {...tr(trends, 'hands', onTrendClick)} trendAlwaysVisible />
      <StatCard
        label="Avg Buy-In"
        value={abi != null ? `${abi.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
        sub={abiTier(abi)?.label}
        color="#fff"
        statKey="abi"
      />
      <StatCard label="Re-Entries" value={fmtInt(reEntries)} statKey="reEntries" {...tr(trends, 'reEntries', onTrendClick)} trendAlwaysVisible />

      {/* Row 3 — Preflop: VPIP | PFR | 3-Bet | Active Days */}
      <StatCard label="VPIP" value={fmtPct(s.vpip)} sub={s.vpipCount != null ? `${s.vpipCount}/${s.hands}` : undefined} statKey="vpip" {...tr(trends, 'vpip', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.vpip ?? undefined} />
      <StatCard label="PFR" value={fmtPct(s.pfr)} sub={s.pfrCount != null ? `${s.pfrCount}/${s.hands}` : undefined} statKey="pfr" {...tr(trends, 'pfr', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.pfr ?? undefined} />
      <StatCard label="3-Bet" value={fmtPct(s.threeBet)} sub={fmtRatio(s.threeBetCount, s.threeBetOppCount, s.threeBet)} statKey="threeBet" {...tr(trends, 'threeBet', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.threeBet ?? undefined} />
      <StatCard label="Active Days" value={fmtInt(s.activeDays)} {...tr(trends, 'activeDays', onTrendClick)} trendAlwaysVisible />

      {/* Row 4 — Postflop: Flop C-Bet | Turn Barrel | River Barrel | WTSD */}
      <StatCard label="Flop C-Bet" value={fmtPct(s.cbetFlop)} sub={fmtRatio(s.cbetFlopCount, s.cbetFlopOppCount, s.cbetFlop)} statKey="cbetFlop" {...tr(trends, 'cbetFlop', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.cbetFlop ?? undefined} />
      <StatCard label="Turn Barrel" value={fmtPct(s.barrelTurn)} sub={fmtRatio(s.barrelTurnCount, s.barrelTurnOppCount, s.barrelTurn)} statKey="barrelTurn" {...tr(trends, 'barrelTurn', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.barrelTurn ?? undefined} />
      <StatCard label="River Barrel" value={fmtPct(s.barrelRiver)} sub={fmtRatio(s.barrelRiverCount, s.barrelRiverOppCount, s.barrelRiver)} statKey="barrelRiver" {...tr(trends, 'barrelRiver', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.barrelRiver ?? undefined} />
      <StatCard label="WTSD" value={fmtPct(s.wtsd)} sub={fmtRatio(s.wtsdCount, s.sawFlopCount, s.wtsd)} statKey="wtsd" {...tr(trends, 'wtsd', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.wtsd ?? undefined} />

      {/* Row 5 — Outcomes: W$SD | WWSF | Biggest Win | Biggest Loss */}
      <StatCard label="W$SD" value={fmtPct(s.wsd)} sub={fmtRatio(s.wsdCount, s.showdownCount, s.wsd)} statKey="wsd" {...tr(trends, 'wsd', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.wsd ?? undefined} />
      <StatCard label="WWSF" value={fmtPct(s.wwsf)} sub={fmtRatio(s.wwsfCount, s.sawFlopCount, s.wwsf)} statKey="wwsf" {...tr(trends, 'wwsf', onTrendClick)} trendAlwaysVisible mode={mode} statValue={s.wwsf ?? undefined} />
      <StatCard label="Biggest Win" value={s.biggestWin != null ? `+${fmt(s.biggestWin)} BB` : '—'} color="#ffffff" />
      <StatCard label="Biggest Loss" value={s.biggestLoss != null ? `${fmt(s.biggestLoss)} BB` : '—'} color="#ffffff" />

    </div>
  );
}

// =============== KEY STATISTICS BAR ===============
export type KeyStatsStreet = 'all' | 'preflop' | 'flop' | 'turn' | 'river';

const KEY_STATS_TABS: { id: KeyStatsStreet; label: string }[] = [
  { id: 'all', label: 'All Stats' },
  { id: 'preflop', label: 'Preflop' },
  { id: 'flop', label: 'Flop' },
  { id: 'turn', label: 'Turn' },
  { id: 'river', label: 'River' },
];

export function KeyStatsBar({ street, onStreetChange }: {
  street: KeyStatsStreet;
  onStreetChange: (s: KeyStatsStreet) => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-1 overflow-x-auto rounded-lg border p-2 backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG, scrollbarWidth: 'thin' }}>
      {KEY_STATS_TABS.map(tab => (
        <button key={tab.id} onClick={() => onStreetChange(tab.id)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${street === tab.id ? 'bg-[#c0911e]/20 text-[#f5e6b0] shadow-sm' : 'text-white/50 hover:text-white/75'}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// =============== OVERVIEW ===============
export function OverviewTab({ snapshot, mode, userId, onJumpToAnalyzer, isDemo, trends }: TabProps) {
  const s = snapshot.summary;

  return (
    <div className="space-y-3">
      <div className="mt-6">
        <SviTab userId={isDemo ? undefined : userId} />
      </div>
    </div>
  );
}

// =============== HEADLINE METRICS (top summary grid) ===============
export function HeadlineMetrics({ snapshot, mode, trends }: { snapshot: AnalyticsSnapshot; mode: AnalyticsMode; trends?: TrendMap }) {
  const s = snapshot.summary;
  const hasAction = s.vpipCount !== undefined && s.vpipCount > 0;
  const abi = snapshot.tournament_analysis?.abi ?? null;
  const entries = snapshot.tournament_analysis?.tournamentEntries ?? s.tournamentEntries ?? 0;
  const events = snapshot.tournament_analysis?.tournamentEvents ?? s.tournamentEvents ?? 0;
  const reEntries = snapshot.tournament_analysis?.reEntries ?? (entries - events);
  const bb100Num = typeof s.bb100 === 'number' ? s.bb100 : null;
  const avgBuyIn = abi != null && Number.isFinite(abi) && abi > 0
    ? `${abi.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—';

  return (
    <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
      {/* HANDS — clean, no trend indicators */}
      <StatCard label="Hands" value={fmtInt(s.hands)} />

      {/* BB WON — clean, no trend indicators */}
      <StatCard label="BB Won" value={fmt(s.bbWon)} />

      {/* BB/100 — with reference guide */}
      <StatCard
        label="BB/100"
        value={fmt(s.bb100, 2)}
        color="#fff"
        statKey="bb100"
        trendDelta={trends?.bb100?.delta ?? null}
        trendLabel={trends?.bb100?.label}
        trendAlwaysVisible
        mode={mode}
        statValue={bb100Num ?? undefined}
        bb100Guide
      />

      {/* AVG BUY-IN — ABI color classification */}
      <StatCard
        label="Avg Buy-In"
        value={avgBuyIn}
        sub={abiTier(abi)?.label}
        color="#fff"
        statKey="abi"
      />

      {/* VPIP, PFR, 3-Bet */}
      <StatCard label="VPIP" value={fmtPct(s.vpip)} sub={s.vpipCount != null ? `${s.vpipCount}/${s.hands}` : undefined} statKey="vpip" {...tr(trends, 'vpip')} trendAlwaysVisible mode={mode} statValue={s.vpip ?? undefined} />
      <StatCard label="PFR" value={fmtPct(s.pfr)} sub={s.pfrCount != null ? `${s.pfrCount}/${s.hands}` : undefined} statKey="pfr" {...tr(trends, 'pfr')} trendAlwaysVisible mode={mode} statValue={s.pfr ?? undefined} />
      <StatCard label="3-Bet" value={fmtPct(s.threeBet)} sub={fmtRatio(s.threeBetCount, s.threeBetOppCount, s.threeBet)} statKey="threeBet" {...tr(trends, 'threeBet')} trendAlwaysVisible mode={mode} statValue={s.threeBet ?? undefined} />

      {/* Mode-specific tournament/cash cards */}
      {mode === 'mtt' ? (
        <>
          <StatCard label="Total Entries" value={fmtInt(entries)} {...tr(trends, 'hands')} trendAlwaysVisible />
          <StatCard label="Events" value={fmtInt(events)} />
          <StatCard label="Re-Entries" value={fmtInt(reEntries)} />
        </>
      ) : (
        <>
          <StatCard label="Profit" value={s.profit != null ? `${fmt(s.profit)}` : '—'} color={resultColor(s.profit)} />
          <StatCard label="Active Days" value={fmtInt(s.activeDays)} {...tr(trends, 'activeDays')} trendAlwaysVisible />
        </>
      )}

      {/* WTSD, W$SD, WWSF */}
      <StatCard label="WTSD" value={fmtPct(s.wtsd)} sub={fmtRatio(s.wtsdCount, s.sawFlopCount, s.wtsd)} statKey="wtsd" {...tr(trends, 'wtsd')} trendAlwaysVisible mode={mode} statValue={s.wtsd ?? undefined} />
      <StatCard label="W$SD" value={fmtPct(s.wsd)} sub={fmtRatio(s.wsdCount, s.showdownCount, s.wsd)} statKey="wsd" {...tr(trends, 'wsd')} trendAlwaysVisible mode={mode} statValue={s.wsd ?? undefined} />
      <StatCard label="WWSF" value={fmtPct(s.wwsf)} sub={fmtRatio(s.wwsfCount, s.sawFlopCount, s.wwsf)} statKey="wwsf" {...tr(trends, 'wwsf')} trendAlwaysVisible mode={mode} statValue={s.wwsf ?? undefined} />
    </div>
  );
}

// =============== PREFLOP ===============
export function PreflopTab({ snapshot, onJumpToAnalyzer, trends }: TabProps) {
  const s = snapshot.summary;
  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle>Preflop Aggression</SectionTitle>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="VPIP" value={fmtPct(s.vpip)} sub={fmtRatio(s.vpipCount, s.hands, s.vpip)} statKey="vpip" {...tr(trends, 'vpip')} />
          <StatCard label="PFR" value={fmtPct(s.pfr)} sub={fmtRatio(s.pfrCount, s.hands, s.pfr)} statKey="pfr" {...tr(trends, 'pfr')} />
          <StatCard label="3-Bet" value={fmtPct(s.threeBet)} sub={fmtRatio(s.threeBetCount, s.threeBetOppCount, s.threeBet)} statKey="threeBet" {...tr(trends, 'threeBet')} />
          <StatCard label="Fold to 3-Bet" value={fmtPct(s.foldTo3bet)} sub={fmtRatio(s.foldTo3betCount, s.foldTo3betOppCount, s.foldTo3bet)} statKey="foldTo3bet" {...tr(trends, 'foldTo3bet')} />
          <StatCard label="4-Bet" value={fmtPct(s.fourBet)} sub={fmtRatio(s.fourBetCount, s.fourBetOppCount, s.fourBet)} statKey="fourBet" {...tr(trends, 'fourBet')} />
          <StatCard label="Fold to 4-Bet" value={fmtPct(s.foldTo4bet)} sub={fmtRatio(s.foldTo4betCount, s.foldTo4betOppCount, s.foldTo4bet)} statKey="foldTo4bet" {...tr(trends, 'foldTo4bet')} />
          <StatCard label="Squeeze" value={fmtPct(s.squeeze)} sub={fmtRatio(s.squeezeCount, s.squeezeOppCount, s.squeeze)} statKey="squeeze" {...tr(trends, 'squeeze')} />
          <StatCard label="Steal" value={fmtPct(s.steal)} sub={fmtRatio(s.stealCount, s.stealOppCount, s.steal)} statKey="steal" {...tr(trends, 'steal')} />
        </div>
      </Panel>
      <Panel>
        <SectionTitle>Limping & Defense</SectionTitle>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Limp" value={fmtPct(s.limp)} sub={fmtRatio(s.limpCount, s.limpOppCount, s.limp)} />
          <StatCard label="Limp Fold" value={fmtPct(s.limpFold)} sub={fmtRatio(s.limpFoldCount, s.limpFoldOppCount, s.limpFold)} />
          <StatCard label="Fold to Steal" value={fmtPct(s.foldToSteal)} sub={fmtRatio(s.foldToStealCount, s.foldToStealOppCount, s.foldToSteal)} statKey="foldToSteal" />
          <StatCard label="Preflop All-In" value="N/A" sub="See Hand Analyzer" />
        </div>
      </Panel>
      <Panel>
        <SectionTitle>Pot Type Frequency</SectionTitle>
        <PotTypeBreakdown snapshot={snapshot} onJumpToAnalyzer={onJumpToAnalyzer} />
      </Panel>
    </div>
  );
}

function PotTypeBreakdown({ snapshot, onJumpToAnalyzer }: { snapshot: AnalyticsSnapshot; onJumpToAnalyzer?: (f: Record<string, unknown>) => void }) {
  const total = snapshot.source_hand_count || 1;
  const types = [
    { label: 'Unopened', key: 'unopened', filter: { potType: 'unopened' } },
    { label: 'Limped', key: 'limped', filter: { potType: 'limped' } },
    { label: 'Single-Raised', key: 'srp', filter: { potType: 'srp' } },
    { label: '3-Bet', key: '3bet', filter: { potType: '3bet' } },
    { label: '4-Bet+', key: '4bet_plus', filter: { potType: '4bet_plus' } },
  ];
  return (
    <div className="space-y-1.5">
      {types.map(t => {
        const pct = ((snapshot.summary as Record<string, number>)[t.key] ?? 0);
        const count = ((snapshot.summary as Record<string, number>)[`${t.key}Count`] ?? 0);
        return (
          <div key={t.key}
            className="flex items-center gap-3 rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/[0.03]"
            style={{ cursor: onJumpToAnalyzer ? 'pointer' : 'default' }}
            onClick={() => onJumpToAnalyzer?.(t.filter)}
          >
            <span className="w-24 text-[10px] text-white/55">{t.label}</span>
            <div className="h-2 flex-1 rounded-full bg-white/[0.04]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: GOLD }} />
            </div>
            <span className="w-16 text-right text-[10px] font-mono text-white/60">{pct.toFixed(1)}% ({count})</span>
          </div>
        );
      })}
    </div>
  );
}

// =============== FLOP ===============
export function FlopTab({ snapshot, onJumpToAnalyzer, trends }: TabProps) {
  const f = snapshot.flop_analysis;
  const s = snapshot.summary;
  const total = snapshot.source_hand_count || 1;
  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle>Flop Overview</SectionTitle>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Flops Seen" value={fmtInt(f.sawFlopCount)} sub={f.sawFlopCount != null ? `${((f.sawFlopCount / total) * 100).toFixed(1)}%` : '—'} />
          <StatCard label="Flop C-Bet %" value={fmtPct(f.cbetFlop)} sub={fmtRatio(f.cbetFlopCount, f.cbetFlopOppCount, f.cbetFlop)} statKey="cbetFlop" {...tr(trends, 'cbetFlop')} />
          <StatCard label="C-Bet Success" value={fmtPct(f.flopCbetSuccess)} sub={fmtRatio(f.flopCbetSuccessCount, f.flopCbetSuccessOppCount, f.flopCbetSuccess)} statKey="flopCbetSuccess" {...tr(trends, 'flopCbetSuccess')} />
          <StatCard label="Fold vs C-Bet" value={fmtPct(f.foldToFlopCbet)} sub={fmtRatio(f.foldToFlopCbetCount, f.foldToFlopCbetOppCount, f.foldToFlopCbet)} statKey="foldToFlopCbet" {...tr(trends, 'foldToFlopCbet')} />
          <StatCard label="Call vs C-Bet" value={fmtPct(f.callFlopCbet)} sub={fmtRatio(f.callFlopCbetCount, f.callFlopCbetOppCount, f.callFlopCbet)} {...tr(trends, 'callFlopCbet')} />
          <StatCard label="Raise vs C-Bet" value={fmtPct(f.raiseFlopCbet)} sub={fmtRatio(f.raiseFlopCbetCount, f.raiseFlopCbetOppCount, f.raiseFlopCbet)} {...tr(trends, 'raiseFlopCbet')} />
          <StatCard label="Check-Raise %" value={fmtPct(f.checkRaiseFlop)} sub={fmtRatio(f.checkRaiseFlopCount, f.checkRaiseFlopOppCount, f.checkRaiseFlop)} statKey="checkRaiseFlop" {...tr(trends, 'checkRaiseFlop')} />
          <StatCard label="Bet When Checked To" value={fmtPct(f.betWhenCheckedTo)} sub={fmtRatio(f.betWhenCheckedToCount, f.betWhenCheckedToOppCount, f.betWhenCheckedTo)} />
          <StatCard label="Flop Aggression" value={fmtPct(f.flopAggression)} sub={fmtRatio(f.flopAggressionCount, f.flopAggressionOppCount, f.flopAggression)} statKey="flopAggression" {...tr(trends, 'flopAggression')} />
          <StatCard label="Donk Bet" value={fmtPct(f.flopDonkBet)} sub={fmtRatio(f.flopDonkBetCount, f.flopDonkBetOppCount, f.flopDonkBet)} statKey="flopDonkBet" {...tr(trends, 'flopDonkBet')} />
          <StatCard label="Donk Success" value={fmtPct(f.flopDonkSuccess)} sub={fmtRatio(f.flopDonkSuccessCount, f.flopDonkSuccessOppCount, f.flopDonkSuccess)} statKey="flopDonkSuccess" {...tr(trends, 'flopDonkSuccess')} />
          <StatCard label="Fold vs Donk" value={fmtPct(f.foldToFlopDonk)} sub={fmtRatio(f.foldToFlopDonkCount, f.foldToFlopDonkOppCount, f.foldToFlopDonk)} statKey="foldToFlopDonk" {...tr(trends, 'foldToFlopDonk')} />
          <StatCard label="Call vs Donk" value={fmtPct(f.callFlopDonk)} sub={fmtRatio(f.callFlopDonkCount, f.callFlopDonkOppCount, f.callFlopDonk)} statKey="callFlopDonk" {...tr(trends, 'callFlopDonk')} />
          <StatCard label="Raise vs Donk" value={fmtPct(f.raiseFlopDonk)} sub={fmtRatio(f.raiseFlopDonkCount, f.raiseFlopDonkOppCount, f.raiseFlopDonk)} statKey="raiseFlopDonk" {...tr(trends, 'raiseFlopDonk')} />
          <StatCard label="WWSF" value={fmtPct(s.wwsf)} sub={fmtRatio(s.wwsfCount, f.sawFlopCount, s.wwsf)} statKey="wwsf" {...tr(trends, 'wwsf')} />
        </div>
      </Panel>
      {/* C-Bet diagnostic breakdown */}
      {f.cbetDiagSawFlop != null && (
        <Panel>
          <SectionTitle>C-Bet Opportunity Breakdown</SectionTitle>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Saw Flop" value={fmtInt(f.cbetDiagSawFlop)} />
            <StatCard label="Aggressor + Saw Flop" value={fmtInt(f.cbetDiagAggressorSawFlop)} sub="Includes donk-bet excluded" />
            <StatCard label="Donk-Bet Excluded" value={fmtInt(f.cbetDiagDonkExcluded)} sub="Opp bet first" />
            <StatCard label="Legit Opportunities" value={fmtInt(f.cbetDiagOpp)} sub="After donk exclusion" />
          </div>
        </Panel>
      )}
      <Panel>
        <SectionTitle>Flop C-Bet by Pot Type</SectionTitle>
        <div className="space-y-1.5">
          {[
            { label: 'SRP', key: 'cbet_srp', filter: { potType: 'srp', street: 'flop' } },
            { label: '3-Bet Pot', key: 'cbet_3bet', filter: { potType: '3bet', street: 'flop' } },
            { label: '4-Bet+ Pot', key: 'cbet_4bet_plus', filter: { potType: '4bet_plus', street: 'flop' } },
          ].map(pt => {
            const pct = ((snapshot.summary as Record<string, number>)[pt.key] ?? null);
            return (
              <div key={pt.key}
                className="flex items-center gap-3 rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/[0.03]"
                style={{ cursor: onJumpToAnalyzer ? 'pointer' : 'default' }}
                onClick={() => onJumpToAnalyzer?.(pt.filter)}
              >
                <span className="w-20 text-[10px] text-white/55 uppercase">{pt.label}</span>
                <div className="h-2 flex-1 rounded-full bg-white/[0.04]">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: GOLD }} />
                </div>
                <span className="w-16 text-right text-[10px] font-mono text-white/60">{pct != null ? `${pct.toFixed(1)}%` : '—'}</span>
              </div>
            );
          })}
        </div>
      </Panel>

    </div>
  );
}

// =============== TURN ===============
export function TurnTab({ snapshot, trends }: TabProps) {
  const t = snapshot.turn_analysis;
  const total = snapshot.source_hand_count || 1;
  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle>Turn Overview</SectionTitle>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Turns Seen" value={fmtInt(t.sawTurnCount)} sub={t.sawTurnCount != null ? `${((t.sawTurnCount / total) * 100).toFixed(1)}%` : '—'} />
          <StatCard label="Turn Barrel %" value={fmtPct(t.barrelTurn)} sub={fmtRatio(t.barrelTurnCount, t.barrelTurnOppCount, t.barrelTurn)} statKey="barrelTurn" {...tr(trends, 'barrelTurn')} />
          <StatCard label="Barrel Success" value={fmtPct(t.turnBarrelSuccess)} sub={fmtRatio(t.turnBarrelSuccessCount, t.turnBarrelSuccessOppCount, t.turnBarrelSuccess)} statKey="turnBarrelSuccess" {...tr(trends, 'turnBarrelSuccess')} />
          <StatCard label="Fold to Barrel" value={fmtPct(t.foldToTurnBarrel)} sub={fmtRatio(t.foldToTurnBarrelCount, t.foldToTurnBarrelOppCount, t.foldToTurnBarrel)} statKey="foldToTurnBarrel" {...tr(trends, 'foldToTurnBarrel')} />
          <StatCard label="Call Turn Barrel" value={fmtPct(t.callTurnBarrel)} sub={fmtRatio(t.callTurnBarrelCount, t.callTurnBarrelOppCount, t.callTurnBarrel)} statKey="callTurnBarrel" {...tr(trends, 'callTurnBarrel')} />
          <StatCard label="Raise Turn Barrel" value={fmtPct(t.raiseTurnBarrel)} sub={fmtRatio(t.raiseTurnBarrelCount, t.raiseTurnBarrelOppCount, t.raiseTurnBarrel)} statKey="raiseTurnBarrel" {...tr(trends, 'raiseTurnBarrel')} />
          <StatCard label="Delayed C-Bet" value={fmtPct(t.delayedCbet)} sub={fmtRatio(t.delayedCbetCount, t.delayedCbetOppCount, t.delayedCbet)} statKey="delayedCbet" {...tr(trends, 'delayedCbet')} />
          <StatCard label="Turn Check-Raise" value={fmtPct(t.turnCheckRaise)} sub={fmtRatio(t.turnCheckRaiseCount, t.turnCheckRaiseOppCount, t.turnCheckRaise)} statKey="turnCheckRaise" {...tr(trends, 'turnCheckRaise')} />
          <StatCard label="Turn Probe" value={fmtPct(t.turnProbe)} sub={fmtRatio(t.turnProbeCount, t.turnProbeOppCount, t.turnProbe)} statKey="turnProbe" {...tr(trends, 'turnProbe')} />
          <StatCard label="Bet When Checked To" value={fmtPct(t.turnBetWhenCheckedTo)} sub={fmtRatio(t.turnBetWhenCheckedToCount, t.turnBetWhenCheckedToOppCount, t.turnBetWhenCheckedTo)} statKey="turnBetWhenCheckedTo" {...tr(trends, 'turnBetWhenCheckedTo')} />
          <StatCard label="Double-Barrel Opp" value={fmtInt(t.doubleBarrelOppCount)} />
          <StatCard label="Turn Aggression" value={fmtPct(t.turnAggression)} sub={fmtRatio(t.turnAggressionCount, t.turnAggressionOppCount, t.turnAggression)} statKey="turnAggression" {...tr(trends, 'turnAggression')} />
          <StatCard label="Turn Donk Bet" value={fmtPct(t.turnDonkBet)} sub={fmtRatio(t.turnDonkBetCount, t.turnDonkBetOppCount, t.turnDonkBet)} statKey="turnDonkBet" {...tr(trends, 'turnDonkBet')} />
          <StatCard label="Donk Success" value={fmtPct(t.turnDonkSuccess)} sub={fmtRatio(t.turnDonkSuccessCount, t.turnDonkSuccessOppCount, t.turnDonkSuccess)} statKey="turnDonkSuccess" {...tr(trends, 'turnDonkSuccess')} />
          <StatCard label="Fold vs Donk" value={fmtPct(t.foldToTurnDonk)} sub={fmtRatio(t.foldToTurnDonkCount, t.foldToTurnDonkOppCount, t.foldToTurnDonk)} statKey="foldToTurnDonk" {...tr(trends, 'foldToTurnDonk')} />
          <StatCard label="Call vs Donk" value={fmtPct(t.callTurnDonk)} sub={fmtRatio(t.callTurnDonkCount, t.callTurnDonkOppCount, t.callTurnDonk)} statKey="callTurnDonk" {...tr(trends, 'callTurnDonk')} />
          <StatCard label="Raise vs Donk" value={fmtPct(t.raiseTurnDonk)} sub={fmtRatio(t.raiseTurnDonkCount, t.raiseTurnDonkOppCount, t.raiseTurnDonk)} statKey="raiseTurnDonk" {...tr(trends, 'raiseTurnDonk')} />
        </div>
      </Panel>
      <Panel>
        <SectionTitle>Turn Action Breakdown</SectionTitle>
        <div className="space-y-1.5">
          <ComparisonBar label="Turn Barrel" pct={t.barrelTurn ?? null} count={t.barrelTurnCount ?? null} />
          <ComparisonBar label="Barrel Success" pct={t.turnBarrelSuccess ?? null} count={t.turnBarrelSuccessCount ?? null} />
          <ComparisonBar label="Fold to Barrel" pct={t.foldToTurnBarrel ?? null} count={t.foldToTurnBarrelCount ?? null} />
          <ComparisonBar label="Call vs Barrel" pct={t.callTurnBarrel ?? null} count={t.callTurnBarrelCount ?? null} />
          <ComparisonBar label="Raise vs Barrel" pct={t.raiseTurnBarrel ?? null} count={t.raiseTurnBarrelCount ?? null} />
          <ComparisonBar label="Delayed C-Bet" pct={t.delayedCbet ?? null} count={t.delayedCbetCount ?? null} />
          <ComparisonBar label="Turn Check-Raise" pct={t.turnCheckRaise ?? null} count={t.turnCheckRaiseCount ?? null} />
          <ComparisonBar label="Turn Probe" pct={t.turnProbe ?? null} count={t.turnProbeCount ?? null} />
          <ComparisonBar label="Turn Aggression" pct={t.turnAggression ?? null} count={t.turnAggressionCount ?? null} />
        </div>
      </Panel>

    </div>
  );
}

// =============== RIVER ===============
export function RiverTab({ snapshot, trends }: TabProps) {
  const r = snapshot.river_analysis;
  const total = snapshot.source_hand_count || 1;
  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle>River Overview</SectionTitle>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Rivers Seen" value={fmtInt(r.sawRiverCount)} sub={r.sawRiverCount != null ? `${((r.sawRiverCount / total) * 100).toFixed(1)}%` : '—'} />
          <StatCard label="River Barrel %" value={fmtPct(r.barrelRiver)} sub={fmtRatio(r.barrelRiverCount, r.barrelRiverOppCount, r.barrelRiver)} statKey="barrelRiver" {...tr(trends, 'barrelRiver')} />
          <StatCard label="River Bet Freq" value={fmtPct(r.riverBet)} sub={fmtRatio(r.riverBetCount, r.riverBetOppCount, r.riverBet)} statKey="riverBet" {...tr(trends, 'riverBet')} />
          <StatCard label="Fold to River Bet" value={fmtPct(r.foldToRiverBarrel)} sub={fmtRatio(r.foldToRiverBarrelCount, r.foldToRiverBarrelOppCount, r.foldToRiverBarrel)} statKey="foldToRiverBarrel" {...tr(trends, 'foldToRiverBarrel')} />
          <StatCard label="Call River Bet" value={fmtPct(r.callRiverBarrel)} sub={fmtRatio(r.callRiverBarrelCount, r.callRiverBarrelOppCount, r.callRiverBarrel)} statKey="callRiverBarrel" {...tr(trends, 'callRiverBarrel')} />
          <StatCard label="Raise River Bet" value={fmtPct(r.raiseRiverBarrel)} sub={fmtRatio(r.raiseRiverBarrelCount, r.raiseRiverBarrelOppCount, r.raiseRiverBarrel)} statKey="raiseRiverBarrel" {...tr(trends, 'raiseRiverBarrel')} />
          <StatCard label="River Aggression" value={fmtPct(r.riverAggression)} sub={fmtRatio(r.riverAggressionCount, r.riverAggressionOppCount, r.riverAggression)} statKey="riverAggression" {...tr(trends, 'riverAggression')} />
          <StatCard label="Showdowns" value={fmtInt(r.showdownCount)} />
          <StatCard label="W$SD" value={fmtPct(r.wsd)} sub={fmtRatio(r.wsdCount, r.showdownCount, r.wsd)} statKey="wsd" {...tr(trends, 'wsd')} />
          <StatCard label="Bet When Checked To" value={fmtPct(r.riverBetWhenCheckedTo)} sub={fmtRatio(r.riverBetWhenCheckedToCount, r.riverBetWhenCheckedToOppCount, r.riverBetWhenCheckedTo)} statKey="riverBetWhenCheckedTo" {...tr(trends, 'riverBetWhenCheckedTo')} />
          <StatCard label="River Check-Raise" value={fmtPct(r.riverCheckRaise)} sub={fmtRatio(r.riverCheckRaiseCount, r.riverCheckRaiseOppCount, r.riverCheckRaise)} statKey="riverCheckRaise" {...tr(trends, 'riverCheckRaise')} />
          <StatCard label="River Donk Bet" value={fmtPct(r.riverDonkBet)} sub={fmtRatio(r.riverDonkBetCount, r.riverDonkBetOppCount, r.riverDonkBet)} statKey="riverDonkBet" {...tr(trends, 'riverDonkBet')} />
          <StatCard label="Donk Success" value={fmtPct(r.riverDonkSuccess)} sub={fmtRatio(r.riverDonkSuccessCount, r.riverDonkSuccessOppCount, r.riverDonkSuccess)} statKey="riverDonkSuccess" {...tr(trends, 'riverDonkSuccess')} />
          <StatCard label="Fold vs Donk" value={fmtPct(r.foldToRiverDonk)} sub={fmtRatio(r.foldToRiverDonkCount, r.foldToRiverDonkOppCount, r.foldToRiverDonk)} statKey="foldToRiverDonk" {...tr(trends, 'foldToRiverDonk')} />
          <StatCard label="Call vs Donk" value={fmtPct(r.callRiverDonk)} sub={fmtRatio(r.callRiverDonkCount, r.callRiverDonkOppCount, r.callRiverDonk)} statKey="callRiverDonk" {...tr(trends, 'callRiverDonk')} />
          <StatCard label="Raise vs Donk" value={fmtPct(r.raiseRiverDonk)} sub={fmtRatio(r.raiseRiverDonkCount, r.raiseRiverDonkOppCount, r.raiseRiverDonk)} statKey="raiseRiverDonk" {...tr(trends, 'raiseRiverDonk')} />
        </div>
      </Panel>
      <Panel>
        <SectionTitle>River Action Breakdown</SectionTitle>
        <div className="space-y-1.5">
          <ComparisonBar label="River Barrel" pct={r.barrelRiver ?? null} count={r.barrelRiverCount ?? null} />
          <ComparisonBar label="River Bet Freq" pct={r.riverBet ?? null} count={r.riverBetCount ?? null} />
          <ComparisonBar label="Fold to River Bet" pct={r.foldToRiverBarrel ?? null} count={r.foldToRiverBarrelCount ?? null} />
          <ComparisonBar label="Call vs River Bet" pct={r.callRiverBarrel ?? null} count={r.callRiverBarrelCount ?? null} />
          <ComparisonBar label="Raise vs River Bet" pct={r.raiseRiverBarrel ?? null} count={r.raiseRiverBarrelCount ?? null} />
          <ComparisonBar label="River Check-Raise" pct={r.riverCheckRaise ?? null} count={r.riverCheckRaiseCount ?? null} />
          <ComparisonBar label="River Aggression" pct={r.riverAggression ?? null} count={r.riverAggressionCount ?? null} />
        </div>
      </Panel>

    </div>
  );
}

// =============== POSITIONS ===============
// Covers all table sizes: 2-max through 10-max
const POS_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'MP', 'MP1', 'MP2', 'MP3', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// Position sets per table size for the table-size selector
const TABLE_SIZE_POSITIONS: Record<string, string[]> = {
  'all': POS_ORDER,
  '6': ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  '7': ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  '8': ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  '9': ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

function posSortIndex(pos: string): number {
  const idx = POS_ORDER.indexOf(pos);
  return idx === -1 ? 999 : idx;
}

export function PositionsTab({ snapshot, onJumpToAnalyzer }: TabProps) {
  const [sortBy, setSortBy] = useState<'position' | 'bb100' | 'bbWon'>('position');
  const [tableSize, setTableSize] = useState<string>('all');
  const positions = (snapshot.position_analysis as Array<Record<string, number | string>>)?.filter(p => p && p.position) ?? [];

  const visiblePositions = TABLE_SIZE_POSITIONS[tableSize] ?? POS_ORDER;

  // For table-size-filtered views, show all positions for that size (including zeros)
  const displayRows = useMemo(() => {
    if (tableSize === 'all') {
      return positions.map(p => ({
        ...p,
        bb100: p.bb100 != null && Number.isFinite(Number(p.bb100)) ? p.bb100 : (Number(p.hands) > 0 && p.bbWon != null ? Math.round((Number(p.bbWon) / Number(p.hands)) * 100 * 10) / 10 : 0),
      }));
    }
    // For specific table sizes, include all expected positions even with 0 hands
    const existingMap = new Map(positions.map(p => [p.position as string, p]));
    return visiblePositions.map(pos => existingMap.get(pos) ?? { position: pos, hands: 0, bb100: 0, profit: 0, bbWon: 0 });
  }, [positions, tableSize, visiblePositions]);

  const sorted = useMemo(() => {
    const arr = [...displayRows];
    arr.sort((a, b) => {
      if (sortBy === 'bb100') return (b.bb100 as number) - (a.bb100 as number);
      if (sortBy === 'bbWon') return (b.bbWon as number) - (a.bbWon as number);
      return posSortIndex(a.position as string) - posSortIndex(b.position as string);
    });
    return arr;
  }, [displayRows, sortBy]);

  // Reconciliation: total hands across positions vs total hands in snapshot
  const totalPositionedHands = useMemo(() => positions.reduce((sum, p) => sum + (Number(p.hands) || 0), 0), [positions]);
  const totalHands = snapshot.source_hand_count ?? 0;
  const unpositionedHands = totalHands - totalPositionedHands;

  const bbColor = (v: number | null) => v == null ? '#6b7280' : v > 0 ? '#4ade80' : v < 0 ? '#f87171' : '#9ca3af';
  const fmtSigned = (v: number | null | undefined, d = 1) => {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    return `${n > 0 ? '+' : ''}${n.toFixed(d)}`;
  };

  const tableSizeOptions = [
    { label: 'All Tables', value: 'all' },
    { label: '6-Max', value: '6' },
    { label: '7-Max', value: '7' },
    { label: '8-Max', value: '8' },
    { label: '9-Max', value: '9' },
  ];

  return (
    <div className="space-y-3">
      {/* Table size selector + sort controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG }}>
        <span className="text-[10px] font-medium text-white/50">Table:</span>
        {tableSizeOptions.map(opt => (
          <button key={opt.value} onClick={() => setTableSize(opt.value)}
            className="rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-all"
            style={{
              borderColor: tableSize === opt.value ? '#d4a52c' : 'rgba(212,165,44,0.2)',
              background: tableSize === opt.value ? 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)' : 'rgba(8,7,6,0.8)',
              color: tableSize === opt.value ? '#f5e6b0' : 'rgba(220,220,220,0.7)',
            }}>
            {opt.label}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/[0.08]" />
        <span className="text-[10px] font-medium text-white/50">Sort:</span>
        {(['position', 'bb100', 'bbWon'] as const).map(opt => (
          <button key={opt} onClick={() => setSortBy(opt)}
            className="rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-all"
            style={{
              borderColor: sortBy === opt ? '#d4a52c' : 'rgba(212,165,44,0.2)',
              background: sortBy === opt ? 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)' : 'rgba(8,7,6,0.8)',
              color: sortBy === opt ? '#f5e6b0' : 'rgba(220,220,220,0.7)',
            }}>
            {opt === 'bb100' ? 'BB/100' : opt === 'bbWon' ? 'BB Won' : 'Position'}
          </button>
        ))}
      </div>

      {/* Reconciliation summary */}
      <div className="flex flex-wrap items-center gap-3 text-[9px] text-white/40">
        <span className="font-mono">Total Hands: {fmtInt(totalHands)}</span>
        <span className="font-mono">Positioned: {fmtInt(totalPositionedHands)}</span>
        {unpositionedHands > 0 && (
          <span className="font-mono" style={{ color: '#f87171' }}>Unpositioned: {fmtInt(unpositionedHands)}</span>
        )}
        {unpositionedHands === 0 && totalHands > 0 && (
          <span className="font-mono" style={{ color: '#4ade80' }}>Reconciled</span>
        )}
      </div>

      {/* Position table */}
      <div className="overflow-hidden rounded-xl border backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG, boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center border-b border-white/[0.06] px-4 py-2.5" style={{ background: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.04)' }}>
          <span className="w-8 text-[9px] font-bold tracking-widest text-white/30 uppercase">#</span>
          <span className="flex-1 text-[9px] font-bold tracking-widest text-white/40 uppercase">Position</span>
          <span className="w-20 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Hands</span>
          <span className="w-24 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">BB Won</span>
          <span className="w-20 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Chips</span>
          <span className="w-24 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">BB/100</span>
        </div>

        {sorted.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[11px] text-white/30">No position data available</p>
          </div>
        ) : (
          sorted.map((p, i) => {
            const bb100 = finiteMetric(p.bb100);
            const bbWon = finiteMetric(p.bbWon);
            const profit = finiteMetric(p.profit);
            const hasHands = Number(p.hands) > 0;
            return (
              <div
                key={p.position as string}
                onClick={() => hasHands && onJumpToAnalyzer?.({ position: p.position })}
                className={`group flex items-center border-b border-white/[0.03] px-4 py-2.5 transition-colors last:border-b-0 ${hasHands ? 'cursor-pointer hover:bg-white/[0.03]' : 'cursor-default'}`}
                style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent' }}
              >
                <span className="w-8 text-[11px] font-mono text-white/25">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-[12px] font-bold" style={{ color: hasHands ? '#fff' : 'rgba(255,255,255,0.3)' }}>{p.position}</span>
                <span className="w-20 text-right text-[11px] font-mono text-white/50">{fmtInt(p.hands as number)}</span>
                <span className="w-24 text-right text-[11px] font-mono font-semibold" style={{ color: bbColor(bbWon) }}>{fmtSigned(bbWon)}</span>
                <span className="w-20 text-right text-[11px] font-mono text-white/50">{profit != null ? fmtSigned(profit, 0) : '—'}</span>
                <span className="w-24 text-right text-[13px] font-mono font-bold" style={{ color: bbColor(bb100) }}>
                  {fmtSigned(bb100, 1)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============== STARTING HANDS ===============
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export function StartingHandsTab({ snapshot, mode, userId, onJumpToAnalyzer, isDemo }: TabProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const hands = (snapshot.starting_hands as Array<Record<string, number | string | null>>) ?? [];
  const handMap = useMemo(() => {
    const m: Record<string, Record<string, number | string | null>> = {};
    for (const h of hands) m[h.hand as string] = h;
    return m;
  }, [hands]);

  // Validation: sum of all hand-class counts vs total hands with hero cards
  const totalHands = snapshot.source_hand_count ?? 0;
  const totalDealt = useMemo(() => hands.reduce((sum, h) => sum + (Number(h.hands) || 0), 0), [hands]);
  const handClassesFound = hands.length;

  const getCell = (r1: string, r2: string, suited: boolean | null): { key: string; data: Record<string, number | string | null> | null } => {
    const i1 = RANKS.indexOf(r1), i2 = RANKS.indexOf(r2);
    const [high, low] = i1 <= i2 ? [r1, r2] : [r2, r1];
    let key: string;
    if (r1 === r2) key = r1 + r2;
    else if (suited === true) key = high + low + 's';
    else if (suited === false) key = high + low + 'o';
    else key = high + low + (i1 < i2 ? 's' : 'o');
    return { key, data: handMap[key] ?? null };
  };

  const cellColor = (data: Record<string, number | string | null> | null): string => {
    if (!data || Number(data.hands) === 0) return 'rgba(255,255,255,0.02)';
    const bb100 = finiteMetric(data.bb100);
    if (bb100 === null) return 'rgba(255,255,255,0.04)';
    const intensity = Math.min(0.35, Math.abs(bb100) / 100 + 0.08);
    if (bb100 > 20) return `rgba(74,222,128,${intensity + 0.1})`;
    if (bb100 > 0) return `rgba(74,222,128,${intensity})`;
    if (bb100 < -20) return `rgba(248,113,113,${intensity + 0.1})`;
    if (bb100 < 0) return `rgba(248,113,113,${intensity})`;
    return 'rgba(255,255,255,0.05)';
  };

  const handleCellClick = (key: string) => {
    if (selected === key) {
      setExpanded(!expanded);
    } else {
      setSelected(key);
      setExpanded(true);
    }
  };

  return (
    <div className="space-y-3">
      {/* Validation summary */}
      <div className="flex flex-wrap items-center gap-3 text-[9px] text-white/40">
        <span className="font-mono">Hands: {fmtInt(totalHands)}</span>
        <span className="font-mono">Classified: {fmtInt(totalDealt)}</span>
        <span className="font-mono">Classes: {handClassesFound}/169</span>
        {totalHands > 0 && totalDealt > 0 && (
          <span className="font-mono" style={{ color: totalDealt <= totalHands ? '#4ade80' : '#f87171' }}>
            {totalDealt === totalHands ? 'Reconciled' : `Diff: ${totalDealt - totalHands}`}
          </span>
        )}
        {selected && expanded && (
          <span className="ml-auto flex items-center gap-1 font-mono" style={{ color: GOLD_SOFT }}>
            <Filter className="h-2.5 w-2.5" /> Click a hand to replay
          </span>
        )}
      </div>

      <Panel>
        <SectionTitle>Starting Hand Performance</SectionTitle>
        <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, 720px)' }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `20px repeat(13, minmax(0,1fr))`, gap: '2px' }}>
            <div />
            {RANKS.map(r => <div key={r} className="text-center text-[10px] font-bold text-white/40">{r}</div>)}
            {RANKS.map((r1, i) => (
              <Fragment key={`row-${r1}`}>
                <div className="flex items-center justify-center text-[10px] font-bold text-white/40">{r1}</div>
                {RANKS.map((r2, j) => {
                  const suited = i < j ? true : i > j ? false : null;
                  const { key, data } = getCell(r1, r2, suited);
                  const isSelected = selected === key;
                  return (
                    <div key={`${r1}-${r2}`}
                      onClick={() => handleCellClick(key)}
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[2px] text-[9px] font-mono font-bold transition-all hover:scale-110 hover:z-10"
                      style={{
                        background: cellColor(data),
                        color: data && Number(data.hands) > 0 ? '#fff' : 'rgba(255,255,255,0.3)',
                        border: isSelected ? '1px solid ' + GOLD : '1px solid rgba(255,255,255,0.04)',
                        boxShadow: isSelected ? `0 0 6px ${GOLD}80` : 'none',
                      }}
                      title={data && Number(data.hands) > 0
                        ? `${key}: ${data.hands} hands, ${fmt(finiteMetric(data.bb100))} BB/100, ${fmt(finiteMetric(data.bb_won))} BB`
                        : `${key}: 0 hands`}
                    >
                      <span className="leading-none">{key}</span>
                      {data && Number(data.hands) > 0 && (
                        <span className="text-[7px] font-normal leading-none text-white/50">
                          {(() => { const v = finiteMetric(data.bb100); return v !== null && v > 0 ? `+${fmt(v, 0)}` : fmt(v, 0); })()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[10px] text-white/45">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(74,222,128,0.35)' }} />Profitable</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.05)' }} />Break-even</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(248,113,113,0.35)' }} />Losing</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.02)' }} />No data</span>
        </div>
      </Panel>

      {/* Detail panel + interactive hand list */}
      {selected && expanded && (
        <StartingHandDetail
          handKey={selected}
          handData={handMap[selected] ?? null}
          userId={userId}
          mode={mode}
          isDemo={isDemo}
          onJumpToAnalyzer={onJumpToAnalyzer}
        />
      )}
    </div>
  );
}

// ── Starting Hand Detail with interactive hand list + HH Replayer ──
function StartingHandDetail({ handKey, handData, userId, mode, isDemo, onJumpToAnalyzer }: {
  handKey: string;
  handData: Record<string, number | string | null> | null;
  userId?: string;
  mode: AnalyticsMode;
  isDemo?: boolean;
  onJumpToAnalyzer?: (filters: Record<string, unknown>) => void;
}) {
  const [handList, setHandList] = useState<StartingHandListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [replayHand, setReplayHand] = useState<NormalizedHand | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterPosition, setFilterPosition] = useState<string | null>(null);
  const [filterTournament, setFilterTournament] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<'win' | 'loss' | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState<string | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<string | null>(null);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<{ id: string; label: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 10;
  const canQuery = !!userId && !isDemo;

  // Load filter options when hand changes
  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    (async () => {
      const [positions, tournaments] = await Promise.all([
        fetchDistinctPositionsForHandClass(userId!, mode, handKey),
        fetchDistinctTournamentsForHandClass(userId!, mode, handKey),
      ]);
      if (!cancelled) {
        setAvailablePositions(positions);
        setAvailableTournaments(tournaments);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, mode, handKey, canQuery]);

  // Load hand list when hand, page, or filters change
  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { hands: data, total: count } = await fetchHandsByStartingHand(
        userId!, mode, handKey,
        { position: filterPosition, tournamentId: filterTournament, result: filterResult, dateFrom: filterDateFrom, dateTo: filterDateTo },
        page, PAGE_SIZE,
      );
      if (!cancelled) {
        setHandList(data);
        setTotal(count);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, mode, handKey, page, filterPosition, filterTournament, filterResult, filterDateFrom, filterDateTo, canQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filterPosition, filterTournament, filterResult, filterDateFrom, filterDateTo]);

  const handleReplay = useCallback(async (item: StartingHandListItem) => {
    if (!item.raw_hand_text) {
      setReplayError('Raw hand text not available for this hand.');
      return;
    }
    setReplayLoading(true);
    setReplayError(null);
    setReplayHand(null);
    try {
      const record: Phase2HandRecord = {
        hand_id: item.hand_id,
        site: item.site,
        game_mode: mode,
        tournament_id: item.tournament_id,
        played_at: item.played_at,
        blinds: item.blinds,
        position: item.position,
        hero_name: item.hero_name ?? 'Hero',
        hero_cards: item.hero_cards,
        board: item.board,
        action_sequence: null,
        pot_amount: 0,
        net_result: item.net_result ?? 0,
        showdown: item.showdown,
        raw_hand_text: item.raw_hand_text,
      };
      const normalized = phase2HandToNormalized(record);
      if (!normalized.actions || normalized.actions.length === 0) {
        setReplayError('Unable to replay this hand — action data is incomplete.');
        return;
      }
      setReplayHand(normalized);
    } catch {
      setReplayError('Failed to parse hand data.');
    }
    setReplayLoading(false);
  }, [mode]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = filterPosition || filterTournament || filterResult || filterDateFrom || filterDateTo;

  return (
    <Panel>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>{handKey} Details</SectionTitle>
        <div className="flex items-center gap-2">
          {canQuery && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                borderColor: showFilters || hasActiveFilters ? GOLD : 'rgba(212,165,44,0.2)',
                background: showFilters || hasActiveFilters ? 'rgba(212,165,44,0.12)' : 'transparent',
                color: showFilters || hasActiveFilters ? GOLD_SOFT : 'rgba(220,220,220,0.5)',
              }}
            >
              <Filter className="h-3 w-3" strokeWidth={1.5} /> Filters{hasActiveFilters ? ' •' : ''}
            </button>
          )}
          <button
            onClick={() => onJumpToAnalyzer?.({ startingHand: handKey })}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105"
            style={{ borderColor: GOLD, color: GOLD_SOFT, background: 'rgba(212,165,44,0.08)' }}
          >
            <Eye className="h-3 w-3" strokeWidth={1.5} /> Analyze
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {handData ? (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          <StatCard label="Times Dealt" value={fmtInt(Number(handData.hands))} />
          <StatCard label="BB Won" value={fmt(finiteMetric(handData.bb_won))} color={resultColor(finiteMetric(handData.bb_won))} />
          <StatCard label="BB/100" value={fmt(finiteMetric(handData.bb100))} color={resultColor(finiteMetric(handData.bb100))} />
          <StatCard label="Win Rate" value={Number(handData.hands) > 0 ? fmtPct(Math.round(((finiteMetric(handData.bb_won) ?? 0) / Number(handData.hands)) * 100 * 10) / 10) : '—'} color={resultColor(finiteMetric(handData.bb_won))} />
        </div>
      ) : (
        <p className="text-[10px] text-white/30">No hands dealt with this starting hand class in the current dataset.</p>
      )}

      {/* Filter controls */}
      {canQuery && showFilters && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)', background: 'rgba(8,7,6,0.6)' }}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {/* Position filter */}
            <select
              value={filterPosition ?? ''}
              onChange={(e) => setFilterPosition(e.target.value || null)}
              className="rounded-md border bg-transparent px-2 py-1.5 text-[10px] text-white/70"
              style={{ borderColor: 'rgba(212,165,44,0.2)' }}
            >
              <option value="">All Positions</option>
              {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Tournament filter */}
            <select
              value={filterTournament ?? ''}
              onChange={(e) => setFilterTournament(e.target.value || null)}
              className="rounded-md border bg-transparent px-2 py-1.5 text-[10px] text-white/70"
              style={{ borderColor: 'rgba(212,165,44,0.2)' }}
            >
              <option value="">All Tournaments</option>
              {availableTournaments.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            {/* Result filter */}
            <select
              value={filterResult ?? ''}
              onChange={(e) => setFilterResult(e.target.value as 'win' | 'loss' | null || null)}
              className="rounded-md border bg-transparent px-2 py-1.5 text-[10px] text-white/70"
              style={{ borderColor: 'rgba(212,165,44,0.2)' }}
            >
              <option value="">All Results</option>
              <option value="win">Wins Only</option>
              <option value="loss">Losses Only</option>
            </select>

            {/* Date range */}
            <input
              type="date"
              value={filterDateFrom ?? ''}
              onChange={(e) => setFilterDateFrom(e.target.value || null)}
              className="rounded-md border bg-transparent px-2 py-1.5 text-[10px] text-white/70"
              style={{ borderColor: 'rgba(212,165,44,0.2)' }}
              placeholder="From"
            />
            <input
              type="date"
              value={filterDateTo ?? ''}
              onChange={(e) => setFilterDateTo(e.target.value || null)}
              className="rounded-md border bg-transparent px-2 py-1.5 text-[10px] text-white/70"
              style={{ borderColor: 'rgba(212,165,44,0.2)' }}
              placeholder="To"
            />

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterPosition(null); setFilterTournament(null); setFilterResult(null); setFilterDateFrom(null); setFilterDateTo(null); }}
                className="rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition-all hover:text-white/80"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hand history list */}
      {canQuery && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">
              Hand History {total > 0 && `(${total} hands)`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-white/30" strokeWidth={1.5} />
            </div>
          ) : handList.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[10px] text-white/30">No hands found for {handKey}{hasActiveFilters ? ' with current filters' : ''}</p>
            </div>
          ) : (
            <div ref={listRef} className="overflow-hidden rounded-lg border border-white/[0.04]">
              {handList.map((item, i) => {
                const netBB = item.net_result != null ? Number(item.net_result) : null;
                const isWin = netBB != null && netBB > 0;
                const isLoss = netBB != null && netBB < 0;
                const date = item.played_at ? new Date(item.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
                return (
                  <div
                    key={item.hand_id}
                    className="flex items-center gap-2 border-b border-white/[0.03] px-3 py-2 transition-colors last:border-b-0 hover:bg-white/[0.02]"
                    style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.008)' : 'transparent' }}
                  >
                    <span className="w-14 text-[10px] font-mono text-white/40">{date}</span>
                    <span className="w-12 text-[10px] font-bold text-white/70">{item.position ?? '—'}</span>
                    <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
                      {(() => {
                        const heroCards = splitCardStr(item.hero_cards);
                        const boardCards = splitCardStr(item.board);
                        if (heroCards.length === 0 && boardCards.length === 0) {
                          return <span className="truncate text-[10px] font-mono text-white/40">—</span>;
                        }
                        return (
                          <>
                            <MiniCardRow cards={heroCards} />
                            {boardCards.length > 0 && (
                              <>
                                <span className="text-[9px] text-white/25">→</span>
                                <MiniCardRow cards={boardCards} />
                              </>
                            )}
                          </>
                        );
                      })()}
                    </span>
                    <span className="w-16 text-right text-[10px] font-mono font-bold" style={{ color: isWin ? '#4ade80' : isLoss ? '#f87171' : '#9ca3af' }}>
                      {netBB != null ? `${netBB > 0 ? '+' : ''}${netBB.toFixed(1)} BB` : '—'}
                    </span>
                    <button
                      onClick={() => handleReplay(item)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-white/50 transition-all hover:scale-110 hover:text-[#d4a52c]"
                      style={{ borderColor: 'rgba(212,165,44,0.15)' }}
                      title="Replay hand"
                    >
                      <Play className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Centered pagination controls */}
      {canQuery && totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => { setPage(Math.max(0, page - 1)); listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={page === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[10px] font-bold tracking-wider uppercase transition-all disabled:opacity-30 disabled:pointer-events-none"
            style={{
              borderColor: page === 0 ? 'rgba(212,165,44,0.1)' : 'rgba(212,165,44,0.4)',
              background: 'transparent',
              color: page === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(245,230,176,0.8)',
            }}
            onMouseEnter={(e) => { if (page !== 0) e.currentTarget.style.background = 'rgba(212,165,44,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[10px] font-mono font-medium text-white/60">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => { setPage(Math.min(totalPages - 1, page + 1)); listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[10px] font-bold tracking-wider uppercase transition-all disabled:opacity-30 disabled:pointer-events-none"
            style={{
              borderColor: page >= totalPages - 1 ? 'rgba(212,165,44,0.1)' : 'rgba(212,165,44,0.5)',
              background: page >= totalPages - 1 ? 'transparent' : 'rgba(212,165,44,0.15)',
              color: page >= totalPages - 1 ? 'rgba(255,255,255,0.25)' : '#f5e6b0',
            }}
            onMouseEnter={(e) => { if (page < totalPages - 1) e.currentTarget.style.background = 'rgba(212,165,44,0.25)'; }}
            onMouseLeave={(e) => { if (page < totalPages - 1) e.currentTarget.style.background = 'rgba(212,165,44,0.15)'; }}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!canQuery && (
        <p className="mt-3 text-[10px] text-white/30">Import your hand history to enable interactive hand browsing and replay.</p>
      )}

      {/* HH Replayer Modal */}
      {(replayHand || replayLoading || replayError) && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => { setReplayHand(null); setReplayLoading(false); setReplayError(null); }}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl border p-4"
            style={{ background: 'rgba(8,7,6,0.96)', border: '1px solid rgba(192,145,30,0.2)', boxShadow: '0 20px 60px -20px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setReplayHand(null); setReplayLoading(false); setReplayError(null); }}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
            >
              <X size={18} />
            </button>

            {replayLoading && (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                <span className="mt-3 text-[12px] text-white/40">Loading hand...</span>
              </div>
            )}

            {replayError && !replayLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-[14px] font-bold text-white">{replayError}</span>
                <button
                  onClick={() => setReplayError(null)}
                  className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-[11px] text-white/60 hover:text-white/80"
                >
                  Close
                </button>
              </div>
            )}

            {replayHand && !replayLoading && !replayError && (
              <div className="overflow-visible">
                <HHReplayer hand={replayHand} variant="embedded" visualSize="main" />
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

// =============== BOARD ANALYSIS — HIERARCHICAL EXPLORER ===============
import {
  formatStructuralTag,
  formatSuitTexture,
  formatPairedStructure,
  formatSuitedRelationship,
  boardTilesFromClass,
  ALL_STRUCTURAL_TAGS,
  type SuitTexture,
  type StructuralTag,
} from '@/lib/boardNormalization';

function finiteMetric(value: number | string | null | undefined): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

const SUIT_TEXTURES: Array<{ key: SuitTexture; label: string }> = [
  { key: 'rainbow', label: 'Rainbow' },
  { key: 'two_tone', label: 'Two-Tone' },
  { key: 'monotone', label: 'Monotone' },
];

const POT_TYPES = [
  { key: '', label: 'All Pots' },
  { key: 'srp', label: 'SRP' },
  { key: '3bet', label: '3-Bet' },
  { key: '4bet_plus', label: '4-Bet+' },
  { key: 'limped', label: 'Limped' },
];

const MIN_HANDS_OPTIONS = [
  { key: 0, label: 'All' },
  { key: 25, label: '25+' },
  { key: 50, label: '50+' },
  { key: 100, label: '100+' },
  { key: 250, label: '250+' },
];

type AnalysisMode = 'most_profitable' | 'biggest_leaks' | 'most_played';

function leakScore(bb100: number, hands: number): number {
  if (bb100 >= 0) return 0;
  return Math.abs(bb100) * Math.sqrt(hands);
}

const SUIT_COLORS = {
  green: '#22C55E',
  blue: '#3B82F6',
  red: '#EF4444',
} as const;

function textureFromClass(boardClass: string): SuitTexture | null {
  if (boardClass.includes('Monotone')) return 'monotone';
  if (boardClass.includes('Two-Tone')) return 'two_tone';
  if (boardClass.includes('Rainbow')) return 'rainbow';
  return null;
}

function suitColorsForTexture(texture: SuitTexture | string, suitedRel?: string): string[] {
  if (texture === 'monotone') return [SUIT_COLORS.green, SUIT_COLORS.green, SUIT_COLORS.green];
  if (texture === 'rainbow') return [SUIT_COLORS.green, SUIT_COLORS.blue, SUIT_COLORS.red];
  if (suitedRel === 'high_low') return [SUIT_COLORS.green, SUIT_COLORS.blue, SUIT_COLORS.green];
  if (suitedRel === 'middle_low') return [SUIT_COLORS.blue, SUIT_COLORS.green, SUIT_COLORS.green];
  return [SUIT_COLORS.green, SUIT_COLORS.green, SUIT_COLORS.blue];
}

function BoardTile({ char, isPlaceholder, color }: { char: string; isPlaceholder: boolean; color?: string }) {
  if (isPlaceholder) {
    return (
      <div
        className="flex h-7 w-5 items-center justify-center rounded text-[11px] font-bold"
        style={color
          ? { border: '1px solid', borderColor: `${color}cc`, color: '#ffffff', background: `${color}88`, boxShadow: `inset 0 1px 0 ${color}55` }
          : { border: '1px solid', borderColor: 'rgba(212,165,44,0.4)', color: '#f5e6b0', background: 'rgba(212,165,44,0.12)', boxShadow: 'inset 0 1px 0 rgba(212,165,44,0.15)' }
        }
      >
        {char}
      </div>
    );
  }
  return <RankOnlyCard rank={char} color={color} />;
}

function BoardTileRow({ boardClass, suitTexture, suitedRel }: { boardClass: string; suitTexture?: SuitTexture | string; suitedRel?: string }) {
  const tiles = boardTilesFromClass(boardClass);
  const texture = suitTexture ?? textureFromClass(boardClass);
  const colors = texture ? suitColorsForTexture(texture, suitedRel) : [];
  return (
    <div className="flex shrink-0 gap-1">
      {tiles.map((t, i) => <BoardTile key={i} char={t.char} isPlaceholder={t.isPlaceholder} color={colors[i]} />)}
    </div>
  );
}

function StructuralTagBadges({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-white/40">
          {formatStructuralTag(tag as StructuralTag)}
        </span>
      ))}
    </div>
  );
}

function FullLegendModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-80 rounded-xl border p-5 shadow-2xl backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: 'rgba(6, 8, 10, 0.92)' }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Board Class Legend</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2 text-[10px] text-white/50">
          <div><span className="font-bold text-white/70">X</span> = ranks 6, 7, 8, 9</div>
          <div><span className="font-bold text-white/70">Y</span> = ranks 2, 3, 4, 5</div>
          <div><span className="font-bold text-white/70">P</span> = paired lower rank (e.g. K88 → KPP, Q44 → QPP)</div>
          <div className="mt-2 border-t border-white/10 pt-2">
            <div className="mb-1 font-bold text-white/60">Examples:</div>
            <div>K98 → KXX</div>
            <div>K83 → KXY</div>
            <div>K42 → KYY</div>
            <div>K88 → KPP</div>
            <div>KK8 → KKX</div>
            <div>Q44 → QPP</div>
            <div>QQ4 → QQY</div>
          </div>
          <div className="mt-2 border-t border-white/10 pt-2">
            <div className="mb-1 flex items-center gap-2"><span className="font-bold text-white/70">Rainbow</span> — three different colors</div>
            <div className="mb-2 flex gap-1">
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.green }}>K</span>
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.blue }}>X</span>
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.red }}>Y</span>
            </div>
            <div className="mb-1 flex items-center gap-2"><span className="font-bold text-white/70">Two-Tone</span> — two matching colors + one different</div>
            <div className="mb-2 flex gap-1">
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.green }}>K</span>
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.green }}>X</span>
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.blue }}>Y</span>
            </div>
            <div className="mb-1 flex items-center gap-2"><span className="font-bold text-white/70">Monotone</span> — all three cards same color</div>
            <div className="mb-2 flex gap-1">
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.green }}>K</span>
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.green }}>X</span>
              <span className="flex h-6 w-5 items-center justify-center rounded text-[10px] font-black text-white" style={{ background: SUIT_COLORS.green }}>Y</span>
            </div>
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-white/35">
            Exact physical suits are normalized for Board Analysis. The original raw board (e.g. Ts 8s 4d) remains preserved on each hand record.
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, boardClass, bb100, hands, color, suitTexture }: {
  label: string; boardClass: string; bb100: number | null; hands: number; color: string; suitTexture?: string;
}) {
  return (
    <div className="flex-1 rounded-lg border p-2.5 backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG }}>
      <div className="text-[8px] font-bold tracking-widest uppercase" style={{ color }}>{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <BoardTileRow boardClass={boardClass} suitTexture={suitTexture} />
        <span className="text-[10px] font-bold text-white">{boardClass}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[14px] font-mono font-bold" style={{ color: resultColor(bb100) }}>
          {bb100 !== null && bb100 > 0 ? '+' : ''}{fmt(bb100)}
        </span>
        <span className="text-[8px] text-white/35">BB/100</span>
        <span className="ml-auto text-[9px] text-white/35">{fmtInt(hands)} hands</span>
      </div>
    </div>
  );
}

function DetailDrawer({ boardClass, boardData, onClose, onJumpToAnalyzer }: {
  boardClass: string;
  boardData: Record<string, unknown>;
  onClose: () => void;
  onJumpToAnalyzer?: (f: Record<string, unknown>) => void;
}) {
  const hands = Number(boardData.hands ?? 0);
  const bb100 = finiteMetric(boardData.bb100);
  const bbWon = finiteMetric(boardData.bb_won);
  const cbetPct = finiteMetric(boardData.cbet_pct);
  const wtsd = finiteMetric(boardData.wtsd);
  const wsd = finiteMetric(boardData.wsd);
  const wwsf = finiteMetric(boardData.wwsf);
  const positions = (boardData.positions as Array<Record<string, unknown>>) ?? [];
  const repRanks = boardTilesFromClass(boardClass).map(t => t.char);
  const suitTex = String(boardData.suit_texture ?? '');
  const suitedRel = String(boardData.suited_relationship ?? 'none');
  const cardColors = suitTex ? suitColorsForTexture(suitTex, suitedRel) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-80 overflow-y-auto rounded-l-xl border-l p-4 backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: 'rgba(6, 8, 10, 0.92)' }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {repRanks.map((rank, i) => <RankOnlyCard key={`${rank}-${i}`} rank={rank} color={cardColors[i]} />)}
            </div>
            <span className="text-[12px] font-bold text-white">{boardClass}</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">Hands</div>
            <div className="text-[14px] font-mono font-bold text-white">{fmtInt(hands)}</div>
          </div>
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">BB/100</div>
            <div className="text-[14px] font-mono font-bold" style={{ color: resultColor(bb100) }}>{fmt(bb100, 1)}</div>
          </div>
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">BB Won</div>
            <div className="text-[12px] font-mono font-bold" style={{ color: resultColor(bbWon) }}>{fmt(bbWon)}</div>
          </div>
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">CBet %</div>
            <div className="text-[12px] font-mono font-bold text-white">{cbetPct && cbetPct > 0 ? fmtPct(cbetPct) : '—'}</div>
          </div>
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">WTSD</div>
            <div className="text-[12px] font-mono font-bold text-white">{wtsd && wtsd > 0 ? fmtPct(wtsd) : '—'}</div>
          </div>
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">W$SD</div>
            <div className="text-[12px] font-mono font-bold text-white">{wsd && wsd > 0 ? fmtPct(wsd) : '—'}</div>
          </div>
          <div className="rounded-md border border-white/5 p-2">
            <div className="text-[8px] text-white/35 uppercase">WWSF</div>
            <div className="text-[12px] font-mono font-bold text-white">{wwsf && wwsf > 0 ? fmtPct(wwsf) : '—'}</div>
          </div>
          {suitedRel !== 'none' && (
            <div className="rounded-md border border-white/5 p-2">
              <div className="text-[8px] text-white/35 uppercase">Suited</div>
              <div className="text-[10px] text-white/60">{formatSuitedRelationship(suitedRel as never)}</div>
            </div>
          )}
        </div>

        {positions.length > 1 && (
          <div className="mb-3">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">By Position</div>
            <div className="space-y-0.5">
              {positions
                .filter(p => Number(p.hands) > 0 && String(p.position) !== 'unknown')
                .sort((a, b) => Number(b.hands) - Number(a.hands))
                .slice(0, 8)
                .map((p, i) => {
                  const pBB100 = finiteMetric(p.bb100);
                  const pH = Number(p.hands);
                  return (
                    <div key={i} className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-white/[0.03]">
                      <span className="text-[10px] text-white/55">{String(p.position)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/35">{fmtInt(pH)} hands</span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: resultColor(pBB100) }}>{fmt(pBB100, 1)} BB/100</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <button
          onClick={() => onJumpToAnalyzer?.({ boardClass })}
          className="w-full rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition-colors hover:bg-[#d4a52c]/20"
        >
          View Contributing Hands ({fmtInt(hands)})
        </button>
      </div>
    </div>
  );
}

export function BoardTab({ snapshot, onJumpToAnalyzer }: TabProps) {
  const [mode, setMode] = useState<AnalysisMode>('most_profitable');
  const [suitFilter, setSuitFilter] = useState<SuitTexture | ''>('');
  const [structFilter, setStructFilter] = useState<StructuralTag | ''>('');
  const [potFilter, setPotFilter] = useState<string>('');
  const [minHands, setMinHands] = useState<number>(50);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [exactSort, setExactSort] = useState<'hands' | 'best' | 'worst'>('hands');
  const [showAllExact, setShowAllExact] = useState(false);
  const [drawerBoard, setDrawerBoard] = useState<string | null>(null);

  const allBoards = ((snapshot.board_analysis as Array<Record<string, unknown>>) ?? [])
    .filter((b) => Number(b.hands) > 0);

  const familyBoards = useMemo(() => {
    let filtered = allBoards.filter((b) => String(b.level ?? 'exact') === 'family');
    if (suitFilter) filtered = filtered.filter((b) => String(b.suit_texture ?? '') === suitFilter);
    if (structFilter) {
      filtered = filtered.filter((b) => {
        const tags = (b.structural_tags as string[]) ?? [];
        return tags.includes(structFilter);
      });
    }
    return filtered;
  }, [allBoards, suitFilter, structFilter]);

  const sortedFamilies = useMemo(() => {
    const arr = [...familyBoards];
    const meetsMin = (b: Record<string, unknown>) => Number(b.hands) >= minHands;
    if (mode === 'most_played') {
      arr.sort((a, b) => Number(b.hands) - Number(a.hands));
    } else if (mode === 'most_profitable') {
      arr.sort((a, b) => {
        const aOk = meetsMin(a), bOk = meetsMin(b);
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return (finiteMetric(b.bb100) ?? -Infinity) - (finiteMetric(a.bb100) ?? -Infinity);
      });
    } else {
      arr.sort((a, b) => {
        const aOk = meetsMin(a), bOk = meetsMin(b);
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return leakScore(finiteMetric(b.bb100) ?? 0, Number(b.hands)) - leakScore(finiteMetric(a.bb100) ?? 0, Number(a.hands));
      });
    }
    return arr.slice(0, 30);
  }, [familyBoards, mode, minHands]);

  // Summary strip cards
  const summaryCards = useMemo(() => {
    const meetsMin = (b: Record<string, unknown>) => Number(b.hands) >= minHands;
    const qualifying = familyBoards.filter(meetsMin);

    const biggestLeak = qualifying.length > 0
      ? qualifying.reduce((worst, b) => {
        const score = leakScore(finiteMetric(b.bb100) ?? 0, Number(b.hands));
        return score > (worst._score ?? -1) ? { ...b, _score: score } : worst;
      }, { _score: -1 } as Record<string, unknown>)
      : null;

    const strongest = qualifying.length > 0
      ? qualifying.reduce((best, b) => (finiteMetric(b.bb100) ?? -Infinity) > (finiteMetric(best.bb100) ?? -Infinity) ? b : best)
      : null;

    const mostPlayed = familyBoards.length > 0
      ? familyBoards.reduce((most, b) => Number(b.hands) > Number(most.hands) ? b : most)
      : null;

    return { biggestLeak, strongest, mostPlayed };
  }, [familyBoards, minHands]);

  const exactBoardsForFamily = useMemo(() => {
    if (!expandedFamily) return [];
    return allBoards
      .filter((b) => String(b.level ?? 'exact') === 'exact' && String(b.family ?? '') === expandedFamily)
      .sort((a, b) => {
        if (exactSort === 'hands') return Number(b.hands) - Number(a.hands);
        const aBB = finiteMetric(a.bb100) ?? 0;
        const bBB = finiteMetric(b.bb100) ?? 0;
        return exactSort === 'best' ? bBB - aBB : aBB - bBB;
      });
  }, [allBoards, expandedFamily, exactSort]);

  // Structural breakdown for expanded family
  const structBreakdown = useMemo(() => {
    if (!expandedFamily) return [];
    const exacts = allBoards.filter((b) =>
      String(b.level ?? 'exact') === 'exact' && String(b.family ?? '') === expandedFamily
    );
    const tagMap: Record<string, { hands: number; bbWon: number }> = {};
    for (const e of exacts) {
      const tags = (e.structural_tags as string[]) ?? [];
      const h = Number(e.hands);
      const bb = finiteMetric(e.bb_won) ?? 0;
      for (const t of tags) {
        if (!tagMap[t]) tagMap[t] = { hands: 0, bbWon: 0 };
        tagMap[t].hands += h;
        tagMap[t].bbWon += bb;
      }
    }
    return Object.entries(tagMap)
      .map(([tag, d]) => ({
        tag,
        hands: d.hands,
        bb100: d.hands > 0 ? Math.round((d.bbWon / d.hands) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.hands - a.hands);
  }, [allBoards, expandedFamily]);

  const hasData = allBoards.length > 0;
  const hasFilters = suitFilter || structFilter || potFilter;
  const drawerData = drawerBoard ? allBoards.find(b => String(b.board_class) === drawerBoard) : null;

  return (
    <Panel>
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <SectionTitle>Board Performance</SectionTitle>
        </div>
        <p className="text-[10px] text-white/35">Find which flop structures you perform best and worst on.</p>
        <div className="mt-1 flex items-center gap-2 text-[9px] text-white/30">
          <span>Board notation:</span>
          <span><b className="text-white/50">X</b> = 6–9</span>
          <span>•</span>
          <span><b className="text-white/50">Y</b> = 2–5</span>
          <span>•</span>
          <span><b className="text-white/50">P</b> = paired lower rank</span>
          <span>•</span>
          <button onClick={() => setShowLegend(true)} className="text-[#d4a52c]/60 hover:text-[#d4a52c]">Full Legend</button>
        </div>
        <p className="mt-1 text-[8px] text-white/25">Card colors indicate suit texture: <span style={{ color: SUIT_COLORS.green }}>green</span>, <span style={{ color: SUIT_COLORS.blue }}>blue</span>, and <span style={{ color: SUIT_COLORS.red }}>red</span> represent suit groups — not specific suits. Rank notation (X/Y/P) is preserved.</p>
      </div>

      {/* Summary strip */}
      {hasData && summaryCards.biggestLeak && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard
            label="Biggest Leak"
            boardClass={String(summaryCards.biggestLeak.board_class)}
            bb100={finiteMetric(summaryCards.biggestLeak.bb100)}
            hands={Number(summaryCards.biggestLeak.hands)}
            color="#f87171"
            suitTexture={String(summaryCards.biggestLeak.suit_texture ?? '')}
          />
          <SummaryCard
            label="Strongest"
            boardClass={String((summaryCards.strongest ?? summaryCards.biggestLeak).board_class)}
            bb100={finiteMetric((summaryCards.strongest ?? summaryCards.biggestLeak).bb100)}
            hands={Number((summaryCards.strongest ?? summaryCards.biggestLeak).hands)}
            color="#4ade80"
            suitTexture={String((summaryCards.strongest ?? summaryCards.biggestLeak).suit_texture ?? '')}
          />
          <SummaryCard
            label="Most Played"
            boardClass={String((summaryCards.mostPlayed ?? summaryCards.biggestLeak).board_class)}
            bb100={finiteMetric((summaryCards.mostPlayed ?? summaryCards.biggestLeak).bb100)}
            hands={Number((summaryCards.mostPlayed ?? summaryCards.biggestLeak).hands)}
            color="#d4a52c"
            suitTexture={String((summaryCards.mostPlayed ?? summaryCards.biggestLeak).suit_texture ?? '')}
          />
        </div>
      )}

      {/* Analysis mode toggle */}
      <div className="mb-2 flex flex-wrap gap-2">
        <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
          {(['most_profitable', 'biggest_leaks', 'most_played'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className="rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ background: mode === m ? 'rgba(212,165,44,0.16)' : 'transparent', color: mode === m ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}>
              {m === 'most_profitable' ? 'Most Profitable' : m === 'biggest_leaks' ? 'Biggest Leaks' : 'Most Played'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      {hasData && (
        <div className="mb-3 flex flex-wrap gap-2">
          <select value={suitFilter} onChange={(e) => setSuitFilter(e.target.value as SuitTexture | '')} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] text-white/60 focus:border-[#d4a52c]/40 focus:outline-none">
            <option value="">All Textures</option>
            {SUIT_TEXTURES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={structFilter} onChange={(e) => setStructFilter(e.target.value as StructuralTag | '')} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] text-white/60 focus:border-[#d4a52c]/40 focus:outline-none">
            <option value="">All Structures</option>
            {ALL_STRUCTURAL_TAGS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={potFilter} onChange={(e) => setPotFilter(e.target.value)} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] text-white/60 focus:border-[#d4a52c]/40 focus:outline-none">
            {POT_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={minHands} onChange={(e) => setMinHands(Number(e.target.value))} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] text-white/60 focus:border-[#d4a52c]/40 focus:outline-none">
            {MIN_HANDS_OPTIONS.map((o) => <option key={o.key} value={o.key}>Min: {o.label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSuitFilter(''); setStructFilter(''); setPotFilter(''); }} className="rounded-md border border-white/10 px-2 py-1 text-[9px] text-white/40 hover:text-white/60">Clear Filters</button>
          )}
        </div>
      )}

      {/* Family rows */}
      {sortedFamilies.length === 0 ? (
        <p className="text-[11px] text-white/30">No board data available. Import hands with flop data to see board performance.</p>
      ) : (
        <div className="space-y-1.5">
          {sortedFamilies.map((board, idx) => {
            const boardClass = String(board.board_class);
            const bb100 = finiteMetric(board.bb100);
            const bbWon = finiteMetric(board.bb_won);
            const hands = Number(board.hands);
            const isLowSample = hands < minHands;
            const isExpanded = expandedFamily === boardClass;
            const tags = (board.structural_tags as string[]) ?? [];
            const cbetPct = finiteMetric(board.cbet_pct);
            const wtsdVal = finiteMetric(board.wtsd);
            const wsdVal = finiteMetric(board.wsd);
            const wwsfVal = finiteMetric(board.wwsf);

            return (
              <div key={`f-${boardClass}-${idx}`}>
                <button
                  onClick={() => setExpandedFamily(isExpanded ? null : boardClass)}
                  className="flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
                  style={{ borderColor: isExpanded ? 'rgba(212,165,44,0.2)' : 'rgba(255,255,255,0.05)', background: isExpanded ? 'rgba(212,165,44,0.04)' : 'transparent' }}
                >
                  <BoardTileRow boardClass={boardClass} suitTexture={String(board.suit_texture ?? '')} suitedRel={String(board.suited_relationship ?? '')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white">{boardClass}</span>
                      {isLowSample && <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[7px] font-bold uppercase text-amber-400/70">Low Sample</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] text-white/35">
                      <span>{fmtInt(hands)} hands</span>
                      <span>•</span>
                      <span>{bbWon !== null && bbWon > 0 ? '+' : ''}{fmt(bbWon)} BB won</span>
                      {cbetPct && cbetPct > 0 && <><span>•</span><span>CBet {fmtPct(cbetPct)}</span></>}
                      {wtsdVal && wtsdVal > 0 && <><span>•</span><span>WTSD {fmtPct(wtsdVal)}</span></>}
                      {wsdVal && wsdVal > 0 && <><span>•</span><span>W$SD {fmtPct(wsdVal)}</span></>}
                      {wwsfVal && wwsfVal > 0 && <><span>•</span><span>WWSF {fmtPct(wwsfVal)}</span></>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[13px] font-mono font-bold" style={{ color: resultColor(bb100) }}>
                      {bb100 !== null && bb100 > 0 ? '+' : ''}{fmt(bb100)} <span className="text-[8px] font-normal">BB/100</span>
                    </span>
                    <ChevronRight className="h-3 w-3 text-white/30" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                  </div>
                </button>

                {/* Expanded: By Structure + Top Exact Boards */}
                {isExpanded && (
                  <div className="ml-4 mt-1 rounded-md border border-white/[0.04] bg-black/20 p-2.5">
                    {/* By Structure */}
                    {structBreakdown.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">By Structure</div>
                        <div className="space-y-0.5">
                          {structBreakdown.map((s, i) => (
                            <div key={i} className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-white/[0.03]">
                              <span className="text-[10px] text-white/55">{formatStructuralTag(s.tag as StructuralTag)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-white/35">{fmtInt(s.hands)} hands</span>
                                <span className="text-[10px] font-mono font-bold" style={{ color: resultColor(s.bb100) }}>{s.bb100 > 0 ? '+' : ''}{s.bb100} BB/100</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Exact Boards */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">Top Exact Boards</span>
                        <div className="flex gap-1">
                          {(['hands', 'best', 'worst'] as const).map((s) => (
                            <button key={s} onClick={() => { setExactSort(s); setShowAllExact(false); }} className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: exactSort === s ? 'rgba(212,165,44,0.12)' : 'transparent', color: exactSort === s ? GOLD_SOFT : 'rgba(255,255,255,0.3)' }}>
                              {s === 'hands' ? 'Most Hands' : s === 'best' ? 'Most Profit' : 'Least Profit'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        {(showAllExact ? exactBoardsForFamily : exactBoardsForFamily.slice(0, 5)).map((exact, eIdx) => {
                          const exactClass = String(exact.board_class);
                          const exactBB100 = finiteMetric(exact.bb100);
                          const exactHands = Number(exact.hands);
                          return (
                            <button
                              key={`e-${exactClass}-${eIdx}`}
                              onClick={() => setDrawerBoard(exactClass)}
                              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-white/[0.03]"
                            >
                              <span className="flex-1 text-[10px] font-bold text-white">{exactClass}</span>
                              <span className="text-[9px] text-white/35">{fmtInt(exactHands)} hands</span>
                              <span className="w-16 text-right text-[10px] font-mono font-bold" style={{ color: resultColor(exactBB100) }}>
                                {exactBB100 !== null && exactBB100 > 0 ? '+' : ''}{fmt(exactBB100)} BB/100
                              </span>
                              <ChevronRight className="h-3 w-3 text-white/20" />
                            </button>
                          );
                        })}
                      </div>
                      {exactBoardsForFamily.length > 5 && !showAllExact && (
                        <button onClick={() => setShowAllExact(true)} className="mt-1 w-full rounded border border-white/5 py-1 text-[9px] text-white/40 hover:text-white/60 hover:bg-white/[0.03]">
                          View All Exact Textures ({exactBoardsForFamily.length})
                        </button>
                      )}
                      {showAllExact && exactBoardsForFamily.length > 5 && (
                        <button onClick={() => setShowAllExact(false)} className="mt-1 w-full rounded border border-white/5 py-1 text-[9px] text-white/40 hover:text-white/60 hover:bg-white/[0.03]">
                          Show Less
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend Modal */}
      {showLegend && <FullLegendModal onClose={() => setShowLegend(false)} />}

      {/* Detail Drawer */}
      {drawerBoard && drawerData && (
        <DetailDrawer
          boardClass={drawerBoard}
          boardData={drawerData}
          onClose={() => setDrawerBoard(null)}
          onJumpToAnalyzer={onJumpToAnalyzer}
        />
      )}
    </Panel>
  );
}


const MINI_SUIT_SYMBOL: Record<string, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const MINI_SUIT_COLOR: Record<string, string> = { h: '#ef4444', d: '#ef4444', s: '#f8fafc', c: '#f8fafc' };

function splitCardStr(raw: string | null): string[] {
  if (!raw) return [];
  return raw.trim().split(/\s+/).filter(t => /^[2-9TJQKA][hdcs]$/i.test(t));
}

function MiniCard({ code }: { code: string }) {
  const rank = code.slice(0, -1).toUpperCase();
  const suit = code.slice(-1).toLowerCase();
  const symbol = MINI_SUIT_SYMBOL[suit] ?? '';
  const color = MINI_SUIT_COLOR[suit] ?? '#f8fafc';
  return (
    <span
      className="inline-flex h-[14px] w-[10px] flex-col items-center justify-center rounded-[2px] border leading-none sm:h-[18px] sm:w-[13px]"
      style={{ borderColor: 'rgba(255,255,255,0.12)', background: '#fbfaf6' }}
    >
      <span className="text-[7px] font-black leading-none sm:text-[8px]" style={{ color }}>{rank}</span>
      <span className="text-[5px] leading-none sm:text-[7px]" style={{ color }}>{symbol}</span>
    </span>
  );
}

function MiniCardRow({ cards }: { cards: string[] }) {
  if (cards.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-[2px]" style={{ flexWrap: 'nowrap' }}>
      {cards.map((c, i) => <MiniCard key={`${c}-${i}`} code={c} />)}
    </span>
  );
}

function RankOnlyCard({ rank, color }: { rank: string; color?: string }) {
  return (
    <span
      className="flex h-7 w-6 items-center justify-center rounded border text-[11px] font-black"
      style={color
        ? { borderColor: 'rgba(255,255,255,0.15)', background: color, color: '#ffffff' }
        : { borderColor: 'rgba(17,24,39,0.18)', background: '#f8f7f2', color: '#101114' }
      }
    >
      {rank}
    </span>
  );
}

// =============== TOURNAMENT ===============
export function TournamentTab({ snapshot, mode, trends }: TabProps) {
  if (mode !== 'mtt') {
    return (
      <Panel>
        <p className="text-[11px] text-white/30">Tournament analysis is only available for MTT mode.</p>
      </Panel>
    );
  }
  const t = snapshot.tournament_analysis;
  const s = snapshot.summary;
  return (
    <div className="space-y-3">
      <Panel>
        <SectionTitle>Tournament Summary</SectionTitle>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Events" value={fmtInt(t.tournamentEvents)} />
          <StatCard label="Total Entries" value={fmtInt(t.tournamentEntries)} sub={t.reEntries != null ? `${t.reEntries} re-entries` : undefined} />
          <StatCard label="Total Profit" value={fmtInt(t.profit)} color={resultColor(t.profit)} />
          <StatCard label="Biggest Win" value={s.biggestWin != null ? `+${fmt(s.biggestWin)} BB` : '—'} color="#ffffff" />
          <StatCard label="Biggest Loss" value={s.biggestLoss != null ? `${fmt(s.biggestLoss)} BB` : '—'} color="#ffffff" />
          <StatCard label="Hands" value={fmtInt(s.hands)} />
          <StatCard label="BB/100" value={fmt(s.bb100, 2)} color={resultColor(s.bb100)} statKey="bb100" {...tr(trends, 'bb100')} />
          <StatCard label="Active Days" value={fmtInt(s.activeDays)} />
        </div>
      </Panel>
      <Panel>
        <SectionTitle>Tournament Statistics</SectionTitle>
        <StatRow label="Events" value={fmtInt(t.tournamentEvents)} />
        <StatRow label="Total Entries" value={fmtInt(t.tournamentEntries)} />
        <StatRow label="Re-Entries" value={fmtInt(t.reEntries)} />
        <StatRow label="Total Profit/Loss (chips)" value={fmtInt(t.profit)} color={resultColor(t.profit)} />
        <StatRow label="Biggest Win (BB)" value={s.biggestWin != null ? `+${fmt(s.biggestWin)}` : '—'} color="#4ade80" />
        <StatRow label="Biggest Loss (BB)" value={fmt(s.biggestLoss)} color="#f87171" />
        <StatRow label="Avg Pot" value={fmtInt(Math.round(s.avgPot))} />
        <StatRow label="ROI" value={fmtPct(t.roi)} />
        <StatRow label="ABI" value={fmtInt(t.abi)} />
        <StatRow label="ITM %" value={fmtPct(t.itm)} />
      </Panel>
    </div>
  );
}

// =============== IMPORT IMPACT MODAL ===============
export interface ImportImpactData {
  statKey: string;
  statLabel: string;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  previousHandCount: number | null;
  currentHandCount: number;
  isFirstImport: boolean;
}

export function ImportImpactModal({ data, onClose }: { data: ImportImpactData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isPctKey = !['hands', 'activeDays', 'vpipCount', 'pfrCount', 'bb100', 'bbWon', 'evBb100', 'profit', 'reEntries'].includes(data.statKey);
  const formatValue = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return '—';
    if (isPctKey) return `${v.toFixed(1)}%`;
    if (data.statKey === 'bb100' || data.statKey === 'evBb100') return v.toFixed(2);
    if (data.statKey === 'bbWon' || data.statKey === 'profit') return v.toFixed(1);
    return Math.round(v).toLocaleString();
  };

  const formatDelta = (d: number | null) => {
    if (d == null) return '—';
    if (isPctKey) return `${d > 0 ? '+' : ''}${d.toFixed(1)} pp`;
    if (data.statKey === 'bb100' || data.statKey === 'evBb100') return `${d > 0 ? '+' : ''}${d.toFixed(2)}`;
    if (data.statKey === 'bbWon' || data.statKey === 'profit') return `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
    return `${d > 0 ? '+' : ''}${Math.round(d).toLocaleString()}`;
  };

  const deltaColor = data.delta == null ? 'rgba(255,255,255,0.3)' : data.delta > 0 ? '#4ade80' : data.delta < 0 ? '#f87171' : 'rgba(255,255,255,0.3)';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/10">
              <TrendingUp className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white">Import Impact</h3>
              <p className="text-[10px] text-white/40">{data.statLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 transition-colors hover:text-white">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {data.isFirstImport ? (
          <div className="rounded-lg border border-[#c0911e]/15 bg-[#c0911e]/5 px-4 py-6 text-center">
            <p className="text-[12px] font-bold text-[#f5e6b0]">Baseline established</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
              This is your first import. Trend comparisons will appear after your next import adds new hands.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Previous Total */}
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Previous Total</p>
                <p className="mt-0.5 text-[10px] text-white/35">
                  {data.previousHandCount != null ? `${data.previousHandCount.toLocaleString()} hands` : '—'}
                </p>
              </div>
              <span className="text-[16px] font-mono font-bold text-white/70">
                {formatValue(data.previousValue)}
              </span>
            </div>

            {/* Delta arrow */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1.5 rounded-full border px-3 py-1" style={{ borderColor: `${deltaColor}30`, background: `${deltaColor}10` }}>
                {data.delta == null || data.delta === 0 ? (
                  <Minus className="h-3 w-3" strokeWidth={2} style={{ color: deltaColor }} />
                ) : data.delta > 0 ? (
                  <TrendingUp className="h-3 w-3" strokeWidth={2} style={{ color: deltaColor }} />
                ) : (
                  <TrendingDown className="h-3 w-3" strokeWidth={2} style={{ color: deltaColor }} />
                )}
                <span className="text-[11px] font-mono font-bold" style={{ color: deltaColor }}>
                  {formatDelta(data.delta)}
                </span>
              </div>
            </div>

            {/* Updated Total */}
            <div className="flex items-center justify-between rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 px-4 py-3">
              <div>
                <p className="text-[9px] font-bold tracking-widest text-[#f5e6b0]/60 uppercase">Updated Total</p>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {data.currentHandCount.toLocaleString()} hands
                </p>
              </div>
              <span className="text-[16px] font-mono font-bold text-[#f5e6b0]">
                {formatValue(data.currentValue)}
              </span>
            </div>

            {/* Sample size context */}
            <div className="mt-3 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2.5">
              <p className="text-[10px] leading-relaxed text-white/45">
                {data.previousHandCount != null && (
                  <>Comparison covers {data.previousHandCount.toLocaleString()} previous hands vs {data.currentHandCount.toLocaleString()} updated hands. </>
                )}
                {data.currentHandCount < 500 && (
                  <span className="text-amber-400/60">Sample sizes under 500 hands may produce volatile trend indicators.</span>
                )}
                {data.currentHandCount >= 500 && (
                  <span>Trends are more reliable with larger samples.</span>
                )}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-semibold tracking-widest text-white/60 uppercase transition-colors hover:text-white"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
