import { useRef, useState } from 'react';
import {
  ClipboardPaste, FileText, X, AlertCircle, CheckCircle2, Loader2,
  Plus, FolderPlus, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  parseRawText, createBatch, addHandsToBatch, fetchBatchHands,
  type HandBatch, type BatchSourceType,
} from '@/lib/batchStore';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const SECTION_BG = 'rgba(8,10,12,0.82)';

interface HandUploadBarProps {
  onUploaded: () => void;
  handCount: number;
  currentBatch: HandBatch | null;
  batches: HandBatch[];
  onSelectBatch: (batch: HandBatch) => void;
  onBatchCreated: (batch: HandBatch) => void;
  onBuildHand?: () => void;
  onPaste?: () => void;
  onUploadFile?: () => void;
  mobileCompact?: boolean;
  onAddHand?: () => void;
  selectorOnly?: boolean;
}

type UploadTarget = 'current' | 'new';

export function HandUploadBar({ onUploaded, handCount, currentBatch, batches, onSelectBatch, onBatchCreated, onBuildHand, onPaste, onUploadFile, mobileCompact, onAddHand, selectorOnly }: HandUploadBarProps) {
  const [uploadState, setUploadState] = useState<'idle' | 'parsing' | 'saving' | 'done' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, errors: 0, duplicates: 0 });
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSource, setImportSource] = useState<'paste' | 'file_upload'>('paste');
  const [importFileName, setImportFileName] = useState('');
  const [importTarget, setImportTarget] = useState<UploadTarget>('current');
  const [newBatchName, setNewBatchName] = useState('');
  const [detectedHands, setDetectedHands] = useState(0);
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parseRawText> | null>(null);
  const [showBatchSelector, setShowBatchSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  };

  const handleRawText = async (rawText: string, sourceType: BatchSourceType, fileName?: string) => {
    setUploadState('parsing');
    const result = parseRawText(rawText);
    setParsedRows(result);
    setDetectedHands(result.rows.length);
    setImportText(rawText);
    setImportSource(sourceType === 'drag_drop' ? 'file_upload' : sourceType);
    setImportFileName(fileName ?? '');
    setUploadState('idle');
    setShowImportModal(true);
    setImportTarget(currentBatch ? 'current' : 'new');
    setNewBatchName(fileName?.replace(/\.(txt|hh|history)$/i, '') ?? '');
  };

  const confirmImport = async () => {
    if (!parsedRows || parsedRows.rows.length === 0) return;
    const userId = await getUserId();
    if (!userId) return;

    setUploadState('saving');
    setUploadProgress({ current: 0, total: parsedRows.rows.length, errors: 0, duplicates: 0 });

    let batchId: string;
    let batch: HandBatch | null = null;

    if (importTarget === 'new' || !currentBatch) {
      const title = newBatchName.trim() || (parsedRows.rows.length > 1 ? `Tournament Import ${new Date().toLocaleDateString()}` : 'Untitled Hand Batch');
      const sourceType: BatchSourceType = parsedRows.rows.length > 1 ? (importSource === 'paste' ? 'paste' : 'file_upload') : 'custom';
      batch = await createBatch(userId, title, sourceType);
      if (!batch) {
        setUploadState('error');
        return;
      }
      batchId = batch.id;
      onBatchCreated(batch);
    } else {
      batchId = currentBatch.id;
    }

    const existingHands = await fetchBatchHands(batchId);
    const startSort = existingHands.length;

    const result = await addHandsToBatch(batchId, parsedRows.rows, startSort);
    setUploadProgress({ current: parsedRows.rows.length, total: parsedRows.rows.length, errors: result.errors, duplicates: result.duplicates });

    setUploadState('done');
    setShowImportModal(false);
    setPasteText('');
    setParsedRows(null);
    setImportText('');
    setNewBatchName('');
    onUploaded();
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      void handleRawText(text, 'file_upload', file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    void handleRawText(pasteText, 'paste');
  };

  const createEmptyBatch = async () => {
    const userId = await getUserId();
    if (!userId) return;
    const batch = await createBatch(userId, 'Untitled Hand Batch', 'custom');
    if (batch) {
      onBatchCreated(batch);
      onSelectBatch(batch);
    }
  };

  return (
    <>
      <div
        className="flex min-w-0 flex-1 items-center gap-2"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {uploadState === 'idle' && (
          <div className={`flex w-full flex-wrap items-center gap-1.5 ${mobileCompact ? 'flex-nowrap' : ''}`}>
            {/* Batch selector */}
            <div className="relative">
              <button
                onClick={() => setShowBatchSelector((v) => !v)}
                className={`flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 text-[9px] font-bold text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 whitespace-nowrap ${mobileCompact ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}
              >
                {currentBatch ? (
                  <>
                    <FolderPlus className="h-3 w-3" />
                    {currentBatch.title.length > (mobileCompact ? 12 : 18) ? currentBatch.title.slice(0, mobileCompact ? 12 : 18) + '...' : currentBatch.title}
                    {!mobileCompact && <span className="text-white/40">· {currentBatch.hand_count}</span>}
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" /> No Batch
                  </>
                )}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              {showBatchSelector && (
                <>
                  <div className="fixed inset-0 z-[200]" onClick={() => setShowBatchSelector(false)} />
                  <div className="absolute left-0 top-full z-[300] mt-1 w-64 rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {batches.length === 0 && (
                        <div className="px-2 py-3 text-center text-[10px] text-white/30">No batches yet</div>
                      )}
                      {batches.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => { onSelectBatch(b); setShowBatchSelector(false); }}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[10px] transition ${
                            currentBatch?.id === b.id ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/60 hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate">{b.title}</span>
                          <span className="ml-2 shrink-0 text-white/30">{b.hand_count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-white/[0.06] p-1.5">
                      <button
                        onClick={() => { void createEmptyBatch(); setShowBatchSelector(false); }}
                        className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-semibold text-[#d4a52c] hover:bg-[#c0911e]/10"
                      >
                        <Plus className="h-3 w-3" /> New Batch
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!selectorOnly && (mobileCompact ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onAddHand?.()}
                  className="flex items-center gap-1 rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1 text-[9px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25 whitespace-nowrap"
                >
                  <Plus className="h-3 w-3" /> Add Hand
                </button>
                {onBuildHand && (
                  <button
                    onClick={onBuildHand}
                    className="flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2.5 py-1 text-[9px] font-bold text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 whitespace-nowrap"
                  >
                    <Pencil className="h-3 w-3" /> Construct
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => onPaste ? onPaste() : setShowPaste(true)}
                  className="flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/20 whitespace-nowrap"
                >
                  <ClipboardPaste className="h-3 w-3" /> Paste HH
                </button>
                <button
                  onClick={() => onUploadFile ? onUploadFile() : fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/20 whitespace-nowrap"
                >
                  <FileText className="h-3 w-3" /> Upload File
                </button>
                {onBuildHand && (
                  <button
                    onClick={onBuildHand}
                    className="flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 whitespace-nowrap"
                  >
                    <Pencil className="h-3 w-3" /> Build Hand
                  </button>
                )}
              </>
            ))}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.hh,.history"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {handCount > 0 && (
              <span className="text-[9px] text-white/40 whitespace-nowrap">{handCount} hands</span>
            )}
          </div>
        )}

        {uploadState === 'parsing' && (
          <div className="flex w-full items-center gap-2 px-1">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" style={{ color: GOLD }} />
            <span className="text-[9px] text-white/60 whitespace-nowrap">Parsing {uploadProgress.current}/{uploadProgress.total}</span>
            <div className="flex-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`, background: GOLD }}
              />
            </div>
          </div>
        )}

        {uploadState === 'saving' && (
          <div className="flex w-full items-center gap-2 px-1">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" style={{ color: GOLD }} />
            <span className="text-[9px] text-white/60">Saving hands...</span>
          </div>
        )}

        {uploadState === 'done' && (
          <div className="flex w-full items-center gap-2 px-1">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" />
            <span className="text-[9px] text-emerald-300 whitespace-nowrap">
              {uploadProgress.total - uploadProgress.errors - uploadProgress.duplicates} added
            </span>
            {uploadProgress.duplicates > 0 && (
              <span className="text-[9px] text-amber-300 whitespace-nowrap">{uploadProgress.duplicates} duplicates skipped</span>
            )}
            {uploadProgress.errors > 0 && (
              <span className="text-[9px] text-red-300 whitespace-nowrap">{uploadProgress.errors} errors</span>
            )}
            <button
              onClick={() => setUploadState('idle')}
              className="ml-auto text-[9px] font-semibold text-[#d4a52c] hover:text-[#f5e6b0] uppercase tracking-wide whitespace-nowrap"
            >
              Add More
            </button>
          </div>
        )}

        {uploadState === 'error' && (
          <div className="flex w-full items-center gap-2 px-1">
            <AlertCircle className="h-3 w-3 shrink-0 text-red-300" />
            <span className="text-[9px] text-red-300">Upload failed</span>
            <button onClick={() => setUploadState('idle')} className="ml-auto text-[9px] font-semibold text-[#d4a52c] uppercase">
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Paste Modal */}
      {showPaste && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-2xl rounded-t-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl sm:rounded-xl" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top))' }}>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-5 sm:py-3.5">
              <h2 className="text-sm font-semibold text-white">Paste Hand History</h2>
              <button onClick={() => setShowPaste(false)} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste one or more hand histories here..."
                className="h-40 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none sm:h-64"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setShowPaste(false); setPasteText(''); }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasteSubmit}
                  disabled={!pasteText.trim()}
                  className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30 disabled:opacity-40"
                >
                  Parse &amp; Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {showImportModal && parsedRows && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl sm:rounded-xl" style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top))' }}>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-5 sm:py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-white">Import Hands</h2>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {detectedHands} hand{detectedHands !== 1 ? 's' : ''} detected
                  {parsedRows.errors > 0 && ` · ${parsedRows.errors} parse error${parsedRows.errors !== 1 ? 's' : ''}`}
                  {parsedRows.duplicates > 0 && ` · ${parsedRows.duplicates} duplicate${parsedRows.duplicates !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button onClick={() => { setShowImportModal(false); setParsedRows(null); }} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 sm:p-5" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
              <div>
                <label className="text-[10px] font-semibold tracking-wide text-white/50 uppercase">Add To</label>
                <div className="mt-2 space-y-2">
                  {currentBatch && (
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition ${
                      importTarget === 'current' ? 'border-[#d4a52c]/40 bg-[#c0911e]/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                    }`}>
                      <input
                        type="radio"
                        name="importTarget"
                        checked={importTarget === 'current'}
                        onChange={() => setImportTarget('current')}
                        className="accent-[#d4a52c]"
                      />
                      <div>
                        <div className="text-[11px] font-semibold text-white/80">Current Batch</div>
                        <div className="text-[9px] text-white/40">{currentBatch.title} · {currentBatch.hand_count} hands</div>
                      </div>
                    </label>
                  )}
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition ${
                    importTarget === 'new' ? 'border-[#d4a52c]/40 bg-[#c0911e]/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                  }`}>
                    <input
                      type="radio"
                      name="importTarget"
                      checked={importTarget === 'new'}
                      onChange={() => setImportTarget('new')}
                      className="accent-[#d4a52c]"
                    />
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-white/80">New Batch</div>
                      {importTarget === 'new' && (
                        <input
                          value={newBatchName}
                          onChange={(e) => setNewBatchName(e.target.value)}
                          placeholder="Batch name (e.g. Sunday Final Table Review)"
                          className="mt-1.5 w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {parsedRows.rows.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/30 p-2">
                  {parsedRows.rows.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-1.5 py-1 text-[9px]">
                      <span className="text-white/50">#{r.hand_id?.slice(-4) ?? '?'}</span>
                      <span className="text-white/30">{r.position ?? '?'} · {r.hero_cards ?? '?'}</span>
                      <span className={r.parsed_ok ? 'text-emerald-300/60' : 'text-red-300/60'}>
                        {r.parsed_ok ? 'OK' : 'ERR'}
                      </span>
                    </div>
                  ))}
                  {parsedRows.rows.length > 10 && (
                    <div className="px-1.5 py-1 text-[9px] text-white/30">...and {parsedRows.rows.length - 10} more</div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowImportModal(false); setParsedRows(null); }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void confirmImport()}
                  disabled={importTarget === 'new' && !newBatchName.trim() && parsedRows.rows.length <= 1}
                  className="rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30 disabled:opacity-40"
                >
                  {importTarget === 'new' ? 'Create & Import' : `Add ${parsedRows.rows.length} Hand${parsedRows.rows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
