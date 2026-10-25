import { useEffect, useRef, type ReactNode } from 'react';
import { PremiumCardFace } from '@/features/hh-replayer/PremiumCardFace';

const CARD_PATTERN = /(?<![A-Za-z0-9])((?:[2-9TJQKA][\u2660\u2665\u2666\u2663])+)(?![A-Za-z0-9])/g;

const SUIT_GLYPH_TO_LETTER: Record<string, string> = {
  '\u2660': 's', '\u2665': 'h', '\u2666': 'd', '\u2663': 'c',
};

export function isInlineCard(value: string): boolean {
  return /^[2-9TJQKA][\u2660\u2665\u2666\u2663]$/.test(value);
}

/**
 * Renders a single playing card inline within text.
 * Uses a compact card-size based on surrounding font size (em-based).
 */
export function InlinePlayingCard({ card }: { card: string }) {
  const suitLetter = SUIT_GLYPH_TO_LETTER[card[1]] ?? 's';
  const cardCode = `${card[0]}${suitLetter}`;
  // Inline card: small card that sits within text flow
  const w = 20;
  const h = 28;

  return (
    <span
      contentEditable={false}
      data-inline-card={card}
      className="inline-playing-card"
      aria-label={card}
      style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 1px', lineHeight: 0 }}
    >
      <PremiumCardFace card={cardCode} width={w} height={h} cornerScale={1.25} />
    </span>
  );
}

export function renderInlineCardText(text: string): ReactNode[] {
  return renderCardNotationText(text);
}

export function renderCardNotationText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  CARD_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(CARD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    const cards = match[1].match(/[2-9TJQKA][\u2660\u2665\u2666\u2663]/g) ?? [];
    cards.forEach((card, cardIndex) => {
      parts.push(<InlinePlayingCard key={`${card}-${index}-${cardIndex}`} card={card} />);
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Creates a DocumentFragment containing text nodes and visual card spans
 * for insertion into contentEditable elements.
 * Each card span uses data-inline-card attribute so it can be re-rendered
 * as a visual card on display. The textContent of the span is the glyph
 * notation (e.g. "A♠") so it survives textContent read-back.
 */
export function createInlineCardFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  CARD_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(CARD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
    const cards = match[1].match(/[2-9TJQKA][\u2660\u2665\u2666\u2663]/g) ?? [];
    cards.forEach((card) => {
      const span = document.createElement('span');
      span.contentEditable = false;
      span.dataset.inlineCard = card;
      span.className = 'inline-playing-card';
      span.style.display = 'inline-flex';
      span.style.verticalAlign = 'middle';
      span.style.margin = '0 1px';
      span.style.lineHeight = '0';
      // Store glyph notation as textContent so it survives textContent read-back
      span.textContent = card;
      fragment.appendChild(span);
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  return fragment;
}

/**
 * Renders HTML content that may contain data-inline-card spans.
 * Processes the HTML to replace card spans with visual PremiumCardFace components.
 */
export function InlineRichText({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Parse the HTML to find and replace data-inline-card spans with visual cards
    const container = document.createElement('div');
    container.innerHTML = html;

    // Replace each data-inline-card span with a visual card element
    const cardSpans = container.querySelectorAll('[data-inline-card]');
    cardSpans.forEach((span) => {
      const card = span.getAttribute('data-inline-card');
      if (!card || card.length < 2) return;
      const suitLetter = SUIT_GLYPH_TO_LETTER[card[1]] ?? 's';
      const cardCode = `${card[0]}${suitLetter}`;

      // Create a wrapper that contains the visual card
      const wrapper = document.createElement('span');
      wrapper.style.display = 'inline-flex';
      wrapper.style.verticalAlign = 'middle';
      wrapper.style.margin = '0 1px';
      wrapper.style.lineHeight = '0';
      wrapper.setAttribute('data-inline-card', card);

      // Build the premium card SVG via a temporary render
      const tempDiv = document.createElement('div');
      tempDiv.style.display = 'inline-block';

      // Create SVG card
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '28');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.display = 'block';

      const color = (suitLetter === 'h' || suitLetter === 'd') ? '#D82945' : '#151820';
      const goldBorder = '#C5B68B';

      // Background
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '1');
      rect.setAttribute('y', '1');
      rect.setAttribute('width', '98');
      rect.setAttribute('height', '98');
      rect.setAttribute('rx', '12');
      rect.setAttribute('fill', '#FAFAF8');
      rect.setAttribute('stroke', goldBorder);
      rect.setAttribute('stroke-width', '0.8');
      svg.appendChild(rect);

      // Upper-left rank
      const rankText = document.createElementNS(svgNS, 'text');
      rankText.setAttribute('x', '10');
      rankText.setAttribute('y', '22');
      rankText.setAttribute('font-size', '22');
      rankText.setAttribute('font-weight', '900');
      rankText.setAttribute('fill', color);
      rankText.setAttribute('font-family', "'Inter',system-ui,sans-serif");
      rankText.setAttribute('letter-spacing', '-0.02em');
      rankText.textContent = card[0];
      svg.appendChild(rankText);

      // Lower-right rank (rotated)
      const rankText2 = document.createElementNS(svgNS, 'text');
      rankText2.setAttribute('x', '90');
      rankText2.setAttribute('y', '78');
      rankText2.setAttribute('font-size', '22');
      rankText2.setAttribute('font-weight', '900');
      rankText2.setAttribute('fill', color);
      rankText2.setAttribute('font-family', "'Inter',system-ui,sans-serif");
      rankText2.setAttribute('letter-spacing', '-0.02em');
      rankText2.setAttribute('transform', 'rotate(180 90 78)');
      rankText2.textContent = card[0];
      svg.appendChild(rankText2);

      // Center suit glyph
      const suitGlyphs: Record<string, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
      const suitText = document.createElementNS(svgNS, 'text');
      suitText.setAttribute('x', '50');
      suitText.setAttribute('y', '52');
      suitText.setAttribute('font-size', '40');
      suitText.setAttribute('fill', color);
      suitText.setAttribute('text-anchor', 'middle');
      suitText.setAttribute('dominant-baseline', 'central');
      suitText.setAttribute('font-family', 'system-ui,sans-serif');
      suitText.textContent = suitGlyphs[suitLetter] ?? '\u2660';
      svg.appendChild(suitText);

      tempDiv.appendChild(svg);
      wrapper.appendChild(tempDiv);
      span.replaceWith(wrapper);
    });

    if (ref.current.innerHTML !== container.innerHTML) {
      ref.current.innerHTML = container.innerHTML;
    }
  }, [html]);

  return <div ref={ref} className={className} />;
}
