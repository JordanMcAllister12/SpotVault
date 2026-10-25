/**
 * Board normalization — 3-level hierarchy for board analysis.
 *
 * LEVEL 1 — GENERAL FAMILY: "KXY Rainbow" (highest rank + band placeholders)
 * LEVEL 2 — EXACT TEXTURE:   "K83 Rainbow" (suit-isomorphic, rank-exact)
 * LEVEL 3 — RAW BOARD:       "Ks 8d 3c"   (original cards, never modified)
 *
 * Rank band notation:
 *   X = ranks 6, 7, 8, 9
 *   Y = ranks 2, 3, 4, 5
 *   P = paired lower rank (e.g. K88 → KPP, Q44 → QPP)
 *   The defining/highest rank stays explicit (A, K, Q, J, T, etc.)
 *
 * Multi-tag structural classification (boards can have multiple tags).
 * Suited-rank relationship preserved for two-tone boards.
 */

const RANK_ORDER = '23456789TJQKA';
const RANK_INDEX: Record<string, number> = {};
for (let i = 0; i < RANK_ORDER.length; i++) RANK_INDEX[RANK_ORDER[i]] = i;

// X band: 6, 7, 8, 9 (indices 4-7)
const X_BAND_MIN = RANK_INDEX['6'];
const X_BAND_MAX = RANK_INDEX['9'];
// Y band: 2, 3, 4, 5 (indices 0-3)
const Y_BAND_MIN = RANK_INDEX['2'];
const Y_BAND_MAX = RANK_INDEX['5'];

export type SuitTexture = 'monotone' | 'two_tone' | 'rainbow';

export type StructuralTag =
  | 'connected' | 'highly_connected' | 'one_gap' | 'two_gap'
  | 'broadway_heavy' | 'wheel_type' | 'disconnected'
  | 'paired' | 'trips';

export type PairedStructure = 'none' | 'top_rank_paired' | 'lower_rank_paired' | 'trips';

export type SuitedRelationship = 'none' | 'high_middle' | 'high_low' | 'middle_low';

export interface BoardNormalization {
  originalBoard: string;
  exactTexture: string;
  generalFamily: string;
  suitTexture: SuitTexture;
  structuralTags: StructuralTag[];
  pairedStructure: PairedStructure;
  suitedRelationship: SuitedRelationship;
  highCard: string;
  isPaired: boolean;
  isTrips: boolean;
}

function parseBoard(boardStr: string | null): { rank: string; suit: string; rankIdx: number }[] {
  if (!boardStr) return [];
  const tokens = boardStr.trim().split(/\s+/).filter(t => /[2-9TJQKA][hdcs]/.test(t));
  return tokens.map(t => ({
    rank: t[0],
    suit: t[1],
    rankIdx: RANK_INDEX[t[0]] ?? -1,
  })).filter(c => c.rankIdx >= 0);
}

function classifySuitTexture(suits: string[]): SuitTexture {
  const unique = new Set(suits);
  if (unique.size === 1) return 'monotone';
  if (unique.size === 2) return 'two_tone';
  return 'rainbow';
}

function rankToBandChar(rankIdx: number): string {
  if (rankIdx >= X_BAND_MIN && rankIdx <= X_BAND_MAX) return 'X';
  if (rankIdx >= Y_BAND_MIN && rankIdx <= Y_BAND_MAX) return 'Y';
  return RANK_ORDER[rankIdx];
}

function classifyStructuralTags(
  sortedDesc: { rankIdx: number; rank: string }[],
  isPaired: boolean,
  isTrips: boolean,
): StructuralTag[] {
  const tags: StructuralTag[] = [];
  if (isTrips) return ['trips'];
  if (isPaired) return ['paired'];

  const r = sortedDesc.map(c => c.rankIdx);
  const gap1 = r[0] - r[1];
  const gap2 = r[1] - r[2];
  const maxGap = Math.max(gap1, gap2);

  const hasAce = r.includes(RANK_INDEX['A']);
  const lowCards = r.filter(ri => ri <= RANK_INDEX['5']).length;
  if (hasAce && lowCards >= 2) tags.push('wheel_type');

  const broadwayCount = r.filter(ri => ri >= RANK_INDEX['T']).length;
  if (broadwayCount >= 2) tags.push('broadway_heavy');

  if (gap1 <= 1 && gap2 <= 1) {
    tags.push('highly_connected');
    tags.push('connected');
  } else if (gap1 <= 2 && gap2 <= 2 && (gap1 <= 1 || gap2 <= 1)) {
    tags.push('connected');
    if (gap1 === 2 || gap2 === 2) tags.push('one_gap');
  } else if (gap1 === 2 && gap2 <= 1) {
    tags.push('one_gap');
  } else if (gap2 === 2 && gap1 <= 1) {
    tags.push('one_gap');
  } else if (gap1 === 3 && gap2 <= 2) {
    tags.push('two_gap');
  } else if (gap2 === 3 && gap1 <= 2) {
    tags.push('two_gap');
  } else if (maxGap >= 4) {
    tags.push('disconnected');
  } else {
    tags.push('disconnected');
  }

  return tags;
}

function classifyPairedStructure(
  isTrips: boolean,
  isPaired: boolean,
  sortedDesc: { rankIdx: number; rank: string }[],
): PairedStructure {
  if (isTrips) return 'trips';
  if (!isPaired) return 'none';
  if (sortedDesc[0].rank === sortedDesc[1].rank) return 'top_rank_paired';
  return 'lower_rank_paired';
}

function classifySuitedRelationship(
  suits: string[],
  suitTex: SuitTexture,
  sortedDesc: { rankIdx: number; rank: string; suit: string }[],
): SuitedRelationship {
  if (suitTex !== 'two_tone') return 'none';
  const s0 = sortedDesc[0].suit;
  const s1 = sortedDesc[1].suit;
  const s2 = sortedDesc[2].suit;
  if (s0 === s1 && s0 !== s2) return 'high_middle';
  if (s0 === s2 && s0 !== s1) return 'high_low';
  if (s1 === s2 && s1 !== s0) return 'middle_low';
  return 'none';
}

export function normalizeBoard(boardStr: string | null): BoardNormalization | null {
  const cards = parseBoard(boardStr);
  if (cards.length < 3) return null;

  const rankChars = cards.map(c => c.rank);
  const suits = cards.map(c => c.suit);

  const sortedDesc = [...cards].sort((a, b) => b.rankIdx - a.rankIdx);
  const highCard = sortedDesc[0].rank;

  const isTrips = rankChars[0] === rankChars[1] && rankChars[1] === rankChars[2];
  const isPaired = isTrips || rankChars[0] === rankChars[1] || rankChars[1] === rankChars[2] || rankChars[0] === rankChars[2];

  const suitTex = classifySuitTexture(suits);
  const structuralTags = classifyStructuralTags(sortedDesc, isPaired, isTrips);
  const pairedStructure = classifyPairedStructure(isTrips, isPaired, sortedDesc);
  const suitedRel = classifySuitedRelationship(suits, suitTex, sortedDesc as { rankIdx: number; rank: string; suit: string }[]);

  const suitLabel = suitTex === 'monotone' ? 'Monotone' : suitTex === 'two_tone' ? 'Two-Tone' : 'Rainbow';

  let exactTexture: string;
  let generalFamily: string;

  if (isTrips) {
    const tripRank = sortedDesc[0].rank;
    exactTexture = `${tripRank}${tripRank}${tripRank} ${suitLabel}`;
    // Trips: show exact rank repeated, no band placeholder needed
    generalFamily = `${tripRank}${tripRank}${tripRank} ${suitLabel}`;
  } else if (isPaired) {
    let pairRank: string;
    let kickerRank: string;
    if (rankChars[0] === rankChars[1]) { pairRank = rankChars[0]; kickerRank = rankChars[2]; }
    else if (rankChars[1] === rankChars[2]) { pairRank = rankChars[1]; kickerRank = rankChars[0]; }
    else { pairRank = rankChars[0]; kickerRank = rankChars[1]; }

    const pairIdx = RANK_INDEX[pairRank];
    const kickerIdx = RANK_INDEX[kickerRank];
    // Exact texture: higher rank first
    if (pairIdx >= kickerIdx) {
      exactTexture = `${pairRank}${pairRank}${kickerRank} ${suitLabel}`;
    } else {
      exactTexture = `${kickerRank}${pairRank}${pairRank} ${suitLabel}`;
    }

    // General family using band notation
    if (pairedStructure === 'top_rank_paired') {
      // QQ4 → QQY, KK8 → KKX, AA2 → AAY
      generalFamily = `${pairRank}${pairRank}${rankToBandChar(kickerIdx)} ${suitLabel}`;
    } else {
      // K88 → KPP, Q44 → QPP, A55 → APP
      // The pair rank gets P notation if it's in X or Y band
      const pairBandChar = rankToBandChar(pairIdx);
      if (pairBandChar === 'X' || pairBandChar === 'Y') {
        generalFamily = `${kickerRank}PP ${suitLabel}`;
      } else {
        // Pair rank is T or above but kicker is higher (shouldn't normally happen
        // since we sort pair first if pair >= kicker, but handle edge case)
        generalFamily = `${kickerRank}${pairRank}${pairRank} ${suitLabel}`;
      }
    }
  } else {
    // Non-paired: sort ranks descending for exact texture
    const dr = sortedDesc.map(c => c.rank);
    exactTexture = `${dr[0]}${dr[1]}${dr[2]} ${suitLabel}`;

    // General family: highest rank stays, lower two get band chars
    const midBand = rankToBandChar(sortedDesc[1].rankIdx);
    const lowBand = rankToBandChar(sortedDesc[2].rankIdx);
    generalFamily = `${dr[0]}${midBand}${lowBand} ${suitLabel}`;
  }

  return {
    originalBoard: boardStr ?? '',
    exactTexture,
    generalFamily,
    suitTexture: suitTex,
    structuralTags,
    pairedStructure,
    suitedRelationship: suitedRel,
    highCard,
    isPaired,
    isTrips,
  };
}

export function formatStructuralTag(tag: StructuralTag): string {
  const labels: Record<StructuralTag, string> = {
    connected: 'Connected',
    highly_connected: 'Highly Connected',
    one_gap: 'One-Gap',
    two_gap: 'Two-Gap',
    broadway_heavy: 'Broadway Heavy',
    wheel_type: 'Wheel-Type',
    disconnected: 'Disconnected',
    paired: 'Paired',
    trips: 'Trips',
  };
  return labels[tag];
}

export function formatSuitTexture(tex: SuitTexture): string {
  return tex === 'monotone' ? 'Monotone' : tex === 'two_tone' ? 'Two-Tone' : 'Rainbow';
}

export function formatPairedStructure(ps: PairedStructure): string {
  const labels: Record<PairedStructure, string> = {
    none: '',
    top_rank_paired: 'Top-Rank Paired',
    lower_rank_paired: 'Lower-Rank Paired',
    trips: 'Trips',
  };
  return labels[ps];
}

export function formatSuitedRelationship(sr: SuitedRelationship): string {
  const labels: Record<SuitedRelationship, string> = {
    none: '',
    high_middle: 'High+Middle Suited',
    high_low: 'High+Low Suited',
    middle_low: 'Middle+Low Suited',
  };
  return labels[sr];
}

/**
 * Parse a board class label into tiles for display.
 * Returns array of { char, isPlaceholder } for rendering abstract tiles.
 * X, Y, and P are placeholders; actual ranks are not.
 */
export function boardTilesFromClass(boardClass: string): { char: string; isPlaceholder: boolean }[] {
  const match = boardClass.match(/^([2-9TJQKAXYP]{1,3})\s+/);
  if (!match) return [{ char: '?', isPlaceholder: false }];
  const rankPart = match[1];
  return rankPart.split('').map(c => ({
    char: c,
    isPlaceholder: c === 'X' || c === 'Y' || c === 'P',
  }));
}

/**
 * Generate a representative board (3 cards) for a given exact texture label.
 * Used for exact texture display.
 */
export function representativeBoardForClass(boardClass: string): string[] {
  const match = boardClass.match(/^([2-9TJQKA]{1,3})\s+(Rainbow|Two-Tone|Monotone)$/);
  if (!match) return ['Ks', '8d', '3c'];
  const rankPart = match[1];
  const texture = match[2];
  const ranks = rankPart.split('');

  if (texture === 'Monotone') {
    return [`${ranks[0]}s`, `${ranks[1]}s`, `${ranks[2]}s`];
  } else if (texture === 'Two-Tone') {
    return [`${ranks[0]}s`, `${ranks[1]}s`, `${ranks[2]}d`];
  }
  return [`${ranks[0]}s`, `${ranks[1]}d`, `${ranks[2]}c`];
}

export const ALL_STRUCTURAL_TAGS: Array<{ key: StructuralTag; label: string }> = [
  { key: 'highly_connected', label: 'Highly Connected' },
  { key: 'connected', label: 'Connected' },
  { key: 'one_gap', label: 'One-Gap' },
  { key: 'two_gap', label: 'Two-Gap' },
  { key: 'broadway_heavy', label: 'Broadway Heavy' },
  { key: 'wheel_type', label: 'Wheel-Type' },
  { key: 'disconnected', label: 'Disconnected' },
  { key: 'paired', label: 'Paired' },
  { key: 'trips', label: 'Trips' },
];
