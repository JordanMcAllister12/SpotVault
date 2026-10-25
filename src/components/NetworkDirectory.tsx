import {
  ShieldCheck, ShoppingBag, Radio, Briefcase, GraduationCap, Users,
  Video, TrendingUp, Calendar, Handshake, Store, Lock, Check, ChevronRight,
  X, Network as NetworkIcon, ArrowLeft, MapPin, HeartPulse,
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { DIRECTORY_HUBS, type DirectoryHub } from '@/types';

const ICONS: Record<string, typeof ShieldCheck> = {
  ShieldCheck, ShoppingBag, Radio, Briefcase, GraduationCap, Users,
  Video, TrendingUp, Calendar, Handshake, Store, HeartPulse,
};

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type AccessTier = 'home' | 'available' | 'locked' | 'coming';

function tierFor(hub: DirectoryHub): AccessTier {
  if (hub.status === 'home') return 'home';
  if (hub.status === 'available' || hub.status === 'guest') return 'available';
  if (hub.status === 'coming') return 'coming';
  return 'locked';
}

const TIER_FILL: Record<AccessTier, string> = {
  home: 'rgba(212, 165, 44, 0.14)',
  available: 'rgba(170, 182, 194, 0.07)',
  locked: 'rgba(95, 110, 124, 0.05)',
  coming: 'rgba(42, 50, 59, 0.04)',
};

const TIER_STROKE: Record<AccessTier, string> = {
  home: 'rgba(212, 165, 44, 0.55)',
  available: 'rgba(170, 182, 194, 0.22)',
  locked: 'rgba(95, 110, 124, 0.18)',
  coming: 'rgba(42, 50, 59, 0.14)',
};

const TIER_ICON_COLOR: Record<AccessTier, string> = {
  home: '#d4a52c',
  available: '#aab6c2',
  locked: '#5f6e7c',
  coming: '#3a424c',
};

const TIER_TEXT: Record<AccessTier, string> = {
  home: '#f5e6b0',
  available: '#c7cfd8',
  locked: '#7a8693',
  coming: '#4a525c',
};

interface Props {
  onEnterHub: (hubId: string) => void;
  onClose: () => void;
  onBackToHub: () => void;
  currentHubId?: string;
}

export function NetworkDirectory({ onEnterHub, onClose, onBackToHub, currentHubId }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const activeId = hovered ?? selected ?? currentHubId ?? 'player';
  const activeHub = DIRECTORY_HUBS.find((h) => h.id === activeId) ?? DIRECTORY_HUBS[0];
  const currentHub = DIRECTORY_HUBS.find((h) => h.id === currentHubId) ?? DIRECTORY_HUBS[0];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#050608]">
      <Header currentHubName={currentHub.name} onClose={onClose} onBackToHub={onBackToHub} />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex min-h-full max-w-7xl flex-col items-center justify-center gap-8 p-6 lg:flex-row lg:items-center lg:gap-12 lg:p-8">
          <NetworkWheel
            currentHubId={currentHubId}
            activeId={activeId}
            onHover={setHovered}
            onSelect={(id) => {
              setSelected(id);
              const hub = DIRECTORY_HUBS.find((h) => h.id === id);
              if (hub && tierFor(hub) !== 'coming') onEnterHub(id);
            }}
          />

          <DetailPanel hub={activeHub} currentHubId={currentHubId} onEnter={() => onEnterHub(activeHub.id)} />
        </div>
      </div>
    </div>
  );
}

function Header({ currentHubName, onClose, onBackToHub }: { currentHubName: string; onClose: () => void; onBackToHub: () => void }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-8 py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Hub
        </button>
        <div className="flex items-center gap-2.5">
          <NetworkIcon className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SpotVault Network</h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">The Poker Industry — Connected</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 lg:flex">
          <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Location:</span>
          <span className="text-[10px] font-mono tracking-widest text-[#f5e6b0] uppercase">{currentHubName}</span>
        </div>
        <button onClick={onClose} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}

function NetworkWheel({
  currentHubId,
  activeId,
  onHover,
  onSelect,
}: {
  currentHubId?: string;
  activeId: string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const size = 560;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 250;
  const innerR = 78;
  const n = DIRECTORY_HUBS.length;
  const sliceAngle = (2 * Math.PI) / n;

  const slices = useMemo(() => {
    return DIRECTORY_HUBS.map((hub, i) => {
      const a1 = i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
      const a2 = a1 + sliceAngle;
      const mid = (a1 + a2) / 2;
      const tier = tierFor(hub);
      const isCurrent = hub.id === currentHubId;
      const isActive = hub.id === activeId;
      const Icon = ICONS[hub.iconName] || ShieldCheck;

      const p1x = cx + outerR * Math.cos(a1);
      const p1y = cy + outerR * Math.sin(a1);
      const p2x = cx + outerR * Math.cos(a2);
      const p2y = cy + outerR * Math.sin(a2);
      const ip1x = cx + innerR * Math.cos(a1);
      const ip1y = cy + innerR * Math.sin(a1);
      const ip2x = cx + innerR * Math.cos(a2);
      const ip2y = cy + innerR * Math.sin(a2);

      const path = `M ${ip1x} ${ip1y} L ${p1x} ${p1y} A ${outerR} ${outerR} 0 0 1 ${p2x} ${p2y} L ${ip2x} ${ip2y} A ${innerR} ${innerR} 0 0 0 ${ip1x} ${ip1y} Z`;

      const labelR = (outerR + innerR) / 2 + 18;
      const lx = cx + labelR * Math.cos(mid);
      const ly = cy + labelR * Math.sin(mid);

      const iconR = (outerR + innerR) / 2 - 16;
      const ix = cx + iconR * Math.cos(mid);
      const iy = cy + iconR * Math.sin(mid);

      const isHover = isActive && !isCurrent;
      const expand = isHover ? 8 : 0;
      const eMid = mid;
      const eIx = cx + (iconR + expand) * Math.cos(eMid);
      const eIy = cy + (iconR + expand) * Math.sin(eMid);
      const eLx = cx + (labelR + expand) * Math.cos(eMid);
      const eLy = cy + (labelR + expand) * Math.sin(eMid);

      return { hub, tier, isCurrent, isActive, Icon, path, lx: eLx, ly: eLy, ix: eIx, iy: eIy, mid };
    });
  }, [activeId, currentHubId, sliceAngle]);

  return (
    <div className="relative flex shrink-0 items-center justify-center animate-fade-in" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <radialGradient id="wheel-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(212,165,44,0.06)" />
            <stop offset="60%" stopColor="rgba(212,165,44,0.02)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="current-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={outerR + 14} fill="url(#wheel-glow)" />

        {slices.map(({ hub, tier, isCurrent, isActive, Icon, path, lx, ly, ix, iy, mid }) => (
          <g
            key={hub.id}
            className="cursor-pointer transition-all duration-300"
            onMouseEnter={() => onHover(hub.id)}
            onClick={() => onSelect(hub.id)}
            style={{ filter: isCurrent ? 'url(#current-glow)' : undefined }}
          >
            <path
              d={path}
              fill={TIER_FILL[tier]}
              stroke={isCurrent ? GOLD : TIER_STROKE[tier]}
              strokeWidth={isCurrent ? 2 : isActive ? 1.2 : 0.8}
              style={{ transition: 'all 0.3s ease' }}
            />
            <g style={{ transition: 'transform 0.3s ease', transform: isActive && !isCurrent ? `translate(${(lx - lx) * 0}, 0)` : 'none' }}>
              <Icon
                x={ix - 11}
                y={iy - 11}
                width={22}
                height={22}
                strokeWidth={1.5}
                style={{ color: isCurrent ? GOLD : TIER_ICON_COLOR[tier], transition: 'all 0.3s ease' }}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: hub.name.length > 12 ? '8px' : '9px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  fill: isCurrent ? GOLD_SOFT : TIER_TEXT[tier],
                  textTransform: 'uppercase',
                  transition: 'all 0.3s ease',
                }}
              >
                {hub.name.toUpperCase().replace(' HUB', '').replace(' & INDUSTRY', '')}
              </text>
            </g>
          </g>
        ))}

        <circle cx={cx} cy={cy} r={innerR - 2} fill="#0a0c0e" stroke="rgba(212,165,44,0.3)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={innerR - 10} fill="none" stroke="rgba(212,165,44,0.08)" strokeWidth={0.5} />
        <text x={cx} y={cy - 14} textAnchor="middle" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', fill: GOLD_SOFT }}>
          SPOTVAULT
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', fill: GOLD }}>
          NETWORK
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" style={{ fontSize: '6.5px', fontWeight: 500, letterSpacing: '0.15em', fill: 'rgba(212,165,44,0.5)' }}>
          THE POKER INDUSTRY
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" style={{ fontSize: '6.5px', fontWeight: 500, letterSpacing: '0.15em', fill: 'rgba(212,165,44,0.4)' }}>
          CONNECTED
        </text>
      </svg>

      {currentHubId && (() => {
        const idx = DIRECTORY_HUBS.findIndex((h) => h.id === currentHubId);
        if (idx < 0) return null;
        const mid = idx * sliceAngle - Math.PI / 2;
        const markerR = outerR + 30;
        const mx = cx + markerR * Math.cos(mid);
        const my = cy + markerR * Math.sin(mid);
        const isTop = my < cy;
        return (
          <div
            className="pointer-events-none absolute flex flex-col items-center gap-1 animate-fade-in"
            style={{
              left: mx,
              top: my,
              transform: `translate(-50%, ${isTop ? '-100%' : '0'})`,
            }}
          >
            {isTop && <YouAreHereMarker />}
            <div
              className="h-0 w-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: isTop ? 'none' : '7px solid #d4a52c',
                borderBottom: isTop ? '7px solid #d4a52c' : 'none',
              }}
            />
            {!isTop && <YouAreHereMarker />}
          </div>
        );
      })()}
    </div>
  );
}

function YouAreHereMarker() {
  return (
    <div
      className="flex items-center gap-1 rounded-full border px-2.5 py-1 whitespace-nowrap"
      style={{
        borderColor: GOLD,
        background: 'rgba(12,10,8,0.92)',
        boxShadow: '0 0 16px rgba(212,165,44,0.4)',
      }}
    >
      <MapPin className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />
      <span className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color: GOLD_SOFT }}>You Are Here</span>
    </div>
  );
}

function DetailPanel({ hub, currentHubId, onEnter }: { hub: DirectoryHub; currentHubId?: string; onEnter: () => void }) {
  const tier = tierFor(hub);
  const Icon = ICONS[hub.iconName] || ShieldCheck;
  const isCurrent = hub.id === currentHubId;

  return (
    <div
      key={hub.id}
      className="w-full max-w-sm animate-fade-in rounded-xl border p-5"
      style={{ borderColor: isCurrent ? 'rgba(212,165,44,0.4)' : BORDER, background: 'rgba(12,10,8,0.6)', boxShadow: isCurrent ? '0 0 32px -8px rgba(212,165,44,0.25)' : '0 8px 32px -12px rgba(0,0,0,0.6)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: isCurrent ? 'rgba(212,165,44,0.5)' : 'rgba(212,165,44,0.2)', background: isCurrent ? 'linear-gradient(to bottom, #2a2010, #1a1408)' : 'rgba(28,34,40,0.5)' }}
        >
          <Icon className="h-5 w-5" style={{ color: isCurrent ? GOLD : TIER_ICON_COLOR[tier] }} strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">{hub.name}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#84929f]">{hub.tagline}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[#7a8693]">{hub.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {hub.examples.slice(0, 5).map((ex) => (
          <span key={ex} className="rounded border border-[#1a1f25] bg-[#11151a]/60 px-2 py-0.5 text-[9px] font-mono tracking-wide text-[#5f6e7c]">
            {ex}
          </span>
        ))}
      </div>

      <div className="mt-4 border-t border-[#1a1f25] pt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">Access:</span>
          <span
            className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase"
            style={{ color: isCurrent ? GOLD_SOFT : TIER_TEXT[tier] }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: isCurrent ? GOLD : TIER_ICON_COLOR[tier], boxShadow: isCurrent ? '0 0 6px rgba(212,165,44,0.5)' : 'none' }}
            />
            {hub.statusLabel}
          </span>
        </div>

        {tier === 'coming' ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1a1f25] bg-[#11151a]/40 py-2.5 text-[10px] font-semibold tracking-widest text-[#475565] uppercase">
            <Calendar className="h-3 w-3" strokeWidth={1.5} /> {hub.buttonLabel}
          </div>
        ) : tier === 'locked' ? (
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] py-2.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
            <Lock className="h-3 w-3" strokeWidth={1.5} /> {hub.buttonLabel}
          </button>
        ) : (
          <button
            onClick={onEnter}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
            style={
              isCurrent
                ? { border: '1px solid rgba(212,165,44,0.5)', background: 'linear-gradient(to bottom, rgba(212,165,44,0.2), rgba(131,94,23,0.2))', color: GOLD_SOFT }
                : { border: '1px solid #232a32', background: '#161b21', color: '#aab6c2' }
            }
          >
            {isCurrent && <Check className="h-3 w-3" strokeWidth={1.5} />}
            {hub.buttonLabel} <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
