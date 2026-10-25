// Entry-level tournament data model for the Poker Data Sync demo.
// Each entry (bullet) is a distinct record. Re-entries count as new tournaments.
// TOTAL TOURNAMENTS = entries.length, NOT unique events.

export interface TournamentEntry {
  entryId: string;          // unique internal id per bullet
  eventId: string;          // tournament/event id (shared across re-entries)
  eventName: string;
  site: string;
  buyIn: number;
  bullet: number;           // 1 = first entry, 2 = first re-entry, etc.
  finish: number | null;     // null = bust, no cash
  cash: number;              // 0 if no cash
  registeredAt: string;      // ISO timestamp
  bustedAt: string | null;   // ISO timestamp
  hhFile?: string;
  summaryFile?: string;
  matchStatus: 'matched' | 'needs_review' | 'missing';
}

// 10 unique events, 14 entries (4 re-entries).
// Event 1 ($525 High Roller): 3 entries (2 re-entries)
// Event 4 ($530 WSOP Circuit Ring): 2 entries (1 re-entry)
// Event 10 ($530 High Roller III): 2 entries (1 re-entry)
export const DEMO_ENTRIES: TournamentEntry[] = [
  { entryId: 'E1-B1', eventId: 'EV-1001', eventName: '$525 High Roller', site: 'GGPoker', buyIn: 525, bullet: 1, finish: null, cash: 0, registeredAt: '2026-08-10T19:00:00Z', bustedAt: '2026-08-10T21:14:00Z', hhFile: 'HR_EV-1001_B1.txt', summaryFile: 'SUM_EV-1001_B1.txt', matchStatus: 'matched' },
  { entryId: 'E1-B2', eventId: 'EV-1001', eventName: '$525 High Roller', site: 'GGPoker', buyIn: 525, bullet: 2, finish: null, cash: 0, registeredAt: '2026-08-10T21:30:00Z', bustedAt: '2026-08-10T23:42:00Z', hhFile: 'HR_EV-1001_B2.txt', summaryFile: 'SUM_EV-1001_B2.txt', matchStatus: 'matched' },
  { entryId: 'E1-B3', eventId: 'EV-1001', eventName: '$525 High Roller', site: 'GGPoker', buyIn: 525, bullet: 3, finish: 1, cash: 12000, registeredAt: '2026-08-11T00:05:00Z', bustedAt: null, hhFile: 'HR_EV-1001_B3.txt', summaryFile: 'SUM_EV-1001_B3.txt', matchStatus: 'matched' },
  { entryId: 'E2-B1', eventId: 'EV-1002', eventName: '$109 Sunday Warm-Up', site: 'PokerStars', buyIn: 109, bullet: 1, finish: null, cash: 0, registeredAt: '2026-08-09T18:00:00Z', bustedAt: '2026-08-09T20:22:00Z', hhFile: 'SW_EV-1002_B1.txt', summaryFile: 'SUM_EV-1002_B1.txt', matchStatus: 'matched' },
  { entryId: 'E3-B1', eventId: 'EV-1003', eventName: '$215 Bounty Builder', site: 'PokerStars', buyIn: 215, bullet: 1, finish: 14, cash: 420, registeredAt: '2026-08-08T19:00:00Z', bustedAt: '2026-08-08T23:10:00Z', hhFile: 'BB_EV-1003_B1.txt', summaryFile: 'SUM_EV-1003_B1.txt', matchStatus: 'matched' },
  { entryId: 'E4-B1', eventId: 'EV-1004', eventName: '$530 WSOP Circuit Ring', site: 'GGPoker', buyIn: 530, bullet: 1, finish: null, cash: 0, registeredAt: '2026-08-07T17:00:00Z', bustedAt: '2026-08-07T19:45:00Z', hhFile: 'WSOP_EV-1004_B1.txt', summaryFile: 'SUM_EV-1004_B1.txt', matchStatus: 'matched' },
  { entryId: 'E4-B2', eventId: 'EV-1004', eventName: '$530 WSOP Circuit Ring', site: 'GGPoker', buyIn: 530, bullet: 2, finish: 1, cash: 4200, registeredAt: '2026-08-07T20:00:00Z', bustedAt: null, hhFile: 'WSOP_EV-1004_B2.txt', summaryFile: 'SUM_EV-1004_B2.txt', matchStatus: 'matched' },
  { entryId: 'E5-B1', eventId: 'EV-1005', eventName: '$109 GGPoker Sunday Main', site: 'GGPoker', buyIn: 109, bullet: 1, finish: 2, cash: 1850, registeredAt: '2026-08-06T18:00:00Z', bustedAt: null, hhFile: 'SM_EV-1005_B1.txt', summaryFile: 'SUM_EV-1005_B1.txt', matchStatus: 'matched' },
  { entryId: 'E6-B1', eventId: 'EV-1006', eventName: '$215 Omaholic', site: 'GGPoker', buyIn: 215, bullet: 1, finish: 47, cash: 0, registeredAt: '2026-08-05T19:00:00Z', bustedAt: '2026-08-05T22:30:00Z', hhFile: 'OM_EV-1006_B1.txt', summaryFile: 'SUM_EV-1006_B1.txt', matchStatus: 'matched' },
  { entryId: 'E7-B1', eventId: 'EV-1007', eventName: '$525 High Roller II', site: 'GGPoker', buyIn: 525, bullet: 1, finish: null, cash: 0, registeredAt: '2026-08-04T19:00:00Z', bustedAt: '2026-08-04T21:50:00Z', hhFile: 'HR2_EV-1007_B1.txt', summaryFile: 'SUM_EV-1007_B1.txt', matchStatus: 'matched' },
  { entryId: 'E8-B1', eventId: 'EV-1008', eventName: '$109 Mini Milly', site: 'PokerStars', buyIn: 109, bullet: 1, finish: null, cash: 0, registeredAt: '2026-08-03T18:00:00Z', bustedAt: '2026-08-03T20:15:00Z', hhFile: 'MM_EV-1008_B1.txt', summaryFile: 'SUM_EV-1008_B1.txt', matchStatus: 'matched' },
  { entryId: 'E9-B1', eventId: 'EV-1009', eventName: '$215 Daily Special', site: 'GGPoker', buyIn: 215, bullet: 1, finish: 6, cash: 680, registeredAt: '2026-08-02T19:00:00Z', bustedAt: '2026-08-02T23:40:00Z', hhFile: 'DS_EV-1009_B1.txt', summaryFile: 'SUM_EV-1009_B1.txt', matchStatus: 'matched' },
  { entryId: 'E10-B1', eventId: 'EV-1010', eventName: '$530 High Roller III', site: 'GGPoker', buyIn: 530, bullet: 1, finish: null, cash: 0, registeredAt: '2026-08-01T19:00:00Z', bustedAt: '2026-08-01T21:20:00Z', hhFile: 'HR3_EV-1010_B1.txt', summaryFile: 'SUM_EV-1010_B1.txt', matchStatus: 'matched' },
  { entryId: 'E10-B2', eventId: 'EV-1010', eventName: '$530 High Roller III', site: 'GGPoker', buyIn: 530, bullet: 2, finish: 3, cash: 2100, registeredAt: '2026-08-01T21:35:00Z', bustedAt: null, hhFile: 'HR3_EV-1010_B2.txt', summaryFile: 'SUM_EV-1010_B2.txt', matchStatus: 'matched' },
];

export interface SyncSummary {
  totalEntries: number;
  uniqueEvents: number;
  reEntries: number;
  totalBuyIns: number;
  totalCashes: number;
  profit: number;
  roi: number;
  abi: number;
  itm: number;
  finalTables: number;
  wins: number;
  handsParsed: number;
  summariesMatched: number;
  summariesTotal: number;
  needsReview: number;
}

export function computeSyncSummary(entries: TournamentEntry[]): SyncSummary {
  const totalEntries = entries.length;
  const uniqueEvents = new Set(entries.map((e) => e.eventId)).size;
  const reEntries = totalEntries - uniqueEvents;
  const totalBuyIns = entries.reduce((s, e) => s + e.buyIn, 0);
  const totalCashes = entries.reduce((s, e) => s + e.cash, 0);
  const profit = totalCashes - totalBuyIns;
  const roi = totalBuyIns > 0 ? (profit / totalBuyIns) * 100 : 0;
  const abi = totalEntries > 0 ? totalBuyIns / totalEntries : 0;
  const cashed = entries.filter((e) => e.cash > 0).length;
  const itm = totalEntries > 0 ? (cashed / totalEntries) * 100 : 0;
  const finalTables = entries.filter((e) => e.finish !== null && e.finish <= 9).length;
  const wins = entries.filter((e) => e.finish === 1).length;
  const handsParsed = 8421;
  const summariesMatched = entries.filter((e) => e.matchStatus === 'matched').length;
  const summariesTotal = entries.length;
  const needsReview = entries.filter((e) => e.matchStatus === 'needs_review').length;

  return {
    totalEntries,
    uniqueEvents,
    reEntries,
    totalBuyIns,
    totalCashes,
    profit,
    roi,
    abi,
    itm,
    finalTables,
    wins,
    handsParsed,
    summariesMatched,
    summariesTotal,
    needsReview,
  };
}

export function formatCurrency(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

export function formatPlainCurrency(n: number): string {
  return `$${n.toLocaleString()}`;
}
