import React, { useState, useEffect, useMemo, memo } from 'react';
import { PremiumCardFace } from './PremiumCardFace';
import { PokerChip, ChipStack, PotChipPile, CHIP_DENOMS, getDenomsForAmount, type ChipDenom } from './PokerChip';
import type { NormalizedHand, NormalizedPlayer, Street, ActionType } from './types';
import type { ReplayState, PlayerState, ReplayEvent } from './replayEngine';

// ── Card sizing ──

interface CardDimensions { w: number; h: number; }

function getCardDimensions(opts: { small?: boolean; boardCard?: boolean; large?: boolean; mini?: boolean; visualSize?: 'main' | 'student'; holeCardScale?: number; cardScale?: number }): CardDimensions {
  const { small, boardCard, large, mini, visualSize, holeCardScale = 1, cardScale = 1 } = opts;
  const isMainSize = visualSize === 'main';
  const w = small ? (isMainSize ? 38 : 26) : boardCard ? (mini ? 44 : isMainSize ? 75 : 67) : large ? (mini ? 32 : isMainSize ? 54 : 53) : (mini ? 32 : isMainSize ? 54 : 53);
  const h = small ? (isMainSize ? 54 : 38) : boardCard ? (mini ? 63 : isMainSize ? 106 : 95) : large ? (mini ? 45 : isMainSize ? 75 : 75) : (mini ? 45 : isMainSize ? 75 : 75);
  if (large && !boardCard && !small && holeCardScale !== 1) {
    return { w: Math.round(w * holeCardScale * cardScale), h: Math.round(h * holeCardScale * cardScale) };
  }
  return { w: Math.round(w * cardScale), h: Math.round(h * cardScale) };
}

// ── Card rendering ──

const HoleCard = memo(function HoleCard({ card, large, hero, mini, variant, visualSize, dealDelay, holeCardScale, cardScale }: {
  card: string; large?: boolean; hero?: boolean; mini?: boolean; variant?: string; visualSize?: 'main' | 'student'; dealDelay: number; holeCardScale?: number; cardScale?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), dealDelay);
    return () => clearTimeout(t);
  }, [dealDelay]);
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1) translateY(0px)' : 'scale(0.7) translateY(-12px)', transition: 'opacity 0.22s ease, transform 0.25s ease' }}>
      <PlayingCard card={card} large={large} hero={hero} mini={mini} variant={variant} visualSize={visualSize} holeCardScale={holeCardScale} cardScale={cardScale} />
    </div>
  );
});

const PlayingCard = memo(function PlayingCard({ card, hidden, small, large, hero, mini, boardCard, variant, visualSize, holeCardScale, cardScale }: {
  card?: string; hidden?: boolean; small?: boolean; large?: boolean; hero?: boolean; mini?: boolean; boardCard?: boolean; variant?: string; visualSize?: 'main' | 'student'; holeCardScale?: number; cardScale?: number;
}) {
  const { w, h } = getCardDimensions({ small, boardCard, large, mini, visualSize, holeCardScale, cardScale });

  // Hero's hole cards are 20% larger than opponents' for visual emphasis.
  // Only applies to hole cards (large, not board, not small) when hero=true.
  const isHeroHoleCard = hero && large && !boardCard && !small;
  const fw = isHeroHoleCard ? Math.round(w * 1.2) : w;
  const fh = isHeroHoleCard ? Math.round(h * 1.2) : h;

  if (hidden || !card) {
    return (
      <div style={{ width: fw, height: fh, borderRadius: 8, flexShrink: 0, boxSizing: 'border-box', background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)', border: '1.5px solid rgba(185,155,58,0.3)', boxShadow: '0 4px 14px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: fw * 0.6, height: fh * 0.6, borderRadius: 4, border: '1px solid rgba(185,155,58,0.2)', background: 'repeating-linear-gradient(45deg, rgba(185,155,58,0.06) 0, rgba(185,155,58,0.06) 3px, transparent 3px, transparent 7px)' }} />
      </div>
    );
  }
  return <PremiumCardFace card={card} width={fw} height={fh} hero={hero} cornerScale={1.5} />;
});

const BoardCard = memo(function BoardCard({ card, revealed, animDelay, mini, visualSize, cardScale, slotKey }: { card?: string; revealed: boolean; animDelay?: number; mini?: boolean; visualSize?: 'main' | 'student'; cardScale?: number; slotKey: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (revealed && card) { const t = setTimeout(() => setVisible(true), animDelay ?? 0); return () => clearTimeout(t); }
    else setVisible(false);
  }, [revealed, card, animDelay]);
  const isMainSize = visualSize === 'main';
  const { w: slotW, h: slotH } = getCardDimensions({ boardCard: true, mini, visualSize, cardScale });
  const placeholderStyle: React.CSSProperties = { width: slotW, height: slotH, borderRadius: 9, flexShrink: 0, border: '1.5px dashed rgba(255,255,255,0.09)', background: 'rgba(0,0,0,0.38)' };
  if (!revealed) return <div style={placeholderStyle} data-slot={slotKey} />;
  if (!card) return (
    <div style={{ width: slotW, height: slotH, borderRadius: 9, flexShrink: 0, border: '1.5px solid rgba(255,200,80,0.35)', background: 'rgba(20,18,10,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-slot={slotKey}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,200,80,0.5)', letterSpacing: '0.1em' }}>?</span>
    </div>
  );
  return <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1) translateY(0px)' : 'scale(0.88) translateY(-10px)', transition: `opacity 0.22s ease, transform 0.24s ease`, transitionDelay: `${animDelay ?? 0}ms`, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))', width: slotW, height: slotH, flexShrink: 0 }} data-slot={slotKey}><PlayingCard card={card} boardCard mini={mini} visualSize={visualSize} cardScale={cardScale} /></div>;
});

// ── Action badge styles ──

const ACTION_STYLE: Record<ActionType, { bg: string; border: string; text: string }> = {
  fold: { bg: 'rgba(220,50,50,0.2)', border: 'rgba(220,50,50,0.5)', text: '#f87171' },
  check: { bg: 'rgba(90,90,110,0.25)', border: 'rgba(90,90,110,0.5)', text: '#9ca3af' },
  call: { bg: 'rgba(40,180,120,0.2)', border: 'rgba(40,180,120,0.5)', text: '#34d399' },
  bet: { bg: 'rgba(200,150,30,0.22)', border: 'rgba(200,150,30,0.5)', text: '#d4a827' },
  raise: { bg: 'rgba(220,100,20,0.2)', border: 'rgba(220,100,20,0.5)', text: '#fb923c' },
  allin: { bg: 'rgba(220,60,60,0.25)', border: 'rgba(220,60,60,0.6)', text: '#fca5a5' },
  post_sb: { bg: 'rgba(60,60,80,0.25)', border: 'rgba(60,60,80,0.45)', text: '#6b7280' },
  post_bb: { bg: 'rgba(60,60,80,0.25)', border: 'rgba(60,60,80,0.45)', text: '#6b7280' },
  post_ante: { bg: 'rgba(50,50,70,0.2)', border: 'rgba(50,50,70,0.4)', text: '#555568' },
  post_blinds: { bg: 'rgba(60,60,80,0.25)', border: 'rgba(60,60,80,0.45)', text: '#6b7280' },
  collect: { bg: 'rgba(201,162,39,0.2)', border: 'rgba(201,162,39,0.5)', text: '#c9a227' },
  show: { bg: 'rgba(70,130,200,0.2)', border: 'rgba(70,130,200,0.5)', text: '#60a5fa' },
  muck: { bg: 'rgba(50,50,70,0.2)', border: 'rgba(50,50,70,0.4)', text: '#555568' },
  win: { bg: 'rgba(201,162,39,0.2)', border: 'rgba(201,162,39,0.5)', text: '#c9a227' },
  uncalled_return: { bg: 'rgba(100,100,120,0.2)', border: 'rgba(100,100,120,0.4)', text: '#9ca3af' },
};

function actionLabel(type: ActionType, amount?: number): string {
  const fmt = (n?: number) => n != null ? ` ${n.toLocaleString()}` : '';
  switch (type) {
    case 'fold': return 'Folds';
    case 'check': return 'Checks';
    case 'call': return `Calls${fmt(amount)}`;
    case 'bet': return `Bets${fmt(amount)}`;
    case 'raise': return `Raises${fmt(amount)}`;
    case 'allin': return `All-In${fmt(amount)}`;
    case 'post_sb': return `SB${fmt(amount)}`;
    case 'post_bb': return `BB${fmt(amount)}`;
    case 'post_ante': return `Ante${fmt(amount)}`;
    case 'post_blinds': return 'Blinds Posted';
    case 'collect': return 'Wins pot';
    case 'show': return 'Shows';
    case 'muck': return 'Mucks';
    case 'win': return `Win${fmt(amount)}`;
    case 'uncalled_return': return `Uncalled ${fmt(amount)}`;
  }
}

// ── Seat positions ──

function getSeatPositions(n: number, variant: string, visualSize?: 'main' | 'student') {
  const count = Math.max(2, n);
  const useMainSize = visualSize === 'main';
  const rX = useMainSize ? 48 : 42;
  const rY = useMainSize ? 40 : 38;
  const start = Math.PI / 2;
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = start + (i * 2 * Math.PI) / count;
    positions.push({
      top: `${50 + rY * Math.sin(angle)}%`,
      left: `${50 + rX * Math.cos(angle)}%`,
      ux: Math.cos(angle), uy: Math.sin(angle),
    });
  }
  return positions;
}

const POS_COLOR: Record<string, string> = {
  BTN: '#d4af37', CO: '#4a90d9', HJ: '#9b7fda', LJ: '#3daa6a',
  UTG: '#e05050', 'UTG+1': '#d07030', 'UTG+2': '#c8922a',
  SB: '#8a93a2', BB: '#607080',
};

function displayName(name: string, isHero: boolean): string {
  if (/^[a-f0-9]{6,}$/i.test(name)) return isHero ? 'Player' : 'Opponent';
  return name;
}

function parseBigBlind(stakes: string): number {
  if (!stakes) return 0;
  const match = stakes.match(/\/\$?([\d,.]+)/);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  return 0;
}

function StackBadge({ stack, bigBlind, isHero, folded }: { stack: number; bigBlind: number; isHero: boolean; folded: boolean }) {
  const bbCount = bigBlind > 0 ? stack / bigBlind : 0;
  const showBB = bbCount > 0 && bbCount < 999;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      padding: '4px 9px 3px', borderRadius: 7,
      background: isHero
        ? 'linear-gradient(135deg, rgba(4,26,14,0.97), rgba(2,18,8,0.98))'
        : 'linear-gradient(135deg, rgba(12,10,20,0.97), rgba(7,6,15,0.98))',
      border: isHero ? '1px solid rgba(34,210,110,0.55)' : '1px solid rgba(185,155,58,0.45)',
      boxShadow: '0 3px 10px rgba(0,0,0,0.85)',
      opacity: folded ? 0.42 : 1,
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: isHero ? '#4ade80' : '#f0e8c0', lineHeight: 1.05, letterSpacing: '0.02em' }}>
        {stack > 0 ? stack.toLocaleString() : '0'}
      </span>
      {showBB && (
        <span style={{ fontSize: 8, fontWeight: 600, fontFamily: 'monospace', color: isHero ? 'rgba(74,222,128,0.65)' : 'rgba(240,232,192,0.55)', lineHeight: 1.1 }}>
          {bbCount.toFixed(1)} BB
        </span>
      )}
    </div>
  );
}

// ── PlayerSeat ──

const PlayerSeat = memo(function PlayerSeat({ player, pos, currentEvent, mini, variant, visualSize, showAllCards, streetBet, bigBlind, holeCardScale, cardScale }: {
  player: PlayerState; pos: { top: string; left: string; ux: number; uy: number };
  currentEvent: ReplayEvent | null; mini?: boolean; variant?: string; visualSize?: 'main' | 'student'; showAllCards?: boolean; streetBet: number; bigBlind: number; holeCardScale?: number; cardScale?: number;
}) {
  const isCurrent = currentEvent?.player === player.name && currentEvent.type === 'action';
  const posColor = POS_COLOR[player.position ?? ''] ?? '#8a93a2';
  const ast = currentEvent?.actionType ? ACTION_STYLE[currentEvent.actionType] : null;
  const showHoleCards = player.isHero || player.cardsRevealed || showAllCards;
  const hasCards = player.holeCards && player.holeCards.length >= 2;
  const cardOffset = (visualSize === 'main' ? 58 : 35) + (player.isHero ? (visualSize === 'main' ? 8 : 6) : 0);

  // streetBets is the authoritative source — it's kept in sync by the replay
  // engine including uncalled_return deductions. committedThisStreet is NOT
  // adjusted on uncalled returns, so Math.max would resurrect stale amounts.
  const betAmount = streetBet;

  // Wager positioning: bet chips should sit in the player's own area, not in
  // the central board region. For the bottom seat (Hero), the wager must appear
  // ABOVE the hole cards (further toward center) and slightly LEFT of card
  // center — never overlapping the cards. Other seats use the original offset.
  const isHeroBet = player.isHero;
  const heroBetVert = visualSize === 'main' ? cardOffset + 32 : cardOffset + 22;
  const heroBetSide = visualSize === 'main' ? -22 : -14;
  const betVert = isHeroBet ? heroBetVert : cardOffset + 42;
  const sideShift = isHeroBet ? heroBetSide : 0;
  const sideX = pos.uy * sideShift;
  const sideY = -pos.ux * sideShift;

  return (
    <div className="absolute" style={{ top: pos.top, left: pos.left, transform: 'translate(-50%,-50%)', opacity: player.folded ? 0.18 : 1, zIndex: isCurrent ? 20 : player.isWinner ? 18 : player.isHero ? 15 : 10, transition: 'opacity 0.4s ease-out' }}>
      {/* Bet chips — positioned close to the player's seat, not in the central board area */}
      {betAmount > 0 && !player.folded && (
        <div className="absolute" style={{ top: `${-pos.uy * betVert + sideY}px`, left: `${-pos.ux * betVert + sideX}px`, transform: 'translate(-50%,-50%)', zIndex: 40, pointerEvents: 'none', animation: 'chip-slide-in 0.2s ease both' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <ChipStack amount={betAmount} maxChips={7} size="large" />
            <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: '#fff4c7', background: 'rgba(0,0,0,0.92)', borderRadius: 6, padding: '3px 9px', border: '1px solid rgba(245,210,95,0.65)', whiteSpace: 'nowrap', boxShadow: '0 3px 9px rgba(0,0,0,0.75)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{betAmount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ALL IN badge — positioned below the nameplate so it never covers revealed hole cards */}
      {player.allIn && !player.folded && (
        <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) translateY(62px)', zIndex: 13, pointerEvents: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', padding: '4px 12px', borderRadius: 99, background: 'linear-gradient(135deg, rgba(220,40,40,0.95), rgba(180,20,20,0.98))', border: '1.5px solid rgba(255,120,120,0.7)', color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 0 16px rgba(220,40,40,0.6)' }}>ALL IN</span>
        </div>
      )}

      {/* Winner glow — centered behind the seat, low z-index so it doesn't obscure cards */}
      {player.isWinner && (
        <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 8, pointerEvents: 'none' }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, transparent 70%)', animation: 'winner-pulse 1.5s ease-in-out infinite' }} />
        </div>
      )}

      {/* MUCKED label — below the nameplate */}
      {player.mucked && !player.folded && (
        <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) translateY(62px)', zIndex: 16, pointerEvents: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 99, background: 'rgba(50,50,70,0.85)', border: '1px solid rgba(120,120,140,0.5)', color: '#9ca3af', whiteSpace: 'nowrap' }}>MUCKED</span>
        </div>
      )}

      {/* WINNER label — positioned below the nameplate / stack area, well clear of hole cards */}
      {player.isWinner && (
        <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) translateY(82px)', zIndex: 16, pointerEvents: 'none' }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', padding: '4px 12px', borderRadius: 99, background: 'linear-gradient(135deg, rgba(212,175,55,0.95), rgba(184,150,30,0.98))', border: '1.5px solid rgba(245,225,120,0.7)', color: '#1a1200', whiteSpace: 'nowrap', boxShadow: '0 0 14px rgba(212,175,55,0.5)' }}>WINNER · {player.winAmount.toLocaleString()}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {/* Hole cards */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(${-pos.ux * cardOffset}px, ${-pos.uy * cardOffset}px)`, zIndex: 1, filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.5))' }}>
          {showHoleCards && hasCards ? player.holeCards!.map((c, i) => (
            <HoleCard key={`${c}-${i}`} card={c} large hero={player.isHero} mini={mini} variant={variant} visualSize={visualSize} dealDelay={i * 80} holeCardScale={holeCardScale} cardScale={cardScale} />
          )) : (
            <>
              <PlayingCard hidden large mini={mini} variant={variant} visualSize={visualSize} holeCardScale={holeCardScale} cardScale={cardScale} />
              <PlayingCard hidden large mini={mini} variant={variant} visualSize={visualSize} holeCardScale={holeCardScale} cardScale={cardScale} />
            </>
          )}
        </div>

        {/* Nameplate — contains position badge + player name in one unified block */}
        <div style={{
          minWidth: mini ? 92 : 96, padding: '3px 10px 7px', borderRadius: 14, textAlign: 'center', position: 'relative',
          background: isCurrent ? 'linear-gradient(160deg, rgba(20,24,36,0.98), rgba(14,16,26,0.99))' : player.isHero ? 'linear-gradient(160deg, rgba(4,26,14,0.98), rgba(2,18,8,0.99))' : player.isWinner ? 'linear-gradient(160deg, rgba(30,24,6,0.98), rgba(20,16,3,0.99))' : 'linear-gradient(160deg, rgba(12,10,20,0.97), rgba(7,6,15,0.99))',
          border: isCurrent ? '1.5px solid rgba(200,215,255,0.85)' : player.isHero ? '1.5px solid rgba(34,210,110,0.65)' : player.isWinner ? '1.5px solid rgba(212,175,55,0.8)' : '1.5px solid rgba(52,56,72,0.80)',
          boxShadow: isCurrent ? '0 0 24px rgba(180,205,255,0.28), 0 6px 24px rgba(0,0,0,0.88)' : player.isWinner ? '0 0 20px rgba(212,175,55,0.25), 0 5px 22px rgba(0,0,0,0.84)' : '0 4px 18px rgba(0,0,0,0.78)',
        }}>
          {player.position && (
            <div style={{ fontSize: 10, fontWeight: 800, color: posColor, marginBottom: 1, letterSpacing: '0.04em' }}>{player.position}</div>
          )}
          <div style={{ fontSize: 11, fontWeight: 600, color: isCurrent ? '#d4e2ff' : player.isHero ? '#86efac' : player.isWinner ? '#e8c85a' : '#8a96a4', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName(player.name, player.isHero)}
          </div>
        </div>

        {/* Stack badge — directly below nameplate in the column flow, centered */}
        <StackBadge stack={player.currentStack} bigBlind={bigBlind} isHero={player.isHero} folded={player.folded} />

        {/* Action badge — persistent, no fade-out */}
        {ast && currentEvent?.actionType && isCurrent && (
          <div style={{
            fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 99,
            background: ast.bg, border: `1px solid ${ast.border}`, color: ast.text,
            whiteSpace: 'nowrap', opacity: 1,
            pointerEvents: 'none', zIndex: 14,
          }}>{actionLabel(currentEvent.actionType, currentEvent.amount)}</div>
        )}
      </div>
    </div>
  );
});

// ── PokerTable ──

export interface PokerTableProps {
  hand: NormalizedHand;
  replayState: ReplayState | null;
  showAllCards?: boolean;
  variant?: 'full' | 'embedded' | 'default';
  mini?: boolean;
  visualSize?: 'main' | 'student';
  holeCardScale?: number;
  cardScale?: number;
}

export const PokerTable = memo(function PokerTable({ hand, replayState, showAllCards = false, variant = 'full', mini = false, visualSize, holeCardScale, cardScale }: PokerTableProps) {
  const preHand = !replayState || replayState.currentEvent === null;
  const currentStreet = replayState?.street ?? 'preflop';
  const isShowdown = replayState?.isShowdown ?? false;
  const isComplete = replayState?.isComplete ?? false;
  const board = replayState?.board ?? [];
  const centralPot = replayState?.centralPot ?? 0;
  const streetBets = replayState?.currentStreetBets ?? {};
  const currentEvent = replayState?.currentEvent ?? null;

  const streetsDealt = replayState?.streetsDealt ?? 0;
  const flopRevealed = streetsDealt >= 1;
  const turnRevealed = streetsDealt >= 2;
  const riverRevealed = streetsDealt >= 3;

  const flopCards = replayState?.board.slice(0, 3) ?? hand.board.flop;
  const turnCard = replayState && replayState.board.length >= 4 ? replayState.board[3] : hand.board.turn;
  const riverCard = replayState && replayState.board.length >= 5 ? replayState.board[4] : hand.board.river;

  const bigBlind = useMemo(() => parseBigBlind(hand.stakes), [hand.stakes]);
  const heroIndex = hand.players.findIndex(p => p.isHero);
  const base = heroIndex >= 0 ? heroIndex : 0;
  const n = hand.players.length;
  const ordered = n > 0 ? [...hand.players.slice(base), ...hand.players.slice(0, base)] : hand.players;
  const seatPositions = useMemo(() => getSeatPositions(n, variant, visualSize), [n, variant, visualSize]);

  const seatEntries = ordered.map((player, i) => {
    const replayPlayer = replayState?.players.find(p => p.name === player.name) ?? null;
    return { player, replayPlayer, pos: seatPositions[Math.min(i, seatPositions.length - 1)], seatIndex: i };
  });

  const STREET_LABEL: Record<string, string> = { preflop: 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN' };
  const STREET_CLR: Record<string, string> = { preflop: '#8a93a2', flop: '#34d399', turn: '#f59e0b', river: '#fb923c', showdown: '#d4af37' };
  const streetDisplay = isComplete ? 'RESULT' : STREET_LABEL[currentStreet] ?? currentStreet.toUpperCase();
  const streetColor = isComplete ? '#d4af37' : STREET_CLR[currentStreet] ?? '#8a93a2';

  void preHand;
  void board;

  return (
    <div style={{ width: '100%', perspective: '1200px', perspectiveOrigin: '50% 18%' }}>
      <div className="relative w-full select-none" style={{ paddingBottom: '62%', transform: 'rotateX(var(--table-tilt, 22deg))', transformStyle: 'preserve-3d', transformOrigin: 'center bottom' }}>
        {/* Floor shadow */}
        <div style={{ position: 'absolute', inset: '2% 2% -28% 2%', borderRadius: '50%', boxShadow: '0 0 60px 30px rgba(0,0,0,0.98), 0 0 120px 55px rgba(0,0,0,0.92)', pointerEvents: 'none' }} />

        {/* Table edge */}
        <div className="absolute rounded-[46%]" style={{ inset: -10, background: 'linear-gradient(176deg, rgba(40,28,12,0.98), rgba(18,11,4,0.99) 45%, rgba(8,5,1,1) 80%, rgba(12,7,2,0.99))', transform: 'translateY(16px)', boxShadow: '0 32px 90px rgba(0,0,0,1), inset 0 5px 0 rgba(215,175,75,0.28)', pointerEvents: 'none' }} />

        {/* Gold inlay */}
        <div className="absolute rounded-[46%]" style={{ inset: -4, border: '1.5px solid rgba(205,168,58,0.45)', pointerEvents: 'none', transform: 'translateY(16px)' }} />

        {/* Brass underglow */}
        <div className="absolute inset-0 rounded-[46%]" style={{ boxShadow: '0 0 2px 2px rgba(235,198,75,0.60), 0 0 8px 4px rgba(220,182,62,0.35), 0 0 18px 8px rgba(205,166,50,0.18)', pointerEvents: 'none' }} />

        {/* Outer rail */}
        <div className="absolute inset-0 rounded-[46%]" style={{
          background: `radial-gradient(ellipse 100% 45% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 65%), linear-gradient(172deg, #201c14 0%, #100e0a 28%, #060504 58%, #161210 82%, #26221a 100%)`,
          border: '5px solid rgba(205,172,68,0.72)',
          boxShadow: '0 24px 85px rgba(0,0,0,0.99), inset 0 8px 0 rgba(255,255,255,0.10), inset 0 -7px 0 rgba(0,0,0,0.92), inset 0 0 80px rgba(0,0,0,0.62)',
        }} />

        {/* Inner gold trim */}
        <div className="absolute rounded-[46%]" style={{ inset: 9, border: '1.5px solid rgba(215,182,65,0.55)', pointerEvents: 'none', boxShadow: 'inset 0 1px 0 rgba(245,215,98,0.40), 0 0 8px rgba(215,182,65,0.12)' }} />

        {/* Felt */}
        <div className="absolute rounded-[46%] overflow-hidden" style={{ inset: 26 }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 145% 120% at 50% 22%, #2d7a52 0%, #1f5e3e 12%, #164a30 25%, #0e3822 40%, #092a18 58%, #061e11 76%, #04140b 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix values=%220 0 0 0 0 0 0 0 0 0.5 0 0 0 0 0.3 0 0 0 0.04 0%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")', opacity: 0.5, pointerEvents: 'none', mixBlendMode: 'overlay' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 48% 40% at 50% 38%, rgba(120,240,165,0.22) 0%, transparent 75%)', pointerEvents: 'none' }} />
          <div className="absolute rounded-[46%]" style={{ inset: '12% 8%', border: '1.5px solid rgba(255,255,255,0.15)', pointerEvents: 'none' }} />
          <div className="absolute inset-0 rounded-[46%]" style={{ background: 'radial-gradient(ellipse 108% 98% at 50% 50%, transparent 32%, rgba(0,0,0,0.68) 75%, rgba(0,0,0,0.88) 100%)', pointerEvents: 'none' }} />
        </div>

        {/* Center HUD — Central pot + board cards */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0 pointer-events-none" style={{ transform: 'translateY(-6%)' }}>
          {/* Central pot — above the board cards */}
          {centralPot > 0 && (
            <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ padding: '5px 18px 5px 14px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, rgba(18,14,4,0.97), rgba(12,9,2,0.98))', border: '1.5px solid rgba(185,155,58,0.55)', boxShadow: '0 4px 16px rgba(0,0,0,0.90), 0 0 12px rgba(185,155,58,0.12)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle, #e8c85a, #b8962e)', boxShadow: '0 0 5px rgba(215,185,70,0.60)' }} />
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.07em', color: '#d4b84a' }}>POT&nbsp;&nbsp;{centralPot.toLocaleString()}</span>
              </div>
              <PotChipPile amount={centralPot} size="small" />
            </div>
          )}

          {/* Street label */}
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.36em', textTransform: 'uppercase', color: streetColor, marginBottom: 6 }}>
            {streetDisplay}
          </div>

          {/* Community cards — 5 fixed slots that persist for the entire replay */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(() => {
              const isMainSize = visualSize === 'main';
              const cs = cardScale ?? 1;
              const emptyW = Math.round((isMainSize ? 75 : 67) * cs), emptyH = Math.round((isMainSize ? 106 : 95) * cs);
              const dividerStyle: React.CSSProperties = { width: 1, height: 40, background: 'rgba(255,255,255,0.08)', margin: '0 2px' };
              const placeholderStyle: React.CSSProperties = { width: emptyW, height: emptyH, borderRadius: 5, border: '1px dashed rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.18)', flexShrink: 0 };
              // When hand is complete with no board dealt, show nothing
              if (streetsDealt === 0 && isComplete) return null;
              // All 5 slots always rendered as BoardCard — revealed flag controls visibility
              // This prevents remounting when streetsDealt transitions from 0 to 1+
              return (
                <>
                  <BoardCard key="flop-0" slotKey="flop-0" card={flopCards[0]} revealed={flopRevealed || showAllCards} animDelay={0} mini={mini} visualSize={visualSize} cardScale={cardScale} />
                  <BoardCard key="flop-1" slotKey="flop-1" card={flopCards[1]} revealed={flopRevealed || showAllCards} animDelay={100} mini={mini} visualSize={visualSize} cardScale={cardScale} />
                  <BoardCard key="flop-2" slotKey="flop-2" card={flopCards[2]} revealed={flopRevealed || showAllCards} animDelay={200} mini={mini} visualSize={visualSize} cardScale={cardScale} />
                  <div key="div-turn" style={dividerStyle} />
                  <BoardCard key="turn" slotKey="turn" card={turnCard ?? undefined} revealed={turnRevealed || (showAllCards && !isComplete)} animDelay={300} mini={mini} visualSize={visualSize} cardScale={cardScale} />
                  <div key="div-river" style={dividerStyle} />
                  <BoardCard key="river" slotKey="river" card={riverCard ?? undefined} revealed={riverRevealed || (showAllCards && !isComplete)} animDelay={400} mini={mini} visualSize={visualSize} cardScale={cardScale} />
                </>
              );
            })()}
          </div>
        </div>

        {/* Showdown message */}
        {isShowdown && replayState.winners.length > 0 && (() => {
          const w = replayState.winners[0];
          const winner = hand.players.find(p => p.name === w.player);
          const pos = winner?.position ?? '';
          const isSplit = replayState.winners.length > 1;
          const msg = isSplit ? `Split pot · ${w.amount.toLocaleString()}` : `${pos || displayName(w.player, false)} wins ${w.amount.toLocaleString()}`;
          return (
            <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ zIndex: 30, paddingBottom: '3%' }}>
              <div style={{ padding: '8px 24px', borderRadius: 99, background: 'linear-gradient(135deg, rgba(20,16,4,0.97), rgba(12,10,2,0.98))', border: '1.5px solid rgba(212,175,55,0.80)', boxShadow: '0 0 24px rgba(212,175,55,0.35), 0 6px 28px rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', gap: 10, animation: 'showdown-fade 2s ease-out both' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle, #f0dc80, #c9a227)', boxShadow: '0 0 8px rgba(212,175,55,0.80)' }} />
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#e8c85a', whiteSpace: 'nowrap' }}>{msg}</span>
              </div>
            </div>
          );
        })()}

        {/* Seats */}
        {seatEntries.map((entry) => (
          entry.replayPlayer ? (
            <PlayerSeat
              key={`seat-${entry.seatIndex}`}
              player={entry.replayPlayer}
              pos={entry.pos}
              currentEvent={currentEvent}
              mini={mini}
              variant={variant}
              visualSize={visualSize}
              showAllCards={showAllCards}
              streetBet={streetBets[entry.player.name] ?? 0}
              bigBlind={bigBlind}
              holeCardScale={holeCardScale}
              cardScale={cardScale}
            />
          ) : null
        ))}

        {/* Dealer button — positioned beside the BTN player's nameplate, tangentially to the side and slightly outward toward the cards. Never in the central betting area. */}
        {hand.buttonSeat > 0 && (() => {
          const idx = seatEntries.findIndex(e => e.player.seat === hand.buttonSeat);
          if (idx < 0) return null;
          const pos = seatEntries[Math.min(idx, seatEntries.length - 1)].pos;
          const btnSize = visualSize === 'main' ? 30 : 24;
          const tangX = -pos.uy, tangY = pos.ux;
          const tangDist = visualSize === 'main' ? 36 : 30;
          const outwardDist = visualSize === 'main' ? 14 : 10;
          const offX = tangX * tangDist + pos.ux * outwardDist;
          const offY = tangY * tangDist + pos.uy * outwardDist;
          return (
            <div className="absolute" style={{
              top: pos.top, left: pos.left,
              transform: `translate(calc(-50% + ${offX}px), calc(-50% + ${offY}px))`,
              width: btnSize, height: btnSize, borderRadius: '50%',
              background: 'radial-gradient(circle at 36% 28%, #f5e17a, #c9a227 38%, #a07e18 72%, #7a5e10)',
              border: '2px solid rgba(245,225,120,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.88), inset 0 1.5px 0 rgba(255,240,140,0.6), inset 0 -1px 0 rgba(80,50,0,0.5), 0 0 8px rgba(201,162,39,0.20)',
              zIndex: 25,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: '#1a1200' }}>D</span>
            </div>
          );
        })()}

      </div>

      <style>{`
        @keyframes deal-in { 0% { opacity: 0; transform: scale(0.45) translateY(-24px) rotate(-10deg); } 65% { opacity: 1; transform: scale(1.05) translateY(2px) rotate(1.5deg); } 100% { opacity: 1; transform: scale(1) translateY(0) rotate(0deg); } }
        @keyframes showdown-fade { 0% { opacity: 0; transform: translateY(16px) scale(0.92); } 15% { opacity: 1; transform: translateY(0) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px) scale(0.95); } }
        @keyframes winner-pulse { 0%, 100% { opacity: 0.4; transform: 'translate(-50%,-50%) scale(1)'; } 50% { opacity: 0.8; transform: 'translate(-50%,-50%) scale(1.15)'; } }
        @keyframes chip-slide-in { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.5); } 100% { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
      `}</style>
    </div>
  );
});

// Re-export chip components for external use
export { PokerChip, ChipStack, PotChipPile, CHIP_DENOMS, getDenomsForAmount, type ChipDenom };
