export interface ParsedHandMeta {
  handId: string;
  playedAt: string | null;
  streetCount: number;
}

export interface ParsedTournament {
  site: string | null;
  tournamentName: string | null;
  tournamentId: string | null;
  buyIn: string | null;
  playedAt: string | null;
  handCount: number;
  parsedCount: number;
  failedCount: number;
  hands: ParsedHandMeta[];
  handBlocks: { handId: string; rawText: string }[];
}

// Matches "Hand #123456789:" or "Poker Hand #TM6172973481:" etc.
// Also matches WPN/ACR "Game Hand #2533390117" (no colon, no "Poker" prefix).
const HAND_HEADER_RE = /^(?:Poker\s+)?(?:Game\s+)?Hand #([A-Za-z0-9]+)(?::|$)/m;

export function splitTournamentHands(rawText: string): string[] {
  const lines = rawText.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (HAND_HEADER_RE.test(line.trim()) && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join('\n'));

  return blocks.filter(b => b.trim().length > 0 && HAND_HEADER_RE.test(b));
}

export function parseTournamentMetadata(rawText: string): ParsedTournament {
  const handBlocks = splitTournamentHands(rawText);

  let site: string | null = null;
  let tournamentName: string | null = null;
  let tournamentId: string | null = null;
  let buyIn: string | null = null;
  let playedAt: string | null = null;

  const firstBlock = handBlocks[0] ?? rawText;
  const headerLines = firstBlock.split('\n').slice(0, 6);

  for (const line of headerLines) {
    const trimmed = line.trim();

    const siteMatch = trimmed.match(/^(PokerStars|GGPoker|888poker|Winamax\.fr|PartyPoker|PokerKing|Natural8|Game Hand)/i);
    if (siteMatch && !site) {
      site = siteMatch[1].toLowerCase().includes('game') ? 'WPN' : siteMatch[1];
    }

    const tournMatch = trimmed.match(/Tournament #?(\d+)/i);
    if (tournMatch && !tournamentId) tournamentId = tournMatch[1];

    const tournNameMatch = trimmed.match(/Tournament #?\d+,?\s+(.+?)(?:\s+\$|,)/i);
    if (tournNameMatch && !tournamentName) tournamentName = tournNameMatch[1].trim();

    const buyInMatch = trimmed.match(/\$([\d,.]+)\s*(?:\+\s*\$([\d,.]+))?/);
    if (buyInMatch && !buyIn) {
      buyIn = buyInMatch[2] ? `$${buyInMatch[1]}+$${buyInMatch[2]}` : `$${buyInMatch[1]}`;
    }

    const dateMatch = trimmed.match(/(\d{4}\/\d{2}\/\d{2}\s+[\d:]+)/);
    if (dateMatch && !playedAt) playedAt = dateMatch[1].trim();
  }

  if (!site) {
    if (/PokerStars/i.test(rawText)) site = 'PokerStars';
    else if (/GGPoker/i.test(rawText)) site = 'GGPoker';
    else if (/Game Hand #/i.test(rawText)) site = 'WPN';
  }

  if (!playedAt) {
    const dateMatch = rawText.match(/(\d{4}\/\d{2}\/\d{2}\s+[\d:]+)/);
    if (dateMatch) playedAt = dateMatch[1].trim();
  }

  const hands: ParsedHandMeta[] = [];
  const handBlockData: { handId: string; rawText: string }[] = [];

  for (const block of handBlocks) {
    const idMatch = block.match(/(?:Poker\s+)?(?:Game\s+)?Hand #([A-Za-z0-9]+)(?::|$)/);
    const handId = idMatch ? idMatch[1] : `unknown-${hands.length + 1}`;

    const dateMatch = block.match(/(\d{4}\/\d{2}\/\d{2}\s+[\d:]+)/);
    const handDate = dateMatch ? dateMatch[1].trim() : null;

    const streetCount =
      (/\*\*\*\s+FLOP\s+\*\*\*/.test(block) ? 1 : 0) +
      (/\*\*\*\s+TURN\s+\*\*\*/.test(block) ? 1 : 0) +
      (/\*\*\*\s+RIVER\s+\*\*\*/.test(block) ? 1 : 0);

    hands.push({ handId, playedAt: handDate, streetCount });
    handBlockData.push({ handId, rawText: block });
  }

  return {
    site,
    tournamentName,
    tournamentId,
    buyIn,
    playedAt,
    handCount: handBlocks.length,
    parsedCount: handBlocks.length,
    failedCount: 0,
    hands,
    handBlocks: handBlockData,
  };
}
