import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchSviUserRank,
  fetchSviHonors,
  sviRank,
  sviDivision,
  SVI_RANKS,
  SVI_HONORS,
  SVI_DIVISIONS,
  type SviUserRank,
  type SviHonor,
} from '@/lib/sviStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export function rankKeyToLabel(key: string): string {
  const r = SVI_RANKS.find((r) => r.key === key);
  return r?.label ?? 'Lieutenant';
}

export function rankKeyToColor(key: string): string {
  const r = SVI_RANKS.find((r) => r.key === key);
  return r?.color ?? '#9ca3af';
}

export function divisionLabel(key: string): string {
  const d = SVI_DIVISIONS.find((d) => d.key === key);
  return d?.label ?? key;
}

export function divisionColor(key: string): string {
  const d = SVI_DIVISIONS.find((d) => d.key === key);
  return d?.color ?? '#9ca3af';
}

export function honorLabel(key: string): string {
  const h = SVI_HONORS.find((h) => h.key === key);
  return h?.label ?? key;
}

export function honorDesc(key: string): string {
  const h = SVI_HONORS.find((h) => h.key === key);
  return h?.desc ?? '';
}

interface InsigniaProps {
  rankKey: string;
  size?: number;
  color?: string;
}

export function RankInsignia({ rankKey, size = 48, color }: InsigniaProps) {
  const c = color ?? rankKeyToColor(rankKey);
  const id = `insignia-${rankKey}-${size}`;

  switch (rankKey) {
    case 'commander':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={c} stopOpacity="0.25" />
              <stop offset="100%" stopColor={c} stopOpacity="0.05" />
            </radialGradient>
            <linearGradient id={`${id}-star`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff7d6" />
              <stop offset="50%" stopColor={c} />
              <stop offset="100%" stopColor={c} stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} stroke={c} strokeWidth="1.5" opacity="0.6" />
          <circle cx="32" cy="32" r="26" fill="none" stroke={c} strokeWidth="0.5" opacity="0.3" />
          {/* 4 stars in arc + crown laurel */}
          {[0, 1, 2, 3].map((i) => {
            const angle = -50 + i * 33;
            const rad = (angle * Math.PI) / 180;
            const x = 32 + Math.cos(rad) * 14;
            const y = 28 + Math.sin(rad) * 6;
            return (
              <g key={i}>
                <path
                  d={`M ${x} ${y - 4} L ${x + 1.2} ${y - 1.5} L ${x + 4} ${y - 1} L ${x + 2} ${y + 1} L ${x + 2.5} ${y + 4} L ${x} ${y + 2.5} L ${x - 2.5} ${y + 4} L ${x - 2} ${y + 1} L ${x - 4} ${y - 1} L ${x - 1.2} ${y - 1.5} Z`}
                  fill={`url(#${id}-star)`}
                  stroke={c}
                  strokeWidth="0.3"
                />
              </g>
            );
          })}
          {/* laurel branches */}
          <path d="M 16 42 Q 22 48 32 50 Q 42 48 48 42" fill="none" stroke={c} strokeWidth="1" opacity="0.5" />
          <path d="M 20 44 Q 24 47 28 48" fill="none" stroke={c} strokeWidth="0.5" opacity="0.3" />
          <path d="M 44 44 Q 40 47 36 48" fill="none" stroke={c} strokeWidth="0.5" opacity="0.3" />
        </svg>
      );

    case 'general':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={c} stopOpacity="0.2" />
              <stop offset="100%" stopColor={c} stopOpacity="0.04" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} stroke={c} strokeWidth="1.5" opacity="0.5" />
          {/* 3 stars */}
          {[0, 1, 2].map((i) => {
            const x = 22 + i * 10;
            const y = 32;
            return (
              <path
                key={i}
                d={`M ${x} ${y - 5} L ${x + 1.5} ${y - 1.5} L ${x + 5} ${y - 1} L ${x + 2.5} ${y + 1.2} L ${x + 3} ${y + 5} L ${x} ${y + 3} L ${x - 3} ${y + 5} L ${x - 2.5} ${y + 1.2} L ${x - 5} ${y - 1} L ${x - 1.5} ${y - 1.5} Z`}
                fill={c}
                stroke={c}
                strokeWidth="0.3"
              />
            );
          })}
          <path d="M 18 42 Q 26 48 32 49 Q 38 48 46 42" fill="none" stroke={c} strokeWidth="0.8" opacity="0.4" />
        </svg>
      );

    case 'colonel':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={c} stopOpacity="0.18" />
              <stop offset="100%" stopColor={c} stopOpacity="0.03" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} stroke={c} strokeWidth="1.5" opacity="0.5" />
          {/* eagle silhouette */}
          <path
            d="M 32 20 L 28 24 L 24 23 L 26 27 L 20 30 L 27 31 L 24 36 L 29 34 L 30 40 L 32 38 L 34 40 L 35 34 L 40 36 L 37 31 L 44 30 L 38 27 L 40 23 L 36 24 Z"
            fill={c}
            opacity="0.8"
            stroke={c}
            strokeWidth="0.3"
          />
          <path d="M 18 42 Q 26 46 32 47 Q 38 46 46 42" fill="none" stroke={c} strokeWidth="0.8" opacity="0.3" />
        </svg>
      );

    case 'major':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={c} stopOpacity="0.15" />
              <stop offset="100%" stopColor={c} stopOpacity="0.03" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} stroke={c} strokeWidth="1.5" opacity="0.45" />
          {/* gold oak leaf */}
          <path
            d="M 32 18 Q 28 24 28 30 Q 28 36 32 42 Q 36 36 36 30 Q 36 24 32 18 Z"
            fill={c}
            opacity="0.7"
            stroke={c}
            strokeWidth="0.5"
          />
          {/* leaf veins */}
          <line x1="32" y1="20" x2="32" y2="40" stroke={c} strokeWidth="0.5" opacity="0.4" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line x1="32" y1={24 + i * 5} x2={29 - i} y2={26 + i * 5} stroke={c} strokeWidth="0.3" opacity="0.3" />
              <line x1="32" y1={24 + i * 5} x2={35 + i} y2={26 + i * 5} stroke={c} strokeWidth="0.3" opacity="0.3" />
            </g>
          ))}
        </svg>
      );

    case 'captain':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={c} stopOpacity="0.12" />
              <stop offset="100%" stopColor={c} stopOpacity="0.02" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} stroke={c} strokeWidth="1.5" opacity="0.4" />
          {/* double bar */}
          <rect x="20" y="28" width="24" height="3" rx="1" fill={c} opacity="0.7" />
          <rect x="20" y="34" width="24" height="3" rx="1" fill={c} opacity="0.7" />
        </svg>
      );

    default: // lieutenant
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={c} stopOpacity="0.1" />
              <stop offset="100%" stopColor={c} stopOpacity="0.02" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} stroke={c} strokeWidth="1.5" opacity="0.35" />
          {/* single bar */}
          <rect x="22" y="29" width="20" height="6" rx="1.5" fill={c} opacity="0.6" />
        </svg>
      );
  }
}

interface HonorBadgeProps {
  honorKey: string;
  awardedAt?: string;
  size?: number;
}

export function HonorBadge({ honorKey, awardedAt, size = 40 }: HonorBadgeProps) {
  const c = '#d4a52c';
  const label = honorLabel(honorKey);

  const icon = (() => {
    switch (honorKey) {
      case 'division_vanguard':
        return (
          <g>
            <path d="M 20 14 L 28 26 L 20 26 L 26 36 L 18 36 L 24 48 L 12 48 L 18 36 L 10 36 L 16 26 L 8 14 Z" fill={c} opacity="0.7" />
            <path d="M 44 14 L 36 26 L 44 26 L 38 36 L 46 36 L 40 48 L 52 48 L 46 36 L 54 36 L 48 26 L 56 14 Z" fill={c} opacity="0.7" />
          </g>
        );
      case 'division_commander':
        return (
          <g>
            <circle cx="32" cy="32" r="18" fill="none" stroke={c} strokeWidth="2" opacity="0.5" />
            <path d="M 32 18 L 33.5 27 L 42 27 L 35 32 L 37 41 L 32 36 L 27 41 L 29 32 L 22 27 L 30.5 27 Z" fill={c} opacity="0.8" />
          </g>
        );
      case 'elite_veteran':
        return (
          <g>
            <path d="M 32 12 L 36 22 L 47 23 L 39 30 L 42 41 L 32 36 L 22 41 L 25 30 L 17 23 L 28 22 Z" fill={c} opacity="0.7" stroke={c} strokeWidth="0.5" />
            <path d="M 24 44 Q 32 50 40 44" fill="none" stroke={c} strokeWidth="1.5" opacity="0.4" />
          </g>
        );
      case 'global_vanguard':
        return (
          <g>
            <circle cx="32" cy="32" r="20" fill="none" stroke={c} strokeWidth="1.5" opacity="0.4" />
            <circle cx="32" cy="32" r="16" fill="none" stroke={c} strokeWidth="1" opacity="0.3" />
            <path d="M 32 16 L 34 28 L 46 28 L 37 34 L 40 46 L 32 39 L 24 46 L 27 34 L 18 28 L 30 28 Z" fill={c} opacity="0.85" />
          </g>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="group relative flex flex-col items-center" title={label}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`honor-${honorKey}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={c} stopOpacity="0.15" />
            <stop offset="100%" stopColor={c} stopOpacity="0.02" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill={`url(#honor-${honorKey})`} stroke={c} strokeWidth="1" opacity="0.3" />
        {icon}
      </svg>
      {awardedAt && (
        <span className="mt-0.5 text-[7px] text-white/30">
          {new Date(awardedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      )}
    </div>
  );
}

interface SviRankDisplayProps {
  rankData: SviUserRank | null;
  honors: SviHonor[];
  compact?: boolean;
}

export function SviRankDisplay({ rankData, honors, compact }: SviRankDisplayProps) {
  const [slide, setSlide] = useState(0);

  const slides: { type: 'rank' | 'honor'; honorKey?: string; awardedAt?: string }[] = [
    { type: 'rank' },
    ...honors.map((h) => ({ type: 'honor' as const, honorKey: h.honor_key, awardedAt: h.awarded_at })),
  ];
  const total = slides.length;

  const next = useCallback(() => setSlide((s) => (s + 1) % total), [total]);
  const prev = useCallback(() => setSlide((s) => (s - 1 + total) % total), [total]);

  if (!rankData) {
    return (
      <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.5)' }}>
        <p className="text-xs text-white/30">Not ranked — opt in to SVI and play 5,000+ hands to earn a division rank.</p>
      </div>
    );
  }

  const rank = sviRank(rankData.division_rank, rankData.total_in_division);
  const div = sviDivision(rankData.svi_score);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <RankInsignia rankKey={rank.key} size={36} />
        <div>
          <div className="text-[11px] font-bold" style={{ color: rank.color }}>{rank.label}</div>
          <div className="text-[9px] text-white/40">{divisionLabel(rankData.division)} · #{rankData.division_rank}/{rankData.total_in_division}</div>
        </div>
        {honors.length > 0 && (
          <div className="ml-auto flex gap-1">
            {honors.slice(0, 4).map((h) => (
              <HonorBadge key={h.honor_key} honorKey={h.honor_key} size={24} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const current = slides[slide] ?? slides[0];

  return (
    <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="mb-3 flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Military Rank & Honors</span>
        {total > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={prev} className="rounded-md border border-white/[0.08] p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <span className="text-[9px] font-mono text-white/40">{slide + 1} / {total}</span>
            <button onClick={next} className="rounded-md border border-white/[0.08] p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {current.type === 'rank' ? (
        <div className="flex items-center gap-4">
          <RankInsignia rankKey={rank.key} size={56} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Active Rank</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold" style={{ color: rank.color }}>{rank.label}</span>
              <span className="text-[10px] text-white/40">in {divisionLabel(rankData.division)} Division</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/50">
              <span>Division Rank: <strong className="text-white/70">#{rankData.division_rank}</strong> / {rankData.total_in_division}</span>
              <span>Global Rank: <strong className="text-white/70">#{rankData.overall_rank}</strong> / {rankData.total_eligible}</span>
              {div && <span>SVI Tier: <strong style={{ color: div.color }}>{div.label}</strong></span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <HonorBadge honorKey={current.honorKey!} awardedAt={current.awardedAt} size={56} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Historical Honor</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold" style={{ color: GOLD }}>{honorLabel(current.honorKey!)}</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-white/50">{honorDesc(current.honorKey!)}</p>
            {current.awardedAt && (
              <p className="mt-1 text-[9px] text-white/35">Earned {new Date(current.awardedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SviProfileRankSectionProps {
  userId: string;
}

export function SviProfileRankSection({ userId }: SviProfileRankSectionProps) {
  const [rankData, setRankData] = useState<SviUserRank | null>(null);
  const [honors, setHonors] = useState<SviHonor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [rank, hon] = await Promise.all([
        fetchSviUserRank(userId),
        fetchSviHonors(userId),
      ]);
      if (!mounted) return;
      setRankData(rank);
      setHonors(hon);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border border-white/20 border-t-[#d4a52c]" />
      </div>
    );
  }

  if (!rankData && honors.length === 0) return null;

  return <SviRankDisplay rankData={rankData} honors={honors} />;
}
