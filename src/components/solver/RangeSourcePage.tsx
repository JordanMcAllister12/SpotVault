import { useState, useEffect, useCallback } from 'react';
import { Library, Edit3, ChevronRight, ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import { listReferenceNodes, findReferenceNode, extractFullRangeWeights, type ReferenceNodeRecord, type ReferenceRangeRecord, type StructuredAction } from '@/lib/solver/referenceRangeLibrary';
import { HAND_CELLS, POSITIONS, type SolverPosition, type SolverFormat, type SolverTableConfig, type RangeData, type SolverStreetAction } from '@/lib/solver/types';
import { usePersistentState } from '@/hooks/usePersistentState';

const SEG_BTN = 'rounded-[6px] border px-2.5 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap';
const SEG_ON = 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]';
const SEG_OFF = 'border-white/10 bg-white/[0.02] text-white/45 hover:text-white/75 hover:border-white/20';
const INPUT = 'w-full rounded-[5px] border border-white/10 bg-[#0a0c0e] px-2 py-1.5 text-[11px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none';
const LABEL = 'text-[9px] font-mono tracking-[0.18em] text-white/40 uppercase mb-1.5 block';

const STACK_PRESETS = [40, 30, 25, 20, 15, 10];
const SEAT_COUNTS = [2, 3, 4, 6, 7, 8, 9];

function getUnopenedPositions(tableSize: number): SolverPosition[] {
  return POSITIONS.filter(p => p !== 'BB').filter(p => {
    if (tableSize <= 2) return ['SB'].includes(p);
    if (tableSize <= 3) return ['BTN', 'SB'].includes(p);
    if (tableSize <= 4) return ['CO', 'BTN', 'SB'].includes(p);
    if (tableSize <= 6) return ['LJ', 'HJ', 'CO', 'BTN', 'SB'].includes(p);
    if (tableSize <= 7) return ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB'].includes(p);
    return ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB'].includes(p);
  });
}

function getAllPositions(tableSize: number): SolverPosition[] {
  if (tableSize <= 2) return ['SB', 'BB'];
  if (tableSize <= 3) return ['BTN', 'SB', 'BB'];
  if (tableSize <= 4) return ['CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 6) return ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  if (tableSize <= 7) return ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  return ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
}

interface TreeBranch {
  type: 'unopened' | 'vs_open' | 'opener_vs_3bet';
  label: string;
  heroPosition: SolverPosition;
  actionHistory: StructuredAction[];
  openerPos?: string;
  openSize?: number;
}

function buildUnopenedBranches(tableSize: number): TreeBranch[] {
  return getUnopenedPositions(tableSize).map(pos => ({
    type: 'unopened' as const,
    label: `${pos} — Unopened`,
    heroPosition: pos,
    actionHistory: [],
  }));
}

function buildVsOpenBranches(tableSize: number, openSize: number): TreeBranch[] {
  const openers = getUnopenedPositions(tableSize);
  const branches: TreeBranch[] = [];
  for (const opener of openers) {
    const responders = getAllPositions(tableSize).filter(p => getAllPositions(tableSize).indexOf(p) > getAllPositions(tableSize).indexOf(opener));
    for (const responder of responders) {
      const history: StructuredAction[] = [{ position: opener, action: 'raise', size_bb: openSize }];
      const openerIdx = getAllPositions(tableSize).indexOf(opener);
      const responderIdx = getAllPositions(tableSize).indexOf(responder);
      for (let i = openerIdx + 1; i < responderIdx; i++) {
        history.push({ position: getAllPositions(tableSize)[i], action: 'fold' });
      }
      branches.push({
        type: 'vs_open' as const,
        label: `${responder} vs ${opener} Open ${openSize}bb`,
        heroPosition: responder,
        actionHistory: history,
        openerPos: opener,
        openSize,
      });
    }
  }
  return branches;
}

function buildOpenerVs3betBranches(tableSize: number, openSize: number, threebetSize: number): TreeBranch[] {
  const openers = getUnopenedPositions(tableSize);
  const branches: TreeBranch[] = [];
  for (const opener of openers) {
    const threebetters = getAllPositions(tableSize).filter(p => getAllPositions(tableSize).indexOf(p) > getAllPositions(tableSize).indexOf(opener));
    for (const threebetter of threebetters) {
      const history: StructuredAction[] = [{ position: opener, action: 'raise', size_bb: openSize }];
      const openerIdx = getAllPositions(tableSize).indexOf(opener);
      const threebetterIdx = getAllPositions(tableSize).indexOf(threebetter);
      for (let i = openerIdx + 1; i < threebetterIdx; i++) {
        history.push({ position: getAllPositions(tableSize)[i], action: 'fold' });
      }
      history.push({ position: threebetter, action: '3bet', size_bb: threebetSize });
      branches.push({
        type: 'opener_vs_3bet' as const,
        label: `${opener} vs ${threebetter} 3-Bet ${threebetSize}bb`,
        heroPosition: opener,
        actionHistory: history,
        openerPos: opener,
        openSize,
      });
    }
  }
  return branches;
}

function normalizeHandToken(raw: string): string {
  // Uppercase rank characters only; preserve lowercase s/o suffix to match HAND_CELLS format.
  // e.g. "aks" -> "AKs", "AKO" -> "AKo", "aa" -> "AA"
  const upper = raw.toUpperCase();
  if (upper.endsWith('S')) return upper.slice(0, -1) + 's';
  if (upper.endsWith('O')) return upper.slice(0, -1) + 'o';
  return upper;
}

function countActiveCombos(range: RangeData): number {
  let count = 0;
  for (const h of HAND_CELLS) {
    const w = range.cells[h] ?? 0;
    if (w <= 0) continue;
    const isPair = h.length === 2;
    const isSuited = h.endsWith('s');
    const comboCount = isPair ? 6 : isSuited ? 4 : 12;
    count += Math.round(comboCount * w);
  }
  return count;
}

function parseHandInput(text: string): RangeData {
  const cells: Record<string, number> = {};
  for (const h of HAND_CELLS) cells[h] = 0;
  // Split on commas/semicolons/newlines only — not spaces, so "AKs 50%" stays as one token.
  // Also collapse space-separated hand+frequency pairs before splitting, e.g. "AKs 50%" → "AKs:50%"
  const normalized = text.replace(/([2-9TJQKAtjqka]{2}[soSO]?)\s+([\d.]+%?)/gi, '$1:$2');
  const tokens = normalized.split(/[,\n\r;]+/).map(t => t.trim()).filter(t => t.length > 0);
  for (const token of tokens) {
    // Accept: AA, AKs, AKo, AK (treated as both suited+offsuit), AKs:50, AKs:50%
    const match = token.match(/^([2-9TJQKAtjqka]{2}[soSO]?)(?::([\d.]+)%?)?$/);
    if (!match) continue;
    const hand = normalizeHandToken(match[1]);
    const freq = match[2] ? Math.min(1, parseFloat(match[2]) / (parseFloat(match[2]) > 1 ? 100 : 1)) : 1;
    if (cells[hand] !== undefined) {
      cells[hand] = Math.min(1, freq);
    } else if (hand.length === 2 && !hand.endsWith('s') && !hand.endsWith('o')) {
      // Two-rank shorthand without s/o: expand to both suited and offsuit
      const suited = hand + 's';
      const offsuit = hand + 'o';
      if (cells[suited] !== undefined) cells[suited] = Math.min(1, freq);
      if (cells[offsuit] !== undefined) cells[offsuit] = Math.min(1, freq);
    }
  }
  return { cells };
}

function RangePreview({ range, label }: { range: RangeData; label: string }) {
  const containerRef = useState<HTMLDivElement | null>(null);
  const filled = HAND_CELLS.filter(h => (range.cells[h] ?? 0) > 0).length;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] font-bold text-white/60">{label}</div>
      <div className="text-[9px] text-white/30">{filled} / 169 hands</div>
      <div className="grid w-full gap-[1px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)', aspectRatio: '1 / 1', maxWidth: '280px' }}>
        {HAND_CELLS.map(hand => {
          const w = range.cells[hand] ?? 0;
          const bg = w > 0 ? `rgba(212, 165, 44, ${0.15 + w * 0.7})` : 'rgba(255,255,255,0.02)';
          return (
            <div key={hand} className="flex items-center justify-center rounded-[2px] text-[7px] font-bold" style={{ background: bg, color: w > 0.3 ? '#fff' : 'rgba(255,255,255,0.2)' }}>
              {hand}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RangeSourcePageProps {
  onUseLibrary: (config: {
    format: SolverFormat;
    tableConfig: SolverTableConfig;
    stackBB: number;
    heroPosition: SolverPosition;
    villainPosition: SolverPosition;
    actionHistory: SolverStreetAction[];
    heroRange: RangeData;
    villainRange: RangeData;
    label: string;
  }) => void;
  onUseCustom: (config: {
    format: SolverFormat;
    tableConfig: SolverTableConfig;
    stackBB: number;
    heroPosition: SolverPosition;
    villainPosition: SolverPosition;
    heroRange: RangeData;
    villainRange: RangeData;
    label: string;
  }) => void;
}

export function RangeSourcePage({ onUseLibrary, onUseCustom }: RangeSourcePageProps) {
  const [mode, setMode] = useState<'choose' | 'library' | 'custom'>('choose');

  // Shared config
  const [format, setFormat] = usePersistentState<SolverFormat>('rs-format', 'tournament');
  const [tableSize, setTableSize] = usePersistentState<number>('rs-tableSize', 8);
  const [stackBB, setStackBB] = usePersistentState<number>('rs-stackBB', 40);
  const [anteType, setAnteType] = usePersistentState<'none' | 'bb_ante' | 'per_player'>('rs-anteType', 'bb_ante');
  const [anteBB, setAnteBB] = usePersistentState<number>('rs-anteBB', 1);

  // Library flow
  const [nodes, setNodes] = useState<ReferenceNodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<TreeBranch | null>(null);
  const [branchStatus, setBranchStatus] = useState<Record<string, 'available' | 'missing' | 'loading'>>({});

  // Custom flow
  const [heroPos, setHeroPos] = usePersistentState<SolverPosition>('rs-heroPos', 'BTN');
  const [villainPos, setVillainPos] = usePersistentState<SolverPosition>('rs-villainPos', 'BB');
  const [heroText, setHeroText] = useState('');
  const [villainText, setVillainText] = useState('');
  const [heroPreview, setHeroPreview] = useState<RangeData | null>(null);
  const [villainPreview, setVillainPreview] = useState<RangeData | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const tableConfig: SolverTableConfig = {
    seat_count: tableSize,
    sb_bb: 0.5,
    bb_bb: 1,
    ante_type: anteType,
    ante_bb: anteBB,
  };

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listReferenceNodes();
      setNodes(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mode === 'library') loadNodes();
  }, [mode, loadNodes]);

  // Check branch availability against loaded nodes
  useEffect(() => {
    if (mode !== 'library' || nodes.length === 0) return;
    const status: Record<string, 'available' | 'missing' | 'loading'> = {};
    for (const node of nodes) {
      const key = `${node.format}-${node.solve_type}-${node.table_size}-${node.stack_bb}-${node.ante_type}-${node.ante_bb}-${node.hero_position}-${JSON.stringify(node.action_history)}`;
      status[key] = 'available';
    }
    setBranchStatus(status);
  }, [mode, nodes]);

  const checkBranchAvailable = useCallback((branch: TreeBranch): boolean => {
    return nodes.some(n =>
      n.format === format &&
      n.table_size === tableSize &&
      n.stack_bb === stackBB &&
      n.ante_type === anteType &&
      n.ante_bb === anteBB &&
      n.hero_position === branch.heroPosition &&
      JSON.stringify(n.action_history) === JSON.stringify(branch.actionHistory)
    );
  }, [nodes, format, tableSize, stackBB, anteType, anteBB]);

  const handleSelectBranch = async (branch: TreeBranch) => {
    setSelectedBranch(branch);
    if (!checkBranchAvailable(branch)) return;

    // Load the range data from the library
    try {
      const result = await findReferenceNode({
        format,
        solve_type: 'chipev',
        table_size: tableSize,
        stack_bb: stackBB,
        ante_type: anteType,
        ante_bb: anteBB,
        hero_position: branch.heroPosition,
        action_history: branch.actionHistory,
      });
      if (result) {
        const weights = extractFullRangeWeights(result.range);
        const heroRange: RangeData = { cells: {} };
        for (let i = 0; i < HAND_CELLS.length; i++) {
          heroRange.cells[HAND_CELLS[i]] = weights[i] > 0 ? 1 : 0;
        }
        // For vs_open / 3bet, villain is the opener; for unopened, villain is next to act
        let villainPosition: SolverPosition = 'BB';
        if (branch.type === 'vs_open' && branch.openerPos) {
          villainPosition = branch.openerPos as SolverPosition;
        } else if (branch.type === 'opener_vs_3bet') {
          const threebetter = branch.actionHistory.find(a => a.action === '3bet');
          if (threebetter) villainPosition = threebetter.position as SolverPosition;
        } else {
          const positions = getAllPositions(tableSize);
          const heroIdx = positions.indexOf(branch.heroPosition);
          villainPosition = heroIdx < positions.length - 1 ? positions[heroIdx + 1] : 'BB';
        }

        const actionHistory: SolverStreetAction[] = branch.actionHistory.map(a => ({
          street: 'preflop' as const,
          position: a.position as SolverPosition,
          action: a.action as SolverStreetAction['action'],
          amount_bb: a.size_bb,
        }));

        onUseLibrary({
          format,
          tableConfig,
          stackBB,
          heroPosition: branch.heroPosition,
          villainPosition,
          actionHistory,
          heroRange,
          villainRange: { cells: Object.fromEntries(HAND_CELLS.map(h => [h, 1])) },
          label: `SpotVault Library — ${branch.label}`,
        });
      }
    } catch { /* fall through to custom */ }
  };

  const handleCustomContinue = () => {
    const heroRange = parseHandInput(heroText);
    const villainRange = parseHandInput(villainText);
    const heroCombos = countActiveCombos(heroRange);
    const villainCombos = countActiveCombos(villainRange);
    const heroActiveCells = HAND_CELLS.filter(h => (heroRange.cells[h] ?? 0) > 0).length;
    const villainActiveCells = HAND_CELLS.filter(h => (villainRange.cells[h] ?? 0) > 0).length;
    // Diagnostic log — visible in browser console before every submit
    console.info('[Solver] Range diagnostics before submit:', {
      hero: { activeCells: heroActiveCells, activeCombos: heroCombos },
      villain: { activeCells: villainActiveCells, activeCombos: villainCombos },
    });
    if (heroCombos === 0) { setRangeError('Hero range is empty. Check your input — e.g. AA, KK, AKs, AKo'); return; }
    if (villainCombos === 0) { setRangeError('Villain range is empty. Check your input — e.g. AA, KK, AKs, AKo'); return; }
    setRangeError(null);
    onUseCustom({
      format,
      tableConfig,
      stackBB,
      heroPosition: heroPos,
      villainPosition: villainPos,
      heroRange,
      villainRange,
      label: `Custom — Hero ${heroCombos} combos / Villain ${villainCombos} combos`,
    });
  };

  // ── CHOOSE MODE ──
  if (mode === 'choose') {
    return (
      <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-6">
        <div className="text-center">
          <h1 className="text-[20px] font-bold text-white">Solver</h1>
          <p className="mt-1 text-[12px] text-white/40">Choose how to define the preflop ranges for this solve.</p>
        </div>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          {/* Library option */}
          <button
            onClick={() => setMode('library')}
            className="group flex w-[280px] flex-col items-start gap-3 rounded-xl border border-[#d4a52c]/20 bg-gradient-to-b from-[#d4a52c]/[0.06] to-transparent p-5 text-left transition-all hover:border-[#d4a52c]/40 hover:from-[#d4a52c]/[0.1]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d4a52c]/15">
              <Library className="h-5 w-5 text-[#d4a52c]" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#f5e6b0]">Use Preflop Library</div>
              <div className="mt-1 text-[10px] text-white/40">Use SpotVault's stored ChipEV preflop ranges. Choose game, table size, stack depth, ante, and preflop node — SpotVault loads the ranges automatically.</div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#d4a52c]/60 group-hover:text-[#d4a52c]">
              Browse Library <ChevronRight className="h-3 w-3" />
            </div>
          </button>

          {/* Custom option */}
          <button
            onClick={() => setMode('custom')}
            className="group flex w-[280px] flex-col items-start gap-3 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5 text-left transition-all hover:border-white/25 hover:from-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
              <Edit3 className="h-5 w-5 text-white/60" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-white">Enter Custom Ranges</div>
              <div className="mt-1 text-[10px] text-white/40">Define Hero and Villain ranges manually. Useful for custom spots, unsupported library nodes, unusual stack dynamics, or ICM study.</div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-white/40 group-hover:text-white/70">
              Enter Ranges <ChevronRight className="h-3 w-3" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── LIBRARY MODE ──
  if (mode === 'library') {
    const unopenedBranches = buildUnopenedBranches(tableSize);
    const vsOpenBranches = buildVsOpenBranches(tableSize, 2.0);
    const vs3betBranches = buildOpenerVs3betBranches(tableSize, 2.0, 7.0);

    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <span className="text-[11px] font-bold text-[#d4a52c]">SPOTVAULT PREFLOP LIBRARY</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
          </div>
          {/* Config selectors */}
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
            <div><div className={LABEL}>Format</div>
              <div className="flex gap-1">
                {(['tournament', 'cash'] as SolverFormat[]).map(fmt => (
                  <button key={fmt} onClick={() => setFormat(fmt)} className={`${SEG_BTN} ${format === fmt ? SEG_ON : SEG_OFF}`}>{fmt === 'tournament' ? 'MTT' : 'Cash'}</button>
                ))}
              </div>
            </div>
            <div><div className={LABEL}>Table</div>
              <select value={tableSize} onChange={e => setTableSize(parseInt(e.target.value) || 8)} className={INPUT}>
                {SEAT_COUNTS.map(n => <option key={n} value={n}>{n}-Max</option>)}
              </select>
            </div>
            <div><div className={LABEL}>Stack</div>
              <select value={stackBB} onChange={e => setStackBB(parseInt(e.target.value) || 40)} className={INPUT}>
                {STACK_PRESETS.map(s => <option key={s} value={s}>{s} BB</option>)}
              </select>
            </div>
            <div><div className={LABEL}>Ante</div>
              <div className="flex items-center gap-1">
                <select value={anteType} onChange={e => setAnteType(e.target.value as 'none' | 'bb_ante' | 'per_player')} className={INPUT}>
                  <option value="bb_ante">BB Ante</option><option value="none">None</option><option value="per_player">Per Player</option>
                </select>
                {anteType !== 'none' && <input type="number" step="0.5" value={anteBB} onChange={e => setAnteBB(parseFloat(e.target.value) || 0)} className={INPUT} style={{ width: '50px' }} />}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
          {/* Unopened */}
          <div className="mb-4">
            <div className="mb-2 text-[12px] font-bold text-white/70">Opening Ranges</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {unopenedBranches.map(branch => {
                const available = checkBranchAvailable(branch);
                return (
                  <button key={branch.label} onClick={() => handleSelectBranch(branch)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${available ? 'border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/10 hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                    {available ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/20 text-[12px]">—</span>}
                    <span className={`text-[10px] font-bold ${available ? 'text-white/70' : 'text-white/30'}`}>{branch.heroPosition}</span>
                    <span className="ml-auto text-[9px] text-white/20">{available ? '✓' : 'missing'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VS Open */}
          <div className="mb-4">
            <div className="mb-2 text-[12px] font-bold text-white/70">Villain Response to Open</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {vsOpenBranches.map(branch => {
                const available = checkBranchAvailable(branch);
                return (
                  <button key={branch.label} onClick={() => handleSelectBranch(branch)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${available ? 'border-emerald-400/15 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/[0.08] hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                    {available ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/15 text-[10px]">—</span>}
                    <span className={`text-[10px] font-bold ${available ? 'text-white/60' : 'text-white/25'}`}>{branch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VS 3-Bet */}
          <div className="mb-4">
            <div className="mb-2 text-[12px] font-bold text-white/70">Opener Response to 3-Bet</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {vs3betBranches.map(branch => {
                const available = checkBranchAvailable(branch);
                return (
                  <button key={branch.label} onClick={() => handleSelectBranch(branch)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${available ? 'border-emerald-400/15 bg-emerald-400/5 hover:bg-emerald-400/10' : 'border-dashed border-white/[0.08] hover:border-[#d4a52c]/30 hover:bg-[#d4a52c]/5'}`}>
                    {available ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="text-white/15 text-[10px]">—</span>}
                    <span className={`text-[10px] font-bold ${available ? 'text-white/60' : 'text-white/25'}`}>{branch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fallback notice */}
          <div className="rounded-lg border border-white/[0.06] bg-[#0a0c0e] p-3 text-[10px] text-white/30">
            <AlertCircle className="mr-1 inline h-3 w-3" />
            Missing nodes show "RANGE NOT YET AVAILABLE". Use <button onClick={() => setMode('custom')} className="text-[#d4a52c] underline">Enter Custom Ranges</button> as a fallback for unsupported spots.
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOM MODE ──
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80">
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <span className="text-[11px] font-bold text-white/70">CUSTOM RANGES</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div><div className={LABEL}>Format</div>
            <div className="flex gap-1">
              {(['tournament', 'cash'] as SolverFormat[]).map(fmt => (
                <button key={fmt} onClick={() => setFormat(fmt)} className={`${SEG_BTN} ${format === fmt ? SEG_ON : SEG_OFF}`}>{fmt === 'tournament' ? 'MTT' : 'Cash'}</button>
              ))}
            </div>
          </div>
          <div><div className={LABEL}>Table</div>
            <select value={tableSize} onChange={e => setTableSize(parseInt(e.target.value) || 8)} className={INPUT}>
              {SEAT_COUNTS.map(n => <option key={n} value={n}>{n}-Max</option>)}
            </select>
          </div>
          <div><div className={LABEL}>Stack</div>
            <select value={stackBB} onChange={e => setStackBB(parseInt(e.target.value) || 40)} className={INPUT}>
              {STACK_PRESETS.map(s => <option key={s} value={s}>{s} BB</option>)}
            </select>
          </div>
          <div><div className={LABEL}>Hero</div>
            <select value={heroPos} onChange={e => setHeroPos(e.target.value as SolverPosition)} className={`${INPUT} w-20`}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><div className={LABEL}>Villain</div>
            <select value={villainPos} onChange={e => setVillainPos(e.target.value as SolverPosition)} className={`${INPUT} w-20`}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Hero range */}
          <div className="rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-4">
            <div className="mb-2 text-[12px] font-bold text-[#d4a52c]">Hero Range — {heroPos}</div>
            <textarea value={heroText} onChange={e => setHeroText(e.target.value)} placeholder="AA, KK, QQ, AKs, AQs, A5s 50%&#10;Supports 169-hand notation with optional frequency" className="w-full rounded-lg border border-white/10 bg-[#050709] p-2.5 font-mono text-[10px] text-white/70 outline-none focus:border-[#d4a52c]/40" style={{ minHeight: '120px', resize: 'vertical' }} />
            <button onClick={() => setHeroPreview(parseHandInput(heroText))} className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/60 hover:text-white">Preview Hero Range</button>
            {heroPreview && <div className="mt-3"><RangePreview range={heroPreview} label={`Hero — ${heroPos}`} /></div>}
          </div>

          {/* Villain range */}
          <div className="rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-4">
            <div className="mb-2 text-[12px] font-bold text-white/70">Villain Range — {villainPos}</div>
            <textarea value={villainText} onChange={e => setVillainText(e.target.value)} placeholder="AA, KK, QQ, JJ, AKs, AKo, AQs&#10;Supports 169-hand notation with optional frequency" className="w-full rounded-lg border border-white/10 bg-[#050709] p-2.5 font-mono text-[10px] text-white/70 outline-none focus:border-[#d4a52c]/40" style={{ minHeight: '120px', resize: 'vertical' }} />
            <button onClick={() => setVillainPreview(parseHandInput(villainText))} className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/60 hover:text-white">Preview Villain Range</button>
            {villainPreview && <div className="mt-3"><RangePreview range={villainPreview} label={`Villain — ${villainPos}`} /></div>}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
        {rangeError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {rangeError}
          </div>
        )}
        <button onClick={handleCustomContinue} disabled={!heroText.trim() || !villainText.trim()} className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-[12px] font-bold transition-all ${heroText.trim() && villainText.trim() ? 'bg-gradient-to-r from-[#d4a52c] to-[#c0911e] text-[#0a0c0e] hover:from-[#f5e6b0] hover:to-[#d4a52c]' : 'border border-white/10 text-white/30 cursor-not-allowed'}`}>
          Continue to Postflop Solver <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
