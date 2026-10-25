// Premium playing card face — SVG-based so it stays crisp at every zoom level
// and on retina displays. Used by both the table's hole/board cards and the
// mini replayer cards, so board cards and hero cards always match exactly.
//
// Only the FRONT face is rendered here. Card backs are unchanged (the existing
// image-based backs are kept).

const SUIT_SYMBOL: Record<string, string> = {
  s: '♠', h: '♥', d: '♦', c: '♣',
};

// Saturated, modern poker suit colors. Spades/clubs use a rich near-black;
// hearts use a deep poker red, diamonds a slightly different red so the two
// red suits are always visually distinguishable (never collapse to one).
const SUIT_COLOR: Record<string, string> = {
  s: '#0a0a0a', c: '#1c1c1c', h: '#e11d2a', d: '#d4264a',
};

function parseCard(card: string): { rank: string; suit: string } | null {
  if (!card || card.length < 2) return null;
  const rank = card.slice(0, -1).toUpperCase();
  const suit = card.slice(-1).toLowerCase();
  if (!SUIT_SYMBOL[suit]) return null;
  return { rank, suit };
}

interface Props {
  card: string;
  width: number;
  height: number;
  hero?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function PremiumCardFace({ card, width, height, hero = false, className, style }: Props) {
  const parsed = parseCard(card);
  if (!parsed) return null;
  const { rank, suit } = parsed;
  const color = SUIT_COLOR[suit];
  const symbol = SUIT_SYMBOL[suit];
  const isRed = suit === 'h' || suit === 'd';

  // Corner pip sizing relative to card dimensions.
  const cornerRankFs = Math.round(height * 0.20);
  const cornerSuitFs = Math.round(height * 0.14);
  const centerRankFs = Math.round(height * 0.40);
  const centerSuitFs = Math.round(height * 0.30);

  // Corner pip positions (inset from edges).
  const cornerInsetX = width * 0.08;
  const cornerInsetY = height * 0.07;

  // SVG gives us retina-crisp rendering at any size. We use a subtle linear
  // gradient for the paper face, a thin gold border for premium feel, and
  // soft inner shadow for depth. All text is rendered as SVG text so it stays
  // sharp at every zoom level.
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: Math.max(6, Math.round(width * 0.11)),
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: hero
          ? '0 10px 30px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.4), 0 0 0 1px rgba(185,155,58,0.25)'
          : '0 6px 18px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id={`face-${rank}-${suit}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#fcfbf8" />
            <stop offset="100%" stopColor="#f6f4ef" />
          </linearGradient>
          <linearGradient id={`gloss-${rank}-${suit}`} x1="0" y1="0" x2="0.7" y2="0.7">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id={`shadow-${rank}-${suit}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="rgba(0,0,0,0.10)" />
          </filter>
        </defs>

        {/* Card face */}
        <rect
          x="0.5" y="0.5" width={width - 1} height={height - 1}
          rx={Math.max(6, Math.round(width * 0.11))}
          fill={`url(#face-${rank}-${suit})`}
          stroke={hero ? 'rgba(185,155,58,0.85)' : 'rgba(20,20,25,0.10)'}
          strokeWidth={hero ? 1.5 : 1}
        />

        {/* Top-left specular gloss */}
        <rect
          x="0.5" y="0.5" width={width - 1} height={height - 1}
          rx={Math.max(6, Math.round(width * 0.11))}
          fill={`url(#gloss-${rank}-${suit})`}
          opacity="0.7"
        />

        {/* Top-left corner pip (rank over suit) */}
        <g transform={`translate(${cornerInsetX}, ${cornerInsetY})`} filter={`url(#shadow-${rank}-${suit})`}>
          <text
            x="0" y={cornerRankFs}
            fontSize={cornerRankFs}
            fontWeight={900}
            fill={color}
            fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
            letterSpacing="-0.04em"
          >{rank}</text>
          <text
            x="0" y={cornerRankFs + cornerSuitFs + 1}
            fontSize={cornerSuitFs}
            fill={color}
            fontFamily="'Inter', system-ui, sans-serif"
          >{symbol}</text>
        </g>

        {/* Bottom-right corner pip (rotated 180°) */}
        <g
          transform={`translate(${width - cornerInsetX}, ${height - cornerInsetY}) rotate(180)`}
          filter={`url(#shadow-${rank}-${suit})`}
        >
          <text
            x="0" y={cornerRankFs}
            fontSize={cornerRankFs}
            fontWeight={900}
            fill={color}
            fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
            letterSpacing="-0.04em"
          >{rank}</text>
          <text
            x="0" y={cornerRankFs + cornerSuitFs + 1}
            fontSize={cornerSuitFs}
            fill={color}
            fontFamily="'Inter', system-ui, sans-serif"
          >{symbol}</text>
        </g>

        {/* Center rank + suit */}
        <g filter={`url(#shadow-${rank}-${suit})`}>
          <text
            x={width / 2} y={height * 0.50}
            fontSize={centerRankFs}
            fontWeight={900}
            fill={color}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
            letterSpacing="-0.05em"
          >{rank}</text>
          <text
            x={width / 2} y={height * 0.76}
            fontSize={centerSuitFs}
            fill={color}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Inter', system-ui, sans-serif"
          >{symbol}</text>
        </g>

        {/* Subtle inner edge highlight (top) */}
        <rect
          x="1.5" y="1.5" width={width - 3} height={Math.max(2, height * 0.06)}
          rx={Math.max(4, Math.round(width * 0.09))}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}
