import { useRef, useState, useCallback } from 'react';
import { Upload, ClipboardPaste, Loader2, AlertCircle, Pencil, Plus } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const GOLD = '#d4a52c';

interface EmptyStateDropZoneProps {
  onFiles: (files: FileList) => void;
  onPaste: () => void;
  isProcessing: boolean;
  error: string | null;
  onBuildHand?: () => void;
  /** When provided, mobile uses this single callback instead of separate buttons */
  onAddHand?: () => void;
}

export function EmptyStateDropZone({ onFiles, onPaste, isProcessing, error, onBuildHand, onAddHand }: EmptyStateDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  }, [onFiles]);

  // ── Mobile compact empty state ──
  if (isMobile) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.hh,.history"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="flex w-full max-w-sm flex-col items-center rounded-xl border border-white/[0.06] bg-transparent px-4 py-6">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
              <p className="text-[11px] font-medium tracking-wide text-white/40 uppercase">Importing...</p>
            </div>
          ) : (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                <Upload className="h-4 w-4" style={{ color: 'rgba(212,165,44,0.35)' }} strokeWidth={1.5} />
              </div>

              <p className="mt-3 text-[13px] font-medium text-white/50">No hands yet</p>
              <p className="mt-1 max-w-[240px] text-center text-[11px] leading-relaxed text-white/25">
                Upload, paste, or build a hand to start reviewing.
              </p>

              <button
                onClick={() => onAddHand?.() ?? fileInputRef.current?.click()}
                className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2.5 text-[11px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Add Hand
              </button>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[8px] text-white/15">
                <span className="font-mono uppercase tracking-wider">PokerStars</span>
                <span className="text-white/[0.06]">·</span>
                <span className="font-mono uppercase tracking-wider">GGPoker</span>
                <span className="text-white/[0.06]">·</span>
                <span className="font-mono uppercase tracking-wider">ACR</span>
                <span className="text-white/[0.06]">·</span>
                <span className="font-mono uppercase tracking-wider">.txt .hh .history</span>
              </div>

              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-300" />
                  <span className="text-[10px] text-red-200">{error}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop (unchanged) ──
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center p-2 sm:p-4"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.hh,.history"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div
        className={`relative flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 transition-all duration-300 sm:px-6 sm:py-14 ${
          isDragging
            ? 'border-[#c0911e]/40 bg-[#c0911e]/[0.04]'
            : 'border-white/[0.06] bg-transparent hover:border-white/[0.1]'
        }`}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 rounded-xl" style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(212,165,44,0.05) 0%, transparent 70%)',
          }} />
        )}

        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
            <p className="text-[11px] font-medium tracking-wide text-white/40 uppercase">Importing...</p>
            <p className="text-[10px] text-white/25">Parsing hands and creating tournament</p>
          </div>
        ) : (
          <>
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 ${
                isDragging ? 'border-[#c0911e]/30 bg-[#c0911e]/[0.04]' : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <Upload
                className={`h-5 w-5 transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}
                style={{ color: isDragging ? 'rgba(212,165,44,0.6)' : 'rgba(212,165,44,0.35)' }}
                strokeWidth={1.5}
              />
            </div>

            <p className="mt-3 text-sm font-medium text-white/40">
              {isDragging ? 'Drop to Import' : 'Drop Hand Histories Here'}
            </p>
            <p className="mt-1 max-w-xs text-center text-[11px] text-white/25">
              Upload a tournament or individual hands to begin reviewing.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20"
              >
                <Upload className="h-3 w-3 shrink-0" strokeWidth={1.5} /> Upload File
              </button>
              <button
                onClick={onPaste}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase transition hover:bg-white/[0.07]"
              >
                <ClipboardPaste className="h-3 w-3 shrink-0" strokeWidth={1.5} /> Paste HH
              </button>
              {onBuildHand && (
                <button
                  onClick={onBuildHand}
                  className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20"
                >
                  <Pencil className="h-3 w-3 shrink-0" strokeWidth={1.5} /> Build Hand
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[8px] text-white/15">
              <span className="font-mono uppercase tracking-wider">PokerStars</span>
              <span className="text-white/[0.06]">·</span>
              <span className="font-mono uppercase tracking-wider">GGPoker</span>
              <span className="text-white/[0.06]">·</span>
              <span className="font-mono uppercase tracking-wider">ACR</span>
              <span className="text-white/[0.06]">·</span>
              <span className="font-mono uppercase tracking-wider">.txt .hh .history</span>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-300" />
                <span className="text-[10px] text-red-200">{error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
