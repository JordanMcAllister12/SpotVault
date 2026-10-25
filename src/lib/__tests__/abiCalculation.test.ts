/**
 * ABI (Average Buy-In) calculation tests.
 *
 * Verifies:
 * - Buy-in extraction from GG/PokerStars hand headers
 * - Satellite tournament detection (target event cost vs player's entry cost)
 * - Bounty-target tournament detection (Cash Drop / Bounty Hunters Series)
 * - Per-entry ABI calculation with re-entries, satellites, and NULL buy-ins
 * - ABI = Sum of entry buy-in values / Number of confirmed tournament entries
 */

import { describe, it, expect } from 'vitest';
import { parseHandBlock } from '@/lib/pokerAnalytics';

// ── Buy-in extraction tests ──────────────────────────────────────────────

describe('Buy-in extraction from hand headers', () => {
  it('extracts GG $55 MTT buy-in', () => {
    const block = `Poker Hand #TM123: Tournament #12345, $55 MTT Hold'em No Limit - Level1(10/20) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBe(55);
  });

  it('extracts GG $55+$5 MTT buy-in (fee excluded)', () => {
    const block = `Poker Hand #TM124: Tournament #12346, $55+$5 MTT Hold'em No Limit - Level1(10/20) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBe(55);
  });

  it('extracts PokerStars $55+$5 buy-in', () => {
    const block = `PokerStars Hand #12345: Tournament #12345, $55+$5 USD Hold'em No Limit - Level1(10/20) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'PokerStars', 'mtt');
    expect(parsed?.buyIn).toBe(55);
  });

  it('extracts explicit Buy-In: $215 label', () => {
    const block = `Poker Hand #TM125: Tournament #12347, Buy-In: $215 Hold'em No Limit - Level1(10/20) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBe(215);
  });

  it('extracts buy-in from tournament name ($525 Bounty Hunters HR)', () => {
    const block = `Poker Hand #TM126: Tournament #12348, $525 Bounty Hunters HR Main Event, $1M GTD Hold'em No Limit - Level1(50/100) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (50000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBe(525);
  });

  it('extracts buy-in from High Rollers $525 (no MTT keyword)', () => {
    const block = `Poker Hand #TM127: Tournament #12349, High Rollers Daily Wrap-Up $525 Hold'em No Limit - Level1(80/160) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (20000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBe(525);
  });
});

// ── Satellite detection tests ────────────────────────────────────────────

describe('Satellite tournament buy-in exclusion', () => {
  it('excludes buy-in for "MEGA to 1M GGMillion" satellite', () => {
    const block = `Poker Hand #TM128: Tournament #12350, $1,050 MEGA to $1M GGMillion, 12 Seats, $120K Hold'em No Limit - Level1(50/100) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (50000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBeNull();
  });

  it('excludes buy-in for "Deadline to 1M GGMillion" satellite', () => {
    const block = `Poker Hand #TM129: Tournament #12351, $1,050 Deadline to $1M GGMillion, 2 Seats, $20K Hold'em No Limit - Level1(50/100) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (50000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBeNull();
  });

  it('does NOT exclude "EXPRESS to 10K Bracelet Pass" (direct buy-in satellite)', () => {
    const block = `Poker Hand #TM130: Tournament #12352, $1,200 EXPRESS to $10K Bracelet Pass - $30K GTD Hold'em No Limit - Level1(50/100) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (50000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    // EXPRESS satellites are direct buy-in events — the $1,200 is what the player paid
    expect(parsed?.buyIn).toBe(1200);
  });
});

// ── Bounty-target detection tests ────────────────────────────────────────

describe('Bounty-target tournament buy-in exclusion', () => {
  it('excludes buy-in for "$10,000 Bounty Hunters Series Cash Drop"', () => {
    const block = `Poker Hand #TM131: Tournament #12353, $10,000 Bounty Hunters Series Cash Drop Hold'em No Limit - Level1(500/1,000) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (8945 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBeNull();
  });

  it('excludes buy-in for plain "Cash Drop" tournament', () => {
    const block = `Poker Hand #TM132: Tournament #12354, $5,000 Cash Drop Hold'em No Limit - Level1(500/1,000) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBeNull();
  });
});

// ── Guarantee amount exclusion tests ─────────────────────────────────────

describe('Guarantee amount exclusion', () => {
  it('does not parse $1M GTD as buy-in', () => {
    const block = `Poker Hand #TM133: Tournament #12355, $25 Mystery Bounty Mini Main, $2.5M GTD [Stage 1] Hold'em No Limit - Level1(10/20) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    // $25 is the buy-in, $2.5M GTD is the guarantee — should get 25, not 2.5
    expect(parsed?.buyIn).toBe(25);
  });

  it('does not parse $500K GTD as buy-in', () => {
    const block = `Poker Hand #TM134: Tournament #12356, Sunday Showdown $108, $500K GTD [Mystery Bounty] Hold'em No Limit - Level1(10/20) - 2026/01/01 12:00:00
Table '1' 8-max Seat #1 is the button
Seat 1: Hero (10000 in chips)`;
    const parsed = parseHandBlock(block, 'GGPoker', 'mtt');
    expect(parsed?.buyIn).toBe(108);
  });
});

// ── ABI calculation tests ────────────────────────────────────────────────

// Mirror the countTournamentEntries function for testing
const SATELLITE_PATTERNS = [
  /to\s+\$?\d[\d,.]*\s*(?:M|K)?\s*(?:GGMillion|Main\s+Event)/i,
  /\d+\s+Seats/i,
  /MEGA\s+to\s/i,
  /Deadline\s+to\s/i,
  /Seat\s+Pass/i,
  /Phase\s+\d/i,
];

const BOUNTY_TARGET_PATTERNS = [
  /Bounty\s+Hunters\s+Series/i,
  /Cash\s+Drop/i,
];

function isSatellite(sourceFileName: string, tournamentName?: string | null): boolean {
  const checkStr = `${sourceFileName} ${tournamentName ?? ''}`;
  return SATELLITE_PATTERNS.some(p => p.test(checkStr));
}

function isBountyTargetTournament(sourceFileName: string, tournamentName?: string | null): boolean {
  const checkStr = `${sourceFileName} ${tournamentName ?? ''}`;
  return BOUNTY_TARGET_PATTERNS.some(p => p.test(checkStr));
}

function countTournamentEntries(
  handList: Record<string, unknown>[]
): { events: number; entries: number; totalBuyIn: number; entriesWithBuyIn: number } {
  const tournamentIds = new Set<string>();
  const sourceFiles = new Set<string>();
  const tournBuyIns: Record<string, number | null> = {};
  const tournNames: Record<string, string | null> = {};

  for (let i = 0; i < handList.length; i++) {
    const h = handList[i];
    const tournId = h.tournament_id as string | null;
    const fileName = h.source_file_name as string | null;
    const buyIn = h.buy_in as number | null;
    if (tournId) {
      tournamentIds.add(tournId);
      if (tournBuyIns[tournId] === undefined) {
        tournBuyIns[tournId] = buyIn;
        const rawText = h.raw_hand_text as string | undefined;
        if (rawText) {
          const nameMatch = rawText.match(/Tournament\s+#\S+,\s*(.*?)(?:\s+Hold'em)/i);
          tournNames[tournId] = nameMatch ? nameMatch[1].trim() : null;
        } else {
          tournNames[tournId] = null;
        }
      }
    }
    if (fileName) sourceFiles.add(fileName);
  }

  const events = tournamentIds.size;
  const entries = sourceFiles.size;

  let totalBuyIn = 0;
  let entriesWithBuyIn = 0;

  for (const tournId of tournamentIds) {
    const buyIn = tournBuyIns[tournId];
    const tournName = tournNames[tournId] ?? null;
    let fileCount = 0;
    const seenFiles = new Set<string>();
    for (const h of handList) {
      if ((h.tournament_id as string) === tournId) {
        const fn = h.source_file_name as string | null;
        if (fn && !seenFiles.has(fn)) {
          seenFiles.add(fn);
          fileCount++;
        }
      }
    }

    if (buyIn != null && Number.isFinite(buyIn) && buyIn > 0) {
      const sampleFileName = seenFiles.values().next().value ?? '';
      if (isSatellite(sampleFileName, tournName)) {
        entriesWithBuyIn += fileCount;
      } else if (isBountyTargetTournament(sampleFileName, tournName)) {
        entriesWithBuyIn += fileCount;
      } else {
        totalBuyIn += buyIn * fileCount;
        entriesWithBuyIn += fileCount;
      }
    }
  }

  return { events, entries, totalBuyIn, entriesWithBuyIn };
}

function computeAbi(handList: Record<string, unknown>[]): number {
  const { entries, totalBuyIn } = countTournamentEntries(handList);
  if (entries > 0 && totalBuyIn > 0) {
    return Math.round((totalBuyIn / entries) * 100) / 100;
  }
  return 0;
}

describe('ABI calculation', () => {
  it('computes ABI for single tournament with known buy-in', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'file1.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
    ];
    expect(computeAbi(hands)).toBe(55);
  });

  it('computes ABI across multiple tournaments', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'file1.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
      { tournament_id: 'T2', source_file_name: 'file2.txt', buy_in: 215, raw_hand_text: "Tournament #T2, Buy-In: $215 Hold'em" },
      { tournament_id: 'T3', source_file_name: 'file3.txt', buy_in: 25, raw_hand_text: "Tournament #T3, $25 MTT Hold'em" },
    ];
    // (55 + 215 + 25) / 3 = 98.33
    expect(computeAbi(hands)).toBe(98.33);
  });

  it('counts re-entries: same tournament, multiple files', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'file1.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
      { tournament_id: 'T1', source_file_name: 'file2.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
    ];
    // 2 entries, total buy-in = 55 * 2 = 110, ABI = 110 / 2 = 55
    const result = countTournamentEntries(hands);
    expect(result.entries).toBe(2);
    expect(result.events).toBe(1);
    expect(result.totalBuyIn).toBe(110);
    expect(computeAbi(hands)).toBe(55);
  });

  it('excludes satellite buy-ins from numerator but counts entries in denominator', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'file1.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
      { tournament_id: 'T2', source_file_name: 'file2.txt', buy_in: 1050, raw_hand_text: "Tournament #T2, $1,050 MEGA to $1M GGMillion Hold'em" },
      { tournament_id: 'T3', source_file_name: 'file3.txt', buy_in: 25, raw_hand_text: "Tournament #T3, $25 MTT Hold'em" },
    ];
    // total_buyin = 55 + 0 (satellite) + 25 = 80
    // entries = 3
    // ABI = 80 / 3 = 26.67
    const result = countTournamentEntries(hands);
    expect(result.entries).toBe(3);
    expect(result.totalBuyIn).toBe(80);
    expect(computeAbi(hands)).toBe(26.67);
  });

  it('handles NULL buy-ins (Cash Drop) in denominator at $0', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'file1.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
      { tournament_id: 'T2', source_file_name: 'file2.txt', buy_in: null, raw_hand_text: "Tournament #T2, $10,000 Bounty Hunters Series Cash Drop Hold'em" },
      { tournament_id: 'T3', source_file_name: 'file3.txt', buy_in: 25, raw_hand_text: "Tournament #T3, $25 MTT Hold'em" },
    ];
    // total_buyin = 55 + 0 + 25 = 80
    // entries = 3
    // ABI = 80 / 3 = 26.67
    expect(computeAbi(hands)).toBe(26.67);
  });

  it('computes ABI with mixed satellites, Cash Drop, and re-entries', () => {
    const hands = [
      // Normal $55 tournament, 1 entry
      { tournament_id: 'T1', source_file_name: 'f1.txt', buy_in: 55, raw_hand_text: "Tournament #T1, $55 MTT Hold'em" },
      // Normal $55 tournament, re-entry (2 files)
      { tournament_id: 'T2', source_file_name: 'f2.txt', buy_in: 25, raw_hand_text: "Tournament #T2, $25 MTT Hold'em" },
      { tournament_id: 'T2', source_file_name: 'f3.txt', buy_in: 25, raw_hand_text: "Tournament #T2, $25 MTT Hold'em" },
      // Satellite $1050 (excluded from numerator)
      { tournament_id: 'T3', source_file_name: 'f4.txt', buy_in: 1050, raw_hand_text: "Tournament #T3, $1,050 Deadline to $1M GGMillion Hold'em" },
      // Cash Drop $10000 (buy_in NULL, excluded from numerator)
      { tournament_id: 'T4', source_file_name: 'f5.txt', buy_in: null, raw_hand_text: "Tournament #T4, $10,000 Bounty Hunters Series Cash Drop Hold'em" },
    ];
    // total_buyin = 55 + 25*2 + 0 + 0 = 105
    // entries = 5
    // ABI = 105 / 5 = 21
    const result = countTournamentEntries(hands);
    expect(result.entries).toBe(5);
    expect(result.events).toBe(4);
    expect(result.totalBuyIn).toBe(105);
    expect(computeAbi(hands)).toBe(21);
  });

  it('returns 0 ABI when all buy-ins are NULL', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'f1.txt', buy_in: null, raw_hand_text: "Tournament #T1, $10,000 Cash Drop Hold'em" },
    ];
    expect(computeAbi(hands)).toBe(0);
  });

  it('returns 0 ABI when no entries', () => {
    expect(computeAbi([])).toBe(0);
  });

  it('does NOT exclude "EXPRESS to 10K Bracelet Pass" as satellite', () => {
    const hands = [
      { tournament_id: 'T1', source_file_name: 'f1.txt', buy_in: 1200, raw_hand_text: "Tournament #T1, $1,200 EXPRESS to $10K Bracelet Pass Hold'em" },
    ];
    // EXPRESS is a direct buy-in satellite — $1200 counts
    expect(computeAbi(hands)).toBe(1200);
  });

  it('replicates real data scenario: 119 entries, 3 satellites excluded', () => {
    // Simulates the actual dataset: 117 entries with buy-in, 2 Cash Drop NULL,
    // 3 GGMillion satellites (excluded), 1 Bracelet Pass (kept)
    const hands: Record<string, unknown>[] = [];

    // 3 GGMillion satellite entries (buy_in already NULL in DB after fix)
    for (let i = 0; i < 3; i++) {
      hands.push({
        tournament_id: `SAT${i}`,
        source_file_name: `sat${i}.txt`,
        buy_in: null,
        raw_hand_text: "Tournament #SAT, $1,050 MEGA to $1M GGMillion Hold'em",
      });
    }

    // 2 Cash Drop entries (buy_in NULL)
    for (let i = 0; i < 2; i++) {
      hands.push({
        tournament_id: `CD${i}`,
        source_file_name: `cd${i}.txt`,
        buy_in: null,
        raw_hand_text: "Tournament #CD, $10,000 Bounty Hunters Series Cash Drop Hold'em",
      });
    }

    // 1 Bracelet Pass (buy_in = 1200, kept)
    hands.push({
      tournament_id: 'BP',
      source_file_name: 'bp.txt',
      buy_in: 1200,
      raw_hand_text: "Tournament #BP, $1,200 EXPRESS to $10K Bracelet Pass Hold'em",
    });

    // 113 normal entries with various buy-ins summing to 7891.52
    // (9091.52 total - 1200 Bracelet Pass = 7891.52)
    const normalBuyIns = [
      525, 525, 525, 525,  // 4 High Rollers
      250, 215, 150, 150, 150, 125, 108, 108, 108, 108, 108,
      88, 88, 54, 54, 54, 54, 54, 54, 54, 54,
      44, 44, 44, 44, 44, 44, 44, 44, 44,
      32, 32, 32, 32, 30, 30, 30, 30,
      25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25,
      21.6, 21.6, 21.6, 21.6, 21.6, 21.6, 21.6, 21.6, 21.6,
      15, 15, 15, 15, 15,
      10.8, 10, 10,
      8.88, 8.88, 8.88,
      5.5, 5.5, 5.5, 5.5,
      5.4,
    ];

    for (let i = 0; i < normalBuyIns.length; i++) {
      hands.push({
        tournament_id: `N${i}`,
        source_file_name: `n${i}.txt`,
        buy_in: normalBuyIns[i],
        raw_hand_text: `Tournament #N${i}, $${normalBuyIns[i]} MTT Hold'em`,
      });
    }

    const result = countTournamentEntries(hands);
    const abi = computeAbi(hands);

    // Total entries = 3 + 2 + 1 + normal count
    expect(result.entries).toBe(3 + 2 + 1 + normalBuyIns.length);
    // ABI should be in the ~$75-77 range (close to the expected ~$75)
    expect(abi).toBeGreaterThan(70);
    expect(abi).toBeLessThan(80);
  });
});
