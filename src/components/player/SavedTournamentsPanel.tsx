import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy, Check, Download, MoreHorizontal, Trash2, Pencil,
  Trophy, FolderOpen, Send, AlertCircle, FileText, ChevronUp,
} from 'lucide-react';
import {
  fetchSavedTournaments, fetchSavedTournament, saveTournament,
  renameSavedTournament, deleteSavedTournament, reparseSavedTournament,
  type SavedTournamentSummary,
} from '@/lib/savedTournamentStore';
import { splitTournamentHands, parseTournamentMetadata } from '@/lib/tournamentHandParser';
import { parseRawHandText } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';

const GOLD = '#d4a52c';
const BORDER = 'rgba(255,255,255,0.08)';
const DARK_PANEL = 'rgba(8,7,6,0.88)';
const DARKER_PANEL = 'rgba(5,4,3,0.92)';

interface FilePreview {
  fileName: string;
  rawText: string;
  detected: number;
  parsed: number;
  failed: number;
  tournamentName: string | null;
}

interface SavedTournamentsPanelProps {
  userId: string;
  onOpenTournament: (hands: NormalizedHand[], tournamentName: string) => void;
}

export function SavedTournamentsPanel({ userId, onOpenTournament }: SavedTournamentsPanelProps) {
  const [tournaments, setTournaments] = useState<SavedTournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPasteZone, setShowPasteZone] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [reading, setReading] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const loadTournaments = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await fetchSavedTournaments(userId);
    setTournaments(data);
    setLoading(false);

    // Re-parse any tournaments with 0 hands that have raw HH text
    for (const t of data) {
      if (t.hand_count === 0) {
        void reparseSavedTournament(t.id).then(() => loadTournaments());
      }
    }
  }, [userId]);

  useEffect(() => { void loadTournaments(); }, [loadTournaments]);



  const readFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const text = await file.text();
      if (!text || text.trim().length < 50) {
        setUploadError('File appears to be empty or too short to be a valid hand history.');
        return null;
      }
      return text;
    } catch {
      setUploadError('Could not read the file. Please ensure it is a valid text file.');
      return null;
    }
  }, []);

  const previewFile = useCallback(async (file: File) => {
    setUploadError(null);
    setFilePreview(null);
    setReading(true);
    const text = await readFile(file);
    setReading(false);
    if (!text) return;

    const parsed = parseTournamentMetadata(text);
    const blocks = splitTournamentHands(text);
    let parsedCount = 0;
    for (const block of blocks) {
      try {
        const normalized = parseRawHandText(block);
        if (normalized.actions.length > 0) parsedCount++;
      } catch {
        // skip
      }
    }

    setFilePreview({
      fileName: file.name,
      rawText: text,
      detected: parsed.handCount,
      parsed: parsedCount,
      failed: parsed.handCount - parsedCount,
      tournamentName: parsed.tournamentName,
    });
  }, [readFile]);

  const handleSaveFromPreview = useCallback(async () => {
    if (!filePreview) return;
    setSaving(true);
    setUploadError(null);
    const result = await saveTournament(userId, filePreview.rawText, filePreview.fileName);
    if (!result) {
      setUploadError('Failed to save tournament. Please try again.');
    } else {
      setFilePreview(null);
      void loadTournaments();
    }
    setSaving(false);
  }, [filePreview, userId, loadTournaments]);

  const handlePastePreview = useCallback(async () => {
    if (!pasteText.trim() || pasteText.trim().length < 50) {
      setUploadError('Pasted text is too short to be a valid hand history.');
      return;
    }
    setReading(true);
    setUploadError(null);
    const parsed = parseTournamentMetadata(pasteText);
    const blocks = splitTournamentHands(pasteText);
    let parsedCount = 0;
    for (const block of blocks) {
      try {
        const normalized = parseRawHandText(block);
        if (normalized.actions.length > 0) parsedCount++;
      } catch {
        // skip
      }
    }
    setReading(false);
    setFilePreview({
      fileName: 'pasted-hh.txt',
      rawText: pasteText,
      detected: parsed.handCount,
      parsed: parsedCount,
      failed: parsed.handCount - parsedCount,
      tournamentName: parsed.tournamentName,
    });
  }, [pasteText]);

  const handleCopyHH = useCallback(async (id: string) => {
    const tournament = await fetchSavedTournament(id);
    if (!tournament) return;
    try {
      await navigator.clipboard.writeText(tournament.raw_hh_text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  }, []);

  const handleDownloadHH = useCallback(async (id: string) => {
    const tournament = await fetchSavedTournament(id);
    if (!tournament) return;
    const fileName = (tournament.source_file_name || `${tournament.name.replace(/[^a-z0-9]/gi, '_')}.txt`);
    const blob = new Blob([tournament.raw_hh_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleOpenTournament = useCallback(async (id: string) => {
    const tournament = await fetchSavedTournament(id);
    if (!tournament) return;
    const handBlocks = splitTournamentHands(tournament.raw_hh_text);
    const hands: NormalizedHand[] = [];
    let failed = 0;
    for (const block of handBlocks) {
      try {
        const normalized = parseRawHandText(block);
        if (normalized.actions.length > 0) hands.push(normalized);
        else failed++;
      } catch {
        failed++;
      }
    }
    if (hands.length === 0) return;
    onOpenTournament(hands, tournament.name);
  }, [onOpenTournament]);

  const handleSendToWorkspace = useCallback(async (id: string) => {
    const tournament = await fetchSavedTournament(id);
    if (!tournament) return;
    try {
      await navigator.clipboard.writeText(tournament.raw_hh_text);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('sv-send-tournament-to-workspace', {
      detail: { id, rawText: tournament.raw_hh_text, name: tournament.name },
    }));
  }, []);

  const handleRename = useCallback(async (id: string) => {
    if (!renameDraft.trim()) return;
    await renameSavedTournament(id, renameDraft.trim());
    setRenamingId(null);
    setRenameDraft('');
    void loadTournaments();
  }, [renameDraft, loadTournaments]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSavedTournament(id);
    setDeleteConfirmId(null);
    void loadTournaments();
  }, [loadTournaments]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      {/* Upload zone — full clickable drag-drop box */}
      <div className="flex flex-col gap-1.5">
        {!filePreview ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void previewFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-all"
            style={{
              borderColor: dragOver ? 'rgba(192,145,30,0.5)' : 'rgba(255,255,255,0.12)',
              background: dragOver ? 'rgba(192,145,30,0.08)' : DARK_PANEL,
            }}>
            {reading ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                <span className="text-[10px] text-white/50">Reading tournament...</span>
              </div>
            ) : (
              <>
                <ChevronUp size={20} style={{ color: GOLD }} className="mx-auto mb-1.5" />
                <p className="text-[11px] font-bold text-white/60">DROP TOURNAMENT HH HERE</p>
                <p className="mt-0.5 text-[10px] text-white/35">or click to choose a file</p>
                <div className="mt-2.5 flex items-center justify-center gap-1.5">
                  <span
                    className="rounded-md border px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{ borderColor: `rgba(${192},${145},${30},0.3)`, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                    Browse
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowPasteZone(s => !s); setUploadError(null); }}
                    className="rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:scale-[1.02]"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a93a2' }}>
                    Paste HH
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.hh,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void previewFile(file);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: DARKER_PANEL }}>
            <div className="flex items-center gap-1.5">
              <FileText size={12} style={{ color: GOLD }} className="shrink-0" />
              <span className="truncate text-[10px] font-mono text-white/70">{filePreview.fileName}</span>
            </div>
            <div className="mt-2 space-y-1">
              {filePreview.detected === 0 ? (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={12} style={{ color: '#f59e0b' }} />
                  <span className="text-[10px] font-semibold text-amber-300/80">NO HANDS DETECTED</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Check size={12} style={{ color: '#4ade80' }} />
                  <span className="text-[10px] font-semibold text-green-300/80">
                    {filePreview.detected} hands detected
                  </span>
                </div>
              )}
              {filePreview.detected > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/50">
                    {filePreview.parsed} hands parsed
                  </span>
                  {filePreview.failed > 0 && (
                    <span className="text-[10px] text-amber-400/60">
                      ({filePreview.failed} could not be parsed)
                    </span>
                  )}
                </div>
              )}
              {filePreview.tournamentName && (
                <div className="flex items-center gap-1.5">
                  <Trophy size={10} style={{ color: GOLD }} />
                  <span className="text-[10px] text-white/60">{filePreview.tournamentName}</span>
                </div>
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-end gap-1.5">
              <button
                onClick={() => { setFilePreview(null); setUploadError(null); }}
                className="rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#6b7280' }}>
                Cancel
              </button>
              <button
                onClick={() => void handleSaveFromPreview()}
                disabled={saving}
                className="rounded-md border px-3 py-1 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50"
                style={{ borderColor: `rgba(${192},${145},${30},0.3)`, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                {saving ? 'Saving...' : 'Save Tournament'}
              </button>
            </div>
          </div>
        )}

        {showPasteZone && !filePreview && (
          <div className="rounded-lg border p-2" style={{ borderColor: BORDER, background: DARKER_PANEL }}>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste complete tournament hand history text here..."
              className="h-24 w-full resize-none rounded-md border bg-transparent p-2 text-[10px] font-mono text-white/70 placeholder:text-white/20 outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            />
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <button
                onClick={() => { setShowPasteZone(false); setPasteText(''); setUploadError(null); }}
                className="rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#6b7280' }}>
                Cancel
              </button>
              <button
                onClick={() => void handlePastePreview()}
                disabled={reading || !pasteText.trim()}
                className="rounded-md border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50"
                style={{ borderColor: `rgba(${192},${145},${30},0.3)`, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                {reading ? 'Reading...' : 'Preview'}
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
            <AlertCircle size={12} style={{ color: '#f87171' }} />
            <span className="text-[10px] text-red-300/80">{uploadError}</span>
          </div>
        )}
      </div>

      {/* Tournament list */}
      <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-1.5 lg:gap-1.5 lg:p-2" style={{ borderColor: BORDER, background: DARK_PANEL, maxHeight: '52vh' }}>
        {loading && <div className="py-3 text-center text-[11px] text-white/40">Loading...</div>}
        {!loading && tournaments.length === 0 && (
          <div className="py-6 text-center text-[11px] text-white/40 lg:py-8">
            No saved tournaments yet. Upload a tournament HH file to get started.
          </div>
        )}
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border px-2.5 py-2 transition-all hover:scale-[1.01] lg:px-3 lg:py-2.5"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {renamingId === t.id ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(t.id); if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); } }}
                  autoFocus
                  className="flex-1 rounded-md border bg-transparent px-2 py-1 text-[11px] text-white outline-none"
                  style={{ borderColor: `rgba(${192},${145},${30},0.3)` }}
                />
                <button onClick={() => void handleRename(t.id)} className="text-[10px] font-bold text-[#d4a52c]">Save</button>
                <button onClick={() => { setRenamingId(null); setRenameDraft(''); }} className="text-[10px] text-white/40">Cancel</button>
              </div>
            ) : deleteConfirmId === t.id ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-white/60">Delete "{t.name}"? This cannot be undone.</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => void handleDelete(t.id)}
                    className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-bold uppercase text-red-300">
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="rounded-md border px-2 py-1 text-[9px] font-semibold uppercase text-white/50"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Trophy size={10} style={{ color: GOLD }} className="shrink-0" />
                      <span className="truncate text-[11px] font-bold text-white/80">{t.name}</span>
                    </div>
                    {t.site && <span className="text-[9px] text-white/35">{t.site}</span>}
                    <span className="text-[9px] text-white/30">{formatDate(t.played_at ?? t.created_at)}</span>
                    <span className="text-[9px] font-semibold text-white/40">{t.hand_count} Hands</span>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        if (menuOpenId === t.id) {
                          setMenuOpenId(null);
                          setMenuAnchor(null);
                        } else {
                          setMenuOpenId(t.id);
                          setMenuAnchor(e.currentTarget);
                        }
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-all hover:bg-white/5"
                      style={{ color: '#6b7280' }}>
                      <MoreHorizontal size={14} />
                    </button>
                    {menuOpenId === t.id && menuAnchor && createPortal(
                      <TournamentMenuPortal
                        anchor={menuAnchor}
                        onClose={() => { setMenuOpenId(null); setMenuAnchor(null); }}
                        actions={[
                          { icon: <Pencil size={11} />, label: 'Rename', onClick: () => { setMenuOpenId(null); setMenuAnchor(null); setRenamingId(t.id); setRenameDraft(t.name); } },
                          { icon: <Copy size={11} />, label: 'Copy HH', onClick: () => { setMenuOpenId(null); setMenuAnchor(null); void handleCopyHH(t.id); } },
                          { icon: <Download size={11} />, label: 'Download HH', onClick: () => { setMenuOpenId(null); setMenuAnchor(null); void handleDownloadHH(t.id); } },
                          { icon: <Send size={11} />, label: 'Send to Workspace', onClick: () => { setMenuOpenId(null); setMenuAnchor(null); void handleSendToWorkspace(t.id); } },
                          { icon: <Trash2 size={11} />, label: 'Delete', danger: true, onClick: () => { setMenuOpenId(null); setMenuAnchor(null); setDeleteConfirmId(t.id); } },
                        ]}
                      />,
                      document.body
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    onClick={() => void handleOpenTournament(t.id)}
                    disabled={t.hand_count === 0}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] disabled:opacity-30"
                    style={{ borderColor: `rgba(${192},${145},${30},0.3)`, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                    <FolderOpen size={10} /> Open
                  </button>
                  <button
                    onClick={() => void handleCopyHH(t.id)}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:scale-[1.02]"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a93a2' }}>
                    {copiedId === t.id ? <Check size={10} style={{ color: '#4ade80' }} /> : <Copy size={10} />}
                    {copiedId === t.id ? 'Copied!' : 'Copy HH'}
                  </button>
                  <button
                    onClick={() => void handleDownloadHH(t.id)}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:scale-[1.02]"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a93a2' }}>
                    <Download size={10} /> Export
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TournamentMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function TournamentMenuPortal({ anchor, onClose, actions }: { anchor: HTMLElement; onClose: () => void; actions: TournamentMenuItem[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const MENU_WIDTH = 176;
  const MENU_MARGIN = 4;
  const ITEM_HEIGHT = 36;

  useEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const menuHeight = actions.length * ITEM_HEIGHT + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight + MENU_MARGIN && spaceAbove > spaceBelow;
    const top = openUpward
      ? Math.max(MENU_MARGIN, rect.top - menuHeight - MENU_MARGIN)
      : rect.bottom + MENU_MARGIN;
    let left = rect.right - MENU_WIDTH;
    if (left < MENU_MARGIN) left = MENU_MARGIN;
    if (left + MENU_WIDTH > window.innerWidth - MENU_MARGIN) {
      left = window.innerWidth - MENU_WIDTH - MENU_MARGIN;
    }
    setPos({ top, left });
  }, [anchor, actions.length]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [anchor, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        ref={menuRef}
        className="fixed z-[201] w-44 rounded-lg border bg-[#0d0f12] py-1 shadow-2xl"
        style={{ borderColor: 'rgba(212,165,44,0.2)', top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => { a.onClick(); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-medium transition-colors hover:bg-white/5 ${a.danger ? 'text-red-400 hover:text-red-300' : 'text-white/70 hover:text-[#f5e6b0]'}`}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
