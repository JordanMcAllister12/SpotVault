import { jsPDF } from 'jspdf';
import type { ContentSpot, ContentTags } from '@/lib/contentLab';
import { POKER_SITE_LABELS, DIFFICULTY_LABELS, TAG_LABELS } from '@/lib/contentLab';
import { fetchEvidence } from '@/lib/evidenceStore';

// ── Brand palette ──────────────────────────────────────────────
const NAVY: [number, number, number] = [15, 23, 42];          // #0F172A
const NAVY_LIGHT: [number, number, number] = [30, 41, 59];    // #1E293B
const GOLD: [number, number, number] = [212, 160, 23];        // #D4A017
const GOLD_LIGHT: [number, number, number] = [240, 210, 120]; // softer gold
const CHARCOAL: [number, number, number] = [40, 51, 68];      // #283344
const SLATE: [number, number, number] = [100, 116, 139];      // #64748B
const SLATE_LIGHT: [number, number, number] = [148, 163, 184];// #94A3B8
const BORDER: [number, number, number] = [226, 232, 240];     // #E2E8F0
const IVORY: [number, number, number] = [255, 249, 236];      // #FFF9EC
const IVORY_BORDER: [number, number, number] = [212, 160, 23];
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

// Playing card colors
const SUIT_RED: [number, number, number] = [192, 50, 50];
const SUIT_BLACK: [number, number, number] = [30, 30, 30];

// ── Layout constants ───────────────────────────────────────────
const PAGE_MARGIN = 54;
const FOOTER_HEIGHT = 32;

// ── Helpers ────────────────────────────────────────────────────

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

interface ContentBlock {
  heading?: string;
  text?: string;
  listItems?: string[];
  ordered?: boolean;
  callout?: boolean;
}

function htmlToBlocks(html: string): ContentBlock[] {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const blocks: ContentBlock[] = [];
  for (const child of Array.from(tmp.children)) {
    const tag = child.tagName;
    if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') {
      blocks.push({ heading: child.textContent || '' });
    } else if (tag === 'P') {
      blocks.push({ text: child.textContent || '' });
    } else if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(child.querySelectorAll('li')).map((li) => li.textContent || '');
      blocks.push({ listItems: items, ordered: tag === 'OL' });
    } else if (tag === 'BLOCKQUOTE') {
      blocks.push({ text: child.textContent || '', callout: true });
    } else if (child.textContent) {
      blocks.push({ text: child.textContent });
    }
  }
  return blocks;
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 60);
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const format = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ data: reader.result as string, format });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// ── Suit / card rendering ──────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: 'H', diamonds: 'D', spades: 'S', clubs: 'C',
};

type CardData = { rank: string; suit: 'hearts' | 'diamonds' | 'spades' | 'clubs' } | null;

function parseCard(token: string): CardData {
  const clean = token.trim().replace(/[()[\]]/g, '');
  // Match patterns like Ah, KS, 10d, Tc, 2h
  const m = clean.match(/^([2-9TJQKA10]{1,2})[hHdDsScC]$/);
  if (!m) return null;
  const rankStr = m[1].toUpperCase();
  const suitChar = clean[clean.length - 1].toLowerCase();
  const suitMap: Record<string, 'hearts' | 'diamonds' | 'spades' | 'clubs'> = {
    h: 'hearts', d: 'diamonds', s: 'spades', c: 'clubs',
  };
  const suit = suitMap[suitChar];
  if (!suit) return null;
  return { rank: rankStr, suit };
}

/**
 * Replace Unicode suit symbols with bracketed ASCII codes (e.g. A♥ → Ah)
 * so jsPDF doesn't render tofu for suit characters.
 */
function sanitizeSuits(text: string): string {
  return text
    .replace(/♥/g, '(h)')
    .replace(/♦/g, '(d)')
    .replace(/♠/g, '(s)')
    .replace(/♣/g, '(c)')
    .replace(/♥/g, '(h)')
    .replace(/♦/g, '(d)')
    .replace(/♠/g, '(s)')
    .replace(/♣/g, '(c)');
}

/**
 * Detect inline cards in text like "Ah Kh" or "AsKd" and return rendered card objects.
 * Falls back to null if no cards found — caller renders as plain text.
 */
function detectInlineCards(text: string): CardData[] | null {
  // Look for 2-5 consecutive card tokens separated by spaces or nothing
  const cardPattern = /([2-9TJQKA]{1,2}[hHdDsScC])/g;
  const matches = text.match(cardPattern);
  if (!matches || matches.length < 2) return null;
  const cards = matches.slice(0, 7).map(parseCard).filter(Boolean) as CardData[];
  return cards.length >= 2 ? cards : null;
}

// ── PDF drawing primitives ─────────────────────────────────────

interface PdfCtx {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  margin: number;
  y: number;
  spotTitle: string;
  totalPages: number;
}

function newPage(ctx: PdfCtx): void {
  ctx.doc.addPage();
  ctx.y = ctx.margin;
}

function ensureSpace(ctx: PdfCtx, needed: number): void {
  if (ctx.y + needed > ctx.pageHeight - PAGE_MARGIN - FOOTER_HEIGHT) {
    newPage(ctx);
  }
}

function drawSectionHeader(ctx: PdfCtx, label: string): void {
  ensureSpace(ctx, 36);
  const { doc, margin, pageWidth, contentWidth } = ctx;
  // Navy bar
  doc.setFillColor(...NAVY);
  doc.rect(margin, ctx.y, contentWidth, 24, 'F');
  // Gold accent stripe on left
  doc.setFillColor(...GOLD);
  doc.rect(margin, ctx.y, 4, 24, 'F');
  // Label text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(label.toUpperCase(), margin + 14, ctx.y + 16);
  ctx.y += 24 + 10;
}

function drawParagraph(ctx: PdfCtx, text: string, opts?: { fontSize?: number; color?: [number, number, number]; bold?: boolean; indent?: number; lineGap?: number }): void {
  const fontSize = opts?.fontSize ?? 10.5;
  const color = opts?.color ?? CHARCOAL;
  const bold = opts?.bold ?? false;
  const indent = opts?.indent ?? 0;
  const lineGap = opts?.lineGap ?? 14;
  const { doc, margin, contentWidth } = ctx;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, contentWidth - indent);
  for (const line of lines) {
    ensureSpace(ctx, lineGap);
    doc.text(line, margin + indent, ctx.y);
    ctx.y += lineGap;
  }
}

function drawHighlightBox(ctx: PdfCtx, text: string): void {
  const { doc, margin, contentWidth } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, contentWidth - 28);
  const boxHeight = lines.length * 14 + 16;
  ensureSpace(ctx, boxHeight + 8);
  // Ivory background
  doc.setFillColor(...IVORY);
  doc.rect(margin, ctx.y, contentWidth, boxHeight, 'F');
  // Gold left border
  doc.setFillColor(...GOLD);
  doc.rect(margin, ctx.y, 4, boxHeight, 'F');
  // Text
  doc.setTextColor(...CHARCOAL);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let ty = ctx.y + 14;
  for (const line of lines) {
    doc.text(line, margin + 14, ty);
    ty += 14;
  }
  ctx.y += boxHeight + 10;
}

function drawPlayingCard(ctx: PdfCtx, x: number, y: number, rank: string, suit: 'hearts' | 'diamonds' | 'spades' | 'clubs'): void {
  const { doc } = ctx;
  const cardW = 28;
  const cardH = 38;
  const radius = 3;
  // Card background — white with subtle border
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, cardW, cardH, radius, radius, 'FD');
  // Suit color
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const suitColor = isRed ? SUIT_RED : SUIT_BLACK;
  doc.setTextColor(...suitColor);
  // Rank in top-left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(rank, x + 4, y + 12);
  // Suit letter in center
  doc.setFontSize(16);
  const suitLetter = SUIT_SYMBOLS[suit];
  doc.text(suitLetter, x + cardW / 2, y + 24, { align: 'center' });
  // Rank mirrored bottom-right
  doc.setFontSize(9);
  doc.text(rank, x + cardW - 4, y + cardH - 4, { align: 'right' });
}

function drawCardRow(ctx: PdfCtx, cards: CardData[], label?: string): void {
  const cardW = 28;
  const cardGap = 6;
  const { doc, margin } = ctx;
  ensureSpace(ctx, 52);
  if (label) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text(label, margin, ctx.y + 4);
    ctx.y += 10;
    ensureSpace(ctx, 42);
  }
  let x = margin;
  for (const card of cards) {
    if (!card) continue;
    drawPlayingCard(ctx, x, ctx.y, card.rank, card.suit);
    x += cardW + cardGap;
  }
  ctx.y += 44;
}

/**
 * Render hand_details text. Detects card patterns in lines and renders
 * graphical cards when found, plain text otherwise.
 */
function drawHandDetails(ctx: PdfCtx, handText: string): void {
  const { doc, margin, contentWidth } = ctx;
  const lines = handText.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      ctx.y += 6;
      continue;
    }
    // Try to detect cards in the line
    const cards = detectInlineCards(line);
    if (cards && cards.length >= 2) {
      // Check if there's a label portion before the cards
      const cardPattern = /([2-9TJQKA]{1,2}[hHdDsScC])/g;
      const firstMatch = line.match(cardPattern);
      if (firstMatch) {
        const firstIdx = line.indexOf(firstMatch[0]);
        const prefix = line.substring(0, firstIdx).trim();
        const suffix = line.substring(firstMatch.index! + firstMatch.join('').length).trim();
        if (prefix) {
          drawParagraph(ctx, sanitizeSuits(prefix), { fontSize: 10, color: CHARCOAL });
        }
        drawCardRow(ctx, cards);
        if (suffix) {
          drawParagraph(ctx, sanitizeSuits(suffix), { fontSize: 10, color: SLATE });
        }
        continue;
      }
    }
    // Normal line — check if it looks like a labeled field
    const fieldMatch = line.match(/^([A-Z][A-Za-z\s/]+):\s*(.*)$/);
    if (fieldMatch) {
      ensureSpace(ctx, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...NAVY_LIGHT);
      doc.text(`${fieldMatch[1]}:`, margin, ctx.y);
      const labelWidth = doc.getTextWidth(`${fieldMatch[1]}:`) + 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...CHARCOAL);
      const valLines = doc.splitTextToSize(sanitizeSuits(fieldMatch[2]), contentWidth - labelWidth);
      for (const vline of valLines) {
        ensureSpace(ctx, 14);
        doc.text(vline, margin + labelWidth, ctx.y);
        ctx.y += 14;
      }
    } else {
      drawParagraph(ctx, sanitizeSuits(line), { fontSize: 10, color: CHARCOAL });
    }
  }
  ctx.y += 6;
}

// ── Tag badges ────────────────────────────────────────────────

function drawTagBadges(ctx: PdfCtx, tags: ContentTags): void {
  const { doc, margin, contentWidth } = ctx;
  const entries: { label: string; value: string }[] = [];
  for (const key of Object.keys(TAG_LABELS) as (keyof ContentTags)[]) {
    const val = tags[key];
    if (typeof val === 'string' && val.length > 0) {
      entries.push({ label: TAG_LABELS[key], value: val });
    }
  }
  if (entries.length === 0) return;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let x = margin;
  const badgeH = 16;
  const badgePad = 8;
  const badgeGap = 6;
  ensureSpace(ctx, badgeH + 8);
  for (const entry of entries) {
    const text = `${entry.label}: ${entry.value}`;
    const tw = doc.getTextWidth(text);
    const badgeW = tw + badgePad * 2;
    if (x + badgeW > margin + contentWidth) {
      ctx.y += badgeH + badgeGap;
      x = margin;
      ensureSpace(ctx, badgeH + 8);
    }
    // Badge background
    doc.setFillColor(...NAVY_LIGHT);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, ctx.y, badgeW, badgeH, 3, 3, 'FD');
    doc.setTextColor(...WHITE);
    doc.text(text, x + badgePad, ctx.y + 11);
    x += badgeW + badgeGap;
  }
  ctx.y += badgeH + 12;
}

// ── Metadata row (site, difficulty, date) ──────────────────────

function drawMetadataRow(ctx: PdfCtx, spot: ContentSpot): void {
  const { doc, margin, contentWidth } = ctx;
  const items: { label: string; value: string }[] = [];
  if (spot.poker_site) {
    items.push({ label: 'Site', value: POKER_SITE_LABELS[spot.poker_site] ?? spot.poker_site });
  }
  if (spot.difficulty) {
    items.push({ label: 'Content Depth', value: DIFFICULTY_LABELS[spot.difficulty] ?? spot.difficulty });
  }
  if (spot.source) {
    items.push({ label: 'Source', value: spot.source });
  }
  const dateStr = formatDate(spot.published_at) || formatDate(spot.created_at);
  if (dateStr) {
    items.push({ label: 'Date', value: dateStr });
  }
  if (items.length === 0) return;

  ensureSpace(ctx, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let x = margin;
  const gap = 20;
  for (const item of items) {
    doc.setTextColor(...SLATE);
    doc.text(`${item.label}:`, x, ctx.y + 4);
    const labelW = doc.getTextWidth(`${item.label}:`) + 4;
    doc.setTextColor(...CHARCOAL);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x + labelW, ctx.y + 4);
    doc.setFont('helvetica', 'normal');
    x += labelW + doc.getTextWidth(item.value) + gap;
  }
  ctx.y += 14;
}

// ── Image rendering with aspect ratio ──────────────────────────

function drawImage(ctx: PdfCtx, imgData: string, format: string, caption?: string): void {
  const { doc, margin, contentWidth } = ctx;
  try {
    // Get image dimensions from the data URL
    const img = new Image();
    img.src = imgData;
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    let imgW = Math.min(contentWidth, 380);
    let imgH = origW && origH ? (imgW * origH) / origW : imgW * 0.6;
    // Cap height to prevent oversized images
    const maxH = 280;
    if (imgH > maxH) {
      imgH = maxH;
      imgW = (imgH * origW) / origH;
    }
    ensureSpace(ctx, imgH + (caption ? 18 : 8));
    doc.addImage(imgData, format, margin + (contentWidth - imgW) / 2, ctx.y, imgW, imgH);
    ctx.y += imgH + 6;
    if (caption) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE);
      const capLines = doc.splitTextToSize(caption, contentWidth);
      for (const line of capLines) {
        ensureSpace(ctx, 12);
        doc.text(line, margin + (contentWidth - imgW) / 2, ctx.y);
        ctx.y += 11;
      }
    }
    ctx.y += 8;
  } catch {
    // skip failed image
  }
}

// ── Quiz rendering ─────────────────────────────────────────────

function drawQuiz(ctx: PdfCtx, quiz: NonNullable<ContentSpot['quiz']>): void {
  const { doc, margin, contentWidth } = ctx;
  quiz.forEach((q, qi) => {
    ensureSpace(ctx, 30);
    // Question number circle
    doc.setFillColor(...GOLD);
    doc.circle(margin + 8, ctx.y + 4, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${qi + 1}`, margin + 8, ctx.y + 7, { align: 'center' });
    // Question text
    doc.setTextColor(...CHARCOAL);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const qLines = doc.splitTextToSize(q.question, contentWidth - 24);
    for (const line of qLines) {
      ensureSpace(ctx, 14);
      doc.text(line, margin + 24, ctx.y + 4);
      ctx.y += 14;
    }
    ctx.y += 4;
    // Options
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    q.options.forEach((opt, oi) => {
      ensureSpace(ctx, 14);
      const isCorrect = oi === q.correct_index;
      if (isCorrect) {
        doc.setTextColor(...GOLD);
        doc.setFont('helvetica', 'bold');
        doc.text('  ✓', margin + 24, ctx.y);
        doc.setTextColor(...CHARCOAL);
      } else {
        doc.setTextColor(...SLATE_LIGHT);
        doc.text('  •', margin + 24, ctx.y);
      }
      doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
      doc.setTextColor(...(isCorrect ? CHARCOAL : SLATE));
      const optLines = doc.splitTextToSize(opt, contentWidth - 40);
      doc.text(optLines[0], margin + 38, ctx.y);
      ctx.y += 12;
      for (let li = 1; li < optLines.length; li++) {
        ensureSpace(ctx, 12);
        doc.text(optLines[li], margin + 38, ctx.y);
        ctx.y += 12;
      }
    });
    // Explanation
    if (q.explanation) {
      ctx.y += 4;
      drawHighlightBox(ctx, `Explanation: ${q.explanation}`);
    }
    ctx.y += 10;
  });
}

// ── Content blocks rendering ───────────────────────────────────

function drawContentBlocks(ctx: PdfCtx, html: string): void {
  const blocks = htmlToBlocks(html);
  for (const block of blocks) {
    if (block.heading) {
      ensureSpace(ctx, 24);
      const { doc, margin, contentWidth } = ctx;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...NAVY);
      const hLines = doc.splitTextToSize(block.heading, contentWidth);
      for (const line of hLines) {
        ensureSpace(ctx, 16);
        doc.text(line, margin, ctx.y);
        ctx.y += 15;
      }
      ctx.y += 4;
    }
    if (block.callout && block.text) {
      drawHighlightBox(ctx, block.text);
    } else if (block.text) {
      drawParagraph(ctx, block.text, { fontSize: 10.5, color: CHARCOAL, lineGap: 14 });
      ctx.y += 4;
    }
    if (block.listItems) {
      const { doc, margin, contentWidth } = ctx;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(...CHARCOAL);
      block.listItems.forEach((item, idx) => {
        const prefix = block.ordered ? `${idx + 1}.` : '•';
        const prefixW = block.ordered ? 16 : 10;
        const itemLines = doc.splitTextToSize(item, contentWidth - prefixW - 6);
        for (let li = 0; li < itemLines.length; li++) {
          ensureSpace(ctx, 14);
          if (li === 0) {
            doc.setTextColor(...GOLD);
            doc.text(prefix, margin + 4, ctx.y);
            doc.setTextColor(...CHARCOAL);
          }
          doc.text(itemLines[li], margin + prefixW + 6, ctx.y);
          ctx.y += 14;
        }
      });
      ctx.y += 4;
    }
  }
}

// ── Footer ─────────────────────────────────────────────────────

function drawFooter(ctx: PdfCtx, pageNum: number, totalPages: number): void {
  const { doc, margin, pageWidth, pageHeight, spotTitle } = ctx;
  // Thin gold line above footer
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - FOOTER_HEIGHT + 6, pageWidth - margin, pageHeight - FOOTER_HEIGHT + 6);
  // Left: brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('SPOTVAULT', margin, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE);
  doc.text('Coaching Report', margin + 56, pageHeight - 14);
  // Center: spot title (truncated)
  doc.setFontSize(8);
  const maxTitleW = pageWidth - margin * 2 - 160;
  let titleStr = spotTitle;
  if (doc.getTextWidth(titleStr) > maxTitleW) {
    while (doc.getTextWidth(titleStr + '…') > maxTitleW && titleStr.length > 0) {
      titleStr = titleStr.slice(0, -1);
    }
    titleStr += '…';
  }
  doc.setTextColor(...SLATE_LIGHT);
  doc.text(titleStr, pageWidth / 2, pageHeight - 14, { align: 'center' });
  // Right: page number
  doc.setTextColor(...SLATE);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
}

// ── First-page branded header ──────────────────────────────────

function drawBrandedHeader(ctx: PdfCtx, spot: ContentSpot): void {
  const { doc, margin, pageWidth, contentWidth } = ctx;
  // Navy header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 80, 'F');
  // Gold accent line at bottom of band
  doc.setFillColor(...GOLD);
  doc.rect(0, 78, pageWidth, 2, 'F');
  // SPOTVAULT wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...GOLD);
  doc.text('SPOTVAULT', margin, 32);
  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_LIGHT);
  doc.text('PROFESSIONAL POKER COACHING REPORT', margin, 46);
  // Classification badge on right
  const diffLabel = spot.difficulty ? (DIFFICULTY_LABELS[spot.difficulty] ?? spot.difficulty) : 'Study Spot';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const badgeText = diffLabel.toUpperCase();
  const badgeW = doc.getTextWidth(badgeText) + 16;
  doc.setFillColor(...GOLD);
  doc.roundedRect(pageWidth - margin - badgeW, 20, badgeW, 16, 3, 3, 'F');
  doc.setTextColor(...NAVY);
  doc.text(badgeText, pageWidth - margin - badgeW / 2, 31, { align: 'center' });

  ctx.y = 100;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(spot.title || 'Untitled Spot', contentWidth);
  for (const line of titleLines) {
    ensureSpace(ctx, 28);
    doc.text(line, margin, ctx.y);
    ctx.y += 26;
  }
  ctx.y += 4;

  // Subtitle
  if (spot.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    const subLines = doc.splitTextToSize(spot.subtitle, contentWidth);
    for (const line of subLines) {
      ensureSpace(ctx, 18);
      doc.text(line, margin, ctx.y);
      ctx.y += 16;
    }
    ctx.y += 4;
  }

  // Creator line
  const dateStr = formatDate(spot.published_at) || formatDate(spot.created_at);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  const creatorLine = `Created by ${spot.creator_name || 'Unknown'}${dateStr ? '  •  ' + dateStr : ''}`;
  doc.text(creatorLine, margin, ctx.y);
  ctx.y += 14;

  // Thin separator
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin, ctx.y, pageWidth - margin, ctx.y);
  ctx.y += 10;

  // Metadata row + tags
  drawMetadataRow(ctx, spot);
  drawTagBadges(ctx, spot.tags);
  ctx.y += 4;
}

// ── Main spot renderer ─────────────────────────────────────────

async function addSpotToPdf(ctx: PdfCtx, spot: ContentSpot, isFirst: boolean): Promise<void> {
  if (!isFirst) {
    newPage(ctx);
  }

  // Branded header on first page of each spot
  drawBrandedHeader(ctx, spot);

  // Introduction / Overview
  if (spot.introduction) {
    drawSectionHeader(ctx, 'Overview');
    drawParagraph(ctx, spot.introduction, { fontSize: 11, color: CHARCOAL, lineGap: 15 });
    ctx.y += 8;
  }

  // Hand Details
  if (spot.hand_details) {
    drawSectionHeader(ctx, 'Hand Details');
    drawHandDetails(ctx, spot.hand_details);
    ctx.y += 4;
  }

  // Content / Analysis
  if (spot.content_html && spot.content_html.trim()) {
    drawSectionHeader(ctx, 'Analysis & Breakdown');
    drawContentBlocks(ctx, spot.content_html);
    ctx.y += 8;
  }

  // Content blocks (structured / work_pack)
  if (spot.content_blocks && spot.content_blocks.length > 0) {
    drawSectionHeader(ctx, 'Structured Content');
    for (const block of spot.content_blocks) {
      if (block.type === 'heading' && block.text) {
        ensureSpace(ctx, 22);
        ctx.doc.setFont('helvetica', 'bold');
        ctx.doc.setFontSize(12);
        ctx.doc.setTextColor(...NAVY);
        ctx.doc.text(block.text, ctx.margin, ctx.y);
        ctx.y += 16;
      } else if (block.type === 'paragraph' && block.text) {
        drawParagraph(ctx, block.text, { fontSize: 10.5, color: CHARCOAL });
        ctx.y += 4;
      } else if (block.type === 'bullet_list' && block.items) {
        for (const item of block.items) {
          drawParagraph(ctx, `•  ${item}`, { fontSize: 10.5, color: CHARCOAL, indent: 8 });
        }
        ctx.y += 4;
      } else if (block.type === 'numbered_list' && block.items) {
        block.items.forEach((item, idx) => {
          drawParagraph(ctx, `${idx + 1}.  ${item}`, { fontSize: 10.5, color: CHARCOAL, indent: 8 });
        });
        ctx.y += 4;
      } else if (block.type === 'callout' && block.text) {
        drawHighlightBox(ctx, block.text);
      } else if (block.type === 'image' && block.url) {
        const img = await fetchImageAsBase64(block.url);
        if (img) drawImage(ctx, img.data, img.format, block.caption);
      }
    }
  }

  // Work pack stages
  if (spot.work_pack_stages && spot.work_pack_stages.length > 0) {
    for (const stage of spot.work_pack_stages) {
      if (stage.blocks && stage.blocks.length > 0) {
        drawSectionHeader(ctx, stage.title || 'Stage');
        for (const block of stage.blocks) {
          if (block.type === 'heading' && block.text) {
            ensureSpace(ctx, 22);
            ctx.doc.setFont('helvetica', 'bold');
            ctx.doc.setFontSize(12);
            ctx.doc.setTextColor(...NAVY);
            ctx.doc.text(block.text, ctx.margin, ctx.y);
            ctx.y += 16;
          } else if (block.type === 'paragraph' && block.text) {
            drawParagraph(ctx, block.text, { fontSize: 10.5, color: CHARCOAL });
            ctx.y += 4;
          } else if (block.type === 'bullet_list' && block.items) {
            for (const item of block.items) {
              drawParagraph(ctx, `•  ${item}`, { fontSize: 10.5, color: CHARCOAL, indent: 8 });
            }
            ctx.y += 4;
          } else if (block.type === 'numbered_list' && block.items) {
            block.items.forEach((item, idx) => {
              drawParagraph(ctx, `${idx + 1}.  ${item}`, { fontSize: 10.5, color: CHARCOAL, indent: 8 });
            });
            ctx.y += 4;
          } else if (block.type === 'callout' && block.text) {
            drawHighlightBox(ctx, block.text);
          } else if (block.type === 'image' && block.url) {
            const img = await fetchImageAsBase64(block.url);
            if (img) drawImage(ctx, img.data, img.format, block.caption);
          }
        }
        ctx.y += 6;
      }
    }
  }

  // Visuals & Evidence images
  const allImages = [
    ...(spot.visual_details ?? []).map((v) => ({ url: v.url, caption: v.caption })),
    ...(spot.image_urls ?? []).map((u) => ({ url: u, caption: undefined as string | undefined })),
  ];
  // Fetch evidence images from spot_evidence table
  if (spot.id) {
    try {
      const evidenceItems = await fetchEvidence(spot.id);
      for (const ev of evidenceItems) {
        allImages.push({ url: ev.asset_url, caption: ev.caption || ev.title || undefined });
      }
    } catch {
      // Evidence fetch is best-effort; skip on failure
    }
  }
  if (allImages.length > 0) {
    drawSectionHeader(ctx, 'Visuals & Evidence');
    for (const imgRef of allImages) {
      const img = await fetchImageAsBase64(imgRef.url);
      if (img) drawImage(ctx, img.data, img.format, imgRef.caption);
    }
  }

  // Quiz
  if (spot.quiz && spot.quiz.length > 0) {
    drawSectionHeader(ctx, 'Knowledge Check');
    drawQuiz(ctx, spot.quiz);
  }
}

// ── Cover page for multi-spot export ───────────────────────────

function drawCoverPage(ctx: PdfCtx, spots: ContentSpot[], creatorName?: string): void {
  const { doc, pageWidth, pageHeight, margin } = ctx;
  // Full navy background
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  // Gold accent bar
  doc.setFillColor(...GOLD);
  doc.rect(0, pageHeight / 2 - 80, pageWidth, 3, 'F');
  // SPOTVAULT wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(...GOLD);
  doc.text('SPOTVAULT', pageWidth / 2, pageHeight / 2 - 40, { align: 'center' });
  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_LIGHT);
  doc.text('PROFESSIONAL POKER COACHING REPORT', pageWidth / 2, pageHeight / 2 - 18, { align: 'center' });
  // Spot count
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text(`${spots.length} Spots`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
  // Creator
  if (creatorName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GOLD_LIGHT);
    doc.text(`Compiled by ${creatorName}`, pageWidth / 2, pageHeight / 2 + 44, { align: 'center' });
  }
  // Date
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_LIGHT);
  doc.text(formatDate(new Date().toISOString()), pageWidth / 2, pageHeight / 2 + 64, { align: 'center' });

  // Table of contents
  let tocY = pageHeight / 2 + 100;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text('CONTENTS', pageWidth / 2, tocY, { align: 'center' });
  tocY += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_LIGHT);
  spots.slice(0, 12).forEach((spot, idx) => {
    const numStr = `${idx + 1}.  ${spot.title}`;
    const truncStr = doc.getTextWidth(numStr) > pageWidth - margin * 2
      ? numStr.slice(0, 60) + '…'
      : numStr;
    doc.text(truncStr, pageWidth / 2, tocY, { align: 'center' });
    tocY += 16;
  });
}

// ── Main export function ───────────────────────────────────────

export async function exportSpotsToPdf(spots: ContentSpot[], creatorName?: string): Promise<void> {
  if (spots.length === 0) return;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE_MARGIN;
  const contentWidth = pageWidth - margin * 2;

  const ctx: PdfCtx = {
    doc,
    pageWidth,
    pageHeight,
    contentWidth,
    margin,
    y: margin,
    spotTitle: spots[0]?.title || 'SpotVault Report',
    totalPages: 0,
  };

  // Cover page for multi-spot
  if (spots.length > 1) {
    drawCoverPage(ctx, spots, creatorName);
  }

  // Render each spot
  for (let i = 0; i < spots.length; i++) {
    ctx.spotTitle = spots[i].title || 'Untitled Spot';
    await addSpotToPdf(ctx, spots[i], i === 0 && spots.length === 1 ? true : i === 0 ? spots.length > 1 : true);
  }

  // Footers with pagination — on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    // Skip footer on cover page (page 1 when multi-spot)
    if (spots.length > 1 && p === 1) continue;
    // Determine which spot title to use for this page
    // (approximation: find the spot that starts on or before this page)
    let titleForPage = spots[0]?.title || 'SpotVault Report';
    // Simple heuristic — for single spot, always its title
    if (spots.length === 1) {
      titleForPage = spots[0].title || 'SpotVault Report';
    }
    const footerCtx: PdfCtx = {
      ...ctx,
      y: 0,
      spotTitle: titleForPage,
      totalPages: pageCount,
    };
    drawFooter(footerCtx, p, pageCount);
  }

  const filename = spots.length === 1
    ? `SpotVault_${safeFilename(spots[0].title)}.pdf`
    : `SpotVault_Study-Pack_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename);
}
