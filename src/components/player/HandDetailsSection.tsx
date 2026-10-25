import { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { MiniPlayingCard, PokerCardGroup, SUIT_SYMBOL } from './MiniPlayingCard';
import { renderCardNotationText, renderInlineCardText } from './InlinePlayingCard';

const GOLD = '#d4a52c';

const ASCII_CARD_PATTERN = /(?<![A-Za-z0-9])((?:[AKQJT2-9][shdc])+)(?![A-Za-z0-9])/gi;
const SYMBOL_CARD_PATTERN = /(?<![A-Za-z0-9])((?:[AKQJT2-9][♠♥♦♣])+)(?![A-Za-z0-9])/gi;

function extractCards(text: string): string[] {
  const asciiCards = [...text.matchAll(ASCII_CARD_PATTERN)].flatMap((match) =>
    match[1].match(/[AKQJT2-9][shdc]/gi) ?? [],
  );
  const symbolCards = [...text.matchAll(SYMBOL_CARD_PATTERN)].flatMap((match) =>
    (match[1].match(/[AKQJT2-9][♠♥♦♣]/g) ?? []).map((card) =>
      `${card[0]}${({ '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' } as Record<string, string>)[card[1]]}`,
    ),
  );
  return [...asciiCards, ...symbolCards];
}

function parseHandDetails(text: string): {
  meta: { label: string; value: string }[];
  heroCards: string[];
  boardCards: string[];
  streetSections: { label: string; cards: string[]; lines: string[] }[];
  rawLines: string[];
} {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const meta: { label: string; value: string }[] = [];
  const streetSections: { label: string; cards: string[]; lines: string[] }[] = [];
  let heroCards: string[] = [];
  let boardCards: string[] = [];
  const rawLines: string[] = [];

  const STREET_NAMES = ['PREFLOP', 'PRE-FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
  const META_PREFIXES = ['Game:', 'Positions:', 'Hero Hand:', 'Board:', 'Pot Type:', 'Stack Depth:', 'Context:',
    'Tournament:', 'Stage:', 'Blinds:', 'Effective Stacks:', 'Stakes:', 'Buy-in:', 'Format:'];

  let currentStreet: { label: string; cards: string[]; lines: string[] } | null = null;

  for (const line of lines) {
    rawLines.push(line);
    const upper = line.toUpperCase();

    if (STREET_NAMES.some(s => upper === s || upper.startsWith(s + ':'))) {
      if (currentStreet) streetSections.push(currentStreet);
      const label = upper.replace(':', '');
      currentStreet = { label, cards: [], lines: [] };
      continue;
    }

    const metaPrefix = META_PREFIXES.find(p => line.startsWith(p));
    if (metaPrefix) {
      const value = line.slice(metaPrefix.length).trim();
      const label = metaPrefix.replace(':', '');
      meta.push({ label, value });

      if (label === 'Hero Hand') {
        heroCards = extractCards(value);
      }
      if (label === 'Board') {
        boardCards = extractCards(value);
      }
      continue;
    }

    if (currentStreet) {
      const cards = extractCards(line);
      if (cards.length > 0 && currentStreet.cards.length === 0) {
        currentStreet.cards = cards;
      }
      currentStreet.lines.push(line);
    } else {
      const cards = extractCards(line);
      if (cards.length > 0 && heroCards.length === 0) {
        heroCards = cards;
      }
    }
  }

  if (currentStreet) streetSections.push(currentStreet);

  return { meta, heroCards, boardCards, streetSections, rawLines };
}

function renderTextWithCards(text: string): React.ReactNode {
  if (SYMBOL_CARD_PATTERN.test(text)) {
    SYMBOL_CARD_PATTERN.lastIndex = 0;
    return renderCardNotationText(text);
  }

  ASCII_CARD_PATTERN.lastIndex = 0;
  const asciiMatches = [...text.matchAll(ASCII_CARD_PATTERN)];
  const cardOnlyLine = text.trim().match(/^(?:[AKQJT2-9][shdc])+(?:[,.!?])?$/i);
  const cardContext = /\b(?:hand|cards?|board|flop|turn|river|revealed|showdown)\b/i.test(text);
  const hasCardSequence = asciiMatches.some((match) => match[1].length > 2);
  if (asciiMatches.length === 0 || (!cardOnlyLine && !cardContext && !hasCardSequence)) return text;

  const parts = text.split(ASCII_CARD_PATTERN);
  if (parts.length <= 1) return text;

  const result: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) result.push(parts[i]);
    } else {
      const cards = parts[i].match(/[AKQJT2-9][shdc]/gi) ?? [];
      cards.forEach((card, cardIndex) => {
        result.push(
          <span key={`card-${i}-${cardIndex}`} className="inline-flex align-middle" style={{ margin: '0 1px' }}>
            <MiniPlayingCard rank={card[0]} suit={card[1]} size="small" />
          </span>
        );
      });
    }
  }
  return result;
}

export function HandDetailsSection({ handDetails }: { handDetails: string }) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseHandDetails(handDetails);
  const subtitleParts: string[] = [];
  const gameMeta = parsed.meta.find(m => m.label === 'Game');
  const stakesMeta = parsed.meta.find(m => m.label === 'Blinds' || m.label === 'Stakes');
  const formatMeta = parsed.meta.find(m => m.label === 'Format' || m.label === 'Pot Type');
  const stageMeta = parsed.meta.find(m => m.label === 'Stage');
  if (gameMeta) subtitleParts.push(gameMeta.value);
  if (formatMeta) subtitleParts.push(formatMeta.value);
  if (stakesMeta) subtitleParts.push(stakesMeta.value);
  if (stageMeta) subtitleParts.push(stageMeta.value);
  const subtitle = subtitleParts.join(' \u2022 ');

  return (
    <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
        <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Hand Details</span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
        {subtitle && (
          <span className="ml-1 truncate text-[9px] font-medium text-white/25">{subtitle}</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] px-4 py-3">
          {/* Meta info */}
          {parsed.meta.length > 0 && (
            <div className="mb-3 flex flex-col gap-1">
              {parsed.meta.map((m, i) => (
                <div key={i} className="flex items-baseline gap-2 text-[11px]">
                  <span className="shrink-0 font-bold tracking-wide text-white/35 uppercase">{m.label}</span>
                  <span className="text-white/60">{renderTextWithCards(m.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hero hole cards */}
          {parsed.heroCards.length > 0 && (
            <div className="mb-3">
              <span className="mb-1.5 block text-[9px] font-bold tracking-widest text-white/40 uppercase">Hero Hand</span>
              <PokerCardGroup cards={parsed.heroCards} size="small" />
            </div>
          )}

          {/* Board cards (from meta) */}
          {parsed.boardCards.length > 0 && (
            <div className="mb-3">
              <span className="mb-1.5 block text-[9px] font-bold tracking-widest text-white/40 uppercase">Board</span>
              <PokerCardGroup cards={parsed.boardCards} size="small" />
            </div>
          )}

          {/* Street sections */}
          {parsed.streetSections.map((s, i) => (
            <div key={i} className="mb-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{s.label}</span>
                {s.cards.length > 0 && <PokerCardGroup cards={s.cards} size="small" />}
              </div>
              {s.lines.length > 0 && (
                <div className="ml-0 flex flex-col gap-0.5">
                  {s.lines.map((line, j) => (
                    <div key={j} className="text-[11px] leading-relaxed text-white/55">
                      {renderTextWithCards(line)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Fallback: raw text if nothing parsed */}
          {parsed.meta.length === 0 && parsed.streetSections.length === 0 && parsed.heroCards.length === 0 && (
            <div className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-white/60">{renderInlineCardText(handDetails)}</div>
          )}
        </div>
      )}
    </div>
  );
}

export { SUIT_SYMBOL };
