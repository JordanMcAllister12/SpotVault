// ─── Replayer configuration: single source of truth for visual constants ───
// Mobile and desktop visual-effect values are kept separate so a desktop
// animation or transform can never silently apply to mobile (and vice versa).
// The rendered appearance must remain unchanged — these values mirror the
// previously inline conditionals that were approved as the mobile baseline.

export interface ReplayerEffectConfig {
  tableTilt: number;          // rotateX degrees on the perspective wrapper
  perspective: number;       // CSS perspective in px
  positionLabelRingScale: number; // fraction of seat radius for the label ring
  activeSeatAnimation: boolean;   // pulse-ring keyframe on the current actor
  chipTransformAnimation: boolean; // translate/scale chip enter/collect
  positionLabelFontSize: number;   // px — mobile uses compact text, desktop uses badges
  winnerPulseAnimation: boolean;   // winner-pulse keyframe ring
}

export const MOBILE_REPLAYER_CONFIG: ReplayerEffectConfig = {
  tableTilt: 0,
  perspective: 0,
  positionLabelRingScale: 0.52,
  activeSeatAnimation: false,
  chipTransformAnimation: false,
  positionLabelFontSize: 8,
  winnerPulseAnimation: false,
};

export const DESKTOP_REPLAYER_CONFIG: ReplayerEffectConfig = {
  tableTilt: 22, // full variant; embedded/compact override below
  perspective: 900,
  positionLabelRingScale: 0.62,
  activeSeatAnimation: true,
  chipTransformAnimation: true,
  positionLabelFontSize: 13,
  winnerPulseAnimation: true,
};

// Desktop tilt varies by variant — resolve at call site, not here, since the
// config object is for effect behavior only. The PokerTable component picks
// the right tilt from variant + mode.

export function getEffectConfig(mobile: boolean): ReplayerEffectConfig {
  return mobile ? MOBILE_REPLAYER_CONFIG : DESKTOP_REPLAYER_CONFIG;
}

// ─── Named z-index layers ───────────────────────────────────────────────────
// One source of truth for stacking. No element should use a raw z-index that
// isn't defined here. Layers are ordered so higher layers always paint above
// lower ones — felt < seats < cards < bets < dealer < labels < pot < controls.
export const REPLAYER_LAYERS = {
  felt: 0,          // table surface, chairs, rails
  seats: 3,         // player nameplates (non-current)
  heroSeat: 6,      // hero nameplate sits above other seats
  cards: 1,         // hole cards (within seat wrapper)
  bets: 5,          // chip stacks for bets/blinds
  allInBadge: 16,   // ALL IN overlay
  dealerButton: 20, // dealer button disc
  positionLabels: 8, // BTN/SB/BB ring labels
  activeSeat: 12,   // current actor nameplate
  actionBadge: 14,  // fold/call/raise badge
  pot: 30,          // pot-award / showdown message
  controls: 40,     // playback controls (rendered outside the table)
} as const;

export type ReplayerLayer = keyof typeof REPLAYER_LAYERS;
