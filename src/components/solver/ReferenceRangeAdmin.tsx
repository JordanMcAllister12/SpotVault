import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileJson, FileText, CheckCircle, XCircle, AlertCircle, Database, Download, Trash2, Layers, Grid3x3 } from 'lucide-react';
import {
  importFromJson,
  importFromText,
  getIdentityHash,
  type JsonImportPayload,
} from '@/lib/solver/referenceRangeImport';
import {
  listReferenceNodes,
  listRangesForNode,
  deleteReferenceNode,
  exportReferenceNode,
  setActiveRange,
  computeNodeHash,
  type ReferenceNodeRecord,
  type ReferenceRangeRecord,
  type ReferenceNodeIdentity,
  type StructuredAction,
} from '@/lib/solver/referenceRangeLibrary';
import type { SolverFormat, SolverPosition } from '@/lib/solver/types';

const POSITIONS: SolverPosition[] = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const ANTE_TYPES = ['none', 'bb_ante', 'per_player'] as const;
const STACK_PRESETS = [20, 30, 40, 60, 100];

const INPUT_CLS = 'w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white/80 outline-none focus:border-[#d4a52c]/40';
const LABEL_CLS = 'text-[9px] font-mono tracking-widest text-white/40 uppercase mb-1';
const SECTION_CLS = 'rounded-xl border border-white/[0.06] bg-black/20 p-4';
const BTN_CLS = 'rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[10px] font-semibold text-[#f5e6b0] transition-all hover:bg-[#d4a52c]/20';

type ImportResult = { success: boolean; error?: string; warnings: string[]; node?: ReferenceNodeRecord; range?: ReferenceRangeRecord };

export function ReferenceRangeAdmin() {
  const [view, setView] = useState<'import' | 'coverage' | 'manage'>('import');
  const [nodes, setNodes] = useState<ReferenceNodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const refreshNodes = useCallback(async () => {
    setLoading(true);
    const data = await listReferenceNodes();
    setNodes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshNodes();
  }, [refreshNodes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-[#d4a52c]" />
        <h2 className="text-[14px] font-bold text-white">Preflop Reference Library</h2>
        <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase ml-2">Admin Tool</span>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setView('import')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${view === 'import' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          <Upload className="h-3.5 w-3.5" /> Import
        </button>
        <button onClick={() => setView('coverage')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${view === 'coverage' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          <Grid3x3 className="h-3.5 w-3.5" /> Coverage
        </button>
        <button onClick={() => setView('manage')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${view === 'manage' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          <Layers className="h-3.5 w-3.5" /> Manage
        </button>
      </div>

      {view === 'import' && <ImportView onDone={refreshNodes} result={result} setResult={setResult} />}
      {view === 'coverage' && <CoverageView nodes={nodes} loading={loading} />}
      {view === 'manage' && <ManageView nodes={nodes} loading={loading} onRefresh={refreshNodes} />}
    </div>
  );
}

// ===== Import View =====

function ImportView({ onDone, result, setResult }: { onDone: () => void; result: ImportResult | null; setResult: (r: ImportResult | null) => void }) {
  const [mode, setMode] = useState<'json' | 'text'>('json');
  const [config, setConfig] = useState({
    format: 'tournament' as SolverFormat,
    solveType: 'chipev' as 'chipev' | 'icm',
    tableSize: 8,
    anteType: 'bb_ante' as 'none' | 'bb_ante' | 'per_player',
    anteBB: 1,
    stackBB: 40,
    heroPosition: 'UTG' as SolverPosition,
  });
  const [actionHistory, setActionHistory] = useState<StructuredAction[]>([]);
  const [availableActions, setAvailableActions] = useState([
    { action: 'fold', label: 'Fold' },
    { action: 'call', label: 'Limp' },
    { action: 'raise_2.2', label: 'Raise 2.2' },
    { action: 'all-in', label: 'All-in' },
  ]);
  const [jsonText, setJsonText] = useState('');
  const [textData, setTextData] = useState('');
  const [onDuplicate, setOnDuplicate] = useState<'new_version' | 'replace_active' | 'cancel'>('new_version');
  const [sourceName, setSourceName] = useState('manual-import');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hashPreview, setHashPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Compute hash preview
  useEffect(() => {
    const identity: ReferenceNodeIdentity = {
      format: config.format,
      solve_type: config.solveType,
      table_size: config.tableSize,
      stack_bb: config.stackBB,
      ante_type: config.anteType,
      ante_bb: config.anteBB,
      hero_position: config.heroPosition,
      action_history: actionHistory,
    };
    computeNodeHash(identity).then(setHashPreview).catch(() => setHashPreview(''));
  }, [config, actionHistory]);

  const buildIdentity = (): ReferenceNodeIdentity => ({
    format: config.format,
    solve_type: config.solveType,
    table_size: config.tableSize,
    stack_bb: config.stackBB,
    ante_type: config.anteType,
    ante_bb: config.anteBB,
    hero_position: config.heroPosition,
    action_history: actionHistory,
  });

  const handleJsonImport = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(jsonText) as JsonImportPayload;
      // Merge config from form if not in JSON
      if (!parsed.identity) {
        parsed.identity = {
          format: config.format,
          solve_type: config.solveType,
          table_size: config.tableSize,
          stack_bb: config.stackBB,
          ante_type: config.anteType,
          ante_bb: config.anteBB,
          hero_position: config.heroPosition,
          action_history: actionHistory,
        };
      }
      if (!parsed.on_duplicate) parsed.on_duplicate = onDuplicate;
      if (!parsed.source_name) parsed.source_name = sourceName;
      if (!parsed.notes) parsed.notes = notes;

      const res = await importFromJson(parsed);
      setResult(res);
      if (res.success) onDone();
    } catch (e) {
      setResult({ success: false, error: `Invalid JSON: ${(e as Error).message}`, warnings: [] });
    }
    setSaving(false);
  };

  const handleTextImport = async () => {
    setSaving(true);
    try {
      const res = await importFromText(textData, {
        identity: buildIdentity(),
        available_actions: availableActions,
        source_name: sourceName,
        notes,
        on_duplicate: onDuplicate,
      });
      setResult(res);
      if (res.success) onDone();
    } catch (e) {
      setResult({ success: false, error: (e as Error).message, warnings: [] });
    }
    setSaving(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (mode === 'json') setJsonText(text);
      else setTextData(text);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template: JsonImportPayload = {
      identity: {
        format: 'tournament',
        solve_type: 'chipev',
        table_size: 8,
        stack_bb: 40,
        ante_type: 'bb_ante',
        ante_bb: 1,
        hero_position: 'UTG',
        action_history: [],
      },
      available_actions: [
        { action: 'fold', label: 'Fold' },
        { action: 'raise_2.2', label: 'Raise 2.2' },
        { action: 'all-in', label: 'All-in' },
      ],
      hands: {
        AA: [{ action: 'raise_2.2', frequency: 0.95 }, { action: 'all-in', frequency: 0.05 }],
        AKs: [{ action: 'raise_2.2', frequency: 0.95 }, { action: 'all-in', frequency: 0.05 }],
        '72o': [{ action: 'fold', frequency: 1 }],
      },
      source_name: 'manual-import',
      notes: 'Template — replace with real data',
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reference-range-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1.5">
        <button onClick={() => setMode('json')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${mode === 'json' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          <FileJson className="h-3.5 w-3.5" /> JSON
        </button>
        <button onClick={() => setMode('text')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${mode === 'text' ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          <FileText className="h-3.5 w-3.5" /> Text
        </button>
      </div>

      {/* Node Configuration */}
      <div className={SECTION_CLS}>
        <div className="mb-3 text-[11px] font-semibold text-white/60">Node Identity</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <div className={LABEL_CLS}>Format</div>
            <select value={config.format} onChange={(e) => setConfig({ ...config, format: e.target.value as SolverFormat })} className={INPUT_CLS}>
              <option value="tournament">Tournament</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Solve Type</div>
            <select value={config.solveType} onChange={(e) => setConfig({ ...config, solveType: e.target.value as 'chipev' | 'icm' })} className={INPUT_CLS}>
              <option value="chipev">ChipEV</option>
              <option value="icm">ICM</option>
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Table Size</div>
            <select value={config.tableSize} onChange={(e) => setConfig({ ...config, tableSize: parseInt(e.target.value) || 8 })} className={INPUT_CLS}>
              {[2, 3, 4, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}-max</option>)}
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Stack (bb)</div>
            <select value={config.stackBB} onChange={(e) => setConfig({ ...config, stackBB: parseInt(e.target.value) || 40 })} className={INPUT_CLS}>
              {STACK_PRESETS.map(s => <option key={s} value={s}>{s}bb</option>)}
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Ante Type</div>
            <select value={config.anteType} onChange={(e) => setConfig({ ...config, anteType: e.target.value as typeof ANTE_TYPES[number] })} className={INPUT_CLS}>
              {ANTE_TYPES.map(a => <option key={a} value={a}>{a === 'bb_ante' ? 'BB Ante' : a === 'per_player' ? 'Per Player' : 'None'}</option>)}
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Ante (bb)</div>
            <input type="number" step="0.5" value={config.anteBB} onChange={(e) => setConfig({ ...config, anteBB: parseFloat(e.target.value) || 0 })} className={INPUT_CLS} />
          </div>
          <div>
            <div className={LABEL_CLS}>Hero Position</div>
            <select value={config.heroPosition} onChange={(e) => setConfig({ ...config, heroPosition: e.target.value as SolverPosition })} className={INPUT_CLS}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>On Duplicate</div>
            <select value={onDuplicate} onChange={(e) => setOnDuplicate(e.target.value as typeof onDuplicate)} className={INPUT_CLS}>
              <option value="new_version">New Version</option>
              <option value="replace_active">Replace Active</option>
              <option value="cancel">Cancel</option>
            </select>
          </div>
        </div>

        {/* Action History */}
        <div className="mt-3">
          <div className={LABEL_CLS}>Action History (structured)</div>
          {actionHistory.length === 0 ? (
            <div className="text-[10px] text-white/30 italic">No actions — this is an unopened node</div>
          ) : (
            <div className="space-y-1">
              {actionHistory.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-white/60">
                  <span className="font-mono text-white/40">{i + 1}.</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">{a.position}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">{a.action}</span>
                  {a.size_bb !== undefined && <span className="rounded bg-white/5 px-1.5 py-0.5">{a.size_bb}bb</span>}
                  <button onClick={() => setActionHistory(actionHistory.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <select id="newActionPos" className={`${INPUT_CLS} w-24`}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select id="newActionType" className={`${INPUT_CLS} w-24`}>
              <option value="fold">fold</option>
              <option value="call">call</option>
              <option value="raise">raise</option>
              <option value="all-in">all-in</option>
            </select>
            <input id="newActionSize" type="number" step="0.1" placeholder="size_bb" className={`${INPUT_CLS} w-20`} />
            <button
              onClick={() => {
                const pos = (document.getElementById('newActionPos') as HTMLSelectElement).value as SolverPosition;
                const act = (document.getElementById('newActionType') as HTMLSelectElement).value;
                const sizeStr = (document.getElementById('newActionSize') as HTMLInputElement).value;
                const size = sizeStr ? parseFloat(sizeStr) : undefined;
                setActionHistory([...actionHistory, { position: pos, action: act, size_bb: size }]);
                (document.getElementById('newActionSize') as HTMLInputElement).value = '';
              }}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:text-white/80"
            >
              Add
            </button>
          </div>
        </div>

        {/* Available Actions */}
        <div className="mt-3">
          <div className={LABEL_CLS}>Available Actions</div>
          <div className="space-y-1">
            {availableActions.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={a.action} onChange={(e) => setAvailableActions(availableActions.map((ac, idx) => idx === i ? { ...ac, action: e.target.value } : ac))} className={`${INPUT_CLS} w-32`} placeholder="action_id" />
                <input value={a.label} onChange={(e) => setAvailableActions(availableActions.map((ac, idx) => idx === i ? { ...ac, label: e.target.value } : ac))} className={`${INPUT_CLS} flex-1`} placeholder="Display label" />
                <button onClick={() => setAvailableActions(availableActions.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setAvailableActions([...availableActions, { action: '', label: '' }])} className="mt-1.5 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:text-white/80">
            + Add Action
          </button>
        </div>

        {/* Source metadata */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className={LABEL_CLS}>Source Name</div>
            <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <div className={LABEL_CLS}>Notes</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT_CLS} />
          </div>
        </div>

        {/* Hash preview */}
        {hashPreview && (
          <div className="mt-2 text-[9px] font-mono text-white/30">
            Node hash: {hashPreview.slice(0, 16)}...
          </div>
        )}
      </div>

      {/* Data input */}
      <div className={SECTION_CLS}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/60">
            {mode === 'json' ? 'JSON Data' : 'Text Data (hand action freq [action freq...])'}
          </div>
          <div className="flex gap-1.5">
            <button onClick={downloadTemplate} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:text-white/70">
              <Download className="mr-1 inline h-3 w-3" />Template
            </button>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:text-white/70">
              <Upload className="mr-1 inline h-3 w-3" />Upload
            </button>
            <input ref={fileRef} type="file" accept=".json,.txt,.csv" onChange={handleFileUpload} className="hidden" />
          </div>
        </div>
        <textarea
          value={mode === 'json' ? jsonText : textData}
          onChange={(e) => mode === 'json' ? setJsonText(e.target.value) : setTextData(e.target.value)}
          placeholder={mode === 'json' ? '{\n  "identity": {...},\n  "available_actions": [...],\n  "hands": {"AA": [{"action": "raise_2.2", "frequency": 1}]}\n}' : 'AA raise_2.2 95 all-in 5\nAKs raise_2.2 100\n72o fold 100'}
          rows={10}
          className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[10px] text-white/70 outline-none focus:border-[#d4a52c]/40"
        />
        <button
          onClick={mode === 'json' ? handleJsonImport : handleTextImport}
          disabled={saving}
          className={`mt-2 ${BTN_CLS} ${saving ? 'opacity-50' : ''}`}
        >
          {saving ? 'Saving...' : 'Validate & Save'}
        </button>
      </div>

      {/* Result */}
      {result && <ResultDisplay result={result} />}
    </div>
  );
}

// ===== Coverage View =====

function CoverageView({ nodes, loading }: { nodes: ReferenceNodeRecord[]; loading: boolean }) {
  const [filterStack, setFilterStack] = useState<number | 'all'>('all');

  const stacks = [...new Set(nodes.map(n => n.stack_bb))].sort((a, b) => a - b);
  const filtered = filterStack === 'all' ? nodes : nodes.filter(n => n.stack_bb === filterStack);

  // Group by stack → position → action_history
  const grouped = filtered.reduce((acc, n) => {
    const key = `${n.stack_bb}bb`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {} as Record<string, ReferenceNodeRecord[]>);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={LABEL_CLS}>Filter by stack:</div>
        <button onClick={() => setFilterStack('all')} className={`rounded px-2 py-1 text-[10px] ${filterStack === 'all' ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/40'}`}>All</button>
        {stacks.map(s => (
          <button key={s} onClick={() => setFilterStack(s)} className={`rounded px-2 py-1 text-[10px] ${filterStack === s ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/40'}`}>
            {s}bb
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[11px] text-white/30">Loading...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-6 text-center text-[11px] text-white/30">
          No reference ranges loaded yet. Use the Import tab to add ranges.
        </div>
      ) : (
        Object.entries(grouped).map(([stackKey, stackNodes]) => (
          <div key={stackKey} className={SECTION_CLS}>
            <div className="mb-2 text-[12px] font-bold text-white/70">{stackKey} · {stackNodes.length} node{stackNodes.length !== 1 ? 's' : ''}</div>
            <div className="space-y-1">
              {stackNodes.map(n => {
                const historyStr = n.action_history.length === 0
                  ? 'unopened'
                  : n.action_history.map(a => `${a.position} ${a.action}${a.size_bb ? ` ${a.size_bb}bb` : ''}`).join(' → ');
                return (
                  <div key={n.id} className="flex items-center gap-2 text-[10px] text-white/50">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="font-semibold text-white/70">{n.hero_position}</span>
                    <span className="text-white/30">·</span>
                    <span>{historyStr}</span>
                    <span className="text-white/30">·</span>
                    <span className="font-mono text-white/30">{n.node_hash.slice(0, 8)}</span>
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

// ===== Manage View =====

function ManageView({ nodes, loading, onRefresh }: { nodes: ReferenceNodeRecord[]; loading: boolean; onRefresh: () => void }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [ranges, setRanges] = useState<ReferenceRangeRecord[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(false);

  useEffect(() => {
    if (!selectedNode) { setRanges([]); return; }
    setLoadingRanges(true);
    listRangesForNode(selectedNode).then(r => { setRanges(r); setLoadingRanges(false); });
  }, [selectedNode]);

  const handleExport = async (nodeId: string) => {
    const json = await exportReferenceNode(nodeId);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference-node-${nodeId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (nodeId: string) => {
    if (!confirm('Delete this node and all its range versions? This cannot be undone.')) return;
    await deleteReferenceNode(nodeId);
    setSelectedNode(null);
    onRefresh();
  };

  const handleSetActive = async (nodeId: string, rangeId: string) => {
    await setActiveRange(nodeId, rangeId);
    const r = await listRangesForNode(nodeId);
    setRanges(r);
  };

  if (loading) return <div className="text-[11px] text-white/30">Loading...</div>;

  return (
    <div className="space-y-3">
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-6 text-center text-[11px] text-white/30">
          No reference nodes to manage.
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map(n => (
            <div key={n.id} className={SECTION_CLS}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white/70">{n.hero_position}</span>
                  <span className="text-[10px] text-white/40">{n.stack_bb}bb {n.table_size}max {n.solve_type}</span>
                  <span className="text-[9px] font-mono text-white/30">{n.action_history.length === 0 ? 'unopened' : `${n.action_history.length} actions`}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleExport(n.id)} className="rounded border border-white/10 px-1.5 py-1 text-[9px] text-white/40 hover:text-white/70">
                    <Download className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(n.id)} className="rounded border border-red-500/20 px-1.5 py-1 text-[9px] text-red-400/60 hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button onClick={() => setSelectedNode(selectedNode === n.id ? null : n.id)} className="rounded border border-white/10 px-2 py-1 text-[9px] text-white/40 hover:text-white/70">
                    {selectedNode === n.id ? 'Hide' : 'Versions'}
                  </button>
                </div>
              </div>

              {selectedNode === n.id && (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  {loadingRanges ? (
                    <div className="text-[10px] text-white/30">Loading versions...</div>
                  ) : ranges.length === 0 ? (
                    <div className="text-[10px] text-white/30">No range versions found.</div>
                  ) : (
                    <div className="space-y-1">
                      {ranges.map(r => (
                        <div key={r.id} className="flex items-center gap-2 text-[10px] text-white/50">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${r.is_active ? 'bg-green-500/15 text-green-300' : 'bg-white/5 text-white/40'}`}>
                            v{r.version}
                          </span>
                          <span>{r.source_name}</span>
                          {r.is_partial && <span className="text-yellow-400/60">partial</span>}
                          <span className="text-white/30">{r.imported_at ? new Date(r.imported_at).toLocaleDateString() : ''}</span>
                          {!r.is_active && (
                            <button onClick={() => handleSetActive(n.id, r.id)} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/40 hover:text-white/70">
                              Set Active
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Result Display =====

function ResultDisplay({ result }: { result: ImportResult }) {
  if (!result.success) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-red-300">
          <XCircle className="h-4 w-4" /> Import Failed
        </div>
        <div className="mt-1 text-[10px] text-red-300/70">{result.error}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-green-300">
        <CheckCircle className="h-4 w-4" /> Import Successful
      </div>
      {result.node && (
        <div className="mt-1 text-[10px] text-green-300/70">
          Node: {result.node.hero_position} · {result.node.stack_bb}bb · {result.node.action_history.length === 0 ? 'unopened' : `${result.node.action_history.length} actions`}
          {result.range && <span> · v{result.range.version} · {result.range.is_partial ? 'partial' : 'full'}</span>}
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1 text-[9px] text-yellow-400/60">
              <AlertCircle className="mt-0.5 h-2.5 w-2.5 flex-shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
