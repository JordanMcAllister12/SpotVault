import { useState, useCallback, useRef, type DragEvent } from 'react';
import {
  UploadCloud, FileText, Trophy, CheckCircle2, AlertTriangle,
  X, Plus, RefreshCw, Database, ArrowRight, Loader2,
} from 'lucide-react';
import {
  DEMO_ENTRIES, computeSyncSummary, formatCurrency, formatPlainCurrency,
  type TournamentEntry,
} from '@/data/pokerDataSync';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type UploadKind = 'hh' | 'summary';

interface UploadedFile {
  name: string;
  size: number;
  kind: UploadKind;
  progress: number;
}

type Phase = 'idle' | 'uploading' | 'review' | 'confirmed';

export function DataSyncWidget() {
  const [hhFiles, setHhFiles] = useState<UploadedFile[]>([]);
  const [summaryFiles, setSummaryFiles] = useState<UploadedFile[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [hhDragOver, setHhDragOver] = useState(false);
  const [sumDragOver, setSumDragOver] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>('Today 2:41 AM');
  const [entries] = useState<TournamentEntry[]>(DEMO_ENTRIES);
  const summary = computeSyncSummary(entries);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulateProgress = useCallback((files: UploadedFile[], kind: UploadKind, setter: (f: UploadedFile[]) => void) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setPhase('uploading');
    const working = files.map((f) => ({ ...f, progress: 0 }));
    setter(working);
    progressTimer.current = setInterval(() => {
      setter((prev) => {
        const allDone = prev.every((f) => f.progress >= 100);
        if (allDone) {
          if (progressTimer.current) clearInterval(progressTimer.current);
          setPhase('review');
          return prev;
        }
        return prev.map((f) => ({
          ...f,
          progress: Math.min(100, f.progress + Math.random() * 18 + 8),
        }));
      });
    }, 220);
  }, []);

  const handleFiles = useCallback((fileList: FileList | null, kind: UploadKind) => {
    if (!fileList || fileList.length === 0) return;
    const newFiles: UploadedFile[] = Array.from(fileList).map((f) => ({
      name: f.name,
      size: f.size,
      kind,
      progress: 0,
    }));
    if (kind === 'hh') {
      setHhFiles((prev) => [...prev, ...newFiles]);
      simulateProgress(newFiles, 'hh', setHhFiles);
    } else {
      setSummaryFiles((prev) => [...prev, ...newFiles]);
      simulateProgress(newFiles, 'summary', setSummaryFiles);
    }
  }, [simulateProgress]);

  const onDrop = useCallback((e: DragEvent, kind: UploadKind) => {
    e.preventDefault();
    if (kind === 'hh') setHhDragOver(false); else setSumDragOver(false);
    handleFiles(e.dataTransfer.files, kind);
  }, [handleFiles]);

  const loadDemoImport = useCallback(() => {
    const hhDemo: UploadedFile[] = entries
      .filter((e) => e.hhFile)
      .map((e) => ({ name: e.hhFile!, size: 12000 + Math.random() * 80000, kind: 'hh' as const, progress: 0 }));
    const sumDemo: UploadedFile[] = entries
      .filter((e) => e.summaryFile)
      .map((e) => ({ name: e.summaryFile!, size: 2000 + Math.random() * 6000, kind: 'summary' as const, progress: 0 }));
    setHhFiles(hhDemo);
    setSummaryFiles(sumDemo);
    simulateProgress(hhDemo, 'hh', setHhFiles);
  }, [entries, simulateProgress]);

  const confirmImport = useCallback(() => {
    setPhase('confirmed');
    setLastSync('Just now');
  }, []);

  const reset = useCallback(() => {
    setHhFiles([]);
    setSummaryFiles([]);
    setPhase('idle');
  }, []);

  const hhDone = hhFiles.length > 0 && hhFiles.every((f) => f.progress >= 100);
  const sumDone = summaryFiles.length > 0 && summaryFiles.every((f) => f.progress >= 100);

  return (
    <div className="h-full overflow-y-auto p-3">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[12px] font-semibold text-white">Poker Data Sync</span>
        <span className="ml-auto text-[9px] text-white/30">
          {lastSync ? `Last Sync: ${lastSync}` : 'No sync yet'}
        </span>
      </div>

      {/* HH drop zone */}
      <DropZone
        label="Drop Hand Histories"
        icon={FileText}
        dragOver={hhDragOver}
        onDragOver={(e) => { e.preventDefault(); setHhDragOver(true); }}
        onDragLeave={() => setHhDragOver(false)}
        onDrop={(e) => onDrop(e, 'hh')}
        onPick={() => document.getElementById('hh-input')?.click()}
        inputId="hh-input"
        accept=".txt,.hh"
        onFiles={(fl) => handleFiles(fl, 'hh')}
      />

      {/* HH file list */}
      {hhFiles.length > 0 && (
        <FileList files={hhFiles} onClear={() => setHhFiles([])} />
      )}
      {hhDone && (
        <div className="mt-1.5 mb-3 rounded-md border border-white/[0.06] bg-black/30 px-2.5 py-2">
          <div className="text-[10px] font-semibold text-white/70">Hand Histories</div>
          <div className="mt-0.5 text-[9px] text-white/40">
            {hhFiles.length} files uploaded &middot; {summary.handsParsed.toLocaleString()} hands parsed &middot; {summary.totalEntries} tournament entries detected
          </div>
          <button
            onClick={() => document.getElementById('hh-input')?.click()}
            className="mt-1.5 flex items-center gap-1 text-[9px] font-medium transition-colors hover:text-white"
            style={{ color: GOLD_SOFT }}
          >
            <Plus className="h-3 w-3" strokeWidth={2} /> Add More
          </button>
        </div>
      )}

      {/* Summary drop zone */}
      <div className="mt-3">
        <DropZone
          label="Drop Tournament Summaries"
          icon={Trophy}
          dragOver={sumDragOver}
          onDragOver={(e) => { e.preventDefault(); setSumDragOver(true); }}
          onDragLeave={() => setSumDragOver(false)}
          onDrop={(e) => onDrop(e, 'summary')}
          onPick={() => document.getElementById('sum-input')?.click()}
          inputId="sum-input"
          accept=".txt,.csv"
          onFiles={(fl) => handleFiles(fl, 'summary')}
        />
      </div>

      {/* Summary file list */}
      {summaryFiles.length > 0 && (
        <FileList files={summaryFiles} onClear={() => setSummaryFiles([])} />
      )}
      {sumDone && (
        <div className="mt-1.5 rounded-md border border-white/[0.06] bg-black/30 px-2.5 py-2">
          <div className="text-[10px] font-semibold text-white/70">Summaries Uploaded</div>
          <div className="mt-0.5 text-[9px] text-white/40">
            {summaryFiles.length} tournament summaries &middot; {summary.totalEntries} entries detected
          </div>
        </div>
      )}

      {/* Data check */}
      {hhDone && sumDone && phase !== 'confirmed' && (
        <DataCheck summary={summary} />
      )}

      {/* Import review */}
      {phase === 'review' && hhDone && sumDone && (
        <ImportReview summary={summary} onConfirm={confirmImport} />
      )}

      {/* Confirmed state */}
      {phase === 'confirmed' && (
        <ConfirmedState summary={summary} onReset={reset} />
      )}

      {/* Demo load button */}
      {phase === 'idle' && hhFiles.length === 0 && summaryFiles.length === 0 && (
        <button
          onClick={loadDemoImport}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[10px] font-semibold tracking-wide transition-all hover:scale-[1.02]"
          style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          Load Demo Import (14 entries)
        </button>
      )}
    </div>
  );
}

function DropZone({
  label, icon: Icon, dragOver, onDragOver, onDragLeave, onDrop, onPick, inputId, accept, onFiles,
}: {
  label: string;
  icon: typeof FileText;
  dragOver: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onPick: () => void;
  inputId: string;
  accept: string;
  onFiles: (fl: FileList | null) => void;
}) {
  return (
    <>
      <div
        className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 transition-all ${dragOver ? 'scale-[1.01]' : ''}`}
        style={{
          borderColor: dragOver ? GOLD : BORDER,
          background: dragOver ? 'rgba(212,165,44,0.08)' : 'rgba(255,255,255,0.02)',
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onPick}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.08)' }}>
          <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-semibold text-white/80">{label}</div>
          <div className="text-[9px] text-white/30">Single, batch, or full tournament</div>
        </div>
        <UploadCloud className="h-4 w-4 text-white/30" strokeWidth={1.5} />
      </div>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </>
  );
}

function FileList({ files, onClear }: { files: UploadedFile[]; onClear: () => void }) {
  return (
    <div className="mt-1.5 space-y-1">
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-white/[0.04] bg-black/20 px-2.5 py-1.5">
          <FileText className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
          <span className="flex-1 truncate text-[9px] text-white/60">{f.name}</span>
          {f.progress < 100 ? (
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${f.progress}%`, background: GOLD }} />
              </div>
              <Loader2 className="h-3 w-3 animate-spin text-white/30" strokeWidth={1.5} />
            </div>
          ) : (
            <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: '#4ade80' }} strokeWidth={1.5} />
          )}
        </div>
      ))}
      <button onClick={onClear} className="flex items-center gap-1 text-[8px] text-white/25 transition-colors hover:text-white/60">
        <X className="h-2.5 w-2.5" strokeWidth={1.5} /> Clear
      </button>
    </div>
  );
}

function DataCheck({ summary }: { summary: ReturnType<typeof computeSyncSummary> }) {
  const missing = summary.totalEntries - summary.summariesMatched;
  const extra = summary.summariesMatched > summary.totalEntries ? summary.summariesMatched - summary.totalEntries : 0;
  const complete = summary.summariesMatched === summary.totalEntries;

  return (
    <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
      <div className="mb-2 flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[10px] font-semibold tracking-wide text-white/70">DATA CHECK</span>
      </div>
      <div className="space-y-1">
        <CheckRow label="Hand History Data" value={`${summary.totalEntries} tournament entries detected`} />
        <CheckRow label="Tournament Summaries" value={`${summary.summariesTotal} summaries detected`} />
        <div className="border-t border-white/[0.06] pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/70">MATCH STATUS</span>
            <span className="text-[10px] font-bold" style={{ color: complete ? '#4ade80' : '#f59e0b' }}>
              {summary.summariesMatched} / {summary.totalEntries} MATCHED
            </span>
          </div>
          {complete ? (
            <div className="mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#4ade80' }} strokeWidth={1.5} />
              <span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>COMPLETE</span>
            </div>
          ) : missing > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
              <span className="text-[10px] font-medium" style={{ color: '#f59e0b' }}>{missing} SUMMARY MISSING</span>
            </div>
          ) : extra > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
              <span className="text-[10px] font-medium" style={{ color: '#f59e0b' }}>EXTRA SUMMARY DETECTED</span>
            </div>
          ) : null}
          {summary.needsReview > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
              <span className="text-[10px] font-medium" style={{ color: '#f59e0b' }}>{summary.needsReview} NEED REVIEW</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-white/40">{label}</span>
      <span className="text-[9px] font-medium text-white/70">{value}</span>
    </div>
  );
}

function ImportReview({ summary, onConfirm }: { summary: ReturnType<typeof computeSyncSummary>; onConfirm: () => void }) {
  return (
    <div className="mt-3 rounded-lg border px-3 py-3" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.6)' }}>
      <div className="mb-2 flex items-center gap-1.5">
        <ArrowRight className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[10px] font-semibold tracking-wide text-white/70">IMPORT REVIEW</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <ReviewRow label="Tournament Entries" value={String(summary.totalEntries)} />
        <ReviewRow label="Re-Entries" value={String(summary.reEntries)} />
        <ReviewRow label="Unique Events" value={String(summary.uniqueEvents)} />
        <ReviewRow label="Hands" value={summary.handsParsed.toLocaleString()} />
        <ReviewRow label="Summaries Matched" value={`${summary.summariesMatched}/${summary.summariesTotal}`} />
      </div>
      <div className="mt-2.5 rounded-md border border-white/[0.06] bg-black/30 px-2.5 py-2">
        <div className="text-[9px] text-white/40">TOTAL TOURNAMENTS FOR ANALYTICS</div>
        <div className="text-lg font-bold" style={{ color: GOLD }}>{summary.totalEntries}</div>
      </div>
      <button
        onClick={onConfirm}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-bold tracking-wide transition-all hover:scale-[1.02]"
        style={{ borderColor: GOLD, color: '#080706', background: GOLD }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
        CONFIRM IMPORT
      </button>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-white/40">{label}</span>
      <span className="text-[11px] font-semibold text-white/80">{value}</span>
    </div>
  );
}

function ConfirmedState({ summary, onReset }: { summary: ReturnType<typeof computeSyncSummary>; onReset: () => void }) {
  return (
    <div className="mt-3 rounded-lg border px-3 py-3" style={{ borderColor: 'rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.04)' }}>
      <div className="mb-2 flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4" style={{ color: '#4ade80' }} strokeWidth={1.5} />
        <span className="text-[11px] font-semibold text-white">Import Confirmed</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <ReviewRow label="Total Tournaments" value={String(summary.totalEntries)} />
        <ReviewRow label="Total Buy-Ins" value={formatPlainCurrency(summary.totalBuyIns)} />
        <ReviewRow label="Cashes" value={formatPlainCurrency(summary.totalCashes)} />
        <ReviewRow label="Profit" value={formatCurrency(summary.profit)} />
        <ReviewRow label="ROI" value={`${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(1)}%`} />
        <ReviewRow label="ABI" value={formatPlainCurrency(Math.round(summary.abi))} />
        <ReviewRow label="ITM %" value={`${summary.itm.toFixed(1)}%`} />
        <ReviewRow label="Final Tables" value={String(summary.finalTables)} />
        <ReviewRow label="Wins" value={String(summary.wins)} />
      </div>
      <div className="mt-2 rounded-md bg-black/30 px-2.5 py-1.5">
        <span className="text-[9px] text-white/40">Re-entries counted as separate tournaments: </span>
        <span className="text-[9px] font-semibold" style={{ color: GOLD }}>{summary.reEntries} re-entries included</span>
      </div>
      <button
        onClick={onReset}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-[10px] font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
        New Sync
      </button>
    </div>
  );
}
