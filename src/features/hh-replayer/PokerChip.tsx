import React from 'react';

export interface ChipDenom {
  value: number;
  label: string;
  face: string;
  edge: string;
  rim: string;
  inserts: string;
}

export const CHIP_DENOMS: ChipDenom[] = [
  { value: 5000, label: '5K', face: '#d4af37', edge: '#f5e6b0', rim: '#a07e18', inserts: '#1a1200' },
  { value: 1000, label: '1K', face: '#1a1a1e', edge: '#3a3a42', rim: '#0a0a0e', inserts: '#d4af37' },
  { value: 500, label: '500', face: '#5b3a8a', edge: '#9171c4', rim: '#3a2455', inserts: '#e0d0f0' },
  { value: 100, label: '100', face: '#1a1a2e', edge: '#3a5a8a', rim: '#0a0a1e', inserts: '#60a5fa' },
  { value: 25, label: '25', face: '#2d7a52', edge: '#6ee7b7', rim: '#164a30', inserts: '#a0f0c0' },
  { value: 10, label: '10', face: '#2a4a7a', edge: '#6090c0', rim: '#1a2a4a', inserts: '#a0c0e0' },
  { value: 5, label: '5', face: '#c0202a', edge: '#f0606a', rim: '#801018', inserts: '#f0a0a0' },
  { value: 1, label: '1', face: '#e8e8ec', edge: '#a0a0a8', rim: '#b8b8c0', inserts: '#606068' },
];

export function getDenomsForAmount(amount: number): { denom: ChipDenom; count: number }[] {
  let remaining = amount;
  const result: { denom: ChipDenom; count: number }[] = [];
  for (const d of CHIP_DENOMS) {
    if (remaining < d.value) continue;
    const count = Math.floor(remaining / d.value);
    if (count > 0) {
      result.push({ denom: d, count: Math.min(count, 10) });
      remaining -= count * d.value;
    }
  }
  return result.slice(0, 4);
}

interface PokerChipProps {
  denom: ChipDenom;
  size?: number;
  showLabel?: boolean;
  style?: React.CSSProperties;
}

export function PokerChip({ denom, size = 28, showLabel = true, style }: PokerChipProps) {
  const r = size / 2;
  const outerR = r - 0.5;
  const rimWidth = r * 0.16;
  const innerR = r - rimWidth;
  const faceR = innerR * 0.78;
  const numInserts = 8;
  const insertWidth = r * 0.14;

  const inserts = Array.from({ length: numInserts }, (_, i) => {
    const angle = (i * 360) / numInserts;
    const startAngle = angle - insertWidth;
    const endAngle = angle + insertWidth;
    const rad = (a: number) => (a * Math.PI) / 180;
    const x1 = r + outerR * Math.cos(rad(startAngle));
    const y1 = r + outerR * Math.sin(rad(startAngle));
    const x2 = r + outerR * Math.cos(rad(endAngle));
    const y2 = r + outerR * Math.sin(rad(endAngle));
    const x3 = r + innerR * Math.cos(rad(endAngle));
    const y3 = r + innerR * Math.sin(rad(endAngle));
    const x4 = r + innerR * Math.cos(rad(startAngle));
    const y4 = r + innerR * Math.sin(rad(startAngle));
    return { points: `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`, key: i };
  });

  const gid = `chip-${denom.value}-${denom.face.replace('#', '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', filter: 'drop-shadow(0 1.5px 2.5px rgba(0,0,0,0.6))', ...style }}
    >
      <defs>
        <radialGradient id={`${gid}-face`} cx="0.38" cy="0.32" r="0.72">
          <stop offset="0%" stopColor={denom.edge} stopOpacity="0.95" />
          <stop offset="35%" stopColor={denom.face} />
          <stop offset="100%" stopColor={denom.rim} />
        </radialGradient>
        <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={denom.edge} stopOpacity="0.7" />
          <stop offset="50%" stopColor={denom.rim} />
          <stop offset="100%" stopColor={denom.rim} stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`${gid}-gloss`} cx="0.35" cy="0.25" r="0.5">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Outer rim — darker, wider */}
      <circle cx={r} cy={r} r={outerR} fill={`url(#${gid}-rim)`} />

      {/* Edge inserts — trapezoidal markings */}
      {inserts.map((ins) => (
        <polygon key={ins.key} points={ins.points} fill={denom.inserts} opacity="0.9" />
      ))}

      {/* Inner face circle */}
      <circle cx={r} cy={r} r={innerR} fill={`url(#${gid}-face)`} />

      {/* Inner face ring — dashed decorative */}
      <circle cx={r} cy={r} r={innerR - 0.5} fill="none" stroke={denom.edge} strokeWidth="0.5" opacity="0.4" />
      <circle cx={r} cy={r} r={faceR} fill="none" stroke={denom.edge} strokeWidth="0.7" opacity="0.35" strokeDasharray="2 1.5" />

      {/* Label */}
      {showLabel && size >= 18 && (
        <text
          x={r}
          y={r}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.22}
          fontWeight={900}
          fill={denom.face === '#e8e8ec' ? '#404048' : '#fff'}
          opacity="0.92"
          fontFamily="'Inter',system-ui,sans-serif"
          style={{ letterSpacing: '-0.03em' }}
        >
          {denom.label}
        </text>
      )}

      {/* Gloss highlight */}
      <ellipse cx={r * 0.62} cy={r * 0.48} rx={r * 0.38} ry={r * 0.22} fill={`url(#${gid}-gloss)`} opacity="0.7" />
    </svg>
  );
}

interface ChipStackProps {
  amount: number;
  maxChips?: number;
  size?: 'small' | 'normal' | 'large';
  style?: React.CSSProperties;
}

export function ChipStack({ amount, maxChips = 7, size = 'normal', style }: ChipStackProps) {
  if (amount <= 0) return null;
  const denoms = getDenomsForAmount(amount);
  const chipSize = size === 'small' ? 16 : size === 'large' ? 22 : 19;
  const chipThickness = size === 'small' ? 3.2 : size === 'large' ? 4.7 : 4;

  // Scale visible chips by amount — small wagers show fewer chips
  const totalDenomCount = denoms.reduce((sum, d) => sum + d.count, 0);
  const visualScale = totalDenomCount <= 2 ? 1 : totalDenomCount <= 5 ? 2 : totalDenomCount <= 10 ? 3 : 4;
  const effectiveMax = Math.min(maxChips, Math.max(visualScale, Math.ceil(maxChips / 2)));

  const allChips: { denom: ChipDenom; index: number }[] = [];
  for (const { denom, count } of denoms) {
    const visible = Math.min(count, Math.ceil(effectiveMax / denoms.length) + 1);
    for (let i = 0; i < visible; i++) {
      allChips.push({ denom, index: i });
    }
  }
  const visibleChips = allChips.slice(0, effectiveMax);
  const stackHeight = visibleChips.length * chipThickness;

  return (
    <div
      style={{
        position: 'relative',
        width: chipSize,
        height: stackHeight + chipSize,
        filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))',
        ...style,
      }}
    >
      {visibleChips.map((chip, i) => (
        <div
          key={`${chip.denom.value}-${i}`}
          style={{
            position: 'absolute',
            bottom: i * chipThickness,
            left: 0,
            transition: 'bottom 0.2s ease, left 0.2s ease, opacity 0.2s ease',
          }}
        >
          <PokerChip denom={chip.denom} size={chipSize} showLabel={chipSize >= 18} />
        </div>
      ))}
      {/* Base shadow ellipse */}
      <div
        style={{
          position: 'absolute',
          bottom: -2,
          left: '50%',
          transform: 'translateX(-50%)',
          width: chipSize * 0.9,
          height: chipSize * 0.25,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.3)',
          filter: 'blur(2px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

interface PotChipPileProps {
  amount: number;
  size?: 'small' | 'normal';
}

export function PotChipPile({ amount, size = 'normal' }: PotChipPileProps) {
  if (amount <= 0) return null;
  const denoms = getDenomsForAmount(amount);
  const chipSize = size === 'small' ? 17 : 20;
  const chipThickness = size === 'small' ? 3.2 : 4;

  const piles: React.ReactNode[] = [];
  const pileSpacing = chipSize * 0.72;

  denoms.forEach(({ denom, count }, di) => {
    const visibleCount = Math.min(count, 5);
    const xOffset = (di - (denoms.length - 1) / 2) * pileSpacing;
    for (let i = 0; i < visibleCount; i++) {
      const jitter = ((di * 13 + i * 7) % 7) - 3;
      piles.push(
        <div
          key={`${denom.value}-${di}-${i}`}
          style={{
            position: 'absolute',
            bottom: i * chipThickness,
            left: `calc(50% + ${xOffset + jitter}px)`,
            transform: 'translateX(-50%)',
            transition: 'bottom 0.25s ease, left 0.25s ease',
          }}
        >
          <PokerChip denom={denom} size={chipSize} showLabel={chipSize >= 18} />
        </div>
      );
    }
  });

  const totalWidth = denoms.length * pileSpacing + chipSize;
  const maxStackHeight = Math.max(...denoms.map((d) => Math.min(d.count, 5))) * chipThickness + chipSize;

  return (
    <div
      style={{
        position: 'relative',
        width: totalWidth,
        height: maxStackHeight,
        filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.7))',
      }}
    >
      {piles}
    </div>
  );
}
