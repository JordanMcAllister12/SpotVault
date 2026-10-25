import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp,
  Crown, Medal, Award, Eye, EyeOff, Loader2, Zap, Activity, Target,
  DollarSign, BarChart3, Waves, Flag, Star, Users, Shield,
  SkipForward, X, UserCircle, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Share2, Link as LinkIcon, Download, Twitter, Facebook, MoreHorizontal,
  CheckCircle2, RotateCcw,
} from 'lucide-react';
import { useSviVaultAudio } from '@/hooks/useSviVaultAudio';
import {
  fetchSviUser, fetchSviLeaderboard, fetchSviDivisionLeaderboard,
  fetchSviDivisionCounts, fetchSviSnapshots, fetchSviWeights,
  fetchSviUserRank, fetchSviHonors,
  calculateSviAll,
  revealSviScore, fetchFactorRank, setPrivacyMode, fetchPrivacyMode,
  fetchEvaluationStatus, checkRecalcEligibility, consumeEvaluation,
  sviTier, sviDivision, sviRank,
  SVI_DIVISIONS, SVI_RANKS, SVI_HONORS,
  type SviUserData, type SviLeaderboardEntry, type SviSnapshot,
  type SviWeight, type SviDivisionCount,
  type SviUserRank, type SviHonor, type SviFactorRank,
  type SviEvaluationStatus,
} from '@/lib/sviStore';
import { SviRankDisplay, HonorBadge, honorLabel, honorDesc } from '@/components/player/SviRankBadge';
import { SviPerformanceBreakdown } from '@/components/player/SviPerformanceBreakdown';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const SHELL_BG = 'rgba(6, 8, 10, 0.92)';
const SHELL_BORDER = 'rgba(212, 165, 44, 0.18)';

// Unified gold/charcoal palette — no multicolored factor cards
const FACTOR_COLORS: Record<string, string> = {
  bb100_percentile:       '#d4a52c',
  ev_luck_percentile:      '#d4a52c',
  abi_percentile:          '#d4a52c',
  roi_percentile:          '#d4a52c',
  sample_percentile:       '#d4a52c',
  consistency_percentile:  '#d4a52c',
  final_tables_percentile: '#d4a52c',
  largest_score_percentile:'#d4a52c',
  community_percentile:    '#d4a52c',
  reserve_percentile:      '#d4a52c',
};

const FACTOR_ICONS: Record<string, typeof Crown> = {
  bb100_percentile:       Activity,
  ev_luck_percentile:     Zap,
  abi_percentile:         DollarSign,
  roi_percentile:         TrendingUp,
  sample_percentile:      BarChart3,
  consistency_percentile: Waves,
  final_tables_percentile:Flag,
  largest_score_percentile:Star,
  community_percentile:   Users,
  reserve_percentile:     Shield,
};

const FACTOR_LABELS: Record<string, string> = {
  bb100_percentile:        'Raw BB/100',
  ev_luck_percentile:      'EV / Luck',
  abi_percentile:          'Stake Level',
  roi_percentile:          'Tournament ROI',
  sample_percentile:       'Sample Size',
  consistency_percentile:  'Consistency',
  final_tables_percentile: 'Final Tables',
  largest_score_percentile:'Largest Score',
  community_percentile:    'Community',
  reserve_percentile:      'ITM Finishes',
};

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  bb100_percentile:        'Your raw win rate in big blinds per 100 hands, adjusted for sample size.',
  ev_luck_percentile:      'Expected value vs actual results — measures how much of your score is skill vs luck.',
  abi_percentile:          'Average Buy-In across tournaments — indicates the stakes you compete at.',
  roi_percentile:          'Return on Investment from tournament play.',
  sample_percentile:       'Total hands analyzed — more data means more confidence in your score.',
  consistency_percentile:  'Tournament-to-tournament variance — lower variance means steadier results.',
  final_tables_percentile: 'Number of final tables reached and your final-table rate across tournaments.',
  largest_score_percentile:'Your single largest tournament cash.',
  community_percentile:    'Participation in the SpotVault community.',
  reserve_percentile:      'In-the-money finishes and applicable tournament finish performance.'
};

const FACTOR_KEYS = [
  'bb100_percentile', 'ev_luck_percentile', 'abi_percentile', 'roi_percentile', 'sample_percentile',
  'consistency_percentile', 'final_tables_percentile', 'largest_score_percentile', 'community_percentile', 'reserve_percentile',
] as const;

const ACTIVE_FACTOR_KEYS = FACTOR_KEYS;

const SVI_GOLD_BASE = '#4D3715';
const SVI_GOLD_MID = '#80601F';
const SVI_GOLD_HI = '#B78B37';
const SVI_GOLD_LIGHT = '#D7B45F';
const SHOW_VAULT_RANK = false;

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-4" style={{ borderColor: SHELL_BORDER, background: SHELL_BG, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">{children}</h4>;
}

const fmtNum = (v: number | null | undefined, d = 1) => v == null ? '—' : Number(v).toFixed(d);
const fmtInt = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString();
const fmtMoney = (v: number | null | undefined) => v == null ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function rankBadge(rank: number): { icon: typeof Crown; color: string } | null {
  if (rank === 1) return { icon: Crown, color: '#ffd700' };
  if (rank === 2) return { icon: Medal, color: '#c0c0c0' };
  if (rank === 3) return { icon: Award, color: '#cd7f32' };
  return null;
}

function ChangeArrow({ delta }: { delta: number | null }) {
  if (delta == null) return <Minus className="h-3 w-3 text-white/30" strokeWidth={2} />;
  if (delta > 0) return <TrendingUp className="h-3 w-3" strokeWidth={2} style={{ color: '#4ade80' }} />;
  if (delta < 0) return <TrendingDown className="h-3 w-3" strokeWidth={2} style={{ color: '#f87171' }} />;
  return <Minus className="h-3 w-3 text-white/30" strokeWidth={2} />;
}

function usePrefersReducedMotion() {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
}

// ════════════════════════════════════════════════════════════════
// VAULT MEDALLION — post-reveal gold SVI score display
// ════════════════════════════════════════════════════════════════
function VaultMedallion({ score, tierLabel, rank, totalEligible, size = 'full' }: {
  score: number; tierLabel: string; rank: number; totalEligible: number; size?: 'full' | 'mini';
}) {
  const dim = size === 'mini' ? 'h-20 w-20' : 'h-32 w-32 sm:h-40 sm:w-40';
  const scoreSize = size === 'mini' ? 'text-xl' : 'text-4xl sm:text-5xl';
  const labelSize = size === 'mini' ? 'text-[5px]' : 'text-[7px] sm:text-[8px]';
  const tierSize = size === 'mini' ? 'text-[6px]' : 'text-[8px] sm:text-[9px]';
  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="pointer-events-none absolute inset-0 rounded-full opacity-30 blur-2xl"
        style={{ background: `radial-gradient(circle, ${SVI_GOLD_LIGHT}40, transparent 70%)` }} />
      <div className={`relative flex ${dim} flex-col items-center justify-center overflow-hidden rounded-full border-2`}
        style={{
          borderColor: SVI_GOLD_LIGHT,
          background: `radial-gradient(circle at 35% 35%, ${SVI_GOLD_HI}, ${SVI_GOLD_BASE} 70%, #1a1208 100%)`,
          boxShadow: `inset 0 0 20px ${SVI_GOLD_LIGHT}33, inset 0 2px 0 ${SVI_GOLD_LIGHT}55, inset 0 -2px 0 rgba(0,0,0,0.4), 0 0 30px ${SVI_GOLD_HI}44, 0 4px 20px rgba(0,0,0,0.5)`,
        }}>
        <div className="pointer-events-none absolute inset-0 rounded-full opacity-50"
          style={{ background: `linear-gradient(135deg, ${SVI_GOLD_LIGHT}22 0%, transparent 40%, transparent 60%, ${SVI_GOLD_LIGHT}11 100%)` }} />
        <div className="pointer-events-none absolute inset-1.5 rounded-full border" style={{ borderColor: `${SVI_GOLD_HI}66` }} />
        <div className={`px-1 text-center font-bold tracking-[0.2em] uppercase ${labelSize}`} style={{ color: `${SVI_GOLD_LIGHT}aa` }}>{size === 'mini' ? 'SVI' : 'SpotVault Index'}</div>
        <div className={`mt-1 font-black leading-none ${scoreSize}`}
          style={{ color: SVI_GOLD_LIGHT, textShadow: `0 2px 8px ${SVI_GOLD_BASE}, 0 0 20px ${SVI_GOLD_HI}44` }}>
          {score > 0 ? score.toFixed(0) : '—'}
        </div>
        <div className={`mt-0.5 px-1 text-center font-bold tracking-wider uppercase ${tierSize}`} style={{ color: '#fff8d6' }}>{tierLabel}</div>
        {rank > 0 && totalEligible > 0 && (
          <div className={`mt-0.5 font-mono ${size === 'mini' ? 'text-[5px]' : 'text-[7px] sm:text-[8px]'}`} style={{ color: `${SVI_GOLD_LIGHT}88` }}>
            #{rank} / {totalEligible}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MECHANICAL VAULT DOOR — separate chamber and door layers
// ════════════════════════════════════════════════════════════════
function OpenVault({ state, score, tierLabel, rank, totalEligible }: {
  state: 'closed' | 'charging' | 'electricity' | 'release' | 'revealed';
  score?: number;
  tierLabel?: string;
  rank?: number;
  totalEligible?: number;
}) {
  const revealed = state === 'revealed';
  const release = state === 'release';
  const charging = state === 'charging';
  const electricity = state === 'electricity';
  const bolts = Array.from({ length: 12 });
  return (
    <div className="relative flex h-[270px] w-[270px] items-center justify-center sm:h-[300px] sm:w-[300px]" style={{ perspective: '1100px' }}>
      <style>{`
        @keyframes svi-chamber-breathe { 0%,100% { opacity:.72; transform:scale(.96); } 50% { opacity:1; transform:scale(1.04); } }
        @keyframes svi-vault-energy-pulse { 0%,100% { filter:brightness(1); box-shadow:inset 0 0 28px #ffd86b99, inset 0 0 70px #000, 0 0 38px ${SVI_GOLD_HI}66; } 50% { filter:brightness(1.35); box-shadow:inset 0 0 34px #fff0a8cc, inset 0 0 70px #000, 0 0 58px ${SVI_GOLD_LIGHT}; } }
        @keyframes svi-door-fly { 0% { transform:translate3d(-50%,-50%,0) rotate(0deg) scale(1); opacity:1; } 35% { transform:translate3d(calc(-50% + 30px),calc(-50% - 24px),24px) rotate(8deg) scale(.96); opacity:1; } 100% { transform:translate3d(calc(-50% + 220px),calc(-50% - 280px),100px) rotate(55deg) scale(.5); opacity:0; } }
        @keyframes svi-vault-rumble { 0%,100% { transform:translate(0,0); } 20% { transform:translate(-2px,1px); } 40% { transform:translate(2px,-1px); } 60% { transform:translate(-1px,2px); } 80% { transform:translate(1px,-2px); } }
        @keyframes svi-vault-smoke-rise { 0% { opacity:0; transform:translateY(12px) scale(.5); } 35% { opacity:.7; } 100% { opacity:0; transform:translateY(-62px) scale(1.45); } }
        @keyframes svi-score-chamber { 0% { opacity:0; transform:scale(.4) translateZ(0); } 65% { opacity:1; transform:scale(1.15) translateZ(34px); } 100% { opacity:1; transform:scale(1) translateZ(24px); } }
        .svi-vault-door-open { animation:svi-door-fly .95s cubic-bezier(.2,.8,.2,1) forwards; }
        .svi-vault-door-closed { transform:translate(-50%,-50%); }
        .svi-vault-chamber { animation:svi-chamber-breathe 2.4s ease-in-out infinite; }
        .svi-vault-energy-pulse { animation:svi-vault-energy-pulse .18s ease-in-out infinite; }
        .svi-vault-rumble { animation:svi-vault-rumble .06s linear infinite; }
        .svi-vault-smoke-puff { animation:svi-vault-smoke-rise 2.2s ease-out forwards; }
        .svi-vault-score-chamber { animation:svi-score-chamber .9s cubic-bezier(.2,.8,.2,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .svi-vault-door-open,.svi-vault-chamber,.svi-vault-energy-pulse,.svi-vault-rumble,.svi-vault-smoke-puff,.svi-vault-score-chamber { animation:none !important; }
        }
      `}</style>
      <div className="relative flex h-[170px] w-[190px] items-center justify-center rounded-[18px] border-2 bg-[#080706] shadow-[0_20px_45px_-20px_rgba(0,0,0,.95)] sm:h-[240px] sm:w-[260px]" style={{ borderColor: `${SVI_GOLD_HI}aa`, transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-3 rounded-[14px] border" style={{ borderColor: `${SVI_GOLD_MID}88`, background: 'linear-gradient(145deg,#17130c,#050403 62%,#211608)' }} />
        <div className={`svi-vault-chamber ${charging || electricity || release ? 'svi-vault-energy-pulse' : ''} ${charging ? 'svi-vault-rumble' : ''} relative z-[1] flex h-[124px] w-[124px] items-center justify-center rounded-full border-[8px] sm:h-[182px] sm:w-[182px] sm:border-[10px]`} style={{ borderColor: '#8c6a2f', background: 'radial-gradient(circle at 50% 48%, #fff1ae 0%, #d89b29 9%, #704714 33%, #190d03 68%, #030201 100%)', boxShadow: `inset 0 0 28px #ffd86b99, inset 0 0 70px #000, 0 0 38px ${SVI_GOLD_HI}88` }}>
          <div className="absolute inset-3 rounded-full border" style={{ borderColor: '#ffe39a66', background: 'repeating-conic-gradient(from 0deg, #ffd76a22 0deg 2deg, transparent 2deg 14deg)' }} />
          <div className="absolute inset-8 rounded-full border border-[#ffe5a0]/30" />
          {revealed && score != null && (
            <div className="svi-vault-score-chamber relative z-10 text-center" style={{ transformStyle: 'preserve-3d' }}>
              <div className="text-[7px] font-bold tracking-[.28em] text-[#fff1be] uppercase">Legacy SVI</div>
              <div className="text-5xl font-black leading-none text-[#fff3bd]" style={{ textShadow: '0 0 16px #fff0a8, 0 0 34px #d4a52c' }}>{score.toFixed(0)}</div>
              {tierLabel && <div className="mt-1 text-[8px] font-bold tracking-[.22em] text-white uppercase">{tierLabel}</div>}
              {SHOW_VAULT_RANK && rank != null && rank > 0 && totalEligible != null && totalEligible > 0 && <div className="mt-1 font-mono text-[7px] text-[#ffe7a0]/80">#{rank} / {totalEligible}</div>}
            </div>
          )}
          {!revealed && <div className="relative z-10 h-3 w-3 rounded-full bg-[#fff0a4] shadow-[0_0_20px_8px_rgba(255,210,90,.9)]" />}
        </div>
        {(release || revealed) && Array.from({ length: 12 }).map((_, i) => <span key={`smoke-${i}`} className="svi-vault-smoke-puff pointer-events-none absolute z-20 h-6 w-6 rounded-full blur-md" style={{ left: `${30 + (i % 4) * 12}%`, top: `${32 + Math.floor(i / 4) * 12}%`, animationDelay: `${i * 60}ms`, background: i % 3 === 0 ? 'rgba(107,93,74,0.4)' : 'rgba(216,203,178,0.25)' }} />)}
        <div className={`absolute left-1/2 top-1/2 z-10 flex h-[142px] w-[142px] items-center justify-center rounded-full border-[8px] bg-[radial-gradient(circle_at_35%_28%,#3b301d,#130f08_56%,#050403)] shadow-[inset_0_0_18px_rgba(0,0,0,.9),0_8px_24px_rgba(0,0,0,.75)] sm:h-[208px] sm:w-[208px] sm:border-[10px] ${release || revealed ? 'svi-vault-door-open' : 'svi-vault-door-closed'}`} style={{ borderColor: '#a37b35', transformOrigin: 'center center', transformStyle: 'preserve-3d', backfaceVisibility: 'visible', boxShadow: `inset 0 0 20px #000, 0 0 12px ${SVI_GOLD_HI}44` }}>
          <div className="absolute inset-3 rounded-full border" style={{ borderColor: `${SVI_GOLD_LIGHT}66` }} />
          {bolts.map((_, i) => { const angle = i * 30; return <span key={`bolt-${i}`} className="absolute h-2.5 w-2.5 rounded-full border border-[#f2c86b] bg-[#24170a] shadow-[0_0_5px_rgba(212,165,44,.7)]" style={{ left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * 78}px - 5px)`, top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * 78}px - 5px)` }} />; })}
          <div className="absolute h-28 w-2 rotate-45 rounded-full bg-gradient-to-b from-[#d7b45f] via-[#3b2a13] to-[#d7b45f] shadow-[0_0_8px_#d4a52c]" />
          <div className="absolute h-28 w-2 -rotate-45 rounded-full bg-gradient-to-b from-[#d7b45f] via-[#3b2a13] to-[#d7b45f] shadow-[0_0_8px_#d4a52c]" />
          <div className="relative z-10 h-11 w-11 rounded-full border-4 border-[#d7b45f] bg-[#140d04] shadow-[inset_0_0_10px_#000,0_0_8px_#d4a52c]" />
        </div>
      </div>
    </div>
  );
}

function MechanicalVault({ state, score, tierLabel, rank, totalEligible }: {
  state: 'closed' | 'charging' | 'electricity' | 'release' | 'revealed';
  score?: number;
  tierLabel?: string;
  rank?: number;
  totalEligible?: number;
}) {
  return <OpenVault state={state} score={score} tierLabel={tierLabel} rank={rank} totalEligible={totalEligible} />;
}

// ════════════════════════════════════════════════════════════════
// CHARGING METER — circular segmented charging ring beneath vault
// ~35% of vault diameter, black bg with gold detailing,
// central battery indicator, neon electric blue/amber/gold accents
// ════════════════════════════════════════════════════════════════
function ChargingMeter({ chargeLevel }: { chargeLevel: number }) {
  const prefersReduced = usePrefersReducedMotion();
  const meterSize = 72;
  const mc = meterSize / 2;
  const segments = 16;
  const clampedLevel = Math.min(1, Math.max(0, chargeLevel));
  const filledSegments = Math.round(clampedLevel * segments);

  return (
    <div className="relative flex flex-col items-center" style={{ width: meterSize, height: meterSize + 14 }}>
      <style>{`
        @keyframes svi-meter-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .svi-meter-segment-active { animation: svi-meter-pulse 0.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .svi-meter-segment-active { animation: none !important; }
        }
      `}</style>
      <svg width={meterSize} height={meterSize} viewBox={`0 0 ${meterSize} ${meterSize}`}>
        <defs>
          <radialGradient id="meter-bg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#0a0804" />
            <stop offset="100%" stopColor="#050302" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx={mc} cy={mc} r={mc - 2} fill="url(#meter-bg)" stroke={SVI_GOLD_BASE} strokeWidth="0.5" />

        {/* Segmented ring */}
        {Array.from({ length: segments }).map((_, i) => {
          const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
          const innerR = mc - 8;
          const outerR = mc - 4;
          const x1 = mc + Math.cos(angle) * innerR;
          const y1 = mc + Math.sin(angle) * innerR;
          const x2 = mc + Math.cos(angle) * outerR;
          const y2 = mc + Math.sin(angle) * outerR;
          const isActive = i < filledSegments;
          const color = isActive
            ? i >= segments * 0.8 ? '#3b9eff' : i >= segments * 0.5 ? '#fbbf24' : SVI_GOLD_LIGHT
            : '#2a2010';
          return (
            <line key={`seg-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth="2" strokeLinecap="round"
              className={isActive && !prefersReduced ? 'svi-meter-segment-active' : ''}
              style={{ filter: isActive ? `drop-shadow(0 0 2px ${color})` : 'none', animationDelay: `${i * 0.04}s` }} />
          );
        })}

        {/* Central battery indicator */}
        <rect x={mc - 10} y={mc - 6} width="20" height="12" rx="2" fill="none" stroke={SVI_GOLD_HI} strokeWidth="0.8" />
        <rect x={mc + 10} y={mc - 3} width="3" height="6" rx="1" fill={SVI_GOLD_HI} />
        <rect x={mc - 9} y={mc - 5} width={Math.max(0, 18 * clampedLevel)} height="10" rx="1"
          fill={clampedLevel >= 0.8 ? '#3b9eff' : clampedLevel >= 0.5 ? '#fbbf24' : SVI_GOLD_LIGHT}
          style={{ filter: `drop-shadow(0 0 3px ${clampedLevel >= 0.8 ? '#3b9eff' : clampedLevel >= 0.5 ? '#fbbf24' : SVI_GOLD_LIGHT})` }} />

        {/* Outer gold ring detail */}
        <circle cx={mc} cy={mc} r={mc - 2} fill="none" stroke={`${SVI_GOLD_HI}44`} strokeWidth="0.3" />
      </svg>
      <div className="mt-1 text-[6px] font-bold tracking-[0.2em] uppercase" style={{ color: clampedLevel >= 0.8 ? '#3b9eff' : SVI_GOLD_LIGHT }}>
        {clampedLevel >= 1 ? 'FULL CHARGE' : clampedLevel >= 0.5 ? 'CHARGING' : 'IDLE'}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CLOSED VAULT — pre-reveal state with Calculate button
// Score is NOT shown — concealed until reveal
// ════════════════════════════════════════════════════════════════
function ClosedVault({ onCalculate, disabled, hasData }: { onCalculate: () => void; disabled: boolean; hasData: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      <MechanicalVault state="closed" />
      {!hasData && (
        <p className="mt-3 max-w-xs text-center text-[9px] leading-relaxed text-white/35">
          Your SVI score will appear on the leaderboard once you calculate it. You can display as anonymous to hide your identity.
        </p>
      )}
      <button onClick={onCalculate} disabled={disabled}
        className="svi-calc-btn mt-4 flex items-center gap-2 rounded-lg px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-[1.03] disabled:opacity-50"
        style={{
          borderColor: SVI_GOLD_LIGHT,
          borderWidth: 1.5,
          color: '#1a1304',
          background: `linear-gradient(135deg, ${SVI_GOLD_LIGHT}, ${SVI_GOLD_HI})`,
          boxShadow: `0 0 20px ${SVI_GOLD_HI}66, 0 4px 12px rgba(0,0,0,0.4)`,
        }}>
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Zap className="h-4 w-4" strokeWidth={2} />}
        {disabled ? 'Calculating...' : 'Calculate SVI'}
      </button>
    </div>
  );
}



// ════════════════════════════════════════════════════════════════
// FACTOR CARD — shows actual player statistics + global rank
// ════════════════════════════════════════════════════════════════
function FactorCard({ factorKey, percentile, detail, index, animateIn, illuminated, charged, factorRank, size = 'full' }: {
  factorKey: string;
  percentile: number;
  detail: Record<string, unknown> | undefined;
  index: number;
  animateIn: boolean;
  charged?: boolean;
  factorRank?: SviFactorRank | null;
  size?: 'full' | 'mini';
}) {
  const color = FACTOR_COLORS[factorKey] ?? '#9ca3af';
  const Icon = FACTOR_ICONS[factorKey] ?? Activity;
  const label = FACTOR_LABELS[factorKey] ?? factorKey;

  const rawVal = detail?.raw as number | undefined;
  const available = detail?.available as boolean | undefined;
  const isAvailable = available !== false;

  const displayValue = (() => {
    if (!isAvailable) return 'Unavailable';
    if (factorKey === 'bb100_percentile') return rawVal != null ? fmtNum(rawVal, 2) : '—';
    if (factorKey === 'abi_percentile') return rawVal != null ? fmtMoney(rawVal) : '—';
    if (factorKey === 'roi_percentile') return rawVal != null ? `${rawVal.toFixed(1)}%` : '—';
    if (factorKey === 'sample_percentile') {
      const hands = detail?.hands as number | undefined;
      return hands != null ? fmtInt(hands) : '—';
    }
    if (factorKey === 'final_tables_percentile') {
      const ft = detail?.profitable as number | undefined;
      const tot = detail?.total as number | undefined;
      if (ft != null && tot != null && tot > 0) return `${ft}/${tot} (${(ft / tot * 100).toFixed(0)}%)`;
      return ft != null ? `${ft}` : '—';
    }
    if (factorKey === 'largest_score_percentile') return rawVal != null ? fmtMoney(rawVal) : '—';
    if (factorKey === 'community_percentile') {
      const msgs = detail?.messages as number | undefined;
      return msgs != null ? fmtInt(msgs) : '—';
    }
    if (factorKey === 'reserve_percentile') {
      const finishes = detail?.itm_finishes as number | undefined ?? detail?.finishes as number | undefined;
      return finishes != null ? fmtInt(finishes) : '—';
    }
    if (factorKey === 'ev_luck_percentile') {
      const ev = detail?.ev_bb100 as number | undefined;
      return ev != null ? fmtNum(ev, 2) : '—';
    }
    if (factorKey === 'consistency_percentile') {
      const stddev = detail?.stddev as number | undefined;
      return stddev != null ? fmtNum(stddev, 2) : '—';
    }
    return '—';
  })();

  const mini = size === 'mini';

  return (
    <div
      className="relative overflow-hidden rounded-lg border px-2.5 py-2 transition-all sm:px-3 sm:py-2.5"
      style={{
        borderColor: charged ? `${SVI_GOLD_LIGHT}` : `${SVI_GOLD_BASE}66`,
        background: charged ? 'linear-gradient(135deg, rgba(212,165,44,0.15), rgba(10,9,8,0.95) 56%)' : 'rgba(10,9,8,0.92)',
        boxShadow: charged ? `0 0 18px ${SVI_GOLD_HI}55, inset 0 0 10px ${SVI_GOLD_BASE}33` : animateIn ? `0 1px 6px rgba(0,0,0,0.4)` : 'none',
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 0.4s ease ${index * 0.08}s, transform 0.4s ease ${index * 0.08}s, box-shadow 0.4s ease, border-color 0.4s ease`,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: SVI_GOLD_MID, boxShadow: `0 0 4px ${SVI_GOLD_HI}55` }} />
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2} style={{ color: SVI_GOLD_LIGHT }} />
        <span className={`font-bold tracking-wider uppercase text-white/70 ${mini ? 'text-[7px]' : 'text-[8px] sm:text-[9px]'}`}>{label}</span>
        {!isAvailable && (
          <span className="ml-auto text-[6px] font-bold uppercase tracking-wider text-white/25">N/A</span>
        )}
      </div>
      {/* Primary display: actual stat value */}
      <div className={`mt-1 font-mono font-bold ${mini ? 'text-[10px]' : 'text-[12px] sm:text-[13px]'}`} style={{ color: isAvailable ? '#fff' : '#ffffff44' }}>
        {displayValue}
      </div>
      {/* Secondary: percentile + global rank (no colored bar) */}
      <div className="mt-1 flex items-center justify-between gap-1.5">
        <span className={`font-mono font-bold ${mini ? 'text-[8px]' : 'text-[10px] sm:text-[11px]'}`} style={{ color: isAvailable ? SVI_GOLD_LIGHT : '#ffffff44' }}>
          {isAvailable ? percentile.toFixed(0) : '50'}<span className="text-white/30"> pct</span>
        </span>
        {isAvailable && factorRank && factorRank.total > 0 && (
          <span className={`font-mono ${mini ? 'text-[7px]' : 'text-[8px] sm:text-[9px]'}`} style={{ color: 'rgba(255,255,255,0.45)' }}>
            #{factorRank.rank} / {factorRank.total}
          </span>
        )}
      </div>
    </div>
  );
}

function CentralCharger({ active }: { active: boolean }) {
  return (
    <div className={`relative z-10 mb-1 flex h-10 w-10 items-center justify-center rounded-full border ${active ? 'animate-pulse' : ''}`} style={{ borderColor: active ? SVI_GOLD_LIGHT : SVI_GOLD_MID, background: 'radial-gradient(circle, #f4d477 0%, #4c3210 28%, #090704 70%)', boxShadow: active ? `0 0 18px ${SVI_GOLD_LIGHT}, 0 0 34px ${SVI_GOLD_HI}88` : `0 0 8px ${SVI_GOLD_BASE}` }}>
      <Zap className="h-4 w-4" style={{ color: active ? '#fff1b0' : SVI_GOLD_MID }} strokeWidth={1.7} />
      <span className="absolute -bottom-3 whitespace-nowrap text-[6px] font-bold tracking-[.18em] text-[#d7b45f] uppercase">{active ? 'Power flow' : 'Charger'}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ELECTRICAL CONNECTIONS — directed energy flow from charger to cards and back
// ════════════════════════════════════════════════════════════════
function ElectricalConnections({ animateIn, active, phase = 'idle' }: { animateIn: boolean; active?: boolean; phase?: 'idle' | 'outbound' | 'return' | 'charged' }) {
  const flowing = active || phase !== 'idle';
  const prefersReduced = usePrefersReducedMotion();
  if (prefersReduced) return null;

  const keys = ACTIVE_FACTOR_KEYS;
  const leftCount = 5;
  const rightCount = keys.length - 5;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
      <style>{`
        @keyframes svi-pulse-flow {
          0% { stroke-dashoffset: 20; opacity: ${active ? 0.6 : 0.2}; }
          50% { opacity: ${active ? 1 : 0.45}; }
          100% { stroke-dashoffset: 0; opacity: ${active ? 0.6 : 0.2}; }
        }
        @keyframes svi-pulse-flow-main {
          0% { stroke-dashoffset: 20; opacity: 0.8; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.8; }
        }
        .svi-connection {
          stroke-dasharray: 4 4;
          animation: svi-pulse-flow ${active ? '0.15s' : '2s'} ease-in-out infinite;
        }
        .svi-connection-main {
          stroke-dasharray: 6 3;
          animation: svi-pulse-flow-main ${active ? '0.1s' : '1.5s'} ease-in-out infinite;
        }
      `}</style>
      {/* Left column: horizontal ~75% toward center, 90° bend down/up to center, then into vault */}
      {keys.slice(0, leftCount).map((_, i) => {
        const yPct = 10 + i * 20;
        const centerPct = 50;
        return (
          <g key={`l-${i}`} className="svi-connection" style={{ animationDelay: `${i * 0.1}s`, opacity: animateIn ? undefined : 0, transition: `opacity 0.6s ease ${0.4 + i * 0.08}s` }}>
            <line x1="0" y1={`${yPct}%`} x2="37%" y2={`${yPct}%`} stroke={flowing ? SVI_GOLD_LIGHT : SVI_GOLD_MID} strokeWidth={flowing ? 2.5 : 0.8} style={flowing ? { filter: `drop-shadow(0 0 3px ${SVI_GOLD_LIGHT})`, animationDirection: phase === 'return' ? 'reverse' : 'normal' } : undefined} />
            <line x1="37%" y1={`${yPct}%`} x2="37%" y2={`${centerPct}%`} stroke={flowing ? SVI_GOLD_LIGHT : SVI_GOLD_MID} strokeWidth={flowing ? 2.5 : 0.8} style={flowing ? { filter: `drop-shadow(0 0 3px ${SVI_GOLD_LIGHT})`, animationDirection: phase === 'return' ? 'reverse' : 'normal' } : undefined} />
          </g>
        );
      })}
      {/* Right column: horizontal ~75% toward center, 90° bend down/up to center */}
      {keys.slice(5).map((_, i) => {
        const yPct = 10 + i * (100 / Math.max(rightCount, 1));
        const centerPct = 50;
        return (
          <g key={`r-${i}`} className="svi-connection" style={{ animationDelay: `${(5 + i) * 0.1}s`, opacity: animateIn ? undefined : 0, transition: `opacity 0.6s ease ${0.4 + (5 + i) * 0.08}s` }}>
            <line x1="100%" y1={`${yPct}%`} x2="63%" y2={`${yPct}%`} stroke={flowing ? SVI_GOLD_LIGHT : SVI_GOLD_MID} strokeWidth={flowing ? 2.5 : 0.8} style={flowing ? { filter: `drop-shadow(0 0 3px ${SVI_GOLD_LIGHT})`, animationDirection: phase === 'return' ? 'reverse' : 'normal' } : undefined} />
            <line x1="63%" y1={`${yPct}%`} x2="63%" y2={`${centerPct}%`} stroke={flowing ? SVI_GOLD_LIGHT : SVI_GOLD_MID} strokeWidth={flowing ? 2.5 : 0.8} style={flowing ? { filter: `drop-shadow(0 0 3px ${SVI_GOLD_LIGHT})`, animationDirection: phase === 'return' ? 'reverse' : 'normal' } : undefined} />
          </g>
        );
      })}
      {/* Single main electrical feed: left bus + right bus combine at center junction, route into vault */}
      <g className="svi-connection-main" style={{ opacity: animateIn ? undefined : 0, transition: 'opacity 0.6s ease 0.8s' }}>
        {/* Left vertical bus */}
        <line x1="37%" y1="10%" x2="37%" y2="50%" stroke={flowing ? SVI_GOLD_LIGHT : SVI_GOLD_MID} strokeWidth={flowing ? 3 : 0.8} style={flowing ? { filter: `drop-shadow(0 0 4px ${SVI_GOLD_LIGHT})` } : undefined} />
        {/* Right vertical bus */}
        <line x1="63%" y1="10%" x2="63%" y2="50%" stroke={flowing ? SVI_GOLD_LIGHT : SVI_GOLD_MID} strokeWidth={flowing ? 3 : 0.8} style={flowing ? { filter: `drop-shadow(0 0 4px ${SVI_GOLD_LIGHT})` } : undefined} />
        {/* Combined main feed from junction to vault center */}
        <line x1="37%" y1="50%" x2="50%" y2="50%" stroke={SVI_GOLD_HI} strokeWidth={flowing ? 4 : 1} style={flowing ? { filter: `drop-shadow(0 0 6px ${SVI_GOLD_LIGHT})` } : undefined} />
        <line x1="63%" y1="50%" x2="50%" y2="50%" stroke={SVI_GOLD_HI} strokeWidth={flowing ? 4 : 1} style={flowing ? { filter: `drop-shadow(0 0 6px ${SVI_GOLD_LIGHT})` } : undefined} />
        {/* Junction node */}
        <circle cx="50%" cy="50%" r={flowing ? 4 : 2} fill={SVI_GOLD_HI} style={{ filter: flowing ? `drop-shadow(0 0 6px ${SVI_GOLD_LIGHT})` : 'none' }} />
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════
// VAULT EXPLOSION OVERLAY — mechanical vault opening sequence
// Phase 1: charging (electrical energy enters, handle rotates)
// Phase 2: detonating (locks disengage, sparks)
// Phase 3: lidEjecting (door swings open, smoke)
// Phase 4: smokeReveal + revealed (gold illumination, score shown)
// ════════════════════════════════════════════════════════════════
type AnimState = 'closed' | 'charging' | 'electricity' | 'release' | 'revealed';

function VaultExplosionOverlay({ score, tierLabel, animState, rank, totalEligible }: { score: number; tierLabel: string; animState: AnimState; rank?: number; totalEligible?: number }) {
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    return (
      <div className="relative flex flex-col items-center justify-center py-4">
        <MechanicalVault state="revealed" score={score} tierLabel={tierLabel} rank={rank} totalEligible={totalEligible} />
      </div>
    );
  }

  const isActive = animState === 'release' || animState === 'revealed';
  const vaultState: 'release' | 'revealed' = animState === 'release' ? 'release' : 'revealed';

  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      <style>{`
        @keyframes svi-gold-illuminate {
          0% { opacity: 0; transform: scale(0.4); }
          40% { opacity: 1; transform: scale(1.3); }
          100% { opacity: 0.4; transform: scale(1); }
        }
        @keyframes svi-smoke-burst {
          0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
          20% { opacity: 0.7; }
          100% { opacity: 0; transform: translate(20px, -60px) scale(2.5); }
        }
        @keyframes svi-score-emerge {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes svi-sparks-fly {
          0% { opacity: 0; transform: translate(0, 0); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)); }
        }
        .svi-vault-illuminate { animation: svi-gold-illuminate 1.5s ease-out 0.3s forwards; opacity: 0; }
        .svi-vault-smoke { animation: svi-smoke-burst 2s ease-out 0.5s forwards; opacity: 0; }
        .svi-vault-score-emerge { animation: svi-score-emerge 1s ease-out 0.8s forwards; opacity: 0; }
        .svi-vault-spark { animation: svi-sparks-fly 0.8s ease-out forwards; opacity: 0; }
        @keyframes svi-shockwave {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
      `}</style>

      <div className="relative flex h-[300px] w-[270px] items-center justify-center sm:h-[330px] sm:w-[300px]">
        {/* Gold illumination burst */}
        {isActive && (
          <div className="svi-vault-illuminate pointer-events-none absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${SVI_GOLD_LIGHT}, ${SVI_GOLD_HI}40, transparent 70%)` }} />
        )}

        {/* Sparks during detonation — increased count for more dramatic effect */}
        {animState === 'release' && Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const sx = Math.cos(angle) * 70;
          const sy = Math.sin(angle) * 70;
          return (
            <div key={`spark-${i}`} className="svi-vault-spark pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{
                background: SVI_GOLD_LIGHT,
                ['--sx' as string]: `${sx}px`,
                ['--sy' as string]: `${sy}px`,
                animationDelay: `${i * 0.02}s`,
                boxShadow: `0 0 6px ${SVI_GOLD_LIGHT}`,
              } as React.CSSProperties} />
          );
        })}

        {/* Shockwave ring during detonation */}
        {animState === 'release' && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              borderColor: SVI_GOLD_LIGHT,
              width: 40,
              height: 40,
              animation: 'svi-shockwave 0.6s ease-out forwards',
              boxShadow: `0 0 10px ${SVI_GOLD_LIGHT}`,
            }} />
        )}

        {/* Smoke clouds during lid ejection — multiple bursts for dramatic effect */}
        {animState === 'release' && Array.from({ length: 6 }).map((_, i) => (
          <div key={`smoke-cloud-${i}`} className="svi-vault-smoke pointer-events-none absolute rounded-full blur-lg"
            style={{ left: `${38 + (i % 3) * 12}%`, top: `${38 + Math.floor(i / 3) * 14}%`, width: 90, height: 90, background: 'radial-gradient(circle, rgba(120,110,95,0.5), transparent 60%)', animationDelay: `${i * 0.08}s` }} />
        ))}

        {/* Mechanical vault */}
        <MechanicalVault state={vaultState} score={animState === 'revealed' ? score : undefined} tierLabel={animState === 'revealed' ? tierLabel : undefined} rank={animState === 'revealed' ? rank : undefined} totalEligible={animState === 'revealed' ? totalEligible : undefined} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SVI STATIC SUMMARY — default black-and-gold panel shown instead of
// auto-playing the vault animation. Shows current score, rank, hands,
// last evaluation date, new hands since eval, cooldown/eligibility status.
// Animation only triggers on explicit Calculate or Replay action.
// ════════════════════════════════════════════════════════════════
function SviStaticSummary({ data, rankData, evalStatus, onCalculate, onReplayAnimation, onExpand, previousScore, canRecalculate, recalculating, honors, weights }: {
  data: SviUserData;
  rankData: SviUserRank | null;
  evalStatus: SviEvaluationStatus | null;
  onCalculate: () => void;
  onReplayAnimation: () => void;
  onExpand: () => void;
  previousScore?: number;
  canRecalculate: boolean;
  recalculating: boolean;
  honors: SviHonor[];
  weights: SviWeight[];
}) {
  const revealed = data.reveal_completed === true && data.svi_score > 0;
  const tier = sviTier(data.svi_score);
  const div = sviDivision(data.abi);
  const militaryRank = rankData ? sviRank(rankData.division_rank, rankData.total_in_division) : null;
  const scoreDelta = previousScore != null && data.svi_score > 0 ? data.svi_score - previousScore : null;
  const percentile = data.total_eligible > 0 && data.overall_rank > 0
    ? ((data.total_eligible - data.overall_rank) / data.total_eligible) * 100
    : null;

  const lastEvalAt = evalStatus?.last_evaluation_at;
  const handsAtLastEval = evalStatus?.hands_at_last_eval;
  const eligibleReady = canRecalculate;

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return '—'; }
  };

  return (
    <div className="relative p-4">
      {/* Header bar with score medallion */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border"
            style={{ borderColor: `${SVI_GOLD_HI}44`, background: `${SVI_GOLD_BASE}11` }}>
            <span className="text-[8px] font-bold tracking-wider text-white/40 uppercase">Legacy SVI</span>
            <span className="text-2xl font-black" style={{ color: SVI_GOLD_LIGHT }}>{revealed ? data.svi_score.toFixed(0) : '—'}</span>
          </div>
          <div>
            <div className="text-[13px] font-bold text-white">{tier.label}</div>
            {militaryRank && (
              <div className="mt-0.5 text-[11px] font-bold" style={{ color: militaryRank.color }}>
                {militaryRank.label}
              </div>
            )}
            {data.overall_rank > 0 && (
              <div className="text-[10px] text-white/40">
                Global #{data.overall_rank}
                {percentile != null && <span className="ml-2 text-white/35">{percentile.toFixed(0)}%</span>}
              </div>
            )}
          </div>
        </div>
        {scoreDelta != null && revealed && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <ChangeArrow delta={scoreDelta} />
            <span className="font-mono font-bold" style={{ color: scoreDelta > 0 ? '#4ade80' : scoreDelta < 0 ? '#f87171' : '#9ca3af' }}>
              {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Summary stats grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${SVI_GOLD_HI}33`, background: 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Hands Evaluated</div>
          <div className="mt-0.5 text-[14px] font-mono font-bold text-white">{fmtInt(handsAtLastEval != null && handsAtLastEval > 0 ? handsAtLastEval : data.eligible_hands)}</div>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${SVI_GOLD_HI}33`, background: 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Tournaments</div>
          <div className="mt-0.5 text-[14px] font-mono font-bold text-white">{fmtInt(data.eligible_tournaments)}</div>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${SVI_GOLD_HI}33`, background: 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Class</div>
          <div className="mt-0.5 text-[12px] font-bold text-white">{div ? div.label : '—'}</div>
          <div className="text-[8px] text-white/35">{fmtMoney(data.abi)} ABI</div>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${SVI_GOLD_HI}33`, background: 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Last Evaluation</div>
          <div className="mt-0.5 text-[11px] font-bold text-white">{formatDate(lastEvalAt ?? data.calculated_at)}</div>
        </div>
      </div>

      {/* Action buttons — standardized: black bg, gold border, white text */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Recalculate / Calculate button */}
        <button
          onClick={onCalculate}
          disabled={!eligibleReady || recalculating}
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          style={{
            borderColor: 'rgba(212,165,44,0.4)',
            color: '#ffffff',
            background: '#0c0a08',
          }}
        >
          {recalculating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          {revealed ? 'Recalculate SVI' : 'Calculate SVI'}
        </button>

        {/* Display Animation button — visual only, only if already revealed */}
        {revealed && (
          <button
            onClick={onReplayAnimation}
            disabled={recalculating}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-40"
            style={{ borderColor: 'rgba(212,165,44,0.4)', color: '#ffffff', background: '#0c0a08' }}
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} /> Display Animation
          </button>
        )}

        {/* Details button */}
        {revealed && (
          <button
            onClick={onExpand}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
            style={{ borderColor: 'rgba(212,165,44,0.4)', color: '#ffffff', background: '#0c0a08' }}
          >
            <Info className="h-3.5 w-3.5" strokeWidth={1.5} /> Details
          </button>
        )}
      </div>

      {/* Score change note */}
      {scoreDelta != null && revealed && (
        <div className="mt-2 text-[9px] text-white/30">
          Score change since last snapshot: {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} points
        </div>
      )}

      {/* Consolidated Military Rank & Honors / About SVI — compact expandable */}
      <SviConsolidatedInfo rankData={rankData} honors={honors} sviData={data} weights={weights} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONSOLIDATED INFO — compact expandable Military Rank & Honors / About SVI
// Integrated into the Evaluation Center (replaces standalone SviRankInfoSection)
// ════════════════════════════════════════════════════════════════
function SviConsolidatedInfo({ rankData, honors, sviData, weights }: {
  rankData: SviUserRank | null;
  honors: SviHonor[];
  sviData: SviUserData;
  weights: SviWeight[];
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<0 | 1>(0);
  const revealed = sviData.reveal_completed === true;

  return (
    <div className="mt-3 rounded-lg border" style={{ borderColor: `${SVI_GOLD_BASE}33` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-[9px] font-bold tracking-[0.18em] text-white/70 uppercase">Military Rank, Honors &amp; SVI Info</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} /> : <ChevronDown className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-3 border-t p-3 lg:grid-cols-[55%_45%]" style={{ borderColor: `${SVI_GOLD_BASE}22` }}>
          {/* Military Rank & Honors */}
          <div className="lg:border-r lg:pr-3" style={{ borderColor: `${SVI_GOLD_BASE}22` }}>
            <div className="mb-2 text-[9px] font-bold tracking-widest text-white uppercase">Military Rank &amp; Honors</div>
            {revealed && (rankData || honors.length > 0) ? (
              <SviRankDisplay rankData={rankData} honors={honors} />
            ) : (
              <div className="flex items-center gap-2 py-3 text-[10px] text-white/35">
                <Shield className="h-6 w-6 text-white/15" strokeWidth={1.5} />
                {sviData ? 'Reveal your SVI to earn a rank' : 'No SVI score yet'}
              </div>
            )}
          </div>
          {/* About SVI / How SVI Is Calculated */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(0)} disabled={page === 0} className="rounded p-0.5 text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-25"><ChevronLeft className="h-3 w-3" /></button>
                <span className="text-[9px] font-bold tracking-widest text-white uppercase">{page === 0 ? 'About SVI' : 'How SVI Is Calculated'}</span>
                <button onClick={() => setPage(1)} disabled={page === 1} className="rounded p-0.5 text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-25"><ChevronRight className="h-3 w-3" /></button>
              </div>
              <span className="text-[8px] font-mono text-white/30">{page + 1} / 2</span>
            </div>
            {page === 0 ? (
              <div className="space-y-1.5 text-[10px] leading-relaxed text-white/50">
                <p>The SpotVault Index (SVI) measures tournament poker skill on a 1&ndash;100 scale using ten factors: win rate, EV-adjusted luck, stake level, ROI, sample size, consistency, ITM finishes, largest score, and community participation.</p>
                <p>Scores are rank-normalized: your position among all eligible players determines your SVI.</p>
              </div>
            ) : (
              <div className="space-y-1.5 text-[10px] leading-relaxed text-white/45">
                <p>Your SVI is computed from ten performance factors, each measured against all eligible players and converted to a percentile rank.</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {ACTIVE_FACTOR_KEYS.map(key => {
                    const w = weights.find(item => item.factor_key === key);
                    const Icon = FACTOR_ICONS[key] ?? Activity;
                    return (
                      <div key={key} className="flex items-start gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-1">
                        <Icon className="mt-0.5 h-2.5 w-2.5 shrink-0" style={{ color: SVI_GOLD_LIGHT }} />
                        <div>
                          <div className="text-[9px] font-bold text-white/70">{FACTOR_LABELS[key] ?? key}</div>
                          <div className="text-[8px] text-white/35">{FACTOR_DESCRIPTIONS[key] ?? w?.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-white/35"><span className="font-bold text-white/50">Formula:</span> SVI = 1 + 99 &times; (N &minus; R) / (N &minus; 1).</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SVI EVALUATION CENTER — main vault + factor cards experience
// 5-phase cinematic reveal:
//   Phase 1 (0–0.5s):   Initialization — activation click + hum
//   Phase 2 (0.5–2.0s): Power transfer — 5-10x electrical intensity
//   Phase 3 (1.0–2.8s): Charging meter fills
//   Phase 4 (2.8–3.5s): Vault explosion — lid detaches, shockwave, smoke
//   Phase 5 (3.5–5.0s): Score reveal — smoke clears, gold illumination, chime
// ════════════════════════════════════════════════════════════════
function SviEvaluationCenter({ data, weights, onCalculate, onReveal, onExpand, previousScore, factorRanks, rankData, evalStatus, honors }: {
  data: SviUserData;
  weights: SviWeight[];
  onCalculate: () => Promise<void>;
  onReveal: () => Promise<void>;
  onExpand: () => void;
  previousScore?: number;
  factorRanks: Record<string, SviFactorRank | null>;
  rankData: SviUserRank | null;
  evalStatus: SviEvaluationStatus | null;
  honors: SviHonor[];
}) {
  const prefersReduced = usePrefersReducedMotion();
  const { play, muted, setMuted } = useSviVaultAudio();
  const revealed = data.reveal_completed === true && data.svi_score > 0;

  // viewMode: 'summary' = static panel (always default), 'animation' = vault animation playing
  const [viewMode, setViewMode] = useState<'summary' | 'animation'>('summary');
  const [animState, setAnimState] = useState<AnimState>(revealed ? 'revealed' : 'closed');
  const [hasReset, setHasReset] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [chargedCards, setChargedCards] = useState<Set<number>>(new Set());
  const [localScore, setLocalScore] = useState<number>(0);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chargeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      animTimerRef.current.forEach(t => clearTimeout(t));
      if (chargeTimerRef.current) clearInterval(chargeTimerRef.current);
    };
  }, []);

  // On mount: show summary if we have a revealed score, otherwise closed vault
  useEffect(() => {
    if (revealed && !animating) {
      setLocalScore(data.svi_score);
      if (viewMode !== 'animation') setViewMode('summary');
      setAnimState('revealed');
    } else if (!revealed && !animating && viewMode !== 'animation') {
      setAnimState('closed');
      setChargedCards(new Set());
    }
  }, [revealed, data.svi_score, animating, hasReset, viewMode]);

  const tier = sviTier(data.svi_score > 0 ? data.svi_score : localScore);

  const factorDetail = data.factor_detail as Record<string, Record<string, unknown> | number | string> | undefined;

  const getFactorData = (key: string) => {
    const pctKey = key === 'bb100_percentile' ? 'bb100_percentile_v2' : key;
    const pct = (data as Record<string, number | undefined>)[pctKey] ?? 0;
    const detailKey = key.replace('_percentile', '');
    const detail = factorDetail?.[detailKey] as Record<string, unknown> | undefined;
    return { percentile: pct, detail };
  };

  const leftFactors = ACTIVE_FACTOR_KEYS.slice(0, 5);
  const rightFactors = ACTIVE_FACTOR_KEYS.slice(5, 10);

  const clearTimers = useCallback(() => {
    animTimerRef.current.forEach(t => clearTimeout(t));
    animTimerRef.current = [];
    if (chargeTimerRef.current) { clearInterval(chargeTimerRef.current); chargeTimerRef.current = null; }
  }, []);

  const handleCalculate = useCallback(async () => {
    if (animating) return;
    // Check eligibility via evalStatus
    if (evalStatus && !evalStatus.can_recalculate && !isReplaying) {
      return;
    }
    clearTimers();
    setAnimating(true);
    setHasReset(false);
    setViewMode('animation');
    setAnimState('closed');
    setChargeLevel(0);
    setChargedCards(new Set());
    setLocalScore(0);

    if (prefersReduced) {
      await onCalculate();
      if (!isReplaying) await onReveal();
      setAnimState('revealed');
      setAnimating(false);
      // Return to summary after short delay
      setTimeout(() => setViewMode('summary'), 1000);
      return;
    }

    play('activation');
    setAnimState('charging');
    const calcPromise = isReplaying ? Promise.resolve() : onCalculate();

    const chargeStart = setTimeout(() => {
      play('charging');
      ACTIVE_FACTOR_KEYS.forEach((_, index) => {
        const cardTimer = setTimeout(() => {
          setChargedCards((current) => new Set(current).add(index));
        }, index * 160);
        animTimerRef.current.push(cardTimer);
      });
    }, 550);
    const chargeDone = setTimeout(() => {
      setChargedCards(new Set(ACTIVE_FACTOR_KEYS.map((_, index) => index)));
      play('fullCharge');
    }, 2150);
    const electricityPhase = setTimeout(() => {
      setAnimState('electricity');
      setChargeLevel(1);
    }, 2450);
    const releasePhase = setTimeout(() => {
      setAnimState('release');
      play('explosion');
    }, 3350);
    const revealPhase = setTimeout(() => {
      setAnimState('revealed');
      play('chime');
      if (!isReplaying) void onReveal();
      setAnimating(false);
      // Return to summary view after animation settles
      setTimeout(() => setViewMode('summary'), 2000);
    }, 4400);
    animTimerRef.current.push(chargeStart, chargeDone, electricityPhase, releasePhase, revealPhase);

    await calcPromise;
  }, [prefersReduced, onCalculate, onReveal, animating, play, clearTimers, evalStatus, isReplaying]);

  const handleSkip = useCallback(() => {
    clearTimers();
    if (!isReplaying) void onReveal();
    setAnimState('revealed');
    setAnimating(false);
    setChargedCards(new Set(ACTIVE_FACTOR_KEYS.map((_, index) => index)));
    setChargeLevel(1);
    setTimeout(() => { setViewMode('summary'); setIsReplaying(false); }, 1500);
  }, [onReveal, clearTimers, isReplaying]);

  const handleReset = useCallback(() => {
    clearTimers();
    setHasReset(true);
    setViewMode('summary');
    setAnimState(revealed ? 'revealed' : 'closed');
    setChargedCards(new Set());
    setChargeLevel(0);
    setLocalScore(0);
    setIsReplaying(false);
  }, [clearTimers, revealed]);

  // Replay animation: visual only, no recalculation
  const handleReplayAnimation = useCallback(() => {
    setIsReplaying(true);
    setViewMode('animation');
    setAnimState('closed');
    setChargedCards(new Set());
    setChargeLevel(0);
    setLocalScore(data.svi_score);
    // Start the animation sequence without calling onCalculate/onReveal
    if (prefersReduced) {
      setAnimState('revealed');
      setTimeout(() => { setViewMode('summary'); setIsReplaying(false); }, 1000);
      return;
    }
    play('activation');
    setAnimating(true);
    setAnimState('charging');
    const chargeStart = setTimeout(() => {
      play('charging');
      ACTIVE_FACTOR_KEYS.forEach((_, index) => {
        const cardTimer = setTimeout(() => {
          setChargedCards((current) => new Set(current).add(index));
        }, index * 160);
        animTimerRef.current.push(cardTimer);
      });
    }, 550);
    const chargeDone = setTimeout(() => {
      setChargedCards(new Set(ACTIVE_FACTOR_KEYS.map((_, index) => index)));
      play('fullCharge');
    }, 2150);
    const electricityPhase = setTimeout(() => {
      setAnimState('electricity');
      setChargeLevel(1);
    }, 2450);
    const releasePhase = setTimeout(() => {
      setAnimState('release');
      play('explosion');
    }, 3350);
    const revealPhase = setTimeout(() => {
      setAnimState('revealed');
      play('chime');
      setAnimating(false);
      setTimeout(() => { setViewMode('summary'); setIsReplaying(false); }, 2000);
    }, 4400);
    animTimerRef.current.push(chargeStart, chargeDone, electricityPhase, releasePhase, revealPhase);
  }, [prefersReduced, play, clearTimers, data.svi_score]);

  const scoreDelta = previousScore != null && data.svi_score > 0 ? data.svi_score - previousScore : null;
  const percentile = data.total_eligible > 0 && data.overall_rank > 0
    ? ((data.total_eligible - data.overall_rank) / data.total_eligible) * 100
    : null;

  const displayScore = data.svi_score > 0 ? data.svi_score : localScore;
  const displayTier = sviTier(displayScore);

  const showChargingMeter = animState === 'charging' || animState === 'electricity';

  const showVaultContent = (state: AnimState) => {
    switch (state) {
      case 'closed':
        return <ClosedVault onCalculate={handleCalculate} disabled={animating} hasData={data.eligible_hands > 0} />;
      case 'charging':
      case 'electricity':
        return (
          <div className="relative flex flex-col items-center justify-center py-4">
            <CentralCharger active={state === 'electricity'} />
            <MechanicalVault state={state} />
            {showChargingMeter && <div className="mt-2"><ChargingMeter chargeLevel={state === 'electricity' ? 1 : chargeLevel} /></div>}
            <div className="mt-1 text-[7px] font-bold tracking-[0.3em] uppercase sm:text-[8px]" style={{ color: SVI_GOLD_LIGHT }}>{state === 'electricity' ? 'Electrical transfer' : 'Charging'}</div>
          </div>
        );
      case 'release':
      case 'revealed':
        return (
          <div className="relative flex flex-col items-center justify-center py-4">
            <VaultExplosionOverlay score={displayScore} tierLabel={displayTier.label} animState={animState} rank={rankData?.division_rank} totalEligible={data.total_eligible} />
            {animState === 'revealed' && (
              <div className="mt-3 flex gap-2">
                <button onClick={onExpand}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
                  style={{ borderColor: 'rgba(212,165,44,0.35)', color: '#e8e6e3', background: '#0c0a08' }}>
                  <Info className="h-3 w-3" strokeWidth={1.5} /> Details
                </button>
                <button onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#e8e6e3', background: '#0c0a08' }}>
                  <RotateCcw className="h-3 w-3" strokeWidth={1.5} /> Reset Animation
                </button>
              </div>
            )}
          </div>
        );
    }
  };

  const showSkip = animState === 'charging' || animState === 'electricity' || animState === 'release';

  // SUMMARY VIEW — static black-and-gold panel, no animation rendering
  if (viewMode === 'summary') {
    return (
      <SviStaticSummary
        data={data}
        rankData={rankData}
        evalStatus={evalStatus}
        onCalculate={handleCalculate}
        onReplayAnimation={handleReplayAnimation}
        onExpand={onExpand}
        previousScore={previousScore}
        canRecalculate={evalStatus?.can_recalculate ?? !revealed}
        recalculating={animating && !isReplaying}
        honors={honors}
        weights={weights}
      />
    );
  }

  // ANIMATION VIEW — vault animation only rendered when viewMode === 'animation'
  return (
    <div className="relative p-2">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .svi-vault-card, .svi-vault-medallion, .svi-vault-underglow, .svi-vault-charge-ring, .svi-vault-lid, .svi-meter-segment-active { transition: none !important; animation: none !important; }
        }
      `}</style>

      {/* Mute/unmute control — top-right corner */}
      <button
        onClick={() => setMuted(!muted)}
        className="absolute right-2 top-0 z-10 flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider transition-all hover:bg-white/5"
        style={{ borderColor: 'rgba(212,165,44,0.15)', color: muted ? 'rgba(255,255,255,0.3)' : GOLD_SOFT }}
        title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      >
        {muted ? <VolumeX className="h-3 w-3" strokeWidth={1.5} /> : <Volume2 className="h-3 w-3" strokeWidth={1.5} />}
        {muted ? 'Muted' : 'Sound'}
      </button>

      {isReplaying && (
        <div className="mb-1 text-center text-[8px] font-bold tracking-[0.3em] uppercase" style={{ color: SVI_GOLD_LIGHT }}>
          Replay Animation — Visual Only
        </div>
      )}

      {/* Desktop: two columns flanking vault */}
      <div className="hidden md:flex md:items-stretch md:gap-2">
        <div className="flex w-[32%] flex-col gap-1.5">
          {leftFactors.map((key, i) => {
            const fd = getFactorData(key);
            return <FactorCard key={key} factorKey={key} percentile={fd.percentile} detail={fd.detail}
              index={i} animateIn={animState !== 'closed'} charged={chargedCards.has(i)}
              factorRank={factorRanks[key]} />;
          })}
        </div>

        <div className="relative flex w-[36%] flex-col items-center justify-center py-4" style={{ zIndex: 2 }}>
          <ElectricalConnections animateIn={animState !== 'closed'} phase={animState === 'charging' ? 'outbound' : (animState === 'electricity' || animState === 'release') ? 'return' : animState === 'revealed' ? 'charged' : 'idle'} />
          <div className="relative z-[2] flex w-full flex-col items-center">
            {showVaultContent(animState)}
            {showSkip && (
              <button onClick={handleSkip}
              className="mt-3 flex items-center gap-1 text-[9px] font-medium text-white/40 transition-colors hover:text-white/70">
                <SkipForward className="h-3 w-3" strokeWidth={1.5} /> Skip Animation
              </button>
            )}
          </div>
        </div>

        <div className="flex w-[32%] flex-col gap-1.5">
          {rightFactors.map((key, i) => {
            const fd = getFactorData(key);
            return <FactorCard key={key} factorKey={key} percentile={fd.percentile} detail={fd.detail}
              index={5 + i} animateIn={animState !== 'closed'} charged={chargedCards.has(5 + i)}
              factorRank={factorRanks[key]} />;
          })}
        </div>
      </div>

      {/* Mobile: stacked vault + 2-col grid */}
      <div className="md:hidden">
        <div className="flex justify-center py-4">
          {showVaultContent(animState)}
        </div>
        {showSkip && (
          <div className="mb-2 flex justify-center">
            <button onClick={handleSkip} className="flex items-center gap-1 text-[9px] font-medium text-white/40 transition-colors hover:text-white/70">
              <SkipForward className="h-3 w-3" strokeWidth={1.5} /> Skip Animation
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {ACTIVE_FACTOR_KEYS.map((key, i) => {
            const fd = getFactorData(key);
            return <FactorCard key={key} factorKey={key} percentile={fd.percentile} detail={fd.detail}
              index={i} animateIn={animState !== 'closed'} charged={chargedCards.has(i)}
              factorRank={factorRanks[key]} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// POST-REVEAL RESULTS — score, tier, rankings, percentile, change
// ════════════════════════════════════════════════════════════════
function SviRevealResults({ data, tier, scoreDelta, percentile, rankData }: {
  data: SviUserData;
  tier: { color: string; label: string };
  scoreDelta: number | null;
  percentile: number | null;
  rankData: SviUserRank | null;
}) {
  const div = sviDivision(data.abi);
  const militaryRank = rankData ? sviRank(rankData.division_rank, rankData.total_in_division) : null;
  const classRank = rankData && rankData.division_rank > 0 && rankData.total_in_division > 0
    ? `#${rankData.division_rank} / ${rankData.total_in_division}`
    : null;
  return (
    <div className="mt-4 w-full border-t border-white/[0.06] pt-4">
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Legacy SVI Score */}
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${SVI_GOLD_HI}44`, background: `${SVI_GOLD_BASE}11` }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Legacy SVI</div>
          <div className="mt-0.5 text-[18px] font-black" style={{ color: SVI_GOLD_LIGHT }}>{data.svi_score.toFixed(0)}</div>
        </div>
        {/* Class (ABI division) */}
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${SVI_GOLD_HI}33`, background: 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Class</div>
          <div className="mt-0.5 text-[12px] font-bold text-white">{div ? div.label : '—'}</div>
          <div className="text-[8px] text-white/35">${data.abi != null ? fmtMoney(data.abi) : '—'} ABI</div>
        </div>
        {/* Rank (military badge) */}
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: militaryRank ? `${militaryRank.color}44` : 'rgba(255,255,255,0.08)', background: militaryRank ? `${militaryRank.color}11` : 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Rank</div>
          <div className="mt-0.5 text-[12px] font-bold" style={{ color: militaryRank?.color ?? '#ffffff66' }}>{militaryRank ? militaryRank.label : '—'}</div>
        </div>
        {/* Global Rank */}
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(10,9,8,0.6)' }}>
          <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Global Rank</div>
          <div className="mt-0.5 text-[12px] font-mono font-bold text-white">
            {data.overall_rank > 0 ? `#${data.overall_rank}` : '—'}
          </div>
        </div>
      </div>
      {/* Class Rank + percentile secondary row */}
      <div className="mx-auto mt-2 flex max-w-lg flex-wrap items-center justify-center gap-3 text-[10px]">
        {classRank && (
          <span className="flex items-center gap-1 text-white/50">
            <span className="font-bold tracking-wider uppercase text-white/40">Class Rank:</span>
            <span className="font-mono font-bold text-white/80">{classRank}</span>
          </span>
        )}
        {percentile != null && (
          <span className="flex items-center gap-1 text-white/50">
            <span className="font-bold tracking-wider uppercase text-white/40">Percentile:</span>
            <span className="font-mono font-bold text-white/80">{percentile.toFixed(0)}%</span>
          </span>
        )}
        {scoreDelta != null && (
          <span className="flex items-center gap-1.5">
            <span className="text-white/40">Change:</span>
            <ChangeArrow delta={scoreDelta} />
            <span className="font-mono font-bold" style={{ color: scoreDelta > 0 ? '#4ade80' : scoreDelta < 0 ? '#f87171' : '#9ca3af' }}>
              {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SVI DETAIL VIEW — factor breakdown modal (no weights, no composite)
// X button + Escape key + click-outside to close
// Shows global factor rank and eligible population
// ════════════════════════════════════════════════════════════════
function SviDetailView({ data, weights, factorRanks, onClose }: {
  data: SviUserData;
  weights: SviWeight[];
  factorRanks: Record<string, SviFactorRank | null>;
  onClose: () => void;
}) {
  const tier = sviTier(data.svi_score);
  const factorDetail = data.factor_detail as Record<string, Record<string, unknown> | number | string> | undefined;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5"
        style={{ borderColor: `${SVI_GOLD_HI}30`, background: 'rgba(8,10,12,0.98)', boxShadow: `0 8px 40px -8px ${SVI_GOLD_HI}40` }}
        onClick={(e) => e.stopPropagation()}>
        {/* X close button */}
        <button onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border"
            style={{ borderColor: `${SVI_GOLD_HI}44`, background: `${SVI_GOLD_BASE}11` }}>
            <span className="text-[9px] font-bold tracking-wider text-white/40 uppercase">Legacy SVI</span>
            <span className="text-2xl font-black" style={{ color: SVI_GOLD_LIGHT }}>{data.svi_score > 0 ? data.svi_score.toFixed(0) : '—'}</span>
          </div>
          <div>
            <div className="text-[15px] font-bold text-white">{tier.label}</div>
            <div className="mt-0.5 text-[11px] text-white/50">Global Rank #{data.overall_rank > 0 ? data.overall_rank : '—'}</div>
            <div className="mt-0.5 text-[10px] text-white/35">{data.method_version}</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <SectionTitle>Factor Breakdown</SectionTitle>
          {ACTIVE_FACTOR_KEYS.map(key => {
            const Icon = FACTOR_ICONS[key] ?? Activity;
            const pctKey = key === 'bb100_percentile' ? 'bb100_percentile_v2' : key;
            const pct = (data as Record<string, number | undefined>)[pctKey] ?? 0;
            const detail = factorDetail?.[key.replace('_percentile', '')] as Record<string, unknown> | undefined;
            const available = detail?.available as boolean | undefined;
            const isAvailable = available !== false;
            const fRank = factorRanks[key];

            const rawVal = detail?.raw as number | undefined;
            const displayValue = (() => {
              if (!isAvailable) return 'Unavailable';
              if (key === 'bb100_percentile') return rawVal != null ? fmtNum(rawVal, 2) : '—';
              if (key === 'abi_percentile') return rawVal != null ? fmtMoney(rawVal) : '—';
              if (key === 'roi_percentile') return rawVal != null ? `${rawVal.toFixed(1)}%` : '—';
              if (key === 'sample_percentile') { const h = detail?.hands as number | undefined; return h != null ? fmtInt(h) : '—'; }
              if (key === 'final_tables_percentile') { const p = detail?.profitable as number | undefined; const t = detail?.total as number | undefined; if (p != null && t != null && t > 0) return `${p}/${t} (${(p / t * 100).toFixed(0)}%)`; return p != null ? `${p}` : '—'; }
              if (key === 'largest_score_percentile') return rawVal != null ? fmtMoney(rawVal) : '—';
              if (key === 'community_percentile') { const m = detail?.messages as number | undefined; return m != null ? fmtInt(m) : '—'; }
              if (key === 'ev_luck_percentile') { const ev = detail?.ev_bb100 as number | undefined; return ev != null ? fmtNum(ev, 2) : '—'; }
              if (key === 'consistency_percentile') { const sd = detail?.stddev as number | undefined; return sd != null ? fmtNum(sd, 2) : '—'; }
              return '—';
            })();

            return (
              <div key={key} className="rounded-lg border p-2.5" style={{ borderColor: `${SVI_GOLD_BASE}44`, background: 'rgba(10,9,8,0.6)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3" strokeWidth={2} style={{ color: SVI_GOLD_LIGHT }} />
                    <span className="text-[11px] font-bold text-white/80">{FACTOR_LABELS[key] ?? key}</span>
                    {!isAvailable && <span className="text-[7px] font-bold uppercase text-white/25">N/A</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/50">{displayValue}</span>
                    <span className="text-[12px] font-mono font-bold" style={{ color: isAvailable ? SVI_GOLD_LIGHT : '#ffffff44' }}>{isAvailable ? pct.toFixed(0) : '50'}</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
                  <div className="h-1 rounded-full" style={{ width: `${Math.min(100, isAvailable ? pct : 50)}%`, background: SVI_GOLD_MID, opacity: isAvailable ? 1 : 0.4 }} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  {FACTOR_DESCRIPTIONS[key] && <p className="text-[9px] leading-relaxed text-white/30">{FACTOR_DESCRIPTIONS[key]}</p>}
                  {isAvailable && fRank && fRank.total > 0 && (
                    <span className="shrink-0 text-[8px] font-mono text-white/35">#{fRank.rank} / {fRank.total} globally</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: `${SVI_GOLD_BASE}44`, background: `${SVI_GOLD_BASE}08` }}>
          <p className="text-[9px] leading-relaxed text-white/35">
            SVI = 1 + 99 &times; (N &minus; R) / (N &minus; 1), where N = total eligible players and R = your rank.
            Scores are normalized to a 1&ndash;100 scale based on your position among all eligible players.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.06] p-3">
          <SectionTitle>Eligibility</SectionTitle>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center justify-between rounded bg-white/[0.02] px-2 py-1.5">
              <span className="text-white/50">Eligible Hands</span>
              <span className="font-mono font-bold text-white/80">{fmtInt(data.eligible_hands)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-white/[0.02] px-2 py-1.5">
              <span className="text-white/50">Tournaments</span>
              <span className="font-mono font-bold text-white/80">{fmtInt(data.eligible_tournaments)}</span>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-white/35">Minimum: 5,000 tournament hands and 20+ distinct tournaments with valid buy-in data.</p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SVI LEADERBOARD — with integrated trend indicators
// Self-entry is concealed if reveal not completed
// ════════════════════════════════════════════════════════════════
type SortBy = 'svi' | 'abi' | 'bb100';
type LeaderboardView = 'global' | string;

function RankTrendIndicator({ delta7d, delta30d }: { delta7d: number | null; delta30d: number | null }) {
  if (delta7d == null && delta30d == null) return <span className="text-[8px] text-white/20">—</span>;
  const renderDelta = (delta: number | null, label: string) => {
    if (delta == null) return null;
    if (delta === 0) return <span className="text-[8px] text-white/30">{label}: 0</span>;
    const positive = delta > 0;
    return (
      <span className="flex items-center gap-0.5 text-[8px]" style={{ color: positive ? '#4ade80' : '#f87171' }}>
        {label}: {positive ? '↑' : '↓'}{Math.abs(delta)}
      </span>
    );
  };
  return (
    <div className="flex flex-col items-end gap-0.5">
      {renderDelta(delta7d, '7d')}
      {renderDelta(delta30d, '30d')}
    </div>
  );
}

function SviLeaderboard({ currentUserId, currentUserSnapshots, refreshKey, sviData, privacyMode, onPrivacyChange }: { currentUserId?: string; currentUserSnapshots?: SviSnapshot[]; refreshKey?: number; sviData?: SviUserData | null; privacyMode?: 'public' | 'anonymous'; onPrivacyChange?: (mode: 'public' | 'anonymous') => void }) {
  const [entries, setEntries] = useState<SviLeaderboardEntry[]>([]);
  const [counts, setCounts] = useState<SviDivisionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<LeaderboardView>('global');
  const [sortBy, setSortBy] = useState<SortBy>('svi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [lbData, countData] = await Promise.all([
        view === 'global' ? fetchSviLeaderboard(50, 0, sortBy) : fetchSviDivisionLeaderboard(view, 50, 0),
        fetchSviDivisionCounts(),
      ]);
      if (!cancelled) { setEntries(lbData); setCounts(countData); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [view, sortBy, refreshKey]);

  const sortedEntries = useMemo(() => {
    const arr = [...entries];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortBy === 'abi') return (a.abi - b.abi) * dir;
      if (sortBy === 'bb100') return (a.bb100 - b.bb100) * dir;
      return (a.svi_score - b.svi_score) * dir;
    });
    return arr;
  }, [entries, sortBy, sortDir]);

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'svi' ? 'desc' : 'desc');
    }
  };

  const countForDivision = (key: string): number => counts.find(c => c.division === key)?.player_count ?? 0;

  const myTrend = useMemo(() => {
    if (!currentUserId || !currentUserSnapshots || currentUserSnapshots.length === 0) return null;
    const now = Date.now();
    const snap7d = currentUserSnapshots.find(s => now - new Date(s.snapshot_at).getTime() <= 7 * 86400000);
    const snap30d = currentUserSnapshots.find(s => now - new Date(s.snapshot_at).getTime() <= 30 * 86400000);
    const latest = currentUserSnapshots[0];
    return {
      delta7d: snap7d && snap7d.id !== latest.id ? snap7d.overall_rank - latest.overall_rank : null,
      delta30d: snap30d && snap30d.id !== latest.id ? snap30d.overall_rank - latest.overall_rank : null,
    };
  }, [currentUserId, currentUserSnapshots]);

  const activeDiv = SVI_DIVISIONS.find(d => d.key === view);
  const revealed = sviData?.reveal_completed === true && sviData.svi_score > 0;
  const division = sviData ? sviDivision(sviData.abi) : null;
  const militaryRank = sviData && division && sviData.overall_rank > 0 ? sviRank(sviData.division_rank ?? 0, sviData.total_in_division ?? 0) : null;

  const SortHeader = ({ col, label, width, className = '' }: { col: SortBy; label: string; width: string; className?: string }) => {
    const active = sortBy === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`${width} ${className} flex items-center justify-end gap-0.5 text-right text-[9px] font-bold tracking-widest uppercase transition-colors`}
        style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.7)' }}
      >
        {label}
        {active && (
          <span className="text-[7px]" style={{ color: GOLD }}>
            {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </button>
    );
  };

  return (
    <Panel>
      {sviData && (
        <div className="mb-3 border-b border-[#d4a52c]/20 pb-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-md border border-[#d4a52c]/30 bg-[#4d3715]/20 px-2.5 py-2">
              <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Legacy SVI</div>
              <div className="mt-0.5 text-lg font-black text-white">{revealed ? sviData.svi_score.toFixed(0) : '—'}</div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
              <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Class</div>
              <div className="mt-0.5 text-[12px] font-bold text-white">{revealed ? (division?.label ?? '—') : '—'}</div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
              <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Rank</div>
              <div className="mt-0.5 text-[12px] font-bold text-white">{revealed ? (militaryRank?.label ?? '—') : '—'}</div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
              <div className="text-[8px] font-bold tracking-widest text-white/45 uppercase">Global Rank</div>
              <div className="mt-0.5 text-[12px] font-mono font-bold text-white">{revealed && sviData.overall_rank > 0 ? `#${sviData.overall_rank}` : '—'}</div>
            </div>
          </div>
          {privacyMode && onPrivacyChange && (
            <div className="mt-2 flex items-center justify-end">
              <AnonymousDisplayToggle userId={currentUserId} privacyMode={privacyMode} revealed={revealed} onChange={onPrivacyChange} />
            </div>
          )}
    
        </div>
      )}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => setView('global')}
          className="shrink-0 rounded-md border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all"
          style={{ borderColor: view === 'global' ? GOLD : 'rgba(212,165,44,0.15)', background: view === 'global' ? 'rgba(212,165,44,0.12)' : 'transparent', color: view === 'global' ? '#ffffff' : '#ffffff' }}>
          Global
        </button>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all"
            style={{
              borderColor: view !== 'global' ? (activeDiv?.color ?? GOLD) : 'rgba(255,255,255,0.08)',
              background: view !== 'global' ? `${activeDiv?.color ?? GOLD}15` : 'transparent',
              color: view !== 'global' ? (activeDiv?.color ?? '#ffffff') : '#ffffff',
            }}>
            {view !== 'global' ? (activeDiv?.label ?? 'Class') : 'Class'}
            {view !== 'global' && countForDivision(view) > 0 && <span className="ml-0.5 text-[7px] opacity-60">{countForDivision(view)}</span>}
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-40 overflow-y-auto rounded-lg border bg-[#0c0a08] py-1 shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.2)' }}>
                {SVI_DIVISIONS.map(div => {
                  const cnt = countForDivision(div.key);
                  return (
                    <button
                      key={div.key}
                      onClick={() => { setView(div.key); setDropdownOpen(false); }}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[10px] font-semibold transition-colors hover:bg-white/5"
                      style={{ color: view === div.key ? div.color : 'rgba(220,220,220,0.7)' }}>
                      <span>{div.label}</span>
                      {cnt > 0 && <span className="text-[8px] opacity-50">{cnt}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setShareOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:bg-white/5"
          style={{ borderColor: 'rgba(212,165,44,0.25)', color: '#ffffff' }}
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Share
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/30" strokeWidth={1.5} /></div>
      ) : sortedEntries.length === 0 ? (
        <div className="py-8 text-center">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="text-[11px] text-white/30">No players have revealed their SVI yet</p>
        </div>
      ) : (
        <LeaderboardBody
          sortedEntries={sortedEntries}
          currentUserId={currentUserId}
          view={view}
          myTrend={myTrend}
          sortBy={sortBy}
          sortDir={sortDir}
          toggleSort={toggleSort}
        />
      )}
      {shareOpen && (
        <LeaderboardShareModal
          sviData={sviData}
          rankData={sviData ? { division: sviDivision(sviData.abi)?.key ?? '', division_rank: sviData.division_rank ?? 0, total_in_division: sviData.total_in_division ?? 0, rank_key: '', svi_score: sviData.svi_score, overall_rank: sviData.overall_rank, total_eligible: sviData.total_eligible } : null}
          honors={[]}
          onClose={() => setShareOpen(false)}
        />
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════
// LEADERBOARD BODY — 12 visible rows with internal scroll + placeholders
// Premium smoked-glass surface with restrained metallic rank illumination.
// ════════════════════════════════════════════════════════════════
const VISIBLE_ROWS = 12;

type RankTier = 'gold' | 'soft-gold' | 'silver' | 'bronze' | 'neutral';

function rankTierFor(rank: number): RankTier {
  if (rank <= 3) return 'gold';
  if (rank <= 5) return 'soft-gold';
  if (rank <= 10) return 'silver';
  if (rank <= 15) return 'bronze';
  return 'neutral';
}

const TIER_TINT: Record<RankTier, string> = {
  gold:      'rgba(212, 165, 44, 0.10)',
  'soft-gold': 'rgba(212, 165, 44, 0.055)',
  silver:    'rgba(180, 188, 200, 0.07)',
  bronze:    'rgba(176, 120, 70, 0.07)',
  neutral:   'rgba(255, 255, 255, 0.012)',
};

const TIER_EDGE: Record<RankTier, string> = {
  gold:      'rgba(245, 230, 176, 0.45)',
  'soft-gold': 'rgba(212, 165, 44, 0.25)',
  silver:    'rgba(190, 198, 210, 0.28)',
  bronze:    'rgba(190, 135, 85, 0.26)',
  neutral:   'rgba(255, 255, 255, 0.06)',
};

const TIER_GLOW: Record<RankTier, string> = {
  gold:      '0 0 14px rgba(212,165,44,0.22), inset 0 1px 0 rgba(245,230,176,0.10)',
  'soft-gold': '0 0 8px rgba(212,165,44,0.12), inset 0 1px 0 rgba(245,230,176,0.06)',
  silver:    '0 0 8px rgba(180,188,200,0.14), inset 0 1px 0 rgba(220,226,236,0.06)',
  bronze:    '0 0 8px rgba(176,120,70,0.14), inset 0 1px 0 rgba(210,160,110,0.06)',
  neutral:   'inset 0 1px 0 rgba(255,255,255,0.03)',
};

function LeaderboardBody({ sortedEntries, currentUserId, view, myTrend, sortBy, sortDir, toggleSort }: {
  sortedEntries: SviLeaderboardEntry[];
  currentUserId?: string;
  view: LeaderboardView;
  myTrend: { delta7d: number | null; delta30d: number | null } | null;
  sortBy: SortBy;
  sortDir: 'asc' | 'desc';
  toggleSort: (col: SortBy) => void;
}) {
  const realCount = sortedEntries.length;
  const placeholderCount = Math.max(0, VISIBLE_ROWS - realCount);
  const placeholders = Array.from({ length: placeholderCount }, (_, i) => realCount + i + 1);

  const SortHeader = ({ col, label, width, className = '' }: { col: SortBy; label: string; width: string; className?: string }) => {
    const active = sortBy === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`${width} ${className} flex items-center justify-end gap-0.5 text-right text-[9px] font-bold tracking-widest uppercase transition-colors`}
        style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.7)' }}
      >
        {label}
        {active && (
          <span className="text-[7px]" style={{ color: GOLD }}>
            {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="overflow-hidden rounded-[16px] border"
      style={{
        borderColor: 'rgba(212, 165, 44, 0.16)',
        background: 'rgba(5, 8, 12, 0.42)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 10px 40px -16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Desktop header */}
      <div
        className="sticky top-0 z-10 hidden items-center border-b px-3 py-2 sm:flex"
        style={{ background: 'rgba(12, 14, 18, 0.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderColor: 'rgba(212,165,44,0.16)' }}
      >
        <span className="w-8 text-[9px] font-bold tracking-widest text-white uppercase">#</span>
        <span className="flex-1 text-[9px] font-bold tracking-widest text-white uppercase">Player</span>
        <span className="hidden w-24 text-center text-[9px] font-bold tracking-widest text-white uppercase md:block">Honors</span>
        <SortHeader col="svi" label="SVI" width="w-14" />
        <SortHeader col="bb100" label="BB/100" width="w-16" />
        <SortHeader col="abi" label="ABI" width="w-16" className="hidden md:flex" />
        <span className="w-20 text-right text-[9px] font-bold tracking-widest text-white uppercase">Hands</span>
        <span className="w-16 text-right text-[9px] font-bold tracking-widest text-white uppercase">Trend</span>
      </div>
      {/* Mobile header — compact 4-col */}
      <div
        className="sticky top-0 z-10 flex items-center border-b px-2 py-1.5 sm:hidden"
        style={{ background: 'rgba(12, 14, 18, 0.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderColor: 'rgba(212,165,44,0.16)' }}
      >
        <span className="w-6 text-[8px] font-bold tracking-widest text-white/60 uppercase">#</span>
        <span className="flex-1 text-[8px] font-bold tracking-widest text-white/60 uppercase">Player</span>
        <SortHeader col="svi" label="SVI" width="w-12" />
        <SortHeader col="bb100" label="BB/100" width="w-14" />
        <span className="w-14 text-right text-[8px] font-bold tracking-widest text-white/60 uppercase">Hands</span>
      </div>
      {/* Scrollable body: holds up to 12 visible rows of consistent height. */}
      <div
        className="svi-lb-scroll max-h-[528px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(212,165,44,0.5) transparent' }}
      >
        <style>{`
          .svi-lb-scroll::-webkit-scrollbar { width: 6px; }
          .svi-lb-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
          .svi-lb-scroll::-webkit-scrollbar-thumb { background: rgba(212,165,44,0.42); border-radius: 4px; }
          .svi-lb-scroll::-webkit-scrollbar-thumb:hover { background: rgba(212,165,44,0.65); }
          .svi-lb-row { transition: background-color 160ms ease, box-shadow 160ms ease, border-color 160ms ease; }
          .svi-lb-row:hover { background-color: rgba(255,255,255,0.04) !important; }
        `}</style>
        {sortedEntries.map((entry, i) => {
          const tier = sviTier(entry.svi_score);
          const isMe = currentUserId && entry.user_id === currentUserId;
          const rank = view !== 'global' ? (entry.division_rank ?? entry.overall_rank) : entry.overall_rank;
          const badge = rankBadge(rank);
          const conf = entry.eligible_hands >= 10000 ? '#4ade80' : entry.eligible_hands >= 5000 ? '#fbbf24' : '#f87171';
          const isAnonymous = entry.privacy_mode === 'anonymous';
          const displayName = isMe ? 'You' : (entry.display_name ?? 'Player');
          const trend = isMe ? myTrend : null;
          const rTier = rankTierFor(rank);
          const rowBg = isMe
            ? 'rgba(212,165,44,0.14)'
            : TIER_TINT[rTier];
          const rowEdge = isMe ? 'rgba(245,230,176,0.6)' : TIER_EDGE[rTier];
          const rowGlow = isMe ? '0 0 16px rgba(212,165,44,0.28), inset 0 1px 0 rgba(245,230,176,0.14)' : TIER_GLOW[rTier];
          return (
            <div
              key={entry.user_id}
              className="svi-lb-row border-b last:border-b-0"
              style={{
                background: rowBg,
                borderBottomColor: 'rgba(255,255,255,0.035)',
                boxShadow: rowGlow,
                borderLeft: `1px solid ${rowEdge}`,
                borderRight: `1px solid ${rowEdge}`,
              }}
            >
              {/* Desktop row */}
              <div className="hidden items-center px-3 py-3 sm:flex">
                <span className="flex w-8 items-center gap-0.5">
                  {badge ? <badge.icon className="h-4 w-4" strokeWidth={1.5} style={{ color: badge.color }} /> : <span className="text-[11px] font-mono text-white/45">{rank}</span>}
                </span>
                <span className="flex flex-1 items-center gap-2 truncate">
                  {isAnonymous ? (
                    <UserCircle className="h-6 w-6 shrink-0 text-white/40" strokeWidth={1.5} />
                  ) : entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/15" />
                  ) : null}
                  <span className="truncate text-[12px] font-bold text-white">{displayName}</span>
                  {isAnonymous && <span className="text-[9px] text-white/35">(Anonymous)</span>}
                </span>
                <span className="hidden w-24 items-center justify-center gap-1 md:flex">
                  {(entry.honors ?? []).slice(0, 3).map((h) => (
                    <div key={h.honor_key} className="group relative cursor-help">
                      <HonorBadge honorKey={h.honor_key} size={20} />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 rounded-md border border-[#d4a52c]/20 bg-[#0c0a08] px-2 py-1 text-[8px] whitespace-nowrap shadow-xl group-hover:block">
                        <span className="font-bold text-[#f5e6b0]">{honorLabel(h.honor_key)}</span>
                        <span className="block text-white/50">{honorDesc(h.honor_key)}</span>
                      </div>
                    </div>
                  ))}
                </span>
                <span className="w-14 text-right text-[12px] font-mono font-bold text-white">{entry.svi_score.toFixed(1)}</span>
                <span className="w-16 text-right text-[10px] font-mono text-white/80">{fmtNum(entry.bb100, 2)}</span>
                <span className="hidden w-16 text-right text-[10px] font-mono text-white/60 md:inline">{fmtMoney(entry.abi)}</span>
                <span className="flex w-20 items-center justify-end gap-1">
                  <span className="text-[10px] font-mono text-white/55">{fmtInt(entry.eligible_hands)}</span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: conf }} />
                </span>
                <span className="hidden w-16 justify-end md:flex">
                  {trend ? <RankTrendIndicator delta7d={trend.delta7d} delta30d={trend.delta30d} /> : <span className="text-[8px] text-white/25">—</span>}
                </span>
              </div>
              {/* Mobile row — compact, tappable to expand */}
              <MobileLeaderboardRow
                rank={rank}
                badge={badge}
                isAnonymous={isAnonymous}
                avatarUrl={entry.avatar_url}
                displayName={displayName}
                sviScore={entry.svi_score}
                bb100={entry.bb100}
                eligibleHands={entry.eligible_hands}
                conf={conf}
                abi={entry.abi}
                tierLabel={tier.label}
                honors={entry.honors ?? []}
                trend={trend}
              />
            </div>
          );
        })}
        {/* Placeholder rows to always fill 12 visible positions. Subdued, no fabricated data. */}
        {placeholders.map((rank, i) => {
          const rTier = rankTierFor(rank);
          return (
            <div
              key={`ph-${rank}`}
              className="border-b last:border-b-0"
              style={{
                background: TIER_TINT[rTier],
                borderBottomColor: 'rgba(255,255,255,0.025)',
                borderLeft: `1px solid ${TIER_EDGE[rTier]}`,
                borderRight: `1px solid ${TIER_EDGE[rTier]}`,
                opacity: 0.55,
              }}
            >
              {/* Desktop placeholder */}
              <div className="hidden items-center px-3 py-3 sm:flex">
                <span className="w-8 text-[11px] font-mono text-white/25">{rank}</span>
                <span className="flex flex-1 items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]" />
                  <span className="text-[12px] text-white/15">—</span>
                </span>
                <span className="hidden w-24 md:block" />
                <span className="w-14 text-right text-[12px] font-mono text-white/15">—</span>
                <span className="w-16 text-right text-[10px] font-mono text-white/15">—</span>
                <span className="hidden w-16 text-right text-[10px] font-mono text-white/15 md:inline">—</span>
                <span className="w-20" />
                <span className="hidden w-16 md:block" />
              </div>
              {/* Mobile placeholder */}
              <div className="flex items-center px-2 py-2 sm:hidden">
                <span className="w-6 text-[10px] font-mono text-white/25">{rank}</span>
                <span className="flex flex-1 items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]" />
                  <span className="text-[11px] text-white/15">—</span>
                </span>
                <span className="w-12 text-right text-[11px] font-mono text-white/15">—</span>
                <span className="w-14 text-right text-[10px] font-mono text-white/15">—</span>
                <span className="w-14" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MOBILE LEADERBOARD ROW — compact, tap-to-expand
// Shows Player | SVI | BB/100 | Hands; tap reveals ABI, tier, honors, trend
// ════════════════════════════════════════════════════════════════
function MobileLeaderboardRow({
  rank, badge, isAnonymous, avatarUrl, displayName, sviScore, bb100, eligibleHands, conf, abi, tierLabel, honors, trend,
}: {
  rank: number;
  badge: { icon: typeof Crown; color: string } | null;
  isAnonymous: boolean;
  avatarUrl?: string | null;
  displayName: string;
  sviScore: number;
  bb100: number;
  eligibleHands: number;
  conf: string;
  abi: number;
  tierLabel: string;
  honors: SviHonor[];
  trend: { delta7d: number | null; delta30d: number | null } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="sm:hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center px-2 py-2 text-left"
      >
        <span className="flex w-6 items-center gap-0.5">
          {badge ? <badge.icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: badge.color }} /> : <span className="text-[10px] font-mono text-white/30">{rank}</span>}
        </span>
        <span className="flex flex-1 items-center gap-1.5 truncate">
          {isAnonymous ? (
            <UserCircle className="h-5 w-5 shrink-0 text-white/30" strokeWidth={1.5} />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10" />
          ) : null}
          <span className="truncate text-[11px] font-bold text-white">{displayName}</span>
          {isAnonymous && <span className="text-[8px] text-white/30">(Anon)</span>}
        </span>
        <span className="w-12 text-right text-[11px] font-mono font-bold text-white">{sviScore.toFixed(1)}</span>
        <span className="w-14 text-right text-[10px] font-mono text-white/70">{fmtNum(bb100, 2)}</span>
        <span className="flex w-14 items-center justify-end gap-1">
          <span className="text-[9px] font-mono text-white/40">{fmtInt(eligibleHands)}</span>
          <span className="h-1 w-1 rounded-full" style={{ background: conf }} />
        </span>
      </button>
      {expanded && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 text-[9px]">
          <span className="flex items-center gap-1 text-white/40"><span className="font-bold tracking-wider uppercase text-white/30">Tier:</span><span className="text-white/70">{tierLabel}</span></span>
          <span className="flex items-center gap-1 text-white/40"><span className="font-bold tracking-wider uppercase text-white/30">ABI:</span><span className="font-mono text-white/70">{fmtMoney(abi)}</span></span>
          {trend && (
            <span className="flex items-center gap-1 text-white/40"><span className="font-bold tracking-wider uppercase text-white/30">Trend:</span><RankTrendIndicator delta7d={trend.delta7d} delta30d={trend.delta30d} /></span>
          )}
          {honors.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-bold tracking-wider uppercase text-white/30">Honors:</span>
              {honors.slice(0, 4).map(h => <HonorBadge key={h.honor_key} honorKey={h.honor_key} size={16} />)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// LEADERBOARD SHARE MODAL — Download Image, Copy Link, Social Share
// ════════════════════════════════════════════════════════════════
function LeaderboardShareModal({ sviData, rankData, honors, onClose }: {
  sviData?: SviUserData | null;
  rankData?: SviUserRank | null;
  honors?: SviHonor[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const revealed = sviData?.reveal_completed === true && sviData.svi_score > 0;
  const isAnonymous = sviData ? false : false;
  const division = sviData ? sviDivision(sviData.abi) : null;
  const militaryRank = sviData && rankData ? sviRank(rankData.division_rank, rankData.total_in_division) : null;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?tab=svi` : '';
  const shareText = revealed
    ? `My SpotVault Index score is ${sviData!.svi_score.toFixed(0)} — rank #${sviData!.overall_rank} globally on SpotVault!`
    : 'Check out the SpotVault Index leaderboard!';

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [shareUrl]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0806',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = 'spotvault-svi-share.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Share card download failed:', err);
    }
    setDownloading(false);
  }, []);

  const handleSocialShare = useCallback((platform: 'x' | 'facebook' | 'native') => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);
    if (platform === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`, '_blank', 'noopener,noreferrer');
    } else if (platform === 'native' && typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'SpotVault Index', text: shareText, url: shareUrl }).catch(() => {});
    }
  }, [shareText, shareUrl]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[#d4a52c]/20 bg-[#0c0a08] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Share SVI Leaderboard</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>

        {/* Share card preview */}
        <div ref={cardRef} className="mb-4 rounded-lg border border-[#d4a52c]/15 overflow-hidden" style={{ background: 'linear-gradient(135deg, #14110a 0%, #0a0806 100%)' }}>
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #d4a52c, #a97918)' }}>
                <Trophy className="h-4 w-4 text-[#1a1408]" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-black tracking-tight" style={{ color: '#f5e6b0' }}>SpotVault</span>
              <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">SVI</span>
            </div>
            <div className="mb-4">
              <p className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Legacy SVI Score</p>
              <p className="text-4xl font-black" style={{ color: '#f5e6b0' }}>{revealed ? sviData!.svi_score.toFixed(0) : '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div>
                <p className="text-white/30 uppercase tracking-wider text-[8px]">Global Rank</p>
                <p className="font-bold text-white">{revealed && sviData!.overall_rank > 0 ? `#${sviData!.overall_rank}` : '—'}</p>
              </div>
              <div>
                <p className="text-white/30 uppercase tracking-wider text-[8px]">Military Rank</p>
                <p className="font-bold" style={{ color: militaryRank?.color ?? '#fff' }}>{revealed ? (militaryRank?.label ?? '—') : '—'}</p>
              </div>
              <div>
                <p className="text-white/30 uppercase tracking-wider text-[8px]">Division</p>
                <p className="font-bold" style={{ color: division?.color ?? '#fff' }}>{revealed ? (division?.label ?? '—') : '—'}</p>
              </div>
              <div>
                <p className="text-white/30 uppercase tracking-wider text-[8px]">BB/100</p>
                <p className="font-bold text-white">{revealed ? sviData!.bb100.toFixed(2) : '—'}</p>
              </div>
            </div>
            {honors && honors.length > 0 && (
              <div className="mt-3 flex gap-2">
                {honors.slice(0, 4).map((h) => (
                  <HonorBadge key={h.honor_key} honorKey={h.honor_key} size={28} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Share actions */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-[#d4a52c]/20 disabled:opacity-50"
            style={{ color: '#f5e6b0' }}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Download className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {downloading ? 'Generating...' : 'Download Image'}
          </button>
          <button onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" strokeWidth={1.5} /> : <LinkIcon className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={() => handleSocialShare('x')}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10">
            <Twitter className="h-3.5 w-3.5" strokeWidth={1.5} /> Share to X
          </button>
          <button onClick={() => handleSocialShare('facebook')}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10">
            <Facebook className="h-3.5 w-3.5" strokeWidth={1.5} /> Facebook
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={() => handleSocialShare('native')}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10">
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} /> More Share Options
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SviLeaderboardTab({ userId }: { userId?: string }) {
  return (
    <div className="space-y-3">
      <SviLeaderboard currentUserId={userId} refreshKey={0} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ANONYMOUS DISPLAY TOGGLE — replaces Opt-In toggle
// Privacy mode: 'public' or 'anonymous'
// ════════════════════════════════════════════════════════════════
function AnonymousDisplayToggle({ userId, privacyMode, revealed, onChange }: {
  userId?: string;
  privacyMode: 'public' | 'anonymous';
  revealed: boolean;
  onChange: (mode: 'public' | 'anonymous') => void;
}) {
  const [toggling, setToggling] = useState(false);
  const isAnonymous = privacyMode === 'anonymous';

  const handleToggle = useCallback(async () => {
    if (!userId || toggling) return;
    setToggling(true);
    const newMode = isAnonymous ? 'public' : 'anonymous';
    const ok = await setPrivacyMode(userId, newMode);
    setToggling(false);
    if (ok) onChange(newMode);
  }, [userId, isAnonymous, toggling, onChange]);

  if (!revealed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <Info className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
        <span className="text-[10px] text-white/40">Calculate and reveal your SVI to access privacy settings.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <button onClick={handleToggle} disabled={toggling}
        className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
        style={{
          borderColor: isAnonymous ? 'rgba(212,165,44,0.45)' : 'rgba(212,165,44,0.2)',
          background: isAnonymous ? 'rgba(212,165,44,0.14)' : '#0c0a08',
          color: isAnonymous ? '#ffffff' : '#ffffff',
        }}>
        {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : isAnonymous ? <UserCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />}
        <span className="whitespace-nowrap">{isAnonymous ? 'Displaying as Anonymous' : 'Display as Anonymous'}</span>
      </button>
      <span className="text-[9px] leading-relaxed text-white/35">
        {isAnonymous ? 'Your identity is hidden on the leaderboard.' : 'Your name is visible on the leaderboard.'}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN SVI TAB — exported component
// Page structure: Overview → SVI Evaluation Center → Leaderboard → Rank/Honors/Info
// Score concealment: server returns svi_score=0 when reveal_completed=false
// ════════════════════════════════════════════════════════════════
export function SviTab({ userId }: { userId?: string }) {
  const [sviData, setSviData] = useState<SviUserData | null>(null);
  const [weights, setWeights] = useState<SviWeight[]>([]);
  const [rankData, setRankData] = useState<SviUserRank | null>(null);
  const [honors, setHonors] = useState<SviHonor[]>([]);
  const [snapshots, setSnapshots] = useState<SviSnapshot[]>([]);
  const [privacyMode, setPrivacyMode] = useState<'public' | 'anonymous'>('public');
  const [factorRanks, setFactorRanks] = useState<Record<string, SviFactorRank | null>>({});
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [evalStatus, setEvalStatus] = useState<SviEvaluationStatus | null>(null);

  const loadSvi = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const [data, w, rank, hon, snaps, pmode, estatus] = await Promise.all([
      fetchSviUser(userId), fetchSviWeights(),
      fetchSviUserRank(userId), fetchSviHonors(userId),
      fetchSviSnapshots(userId, 100),
      fetchPrivacyMode(userId),
      fetchEvaluationStatus(userId),
    ]);
    setSviData(data);
    setWeights(w);
    setRankData(rank);
    setHonors(hon);
    setSnapshots(snaps);
    setPrivacyMode(pmode);
    setEvalStatus(estatus);
    setLoading(false);

    // Fetch factor ranks only if revealed
    if (data?.reveal_completed && data.svi_score > 0) {
      const ranks: Record<string, SviFactorRank | null> = {};
      await Promise.all(
        ACTIVE_FACTOR_KEYS.map(async (key) => {
          const r = await fetchFactorRank(userId, key);
          ranks[key] = r;
        })
      );
      setFactorRanks(ranks);
    }
  }, [userId]);

  useEffect(() => { loadSvi(); }, [loadSvi]);

  const handleRecalculate = useCallback(async () => {
    if (!userId) return;
    // Check eligibility before running calculation
    const eligibility = await checkRecalcEligibility(userId);
    if (!eligibility.can_recalculate) {
      const status = await fetchEvaluationStatus(userId);
      setEvalStatus(status);
      return;
    }
    setRecalculating(true);
    await calculateSviAll();
    // Fetch the freshly calculated data to persist in the evaluation record
    const freshData = await fetchSviUser(userId);
    if (freshData) {
      await consumeEvaluation(userId, {
        svi_score: freshData.svi_score,
        overall_rank: freshData.overall_rank,
        total_eligible: freshData.total_eligible,
        eligible_hands: freshData.eligible_hands,
        eligible_tournaments: freshData.eligible_tournaments,
        abi: freshData.abi ?? 0,
        bb100: freshData.bb100 ?? 0,
        method_version: freshData.method_version,
        factor_detail: freshData.factor_detail as Record<string, unknown> | undefined,
      }).catch(() => {/* best-effort; status syncs on next load */});
    }
    setRecalculating(false);
    await loadSvi();
    setLeaderboardRefresh(k => k + 1);
  }, [userId, loadSvi]);

  const handleReveal = useCallback(async () => {
    if (!userId) return;
    const revealed = await revealSviScore(userId);
    if (revealed) {
      setSviData(revealed);
      // Refresh leaderboard so the newly revealed user appears
      setLeaderboardRefresh(k => k + 1);
      // Fetch factor ranks after reveal
      const ranks: Record<string, SviFactorRank | null> = {};
      await Promise.all(
        ACTIVE_FACTOR_KEYS.map(async (key) => {
          const r = await fetchFactorRank(userId, key);
          ranks[key] = r;
        })
      );
      setFactorRanks(ranks);
    }
  }, [userId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} style={{ color: GOLD }} /></div>;
  }

  const eligible = sviData != null && sviData.eligible_hands > 0;
  const revealed = sviData?.reveal_completed === true && sviData.svi_score > 0;
  const previousScore = snapshots.length > 1 ? snapshots[1].svi_score : undefined;

  return (
    <div className="space-y-4">
      {/* Section 1: Competitive Leaderboard — title bar physically connected to leaderboard */}
      <div className="overflow-hidden rounded-lg border border-[#d4a52c]/25" style={{ background: SHELL_BG, boxShadow: '0 4px 24px -10px rgba(212,165,44,0.12)' }}>
        <div className="flex items-center gap-2.5 border-b border-[#d4a52c]/20 px-4 py-3" style={{ background: 'linear-gradient(180deg, rgba(212,165,44,0.06) 0%, rgba(10,8,6,0) 100%)' }}>
          <Crown className="h-5 w-5 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-[13px] font-bold tracking-widest uppercase text-white">SVI Player Rankings Leaderboard</h3>
        </div>
        <div className="[&>div:first-child]:rounded-none [&>div:first-child]:border-0 [&>div:first-child]:shadow-none">
          <SviLeaderboard
            currentUserId={userId}
            currentUserSnapshots={snapshots}
            refreshKey={leaderboardRefresh}
            sviData={sviData}
            privacyMode={privacyMode}
            onPrivacyChange={(mode) => setPrivacyMode(mode)}
          />
        </div>
      </div>

      {/* Section 2: SpotVault Index Evaluation Center (consolidated with Military Rank & Honors) */}
      <div className="overflow-hidden rounded-lg border border-[#d4a52c]/25" style={{ background: SHELL_BG, boxShadow: '0 4px 24px -10px rgba(212,165,44,0.12)' }}>
        <div className="flex items-center gap-2.5 border-b border-[#d4a52c]/20 px-4 py-3" style={{ background: 'linear-gradient(180deg, rgba(212,165,44,0.06) 0%, rgba(10,8,6,0) 100%)' }}>
          <BarChart3 className="h-5 w-5 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-[13px] font-bold tracking-widest uppercase text-white">SpotVault Index Evaluation Center</h3>
        </div>
        {sviData && eligible ? (
          <SviEvaluationCenter
            data={sviData}
            weights={weights}
            onCalculate={handleRecalculate}
            onReveal={handleReveal}
            onExpand={() => setDetailOpen(true)}
            previousScore={previousScore}
            factorRanks={factorRanks}
            rankData={rankData}
            evalStatus={evalStatus}
            honors={honors}
          />
        ) : (
          <div className="p-4">
            <div className="flex flex-col items-center py-6 text-center">
              <Trophy className="mb-2 h-10 w-10 text-white/15" strokeWidth={1.5} />
              <p className="text-[13px] font-bold text-white">No SVI Score Yet</p>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-white/40">
                Import 5,000+ tournament hands across 20+ distinct events with valid buy-in data to qualify for the SpotVault Index.
              </p>
            </div>
          </div>
        )}

        {/* Performance Evaluation Breakdown — five-component engine integrated into SVI */}
        {userId && (
          <div className="border-t border-[#d4a52c]/20 p-3">
            <SviPerformanceBreakdown userId={userId} isOwn={true} />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailOpen && sviData && (
        <SviDetailView
          data={sviData}
          weights={weights}
          factorRanks={factorRanks}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  );
}
