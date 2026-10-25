import { useId } from 'react';

// ── Suit colors per spec ──
const SUIT_COLOR: Record<string, string> = {
  s: '#151820', c: '#151820', h: '#D82945', d: '#D82945',
};

// ── SVG suit paths (distinctive silhouettes, recognizable at small sizes) ──
const SUIT_PATH: Record<string, string> = {
  h: 'M50 88 C 42 76, 25 60, 18 48 C 12 38, 15 22, 30 18 C 40 16, 48 24, 50 32 C 52 24, 60 16, 70 18 C 85 22, 88 38, 82 48 C 75 60, 58 76, 50 88 Z',
  d: 'M50 90 L 18 45 L 50 8 L 82 45 Z',
  s: 'M50 8 C 38 28, 20 40, 20 54 C 20 64, 30 72, 42 68 C 38 76, 35 82, 36 88 L 64 88 C 65 82, 62 76, 58 68 C 70 72, 80 64, 80 54 C 80 40, 62 28, 50 8 Z',
  c: 'M50 12 C 40 12, 34 20, 34 28 C 34 32, 36 36, 38 38 C 30 32, 18 34, 14 44 C 10 54, 18 66, 30 64 C 36 63, 40 60, 42 56 C 40 64, 40 74, 44 82 L 38 88 L 62 88 L 56 82 C 60 74, 60 64, 58 56 C 60 60, 64 63, 70 64 C 82 66, 90 54, 86 44 C 82 34, 70 32, 62 38 C 64 36, 66 32, 66 28 C 66 20, 60 12, 50 12 Z',
};

function parseCard(card: string): { rank: string; suit: string } | null {
  if (!card || card.length < 2) return null;
  const rank = card.slice(0, -1).toUpperCase();
  const suitChar = card.slice(-1).toLowerCase();
  const suitMap: Record<string, string> = {
    s: 's', '\u2660': 's',
    h: 'h', '\u2665': 'h',
    d: 'd', '\u2666': 'd',
    c: 'c', '\u2663': 'c',
  };
  const suit = suitMap[suitChar];
  if (!suit) return null;
  return { rank, suit };
}

interface Props {
  card: string;
  width: number;
  height: number;
  hero?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Scale factor for corner rank/suit symbols. Default 1.0. Use 1.5 for HH Replayer, 1.25 for Workspace. */
  cornerScale?: number;
}

export function PremiumCardFace({ card, width, height, hero = false, className, style, cornerScale = 1 }: Props) {
  const parsed = parseCard(card);
  if (!parsed) return null;
  const { rank, suit } = parsed;
  const color = SUIT_COLOR[suit];
  const suitPath = SUIT_PATH[suit];

  // Proportional sizing — cornerScale enlarges corner rank+suit symbols
  const cornerRankFs = Math.round(height * 0.24 * cornerScale);
  const cornerSuitFs = Math.round(height * 0.14 * cornerScale);
  const centerSuitSize = Math.round(height * 0.40);
  const cornerInsetX = width * 0.10;
  const cornerInsetY = height * 0.07;
  const uid = useId().replace(/:/g, '');
  const gid = `face-${rank}-${suit}-${uid}`;
  const radius = Math.max(6, Math.round(width * 0.11));
  const goldBorder = '#C5B68B';

  return (
    <div
      className={className}
      style={{
        width, height,
        borderRadius: radius,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: hero
          ? '0 6px 18px rgba(0,0,0,0.45), 0 1px 5px rgba(0,0,0,0.3), 0 0 0 1px rgba(197,182,139,0.7), inset 0 1px 0 rgba(255,255,255,0.5)'
          : '0 4px 12px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.25), 0 0 0 0.8px rgba(197,182,139,0.45), inset 0 1px 0 rgba(255,255,255,0.4)',
        ...style,
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 100 100`} preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#FAFAF8" />
            <stop offset="100%" stopColor="#F5F2EC" />
          </linearGradient>
        </defs>
        {/* Background */}
        <rect x="1" y="1" width="98" height="98" rx={radius * (100 / width)} fill={`url(#${gid})`} stroke={goldBorder} strokeWidth="0.8" />

        {/* Upper-left corner: rank + small suit below it */}
        <text
          x={cornerInsetX * (100 / width)}
          y={cornerInsetY * (100 / height) + cornerRankFs * 0.72}
          fontSize={cornerRankFs}
          fontWeight={900}
          fill={color}
          fontFamily="'Inter','SF Pro Display',system-ui,sans-serif"
          letterSpacing="-0.02em"
        >
          {rank}
        </text>
        <text
          x={cornerInsetX * (100 / width) + 0.5}
          y={cornerInsetY * (100 / height) + cornerRankFs * 0.72 + cornerSuitFs * 0.85}
          fontSize={cornerSuitFs}
          fill={color}
          fontFamily="system-ui,sans-serif"
        >
          {SUIT_PATH[suit] ? '\u2660\u2665\u2666\u2663'[['s','h','d','c'].indexOf(suit)] : ''}
        </text>

        {/* Lower-right corner: rank + small suit, rotated 180° */}
        <g transform={`translate(${100 - cornerInsetX * (100 / width)}, ${100 - cornerInsetY * (100 / height)}) rotate(180)`}>
          <text
            x="0"
            y={cornerRankFs * 0.72}
            fontSize={cornerRankFs}
            fontWeight={900}
            fill={color}
            fontFamily="'Inter','SF Pro Display',system-ui,sans-serif"
            letterSpacing="-0.02em"
          >
            {rank}
          </text>
          <text
            x="0.5"
            y={cornerRankFs * 0.72 + cornerSuitFs * 0.85}
            fontSize={cornerSuitFs}
            fill={color}
            fontFamily="system-ui,sans-serif"
          >
            {SUIT_PATH[suit] ? '\u2660\u2665\u2666\u2663'[['s','h','d','c'].indexOf(suit)] : ''}
          </text>
        </g>

        {/* Center: large SVG suit symbol */}
        <g transform={`translate(50, 50) scale(${centerSuitSize / 100})`}>
          <path d={suitPath} fill={color} transform="translate(-50, -50)" />
        </g>
      </svg>
    </div>
  );
}
