// Demo analytics data — emptied so an empty database produces proper empty states.
// All stat objects retain their original field shapes (zeroed) so TypeScript
// inferred types remain compatible with consumers.

export type AnalyticsMode = 'cash' | 'mtt' | 'all';

// ── MTT Demo Stats ──
export const DEMO_MTT_STATS = {
  hands: 0,
  bbWon: 0,
  bb100: 0,
  evBb100: 0,
  vpip: 0,
  pfr: 0,
  threeBet: 0,
  tournaments: 0,
  profit: 0,
  roi: 0,
  abi: 0,
  itm: 0,
  finalTables: 0,
  wins: 0,
  wtsd: 0,
  wsd: 0,
  wwsf: 0,
  spi: 0,
  vpipCount: 0,
  pfrCount: 0,
  threeBetCount: 0,
  threeBetOppCount: 0,
  wtsdCount: 0,
  wsdCount: 0,
  showdownCount: 0,
  wwsfCount: 0,
  sawFlopCount: 0,
  cbetFlop: 0,
  cbetFlopCount: 0,
  cbetFlopOppCount: 0,
  barrelTurn: 0,
  barrelTurnCount: 0,
  barrelTurnOppCount: 0,
  barrelRiver: 0,
  barrelRiverCount: 0,
  barrelRiverOppCount: 0,
  activeDays: 0,
  avgPot: 0,
};

// ── Cash Demo Stats ──
export const DEMO_CASH_STATS = {
  hands: 0,
  bbWon: 0,
  bb100: 0,
  evBb100: 0,
  vpip: 0,
  pfr: 0,
  threeBet: 0,
  profit: 0,
  wtsd: 0,
  wsd: 0,
  wwsf: 0,
  spi: 0,
  vpipCount: 0,
  pfrCount: 0,
  threeBetCount: 0,
  threeBetOppCount: 0,
  wtsdCount: 0,
  wsdCount: 0,
  showdownCount: 0,
  wwsfCount: 0,
  sawFlopCount: 0,
  cbetFlop: 0,
  cbetFlopCount: 0,
  cbetFlopOppCount: 0,
  barrelTurn: 0,
  barrelTurnCount: 0,
  barrelTurnOppCount: 0,
  barrelRiver: 0,
  barrelRiverCount: 0,
  barrelRiverOppCount: 0,
  activeDays: 0,
  avgPot: 0,
  hours: 0,
  sessions: 0,
};

// ── ALL (blended) Demo Stats ──
export const DEMO_ALL_STATS = {
  hands: 0,
  bbWon: 0,
  bb100: 0,
  evBb100: 0,
  vpip: 0,
  pfr: 0,
  threeBet: 0,
  profit: 0,
  wtsd: 0,
  wsd: 0,
  wwsf: 0,
  spi: 0,
  vpipCount: 0,
  pfrCount: 0,
  threeBetCount: 0,
  threeBetOppCount: 0,
  wtsdCount: 0,
  wsdCount: 0,
  showdownCount: 0,
  wwsfCount: 0,
  sawFlopCount: 0,
  cbetFlop: 0,
  cbetFlopCount: 0,
  cbetFlopOppCount: 0,
  barrelTurn: 0,
  barrelTurnCount: 0,
  barrelTurnOppCount: 0,
  barrelRiver: 0,
  barrelRiverCount: 0,
  barrelRiverOppCount: 0,
  activeDays: 0,
  avgPot: 0,
  tournaments: 0,
  finalTables: 0,
  wins: 0,
  roi: 0,
  abi: 0,
  itm: 0,
};

// ── Graph Series ──

export interface GraphPoint {
  index: number;
  hands: number;
  total: number;
  ev: number;
  showdown: number;
  nonShowdown: number;
}

export const DEMO_GRAPH_MTT: GraphPoint[] = [];
export const DEMO_GRAPH_CASH: GraphPoint[] = [];
export const DEMO_GRAPH_ALL: GraphPoint[] = [];

export function getDemoGraph(mode: AnalyticsMode): GraphPoint[] {
  if (mode === 'cash') return DEMO_GRAPH_CASH;
  if (mode === 'mtt') return DEMO_GRAPH_MTT;
  return DEMO_GRAPH_ALL;
}

export function getDemoStats(mode: AnalyticsMode) {
  if (mode === 'cash') return DEMO_CASH_STATS;
  if (mode === 'mtt') return DEMO_MTT_STATS;
  return DEMO_ALL_STATS;
}

// ── Position Performance (per mode) ──
export const DEMO_POSITIONS_MTT: { position: string; bb100: number; hands: number }[] = [];

export const DEMO_POSITIONS_CASH: { position: string; bb100: number; hands: number }[] = [];

export const DEMO_POSITIONS_ALL: { position: string; bb100: number; hands: number }[] = [];

export function getDemoPositions(mode: AnalyticsMode) {
  if (mode === 'cash') return DEMO_POSITIONS_CASH;
  if (mode === 'mtt') return DEMO_POSITIONS_MTT;
  return DEMO_POSITIONS_ALL;
}

// ── Tournament Stats (MTT only) ──
export const DEMO_TOURNAMENT_STATS = {
  tournaments: 0,
  profit: 0,
  roi: 0,
  abi: 0,
  itm: 0,
  finalTables: 0,
  wins: 0,
  biggestScore: '',
  buyIns: '',
  cashes: '',
  profitLoss: '',
};

// Legacy export for TournamentStatsWidget
export const DEMO_RECENT_PERFORMANCE: number[] = [];

// ── Stage Performance ──
export const DEMO_STAGES: { stage: string; bb100: number; color: string }[] = [];

// ── Recent Sessions ──
export const DEMO_SESSIONS: { date: string; stakes: string; hands: number; profit: string; bb100: string }[] = [];

// ── Leak / Insight Cards ──
export const DEMO_LEAKS: { title: string; value: string; type: 'strength' | 'leak' | 'insight' }[] = [];
