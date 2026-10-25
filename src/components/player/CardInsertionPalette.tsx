import { useCallback, useEffect, useRef, useState } from 'react';
import { Spade, Heart, Diamond, Club, X, Check, Layers } from 'lucide-react';
import { CARD_RANKS, CARD_SUITS, SUIT_SYMBOLS } from '@/lib/poker/builderTypes';
import { createInlineCardFragment } from '@/components/player/InlinePlayingCard';
import { MiniPlayingCard } from '@/components/player/MiniPlayingCard';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

const SUIT_ICONS: Record<string, typeof Spade> = { s: Spade, h: Heart, d: Diamond, c: Club };
const SUIT_IS_RED: Record<string, boolean> = { s: false, h: true, d: true, c: false };
const PALETTE_SUIT_ORDER: readonly string[] = ['s', 'h', 'd', 'c'] as const;

type PaletteContext = 'free' | 'hole-cards' | 'flop' | 'turn' | 'river';

const CONTEXT_CONFIG: Record<PaletteContext, { max: number; label: string }> = {
  'free': { max: 5, label: 'Free Text' },
  'hole-cards': { max: 2, label: 'Hole Cards' },
  'flop': { max: 3, label: 'Flop' },
  'turn': { max: 1, label: 'Turn' },
  'river': { max: 1, label: 'River' },
};

const CONTEXT_ORDER: PaletteContext[] = ['free', 'hole-cards', 'flop', 'turn', 'river'];

const SUIT_SYMBOL_TO_LETTER: Record<string, string> = {
  '\u2660': 's', '\u2665': 'h', '\u2666': 'd', '\u2663': 'c',
};

const CARD_PATTERN = /([2-9TJQKA])([shdc\u2660\u2665\u2666\u2663])/gi;

export function parseCardsFromText(text: string): string[] {
  if (!text) return [];
  const cards: string[] = [];
  const matches = text.matchAll(CARD_PATTERN);
  for (const match of matches) {
    const rank = match[1].toUpperCase();
    const suitRaw = match[2].toLowerCase();
    const suit = SUIT_SYMBOL_TO_LETTER[suitRaw] ?? suitRaw;
    if (['s', 'h', 'd', 'c'].includes(suit)) {
      cards.push(`${rank}${suit}`);
    }
  }
  return cards;
}

export interface FieldRef {
  el: HTMLInputElement | HTMLTextAreaElement | HTMLDivElement;
  type: 'input' | 'textarea' | 'rich';
}

export function useCardInsertionTarget() {
  const [activeField, setActiveField] = useState<FieldRef | null>(null);
  const fieldRegistry = useRef<Map<HTMLElement, 'input' | 'textarea' | 'rich'>>(new Map());
  const savedSelection = useRef<{ start: number; end: number } | null>(null);
  const savedRange = useRef<Range | null>(null);

  const captureSelection = useCallback(() => {
    if (activeField && activeField.type !== 'rich') {
      const input = activeField.el as HTMLInputElement | HTMLTextAreaElement;
      savedSelection.current = {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length,
      };
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      savedRange.current = range.cloneRange();
    }
  }, [activeField]);

  const registerField = useCallback((el: HTMLInputElement | HTMLTextAreaElement | HTMLDivElement | null, type: 'input' | 'textarea' | 'rich') => {
    if (!el) return;
    fieldRegistry.current.set(el, type);
    setActiveField({ el, type });
    if (type === 'rich') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (el.contains(range.commonAncestorContainer)) {
          savedRange.current = range.cloneRange();
        }
      }
    } else {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      savedSelection.current = { start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length };
    }
  }, []);

  const getUsedCards = useCallback((): Set<string> => {
    const used = new Set<string>();
    for (const [el, type] of fieldRegistry.current) {
      if (el === activeField?.el) continue;
      const text = type === 'rich' ? el.textContent || '' : (el as HTMLInputElement | HTMLTextAreaElement).value;
      parseCardsFromText(text).forEach((c) => used.add(c));
    }
    return used;
  }, [activeField]);

  const getActiveFieldCards = useCallback((): Set<string> => {
    if (!activeField) return new Set();
    const text = activeField.type === 'rich' ? activeField.el.textContent || '' : (activeField.el as HTMLInputElement | HTMLTextAreaElement).value;
    return new Set(parseCardsFromText(text));
  }, [activeField]);

  const insertCardText = useCallback((cardText: string): boolean => {
    if (!activeField) return false;

    if (activeField.type === 'rich') {
      const richEl = activeField.el as HTMLDivElement;
      richEl.focus();
      const sel = window.getSelection();
      if (savedRange.current && richEl.contains(savedRange.current.commonAncestorContainer)) {
        sel?.removeAllRanges();
        sel?.addRange(savedRange.current);
        savedRange.current.deleteContents();
        const fragment = createInlineCardFragment(cardText);
        const lastNode = fragment.lastChild;
        savedRange.current.insertNode(fragment);
        const newRange = document.createRange();
        if (lastNode) newRange.setStartAfter(lastNode);
        else newRange.setStart(savedRange.current.endContainer, savedRange.current.endOffset);
        newRange.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(newRange);
        savedRange.current = newRange.cloneRange();
      } else {
        richEl.appendChild(createInlineCardFragment(cardText));
        const newRange = document.createRange();
        newRange.selectNodeContents(richEl);
        newRange.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(newRange);
        savedRange.current = newRange.cloneRange();
      }
      richEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    const input = activeField.el as HTMLInputElement | HTMLTextAreaElement;
    input.focus();
    const start = savedSelection.current?.start ?? input.selectionStart ?? input.value.length;
    const end = savedSelection.current?.end ?? input.selectionEnd ?? input.value.length;
    const newValue = input.value.slice(0, start) + cardText + input.value.slice(end);
    const insertedAt = start + cardText.length;

    const valueSetter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    valueSetter?.call(input, newValue);
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: cardText,
    }));
    input.setSelectionRange(insertedAt, insertedAt);

    savedSelection.current = { start: insertedAt, end: insertedAt };
    return true;
  }, [activeField]);

  const hasActiveField = !!activeField;

  return {
    registerField,
    insertCardText,
    captureSelection,
    hasActiveField,
    getUsedCards,
    getActiveFieldCards,
  };
}

export function CardInsertionPalette({
  open,
  onClose,
  onInsert,
  hasActiveField,
  getUsedCards,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (cardText: string) => boolean | void;
  hasActiveField: boolean;
  getUsedCards: () => Set<string>;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [context, setContext] = useState<PaletteContext>('free');
  const [usedCards, setUsedCards] = useState<Set<string>>(new Set());
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (context === 'free') {
      setUsedCards(new Set());
    } else {
      setUsedCards(getUsedCards());
    }
  }, [context, open, getUsedCards]);

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setContext('free');
      setContextMenuOpen(false);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, getUsedCards]);

  if (!open) return null;

  const maxCards = CONTEXT_CONFIG[context].max;
  const cardKey = (rank: string, suit: string) => `${rank}${suit}`;

  const isCardUsed = (rank: string, suit: string) => {
    if (context === 'free') return false;
    return usedCards.has(cardKey(rank, suit));
  };

  const handleToggleCard = (rank: string, suit: string) => {
    const key = cardKey(rank, suit);
    if (isCardUsed(rank, suit)) return;
    setSelected((prev) => {
      const idx = prev.indexOf(key);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      if (prev.length >= maxCards) return prev;
      return [...prev, key];
    });
  };

  const handleRemoveCard = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => setSelected([]);

  const handleInsert = () => {
    if (selected.length === 0) return;
    const text = selected
      .map((key) => {
        const rank = key.slice(0, -1);
        const suit = key.slice(-1);
        return `${rank}${SUIT_SYMBOLS[suit] ?? suit}`;
      })
      .join('');
    const inserted = onInsert(text);
    if (inserted !== false) {
      setSelected([]);
      if (context !== 'free') {
        const newUsed = new Set(usedCards);
        selected.forEach((k) => newUsed.add(k));
        setUsedCards(newUsed);
      }
    }
  };

  const handleCancel = () => {
    setSelected([]);
    onClose();
  };

  const isSelected = (rank: string, suit: string) => {
    return selected.includes(cardKey(rank, suit));
  };

  const selectedIndex = (rank: string, suit: string) => {
    return selected.indexOf(cardKey(rank, suit));
  };

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} />
      <div
        ref={popupRef}
        className="absolute z-[201] w-[320px] rounded-xl border border-[#c0911e]/25 bg-[#0d0f12] p-3 shadow-2xl"
        style={{ right: 0, top: '100%', marginTop: 6 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">Insert Cards</span>
          <div className="flex items-center gap-2">
            {/* Context selector */}
            <div className="relative">
              <button
                onClick={() => setContextMenuOpen(!contextMenuOpen)}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-bold tracking-widest text-white/60 uppercase transition hover:text-white/90"
              >
                <Layers className="h-2.5 w-2.5" />
                {CONTEXT_CONFIG[context].label}
              </button>
              {contextMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-[202] w-32 rounded-lg border border-[#2a323b] bg-[#0a0c0e] p-1 shadow-xl">
                  {CONTEXT_ORDER.map((ctx) => (
                    <button
                      key={ctx}
                      onClick={() => {
                        setContext(ctx);
                        setContextMenuOpen(false);
                        if (selected.length > CONTEXT_CONFIG[ctx].max) {
                          setSelected(selected.slice(0, CONTEXT_CONFIG[ctx].max));
                        }
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[9px] font-medium uppercase tracking-wider transition-colors hover:bg-[#c0911e]/10"
                      style={{
                        color: ctx === context ? GOLD : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {CONTEXT_CONFIG[ctx].label}
                      <span className="text-white/30">{CONTEXT_CONFIG[ctx].max}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!hasActiveField && (
          <p className="py-3 text-center text-[10px] text-white/30">
            Click inside a text field first, then select cards to insert at your cursor.
          </p>
        )}

        {hasActiveField && (
          <>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {PALETTE_SUIT_ORDER.map((suit) => {
                const SuitIcon = SUIT_ICONS[suit];
                const isRed = SUIT_IS_RED[suit];
                const suitColor = isRed ? '#e04545' : '#cbd5e1';
                return (
                  <div key={suit} className="flex items-center gap-2">
                    <div className="flex w-6 shrink-0 items-center justify-center">
                      <SuitIcon className="h-4 w-4" style={{ color: suitColor }} />
                    </div>
                    <div className="flex flex-1 gap-1">
                      {CARD_RANKS.map((rank) => {
                        const selectedCard = isSelected(rank, suit);
                        const idx = selectedIndex(rank, suit);
                        const used = isCardUsed(rank, suit);
                        return (
                          <button
                            key={`${rank}${suit}`}
                            onClick={() => handleToggleCard(rank, suit)}
                            disabled={used}
                            title={used ? 'Already used in another field' : undefined}
                            className="relative flex h-7 flex-1 items-center justify-center rounded-md border transition-all"
                            style={{
                              background: selectedCard ? 'rgba(212,165,44,0.18)' : used ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.04)',
                              borderColor: selectedCard ? GOLD : 'rgba(255,255,255,0.08)',
                              color: used ? 'rgba(255,255,255,0.15)' : suitColor,
                              cursor: used ? 'not-allowed' : 'pointer',
                              opacity: used ? 0.4 : 1,
                            }}
                          >
                            <span className="text-[11px] font-bold">{rank}</span>
                            {selectedCard && (
                              <span
                                className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold text-black"
                                style={{ background: GOLD }}
                              >
                                {idx + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[8px] font-bold tracking-widest text-white/40 uppercase">
                  Selected ({selected.length}/{maxCards})
                </span>
                {selected.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[8px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selected.length > 0 ? (
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  {selected.map((key, i) => {
                    const rank = key.slice(0, -1);
                    const suit = key.slice(-1);
                    return (
                      <div key={`${key}-${i}`} className="relative">
                        <MiniPlayingCard rank={rank} suit={suit} size="small" />
                        <button
                          onClick={() => handleRemoveCard(i)}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c0911e] text-black hover:bg-[#d4a52c]"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mb-2.5 py-1 text-center text-[9px] text-white/25">
                  Select up to {maxCards} card{maxCards > 1 ? 's' : ''} from the grid above.
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 rounded-md border border-white/10 py-2 text-[9px] font-bold tracking-widest uppercase text-white/40 transition hover:bg-white/5 hover:text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsert}
                  disabled={selected.length === 0}
                  className="flex flex-[2] items-center justify-center gap-1.5 rounded-md border py-2 text-[9px] font-bold tracking-widest uppercase transition-all disabled:opacity-25"
                  style={{
                    borderColor: 'rgba(212,165,44,0.4)',
                    background: 'rgba(212,165,44,0.12)',
                    color: GOLD_SOFT,
                  }}
                >
                  <Check className="h-3 w-3" />
                  Insert {selected.length > 0 ? `(${selected.length})` : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function FieldCardPreview({ text, label }: { text: string; label?: string }) {
  const cards = parseCardsFromText(text);
  if (cards.length === 0) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {label && (
        <span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">{label}</span>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {cards.map((card, i) => {
          const rank = card.slice(0, -1);
          const suit = card.slice(-1);
          return <MiniPlayingCard key={`${card}-${i}`} rank={rank} suit={suit} size="small" />;
        })}
      </div>
    </div>
  );
}
