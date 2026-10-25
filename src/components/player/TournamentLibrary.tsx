import { useState, useRef, useEffect } from 'react';
import {
  Upload, ClipboardPaste, FolderOpen, Trophy, Calendar, Layers, Trash2,
  Pencil, Check, X, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react';
import type { TournamentBatch } from '@/lib/tournamentStore';

const GOLD = '#d4a52c';
const GOLD_DIM = 'rgba(212,165,44,0.18)';
const DARK_BG = 'rgba(8,10,12,0.82)';

interface TournamentLibraryProps {
  tournaments: TournamentBatch[];
  currentTournamentId: string | null;
  onSelectTournament: (t: TournamentBatch) => void;
  onRenameTournament: (id: string, title: string) => Promise<void>;
  onDeleteTournament: (id: string) => Promise<void>;
  maxTournaments: number | null;
}

export function TournamentLibrary({
  tournaments,
  currentTournamentId,
  onSelectTournament,
  onRenameTournament,
  onDeleteTournament,
  maxTournaments,
}: TournamentLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (t: TournamentBatch) => {
    setEditingId(t.id);
    setEditValue(t.title);
  };

  const confirmEdit = async () => {
    if (editingId && editValue.trim()) {
      await onRenameTournament(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (confirmDeleteId) {
      await onDeleteTournament(confirmDeleteId);
    }
    setConfirmDeleteId(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const count = tournaments.length;
  const remaining = maxTournaments === null ? null : Math.max(0, maxTournaments - count);

  return (
    <div
      className="flex flex-col rounded-xl border max-h-full overflow-hidden"
      style={{ borderColor: GOLD_DIM, background: DARK_BG, backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h2 className="text-[11px] font-semibold tracking-[0.15em] text-[#aab6c2] uppercase">Tournament Library</h2>
        </div>
        <span className="text-[9px] font-mono text-white/30">
          {count}{maxTournaments !== null ? ` / ${maxTournaments}` : ''} saved
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {count === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-8 w-8 text-white/15 mb-2" strokeWidth={1} />
            <p className="text-[10px] text-white/30">No saved tournaments yet</p>
            <p className="mt-0.5 text-[9px] text-white/20">Import a tournament to get started</p>
          </div>
        )}

        {tournaments.map((t) => (
          <div
            key={t.id}
            className={`group relative rounded-lg border p-2.5 transition cursor-pointer ${
              currentTournamentId === t.id
                ? 'border-[#c0911e]/40 bg-[#c0911e]/12'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-[#c0911e]/20 hover:bg-white/[0.04]'
            }`}
            onClick={() => editingId !== t.id && onSelectTournament(t)}
          >
            {editingId === t.id ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void confirmEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 rounded-md border border-[#d4a52c]/40 bg-black/40 px-2 py-1 text-[10px] text-white/90 focus:outline-none"
                />
                <button onClick={() => void confirmEdit()} className="rounded p-1 text-emerald-300 hover:bg-emerald-300/10">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => setEditingId(null)} className="rounded p-1 text-white/40 hover:bg-white/5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-3 w-3 shrink-0 text-[#d4a52c]/70" strokeWidth={1.5} />
                      <span className="truncate text-[11px] font-semibold text-white/85">{t.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[8px] text-white/35">
                      {t.tournament_site && (
                        <span className="font-mono uppercase tracking-wider">{t.tournament_site}</span>
                      )}
                      {t.hand_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Layers className="h-2.5 w-2.5" /> {t.hand_count} hands
                        </span>
                      )}
                      {formatDate(t.tournament_date ?? t.created_at) && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" /> {formatDate(t.tournament_date ?? t.created_at)}
                        </span>
                      )}
                      {t.tournament_buy_in && (
                        <span className="text-[#d4a52c]/50">{t.tournament_buy_in}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20 transition group-hover:text-white/40" />
                </div>

                {/* Action buttons on hover */}
                <div className="absolute right-8 top-2 hidden gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => startEdit(t)}
                    className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                    title="Rename"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="rounded p-1 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                    title="Delete"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-5 py-3.5">
              <AlertCircle className="h-4 w-4 text-red-300" />
              <h2 className="text-sm font-semibold text-white">Delete Tournament?</h2>
            </div>
            <div className="p-5">
              <p className="text-[11px] text-white/60">
                This will permanently delete the tournament and all its hands. This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void confirmDelete()}
                  className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-[10px] font-bold uppercase text-red-300 hover:bg-red-500/25"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
