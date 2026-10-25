import { useState, useRef } from 'react';
import { Upload, FileJson, FileText, CheckCircle, XCircle, AlertCircle, Trash2, Database } from 'lucide-react';
import {
  importFromJson,
  importFromCsv,
  listImportedDatasets,
  removeImportedDataset,
  type ImportResult,
  type JsonImportPayload,
} from '@/lib/solver/preflopReferenceData';
import type { SolverFormat, SolverPosition } from '@/lib/solver/types';

const POSITIONS: SolverPosition[] = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SCENARIOS = ['unopened', 'facing_raise', 'facing_3bet', 'bb_defense', 'facing_allin'] as const;
const ANTE_TYPES = ['none', 'bb_ante', 'per_player'] as const;

const INPUT_CLS = 'w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white/80 outline-none focus:border-[#d4a52c]/40';
const LABEL_CLS = 'text-[9px] font-mono tracking-widest text-white/40 uppercase mb-1';
const SECTION_CLS = 'rounded-xl border border-white/[0.06] bg-black/20 p-4';

export function ReferenceDataImport() {
  const [mode, setMode] = useState<'json' | 'csv'>('json');
  const [config, setConfig] = useState({
    format: 'tournament' as SolverFormat,
    solveType: 'chipev' as 'chipev' | 'icm',
    seatCount: 8,
    anteType: 'bb_ante' as 'none' | 'bb_ante' | 'per_player',
    anteBB: 1,
    stackBB: 40,
    position: 'UTG' as SolverPosition,
    scenario: 'unopened' as typeof SCENARIOS[number],
    openerPosition: '' as string,
  });
  const [csvActionColumns, setCsvActionColumns] = useState([
    { columnName: 'Fold', action: 'fold', label: 'Fold' },
    { columnName: 'Call', action: 'call', label: 'Limp' },
    { columnName: 'Raise2.2', action: 'raise', label: 'Raise 2.2' },
    { columnName: 'AllIn', action: 'all-in', label: 'All-in' },
  ]);
  const [jsonText, setJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importedList, setImportedList] = useState(listImportedDatasets());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonText) as JsonImportPayload;
      const res = importFromJson(parsed);
      setResult(res);
      if (res.success) setImportedList(listImportedDatasets());
    } catch (e) {
      setResult({ success: false, error: `Invalid JSON: ${(e as Error).message}` });
    }
  };

  const handleCsvImport = () => {
    const openerPos = config.openerPosition && config.openerPosition !== '' ? config.openerPosition as SolverPosition : undefined;
    const res = importFromCsv(csvText, {
      format: config.format,
      solveType: config.solveType,
      seatCount: config.seatCount,
      anteType: config.anteType,
      anteBB: config.anteBB,
      stackBB: config.stackBB,
      position: config.position,
      scenario: config.scenario,
      openerPosition: openerPos,
      actionColumns: csvActionColumns,
    });
    setResult(res);
    if (res.success) setImportedList(listImportedDatasets());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (mode === 'json') setJsonText(text);
      else setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleRemove = (key: string) => {
    removeImportedDataset(key);
    setImportedList(listImportedDatasets());
  };

  const downloadTemplate = () => {
    const template = {
      configuration: {
        format: 'tournament',
        solveType: 'chipev',
        seatCount: 8,
        anteType: 'bb_ante',
        anteBB: 1,
        stackBB: 40,
        position: 'UTG+1',
        scenario: 'unopened',
      },
      available_actions: [
        { action: 'fold', label: 'Fold' },
        { action: 'call', label: 'Limp' },
        { action: 'raise', label: 'Raise 2.2' },
        { action: 'all-in', label: 'All-in' },
      ],
      hands: {
        AA: [{ action: 'raise', frequency: 1 }],
        AKs: [{ action: 'raise', frequency: 1 }],
        AKo: [{ action: 'raise', frequency: 1 }],
        A5s: [{ action: 'raise', frequency: 0.7 }, { action: 'fold', frequency: 0.3 }],
        '72o': [{ action: 'fold', frequency: 1 }],
      },
      provider: 'manual-import',
      solverVersion: 'reference-v1',
      notes: 'Example import — replace with real data',
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reference-strategy-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsvTemplate = () => {
    const csv = 'Hand,Fold,Call,Raise2.2,AllIn\nAA,0,0,1,0\nAKs,0,0,1,0\nAKo,0,0,1,0\nA5s,0.3,0,0.7,0\n72o,1,0,0,0\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reference-strategy-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-[#d4a52c]" />
        <h2 className="text-[14px] font-bold text-white">Reference Data Import</h2>
        <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase ml-2">Internal Dev Tool</span>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setMode('json')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${
            mode === 'json'
              ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
              : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <FileJson className="h-3.5 w-3.5" /> JSON Import
        </button>
        <button
          onClick={() => setMode('csv')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${
            mode === 'csv'
              ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
              : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> CSV Import
        </button>
      </div>

      {/* Configuration */}
      <div className={SECTION_CLS}>
        <div className="mb-3 text-[11px] font-semibold text-white/60">Node Configuration</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <div className={LABEL_CLS}>Format</div>
            <select
              value={config.format}
              onChange={(e) => setConfig({ ...config, format: e.target.value as SolverFormat })}
              className={INPUT_CLS}
            >
              <option value="tournament">Tournament</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Solve Type</div>
            <select
              value={config.solveType}
              onChange={(e) => setConfig({ ...config, solveType: e.target.value as 'chipev' | 'icm' })}
              className={INPUT_CLS}
            >
              <option value="chipev">ChipEV</option>
              <option value="icm">ICM</option>
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Seats</div>
            <input
              type="number"
              value={config.seatCount}
              onChange={(e) => setConfig({ ...config, seatCount: parseInt(e.target.value) || 8 })}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <div className={LABEL_CLS}>Stack (bb)</div>
            <input
              type="number"
              value={config.stackBB}
              onChange={(e) => setConfig({ ...config, stackBB: parseInt(e.target.value) || 40 })}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <div className={LABEL_CLS}>Ante Type</div>
            <select
              value={config.anteType}
              onChange={(e) => setConfig({ ...config, anteType: e.target.value as typeof ANTE_TYPES[number] })}
              className={INPUT_CLS}
            >
              <option value="none">None</option>
              <option value="bb_ante">BB Ante</option>
              <option value="per_player">Per Player</option>
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Ante (bb)</div>
            <input
              type="number"
              step="0.5"
              value={config.anteBB}
              onChange={(e) => setConfig({ ...config, anteBB: parseFloat(e.target.value) || 0 })}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <div className={LABEL_CLS}>Position</div>
            <select
              value={config.position}
              onChange={(e) => setConfig({ ...config, position: e.target.value as SolverPosition })}
              className={INPUT_CLS}
            >
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div className={LABEL_CLS}>Scenario</div>
            <select
              value={config.scenario}
              onChange={(e) => setConfig({ ...config, scenario: e.target.value as typeof SCENARIOS[number] })}
              className={INPUT_CLS}
            >
              {SCENARIOS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        {(config.scenario === 'facing_raise' || config.scenario === 'facing_3bet' || config.scenario === 'bb_defense') && (
          <div className="mt-2">
            <div className={LABEL_CLS}>Opener Position</div>
            <select
              value={config.openerPosition}
              onChange={(e) => setConfig({ ...config, openerPosition: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">— None —</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* CSV action column mapping */}
      {mode === 'csv' && (
        <div className={SECTION_CLS}>
          <div className="mb-3 text-[11px] font-semibold text-white/60">CSV Column Mapping</div>
          <div className="space-y-1.5">
            {csvActionColumns.map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={col.columnName}
                  onChange={(e) => setCsvActionColumns(prev => prev.map((c, idx) => idx === i ? { ...c, columnName: e.target.value } : c))}
                  placeholder="CSV column name"
                  className={`${INPUT_CLS} flex-1`}
                />
                <select
                  value={col.action}
                  onChange={(e) => setCsvActionColumns(prev => prev.map((c, idx) => idx === i ? { ...c, action: e.target.value } : c))}
                  className={`${INPUT_CLS} w-24`}
                >
                  <option value="fold">fold</option>
                  <option value="call">call</option>
                  <option value="raise">raise</option>
                  <option value="bet">bet</option>
                  <option value="check">check</option>
                  <option value="all-in">all-in</option>
                </select>
                <input
                  value={col.label}
                  onChange={(e) => setCsvActionColumns(prev => prev.map((c, idx) => idx === i ? { ...c, label: e.target.value } : c))}
                  placeholder="Label"
                  className={`${INPUT_CLS} w-24`}
                />
              </div>
            ))}
            <button
              onClick={() => setCsvActionColumns(prev => [...prev, { columnName: '', action: 'fold', label: 'Fold' }])}
              className="text-[10px] font-semibold text-[#d4a52c]/70 hover:text-[#d4a52c]"
            >
              + Add Column
            </button>
          </div>
        </div>
      )}

      {/* Data input */}
      <div className={SECTION_CLS}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white/60">
            {mode === 'json' ? 'JSON Data' : 'CSV Data'}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={mode === 'json' ? '.json' : '.csv'}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-semibold text-white/50 hover:text-white/80"
            >
              <Upload className="h-3 w-3" /> Upload File
            </button>
            <button
              onClick={mode === 'json' ? downloadTemplate : downloadCsvTemplate}
              className="rounded-md border border-white/10 px-2 py-1 text-[9px] font-semibold text-white/50 hover:text-white/80"
            >
              Template
            </button>
          </div>
        </div>
        <textarea
          value={mode === 'json' ? jsonText : csvText}
          onChange={(e) => mode === 'json' ? setJsonText(e.target.value) : setCsvText(e.target.value)}
          placeholder={mode === 'json'
            ? '{\n  "configuration": { ... },\n  "available_actions": [ ... ],\n  "hands": { "AA": [{"action":"raise","frequency":1}], ... }\n}'
            : 'Hand,Fold,Call,Raise2.2,AllIn\nAA,0,0,1,0\nAKs,0,0,1,0\n...'
          }
          rows={8}
          className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-[10px] text-white/70 outline-none focus:border-[#d4a52c]/40"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={mode === 'json' ? handleJsonImport : handleCsvImport}
            disabled={mode === 'json' ? !jsonText.trim() : !csvText.trim()}
            className="rounded-md bg-gradient-to-r from-[#d4a52c] to-[#c0911e] px-4 py-1.5 text-[11px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c] disabled:opacity-30"
          >
            Import Strategy
          </button>
        </div>
      </div>

      {/* Import result */}
      {result && (
        <div className={`rounded-xl border p-3 ${
          result.success
            ? 'border-[#4ade80]/20 bg-[#4ade80]/5'
            : 'border-[#ef4444]/20 bg-[#ef4444]/5'
        }`}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-[#4ade80]" />
            ) : (
              <XCircle className="h-4 w-4 text-[#ef4444]" />
            )}
            <span className="text-[11px] font-semibold text-white/70">
              {result.success ? 'Import successful' : 'Import failed'}
            </span>
          </div>
          {result.error && (
            <p className="mt-1 text-[10px] text-[#ef4444]/70">{result.error}</p>
          )}
          {result.dataset && (
            <p className="mt-1 text-[10px] text-white/40 font-mono">{result.dataset.configurationKey}</p>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {result.warnings.slice(0, 10).map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px] text-[#f5e6b0]/50">
                  <AlertCircle className="h-2.5 w-2.5 shrink-0" /> {w}
                </div>
              ))}
              {result.warnings.length > 10 && (
                <p className="text-[9px] text-white/30">... and {result.warnings.length - 10} more warnings</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Imported datasets list */}
      <div className={SECTION_CLS}>
        <div className="mb-3 text-[11px] font-semibold text-white/60">Imported Datasets ({importedList.length})</div>
        {importedList.length === 0 ? (
          <p className="text-[10px] text-white/30">No datasets imported yet. Import a JSON or CSV file to populate reference data.</p>
        ) : (
          <div className="space-y-1.5">
            {importedList.map((ds) => (
              <div key={ds.configurationKey} className="flex items-center justify-between rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-mono text-white/60">{ds.configurationKey}</div>
                  <div className="text-[9px] text-white/30">
                    {ds.provider} · {Object.keys(ds.data.hands).length} hands
                    {ds.notes ? ` · ${ds.notes.slice(0, 50)}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(ds.configurationKey)}
                  className="ml-2 shrink-0 rounded p-1 text-white/30 hover:text-[#ef4444]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
