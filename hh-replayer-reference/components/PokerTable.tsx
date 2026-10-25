import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ParsedHand, HandPlayer, HandAction, Street } from '../lib/handParser';
import { computePotAtAction, computeStackAtAction, computeCollectedPot, computePlayerStreetBet } from '../lib/handParser';
import { MiniPlayingCard, MiniCardBack } from './MiniPlayingCard';
import { getEffectConfig, REPLAYER_LAYERS } from '../lib/replayerConfig';
import { checkReplayerInvariants } from '../lib/replayerInvariants';
import { useReplayerDebug, DebugBadge, type DebugSeatInfo } from '../lib/replayerDebug';

// ─── PlayingCard ──────────────────────────────────────────────────────────────

import { PremiumCardFace } from './PremiumCardFace';

export function PlayingCard({ card, hidden = false, small = false, large = false, hero = false, mini = false, boardCard = false, mobile = false, variant = 'default' }: {
  card?: string; hidden?: boolean; small?: boolean; large?: boolean; hero?: boolean; mini?: boolean; boardCard?: boolean; mobile?: boolean; variant?: 'full' | 'embedded' | 'default';
}) {
  // Board cards remain the focal point at their original dimensions.
  // `full` (main HH Replayer): hole cards ~50% smaller so the table dominates.
  // `embedded` (Recent Hands preview): all cards substantially smaller.
  // `mobile`: slightly smaller hole cards + slightly larger board cards so the
  // table fills more of a phone screen while every seat stays in frame.
  const isFull = variant === 'full';
  const isEmbedded = variant === 'embedded';
  const w = small ? (isEmbedded ? 26 : 48)
    : boardCard ? (mini ? 64 : isEmbedded ? 38 : 75)
    : large ? (mini ? 48 : isEmbedded ? 42 : 67)
    : (mini ? 46 : isFull ? 39 : isEmbedded ? 38 : 77);
  const h = small ? (isEmbedded ? 37 : 68)
    : boardCard ? (mini ? 91 : isEmbedded ? 54 : 106)
    : large ? (mini ? 67 : isEmbedded ? 59 : 94)
    : (mini ? 65 : isFull ? 54 : isEmbedded ? 53 : 108);

  if (hidden || !card) {
    return (
      <div style={{
        width: w, height: h, borderRadius: 8, flexShrink: 0,
        overflow: 'hidden',
        boxShadow: '0 8px 28px rgba(0,0,0,0.95), 0 3px 10px rgba(0,0,0,0.80)',
        position: 'relative',
      }}>
        <img
          src="/assets/images/image copy copy.png"
          alt="card back"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center center',
            borderRadius: 7,
          }}
        />
      </div>
    );
  }

  // Front face — premium SVG rendering shared with the mini replayer cards so
  // board cards and hero cards match exactly (resolution, shadow, typography).
  return <PremiumCardFace card={card} width={w} height={h} hero={hero} />;
}

// ─── BoardCard ────────────────────────────────────────────────────────────────

function BoardCard({ card, revealed, animDelay = 0, mini = false, mobile = false }: { card?: string; revealed: boolean; animDelay?: number; mini?: boolean; mobile?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (revealed && card) {
      const t = setTimeout(() => setVisible(true), animDelay);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [revealed, card, animDelay]);

  // Board card slots match the board card dimensions.
  const slotW = mini ? 64 : 75;
  const slotH = mini ? 91 : 106;

  if (!revealed || !card) {
    return (
      <div style={{
        width: slotW, height: slotH, borderRadius: 9, flexShrink: 0,
        border: '1.5px dashed rgba(255,255,255,0.09)',
        background: 'rgba(0,0,0,0.38)',
        boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.48)',
      }} />
    );
  }

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: mobile ? 'none' : (visible ? 'scale(1) rotateY(0deg)' : 'scale(0.85) rotateY(90deg)'),
      transition: mobile
        ? `opacity 0.22s ease ${animDelay}ms`
        : `opacity 0.28s ease ${animDelay}ms, transform 0.32s ease ${animDelay}ms`,
    }}>
      {mini ? <MiniPlayingCard card={card} mobile={mobile} /> : <PlayingCard card={card} boardCard mini={mini} mobile={mobile} />}
    </div>
  );
}

// ─── Action badge styles ──────────────────────────────────────────────────────

type ActionType = HandAction['type'];

const ACTION_STYLE: Record<ActionType, { bg: string; border: string; text: string; glow?: string }> = {
  fold:       { bg: 'rgba(220,50,50,0.2)',    border: 'rgba(220,50,50,0.5)',   text: '#f87171', glow: 'rgba(220,50,50,0.35)' },
  check:      { bg: 'rgba(90,90,110,0.25)',   border: 'rgba(90,90,110,0.5)',  text: '#9ca3af' },
  call:       { bg: 'rgba(40,180,120,0.2)',   border: 'rgba(40,180,120,0.5)', text: '#34d399', glow: 'rgba(40,180,120,0.3)' },
  bet:        { bg: 'rgba(200,150,30,0.22)',  border: 'rgba(200,150,30,0.5)', text: '#d4a827', glow: 'rgba(200,150,30,0.35)' },
  raise:      { bg: 'rgba(220,100,20,0.2)',   border: 'rgba(220,100,20,0.5)', text: '#fb923c', glow: 'rgba(220,100,20,0.35)' },
  allin:      { bg: 'rgba(220,60,60,0.25)',   border: 'rgba(220,60,60,0.6)',  text: '#fca5a5', glow: 'rgba(220,60,60,0.45)' },
  post_sb:    { bg: 'rgba(60,60,80,0.25)',    border: 'rgba(60,60,80,0.45)',  text: '#6b7280' },
  post_bb:    { bg: 'rgba(60,60,80,0.25)',    border: 'rgba(60,60,80,0.45)',  text: '#6b7280' },
  post_ante:  { bg: 'rgba(50,50,70,0.2)',     border: 'rgba(50,50,70,0.4)',   text: '#555568' },
  collect:    { bg: 'rgba(201,162,39,0.2)',   border: 'rgba(201,162,39,0.5)', text: '#c9a227', glow: 'rgba(201,162,39,0.35)' },
  show:       { bg: 'rgba(70,130,200,0.2)',   border: 'rgba(70,130,200,0.5)', text: '#60a5fa' },
  muck:       { bg: 'rgba(50,50,70,0.2)',     border: 'rgba(50,50,70,0.4)',   text: '#555568' },
  win:        { bg: 'rgba(201,162,39,0.2)',   border: 'rgba(201,162,39,0.5)', text: '#c9a227', glow: 'rgba(201,162,39,0.35)' },
};

export function actionLabel(a: HandAction, opts?: { bigBlind?: number; mode?: 'chips' | 'bb' }): string {
  const mode = opts?.mode ?? 'chips';
  const bb = opts?.bigBlind;
  const fmt = (n?: number) => n != null ? ` ${formatAmountDisplay(n, bb, mode)}` : '';
  switch (a.type) {
    case 'fold':      return 'Folds';
    case 'check':     return 'Checks';
    case 'call':      return `Calls${fmt(a.amount)}`;
    case 'bet':       return `Bets${fmt(a.amount)}`;
    case 'raise':     return `Raises${fmt(a.amount)}`;
    case 'allin':     return `All-In${fmt(a.amount)}`;
    case 'post_sb':   return `SB${fmt(a.amount)}`;
    case 'post_bb':   return `BB${fmt(a.amount)}`;
    case 'post_ante': return `Ante${fmt(a.amount)}`;
    case 'collect':   return 'Wins pot';
    case 'show':      return 'Shows';
    case 'muck':      return 'Mucks';
    case 'win':       return `Win${fmt(a.amount)}`;
  }
}

// ─── Seat positions ───────────────────────────────────────────────────────────
// One invisible circular orbit around the table. Every seat is placed with
// equal angular spacing so the layout is perfectly symmetrical — no manual
// per-seat tweaks. Hero is anchored at the bottom (angle = 90° in CSS coords
// where y grows downward) and seats proceed counter-clockwise.
//
// Each seat carries a radial outward unit vector (ux, uy). All child elements
// (cards, chips, labels) are positioned relative to this vector so every seat
// uses the exact same logic, simply rotated around the table:
//   - Cards: offset radially OUTWARD (toward the rail, on the felt)
//   - Chips: offset radially INWARD  (toward the pot)
function getSeatPositions(n: number, mini: boolean, variant: 'full' | 'embedded' | 'default' = 'default', mobile = false) {
  const count = Math.max(2, n);
  // On mobile, pull the seat orbit slightly inward so hole cards at the
  // extreme left/right seats stay fully inside the viewport after the table
  // is scaled up. Desktop keeps the original radii.
  let rX = variant === 'full' ? 48 : variant === 'embedded' ? 40 : 42;
  let rY = variant === 'full' ? 40 : variant === 'embedded' ? 32 : 38;
  if (mobile && variant === 'full') { rX = 45; rY = 38; }
  const scale = mini ? 1.14 : 1;
  const start = Math.PI / 2;
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = start + (i * 2 * Math.PI) / count;
    const dx = rX * scale * Math.cos(angle);
    const dy = rY * scale * Math.sin(angle);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    positions.push({
      top: `${50 + dy}%`,
      left: `${50 + dx}%`,
      tx: '-50%',
      ty: '-50%',
      ux, uy,
    });
  }
  return positions;
}

// Exported for tests so they can verify geometry without rendering.
export const __testGetSeatPositions = getSeatPositions;
export const __testGetRingRadii = (variant: 'full' | 'embedded' | 'default', mobile: boolean) => {
  let rX = variant === 'full' ? 48 : variant === 'embedded' ? 40 : 42;
  let rY = variant === 'full' ? 40 : variant === 'embedded' ? 32 : 38;
  if (mobile && variant === 'full') { rX = 45; rY = 38; }
  return { rX, rY };
};

// ─── Empty-state seat labels ───────────────────────────────────────────────────
// 8-max position labels shown around the table when no real hand is loaded.
// These are purely visual — they orient the viewer to the seat layout without
// fabricating player names, stacks, or action data.
const EMPTY_SEAT_LABELS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'];

// ─── Demo hand ────────────────────────────────────────────────────────────────

// Empty hand used when no hand is loaded. All seats are blank — no names,
// positions, stacks, or cards. The replayer shows this until a real hand is
// imported, so the page never displays fabricated placeholder metadata.
export const EMPTY_HAND: ParsedHand = {
  site: 'unknown', handId: '', gameType: "Hold'em", stakes: '',
  date: '', tableName: '', buttonSeat: 0,
  players: [
    { seat: 1, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 2, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 3, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 4, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 5, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 6, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 7, name: '', stack: 0, position: undefined, isHero: false },
    { seat: 8, name: '', stack: 0, position: undefined, isHero: false },
  ],
  heroName: '',
  board: { flop: [], turn: null, river: null },
  actions: [], pot: 0, rake: 0, winners: [],
  rawText: '', parseErrors: [],
};

// ─── Chip system ──────────────────────────────────────────────────────────────

// PokerStars-inspired flat clay chips. Each chip is a thin disc viewed from a
// shallow angle — wide, flat, compressed. Stacks overlap so heavily that height
// grows very slowly; large stacks become dense bands, not skyscrapers.
const CHIP_DENOM = [
  { min: 100000, color: '#1e3a8a', edge: '#93c5fd', label: '#fff',    text: '100K' }, // blue
  { min: 25000,  color: '#be185d', edge: '#f9a8d4', label: '#fff',    text: '25K'  }, // pink
  { min: 10000,  color: '#c2410c', edge: '#fdba74', label: '#fff',    text: '10K'  }, // orange
  { min: 5000,   color: '#a16207', edge: '#fde047', label: '#1a1a1a', text: '5K'   }, // yellow
  { min: 1000,   color: '#6b21a8', edge: '#c084fc', label: '#fff',    text: '1K'   }, // purple
  { min: 500,    color: '#1f2937', edge: '#6b7280', label: '#fff',    text: '500'  }, // black
  { min: 100,    color: '#166534', edge: '#86efac', label: '#fff',    text: '100'  }, // green
  { min: 25,     color: '#b91c1c', edge: '#fca5a5', label: '#fff',    text: '25'   }, // red
  { min: 5,      color: '#b91c1c', edge: '#fca5a5', label: '#fff',    text: '5'    }, // red
  { min: 0,      color: '#e5e7eb', edge: '#ffffff', label: '#1f2937', text: '1'   }, // white
];

function chipForAmount(amount: number) {
  return CHIP_DENOM.find(c => amount >= c.min) ?? CHIP_DENOM[CHIP_DENOM.length - 1];
}

// A single flat chip. Height is ~30% of width — a thin clay disc seen at a
// shallow angle, not a cylinder. The top face carries the denomination; a thin
// edge band below gives just enough thickness to read as a real chip.
function CasinoChip({ amount, size = 34 }: { amount: number; size?: number }) {
  const chip = chipForAmount(amount);
  const stripes = 8;
  // Flat aspect: height ~30% of width. Thin disc, shallow viewing angle.
  const h = size * 0.30;
  const edgeH = Math.max(2, size * 0.06); // thin edge band
  return (
    <div style={{
      position: 'relative', width: size, height: h + edgeH,
      flexShrink: 0, userSelect: 'none',
    }}>
      {/* Edge band — thin slice of the chip's side, gives depth without height */}
      <div style={{
        position: 'absolute', left: 0, bottom: 0, width: size, height: h + edgeH,
        borderRadius: '50% / 50%',
        background: `linear-gradient(to bottom, ${chip.color} 0%, ${chip.color} 55%, ${chip.edge} 100%)`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }} />
      {/* Top face — the flat clay surface with denomination */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: size, height: h,
        borderRadius: '50%',
        background: `radial-gradient(ellipse at 42% 28%, ${chip.edge}cc 0%, ${chip.color} 72%)`,
        border: `1px solid ${chip.edge}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* edge stripes around the rim */}
        {Array.from({ length: stripes }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', width: size * 0.10, height: h * 0.28, borderRadius: 1.5,
            background: chip.edge, opacity: 0.5,
            top: '50%', left: '50%',
            transformOrigin: '50% 0%',
            transform: `translate(-50%, -${h / 2}px) rotate(${(360 / stripes) * i}deg)`,
          }} />
        ))}
        <span style={{
          position: 'relative', zIndex: 1,
          fontSize: size * 0.22, fontWeight: 900, fontFamily: 'monospace',
          color: chip.label, lineHeight: 1, letterSpacing: '-0.04em',
          textShadow: '0 1px 1px rgba(0,0,0,0.3)',
        }}>{chip.text}</span>
      </div>
    </div>
  );
}

// Compressed stacks: chips overlap so heavily that each adds only ~18% of its
// height. Stack height grows very slowly — a 100k stack is barely taller than a
// 1k stack. The amount label sits cleanly beneath, never on top of the chips.
function ChipStack({ amount, small = false, bigBlind, mode = 'chips' }: { amount: number; small?: boolean; bigBlind?: number; mode?: 'chips' | 'bb' }) {
  if (amount <= 0) return null;
  const chipSize = small ? 20 : 24;
  const chipH = chipSize * 0.30;
  const edgeH = Math.max(2, chipSize * 0.06);
  const chipTotal = chipH + edgeH;
  // Logarithmic count, capped at 5 — bigger amounts stay dense, not tall.
  const stackCount = Math.min(5, Math.max(1, Math.ceil(Math.log2(amount / 10 + 1))));
  // Extreme overlap: each chip shows only ~18% of its total height.
  const step = chipTotal * 0.18;
  const stackHeight = chipTotal + (stackCount - 1) * step;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ position: 'relative', width: chipSize, height: stackHeight }}>
        {Array.from({ length: stackCount }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', bottom: i * step, left: 0 }}>
            <CasinoChip amount={amount} size={chipSize} />
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 4, fontSize: small ? 10 : 12, fontWeight: 800, fontFamily: 'monospace',
        color: '#f0e8c0', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
        background: 'rgba(0,0,0,0.78)', borderRadius: 5, padding: '2px 7px',
        border: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'nowrap', letterSpacing: '0.02em',
      }}>{formatAmountDisplay(amount, bigBlind, mode)}</div>
    </div>
  );
}

// ─── Chip offset per seat ─────────────────────────────────────────────────────

function cardOffsetForSeat(variant: 'full' | 'embedded' | 'default', mobile = false): number {
  if (variant === 'full') return mobile ? 64 : 72;
  if (variant === 'embedded') return 48;
  return 44;
}

function chipOffsetForPos(pos: { ux?: number; uy?: number }, variant: 'full' | 'embedded' | 'default' = 'default', mobile = false): { top: string; left: string } {
  const ux = pos.ux ?? 0;
  const uy = pos.uy ?? 0;
  const cardOffset = cardOffsetForSeat(variant, mobile);
  const gap = variant === 'full' ? 33 : variant === 'embedded' ? 35 : 53;
  const chipIn = cardOffset + gap;
  return { top: `${-uy * chipIn}px`, left: `${-ux * chipIn}px` };
}

function chipAnimDelta(pos: { ux?: number; uy?: number }): { enter: string; collect: string } {
  const ux = pos.ux ?? 0;
  const uy = pos.uy ?? 0;
  return {
    enter: `translate(${ux * 50}px, ${uy * 50}px)`,
    collect: `translate(${-ux * 70}px, ${-uy * 70}px)`,
  };
}

// ─── Position badge colors ────────────────────────────────────────────────────

const POS_COLOR: Record<string, string> = {
  BTN: '#d4af37', CO: '#4a90d9', HJ: '#9b7fda', LJ: '#3daa6a',
  UTG: '#e05050', 'UTG+1': '#d07030', 'UTG+2': '#c8922a',
  SB: '#8a93a2', BB: '#607080',
};

// ─── Stack helpers ────────────────────────────────────────────────────────────

// Stack display formatter. Chips mode always shows raw chip totals with
// thousands separators. BB mode divides by bigBlind and appends "BB".
// When bigBlind is unavailable, BB mode is disabled (returns empty) so the
// caller can hide the stack rather than mislabel chips as big blinds.
function formatStackDisplay(stackChips: number, bigBlind: number | undefined, mode: 'chips' | 'bb'): string {
  if (mode === 'bb') {
    if (!bigBlind || bigBlind <= 0) return ''; // BB mode unavailable for this hand
    const bbs = stackChips / bigBlind;
    // Whole number when exact, one decimal otherwise, max two for very small.
    let display: string;
    if (Number.isInteger(bbs)) display = bbs.toString();
    else if (Math.abs(bbs) >= 10) display = bbs.toFixed(1).replace(/\.0$/, '');
    else display = bbs.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
    return `${display} BB`;
  }
  // Chips mode: always show raw total, even when bigBlind is unknown.
  return stackChips.toLocaleString();
}

// Format a monetary amount (bet, pot, side pot) in the selected unit.
function formatAmountDisplay(amountChips: number, bigBlind: number | undefined, mode: 'chips' | 'bb'): string {
  return formatStackDisplay(amountChips, bigBlind, mode);
}

function displayName(name: string, isHero: boolean, mobile = false): string {
  if (/^[a-f0-9]{6,}$/i.test(name)) return isHero ? 'Player' : 'Opponent';
  return name;
}

// ─── PlayerSeat ───────────────────────────────────────────────────────────────

function PlayerSeat({ player, actions, upToIndex, currentAction, showCards, pos, isDemo, onContextMenu,
  currentStreet, streetClosed, bigBlind, stackMode, onStackClick, isShowdown, isWinnerSeat, mini = false, mobile = false, variant = 'default', seatIndex = 0, handId = '' }: {
  player: HandPlayer;
  actions: HandAction[];
  upToIndex: number;
  currentAction: HandAction | null;
  showCards: boolean;
  pos: { top: string; left: string; tx: string; ty: string; ux: number; uy: number };
  isDemo: boolean;
  onContextMenu?: (x: number, y: number) => void;
  currentStreet: Street;
  streetClosed: boolean;
  bigBlind?: number;
  stackMode: 'chips' | 'bb';
  onStackClick?: () => void;
  isShowdown?: boolean;
  isWinnerSeat?: boolean;
  mini?: boolean;
  mobile?: boolean;
  variant?: 'full' | 'embedded' | 'default';
  seatIndex?: number;
  handId?: string;
}) {
  const effectCfg = getEffectConfig(mobile);
  const preHand    = upToIndex < 0;
  const stack      = isDemo ? player.stack : (preHand ? player.stack : computeStackAtAction(player, actions, upToIndex));
  const lastAction = (isDemo || preHand) ? undefined : [...actions].reverse().find(a => a.player === player.name && a.index <= upToIndex);
  const isCurrent  = !isDemo && !preHand && currentAction?.player === player.name;
  const hasFolded  = !isDemo && !preHand && actions.some(a => a.player === player.name && a.type === 'fold' && a.index <= upToIndex);
  const posColor   = POS_COLOR[player.position ?? ''] ?? '#8a93a2';
  const ast        = lastAction ? ACTION_STYLE[lastAction.type] : null;
  const streetBet  = (isDemo || preHand) ? 0 : computePlayerStreetBet(player.name, actions, upToIndex, currentStreet);
  // Antes are silently added to the pot — never shown as individual chips.
  const anteAmount  = (isDemo || preHand) ? 0 : (actions.find(a => a.player === player.name && a.type === 'post_ante' && a.index <= upToIndex)?.amount ?? 0);
  const displayBet  = Math.max(0, streetBet - anteAmount);

  const prevBetRef = useRef(0);
  const [chipEntering, setChipEntering] = useState(false);
  // Animate chips for bet/raise/call/all-in/blinds — NOT for ante posts.
  useEffect(() => {
    if (!isDemo && !preHand && displayBet !== prevBetRef.current) {
      setChipEntering(true);
      const raf = requestAnimationFrame(() => setChipEntering(false));
      prevBetRef.current = displayBet;
      return () => cancelAnimationFrame(raf);
    }
    prevBetRef.current = displayBet;
  }, [displayBet, isDemo, preHand]);

  // Detect all-in for this player up to the current action
  const isAllIn = !isDemo && !preHand && actions.some(
    a => a.player === player.name && a.type === 'allin' && a.index <= upToIndex
  );

  const delta = chipAnimDelta(pos);
  const showHoleCards = player.isHero || showCards || !!isShowdown;
  const hasCards = player.holeCards && player.holeCards.length >= 2;
  const isWinner = !isDemo && !preHand && lastAction?.type === 'collect';

  return (
    <div
      className="absolute"
      style={{
        top: pos.top, left: pos.left,
        transform: `translate(${pos.tx},${pos.ty})`,
        opacity: hasFolded ? 0.15 : 1,
        zIndex: isCurrent ? REPLAYER_LAYERS.activeSeat : player.isHero ? REPLAYER_LAYERS.heroSeat : REPLAYER_LAYERS.seats,
        transition: 'opacity 0.4s ease-out',
      }}
      onContextMenu={onContextMenu ? e => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); } : undefined}
    >
      {/* ── Bet chips floating in front of the player's seat ── */}
      {!isDemo && displayBet > 0 && !hasFolded && (() => {
        const co = chipOffsetForPos(pos, variant, mobile);
        const base = 'translate(-50%,-50%)';
        if (mobile) {
          // Mobile: opacity-only transitions — no transform shifts that cause
          // sub-pixel jitter on phone GPUs. Chips appear/disappear in place.
          const chipOpacity = (streetClosed || chipEntering) ? 0 : 1;
          return (
            <div className="absolute" style={{
              top: co.top, left: co.left,
              transform: base, opacity: chipOpacity, zIndex: REPLAYER_LAYERS.bets,
              transition: 'opacity 0.4s ease-out',
              pointerEvents: 'none',
            }}>
              <ChipStack amount={displayBet} small bigBlind={bigBlind} mode={stackMode} />
            </div>
          );
        }
        // When street closes, chips fly toward table center and dissolve
        const centerVec = chipAnimDelta(pos);
        const chipTransform = streetClosed
          ? `${base} ${centerVec.collect} scale(0.05)`
          : chipEntering
          ? `${base} ${delta.enter} scale(0.25)`
          : `${base} scale(1)`;
        const chipOpacity = (streetClosed || chipEntering) ? 0 : 1;
        return (
          <div className="absolute" style={{
            top: co.top, left: co.left,
            transform: chipTransform, opacity: chipOpacity, zIndex: REPLAYER_LAYERS.bets,
            transition: streetClosed
              ? 'transform 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.55s ease-out'
              : 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.42s ease-out',
            pointerEvents: 'none',
          }}>
            <ChipStack amount={displayBet} small bigBlind={bigBlind} mode={stackMode} />
          </div>
        );
      })()}

      {/* ── ALL IN badge ── */}
      {!isDemo && isAllIn && !hasFolded && (
        <div className="absolute" style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: REPLAYER_LAYERS.allInBadge, pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 900, letterSpacing: '0.08em',
            padding: '5px 14px', borderRadius: 99,
            background: 'linear-gradient(135deg, rgba(220,40,40,0.95), rgba(180,20,20,0.98))',
            border: '1.5px solid rgba(255,120,120,0.7)',
            color: '#fff', whiteSpace: 'nowrap',
            boxShadow: '0 0 16px rgba(220,40,40,0.6), 0 3px 12px rgba(0,0,0,0.8)',
            animation: mobile ? 'none' : 'action-pop 0.25s ease-out both',
          }}>ALL IN</div>
        </div>
      )}

      {/* ── Winner pulse ring ── (suppressed on mobile) */}
      {(isWinner || isWinnerSeat) && effectCfg.winnerPulseAnimation && (
        <div style={{
          position: 'absolute', inset: -18, borderRadius: 16,
          border: `2px solid rgba(212,175,55,0.80)`,
          animation: mobile ? 'none' : 'winner-pulse 1.2s ease-out infinite',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mini ? 14 : 12, transition: 'opacity 0.3s ease, filter 0.3s ease', opacity: (!isDemo && !isCurrent && !preHand && !isShowdown) ? 0.72 : 1, filter: (!isDemo && !isCurrent && !preHand && !isShowdown) ? 'saturate(0.8)' : 'none' }}>

        {/* ── Hole cards ── */}
        {/* Empty state: render card-back placeholders so the table looks complete. */}
        {isDemo ? (
          <div style={{
            display: 'flex', gap: mini ? 10 : 8, justifyContent: 'center',
            position: 'absolute', top: '50%', left: '50%',
            transform: `translate(-50%, -50%) translate(${-pos.ux * cardOffsetForSeat(variant, mobile)}px, ${-pos.uy * cardOffsetForSeat(variant, mobile)}px)`,
            opacity: 0.55, zIndex: 1,
          }}>
            {mini
              ? <><MiniCardBack hero={false} mobile={mobile} /><MiniCardBack hero={false} mobile={mobile} /></>
              : <><PlayingCard hidden small mobile={mobile} variant={variant} /><PlayingCard hidden small mobile={mobile} variant={variant} /></>
            }
          </div>
        ) : (
        <div style={{
          display: 'flex', gap: mini ? 10 : 8, justifyContent: 'center',
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(-50%, -50%) translate(${-pos.ux * cardOffsetForSeat(variant, mobile)}px, ${-pos.uy * cardOffsetForSeat(variant, mobile)}px)`,
          zIndex: 1,
        }}>
          {mini
            ? (showHoleCards
                ? hasCards
                  ? player.holeCards!.map((c, i) => (
                      <div key={i} style={{
                        animation: (!isDemo && !preHand && !mobile) ? `deal-in 0.3s ease ${i * 80}ms both` : 'none',
                      }}>
                        <MiniPlayingCard card={c} hero={player.isHero} mobile={mobile} />
                      </div>
                    ))
                  : <><MiniCardBack hero={player.isHero} mobile={mobile} /><MiniCardBack hero={player.isHero} mobile={mobile} /></>
                : <><MiniCardBack hero={player.isHero} mobile={mobile} /><MiniCardBack hero={player.isHero} mobile={mobile} /></>
              )
            : (showHoleCards
                ? hasCards
                  ? player.holeCards!.map((c, i) => (
                      <div key={i} style={{
                        animation: (!isDemo && !preHand && !mobile) ? `deal-in 0.3s ease ${i * 80}ms both` : 'none',
                      }}>
                        <PlayingCard card={c} large={player.isHero || !!isShowdown} hero={player.isHero} mini={mini} mobile={mobile} variant={variant} />
                      </div>
                    ))
                  : player.isHero
                    ? <><PlayingCard hidden large mini={mini} mobile={mobile} variant={variant} /><PlayingCard hidden large mini={mini} mobile={mobile} variant={variant} /></>
                    : <><PlayingCard hidden small mobile={mobile} variant={variant} /><PlayingCard hidden small mobile={mobile} variant={variant} /></>
                : player.isHero
                  ? <><PlayingCard hidden large mini={mini} mobile={mobile} variant={variant} /><PlayingCard hidden large mini={mini} mobile={mobile} variant={variant} /></>
                  : <><PlayingCard hidden small mobile={mobile} /><PlayingCard hidden small mobile={mobile} /></>
              )
          }
        </div>
        )}

        {/* ── Name plate ── */}
        <div style={{
          minWidth: mini ? 92 : variant === 'embedded' ? 62 : 96,
          padding: mini ? '3px 12px 7px' : variant === 'embedded' ? '2px 6px 4px' : '0 10px 8px',
          borderRadius: mini ? 11 : variant === 'embedded' ? 9 : 14,
          textAlign: 'center',
          position: 'relative',
          transform: 'none',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease',
          background: isCurrent
            ? 'linear-gradient(160deg, rgba(20,24,36,0.98) 0%, rgba(14,16,26,0.99) 100%)'
            : player.isHero
            ? 'linear-gradient(160deg, rgba(4,26,14,0.98) 0%, rgba(2,18,8,0.99) 100%)'
            : 'linear-gradient(160deg, rgba(12,10,20,0.97) 0%, rgba(7,6,15,0.99) 100%)',
          border: isCurrent
            ? '1.5px solid rgba(200,215,255,0.85)'
            : player.isHero
            ? '1.5px solid rgba(34,210,110,0.65)'
            : '1.5px solid rgba(52,56,72,0.80)',
          boxShadow: isCurrent
            ? [
                '0 0 32px rgba(180,205,255,0.34)',
                '0 0 14px rgba(200,220,255,0.22)',
                '0 8px 30px rgba(0,0,0,0.92)',
                'inset 0 1px 0 rgba(220,235,255,0.12)',
              ].join(',')
            : player.isHero
            ? [
                    '0 0 24px rgba(34,210,110,0.24)',
                    '0 0 10px rgba(34,210,110,0.14)',
                    '0 6px 24px rgba(0,0,0,0.88)',
                    'inset 0 1px 0 rgba(80,255,160,0.09)',
                  ].join(',')
            : '0 5px 22px rgba(0,0,0,0.84), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(10px)',
          opacity: isDemo ? 0.4 : 1,
        }}>
          {/* Active pulsing ring — static on mobile to prevent transform jitter */}
          {isCurrent && (
            <>
              <div style={{
                position: 'absolute', inset: -5, borderRadius: 18,
                border: '1.5px solid rgba(200,215,255,0.40)',
                animation: effectCfg.activeSeatAnimation ? 'pulse-ring 1.6s ease-in-out infinite' : 'none',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', inset: -8, borderRadius: 20,
                border: '1px solid rgba(200,215,255,0.18)',
                animation: effectCfg.activeSeatAnimation ? 'pulse-ring 1.6s ease-in-out 0.3s infinite' : 'none',
                pointerEvents: 'none',
              }} />
            </>
          )}

          {/* Player name — invisible on mobile to preserve nameplate height, hidden in empty state */}
          {!isDemo && (
            <div style={{
              fontSize: mini ? 10 : variant === 'embedded' ? 8 : 11, fontWeight: 600,
              color: isCurrent ? '#d4e2ff' : player.isHero ? '#86efac' : '#8a96a4',
              lineHeight: 1.2, maxWidth: mini ? 92 : variant === 'embedded' ? 70 : 96, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: variant === 'embedded' ? 3 : 5,
              visibility: mobile ? 'hidden' : 'visible',
            }}>
              {displayName(player.name, player.isHero)}
            </div>
          )}

          {/* Stack */}
          {!isDemo && formatStackDisplay(stack, bigBlind, stackMode) !== '' && (
            <div
              onClick={(!isDemo && onStackClick && bigBlind && bigBlind > 0) ? onStackClick : undefined}
              style={{
                fontSize: mini ? 12 : variant === 'embedded' ? 9 : 13, fontFamily: 'monospace', fontWeight: 700,
                color: isCurrent ? '#d4e2ff' : player.isHero ? '#4ade80' : '#dde2e8',
                lineHeight: 1, marginTop: mini ? 7 : variant === 'embedded' ? 4 : 8,
                cursor: (!isDemo && bigBlind && bigBlind > 0) ? 'pointer' : 'default',
                padding: mini ? '3px 10px' : variant === 'embedded' ? '2px 6px' : '3px 8px', borderRadius: 5,
                transition: 'background 0.15s',
                background: 'rgba(0,0,0,0.35)',
              }}
              onMouseEnter={e => { if (!isDemo && bigBlind && bigBlind > 0) (e.currentTarget as HTMLElement).background = 'rgba(255,255,255,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.35)'; }}
            >
              {formatStackDisplay(stack, bigBlind, stackMode)}
            </div>
          )}

        </div>

        {/* ── Action badge (suppressed for collect — shown as pot-award message) ──
            Only the current actor's badge is shown prominently. Previous
            actions fade out quickly so the table doesn't accumulate stale
            "Folds"/"Checks" labels. */}
        {ast && lastAction && !['collect', 'post_sb', 'post_bb', 'post_ante'].includes(lastAction.type) && (
          <div style={{
            fontSize: 11, fontWeight: 800, lineHeight: 1,
            padding: '5px 11px', borderRadius: 99,
            background: ast.bg, border: `1px solid ${ast.border}`, color: ast.text,
            boxShadow: ast.glow ? `0 2px 14px ${ast.glow}` : 'none',
            whiteSpace: 'nowrap', letterSpacing: '0.02em',
            animation: mobile ? 'none' : 'action-pop 0.2s ease-out both',
            opacity: isCurrent ? 1 : 0,
            transition: 'opacity 0.5s ease-out 1.2s',
            pointerEvents: 'none',
            zIndex: 14,
          }}>
            {actionLabel(lastAction, { bigBlind, mode: stackMode })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChairBack ────────────────────────────────────────────────────────────────

function ChairBack({ pos, mobile }: { pos: { top: string; left: string; tx: string; ty: string }; mobile?: boolean }) {
  const topPct  = parseFloat(pos.top);
  const leftPct = parseFloat(pos.left);

  const dx = leftPct - 50;
  const dy = topPct  - 50;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  // Hero (bottom) is largest and most detailed
  const scale = 0.72 + Math.max(0, Math.min(1, (topPct - 2) / 88)) * 0.38;

  const w = Math.round(80 * scale);
  const h = Math.round(108 * scale);

  const pushX = nx * 14;
  const pushY = ny * 15;

  const rawRot = Math.atan2(-ny, -nx) * (180 / Math.PI) - 90;
  const finalRot = Math.max(-22, Math.min(22, ((rawRot % 180) + 180) % 180 - 90));

  const blurPx = scale > 0.95 ? 0.2 : scale > 0.85 ? 0.5 : 0.9;

  const headH  = Math.round(h * 0.22);
  const armH   = Math.round(h * 0.14);
  const rad    = Math.round(11 * scale);

  return (
    <div style={{
      position: 'absolute',
      top:  `calc(${pos.top}  + ${pushY}%)`,
      left: `calc(${pos.left} + ${pushX}%)`,
      transform: `translate(${pos.tx}, ${pos.ty}) rotate(${finalRot}deg)`,
      width: w, height: h,
      zIndex: 0,
      filter: mobile ? 'brightness(0.85)' : `blur(${blurPx}px) brightness(0.85)`,
      pointerEvents: 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Headrest — thick padded leather with gold piping */}
      <div style={{
        width: '88%', alignSelf: 'center', height: headH, flexShrink: 0,
        borderRadius: `${rad}px ${rad}px ${Math.round(4*scale)}px ${Math.round(4*scale)}px`,
        background: `linear-gradient(170deg,
          #2e1e1a 0%,
          #221510 45%,
          #180e09 75%,
          #120b07 100%
        )`,
        border: '1px solid rgba(215,168,65,0.32)',
        borderBottom: '1px solid rgba(215,168,65,0.18)',
        boxShadow: [
          'inset 0 3px 0 rgba(255,255,255,0.08)',
          'inset 0 -2px 0 rgba(0,0,0,0.6)',
          '0 0 12px rgba(0,0,0,0.7)',
          `0 ${Math.round(4*scale)}px ${Math.round(12*scale)}px rgba(0,0,0,0.8)`,
        ].join(','),
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Headrest center diamond tufting */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            repeating-linear-gradient(135deg, transparent 0, transparent 5px, rgba(0,0,0,0.12) 5px, rgba(0,0,0,0.12) 6px),
            repeating-linear-gradient(45deg, transparent 0, transparent 5px, rgba(0,0,0,0.10) 5px, rgba(0,0,0,0.10) 6px)
          `,
        }} />
      </div>

      {/* Gold seam between headrest and back */}
      <div style={{
        width: '90%', alignSelf: 'center', height: 2.5, flexShrink: 0,
        background: `linear-gradient(90deg,
          transparent 5%,
          rgba(205,168,58,0.55) 20%,
          rgba(235,198,75,0.68) 38%,
          rgba(245,208,82,0.72) 50%,
          rgba(235,198,75,0.68) 62%,
          rgba(205,168,58,0.55) 80%,
          transparent 95%
        )`,
        boxShadow: '0 0 4px rgba(235,198,75,0.20)',
      }} />

      {/* Chair back panel — full-grain leather */}
      <div style={{
        flex: 1,
        borderRadius: `0 0 ${Math.round(8 * scale)}px ${Math.round(8 * scale)}px`,
        background: `linear-gradient(176deg,
          #2a1c14 0%,
          #1e1410 22%,
          #160e0a 48%,
          #120c08 70%,
          #160e0a 88%,
          #1e1612 100%
        )`,
        border: '1px solid rgba(215,168,55,0.22)',
        borderTop: 'none',
        boxShadow: [
          'inset 3px 0 5px rgba(255,255,255,0.028)',
          'inset -3px 0 5px rgba(0,0,0,0.35)',
          'inset 0 -2px 0 rgba(0,0,0,0.8)',
          `0 ${Math.round(14 * scale)}px ${Math.round(36 * scale)}px rgba(0,0,0,0.95)`,
          `0 ${Math.round(5 * scale)}px ${Math.round(12 * scale)}px rgba(0,0,0,0.80)`,
        ].join(','),
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Vertical tufted channel lines */}
        {[0.25, 0.5, 0.75].map(frac => (
          <div key={frac} style={{
            position: 'absolute',
            top: '8%', bottom: '8%',
            left: `${Math.round(frac * 100)}%`,
            width: 1,
            background: `linear-gradient(180deg,
              transparent 0%,
              rgba(0,0,0,0.30) 15%,
              rgba(0,0,0,0.45) 50%,
              rgba(0,0,0,0.30) 85%,
              transparent 100%
            )`,
          }} />
        ))}
        {/* Leather grain texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 5px),
            repeating-linear-gradient(45deg, transparent 0, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 5px)
          `,
        }} />
        {/* Gold accent strip at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 2,
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(205,168,55,0.40) 30%,
            rgba(225,185,65,0.50) 50%,
            rgba(205,168,55,0.40) 70%,
            transparent 100%
          )`,
        }} />
      </div>

      {/* Armrests */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        height: armH, flexShrink: 0, marginTop: -armH * 0.6,
        paddingLeft: '3%', paddingRight: '3%',
      }}>
        {[0, 1].map(side => (
          <div key={side} style={{
            width: '22%', height: '100%',
            borderRadius: Math.round(4 * scale),
            background: `linear-gradient(${side === 0 ? '100deg' : '260deg'},
              rgba(38,26,18,0.95) 0%,
              rgba(28,18,12,0.98) 50%,
              rgba(20,12,8,1.0) 100%
            )`,
            border: '1px solid rgba(205,165,55,0.20)',
            boxShadow: [
              'inset 0 2px 0 rgba(255,255,255,0.06)',
              'inset 0 -1px 0 rgba(0,0,0,0.7)',
              `0 ${Math.round(6*scale)}px ${Math.round(18*scale)}px rgba(0,0,0,0.85)`,
            ].join(','),
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── PokerTable ───────────────────────────────────────────────────────────────

export interface PokerTableProps {
  hand: ParsedHand;
  currentActionIndex: number;
  showAllCards: boolean;
  isDemo?: boolean;
  rotationOffset?: number;
  revealUpToStreet?: Street;
  onSeatContextMenu?: (playerName: string, x: number, y: number) => void;
  bigBlind?: number;
  showStacksInBB?: boolean;
  onStackClick?: () => void;
  /** Compact mode: less perspective tilt + shorter aspect ratio for inline mini replayer */
  compact?: boolean;
  /** Mini mode: ~25% smaller hole cards + ~22% smaller board + compact nameplate. Used by the inline Analytics replayer so seats don't crowd the table. */
  mini?: boolean;
  /** Mobile mode: dedicated phone layout — smaller seats, tighter nameplates (position + stack only), reduced table size, wider seat spacing. */
  mobile?: boolean;
  /** Variant controls card + seat sizing for the two replayer contexts:
   *  - `full`    : main HH Replayer — table dominates, hole cards ~50% smaller, board cards stay large.
   *  - `embedded`: Recent Hands inline preview — compact table, all cards + seats substantially smaller.
   *  - `default` : legacy callers — original proportions. */
  variant?: 'full' | 'embedded' | 'default';
}

export function PokerTable({ hand, currentActionIndex, showAllCards, isDemo = false, rotationOffset = 0,
  revealUpToStreet, onSeatContextMenu, bigBlind, showStacksInBB, onStackClick, compact = false, mini = false, mobile = false, variant = 'default' }: PokerTableProps) {
  const preHand      = currentActionIndex < 0;
  const currentAction = preHand ? null : (hand.actions.find(a => a.index === currentActionIndex) ?? null);
  const isShowdown   = !isDemo && !preHand && (
    currentAction?.street === 'showdown' ||
    currentAction?.type === 'collect' ||
    currentAction?.type === 'show'
  );

  const upToStreets   = preHand ? [] : hand.actions.filter(a => a.index <= currentActionIndex).map(a => a.street);
  const revealStreets = revealUpToStreet ? [...upToStreets, revealUpToStreet] : upToStreets;
  const flopRevealed  = !isDemo && revealStreets.some(s => ['flop','turn','river','showdown'].includes(s));
  const turnRevealed  = !isDemo && revealStreets.some(s => ['turn','river','showdown'].includes(s));
  const riverRevealed = !isDemo && revealStreets.some(s => ['river','showdown'].includes(s));
  const currentStreet: Street = currentAction?.street ?? 'preflop';

  const nextAction    = preHand ? null : hand.actions.find(a => a.index > currentActionIndex);
  const streetClosed  = !preHand && !isDemo && (
    nextAction === null || nextAction === undefined || nextAction.street !== currentStreet
  );

  const totalPot     = (isDemo || preHand) ? 0 : computePotAtAction(hand.actions, currentActionIndex);
  const collectedPot = (isDemo || preHand) ? 0 : computeCollectedPot(hand.actions, currentStreet);
  // When a street closes, chips animate into the pot over ~0.7s. Delay the pot
  // badge update so it changes AFTER the collection animation completes.
  const [potDisplay, setPotDisplay] = useState(0);
  const prevStreetClosedRef = useRef(false);
  useEffect(() => {
    if (streetClosed && !prevStreetClosedRef.current) {
      // Street just closed — wait for chip animation, then update pot
      const t = setTimeout(() => setPotDisplay(totalPot), 650);
      prevStreetClosedRef.current = true;
      return () => clearTimeout(t);
    }
    if (!streetClosed) {
      prevStreetClosedRef.current = false;
      setPotDisplay(currentStreet === 'preflop' ? totalPot : collectedPot);
    } else {
      setPotDisplay(totalPot);
    }
  }, [streetClosed, totalPot, collectedPot, currentStreet]);
  const displayPot = potDisplay;
  // Stack/amount unit mode — shared across seats, pot, and showdown messages.
  const amountMode: 'chips' | 'bb' = showStacksInBB ? 'bb' : 'chips';

  const heroIndex  = hand.players.findIndex(p => p.isHero);
  const base       = heroIndex >= 0 ? heroIndex : 0;
  const n          = hand.players.length;
  const startIdx   = ((base + rotationOffset) % n + n) % n;
  const ordered    = n > 0 ? [...hand.players.slice(startIdx), ...hand.players.slice(0, startIdx)] : hand.players;
  // ── Memoized static geometry ──
  // Seat positions and ring radii depend ONLY on player count, variant, and
  // mobile mode — never on action index, stack, fold state, pot, or cards.
  // This prevents unnecessary re-renders and coordinate drift during playback.
  const seatPositions = useMemo(
    () => getSeatPositions(n, mini, variant, mobile),
    [n, mini, variant, mobile],
  );
  // Ring radii (must match getSeatPositions) — used for the position-label oval.
  const { rX: ringRX, rY: ringRY } = useMemo(
    () => __testGetRingRadii(variant, mobile),
    [variant, mobile],
  );
  // Visual-effect config — one source of truth for mobile vs desktop behavior.
  const effectConfig = useMemo(() => getEffectConfig(mobile), [mobile]);
  // Preload static table assets so they don't cause layout shifts or repaints during playback
  useEffect(() => {
    const urls = ['/assets/images/image copy copy.png'];
    urls.forEach((src) => { const img = new Image(); img.src = src; });
  }, []);
  // Debug overlay flag — dev-only, requires ?replayerDebug=1.
  const showDebug = useReplayerDebug();

  // Hero is always index 0 in `ordered`, which maps to the bottom-center seat
  // (angle = π/2 in CSS coords). All other players are rotated around the table
  // relative to Hero. This works for any table size (6-max, 8-max, 9-max, etc.).
  const seatEntries = ordered.map((player, i) => ({
    player,
    pos: seatPositions[Math.min(i, seatPositions.length - 1)],
    isEmpty: false,
    seatIndex: i,
  }));

  // ── Development-only invariant checks ──
  // Runs in DEV only, never alters rendering. Catches duplicate seats,
  // missing BTN/SB/BB, NaN coordinates, out-of-range seats, etc.
  if (import.meta.env.DEV && !isDemo && n > 0) {
    checkReplayerInvariants({
      hand,
      seatEntries: seatEntries.map(e => ({
        player: e.player,
        seatIndex: e.seatIndex,
        pos: { seatIndex: e.seatIndex, top: e.pos.top, left: e.pos.left, ux: e.pos.ux, uy: e.pos.uy },
      })),
      ringRX, ringRY,
      handId: hand.title ?? 'unknown',
    });
  }

  const STREET_LABEL: Record<string, string> = {
    preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
  };
  const STREET_GLOW: Record<string, string> = {
    preflop: 'rgba(100,100,140,0.3)', flop: 'rgba(52,211,153,0.35)', turn: 'rgba(233,169,0,0.35)', river: 'rgba(251,146,60,0.35)', showdown: 'rgba(201,162,39,0.45)',
  };
  const STREET_CLR: Record<string, string> = {
    preflop: '#8a93a2', flop: '#34d399', turn: '#f59e0b', river: '#fb923c', showdown: '#d4af37',
  };

  return (
    /* ── Perspective camera — 3/4 cinematic angle (flat on mobile for stable compositing) ── */
    <div style={{
      width: '100%',
      perspective: mobile ? 'none' : `${effectConfig.perspective}px`,
      perspectiveOrigin: '50% 18%',
      maxWidth: 'none',
    }}>
    <div className="relative w-full select-none" style={{
      paddingBottom: variant === 'embedded' ? '42%' : compact ? '54%' : '62%',
      transform: `rotateX(${mobile ? 0 : variant === 'embedded' ? 8 : compact ? 12 : 22}deg)`,
      transformStyle: mobile ? 'flat' : 'preserve-3d',
      transformOrigin: 'center bottom',
    }}>

      {/* ── 0. Chairs — rendered first (lowest z-index) ── */}
      {seatEntries.map((entry, i) => (
        <ChairBack
          key={`chair-${hand.title ?? 'h'}-${entry.seatIndex}`}
          pos={entry.pos}
          mobile={mobile}
        />
      ))}

      {/* ── 1. Deep floor shadow — elevated luxury table casting dramatic shadow ── */}
      <div style={{
        position: 'absolute',
        inset: compact ? '2% 2% -12% 2%' : '2% 2% -22% 2%',
        borderRadius: '50%',
        background: 'transparent',
        boxShadow: compact ? [
          '0 0 0 2px rgba(0,0,0,0.65)',
          '0 0 25px 12px rgba(0,0,0,0.95)',
          '0 0 60px 28px rgba(0,0,0,0.80)',
        ].join(',') : [
          '0 0 0 3px rgba(0,0,0,0.65)',
          '0 0 45px 22px rgba(0,0,0,0.98)',
          '0 0 100px 48px rgba(0,0,0,0.92)',
          '0 0 180px 68px rgba(0,0,0,0.75)',
          '0 0 280px 90px rgba(0,0,0,0.50)',
          '0 0 400px 120px rgba(0,0,0,0.28)',
        ].join(','),
        pointerEvents: 'none',
      }} />

      {/* ── 1b. Table physical edge — rich walnut with gold inlay strip ── */}
      <div className="absolute rounded-[46%]" style={{
        inset: -8,
        background: `linear-gradient(176deg,
          rgba(40,28,12,0.98) 0%,
          rgba(28,18,7,0.99)  20%,
          rgba(18,11,4,0.99)  45%,
          rgba(10,6,2,1.0)    65%,
          rgba(8,5,1,1.0)     80%,
          rgba(12,7,2,0.99)   100%
        )`,
        transform: 'translateY(14px)',
        boxShadow: [
          '0 28px 80px rgba(0,0,0,1.0)',
          '0 14px 40px rgba(0,0,0,0.98)',
          'inset 0 4px 0 rgba(215,175,75,0.30)',
          'inset 0 1px 8px rgba(195,158,60,0.15)',
          'inset 0 -3px 0 rgba(140,100,30,0.40)',
        ].join(','),
        pointerEvents: 'none',
      }} />

      {/* Gold inlay strip along top of table edge */}
      <div className="absolute rounded-[46%]" style={{
        inset: -3,
        border: '2px solid rgba(205,168,58,0.55)',
        background: 'transparent',
        pointerEvents: 'none',
        boxShadow: [
          '0 0 3px 1px rgba(215,178,65,0.30)',
          'inset 0 0 4px rgba(215,178,65,0.15)',
        ].join(','),
        transform: 'translateY(14px)',
      }} />

      {/* ── 1c. Warm floor reflection — polished hardwood catching gold light ── */}
      <div style={{
        position: 'absolute',
        inset: '18% 5% -22% 5%',
        borderRadius: '50%',
        background: 'transparent',
        boxShadow: '0 0 100px 35px rgba(205,165,55,0.14)',
        pointerEvents: 'none',
      }} />

      {/* ── 2. Brass Rail LED Underglow — premium gold light radiating outward ── */}
      <div className="absolute inset-0 rounded-[46%]" style={{
        background: 'transparent',
        boxShadow: [
          '0 0 2px 3px rgba(235,198,75,0.90)',
          '0 0 12px 6px rgba(220,182,62,0.62)',
          '0 0 28px 12px rgba(205,166,50,0.40)',
          '0 0 55px 20px rgba(190,152,44,0.24)',
          '0 0 90px 28px rgba(172,138,36,0.14)',
          '0 0 140px 38px rgba(155,124,30,0.07)',
          '0 16px 35px 8px rgba(218,178,55,0.38)',
          '0 30px 70px 14px rgba(198,160,45,0.20)',
          '0 44px 105px 18px rgba(178,142,38,0.10)',
        ].join(','),
        pointerEvents: 'none',
      }} />

      {/* ── 3. Outer RAIL — premium black leather with brass hardware ── */}
      <div className="absolute inset-0 rounded-[46%]" style={{
        background: `
          radial-gradient(ellipse 100% 45% at 50% 0%,
            rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.035) 40%, transparent 65%
          ),
          radial-gradient(ellipse 55% 20% at 15% 7%,
            rgba(255,255,255,0.055) 0%, transparent 55%
          ),
          radial-gradient(ellipse 55% 20% at 85% 7%,
            rgba(255,255,255,0.045) 0%, transparent 55%
          ),
          radial-gradient(ellipse 65% 18% at 50% 97%,
            rgba(210,175,68,0.20) 0%, transparent 62%
          ),
          radial-gradient(ellipse 40% 25% at 50% 50%,
            rgba(255,255,255,0.015) 0%, transparent 60%
          ),
          linear-gradient(172deg,
            #201c14 0%,
            #181410 12%,
            #100e0a 28%,
            #0a0806 46%,
            #060504 58%,
            #0c0a06 70%,
            #161210 82%,
            #1e1a12 92%,
            #26221a 100%
          )
        `,
        border: '5.5px solid rgba(205,172,68,0.88)',
        boxShadow: [
          '0 22px 80px rgba(0,0,0,0.99)',
          'inset 0 8px 0 rgba(255,255,255,0.12)',
          'inset 0 5px 20px rgba(255,255,255,0.055)',
          'inset 10px 0 22px rgba(0,0,0,0.55)',
          'inset -10px 0 22px rgba(0,0,0,0.55)',
          'inset 0 -6px 0 rgba(0,0,0,0.92)',
          'inset 0 0 90px rgba(0,0,0,0.65)',
          '0 0 0 2px rgba(205,172,68,0.42)',
          'inset 0 -15px 35px rgba(225,188,60,0.28)',
          'inset 0 -6px 14px rgba(235,198,65,0.18)',
          'inset 16px 0 35px rgba(0,0,0,0.40)',
          'inset -16px 0 35px rgba(0,0,0,0.40)',
          '0 0 0 7px rgba(205,172,68,0.10)',
        ].join(','),
      }} />

      {/* ── 4. Leather stitching texture + subtle grain on rail ── */}
      <div className="absolute inset-0 rounded-[46%]" style={{
        backgroundImage: `
          repeating-linear-gradient(
            42deg,
            rgba(255,255,255,0.020) 0px, rgba(255,255,255,0.020) 1px,
            transparent 1px, transparent 6px
          ),
          repeating-linear-gradient(
            -42deg,
            rgba(0,0,0,0.060) 0px, rgba(0,0,0,0.060) 1px,
            transparent 1px, transparent 6px
          ),
          repeating-linear-gradient(
            90deg,
            transparent 0px, transparent 22px,
            rgba(205,172,68,0.012) 22px, rgba(205,172,68,0.012) 23px
          )
        `,
        pointerEvents: 'none',
      }} />

      {/* ── 4b. Leather diamond stitching pattern ── */}
      <div className="absolute inset-0 rounded-[46%]" style={{
        backgroundImage: `
          repeating-linear-gradient(
            135deg,
            transparent 0px, transparent 12px,
            rgba(255,255,255,0.008) 12px, rgba(255,255,255,0.008) 13px
          ),
          repeating-linear-gradient(
            45deg,
            transparent 0px, transparent 12px,
            rgba(255,255,255,0.006) 12px, rgba(255,255,255,0.006) 13px
          )
        `,
        pointerEvents: 'none',
      }} />

      {/* ── 5. Brushed gold/brass inner trim ring ── */}
      <div className="absolute rounded-[46%]" style={{
        inset: 9,
        border: '2px solid rgba(215,182,65,0.80)',
        background: 'transparent',
        pointerEvents: 'none',
        boxShadow: [
          'inset 0 1.5px 0 rgba(245,215,98,0.60)',
          'inset 0 -1.5px 0 rgba(0,0,0,0.55)',
          '0 0 14px rgba(215,182,65,0.18)',
          '0 0 0 0.5px rgba(235,200,80,0.28)',
          '0 0 0 3px rgba(215,182,65,0.06)',
        ].join(','),
      }} />

      {/* ── 6. Dark channel / bevel ── */}
      <div className="absolute rounded-[46%]" style={{
        inset: 15,
        border: '1px solid rgba(0,0,0,0.85)',
        background: 'transparent',
        pointerEvents: 'none',
        boxShadow: [
          'inset 0 2px 8px rgba(0,0,0,0.65)',
          'inset 0 -1px 4px rgba(0,0,0,0.5)',
        ].join(','),
      }} />

      {/* ── 7. Inner warm lip — felt boundary with brass bleed ── */}
      <div className="absolute rounded-[46%]" style={{
        inset: 20,
        border: '1.5px solid rgba(165,138,48,0.42)',
        background: 'transparent',
        pointerEvents: 'none',
        boxShadow: [
          'inset 0 0 22px rgba(0,0,0,0.52)',
          '0 0 8px rgba(165,138,48,0.08)',
          'inset 0 0 16px rgba(185,150,42,0.08)',
        ].join(','),
      }} />

      {/* ── 8. Felt surface — premium tournament quality ── */}
      <div className="absolute rounded-[46%] overflow-hidden" style={{ inset: 26 }}>

        {/* Base felt — deep luxury green like Triton/PokerGO */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 145% 120% at 50% 22%,
              #2d7a52 0%,
              #1f5e3e 12%,
              #164a30 25%,
              #0e3822 40%,
              #092a18 58%,
              #061e11 76%,
              #04140b 100%
            )
          `,
        }} />

        {/* Overhead pendant spotlight — bright warm cone hitting center */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 48% 40% at 50% 38%,
              rgba(120,240,165,0.32) 0%,
              rgba(85,200,130,0.18) 35%,
              rgba(55,160,100,0.08) 60%,
              transparent 75%
            )
          `,
          pointerEvents: 'none',
        }} />

        {/* Golden hour ambient wash from window */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 110% 75% at 50% 45%,
              rgba(48,145,88,0.14) 0%,
              rgba(32,108,65,0.07) 50%,
              transparent 70%
            )
          `,
          pointerEvents: 'none',
        }} />

        {/* Woven felt texture — fine casino grade */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(0,0,0,0.065) 0px, rgba(0,0,0,0.065) 1px,
              transparent 1px, transparent 3px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(0,0,0,0.055) 0px, rgba(0,0,0,0.055) 1px,
              transparent 1px, transparent 3px
            ),
            repeating-linear-gradient(
              45deg,
              rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px,
              transparent 1px, transparent 9px
            ),
            repeating-linear-gradient(
              -45deg,
              rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px,
              transparent 1px, transparent 9px
            )
          `,
          pointerEvents: 'none',
        }} />

        {/* ── Betting line oval ── */}
        <div className="absolute rounded-[46%]" style={{
          inset: '12% 8%',
          border: '1.5px solid rgba(255,255,255,0.18)',
          background: 'transparent',
          pointerEvents: 'none',
          boxShadow: [
            'inset 0 0 16px rgba(0,0,0,0.28)',
            '0 0 6px rgba(255,255,255,0.04)',
          ].join(','),
        }} />

        {/* Edge ambient occlusion */}
        <div className="absolute inset-0 rounded-[46%]" style={{
          background: 'radial-gradient(ellipse 108% 98% at 50% 50%, transparent 32%, rgba(0,0,0,0.70) 75%, rgba(0,0,0,0.90) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Gold rail warm light bleeding onto felt edge */}
        <div className="absolute rounded-[46%]" style={{
          inset: 0,
          border: '10px solid transparent',
          background: 'transparent',
          boxShadow: [
            'inset 0 0 48px rgba(225,182,55,0.35)',
            'inset 0 0 22px rgba(240,198,60,0.24)',
            'inset 0 -18px 36px rgba(230,188,55,0.22)',
            'inset 0 18px 30px rgba(210,170,50,0.16)',
          ].join(','),
          pointerEvents: 'none',
        }} />

        {/* Top specular — chandelier reflection on felt */}
        <div className="absolute" style={{
          top: 0, left: '14%', right: '14%', height: '22%',
          background: 'radial-gradient(ellipse 65% 100% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Center HUD: street label → board → pot stack → pot badge ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0 pointer-events-none" style={{ transform: 'none' }}>
        {/* Street label */}
        <div style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '0.36em', textTransform: 'uppercase',
          color: isDemo ? 'rgba(180,210,185,0.08)' : (STREET_CLR[currentStreet] ?? '#8a93a2'),
          marginBottom: 4,
          textShadow: isDemo ? 'none' : `0 0 20px ${STREET_GLOW[currentStreet] ?? 'transparent'}`,
        }}>
          {isDemo ? '' : (STREET_LABEL[currentStreet] ?? currentStreet.toUpperCase())}
        </div>

        {/* SpotVault logo — centered above community cards */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: 10, marginTop: 0, pointerEvents: 'none', userSelect: 'none',
        }}>
          {/* Vault icon + wordmark row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Vault door icon — SVG built inline */}
            <svg
              width={66} height={66} viewBox="0 0 24 24" fill="none"
              style={{
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.75))',
                opacity: (!isDemo && !preHand) ? 0.32 : 0.85,
                transition: 'opacity 0.4s ease',
              }}
            >
              <rect x="2" y="3" width="20" height="18" rx="2.5" ry="2.5"
                stroke="url(#vg)" strokeWidth="1.5" fill="none" />
              <circle cx="12" cy="12" r="6"
                stroke="url(#vg)" strokeWidth="1.4" fill="none" />
              <circle cx="12" cy="12" r="3.2"
                stroke="url(#vg)" strokeWidth="1" fill="none" />
              <line x1="16.2" y1="12" x2="18.5" y2="12"
                stroke="url(#vg)" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="12" y1="6.2" x2="12" y2="8.6"
                stroke="url(#vg)" strokeWidth="1" strokeLinecap="round" />
              <line x1="12" y1="15.4" x2="12" y2="17.8"
                stroke="url(#vg)" strokeWidth="1" strokeLinecap="round" />
              <line x1="6.2" y1="12" x2="8.6" y2="12"
                stroke="url(#vg)" strokeWidth="1" strokeLinecap="round" />
              <circle cx="4.2" cy="6.5" r="0.9" fill="url(#vg)" />
              <circle cx="4.2" cy="17.5" r="0.9" fill="url(#vg)" />
              <defs>
                <linearGradient id="vg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#e8c96a" />
                  <stop offset="45%" stopColor="#d4a83c" />
                  <stop offset="100%" stopColor="#a87828" />
                </linearGradient>
              </defs>
            </svg>

            {/* Text: SpotVault */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <span style={{
                fontSize: 38, fontWeight: 800, letterSpacing: '0.14em',
                lineHeight: 1,
                background: 'linear-gradient(135deg, #e8c96a 0%, #d4a83c 40%, #c49230 70%, #e8c96a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.85))',
                textTransform: 'uppercase',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}>SpotVault</span>
              <span style={{
                fontSize: 20, fontWeight: 700, letterSpacing: '0.45em',
                lineHeight: 1,
                color: 'rgba(212,168,60,0.60)',
                textTransform: 'uppercase',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                marginTop: 4,
                textShadow: '0 1px 4px rgba(0,0,0,0.85)',
              }}>POKER</span>
            </div>
          </div>

          {/* Thin gold rule beneath */}
          <div style={{
            marginTop: 10,
            width: 210, height: 1,
            background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,60,0.45) 25%, rgba(232,201,106,0.55) 50%, rgba(212,168,60,0.45) 75%, transparent 100%)',
          }} />
        </div>

        {/* Community cards — single unified box containing all 5 slots */}
        <div style={{
          position: 'relative',
          border: '1.5px solid rgba(255,255,255,0.22)',
          borderRadius: 10,
          padding: '8px 10px',
          background: 'rgba(0,0,0,0.22)',
          boxShadow: [
            'inset 0 0 20px rgba(0,0,0,0.30)',
            '0 4px 24px rgba(0,0,0,0.60)',
          ].join(','),
          filter: mobile
            ? 'drop-shadow(0 5px 14px rgba(0,0,0,0.75))'
            : (flopRevealed
              ? 'drop-shadow(0 10px 28px rgba(0,0,0,0.98)) drop-shadow(0 3px 8px rgba(0,0,0,0.85))'
              : 'drop-shadow(0 5px 14px rgba(0,0,0,0.75))'),
        }}>
          {/* Inner echo border */}
          <div style={{
            position: 'absolute', inset: 3,
            border: '0.5px solid rgba(255,255,255,0.07)',
            borderRadius: 8, pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: mini ? 11 : 8, position: 'relative', transform: mini ? 'translateY(-6px)' : 'none' }}>
          {isDemo || hand.board.flop.length === 0 ? (
            <>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: mini ? 64 : 75, height: mini ? 91 : 106, borderRadius: 7,
                  border: '1px dashed rgba(255,255,255,0.10)',
                  background: 'rgba(0,0,0,0.25)',
                }} />
              ))}
              <div style={{ width: 1, height: mini ? 52 : 56, background: 'rgba(255,255,255,0.10)', margin: '0 4px' }} />
              <div style={{ width: mini ? 64 : 75, height: mini ? 91 : 106, borderRadius: 7, border: '1px dashed rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.25)' }} />
              <div style={{ width: 1, height: mini ? 52 : 56, background: 'rgba(255,255,255,0.10)', margin: '0 4px' }} />
              <div style={{ width: mini ? 64 : 75, height: mini ? 91 : 106, borderRadius: 7, border: '1px dashed rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.25)' }} />
            </>
          ) : (
            <>
              {hand.board.flop.map((c, i) => (
                <BoardCard key={i} card={c} revealed={flopRevealed || showAllCards} animDelay={i * 100} mini={mini} mobile={mobile} />
              ))}
              <div style={{ width: 1, height: mini ? 52 : 56, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <BoardCard card={hand.board.turn ?? undefined} revealed={turnRevealed || showAllCards} animDelay={300} mini={mini} mobile={mobile} />
              <div style={{ width: 1, height: mini ? 52 : 56, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <BoardCard card={hand.board.river ?? undefined} revealed={riverRevealed || showAllCards} animDelay={400} mini={mini} mobile={mobile} />
            </>
          )}
          </div>
        </div>

        {/* Pot chip stack — below the board */}
        {!isDemo && (() => {
          const winnerName = hand.winners[0]?.player;
          const winnerIdx  = winnerName ? seatEntries.findIndex(e => e.player.name === winnerName) : -1;
          const winnerPos  = winnerIdx >= 0 ? seatEntries[Math.min(winnerIdx, seatEntries.length - 1)].pos : null;

          let potShipStyle: React.CSSProperties = {};
          if (isShowdown && winnerPos) {
            const dx = parseFloat(winnerPos.left) - 50;
            const dy = parseFloat(winnerPos.top)  - 50;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const mag = 22;
            potShipStyle = {
              transform: `translate(${(dx / dist) * mag}%, ${(dy / dist) * mag}%) scale(0.6)`,
              opacity: 0,
              transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1), opacity 0.55s ease-out',
            };
          }

          if (displayPot <= 0) return <div style={{ height: 52 }} />;

          // ── Side-pot computation (showdown only) ──
          // Collect each player's total commitment across all streets, then
          // build eligibility tiers from all-in amounts. Each tier's pot =
          // (tier commitment) × (eligible players) − previous tiers' contributions.
          type SidePot = { label: string; amount: number; winners: string[] };
          const sidePots: SidePot[] = [];
          if (isShowdown) {
            const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
            const commits = new Map<string, number>();
            for (const p of hand.players) {
              let total = 0;
              for (const s of streets) total += computePlayerStreetBet(p.name, hand.actions, Number.MAX_SAFE_INTEGER, s);
              if (total > 0) commits.set(p.name, total);
            }
            const allInAmounts = [...commits.entries()]
              .map(([name, amt]) => ({ name, amt }))
              .sort((a, b) => a.amt - b.amt);
            if (allInAmounts.length >= 2) {
              const tiers: { cap: number; eligible: string[] }[] = [];
              let prevCap = 0;
              for (const e of allInAmounts) {
                if (e.amt > prevCap) {
                  tiers.push({ cap: e.amt, eligible: allInAmounts.filter(x => x.amt >= e.amt).map(x => x.name) });
                  prevCap = e.amt;
                }
              }
              tiers.forEach((t, i) => {
                const prev = i === 0 ? 0 : tiers[i - 1].cap;
                const tierSize = t.cap - prev;
                const pot = tierSize * t.eligible.length;
                if (pot > 0) {
                  const winners = hand.winners.filter(w => t.eligible.includes(w.player)).map(w => w.player);
                  sidePots.push({
                    label: i === 0 ? 'Main Pot' : `Side Pot ${i}`,
                    amount: pot,
                    winners,
                  });
                }
              });
            }
          }

          const hasSidePots = sidePots.length > 1;

          return (
            <div style={{
              marginTop: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.9))',
              ...potShipStyle,
            }}>
              <ChipStack amount={displayPot} bigBlind={bigBlind} mode={amountMode} />
              {/* Pot badge below chip stack */}
              <div style={{
                padding: '4px 16px 4px 12px',
                borderRadius: 99,
                display: mobile ? 'none' : 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, rgba(18,14,4,0.97) 0%, rgba(12,9,2,0.98) 100%)',
                border: '1.5px solid rgba(185,155,58,0.58)',
                boxShadow: [
                  '0 0 14px rgba(185,155,58,0.18)',
                  '0 4px 16px rgba(0,0,0,0.90)',
                  'inset 0 1px 0 rgba(215,185,72,0.08)',
                ].join(','),
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'radial-gradient(circle, #e8c85a 0%, #b8962e 100%)',
                  boxShadow: '0 0 5px rgba(215,185,70,0.60)',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                  letterSpacing: '0.07em', color: '#d4b84a',
                  textShadow: '0 0 10px rgba(205,175,58,0.30)',
                }}>
                  {hasSidePots ? 'Main Pot' : 'Pot'}&nbsp;&nbsp;{formatAmountDisplay(sidePots[0]?.amount ?? displayPot, bigBlind, amountMode)}
                </span>
              </div>
              {/* Side-pot badges — stacked below the main pot */}
              {hasSidePots && sidePots.slice(1).map((sp, i) => (
                <div key={i} style={{
                  padding: '3px 12px 3px 10px',
                  borderRadius: 99,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'linear-gradient(135deg, rgba(14,10,4,0.95) 0%, rgba(8,6,2,0.96) 100%)',
                  border: '1px solid rgba(185,155,58,0.42)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.85)',
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'radial-gradient(circle, #c9a227 0%, #8a6e1a 100%)',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                    letterSpacing: '0.06em', color: '#b8962e',
                  }}>
                    {sp.label}&nbsp;&nbsp;{formatAmountDisplay(sp.amount, bigBlind, amountMode)}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── 10b. Showdown pot-award message — one concise line, fades after ~2s ── */}
      {isShowdown && hand.winners.length > 0 && (() => {
        const w = hand.winners[0];
        const winner = hand.players.find(p => p.name === w.player);
        const pos = winner?.position ?? '';
        const isSplit = hand.winners.length > 1;
        const msg = isSplit
          ? `Split pot · ${formatAmountDisplay(w.amount, bigBlind, amountMode)}`
          : `${pos} wins ${formatAmountDisplay(w.amount, bigBlind, amountMode)}`;
        return (
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ zIndex: 30, paddingBottom: '3%' }}>
            <div style={{
              padding: '8px 24px',
              borderRadius: 99,
              background: 'linear-gradient(135deg, rgba(20,16,4,0.97) 0%, rgba(12,10,2,0.98) 100%)',
              border: '1.5px solid rgba(212,175,55,0.80)',
              boxShadow: [
                '0 0 24px rgba(212,175,55,0.35)',
                '0 6px 28px rgba(0,0,0,0.95)',
                'inset 0 1px 0 rgba(240,210,90,0.12)',
              ].join(','),
              display: 'flex', alignItems: 'center', gap: 10,
              backdropFilter: 'blur(12px)',
              animation: mobile ? 'none' : 'showdown-fade 2s ease-out both',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'radial-gradient(circle, #f0dc80 0%, #c9a227 100%)',
                boxShadow: '0 0 8px rgba(212,175,55,0.80)',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13, fontWeight: 800, fontFamily: 'monospace',
                letterSpacing: '0.04em',
                color: '#e8c85a',
                textShadow: '0 0 16px rgba(212,175,55,0.55)',
                whiteSpace: 'nowrap',
              }}>
                {msg}
              </span>
            </div>
          </div>
        );
      })()}
      </div>{/* end center HUD */}

      {/* ── 11. Seats ── */}
      {seatEntries.map((entry, i) => {
        const winnerNames = hand.winners.map(w => w.player);
        return (
          <PlayerSeat
            key={`seat-${hand.title ?? 'h'}-${entry.seatIndex}`}
            player={entry.player}
            actions={hand.actions}
            upToIndex={currentActionIndex}
            currentAction={currentAction}
            showCards={showAllCards}
            pos={entry.pos}
            isDemo={entry.isEmpty || isDemo}
            onContextMenu={onSeatContextMenu && !entry.isEmpty ? (x, y) => onSeatContextMenu(entry.player.name, x, y) : undefined}
            currentStreet={currentStreet}
            streetClosed={streetClosed}
            bigBlind={bigBlind}
            stackMode={showStacksInBB ? 'bb' : 'chips'}
            onStackClick={onStackClick}
            isShowdown={isShowdown}
            isWinnerSeat={isShowdown && winnerNames.includes(entry.player.name)}
            mini={mini}
            mobile={mobile}
            variant={variant}
            seatIndex={entry.seatIndex}
            handId={hand.title ?? ''}
          />
        );
      })}

      {/* ── 12. Dealer button ── */}
      {!isDemo && hand.buttonSeat > 0 && (() => {
        const idx = seatEntries.findIndex(e => e.player.seat === hand.buttonSeat);
        if (idx < 0) return null;
        const pos = seatEntries[Math.min(idx, seatEntries.length - 1)].pos;
        // Position the dealer button tangentially beside the seat using the
        // radial unit vector, so it rotates consistently around the table and
        // never collides with cards (outward) or chips (inward).
        const btnSize = mini ? 22 : 32;
        const tangentX = -pos.uy; // perpendicular to radial outward
        const tangentY =  pos.ux;
        const tangDist = mini ? 24 : 34;
        // Pull the dealer button inward to sit just past the inner edge of the
        // hole cards, matching the bet-chip radial line so it revolves cleanly
        // around the table outside the cards. Desktop only — mobile keeps
        // original spacing.
        const inwardDist = mini ? 60 : variant === 'full' ? (mobile ? 97 : 105) : variant === 'embedded' ? 83 : 97;
        const offX = tangentX * tangDist - pos.ux * inwardDist;
        const offY = tangentY * tangDist - pos.uy * inwardDist;
        return (
          <div className="absolute" style={{
            top: pos.top, left: pos.left,
            transform: `translate(calc(${pos.tx} + ${offX}px), calc(${pos.ty} + ${offY}px))`,
            width: btnSize, height: btnSize, borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 28%, #f5e17a 0%, #c9a227 38%, #a07e18 72%, #7a5e10 100%)',
            border: '2px solid rgba(245,225,120,0.9)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: [
              '0 5px 18px rgba(0,0,0,0.95)',
              '0 2px 6px rgba(0,0,0,0.7)',
              'inset 0 1.5px 0 rgba(255,240,140,0.7)',
              '0 0 14px rgba(201,162,39,0.35)',
            ].join(','),
            gap: 1,
            zIndex: REPLAYER_LAYERS.dealerButton,
          }}>
              <>
                <span style={{ fontSize: mini ? 7 : 8, fontWeight: 900, color: '#1a1200', letterSpacing: '0.02em', lineHeight: 1 }}>SV</span>
                {!mini && <span style={{ fontSize: 5.5, fontWeight: 700, color: 'rgba(26,18,0,0.7)', letterSpacing: '0.06em', lineHeight: 1 }}>DEALER</span>}
              </>
          </div>
        );
      })()}

      {/* No dealer button in empty state — no position is selected until a real hand loads */}

      {/* ── Position labels on an inner oval ring ── (hidden on mobile) */}
      {/* Each marker (BTN, SB, BB, UTG, etc.) is placed on an invisible oval
          that sits just outside the inner tips of the hole cards. The position
          is calculated from the seat's angle around the table center — NOT from
          the player nameplate or chip stack — so every marker is equidistant
          from the center and forms a clean, symmetrical ring. */}
      {seatEntries.map((entry, i) => {
        const p = entry.player;
        const pos = entry.pos;
        // Inner ring radius: ~62% of the seat radius places the marker just
        // inside the inner tips of the hole cards (cards extend from the seat
        // toward center; their tips land at roughly 65% of the seat radius).
        const ringScale = effectConfig.positionLabelRingScale;
        // Reconstruct the seat's angle from the unit radial vector.
        const angle = Math.atan2(pos.uy, pos.ux);
        const ringDx = ringRX * ringScale * Math.cos(angle);
        const ringDy = ringRY * ringScale * Math.sin(angle);
        const ringTop = `${50 + ringDy}%`;
        const ringLeft = `${50 + ringDx}%`;

        const label = isDemo
          ? EMPTY_SEAT_LABELS[i % EMPTY_SEAT_LABELS.length]
          : p.position;
        if (!label) return null;

        const isBtn = label === 'BTN';
        const isHero = p.isHero;
        const labelColor = POS_COLOR[label] ?? '#8a93a2';

        // Mobile: compact uppercase position identifiers — 8px, no badge,
        // no background, no border, no glow. Absolutely positioned so they
        // never affect seat layout. Subtle text shadow for readability
        // against the felt. Same position-mapping logic as desktop.
        if (mobile) {
          return (
            <div
              key={`pos-${hand.title ?? 'h'}-${entry.seatIndex}`}
              className="absolute position-tag--mobile"
              style={{
                top: ringTop,
                left: ringLeft,
                transform: 'translate(-50%, -50%)',
                zIndex: REPLAYER_LAYERS.positionLabels,
                pointerEvents: 'none',
              }}
            >
              <span style={{
                fontSize: effectConfig.positionLabelFontSize, fontWeight: 800, lineHeight: 1,
                color: isBtn ? '#f5e17a' : isHero ? '#bbf7d0' : '#d4c89a',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8)',
              }}>{label}</span>
            </div>
          );
        }

        // Desktop: full badge styling (unchanged)
        const fs = mini ? 11 : variant === 'embedded' ? 9 : 13;
        const pad = mini ? '3px 8px' : variant === 'embedded' ? '2px 6px' : '4px 11px';

        return (
          <div
            key={`pos-${hand.title ?? 'h'}-${entry.seatIndex}`}
            className="absolute position-tag--desktop"
            style={{
              top: ringTop,
              left: ringLeft,
              transform: 'translate(-50%, -50%)',
              zIndex: REPLAYER_LAYERS.positionLabels,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              display: 'inline-block',
              fontSize: fs, fontWeight: 900, lineHeight: 1.1,
              color: isBtn ? '#f5e17a' : isHero ? '#bbf7d0' : labelColor,
              letterSpacing: '0.04em',
              textShadow: isBtn
                ? '0 0 8px rgba(245,225,120,0.5)'
                : isHero
                  ? '0 0 6px rgba(74,222,128,0.4)'
                  : `0 0 6px ${labelColor}66`,
              padding: pad,
              borderRadius: 6,
              background: isBtn
                ? 'rgba(245,225,120,0.15)'
                : isHero
                  ? 'rgba(74,222,128,0.12)'
                  : `${labelColor}1a`,
              border: `1px solid ${
                isBtn
                  ? 'rgba(245,225,120,0.45)'
                  : isHero
                    ? 'rgba(74,222,128,0.35)'
                    : `${labelColor}40`
              }`,
              whiteSpace: 'nowrap',
            }}>{label}</div>
          </div>
        );
      })}

      {/* ── Debug overlay (dev-only, ?replayerDebug=1) ── */}
      {showDebug && seatEntries.map((entry) => (
        <DebugBadge
          key={`dbg-${hand.title ?? 'h'}-${entry.seatIndex}`}
          x={entry.pos.left}
          y={entry.pos.top}
          label={`S${entry.seatIndex} ${entry.player.position ?? '—'}`}
        />
      ))}

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes pulse-ring {
          0%   { opacity: 0.9; transform: scale(1);    }
          50%  { opacity: 0.2; transform: scale(1.07); }
          100% { opacity: 0.9; transform: scale(1);    }
        }
        @keyframes winner-pulse {
          0%   { opacity: 0;   transform: scale(0.88); }
          25%  { opacity: 0.9; transform: scale(1.0);  }
          75%  { opacity: 0.5; transform: scale(1.05); }
          100% { opacity: 0;   transform: scale(1.12); }
        }
        @keyframes action-pop {
          0%   { opacity: 0; transform: scale(0.7) translateY(5px);  }
          60%  { opacity: 1; transform: scale(1.06) translateY(-1px); }
          100% { opacity: 1; transform: scale(1) translateY(0);       }
        }
        @keyframes deal-in {
          0%   { opacity: 0; transform: scale(0.45) translateY(-24px) rotate(-10deg); }
          65%  { opacity: 1; transform: scale(1.05) translateY(2px) rotate(1.5deg);  }
          100% { opacity: 1; transform: scale(1) translateY(0) rotate(0deg);         }
        }
        @keyframes showdown-drop {
          0%   { opacity: 0; transform: translateY(16px) scale(0.92); }
          60%  { opacity: 1; transform: translateY(-3px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1);       }
        }
        @keyframes showdown-fade {
          0%   { opacity: 0; transform: translateY(16px) scale(0.92); }
          15%  { opacity: 1; transform: translateY(0) scale(1);       }
          80%  { opacity: 1; transform: translateY(0) scale(1);       }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        /* ── Mobile-safe fallback: disable decorative animations for stable compositing ── */
        @media (max-width: 767px) {
          .sv-pulse-ring { animation: none !important; }
          .sv-winner-pulse { animation: none !important; }
          .sv-action-pop { animation: none !important; opacity: 1 !important; transform: none !important; }
          .sv-deal-in { animation: none !important; opacity: 1 !important; transform: none !important; }
          .sv-showdown-drop { animation: none !important; opacity: 1 !important; transform: none !important; }
          .sv-showdown-fade { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
