import { PremiumCardFace } from '@/features/hh-replayer/PremiumCardFace';

const SUIT_SYMBOL: Record<string, string> = {
  s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663',
};

const SUIT_NAME: Record<string, string> = {
  spades: 's', s: 's', '\u2660': 's',
  hearts: 'h', h: 'h', '\u2665': 'h',
  diamonds: 'd', d: 'd', '\u2666': 'd',
  clubs: 'c', c: 'c', '\u2663': 'c',
};

const RANK_MAP: Record<string, string> = {
  A: 'A', a: 'A',
  K: 'K', k: 'K',
  Q: 'Q', q: 'Q',
  J: 'J', j: 'J',
  T: 'T', t: 'T',
};

function normalizeSuit(suit: string): string {
  return SUIT_NAME[suit] ?? suit.toLowerCase();
}

function normalizeRank(rank: string): string {
  return RANK_MAP[rank] ?? rank.toUpperCase();
}

export interface MiniPlayingCardProps {
  rank: string;
  suit: string;
  size?: 'small' | 'medium';
}

const SIZES = {
  small: { w: 26, h: 36 },
  medium: { w: 34, h: 48 },
};

export function MiniPlayingCard({ rank, suit, size = 'small' }: MiniPlayingCardProps) {
  const r = normalizeRank(rank);
  const s = normalizeSuit(suit);
  const card = `${r}${s}`;
  const { w, h } = SIZES[size];

  return (
    <div style={{ flexShrink: 0, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
      <PremiumCardFace card={card} width={w} height={h} cornerScale={1.25} />
    </div>
  );
}

export interface PokerCardGroupProps {
  cards: string[];
  size?: 'small' | 'medium';
  /** Optional label shown before the card row, e.g. "FLOP" */
  label?: string;
}

function parseCardStr(card: string): { rank: string; suit: string } | null {
  if (!card || card.length < 2) return null;
  const suitChar = card.slice(-1).toLowerCase();
  if (!SUIT_SYMBOL[suitChar]) return null;
  const rank = card.slice(0, -1);
  return { rank, suit: suitChar };
}

export function PokerCardGroup({ cards, size = 'small', label }: PokerCardGroupProps) {
  const parsed = cards.map(parseCardStr).filter(Boolean) as { rank: string; suit: string }[];
  if (parsed.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5" style={{ flexWrap: 'nowrap' }}>
      {label && (
        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase mr-1">{label}</span>
      )}
      <div className="inline-flex items-center gap-1" style={{ flexWrap: 'nowrap' }}>
        {parsed.map((c, i) => (
          <MiniPlayingCard key={`${c.rank}${c.suit}-${i}`} rank={c.rank} suit={c.suit} size={size} />
        ))}
      </div>
    </div>
  );
}

export { SUIT_SYMBOL, normalizeRank, normalizeSuit };
