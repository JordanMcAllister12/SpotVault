import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Check, X, AlertCircle, Copy, Download, ChevronRight, ArrowLeft, Edit3, FileJson, Star, Layers, RotateCcw, Maximize2, Minimize2, Eye, EyeOff, MoreVertical, Zap, SkipForward, ArrowLeftRight, Clipboard, Stethoscope, Loader2 } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';
import {
  saveReferenceRange,
  listReferenceNodes,
  listRangesForNode,
  deleteReferenceNode,
  exportReferenceNode,
  setActiveRange,
  computeNodeHash,
  expand169ToCombos,
  combosTo169,
  type ReferenceNodeRecord,
  type ReferenceRangeRecord,
  type ReferenceNodeIdentity,
  type StructuredAction,
  type AvailableAction,
} from '@/lib/solver/referenceRangeLibrary';
import { CANONICAL_HAND_ORDER, getComboIndicesForCell, COMBO_TO_INDEX } from '@/lib/solver/canonicalHandOrder';
import { HAND_CELLS, CARD_RANKS, CARD_SUITS } from '@/lib/solver/types';
import type { SolverFormat, SolverPosition } from '@/lib/solver/types';

const POSITIONS: SolverPosition[] = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const ANTE_TYPES = ['none', 'bb_ante', 'per_player'] as const;
const STACK_PRESETS = [10, 15, 20, 25, 30, 40, 60, 100];

const INPUT_CLS = 'w-full rounded-md border border-white/10 bg-[#0a0c0e] px-2.5 py-1.5 text-[11px] text-white/80 outline-none focus:border-[#d4a52c]/40';
const LABEL_CLS = 'text-[9px] font-mono tracking-widest text-white/40 uppercase mb-1';
const SECTION_CLS = 'rounded-xl border border-white/[0.06] bg-[#0a0c0e]/80 p-4';
const BTN_CLS = 'rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[10px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#d4a52c]/20';
const BTN_SAVE = 'rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-[11px] font-bold text-emerald-200 transition-all hover:bg-emerald-400/25';
const BTN_PREVIEW = 'rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/15 px-4 py-2 text-[11px] font-bold text-blue-200 transition-all hover:bg-[#3b82f6]/25';
const BTN_VALIDATE = 'rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-4 py-2 text-[11px] font-bold text-[#f5e6b0] transition-all hover:bg-[#d4a52c]/25';
const BTN_RESET = 'rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/50 transition-all hover:bg-white/5';

const SHELL_STYLE: React.CSSProperties = { maxWidth: 'min(1180px, calc(100% - 32px))' };

const ACTION_COLORS: Record<string, string> = {
  fold: '#3b6db8',
  call: '#2d8a4f',
  limp: '#2d8a4f',
  raise: '#c84a3e',
  'all-in': '#7a2828',
};

function actionColor(action: string): string {
  if (action === 'fold') return ACTION_COLORS.fold;
  if (action === 'call' || action === 'limp') return ACTION_COLORS.call;
  if (action.startsWith('all-in')) return ACTION_COLORS['all-in'];
  if (action.startsWith('raise') || action.startsWith('3bet') || action.startsWith('4bet')) return ACTION_COLORS.raise;
  return '#888888';
}

function actionDisplayLabel(action: string): string {
  if (action === 'fold') return 'Fold';
  if (action === 'call') return 'Call';
  if (action === 'limp') return 'Limp';
  if (action === 'all-in') return 'All-In';
  if (action.startsWith('raise_')) return `Raise ${action.replace('raise_', '')}`;
  if (action.startsWith('3bet_')) return `3-Bet ${action.replace('3bet_', '')}`;
  if (action.startsWith('4bet_')) return `4-Bet ${action.replace('4bet_', '')}`;
  return action;
}

interface ActionBox {
  id: string;
  actionType: 'raise' | 'call' | 'limp' | '3bet' | 'all-in' | 'custom';
  sizeBB: string;
  pasteText: string;
}

type ImportMode = 'action' | 'whole';
type BatchType = 'unopened' | 'vs_open' | 'opener_vs_3bet';

interface ImportPrefill extends Partial<ReferenceNodeIdentity> {
  editMode?: boolean;
  strategyData?: Record<string, Record<string, number>>;
  availableActions?: AvailableAction[];
  sourceName?: string;
  sourceVersion?: string;
  notes?: string;
}

interface ParsedCombo {
  combos: Record<string, number>;
  errors: string[];
}

interface WholeStrategyResult {
  actionBoxes: { actionType: ActionBox['actionType']; sizeBB: string; pasteText: string }[];
  errors: string[];
  detectedFormat: string;
}

const VALID_RANKS_SET = new Set(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
const VALID_SUITS_SET = new Set(['h', 'd', 'c', 's']);

function normalizeCombo(input: string): string | null {
  if (input.length !== 4) return null;
  const r1 = input[0].toUpperCase();
  const r2 = input[2].toUpperCase();
  const s1 = input[1].toLowerCase();
  const s2 = input[3].toLowerCase();
  if (!VALID_RANKS_SET.has(r1) || !VALID_RANKS_SET.has(r2)) return null;
  if (!VALID_SUITS_SET.has(s1) || !VALID_SUITS_SET.has(s2)) return null;
  if (r1 === r2 && s1 === s2) return null;
  return `${r1}${s1}${r2}${s2}`;
}

function comboToCell(combo: string): string | null {
  if (combo.length !== 4) return null;
  const r1 = combo[0].toUpperCase();
  const r2 = combo[2].toUpperCase();
  const s1 = combo[1].toLowerCase();
  const s2 = combo[3].toLowerCase();
  const r1Idx = CARD_RANKS.indexOf(r1);
  const r2Idx = CARD_RANKS.indexOf(r2);
  if (r1Idx === r2Idx) return `${r1}${r2}`;
  const suited = s1 === s2;
  if (r1Idx < r2Idx) return suited ? `${r1}${r2}s` : `${r1}${r2}o`;
  return suited ? `${r2}${r1}s` : `${r2}${r1}o`;
}

function parsePasteBox(text: string): ParsedCombo {
  const combos: Record<string, number> = {};
  const errors: string[] = [];
  const validCells = new Set(HAND_CELLS);
  const validCombos = new Set(CANONICAL_HAND_ORDER);
  const tokens = text.split(/[,\n;]+/).map(t => t.trim()).filter(t => t.length > 0);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const match = token.match(/^([A-Za-z0-9]+)\s*[:\s]\s*([\d.]+)%?\s*$/);
    let hand: string; let freqStr: string;
    if (match) { hand = match[1].toUpperCase(); freqStr = match[2]; }
    else { const parts = token.split(/\s+/); hand = parts[0].toUpperCase(); freqStr = parts.length > 1 ? parts[parts.length - 1].replace('%', '') : '100'; }
    let freq = parseFloat(freqStr);
    if (isNaN(freq)) { errors.push(`Token ${i + 1}: invalid frequency "${freqStr}"`); continue; }
    if (freq > 1) freq = freq / 100;
    freq = Math.max(0, Math.min(1, freq));
    if (validCombos.has(hand.toLowerCase())) { combos[hand.toLowerCase()] = freq; }
    else if (validCells.has(hand)) { const indices = getComboIndicesForCell(hand); for (const idx of indices) { combos[CANONICAL_HAND_ORDER[idx]] = freq; } }
    else { const normalized = normalizeCombo(hand); if (normalized && validCombos.has(normalized)) { combos[normalized] = freq; } else { errors.push(`Token ${i + 1}: unknown hand "${hand}"`); } }
  }
  return { combos, errors };
}

function buildActionLabel(box: ActionBox): string {
  switch (box.actionType) {
    case 'raise': return `raise_${box.sizeBB}`;
    case '3bet': return `3bet_${box.sizeBB}`;
    case 'all-in': return 'all-in';
    case 'call': return 'call';
    case 'limp': return 'limp';
    case 'custom': return box.sizeBB || 'custom';
    default: return box.actionType;
  }
}

function buildAvailableActions(boxes: ActionBox[]): AvailableAction[] {
  return boxes.map(b => {
    const action = buildActionLabel(b);
    const label = b.actionType === 'raise' ? `Raise ${b.sizeBB}` : b.actionType === '3bet' ? `3-Bet ${b.sizeBB}` : b.actionType === 'all-in' ? 'All-In' : b.actionType === 'call' ? 'Call' : b.actionType === 'limp' ? 'Limp' : b.sizeBB || 'Custom';
    return { action, label };
  });
}

function actionsToBoxes(actions: AvailableAction[]): ActionBox[] {
  return actions.map((a, i) => {
    if (a.action === 'all-in') return { id: `edit-${i}`, actionType: 'all-in' as const, sizeBB: '', pasteText: '' };
    if (a.action === 'call') return { id: `edit-${i}`, actionType: 'call' as const, sizeBB: '', pasteText: '' };
    if (a.action === 'limp') return { id: `edit-${i}`, actionType: 'limp' as const, sizeBB: '', pasteText: '' };
    if (a.action.startsWith('raise_')) return { id: `edit-${i}`, actionType: 'raise' as const, sizeBB: a.action.replace('raise_', ''), pasteText: '' };
    if (a.action.startsWith('3bet_')) return { id: `edit-${i}`, actionType: '3bet' as const, sizeBB: a.action.replace('3bet_', ''), pasteText: '' };
    return { id: `edit-${i}`, actionType: 'custom' as const, sizeBB: a.action, pasteText: '' };
  });
}

function strategyDataToPasteText(strategyData: Record<string, Record<string, number>>, actionLabel: string): string {
  const lines: string[] = [];
  for (const combo of CANONICAL_HAND_ORDER) {
    const freq = strategyData[combo]?.[actionLabel];
    if (freq && freq > 0) {
      if (freq >= 0.999) lines.push(combo);
      else lines.push(`${combo} ${(freq * 100).toFixed(0)}%`);
    }
  }
  return lines.join('\n');
}

interface BuildResult {
  strategyData: Record<string, Record<string, number>>;
  errors: string[];
  warnings: string[];
  actionFreqs: Record<string, number>;
  totalCombos: number;
  validated: boolean;
}

function buildStrategyData(boxes: ActionBox[]): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strategyData: Record<string, Record<string, number>> = {};
  for (let i = 0; i < 1326; i++) { strategyData[CANONICAL_HAND_ORDER[i]] = {}; }
  const comboTotals: Record<string, number> = {};
  for (const combo of CANONICAL_HAND_ORDER) comboTotals[combo] = 0;
  for (const box of boxes) {
    if (!box.pasteText.trim()) continue;
    const parsed = parsePasteBox(box.pasteText);
    errors.push(...parsed.errors.map(e => `[${buildActionLabel(box)}] ${e}`));
    const actionLabel = buildActionLabel(box);
    for (const [combo, freq] of Object.entries(parsed.combos)) {
      if (!strategyData[combo]) { errors.push(`Unknown combo: ${combo}`); continue; }
      strategyData[combo][actionLabel] = freq;
      comboTotals[combo] += freq;
    }
  }
  for (const combo of CANONICAL_HAND_ORDER) {
    if (comboTotals[combo] > 1.001) { errors.push(`${combo}: action frequencies total ${(comboTotals[combo] * 100).toFixed(1)}% (>100%)`); }
    const residual = 1.0 - comboTotals[combo];
    if (residual > 0.001) { strategyData[combo]['fold'] = Math.max(0, residual); }
    else { strategyData[combo]['fold'] = 0; }
  }
  const actionFreqs: Record<string, number> = { fold: 0 };
  for (const combo of CANONICAL_HAND_ORDER) { for (const [action, freq] of Object.entries(strategyData[combo])) { actionFreqs[action] = (actionFreqs[action] ?? 0) + freq; } }
  for (const action of Object.keys(actionFreqs)) { actionFreqs[action] = actionFreqs[action] / 1326; }
  return { strategyData, errors, warnings, actionFreqs, totalCombos: 1326, validated: errors.length === 0 };
}

function buildAllFoldStrategyData(): Record<string, Record<string, number>> {
  const data: Record<string, Record<string, number>> = {};
  for (const combo of CANONICAL_HAND_ORDER) data[combo] = { fold: 1.0 };
  return data;
}

const ALL_FOLD_DATA = buildAllFoldStrategyData();
const ALL_FOLD_FREQS: Record<string, number> = { fold: 1.0 };

type PreviewStage = 'initial' | 'previewed' | 'validated' | 'saved';

function countUnique169(combos: Record<string, number>): number {
  const cells = new Set<string>();
  for (const combo of Object.keys(combos)) { const cell = comboToCell(combo); if (cell) cells.add(cell); }
  return cells.size;
}

// ── Whole Strategy Parser Adapters ──

const ACTION_KEYWORDS: Record<string, { type: ActionBox['actionType']; sizeBB?: string }> = {
  'fold': { type: 'call', sizeBB: '' },
  'call': { type: 'call', sizeBB: '' },
  'limp': { type: 'limp', sizeBB: '' },
  'all-in': { type: 'all-in', sizeBB: '' },
  'allin': { type: 'all-in', sizeBB: '' },
  'jam': { type: 'all-in', sizeBB: '' },
  'shove': { type: 'all-in', sizeBB: '' },
};

function detectActionFromHeader(header: string): { type: ActionBox['actionType']; sizeBB: string } | null {
  const h = header.toLowerCase().trim();
  if (h === 'fold') return { type: 'call', sizeBB: '' };
  if (h === 'call') return { type: 'call', sizeBB: '' };
  if (h === 'limp') return { type: 'limp', sizeBB: '' };
  if (h === 'all-in' || h === 'allin' || h === 'jam' || h === 'shove') return { type: 'all-in', sizeBB: '' };
  const raiseMatch = h.match(/^(?:raise|bet|open)\s*[\s:]?\s*([\d.]+)?/);
  if (raiseMatch) return { type: 'raise', sizeBB: raiseMatch[1] || '2.0' };
  const threebetMatch = h.match(/^(?:3-?bet|threebet)\s*[\s:]?\s*([\d.]+)?/);
  if (threebetMatch) return { type: '3bet', sizeBB: threebetMatch[1] || '7.0' };
  return null;
}

function parseWholeStrategy(input: string): WholeStrategyResult {
  const lines = input.split('\n').map(l => l.trim());
  const errors: string[] = [];
  const actionSections: { action: { type: ActionBox['actionType']; sizeBB: string }; lines: string[] }[] = [];
  let currentSection: { action: { type: ActionBox['actionType']; sizeBB: string }; lines: string[] } | null = null;
  let detectedFormat = 'unknown';

  for (const line of lines) {
    if (!line) continue;
    const detected = detectActionFromHeader(line);
    if (detected) {
      currentSection = { action: detected, lines: [] };
      actionSections.push(currentSection);
      detectedFormat = detectedFormat === 'unknown' ? 'sectioned' : detectedFormat;
      continue;
    }
    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      // No header yet — try auto-detect: single block of hands with inline action markers
      detectedFormat = 'flat';
    }
  }

  if (actionSections.length > 0) {
    const boxes = actionSections
      .filter(s => s.lines.length > 0)
      .map((s, i) => ({
        actionType: s.action.type,
        sizeBB: s.action.sizeBB,
        pasteText: s.lines.join('\n'),
      }));
    return { actionBoxes: boxes, errors, detectedFormat: 'sectioned' };
  }

  // Flat format: try to detect action tokens inline (e.g., "AA raise 2.0 100%, KK call 50%")
  const tokens = input.split(/[,\n;]+/).map(t => t.trim()).filter(t => t.length > 0);
  if (tokens.length === 0) {
    return { actionBoxes: [], errors: ['No data found in input'], detectedFormat: 'unknown' };
  }

  // Check if tokens have action keywords embedded
  const actionGroups: Record<string, string[]> = {};
  let hasInlineActions = false;
  for (const token of tokens) {
    const parts = token.split(/\s+/);
    const hand = parts[0]?.toUpperCase() || '';
    const remaining = parts.slice(1).join(' ').toLowerCase();
    const detected = detectActionFromHeader(remaining) || detectActionFromHeader(parts.slice(1).join(' '));
    if (detected) {
      hasInlineActions = true;
      const label = detected.type === 'raise' ? `raise_${detected.sizeBB}` : detected.type === '3bet' ? `3bet_${detected.sizeBB}` : detected.type === 'all-in' ? 'all-in' : detected.type;
      if (!actionGroups[label]) actionGroups[label] = [];
      const freqPart = parts[parts.length - 1].replace('%', '');
      const freq = parseFloat(freqPart);
      if (!isNaN(freq) && freq <= 100 && freq > 1) {
        actionGroups[label].push(`${hand} ${freq}%`);
      } else {
        actionGroups[label].push(hand);
      }
    }
  }

  if (hasInlineActions) {
    const boxes = Object.entries(actionGroups).map(([label, hands]) => {
      if (label === 'all-in') return { actionType: 'all-in' as const, sizeBB: '', pasteText: hands.join('\n') };
      if (label === 'call') return { actionType: 'call' as const, sizeBB: '', pasteText: hands.join('\n') };
      if (label === 'limp') return { actionType: 'limp' as const, sizeBB: '', pasteText: hands.join('\n') };
      if (label.startsWith('raise_')) return { actionType: 'raise' as const, sizeBB: label.replace('raise_', ''), pasteText: hands.join('\n') };
      if (label.startsWith('3bet_')) return { actionType: '3bet' as const, sizeBB: label.replace('3bet_', ''), pasteText: hands.join('\n') };
      return { actionType: 'custom' as const, sizeBB: label, pasteText: hands.join('\n') };
    });
    return { actionBoxes: boxes, errors, detectedFormat: 'inline' };
  }

  return { actionBoxes: [], errors: ['UNRECOGNIZED STRATEGY FORMAT — could not detect action sections or inline action markers. Use Action-by-Action mode.'], detectedFormat: 'unknown' };
}

// ── Tree / Batch Logic ──

function getPositionsForTable(tableSize: number): SolverPosition[] {
  if (tableSize <= 2) return ['SB', 'BB'];
  if (tableSize <= 3) return ['BTN', 'SB', 'BB'];
  if (tableSize <= 4) return ['CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 6) return ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 7) return ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  return ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
}

// BB has no unopened (first-in) decision — if everyone folds to BB, the hand ends.
// This helper returns only positions that can make a first-in unopened decision.
function getUnopenedPositions(tableSize: number): SolverPosition[] {
  return getPositionsForTable(tableSize).filter(p => p !== 'BB');
}

function generateActionHistory(batch: BatchType, openerPos: string, openSize: number, responderPos: string, tableSize: number): StructuredAction[] {
  const positions = getPositionsForTable(tableSize);
  if (batch === 'unopened') return [];

  if (batch === 'vs_open') {
    const openerIdx = positions.indexOf(openerPos as SolverPosition);
    const responderIdx = positions.indexOf(responderPos as SolverPosition);
    const history: StructuredAction[] = [{ position: openerPos, action: 'raise', size_bb: openSize }];
    for (let i = openerIdx + 1; i < responderIdx; i++) {
      history.push({ position: positions[i], action: 'fold' });
    }
    return history;
  }

  if (batch === 'opener_vs_3bet') {
    const openerIdx = positions.indexOf(openerPos as SolverPosition);
    const responderIdx = positions.indexOf(responderPos as SolverPosition);
    const history: StructuredAction[] = [{ position: openerPos, action: 'raise', size_bb: openSize }];
    for (let i = openerIdx + 1; i < responderIdx; i++) {
      history.push({ position: positions[i], action: 'fold' });
    }
    history.push({ position: responderPos, action: '3bet', size_bb: 7.0 });
    return history;
  }

  return [];
}

function getNextBatchNode(batch: BatchType, currentPos: string, tableSize: number, openSize: number, openerPos: string): { heroPosition: SolverPosition; actionHistory: StructuredAction[] } | null {
  const positions = batch === 'unopened' ? getUnopenedPositions(tableSize) : getPositionsForTable(tableSize);
  const currentIdx = positions.indexOf(currentPos as SolverPosition);
  if (currentIdx === -1) return null;

  if (batch === 'unopened') {
    if (currentIdx + 1 < positions.length) {
      return { heroPosition: positions[currentIdx + 1], actionHistory: [] };
    }
    return null;
  }

  if (batch === 'vs_open' || batch === 'opener_vs_3bet') {
    if (currentIdx + 1 < positions.length) {
      const nextPos = positions[currentIdx + 1];
      return {
        heroPosition: nextPos,
        actionHistory: generateActionHistory(batch, openerPos, openSize, nextPos, tableSize),
      };
    }
    return null;
  }

  return null;
}

function getBatchNodes(batch: BatchType, tableSize: number, openSize: number, openerPos: string): { heroPosition: SolverPosition; actionHistory: StructuredAction[] }[] {
  const positions = batch === 'unopened' ? getUnopenedPositions(tableSize) : getPositionsForTable(tableSize);
  const nodes: { heroPosition: SolverPosition; actionHistory: StructuredAction[] }[] = [];

  if (batch === 'unopened') {
    for (const pos of positions) {
      nodes.push({ heroPosition: pos, actionHistory: [] });
    }
  } else if (batch === 'vs_open' || batch === 'opener_vs_3bet') {
    const openerIdx = positions.indexOf(openerPos as SolverPosition);
    for (let i = openerIdx + 1; i < positions.length; i++) {
      const pos = positions[i];
      nodes.push({ heroPosition: pos, actionHistory: generateActionHistory(batch, openerPos, openSize, pos, tableSize) });
    }
  }

  return nodes;
}

function describeTreePath(batch: BatchType, heroPosition: string, actionHistory: StructuredAction[], openSize: number, openerPos: string): string {
  if (batch === 'unopened') return `${heroPosition} — Unopened`;
  if (batch === 'vs_open') {
    return `${heroPosition} vs ${openerPos} Open ${openSize}bb`;
  }
  if (batch === 'opener_vs_3bet') {
    const threebet = actionHistory.find(a => a.action === '3bet');
    return `${heroPosition} vs ${threebet?.position ?? '?'} 3-Bet ${threebet?.size_bb ?? 7} (after ${openerPos} open ${openSize}bb)`;
  }
  return heroPosition;
}

// ── Mixed Frequency Matrix ──

function MixedFreqMatrix({ strategyData, selectedHand, onSelectHand }: {
  strategyData: Record<string, Record<string, number>>;
  selectedHand?: string;
  onSelectHand?: (hand: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(400);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => { const { width, height } = entries[0].contentRect; setGridSize(Math.min(width, height)); });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  const handStrategy = useMemo(() => combosTo169(strategyData), [strategyData]);
  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 items-center justify-center p-2">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)', gridTemplateRows: 'repeat(13, 1fr)', width: `${gridSize}px`, height: `${gridSize}px`, maxWidth: '100%', maxHeight: '100%' }}>
        {HAND_CELLS.map(hand => {
          const freqs = handStrategy[hand] || [];
          const isSelected = selectedHand === hand;
          const stops: string[] = [];
          let acc = 0;
          for (const f of freqs) {
            if (f.frequency <= 0) continue;
            const color = actionColor(f.action);
            const start = acc; acc += f.frequency;
            stops.push(`${color} ${(start * 100).toFixed(1)}% ${(acc * 100).toFixed(1)}%`);
          }
          const bg = stops.length > 0 ? `linear-gradient(90deg, ${stops.join(', ')})` : '#1a1a1a';
          return (
            <div key={hand} onClick={() => onSelectHand?.(hand)} title={`${hand}: ${freqs.map(f => `${actionDisplayLabel(f.action)} ${(f.frequency * 100).toFixed(0)}%`).join(', ') || '100% Fold'}`} className="flex items-center justify-center rounded-[2px] cursor-pointer transition-all hover:ring-1 hover:ring-white/30" style={{ background: bg, outline: isSelected ? '2px solid #d4a52c' : 'none', fontSize: `${Math.max(7, gridSize / 20)}px`, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              {hand}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ValidationSummary({ result }: { result: BuildResult }) {
  if (result.errors.length > 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-300"><AlertCircle className="h-3.5 w-3.5" /> VALIDATION FAILED</div>
        {result.errors.slice(0, 5).map((e, i) => <div key={i} className="flex items-start gap-1.5 text-[10px] text-red-300/80"><span className="text-red-400/60">•</span> {e}</div>)}
        {result.errors.length > 5 && <div className="text-[10px] text-red-300/60">...and {result.errors.length - 5} more</div>}
      </div>
    );
  }
  const checks = [{ label: '1,326 combos resolved', ok: true }, { label: 'Frequencies valid', ok: true }, { label: 'No combo >100%', ok: true }, { label: 'Residual fold applied', ok: true }, { label: 'Canonical mapping valid', ok: true }];
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300"><Check className="h-3.5 w-3.5" /> VALIDATION PASSED</div>
      {checks.map((c, i) => <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/50"><Check className="h-3 w-3 text-emerald-400/60" /> {c.label}</div>)}
    </div>
  );
}

function ActionFreqBars({ freqs }: { freqs: Record<string, number> }) {
  const entries = Object.entries(freqs).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-mono tracking-widest text-white/40 uppercase mb-1">Action Frequencies</div>
      {entries.map(([action, freq]) => (
        <div key={action} className="flex items-center gap-2 text-[10px]">
          <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: actionColor(action) }} />
          <span className="font-semibold text-white/70 w-24 truncate">{actionDisplayLabel(action)}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${freq * 100}%`, backgroundColor: actionColor(action) }} /></div>
          <span className="text-white/40 w-12 text-right">{(freq * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Action Range Box ──

function ActionRangeBox({ box, expanded, onToggleExpand, onUpdate, onRemove, boxErrors }: {
  box: ActionBox; expanded: boolean; onToggleExpand: () => void; onUpdate: (id: string, changes: Partial<ActionBox>) => void; onRemove: (id: string) => void; boxErrors: string[] | undefined;
}) {
  const [showParsed, setShowParsed] = useState(false);
  const parsed = useMemo(() => box.pasteText.trim() ? parsePasteBox(box.pasteText) : null, [box.pasteText]);
  const unique169 = parsed ? countUnique169(parsed.combos) : 0;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3">
      <div className="mb-2 flex items-center gap-2">
        <select value={box.actionType} onChange={e => onUpdate(box.id, { actionType: e.target.value as ActionBox['actionType'] })} className={`${INPUT_CLS} w-24`}>
          <option value="raise">Raise</option><option value="3bet">3-Bet</option><option value="call">Call</option><option value="limp">Limp</option><option value="all-in">All-In</option><option value="custom">Custom</option>
        </select>
        {(box.actionType === 'raise' || box.actionType === '3bet' || box.actionType === 'custom') && (
          <><input type="number" step="0.1" value={box.sizeBB} placeholder="size" onChange={e => onUpdate(box.id, { sizeBB: e.target.value })} className={`${INPUT_CLS} w-20`} /><span className="text-[10px] text-white/40">BB</span></>
        )}
        <span className="ml-auto text-[9px] font-mono text-white/30">{buildActionLabel(box)}</span>
        <button onClick={onToggleExpand} className="text-white/40 hover:text-white/80" title={expanded ? 'Collapse' : 'Expand'}>{expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
        <button onClick={() => onRemove(box.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <textarea value={box.pasteText} onChange={e => onUpdate(box.id, { pasteText: e.target.value })} placeholder="AA, KK, QQ, AKs&#10;AdAc, AhKh&#10;A5s 30%" className="w-full rounded-lg border border-white/10 bg-[#050709] p-2.5 font-mono text-[10px] text-white/70 outline-none focus:border-[#d4a52c]/40 overflow-y-auto" style={{ height: expanded ? '400px' : '180px', resize: 'vertical', minHeight: '120px' }} />
      {parsed && (
        <div className="mt-1.5 space-y-1">
          <div className={`text-[9px] ${parsed.errors.length ? 'text-red-300/70' : 'text-emerald-300/70'}`}>{Object.keys(parsed.combos).length} combos · {unique169} unique 169 hands · {parsed.errors.length} error(s)</div>
          <button onClick={() => setShowParsed(s => !s)} className="flex items-center gap-1 text-[9px] text-[#d4a52c]/60 hover:text-[#d4a52c]">{showParsed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{showParsed ? 'Hide' : 'View'} Parsed Hands</button>
          {showParsed && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded border border-white/[0.06] bg-black/40 p-2">
              <div className="flex flex-wrap gap-1">{Object.entries(parsed.combos).map(([combo, freq]) => <span key={combo} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-white/60">{combo}{freq < 1 ? ` ${(freq * 100).toFixed(0)}%` : ''}</span>)}</div>
            </div>
          )}
        </div>
      )}
      {boxErrors && (
        <div className="mt-1.5 rounded border border-red-500/20 bg-red-500/5 p-2">
          {boxErrors.map((e, i) => <div key={i} className="flex items-start gap-1.5 text-[9px] text-red-300/80"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> {e}</div>)}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function PreflopRangeImporter() {
  const [subView, setSubView] = useState<'import' | 'tree' | 'coverage' | 'library'>('import');
  const [importPrefill, setImportPrefill] = useState<ImportPrefill | null>(null);
  const [libraryFocusNode, setLibraryFocusNode] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-[#c0911e]/15 bg-[#050709]/94 shadow-2xl" style={SHELL_STYLE}>
        <div className="shrink-0 border-b border-white/[0.06] px-5 py-3">
          <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Preflop Reference Library</div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">Preflop Ranges</h1>
        </div>
        <div className="shrink-0 flex gap-1.5 border-b border-white/[0.06] px-5 py-2">
          {(['import', 'tree', 'coverage', 'library'] as const).map(v => (
            <button key={v} onClick={() => { setSubView(v); setImportPrefill(null); setLibraryFocusNode(null); }} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition ${subView === v ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>{v === 'library' ? 'Library' : v === 'tree' ? 'Tree' : v}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {subView === 'import' && <ImportView prefill={importPrefill} onGoLibrary={() => setSubView('library')} onGoCoverage={() => setSubView('coverage')} />}
          {subView === 'tree' && <TreeView onOpenImport={(identity) => { setImportPrefill(identity); setSubView('import'); }} />}
          {subView === 'coverage' && <CoverageView onOpenImport={(identity) => { setImportPrefill(identity); setSubView('import'); }} onOpenLibrary={(nodeId) => { setLibraryFocusNode(nodeId); setSubView('library'); }} />}
          {subView === 'library' && <LibraryView focusNodeId={libraryFocusNode} onEditRange={(prefill) => { setImportPrefill(prefill); setSubView('import'); }} />}
        </div>
      </div>
    </div>
  );
}

// ── Import View ──

function ImportView({ prefill, onGoLibrary, onGoCoverage }: { prefill: ImportPrefill | null; onGoLibrary: () => void; onGoCoverage: () => void }) {
  const [format, setFormat] = usePersistentState<SolverFormat>('preflop-import-format', 'tournament');
  const [solveType, setSolveType] = usePersistentState<'chipev' | 'icm'>('preflop-import-solveType', 'chipev');
  const [tableSize, setTableSize] = usePersistentState<number>('preflop-import-tableSize', 8);
  const [stackBB, setStackBB] = usePersistentState<number>('preflop-import-stackBB', 40);
  const [anteType, setAnteType] = usePersistentState<typeof ANTE_TYPES[number]>('preflop-import-anteType', 'bb_ante');
  const [anteBB, setAnteBB] = usePersistentState<number>('preflop-import-anteBB', 1);
  const [heroPosition, setHeroPosition] = usePersistentState<SolverPosition>('preflop-import-heroPosition', 'UTG');
  const [actionHistory, setActionHistory] = useState<StructuredAction[]>([]);
  const [sourceName, setSourceName] = usePersistentState('preflop-import-sourceName', 'GTO reference');
  const [sourceVersion, setSourceVersion] = usePersistentState('preflop-import-sourceVersion', '');
  const [notes, setNotes] = useState('');
  const [actionBoxes, setActionBoxes] = useState<ActionBox[]>([
    { id: '1', actionType: 'raise', sizeBB: '2.0', pasteText: '' },
    { id: '2', actionType: 'all-in', sizeBB: '', pasteText: '' },
  ]);
  const [preview, setPreview] = useState<BuildResult | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, Record<string, number>>>(ALL_FOLD_DATA);
  const [previewFreqs, setPreviewFreqs] = useState<Record<string, number>>(ALL_FOLD_FREQS);
  const [stage, setStage] = useState<PreviewStage>('initial');
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string; nodeInfo?: string; nextNode?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'new_version' | 'replace_active'>('new_version');
  const [selectedHand, setSelectedHand] = useState<string | undefined>(undefined);
  const [boxErrors, setBoxErrors] = useState<Record<string, string[]>>({});
  const [expandedBoxes, setExpandedBoxes] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [positionSetComplete, setPositionSetComplete] = useState(false);
  const [importMode, setImportMode] = usePersistentState<ImportMode>('preflop-import-mode', 'whole');
  const [wholeStrategyText, setWholeStrategyText] = useState('');
  const [wholeParseResult, setWholeParseResult] = useState<WholeStrategyResult | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [rapidImport, setRapidImport] = usePersistentState<boolean>('preflop-import-rapid', true);
  const [batchType, setBatchType] = useState<BatchType>('unopened');
  const [openSize, setOpenSize] = useState(2.0);
  const [openerPos, setOpenerPos] = useState<string>('UTG');
  const [history, setHistory] = useState<{ position: SolverPosition; actionHistory: StructuredAction[] }[]>([]);

  const resetPreview = useCallback(() => {
    setPreview(null); setPreviewData(ALL_FOLD_DATA); setPreviewFreqs(ALL_FOLD_FREQS);
    setStage('initial'); setSaveResult(null); setSelectedHand(undefined); setBoxErrors({});
    setPositionSetComplete(false); setWholeStrategyText(''); setWholeParseResult(null);
  }, []);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.format) setFormat(prefill.format);
    if (prefill.solve_type) setSolveType(prefill.solve_type);
    if (prefill.table_size) setTableSize(prefill.table_size);
    if (prefill.stack_bb) setStackBB(prefill.stack_bb);
    if (prefill.ante_type) setAnteType(prefill.ante_type);
    if (prefill.ante_bb) setAnteBB(prefill.ante_bb);
    if (prefill.hero_position) setHeroPosition(prefill.hero_position);
    if (prefill.action_history) setActionHistory(prefill.action_history);
    if (prefill.editMode && prefill.strategyData && prefill.availableActions) {
      setIsEditMode(true);
      const boxes = actionsToBoxes(prefill.availableActions);
      for (const box of boxes) box.pasteText = strategyDataToPasteText(prefill.strategyData, buildActionLabel(box));
      setActionBoxes(boxes);
      if (prefill.sourceName) setSourceName(prefill.sourceName);
      if (prefill.sourceVersion) setSourceVersion(prefill.sourceVersion);
      if (prefill.notes) setNotes(prefill.notes);
      const result = buildStrategyData(boxes);
      setPreview(result); setPreviewData(result.strategyData); setPreviewFreqs(result.actionFreqs); setStage('previewed');
    } else {
      setIsEditMode(false); resetPreview();
    }
  }, [prefill]);

  const nodeConfigKey = `${format}-${solveType}-${tableSize}-${stackBB}-${anteType}-${anteBB}-${heroPosition}-${JSON.stringify(actionHistory)}`;
  const prevNodeKey = useRef(nodeConfigKey);
  useEffect(() => {
    if (prevNodeKey.current !== nodeConfigKey) { prevNodeKey.current = nodeConfigKey; if (!isEditMode) resetPreview(); }
  }, [nodeConfigKey, resetPreview, isEditMode]);

  // When rapid import is on and batch/position changes, auto-set action history
  useEffect(() => {
    if (!rapidImport || isEditMode) return;
    if (batchType === 'unopened') {
      setActionHistory([]);
    } else {
      setActionHistory(generateActionHistory(batchType, openerPos, openSize, heroPosition, tableSize));
    }
  }, [rapidImport, batchType, openerPos, openSize, heroPosition, tableSize, isEditMode]);

  // Auto-repair: BB can never be an unopened first-in position. If heroPosition is BB
  // and batch is unopened, reset to the first unopened position.
  useEffect(() => {
    if (batchType === 'unopened' && heroPosition === 'BB') {
      const unopened = getUnopenedPositions(tableSize);
      setHeroPosition(unopened[0] ?? 'UTG');
      resetPreview();
    }
  }, [batchType, heroPosition, tableSize, setHeroPosition, resetPreview]);

  const buildIdentity = useCallback((): ReferenceNodeIdentity => ({
    format, solve_type: solveType, table_size: tableSize, stack_bb: stackBB,
    ante_type: anteType, ante_bb: anteBB, hero_position: heroPosition, action_history: actionHistory,
  }), [format, solveType, tableSize, stackBB, anteType, anteBB, heroPosition, actionHistory]);

  const handleParseWholeStrategy = () => {
    if (!wholeStrategyText.trim()) return;
    const result = parseWholeStrategy(wholeStrategyText);
    setWholeParseResult(result);
    if (result.actionBoxes.length > 0 && result.errors.length === 0) {
      const newBoxes: ActionBox[] = result.actionBoxes.map((b, i) => ({ id: `whole-${i}-${Date.now()}`, actionType: b.actionType, sizeBB: b.sizeBB, pasteText: b.pasteText }));
      setActionBoxes(newBoxes);
    }
  };

  const handlePreview = () => {
    const newBoxErrors: Record<string, string[]> = {};
    let hasErrors = false;
    for (const box of actionBoxes) {
      if (!box.pasteText.trim()) continue;
      const parsed = parsePasteBox(box.pasteText);
      if (parsed.errors.length > 0) { newBoxErrors[box.id] = parsed.errors; hasErrors = true; }
    }
    setBoxErrors(newBoxErrors);
    if (hasErrors) { setStage('initial'); return; }
    const result = buildStrategyData(actionBoxes);
    setPreview(result); setPreviewData(result.strategyData); setPreviewFreqs(result.actionFreqs);
    setStage('previewed'); setSaveResult(null); setSelectedHand(undefined);
  };

  const handleValidate = () => { if (!preview) return; if (preview.validated) setStage('validated'); else setStage('previewed'); };

  const handleSave = async (): Promise<boolean> => {
    if (!preview || !preview.validated || stage !== 'validated') return false;
    setSaving(true);
    let success = false;
    try {
      const availableActions = buildAvailableActions(actionBoxes);
      const res = await saveReferenceRange({
        identity: buildIdentity(), available_actions: availableActions, strategy_data: preview.strategyData,
        is_partial: false, source_name: sourceName, source_version: sourceVersion || undefined,
        notes: notes || undefined, on_duplicate: duplicateAction,
      });
      if (res.success) {
        success = true;
        const nodeStr = `${format === 'tournament' ? 'MTT' : 'Cash'} · ${tableSize}-Max · ${stackBB}bb · ${solveType === 'chipev' ? 'ChipEV' : 'ICM'} · ${anteType === 'bb_ante' ? `BB Ante ${anteBB}bb` : anteType === 'none' ? 'No Ante' : `Per Player ${anteBB}bb`} · ${heroPosition} ${actionHistory.length === 0 ? 'Unopened' : actionHistory.map(a => `${a.position} ${a.action}`).join(' → ')}`;
        // Save to history for Previous Node
        setHistory(h => [...h, { position: heroPosition, actionHistory: [...actionHistory] }]);

        if (isEditMode) {
          setSaveResult({ success: true, message: 'Range saved successfully.', nodeInfo: nodeStr });
          setStage('saved');
          setActionBoxes(boxes => boxes.map(b => ({ ...b, pasteText: '' })));
          resetPreview();
        } else if (rapidImport) {
          const nextNode = getNextBatchNode(batchType, heroPosition, tableSize, openSize, openerPos);
          if (nextNode) {
            const nextDesc = describeTreePath(batchType, nextNode.heroPosition, nextNode.actionHistory, openSize, openerPos);
            setSaveResult({ success: true, message: 'Range saved successfully.', nodeInfo: nodeStr, nextNode: nextDesc });
            setActionBoxes(boxes => boxes.map(b => ({ ...b, pasteText: '' })));
            setHeroPosition(nextNode.heroPosition);
            setActionHistory(nextNode.actionHistory);
            resetPreview();
          } else {
            setSaveResult({ success: true, message: 'Range saved successfully.', nodeInfo: nodeStr });
            setPositionSetComplete(true);
            setActionBoxes(boxes => boxes.map(b => ({ ...b, pasteText: '' })));
            resetPreview();
          }
        } else {
          // Standard auto-advance for non-rapid mode (BB excluded from unopened)
          const positions = batchType === 'unopened' ? getUnopenedPositions(tableSize) : getPositionsForTable(tableSize);
          const currentIdx = positions.indexOf(heroPosition);
          const nextIdx = currentIdx + 1;
          if (nextIdx < positions.length) {
            setSaveResult({ success: true, message: 'Range saved successfully.', nodeInfo: nodeStr });
            setActionBoxes(boxes => boxes.map(b => ({ ...b, pasteText: '' })));
            setHeroPosition(positions[nextIdx]);
            resetPreview();
          } else {
            setSaveResult({ success: true, message: 'Range saved successfully.', nodeInfo: nodeStr });
            setPositionSetComplete(true);
            setActionBoxes(boxes => boxes.map(b => ({ ...b, pasteText: '' })));
            resetPreview();
          }
        }
      } else {
        setSaveResult({ success: false, message: res.error ?? 'Save failed' });
      }
    } catch (e) {
      setSaveResult({ success: false, message: (e as Error).message });
    }
    setSaving(false);
    return success;
  };

  const handleSkip = () => {
    if (!rapidImport) return;
    setHistory(h => [...h, { position: heroPosition, actionHistory: [...actionHistory] }]);
    const nextNode = getNextBatchNode(batchType, heroPosition, tableSize, openSize, openerPos);
    if (nextNode) {
      setHeroPosition(nextNode.heroPosition);
      setActionHistory(nextNode.actionHistory);
      resetPreview();
    } else {
      setPositionSetComplete(true);
      resetPreview();
    }
  };

  const handlePrevious = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setHeroPosition(prev.position);
    setActionHistory(prev.actionHistory);
    resetPreview();
  };

  const addActionBox = () => setActionBoxes(boxes => [...boxes, { id: crypto.randomUUID(), actionType: 'raise', sizeBB: '2.5', pasteText: '' }]);
  const removeActionBox = (id: string) => setActionBoxes(boxes => boxes.filter(b => b.id !== id));
  const updateBox = (id: string, changes: Partial<ActionBox>) => { setActionBoxes(boxes => boxes.map(b => b.id === id ? { ...b, ...changes } : b)); setBoxErrors(prev => { const n = { ...prev }; delete n[id]; return n; }); };
  const toggleExpand = (id: string) => setExpandedBoxes(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const addHistoryAction = () => setActionHistory([...actionHistory, { position: 'UTG', action: 'raise', size_bb: 2.0 }]);

  const nodeSummary = `${format === 'tournament' ? 'MTT' : 'Cash'} · ${tableSize}-Max · ${stackBB}bb · ${solveType === 'chipev' ? 'ChipEV' : 'ICM'} · ${anteType === 'bb_ante' ? `BB Ante ${anteBB}bb` : anteType === 'none' ? 'No Ante' : `Per ${anteBB}bb`} · ${heroPosition} ${actionHistory.length === 0 ? 'Unopened' : actionHistory.map(a => `${a.position} ${a.action}${a.size_bb ? ` ${a.size_bb}bb` : ''}`).join(' → ')}`;
  const treePath = rapidImport ? describeTreePath(batchType, heroPosition, actionHistory, openSize, openerPos) : nodeSummary;

  const stageLabel = stage === 'initial' ? 'INITIAL — All combos default to Fold' : stage === 'previewed' ? 'PREVIEW READY — Not saved' : stage === 'validated' ? 'VALIDATED — Ready to save' : 'SAVED — Active reference version';
  const stageColor = stage === 'initial' ? 'text-blue-300' : stage === 'previewed' ? 'text-amber-300' : stage === 'validated' ? 'text-emerald-300' : 'text-emerald-300';

  const batchPositions = batchType === 'unopened' ? getUnopenedPositions(tableSize) : getPositionsForTable(tableSize).filter(p => getPositionsForTable(tableSize).indexOf(p) > getPositionsForTable(tableSize).indexOf(openerPos as SolverPosition));
  const completedCount = batchPositions.indexOf(heroPosition);
  const nextBatchNode = rapidImport ? getNextBatchNode(batchType, heroPosition, tableSize, openSize, openerPos) : null;
  const nextNodeDesc = nextBatchNode ? describeTreePath(batchType, nextBatchNode.heroPosition, nextBatchNode.actionHistory, openSize, openerPos) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Rapid Import Banner */}
      {rapidImport && (
        <div className="shrink-0 border-b border-[#d4a52c]/20 bg-gradient-to-r from-[#d4a52c]/8 to-[#d4a52c]/3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 shrink-0 text-[#d4a52c]" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono tracking-widest text-[#d4a52c]/70 uppercase">Rapid Import — {batchType === 'unopened' ? 'Unopened' : batchType === 'vs_open' ? 'VS Open' : 'Opener VS 3-Bet'}</div>
              <div className="mt-0.5 text-[13px] font-bold text-[#f5e6b0]">{treePath}</div>
              <div className="mt-0.5 text-[10px] text-white/40">
                {stackBB} BB · {tableSize}-Max · {solveType === 'chipev' ? 'ChipEV' : 'ICM'} · {anteType === 'bb_ante' ? `BB Ante ${anteBB}bb` : anteType === 'none' ? 'No Ante' : `Per Player ${anteBB}bb`}
              </div>
            </div>
            {/* Progress */}
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-mono text-white/50">{Math.max(0, completedCount)} / {batchPositions.length} complete</div>
              <div className="mt-1 flex flex-wrap gap-1 justify-end">
                {batchPositions.map((pos, i) => (
                  <span key={pos} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${i < completedCount ? 'bg-emerald-400/15 text-emerald-300' : i === completedCount ? 'bg-[#d4a52c]/20 text-[#f5e6b0] ring-1 ring-[#d4a52c]/40' : 'bg-white/5 text-white/30'}`}>
                    {pos}{i < completedCount ? ' ✓' : i === completedCount ? ' ●' : ''}
                  </span>
                ))}
              </div>
            </div>
            {/* Next node */}
            {nextNodeDesc && (
              <div className="shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-right">
                <div className="text-[9px] font-mono tracking-widest text-emerald-300/60 uppercase">Next after save</div>
                <div className="text-[10px] font-bold text-emerald-200">{nextNodeDesc}</div>
              </div>
            )}
            {/* Skip / Previous */}
            {!isEditMode && (
              <div className="shrink-0 flex flex-col gap-1">
                <button onClick={handleSkip} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/50 hover:bg-white/5"><SkipForward className="h-3 w-3" />Skip For Now</button>
                <button onClick={handlePrevious} disabled={history.length === 0} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-semibold ${history.length === 0 ? 'border-white/5 text-white/20 cursor-not-allowed' : 'border-white/10 text-white/50 hover:bg-white/5'}`}><ArrowLeft className="h-3 w-3" />Previous Node</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Node Configuration */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#080a0c]/80 px-4 py-2">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div><div className={LABEL_CLS}>Format</div><select value={format} onChange={e => setFormat(e.target.value as SolverFormat)} className={INPUT_CLS}><option value="tournament">MTT</option><option value="cash">Cash</option></select></div>
          <div><div className={LABEL_CLS}>Table</div><select value={tableSize} onChange={e => setTableSize(parseInt(e.target.value) || 8)} className={INPUT_CLS}>{[2, 3, 4, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}-Max</option>)}</select></div>
          <div><div className={LABEL_CLS}>Stack</div><select value={stackBB} onChange={e => setStackBB(parseInt(e.target.value) || 40)} className={INPUT_CLS}>{STACK_PRESETS.map(s => <option key={s} value={s}>{s} BB</option>)}</select></div>
          <div><div className={LABEL_CLS}>Solve</div><select value={solveType} onChange={e => setSolveType(e.target.value as 'chipev' | 'icm')} className={INPUT_CLS}><option value="chipev">ChipEV</option><option value="icm">ICM</option></select></div>
          <div><div className={LABEL_CLS}>Ante</div><div className="flex items-center gap-1"><select value={anteType} onChange={e => setAnteType(e.target.value as typeof ANTE_TYPES[number])} className={INPUT_CLS}>{ANTE_TYPES.map(a => <option key={a} value={a}>{a === 'bb_ante' ? 'BB Ante' : a === 'per_player' ? 'Per Player' : 'None'}</option>)}</select>{anteType !== 'none' && <input type="number" step="0.5" value={anteBB} onChange={e => setAnteBB(parseFloat(e.target.value) || 0)} className={`${INPUT_CLS} w-14`} />}</div></div>
          <div><div className={LABEL_CLS}>Position</div><select value={heroPosition} onChange={e => setHeroPosition(e.target.value as SolverPosition)} className={INPUT_CLS}>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          {!rapidImport && (
            <div className="min-w-[120px]"><div className={LABEL_CLS}>Action History</div>{actionHistory.length === 0 ? <span className="text-[10px] text-white/30 italic">Unopened</span> : <span className="text-[10px] text-white/50">{actionHistory.map(a => `${a.position} ${a.action}`).join(' → ')}</span>}<button onClick={addHistoryAction} className="ml-2 text-[9px] text-[#d4a52c]/60 hover:text-[#d4a52c]">+ Add</button></div>
          )}
          {isEditMode && <div className="ml-auto rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-1 text-[9px] font-bold text-[#f5e6b0]">EDIT MODE — New version will be created</div>}
        </div>
        {/* Rapid Import Controls */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={() => { setRapidImport(!rapidImport); resetPreview(); }} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${rapidImport ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            <Zap className="h-3 w-3" /> Rapid Import
          </button>
          {rapidImport && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-white/40">Batch:</span>
                <select value={batchType} onChange={e => { setBatchType(e.target.value as BatchType); resetPreview(); }} className={`${INPUT_CLS} w-36`}>
                  <option value="unopened">Unopened</option>
                  <option value="vs_open">VS Open</option>
                  <option value="opener_vs_3bet">Opener VS 3-Bet</option>
                </select>
              </div>
              {batchType !== 'unopened' && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-white/40">Opener:</span>
                    <select value={openerPos} onChange={e => { setOpenerPos(e.target.value); resetPreview(); }} className={`${INPUT_CLS} w-20`}>
                      {getPositionsForTable(tableSize).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-white/40">Open Size:</span>
                    <input type="number" step="0.1" value={openSize} onChange={e => { setOpenSize(parseFloat(e.target.value) || 2); resetPreview(); }} className={`${INPUT_CLS} w-16`} />
                    <span className="text-[10px] text-white/40">bb</span>
                  </div>
                </>
              )}
              <div className="text-[9px] text-white/30">{batchPositions.length} nodes in batch · {batchPositions.indexOf(heroPosition) + 1} / {batchPositions.length}</div>
            </>
          )}
        </div>
        {actionHistory.length > 0 && !rapidImport && (
          <div className="mt-2 space-y-1">
            {actionHistory.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-white/60">
                <span className="font-mono text-white/40">{i + 1}.</span>
                <select value={a.position} onChange={e => setActionHistory(actionHistory.map((h, idx) => idx === i ? { ...h, position: e.target.value } : h))} className={`${INPUT_CLS} w-20`}>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                <select value={a.action} onChange={e => setActionHistory(actionHistory.map((h, idx) => idx === i ? { ...h, action: e.target.value } : h))} className={`${INPUT_CLS} w-20`}><option value="fold">fold</option><option value="call">call</option><option value="raise">raise</option><option value="all-in">all-in</option></select>
                <input type="number" step="0.1" value={a.size_bb ?? ''} placeholder="size" onChange={e => setActionHistory(actionHistory.map((h, idx) => idx === i ? { ...h, size_bb: parseFloat(e.target.value) || undefined } : h))} className={`${INPUT_CLS} w-16`} />
                <button onClick={() => setActionHistory(actionHistory.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Position set complete banner */}
      {positionSetComplete && (
        <div className="shrink-0 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-400" />
            <div><div className="text-[12px] font-bold text-emerald-300">BATCH COMPLETE</div><div className="text-[10px] text-white/50">{rapidImport ? treePath : nodeSummary.split(' · ').slice(0, 4).join(' · ')} — All nodes in batch entered.</div></div>
            <div className="ml-auto flex gap-2"><button onClick={onGoCoverage} className={BTN_CLS}>View Coverage</button><button onClick={onGoLibrary} className={BTN_CLS}>View Library</button></div>
          </div>
        </div>
      )}

      {/* Main working area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* LEFT: Input workspace */}
        <div className="flex min-h-0 flex-col overflow-hidden lg:w-3/5">
          <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
            {/* Import Mode Toggle */}
            <div className="mb-3 flex items-center gap-2">
              <button onClick={() => setImportMode('whole')} className={`rounded-full border px-3 py-1 text-[9px] font-bold tracking-widest uppercase transition ${importMode === 'whole' ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>Whole Strategy</button>
              <button onClick={() => setImportMode('action')} className={`rounded-full border px-3 py-1 text-[9px] font-bold tracking-widest uppercase transition ${importMode === 'action' ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>Action by Action</button>
              <button onClick={() => setShowDiagnostic(s => !s)} className="ml-auto flex items-center gap-1 text-[9px] text-white/40 hover:text-white/70"><Stethoscope className="h-3 w-3" /> Diagnostic</button>
            </div>

            {/* Linear Step Indicator */}
            <div className="mb-3 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[#0a0c0e] px-3 py-2">
              {(['Paste', 'Parse', 'Preview', 'Validate', 'Save', 'Next'] as const).map((step, i) => {
                const stepStageMap: Record<string, PreviewStage> = { Paste: 'initial', Parse: 'initial', Preview: 'previewed', Validate: 'validated', Save: 'saved', Next: 'saved' };
                const stepOrder = ['initial', 'previewed', 'validated', 'saved'];
                const currentOrder = stepOrder.indexOf(stage);
                const stepOrderIdx = stepOrder.indexOf(stepStageMap[step]);
                const isActive = stepOrderIdx === currentOrder;
                const isDone = stepOrderIdx < currentOrder || (step === 'Save' && stage === 'saved');
                return (
                  <div key={step} className="flex items-center gap-1">
                    <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase transition ${isActive ? 'bg-[#d4a52c]/20 text-[#f5e6b0] ring-1 ring-[#d4a52c]/40' : isDone ? 'text-emerald-300/70' : 'text-white/30'}`}>
                      {isDone && <Check className="h-2.5 w-2.5" />}{step}
                    </span>
                    {i < 5 && <ChevronRight className="h-3 w-3 text-white/20" />}
                  </div>
                );
              })}
            </div>

            {/* Diagnostic View */}
            {showDiagnostic && (
              <div className="mb-3 rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3">
                <div className="text-[10px] font-bold text-white/60 mb-2">Raw Paste Diagnostic</div>
                <textarea value={wholeStrategyText} onChange={e => setWholeStrategyText(e.target.value)} placeholder="Paste a sample copied strategy here to inspect its token structure..." rows={6} className="w-full rounded-lg border border-white/10 bg-[#050709] p-2.5 font-mono text-[10px] text-white/70 outline-none focus:border-[#d4a52c]/40" />
                {wholeStrategyText.trim() && (() => {
                  const tokens = wholeStrategyText.split(/[,\n;]+/).map(t => t.trim()).filter(t => t.length > 0);
                  const lines = wholeStrategyText.split('\n').map(l => l.trim()).filter(l => l);
                  const detectedHeaders = lines.filter(l => detectActionFromHeader(l));
                  return (
                    <div className="mt-2 space-y-1 text-[9px] text-white/50">
                      <div>{tokens.length} tokens · {lines.length} lines · {detectedHeaders.length} action headers detected</div>
                      {detectedHeaders.length > 0 && <div className="text-emerald-300/70">Headers: {detectedHeaders.map(h => `"${h}"`).join(', ')}</div>}
                      <div className="max-h-32 overflow-y-auto rounded border border-white/[0.06] bg-black/40 p-2">
                        {tokens.map((t, i) => <div key={i} className="font-mono text-white/40">{t}</div>)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Whole Strategy Mode — PRIMARY */}
            {importMode === 'whole' && (
              <div className="mb-3 rounded-lg border border-[#d4a52c]/15 bg-[#0a0c0e] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-[#d4a52c]" />
                  <span className="text-[12px] font-bold text-[#f5e6b0]">Paste Complete Strategy</span>
                </div>
                <textarea value={wholeStrategyText} onChange={e => setWholeStrategyText(e.target.value)} placeholder={'Paste entire strategy here.\n\nSpotVault auto-detects action sections:\nRaise 2.0\nAA, KK, QQ, AKs\n\nCall\nJJ, TT, 99\n\nAll-In\nKK, AA\n\nFold is applied as residual automatically.'} className="w-full rounded-lg border border-white/10 bg-[#050709] p-3 font-mono text-[11px] text-white/80 outline-none focus:border-[#d4a52c]/40 overflow-y-auto" style={{ resize: 'vertical', minHeight: '280px' }} />
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={handleParseWholeStrategy} disabled={!wholeStrategyText.trim()} className={`${BTN_CLS} ${!wholeStrategyText.trim() ? 'opacity-50' : ''} text-[11px]`}>Parse Strategy</button>
                  {wholeParseResult && (
                    <div className="text-[10px]">
                      <span className={wholeParseResult.errors.length ? 'text-red-300/70' : 'text-emerald-300/70'}>
                        {wholeParseResult.detectedFormat === 'unknown' ? 'UNRECOGNIZED FORMAT' : `${wholeParseResult.actionBoxes.length} actions detected (${wholeParseResult.detectedFormat})`}
                      </span>
                      {wholeParseResult.errors.map((e, i) => <div key={i} className="text-red-300/70">{e}</div>)}
                    </div>
                  )}
                </div>
                {/* Parsed Actions Summary */}
                {wholeParseResult && wholeParseResult.actionBoxes.length > 0 && wholeParseResult.errors.length === 0 && (
                  <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3">
                    <div className="text-[9px] font-mono tracking-widest text-emerald-300/60 uppercase mb-2">Detected Actions</div>
                    <div className="flex flex-wrap gap-2">
                      {wholeParseResult.actionBoxes.map((b, i) => (
                        <span key={i} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#0a0c0e] px-2.5 py-1 text-[10px]">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: actionColor(buildActionLabel({ actionType: b.actionType, sizeBB: b.sizeBB, pasteText: '', id: '' })) }} />
                          <span className="font-bold text-white/70">{actionDisplayLabel(buildActionLabel({ actionType: b.actionType, sizeBB: b.sizeBB, pasteText: '', id: '' }))}</span>
                          <span className="text-white/40">{b.pasteText.split(/[,\n;]+/).filter(t => t.trim()).length} hands</span>
                        </span>
                      ))}
                      <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#0a0c0e] px-2.5 py-1 text-[10px]">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: actionColor('fold') }} />
                        <span className="font-bold text-white/70">Fold</span>
                        <span className="text-white/40">residual</span>
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] text-white/40">Switch to <span className="text-[#d4a52c]">Action by Action</span> to inspect or edit individual action ranges.</div>
                  </div>
                )}
              </div>
            )}

            {/* Action Boxes — only show in Action-by-Action mode */}
            {importMode === 'action' && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/60">Action Ranges</span>
                  <button onClick={addActionBox} className="rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-1 text-[10px] font-semibold text-[#f5e6b0] hover:bg-[#d4a52c]/20"><Plus className="mr-1 inline h-3 w-3" />Add Action</button>
                </div>
                <div className="mb-2 text-[9px] text-white/30">Paste ranges per action. Hands not mentioned default to 100% Fold. Supports 169-hand notation (AA, AKs), physical combos (AdAc, 4d4c), and comma/newline/semicolon separators.</div>
                <div className="space-y-3">
                  {actionBoxes.map(box => (
                    <ActionRangeBox key={box.id} box={box} expanded={expandedBoxes.has(box.id)} onToggleExpand={() => toggleExpand(box.id)} onUpdate={updateBox} onRemove={removeActionBox} boxErrors={boxErrors[box.id]} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Preview / Validate / Save / Reset buttons */}
          <div className="shrink-0 border-t border-white/[0.06] bg-[#080a0c]/80 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handlePreview} className={BTN_PREVIEW}><Layers className="mr-1.5 inline h-3.5 w-3.5" />Preview Strategy</button>
              {stage === 'previewed' && preview && <button onClick={handleValidate} className={BTN_VALIDATE}><Check className="mr-1.5 inline h-3.5 w-3.5" />Validate Range</button>}
              {stage === 'validated' && preview?.validated && <button onClick={handleSave} disabled={saving} className={`${BTN_SAVE} ${saving ? 'opacity-50' : ''}`}>{saving ? 'Saving...' : isEditMode ? 'Save New Version' : rapidImport ? 'Approve & Save → Next Node' : 'Approve & Save Range'}</button>}
              {!rapidImport && (
                <button onClick={resetPreview} className={`${BTN_RESET} ml-auto`}><RotateCcw className="mr-1 inline h-3 w-3" />Reset Preview</button>
              )}
              {rapidImport && !isEditMode && (
                <button onClick={resetPreview} className={`${BTN_RESET} ml-auto`}><RotateCcw className="mr-1 inline h-3 w-3" />Reset</button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Strategy Preview panel */}
        <div className="flex min-h-0 flex-col overflow-hidden border-t border-white/[0.06] lg:w-2/5 lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-white/[0.06] bg-[#080a0c]/80 px-4 py-2 flex items-center justify-between">
            <div className="text-[10px] font-semibold text-white/60">Strategy Preview — 13x13</div>
            <div className={`text-[9px] font-bold tracking-widest uppercase ${stageColor}`}>{stageLabel}</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080a0c]/60">
            <div className="flex h-full flex-col gap-2 overflow-hidden p-3">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-[#0a0c0e]"><MixedFreqMatrix strategyData={previewData} selectedHand={selectedHand} onSelectHand={setSelectedHand} /></div>
              <div className="shrink-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.06] bg-[#0a0c0e] p-3">
                  {preview ? <ValidationSummary result={preview} /> : (
                    <div className="space-y-1"><div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-300"><Check className="h-3.5 w-3.5" /> INITIAL STATE</div><div className="text-[10px] text-white/50">All 1,326 combos default to Fold (blue).</div><div className="text-[10px] text-white/40">Paste ranges and click Preview Strategy to update.</div></div>
                  )}
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-[#0a0c0e] p-3"><ActionFreqBars freqs={previewFreqs} /><div className="mt-1 text-[9px] text-white/30">1,326 combos</div></div>
              </div>
              {selectedHand && (() => {
                const freqs = combosTo169(previewData)[selectedHand] || [];
                return (
                  <div className="shrink-0 rounded-lg border border-[#d4a52c]/20 bg-[#d4a52c]/5 p-2">
                    <div className="text-[10px] font-bold text-[#f5e6b0]">{selectedHand}</div>
                    <div className="mt-1 flex flex-wrap gap-2">{freqs.map((f, i) => <span key={i} className="flex items-center gap-1 text-[10px] text-white/60"><span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: actionColor(f.action) }} />{actionDisplayLabel(f.action)} {(f.frequency * 100).toFixed(0)}%</span>)}</div>
                  </div>
                );
              })()}
              {saveResult && (
                <div className={`shrink-0 rounded-lg border p-3 ${saveResult.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                  {saveResult.success ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-300"><Check className="h-4 w-4" /> RANGE SAVED</div>
                      <div className="text-[10px] text-white/50"><span className="font-mono text-white/40">Node:</span> {saveResult.nodeInfo || nodeSummary}</div>
                      {saveResult.nextNode && <div className="text-[10px] text-emerald-300">NEXT: {saveResult.nextNode}</div>}
                      {isEditMode && <div className="ml-auto flex gap-2"><button onClick={onGoLibrary} className={BTN_CLS}>Back to Library</button></div>}
                    </div>
                  ) : <div className="flex items-center gap-2 text-[11px] font-semibold text-red-300"><X className="h-4 w-4" /> {saveResult.message}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: metadata */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#080a0c]/80 px-4 py-2">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div><div className={LABEL_CLS}>Source</div><input value={sourceName} onChange={e => setSourceName(e.target.value)} className={`${INPUT_CLS} w-32`} /></div>
          <div><div className={LABEL_CLS}>Version / Label</div><input value={sourceVersion} onChange={e => setSourceVersion(e.target.value)} className={`${INPUT_CLS} w-32`} /></div>
          <div><div className={LABEL_CLS}>Notes</div><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Standard 8-max BB ante range..." className={`${INPUT_CLS} w-48`} /></div>
          <div><div className={LABEL_CLS}>On Duplicate</div><select value={duplicateAction} onChange={e => setDuplicateAction(e.target.value as 'new_version' | 'replace_active')} className={`${INPUT_CLS} w-36`}><option value="new_version">Create new version</option><option value="replace_active">Replace active</option></select></div>
        </div>
      </div>
    </div>
  );
}

// ── Tree View ──

type TreeLevel = 'opening' | 'vs_open' | 'opener_vs_3bet';

interface TreeNode {
  level: TreeLevel;
  stackBB: number;
  heroPosition: SolverPosition;
  actionHistory: StructuredAction[];
  label: string;
}

function buildTreeNodes(level: TreeLevel, tableSize: number, stackBB: number, openSize: number, threebetSize: number): TreeNode[] {
  const unopened = getUnopenedPositions(tableSize);
  const all = getPositionsForTable(tableSize);

  if (level === 'opening') {
    return unopened.map(pos => ({ level, stackBB, heroPosition: pos, actionHistory: [], label: `${pos} — Unopened` }));
  }

  if (level === 'vs_open') {
    const nodes: TreeNode[] = [];
    for (const opener of unopened) {
      const responders = all.filter(p => all.indexOf(p) > all.indexOf(opener));
      for (const responder of responders) {
        const history: StructuredAction[] = [{ position: opener, action: 'raise', size_bb: openSize }];
        const openerIdx = all.indexOf(opener);
        const responderIdx = all.indexOf(responder);
        for (let i = openerIdx + 1; i < responderIdx; i++) {
          history.push({ position: all[i], action: 'fold' });
        }
        nodes.push({ level, stackBB, heroPosition: responder, actionHistory: history, label: `${responder} vs ${opener} Open ${openSize}bb` });
      }
    }
    return nodes;
  }

  // opener_vs_3bet
  const nodes: TreeNode[] = [];
  for (const opener of unopened) {
    const threebetters = all.filter(p => all.indexOf(p) > all.indexOf(opener));
    for (const threebetter of threebetters) {
      const history: StructuredAction[] = [{ position: opener, action: 'raise', size_bb: openSize }];
      const openerIdx = all.indexOf(opener);
      const threebetterIdx = all.indexOf(threebetter);
      for (let i = openerIdx + 1; i < threebetterIdx; i++) {
        history.push({ position: all[i], action: 'fold' });
      }
      history.push({ position: threebetter, action: '3bet', size_bb: threebetSize });
      nodes.push({ level, stackBB, heroPosition: opener, actionHistory: history, label: `${opener} vs ${threebetter} 3-Bet ${threebetSize}bb` });
    }
  }
  return nodes;
}

const TREE_STACKS = [40, 30, 25, 20, 15, 10];

function TreeView({ onOpenImport }: { onOpenImport: (identity: ImportPrefill) => void }) {
  const [format, setFormat] = usePersistentState<SolverFormat>('preflop-tree-format', 'tournament');
  const [solveType, setSolveType] = usePersistentState<'chipev' | 'icm'>('preflop-tree-solveType', 'chipev');
  const [tableSize, setTableSize] = usePersistentState<number>('preflop-tree-tableSize', 8);
  const [anteType, setAnteType] = usePersistentState<typeof ANTE_TYPES[number]>('preflop-tree-anteType', 'bb_ante');
  const [anteBB, setAnteBB] = usePersistentState<number>('preflop-tree-anteBB', 1);
  const [nodes, setNodes] = useState<ReferenceNodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [drillLevel, setDrillLevel] = useState<TreeLevel | null>(null);
  const [drillStack, setDrillStack] = useState<number | null>(null);
  const [drillOpener, setDrillOpener] = useState<string | null>(null);
  const [drillThreebetter, setDrillThreebetter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setNodes(await listReferenceNodes()); } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const checkNodeExists = useCallback((treeNode: TreeNode): boolean => {
    return nodes.some(n =>
      n.format === format && n.solve_type === solveType && n.table_size === tableSize &&
      n.stack_bb === treeNode.stackBB && n.ante_type === anteType && n.ante_bb === anteBB &&
      n.hero_position === treeNode.heroPosition &&
      JSON.stringify(n.action_history) === JSON.stringify(treeNode.actionHistory)
    );
  }, [nodes, format, solveType, tableSize, anteType, anteBB]);

  const countComplete = (level: TreeLevel, stack: number): { done: number; total: number } => {
    const treeNodes = buildTreeNodes(level, tableSize, stack, 2.0, 7.0);
    const done = treeNodes.filter(n => checkNodeExists({ ...n, stackBB: stack })).length;
    return { done, total: treeNodes.length };
  };

  const breadcrumb: string[] = ['PREFLOP TREE'];
  if (drillLevel) {
    breadcrumb.push(drillLevel === 'opening' ? 'Opening Ranges' : drillLevel === 'vs_open' ? 'Villain Response' : 'Opener Response to 3-Bet');
  }
  if (drillStack !== null) breadcrumb.push(`${drillStack} BB`);
  if (drillOpener) breadcrumb.push(`${drillOpener} Open`);
  if (drillThreebetter) breadcrumb.push(`${drillThreebetter} 3-Bet`);

  const handleNodeClick = (treeNode: TreeNode) => {
    onOpenImport({
      format,
      solve_type: solveType,
      table_size: tableSize,
      stack_bb: treeNode.stackBB,
      ante_type: anteType,
      ante_bb: anteBB,
      hero_position: treeNode.heroPosition,
      action_history: treeNode.actionHistory,
    });
  };

  // ── Level 0: Top-level branches ──
  if (!drillLevel) {
    const levels: { key: TreeLevel; label: string; desc: string }[] = [
      { key: 'opening', label: 'Opening Ranges', desc: 'First-in unopened ranges for each position' },
      { key: 'vs_open', label: 'Villain Response to Open', desc: 'How each position responds to an open' },
      { key: 'opener_vs_3bet', label: 'Opener Response to 3-Bet', desc: 'How the opener responds to a 3-bet' },
    ];

    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        {/* Config */}
        <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div><div className={LABEL_CLS}>Format</div><select value={format} onChange={e => setFormat(e.target.value as SolverFormat)} className={INPUT_CLS}><option value="tournament">MTT</option><option value="cash">Cash</option></select></div>
          <div><div className={LABEL_CLS}>Table</div><select value={tableSize} onChange={e => setTableSize(parseInt(e.target.value) || 8)} className={INPUT_CLS}>{[2, 3, 4, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}-Max</option>)}</select></div>
          <div><div className={LABEL_CLS}>Solve</div><select value={solveType} onChange={e => setSolveType(e.target.value as 'chipev' | 'icm')} className={INPUT_CLS}><option value="chipev">ChipEV</option><option value="icm">ICM</option></select></div>
          <div><div className={LABEL_CLS}>Ante</div><div className="flex items-center gap-1"><select value={anteType} onChange={e => setAnteType(e.target.value as typeof ANTE_TYPES[number])} className={INPUT_CLS}>{ANTE_TYPES.map(a => <option key={a} value={a}>{a === 'bb_ante' ? 'BB Ante' : a === 'per_player' ? 'Per Player' : 'None'}</option>)}</select>{anteType !== 'none' && <input type="number" step="0.5" value={anteBB} onChange={e => setAnteBB(parseFloat(e.target.value) || 0)} className={`${INPUT_CLS} w-14`} />}</div></div>
          {loading && <div className="flex items-center gap-1 text-[10px] text-white/30"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>}
        </div>

        {/* Summary */}
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-[#0a0c0e] p-3">
          <div className="text-[10px] font-mono tracking-widest text-white/40 uppercase mb-2">Core ChipEV Preflop Library</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {levels.map(lvl => {
              let total = 0, done = 0;
              for (const s of TREE_STACKS) { const c = countComplete(lvl.key, s); total += c.total; done += c.done; }
              return (
                <div key={lvl.key} className="rounded-lg border border-white/[0.06] bg-[#050709] p-2.5">
                  <div className="text-[10px] font-bold text-white/60">{lvl.label}</div>
                  <div className="mt-1 text-[16px] font-bold text-[#d4a52c]">{done} <span className="text-[12px] text-white/30">/ {total}</span></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Branches */}
        <div className="space-y-3">
          {levels.map(lvl => {
            let total = 0, done = 0;
            for (const s of TREE_STACKS) { const c = countComplete(lvl.key, s); total += c.total; done += c.done; }
            return (
              <button key={lvl.key} onClick={() => { setDrillLevel(lvl.key); setDrillStack(null); setDrillOpener(null); setDrillThreebetter(null); }} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0a0c0e] p-4 text-left transition-all hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/[0.03]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d4a52c]/10"><ChevronRight className="h-5 w-5 text-[#d4a52c]" /></div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-white/80">{lvl.label}</div>
                  <div className="text-[10px] text-white/40">{lvl.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-[#d4a52c]">{done} / {total}</div>
                  <div className="text-[9px] text-white/30">{done === total && total > 0 ? 'COMPLETE' : 'in progress'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Level 1: Stack sizes ──
  if (drillLevel && drillStack === null) {
    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setDrillLevel(null)} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3 w-3" /> Back</button>
          <span className="text-[10px] text-white/30">{breadcrumb.join(' > ')}</span>
        </div>
        <div className="space-y-2">
          {TREE_STACKS.map(stack => {
            const { done, total } = countComplete(drillLevel, stack);
            return (
              <button key={stack} onClick={() => setDrillStack(stack)} className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3 text-left transition-all hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/[0.03]">
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-white/80">{stack} BB</div>
                </div>
                <div className="text-right">
                  <div className={`text-[14px] font-bold ${done === total ? 'text-emerald-300' : done > 0 ? 'text-[#d4a52c]' : 'text-white/30'}`}>{done} / {total}</div>
                  <div className="text-[9px] text-white/30">{done === total && total > 0 ? 'COMPLETE' : done > 0 ? 'in progress' : 'not started'}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Level 2: Positions (opening) or Openers (vs_open / 3bet) ──
  if (drillLevel === 'opening' && drillStack !== null) {
    const treeNodes = buildTreeNodes('opening', tableSize, drillStack, 2.0, 7.0);
    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setDrillStack(null)} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3 w-3" /> Back</button>
          <span className="text-[10px] text-white/30">{breadcrumb.join(' > ')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {treeNodes.map(node => {
            const exists = checkNodeExists(node);
            return (
              <button key={node.label} onClick={() => handleNodeClick(node)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${exists ? 'border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/10 hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                {exists ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/20 text-[12px]">—</span>}
                <span className={`text-[10px] font-bold ${exists ? 'text-white/70' : 'text-white/30'}`}>{node.heroPosition}</span>
                <span className="ml-auto text-[9px] text-white/20">{exists ? '✓' : 'missing'}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if ((drillLevel === 'vs_open' || drillLevel === 'opener_vs_3bet') && drillStack !== null && drillOpener === null) {
    const openers = getUnopenedPositions(tableSize);
    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setDrillStack(null)} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3 w-3" /> Back</button>
          <span className="text-[10px] text-white/30">{breadcrumb.join(' > ')}</span>
        </div>
        <div className="space-y-2">
          {openers.map(opener => {
            const treeNodes = buildTreeNodes(drillLevel, tableSize, drillStack, 2.0, 7.0).filter(n => n.actionHistory[0]?.position === opener);
            const done = treeNodes.filter(n => checkNodeExists(n)).length;
            return (
              <button key={opener} onClick={() => setDrillOpener(opener)} className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3 text-left transition-all hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/[0.03]">
                <div className="flex-1"><div className="text-[12px] font-bold text-white/80">{opener} Open 2.0bb</div></div>
                <div className="text-right"><div className={`text-[14px] font-bold ${done === treeNodes.length ? 'text-emerald-300' : done > 0 ? 'text-[#d4a52c]' : 'text-white/30'}`}>{done} / {treeNodes.length}</div></div>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Level 3: Responders (vs_open) or 3-betters ──
  if (drillLevel === 'vs_open' && drillStack !== null && drillOpener) {
    const treeNodes = buildTreeNodes('vs_open', tableSize, drillStack, 2.0, 7.0).filter(n => n.actionHistory[0]?.position === drillOpener);
    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setDrillOpener(null)} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3 w-3" /> Back</button>
          <span className="text-[10px] text-white/30">{breadcrumb.join(' > ')}</span>
        </div>
        <div className="space-y-2">
          {treeNodes.map(node => {
            const exists = checkNodeExists(node);
            return (
              <button key={node.label} onClick={() => handleNodeClick(node)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${exists ? 'border-emerald-400/15 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/[0.08] hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                {exists ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/15 text-[10px]">—</span>}
                <span className={`text-[10px] font-bold ${exists ? 'text-white/60' : 'text-white/25'}`}>{node.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (drillLevel === 'opener_vs_3bet' && drillStack !== null && drillOpener && drillThreebetter === null) {
    const threebetters = getPositionsForTable(tableSize).filter(p => getPositionsForTable(tableSize).indexOf(p) > getPositionsForTable(tableSize).indexOf(drillOpener as SolverPosition));
    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setDrillOpener(null)} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3 w-3" /> Back</button>
          <span className="text-[10px] text-white/30">{breadcrumb.join(' > ')}</span>
        </div>
        <div className="space-y-2">
          {threebetters.map(threebetter => {
            const treeNodes = buildTreeNodes('opener_vs_3bet', tableSize, drillStack, 2.0, 7.0).filter(n => n.actionHistory.find(a => a.action === '3bet')?.position === threebetter);
            const done = treeNodes.filter(n => checkNodeExists(n)).length;
            return (
              <button key={threebetter} onClick={() => setDrillThreebetter(threebetter)} className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3 text-left transition-all hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/[0.03]">
                <div className="flex-1"><div className="text-[12px] font-bold text-white/80">{threebetter} 3-Bet 7.0bb</div></div>
                <div className="text-right"><div className={`text-[14px] font-bold ${done === treeNodes.length ? 'text-emerald-300' : done > 0 ? 'text-[#d4a52c]' : 'text-white/30'}`}>{done} / {treeNodes.length}</div></div>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Level 4: Opener responses (opener_vs_3bet, specific 3-better) ──
  if (drillLevel === 'opener_vs_3bet' && drillStack !== null && drillOpener && drillThreebetter) {
    const treeNodes = buildTreeNodes('opener_vs_3bet', tableSize, drillStack, 2.0, 7.0).filter(n => n.actionHistory[0]?.position === drillOpener && n.actionHistory.find(a => a.action === '3bet')?.position === drillThreebetter);
    return (
      <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setDrillThreebetter(null)} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3 w-3" /> Back</button>
          <span className="text-[10px] text-white/30">{breadcrumb.join(' > ')}</span>
        </div>
        <div className="space-y-2">
          {treeNodes.map(node => {
            const exists = checkNodeExists(node);
            return (
              <button key={node.label} onClick={() => handleNodeClick(node)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${exists ? 'border-emerald-400/15 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/[0.08] hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                {exists ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/15 text-[10px]">—</span>}
                <span className={`text-[10px] font-bold ${exists ? 'text-white/60' : 'text-white/25'}`}>{node.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ── Coverage View ──

function CoverageView({ onOpenImport, onOpenLibrary }: { onOpenImport: (identity: ReferenceNodeIdentity) => void; onOpenLibrary: (nodeId: string) => void }) {
  const [nodes, setNodes] = useState<ReferenceNodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStack, setFilterStack] = useState<number | 'all'>('all');

  const load = useCallback(async () => { setLoading(true); const data = await listReferenceNodes(); setNodes(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const stacks = [...new Set(nodes.map(n => n.stack_bb))].sort((a, b) => a - b);
  const filtered = filterStack === 'all' ? nodes : nodes.filter(n => n.stack_bb === filterStack);

  // Group by stack/table/solve/ante
  const grouped = filtered.reduce((acc, n) => {
    const key = `${n.stack_bb}bb · ${n.table_size}-Max · ${n.solve_type} · ${n.ante_type === 'bb_ante' ? `BB Ante ${n.ante_bb}bb` : n.ante_type === 'none' ? 'No Ante' : `Per ${n.ante_bb}bb`}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {} as Record<string, ReferenceNodeRecord[]>);

  const allPositions = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB'];

  // Classify nodes by tree depth
  function classifyNode(n: ReferenceNodeRecord): 'unopened' | 'vs_open' | 'opener_vs_3bet' | 'other' {
    if (n.action_history.length === 0) return 'unopened';
    const has3bet = n.action_history.some(a => a.action === '3bet');
    if (has3bet) return 'opener_vs_3bet';
    const hasRaise = n.action_history.some(a => a.action === 'raise');
    if (hasRaise) return 'vs_open';
    return 'other';
  }

  return (
    <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
      <div className="mb-3 flex items-center gap-2">
        <div className={LABEL_CLS}>Filter:</div>
        <button onClick={() => setFilterStack('all')} className={`rounded px-2 py-1 text-[10px] ${filterStack === 'all' ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/40'}`}>All</button>
        {stacks.map(s => <button key={s} onClick={() => setFilterStack(s)} className={`rounded px-2 py-1 text-[10px] ${filterStack === s ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/40'}`}>{s}bb</button>)}
      </div>
      {loading ? <div className="text-[11px] text-white/30">Loading...</div> : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0c0e] p-6 text-center text-[11px] text-white/30">No reference ranges loaded yet. Use the Import tab to add ranges.</div>
      ) : (
        Object.entries(grouped).map(([groupKey, groupNodes]) => {
          const byLevel = {
            unopened: groupNodes.filter(n => classifyNode(n) === 'unopened'),
            vs_open: groupNodes.filter(n => classifyNode(n) === 'vs_open'),
            opener_vs_3bet: groupNodes.filter(n => classifyNode(n) === 'opener_vs_3bet'),
            other: groupNodes.filter(n => classifyNode(n) === 'other'),
          };
          return (
            <div key={groupKey} className={SECTION_CLS + ' mb-3'}>
              <div className="mb-3 text-[12px] font-bold text-white/70">{groupKey}</div>
              {/* Level 1: Unopened */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/50">UNOPENED</span>
                  <span className="text-[9px] text-white/30">{byLevel.unopened.length} / {allPositions.length} complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {allPositions.map(pos => {
                    const existing = byLevel.unopened.find(n => n.hero_position === pos);
                    const isCovered = !!existing;
                    return (
                      <button key={pos} onClick={() => isCovered && existing ? onOpenLibrary(existing.id) : onOpenImport({ format: 'tournament', solve_type: 'chipev', table_size: parseInt(groupKey.split(' · ')[1].split('-')[0]), stack_bb: parseInt(groupKey.split('bb')[0]), ante_type: 'bb_ante', ante_bb: 1, hero_position: pos as SolverPosition, action_history: [] })} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${isCovered ? 'border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/10 hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                        {isCovered ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/20 text-[12px]">—</span>}
                        <span className={`text-[10px] font-bold ${isCovered ? 'text-white/70' : 'text-white/30'}`}>{pos}</span>
                        <span className="ml-auto text-[9px] text-white/20">{isCovered ? '✓' : 'missing'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Level 2: VS Open */}
              {byLevel.vs_open.length > 0 && (
                <div className="mb-3 border-t border-white/[0.06] pt-3">
                  <div className="mb-1.5 flex items-center gap-2"><span className="text-[10px] font-bold text-white/50">VS OPEN</span><span className="text-[9px] text-white/30">{byLevel.vs_open.length} nodes</span></div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {byLevel.vs_open.map(n => {
                      const opener = n.action_history.find(a => a.action === 'raise');
                      return (
                        <button key={n.id} onClick={() => onOpenLibrary(n.id)} className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-left hover:bg-emerald-400/10">
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-[10px] font-bold text-white/70">{n.hero_position} vs {opener?.position ?? '?'} {opener?.size_bb ?? ''}bb</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Level 3: Opener VS 3-Bet */}
              {byLevel.opener_vs_3bet.length > 0 && (
                <div className="mb-3 border-t border-white/[0.06] pt-3">
                  <div className="mb-1.5 flex items-center gap-2"><span className="text-[10px] font-bold text-white/50">OPENER VS 3-BET</span><span className="text-[9px] text-white/30">{byLevel.opener_vs_3bet.length} nodes</span></div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {byLevel.opener_vs_3bet.map(n => {
                      const opener = n.action_history.find(a => a.action === 'raise');
                      const threebet = n.action_history.find(a => a.action === '3bet');
                      return (
                        <button key={n.id} onClick={() => onOpenLibrary(n.id)} className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-left hover:bg-emerald-400/10">
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-[10px] font-bold text-white/70">{n.hero_position} vs {threebet?.position ?? '?'} 3-Bet</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Level status */}
              <div className="flex items-center gap-3 text-[9px] text-white/30 border-t border-white/[0.06] pt-2">
                <span>UNOPENED: {byLevel.unopened.length > 0 ? <span className="text-emerald-300/70">{byLevel.unopened.length}/{allPositions.length} COMPLETE</span> : 'NOT STARTED'}</span>
                <span>VS OPEN: {byLevel.vs_open.length > 0 ? <span className="text-emerald-300/70">{byLevel.vs_open.length} nodes</span> : 'NOT STARTED'}</span>
                <span>VS 3-BET: {byLevel.opener_vs_3bet.length > 0 ? <span className="text-amber-300/70">{byLevel.opener_vs_3bet.length} nodes</span> : 'NOT STARTED'}</span>
                <span>COLD 4-BET: NOT STARTED</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Library View ──

function LibraryView({ focusNodeId, onEditRange }: { focusNodeId: string | null; onEditRange: (prefill: ImportPrefill) => void }) {
  const [nodes, setNodes] = useState<ReferenceNodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(focusNodeId);
  const [ranges, setRanges] = useState<ReferenceRangeRecord[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(false);
  const [activeRange, setActiveRange] = useState<ReferenceRangeRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [filterStack, setFilterStack] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const load = useCallback(async () => { setLoading(true); const data = await listReferenceNodes(); setNodes(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (focusNodeId) { setSelectedNode(focusNodeId); setShowDetail(true); } }, [focusNodeId]);
  useEffect(() => {
    if (!selectedNode) { setRanges([]); setActiveRange(null); return; }
    setLoadingRanges(true);
    listRangesForNode(selectedNode).then(r => { setRanges(r); const active = r.find(r => r.is_active) ?? r[0] ?? null; setActiveRange(active); setLoadingRanges(false); });
  }, [selectedNode]);

  const handleExport = async (nodeId: string) => { const json = await exportReferenceNode(nodeId); if (!json) return; const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reference-node-${nodeId.slice(0, 8)}.json`; a.click(); URL.revokeObjectURL(url); };
  const handleDelete = async (nodeId: string) => { if (!confirm('Delete this node and all its range versions? This cannot be undone.')) return; await deleteReferenceNode(nodeId); setSelectedNode(null); setShowDetail(false); setMenuOpen(null); load(); };
  const handleSetActive = async (nodeId: string, rangeId: string) => { await setActiveRange(nodeId, rangeId); const r = await listRangesForNode(nodeId); setRanges(r); setActiveRange(r.find(x => x.is_active) ?? null); };
  const handleEdit = (node: ReferenceNodeRecord, range: ReferenceRangeRecord | null) => {
    if (!range) return;
    onEditRange({ format: node.format as SolverFormat, solve_type: node.solve_type as 'chipev' | 'icm', table_size: node.table_size, stack_bb: node.stack_bb, ante_type: node.ante_type as typeof ANTE_TYPES[number], ante_bb: node.ante_bb, hero_position: node.hero_position as SolverPosition, action_history: node.action_history, editMode: true, strategyData: range.strategy_data as Record<string, Record<string, number>>, availableActions: range.available_actions as AvailableAction[], sourceName: range.source_name, sourceVersion: range.source_version, notes: range.notes });
  };

  const formats = [...new Set(nodes.map(n => n.format))];
  const tables = [...new Set(nodes.map(n => n.table_size))].sort((a, b) => a - b);
  const stacks = [...new Set(nodes.map(n => n.stack_bb))].sort((a, b) => a - b);
  const positions = [...new Set(nodes.map(n => n.hero_position))];
  const filteredNodes = nodes.filter(n => { if (filterFormat !== 'all' && n.format !== filterFormat) return false; if (filterTable !== 'all' && String(n.table_size) !== filterTable) return false; if (filterStack !== 'all' && String(n.stack_bb) !== filterStack) return false; if (filterPosition !== 'all' && n.hero_position !== filterPosition) return false; return true; });
  const grouped = useMemo(() => { const map: Record<string, ReferenceNodeRecord[]> = {}; for (const n of filteredNodes) { const key = `${n.format} · ${n.table_size}-Max · ${n.solve_type} · ${n.ante_type === 'bb_ante' ? `BB Ante ${n.ante_bb}bb` : n.ante_type === 'none' ? 'No Ante' : `Per ${n.ante_bb}bb`} · ${n.stack_bb}bb`; if (!map[key]) map[key] = []; map[key].push(n); } return map; }, [filteredNodes]);

  if (loading) return <div className="p-5 text-[11px] text-white/30">Loading...</div>;

  if (showDetail && selectedNode) {
    const node = nodes.find(n => n.id === selectedNode);
    if (!node) { setShowDetail(false); return null; }
    const handStrategy = activeRange ? combosTo169(activeRange.strategy_data as Record<string, Record<string, number>>) : null;
    const detailFreqs = activeRange ? (() => { const freqs: Record<string, number> = {}; const data = activeRange.strategy_data as Record<string, Record<string, number>>; for (const combo of CANONICAL_HAND_ORDER) { for (const [action, freq] of Object.entries(data[combo] || {})) { freqs[action] = (freqs[action] ?? 0) + freq; } } for (const a of Object.keys(freqs)) freqs[a] = freqs[a] / 1326; return freqs; })() : {};
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-2 flex items-center gap-3">
          <button onClick={() => { setShowDetail(false); setSelectedNode(null); }} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"><ArrowLeft className="h-3.5 w-3.5" /> Back to Library</button>
          <span className="text-[11px] font-bold text-white/70">{node.hero_position} · {node.stack_bb}bb · {node.table_size}-Max · {node.solve_type}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="min-h-0 flex-1 overflow-hidden p-3">{activeRange && handStrategy ? <MixedFreqMatrix strategyData={activeRange.strategy_data as Record<string, Record<string, number>>} /> : <div className="flex h-full items-center justify-center text-[11px] text-white/30">No active range data</div>}</div>
          <div className="min-h-0 shrink-0 overflow-y-auto border-t border-white/[0.06] p-4 lg:w-72 lg:border-l lg:border-t-0" style={{ overscrollBehavior: 'contain' }}>
            <div className="space-y-3">
              <div><div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Node</div><div className="mt-1 text-[10px] text-white/60">{node.hero_position} · {node.action_history.length === 0 ? 'Unopened' : node.action_history.map(a => `${a.position} ${a.action}`).join(' → ')}</div></div>
              {activeRange && (
                <>
                  <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${activeRange.is_active ? 'bg-green-500/15 text-green-300' : 'bg-white/5 text-white/40'}`}>v{activeRange.version}</span>{activeRange.is_active && <span className="text-[9px] text-emerald-300">Active</span>}{activeRange.is_partial && <span className="text-[9px] text-yellow-400/60">Partial</span>}</div>
                  <div><div className={LABEL_CLS}>Source</div><div className="text-[10px] text-white/50">{activeRange.source_name}</div></div>
                  {activeRange.source_version && <div><div className={LABEL_CLS}>Version Label</div><div className="text-[10px] text-white/50">{activeRange.source_version}</div></div>}
                  {activeRange.notes && <div><div className={LABEL_CLS}>Notes</div><div className="text-[10px] text-white/50">{activeRange.notes}</div></div>}
                  <div><div className={LABEL_CLS}>Updated</div><div className="text-[10px] text-white/50">{new Date(activeRange.updated_at).toLocaleDateString()}</div></div>
                  <ActionFreqBars freqs={detailFreqs} />
                </>
              )}
              {loadingRanges ? <div className="text-[10px] text-white/30">Loading versions...</div> : ranges.length > 1 && (
                <div><div className={LABEL_CLS}>Version History</div><div className="space-y-1">{ranges.map(r => <div key={r.id} className="flex items-center gap-2 text-[10px] text-white/50"><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${r.is_active ? 'bg-green-500/15 text-green-300' : 'bg-white/5 text-white/40'}`}>v{r.version}</span><span>{r.source_name}</span>{!r.is_active && <button onClick={() => handleSetActive(node.id, r.id)} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/40 hover:text-white/70">Set Active</button>}</div>)}</div></div>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                <button onClick={() => handleEdit(node, activeRange)} className="flex items-center gap-1 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-1.5 text-[9px] text-[#f5e6b0] hover:bg-[#d4a52c]/20"><Edit3 className="h-3 w-3" /> Edit Range</button>
                <button onClick={() => handleExport(node.id)} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] text-white/60 hover:text-white"><FileJson className="h-3 w-3" /> Export</button>
                <button onClick={() => handleDelete(node.id)} className="flex items-center gap-1 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[9px] text-red-400/60 hover:text-red-400"><Trash2 className="h-3 w-3" /> Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
      <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2">
        <div><div className={LABEL_CLS}>Format</div><select value={filterFormat} onChange={e => setFilterFormat(e.target.value)} className={`${INPUT_CLS} w-24`}><option value="all">All</option>{formats.map(f => <option key={f} value={f}>{f === 'tournament' ? 'MTT' : 'Cash'}</option>)}</select></div>
        <div><div className={LABEL_CLS}>Table</div><select value={filterTable} onChange={e => setFilterTable(e.target.value)} className={`${INPUT_CLS} w-20`}><option value="all">All</option>{tables.map(t => <option key={t} value={String(t)}>{t}-Max</option>)}</select></div>
        <div><div className={LABEL_CLS}>Stack</div><select value={filterStack} onChange={e => setFilterStack(e.target.value)} className={`${INPUT_CLS} w-20`}><option value="all">All</option>{stacks.map(s => <option key={s} value={String(s)}>{s}bb</option>)}</select></div>
        <div><div className={LABEL_CLS}>Position</div><select value={filterPosition} onChange={e => setFilterPosition(e.target.value)} className={`${INPUT_CLS} w-24`}><option value="all">All</option>{positions.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
      </div>
      {filteredNodes.length === 0 ? <div className="rounded-xl border border-white/[0.06] bg-[#0a0c0e] p-6 text-center text-[11px] text-white/30">No reference nodes in the library. Use the Import tab to add ranges.</div> : (
        Object.entries(grouped).map(([groupKey, groupNodes]) => (
          <div key={groupKey} className="mb-4">
            <div className="mb-2 text-[11px] font-bold text-white/50">{groupKey}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {groupNodes.map(n => {
                const historyStr = n.action_history.length === 0 ? 'Unopened' : n.action_history.map(a => `${a.position} ${a.action}${a.size_bb ? ` ${a.size_bb}bb` : ''}`).join(' → ');
                return (
                  <div key={n.id} className="relative rounded-xl border border-white/[0.08] bg-[#0a0c0e] p-3 text-left transition-all hover:border-white/20">
                    <button onClick={() => { setSelectedNode(n.id); setShowDetail(true); }} className="w-full text-left">
                      <div className="flex items-center justify-between"><span className="text-[12px] font-bold text-white/80">{n.hero_position} — {historyStr}</span><ChevronRight className="h-3.5 w-3.5 text-white/30" /></div>
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-white/40"><span>{n.solve_type}</span><span>·</span><span>{new Date(n.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === n.id ? null : n.id); }} className="absolute right-2 top-2 text-white/30 hover:text-white/60"><MoreVertical className="h-3.5 w-3.5" /></button>
                    {menuOpen === n.id && (
                      <div className="absolute right-2 top-8 z-10 rounded-lg border border-white/10 bg-[#0a0c0e] py-1 shadow-xl">
                        <button onClick={() => { setSelectedNode(n.id); setShowDetail(true); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-white/60 hover:bg-white/5"><Eye className="h-3 w-3" /> View</button>
                        <button onClick={() => { const r = ranges.find(r => r.node_id === n.id); handleEdit(n, r); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-white/60 hover:bg-white/5"><Edit3 className="h-3 w-3" /> Edit</button>
                        <button onClick={() => handleExport(n.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-white/60 hover:bg-white/5"><FileJson className="h-3 w-3" /> Export</button>
                        <button onClick={() => handleDelete(n.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] text-red-400/60 hover:bg-red-500/5"><Trash2 className="h-3 w-3" /> Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
