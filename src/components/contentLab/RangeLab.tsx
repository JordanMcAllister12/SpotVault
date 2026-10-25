import { useState, useRef, useCallback, useEffect } from 'react';
import { Grid3x3, Eraser, Trash2, X, Check, Eye, EyeOff } from 'lucide-react';
import {
  RANKS, getHandLabel, getHandType, getComboCount,
  type RangeGrid, type RangeCellData, type RangeAction, type RangeLabConfig,
  emptyRangeGrid, countCombos, countFilled, DEFAULT_CONFIG, DEFAULT_PREFLOP_ACTIONS, DEFAULT_POSTFLOP_ACTIONS,
} from './rangeLab';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface CoachProps {
  config: RangeLabConfig;
  onConfigChange: (config: RangeLabConfig) => void;
}

export function RangeLabCoachConfig({ config, onConfigChange }: CoachProps) {
  const update = (patch: Partial<RangeLabConfig>) => onConfigChange({ ...config, ...patch });

  const addAction = () => {
    const id = `action-${Date.now()}`;
    update({ availableActions: [...config.availableActions, { id, label: 'New Action', color: '#6b7280' }] });
  };

  const updateAction = (idx: number, patch: Partial<RangeAction>) => {
    const next = [...config.availableActions];
    next[idx] = { ...next[idx], ...patch };
    update({ availableActions: next });
  };

  const removeAction = (idx: number) => {
    update({ availableActions: config.availableActions.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4 rounded-lg border border-[#c0911e]/20 bg-[#0a0c0e]/60 p-4">
      <div className="flex items-center gap-2">
        <Grid3x3 className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase">Range Lab Configuration</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Exercise Mode</label>
          <select
            value={config.mode}
            onChange={(e) => {
              const mode = e.target.value as RangeLabConfig['mode'];
              const actions = mode === 'preflop_mines' ? DEFAULT_PREFLOP_ACTIONS : DEFAULT_POSTFLOP_ACTIONS;
              update({ mode, availableActions: actions });
            }}
            className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
          >
            <option value="preflop_mines">Preflop Mines</option>
            <option value="postflop">Postflop Range Construction</option>
            <option value="combo_analysis">Combo-Level Analysis</option>
            <option value="multi_street">Multi-Street Evolution</option>
            <option value="range_comparison">Range Comparison</option>
            <option value="combo_sorting">Combo Sorting & Counting</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Effective Stack</label>
          <input
            value={config.effectiveStack}
            onChange={(e) => update({ effectiveStack: e.target.value })}
            placeholder="e.g. 20BB"
            className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Hero Position</label>
          <input
            value={config.heroPosition}
            onChange={(e) => update({ heroPosition: e.target.value })}
            placeholder="e.g. Hijack"
            className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Action Facing Hero</label>
          <input
            value={config.actionFacing}
            onChange={(e) => update({ actionFacing: e.target.value })}
            placeholder="e.g. Folds to Hero"
            className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
          />
        </div>
        {(config.mode === 'postflop' || config.mode === 'combo_analysis' || config.mode === 'multi_street') && (
          <>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Board Cards</label>
              <input
                value={config.boardCards}
                onChange={(e) => update({ boardCards: e.target.value })}
                placeholder="e.g. A♠ 9♦ 4♣"
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Pot Size</label>
              <input
                value={config.potSize}
                onChange={(e) => update({ potSize: e.target.value })}
                placeholder="e.g. 12BB"
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
              />
            </div>
          </>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Previous Action / Preflop Sequence</label>
        <input
          value={config.previousAction}
          onChange={(e) => update({ previousAction: e.target.value })}
          placeholder="e.g. BTN raises 2.2BB, BB calls"
          className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Available Actions</label>
        <div className="space-y-1.5">
          {config.availableActions.map((action, i) => (
            <div key={action.id} className="flex items-center gap-2">
              <input
                type="color"
                value={action.color}
                onChange={(e) => updateAction(i, { color: e.target.value })}
                className="h-7 w-7 shrink-0 rounded border border-white/10 bg-transparent"
              />
              <input
                value={action.label}
                onChange={(e) => updateAction(i, { label: e.target.value })}
                className="flex-1 rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-1.5 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
              />
              <button onClick={() => removeAction(i)} className="text-white/20 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addAction}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70"
          >
            <Grid3x3 className="h-3 w-3" /> Add Action
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Reference Solution (Coach's Answer)</label>
        <p className="mb-2 text-[9px] text-white/30">Paint your reference strategy below. Students won't see this until they submit.</p>
        <RangeMatrixEditor
          actions={config.availableActions}
          grid={config.referenceGrid || emptyRangeGrid()}
          onChange={(grid) => update({ referenceGrid: grid })}
        />
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Explanation (revealed after submission)</label>
        <textarea
          value={config.explanation}
          onChange={(e) => update({ explanation: e.target.value })}
          rows={3}
          placeholder="Explain the reasoning behind your reference strategy..."
          className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/40"
        />
      </div>
    </div>
  );
}

interface MatrixEditorProps {
  actions: RangeAction[];
  grid: RangeGrid;
  onChange: (grid: RangeGrid) => void;
}

export function RangeMatrixEditor({ actions, grid, onChange }: MatrixEditorProps) {
  const [selectedAction, setSelectedAction] = useState<string>(actions[0]?.id ?? 'fold');
  const [isErasing, setIsErasing] = useState(false);
  const isPaintingRef = useRef(false);

  useEffect(() => {
    if (actions.length > 0 && !actions.find(a => a.id === selectedAction)) {
      setSelectedAction(actions[0].id);
    }
  }, [actions, selectedAction]);

  const paintCell = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    const current = grid[key];
    if (isErasing) {
      if (current.actionId) onChange({ ...grid, [key]: { actionId: null, frequency: 0 } });
      return;
    }
    const action = actions.find(a => a.id === selectedAction);
    if (!action) return;
    if (current.actionId === selectedAction && current.frequency >= 100) {
      onChange({ ...grid, [key]: { actionId: null, frequency: 0 } });
    } else {
      onChange({ ...grid, [key]: { actionId: selectedAction, frequency: 100 } });
    }
  }, [grid, onChange, isErasing, selectedAction, actions]);

  const handleMouseDown = (row: number, col: number) => {
    isPaintingRef.current = true;
    paintCell(row, col);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isPaintingRef.current) paintCell(row, col);
  };

  useEffect(() => {
    const stop = () => { isPaintingRef.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const filled = countFilled(grid);
  const combos = countCombos(grid);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => { setSelectedAction(action.id); setIsErasing(false); }}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-all"
            style={{
              borderColor: selectedAction === action.id && !isErasing ? action.color : 'rgba(255,255,255,0.08)',
              background: selectedAction === action.id && !isErasing ? `${action.color}20` : 'transparent',
              color: selectedAction === action.id && !isErasing ? action.color : 'rgba(255,255,255,0.5)',
            }}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: action.color }} />
            {action.label}
          </button>
        ))}
        <button
          onClick={() => setIsErasing(!isErasing)}
          className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-all"
          style={{
            borderColor: isErasing ? '#dc2626' : 'rgba(255,255,255,0.08)',
            color: isErasing ? '#dc2626' : 'rgba(255,255,255,0.5)',
          }}
        >
          <Eraser className="h-3 w-3" /> Erase
        </button>
        <button
          onClick={() => onChange(emptyRangeGrid())}
          className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-medium text-white/40 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-white/40">
          <span>{filled}/169 hands</span>
          <span>{combos} combos</span>
        </div>
      </div>

      <div className="inline-block rounded-lg border border-white/[0.06] bg-[#0a0c0e] p-2 select-none" style={{ touchAction: 'none' }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(14, minmax(0, 1fr))`, gap: '1px' }}>
          <div />
          {RANKS.map((r) => (
            <div key={r} className="flex h-5 w-5 items-center justify-center text-[8px] font-bold text-white/30">{r}</div>
          ))}
          {RANKS.map((rowRank, r) => (
            <div key={r} style={{ display: 'contents' }}>
              <div className="flex h-5 w-5 items-center justify-center text-[8px] font-bold text-white/30">{rowRank}</div>
              {RANKS.map((_, c) => {
                const cell = grid[`${r}-${c}`];
                const action = cell.actionId ? actions.find(a => a.id === cell.actionId) : null;
                const bg = action ? action.color : '#15181b';
                const opacity = action ? Math.max(0.25, cell.frequency / 100) : 1;
                const type = getHandType(r, c);
                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseDown={(e) => { e.preventDefault(); handleMouseDown(r, c); }}
                    onMouseEnter={() => handleMouseEnter(r, c)}
                    onTouchStart={(e) => { e.preventDefault(); paintCell(r, c); }}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm text-[7px] font-bold transition-all hover:ring-1 hover:ring-white/40"
                    style={{
                      background: action ? `${action.color}` : '#15181b',
                      opacity: action ? opacity : 1,
                      color: action && opacity > 0.5 ? '#fff' : 'rgba(255,255,255,0.3)',
                    }}
                    title={`${getHandLabel(r, c)} — ${getComboCount(r, c)} combos — ${action?.label ?? 'empty'}`}
                  >
                    {getHandLabel(r, c)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface StudentProps {
  config: RangeLabConfig;
}

export function RangeLabStudent({ config }: StudentProps) {
  const [studentGrid, setStudentGrid] = useState<RangeGrid>(emptyRangeGrid);
  const [submitted, setSubmitted] = useState(false);
  const [showReference, setShowReference] = useState(false);

  const handleReset = () => {
    setStudentGrid(emptyRangeGrid());
    setSubmitted(false);
    setShowReference(false);
  };

  const filled = countFilled(studentGrid);
  const studentCombos = countCombos(studentGrid);

  return (
    <div className="space-y-4 rounded-lg border border-[#c0911e]/15 bg-[#0a0c0e]/40 p-4">
      <div className="flex items-center gap-2">
        <Grid3x3 className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase">Range Lab Exercise</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {config.effectiveStack && <div><span className="text-[9px] text-white/30">Stack:</span> <span className="text-[10px] text-white/70">{config.effectiveStack}</span></div>}
        {config.heroPosition && <div><span className="text-[9px] text-white/30">Position:</span> <span className="text-[10px] text-white/70">{config.heroPosition}</span></div>}
        {config.actionFacing && <div><span className="text-[9px] text-white/30">Action:</span> <span className="text-[10px] text-white/70">{config.actionFacing}</span></div>}
        {config.boardCards && <div><span className="text-[9px] text-white/30">Board:</span> <span className="text-[10px] text-white/70">{config.boardCards}</span></div>}
        {config.potSize && <div><span className="text-[9px] text-white/30">Pot:</span> <span className="text-[10px] text-white/70">{config.potSize}</span></div>}
      </div>

      {!submitted ? (
        <>
          <p className="text-[10px] text-white/40">Construct your strategy by selecting an action and painting hands onto the matrix.</p>
          <RangeMatrixEditor
            actions={config.availableActions}
            grid={studentGrid}
            onChange={setStudentGrid}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSubmitted(true)}
              disabled={filled === 0}
              className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-5 py-2 text-[11px] font-bold tracking-widest uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Submit Strategy
            </button>
            <span className="text-[10px] text-white/30">{filled}/169 hands · {studentCombos} combos</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2.5">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-300/80">Strategy submitted — {filled} hands, {studentCombos} combos</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReference(!showReference)}
              className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/20"
            >
              {showReference ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showReference ? 'Hide' : 'Show'} Reference
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-white/50 transition hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Try Again
            </button>
          </div>

          {showReference && config.referenceGrid && (
            <div className="space-y-2 rounded-lg border border-[#c0911e]/20 bg-[#0a0c0e]/60 p-3">
              <span className="text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase">Coach's Reference Strategy</span>
              <RangeMatrixDisplay actions={config.availableActions} grid={config.referenceGrid} />
              {config.explanation && (
                <div className="mt-2 rounded-md border border-white/[0.06] bg-black/20 p-3">
                  <span className="mb-1 block text-[9px] font-bold tracking-widest text-white/40 uppercase">Explanation</span>
                  <p className="text-[11px] leading-relaxed text-white/70">{config.explanation}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function RangeMatrixDisplay({ actions, grid }: { actions: RangeAction[]; grid: RangeGrid }) {
  return (
    <div className="inline-block rounded-lg border border-white/[0.06] bg-[#0a0c0e] p-2">
      <div className="grid" style={{ gridTemplateColumns: `repeat(14, minmax(0, 1fr))`, gap: '1px' }}>
        <div />
        {RANKS.map((r) => (
          <div key={r} className="flex h-5 w-5 items-center justify-center text-[8px] font-bold text-white/30">{r}</div>
        ))}
        {RANKS.map((rowRank, r) => (
          <div key={r} style={{ display: 'contents' }}>
            <div className="flex h-5 w-5 items-center justify-center text-[8px] font-bold text-white/30">{rowRank}</div>
            {RANKS.map((_, c) => {
              const cell = grid[`${r}-${c}`];
              const action = cell.actionId ? actions.find(a => a.id === cell.actionId) : null;
              return (
                <div
                  key={`${r}-${c}`}
                  className="flex h-5 w-5 items-center justify-center rounded-sm text-[7px] font-bold"
                  style={{
                    background: action ? action.color : '#15181b',
                    opacity: action ? Math.max(0.25, cell.frequency / 100) : 1,
                    color: action ? '#fff' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {getHandLabel(r, c)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
