import { useState, useCallback } from 'react';
import { Plus, Trash2, NotebookPen } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

// Premium ivory paper — warm off-white, not sterile pure white
const PAPER_BG = '#faf6ee';
const PAPER_TEXT = '#2b2724';
const PAPER_MUTED = '#8a8278';
const PAPER_LINE = 'rgba(43, 39, 36, 0.06)';

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export function NotesWidget() {
  const [notes, setNotes] = usePersistentState<Note[]>('player-notes', []);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  const createNote = useCallback(() => {
    const newNote: Note = { id: crypto.randomUUID(), title: 'Untitled', body: '', updatedAt: Date.now() };
    setNotes([newNote, ...notes]);
    setActiveId(newNote.id);
  }, [notes, setNotes]);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  }, [setNotes]);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  }, [setNotes, activeId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Dark header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">Notes</span>
        <button
          onClick={createNote}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: BORDER, color: GOLD }}
        >
          <Plus className="h-3 w-3" strokeWidth={1.5} />
          New
        </button>
      </div>

      {/* Body — dark frame holding the paper */}
      <div className="flex min-h-0 flex-1 p-3" style={{ background: 'rgba(4,3,2,0.5)' }}>
        {notes.length === 0 ? (
          <PaperSheet
            title=""
            body=""
            onTitleChange={() => {}}
            onBodyChange={() => {}}
            empty
          />
        ) : (
          <div className="flex min-h-0 flex-1 gap-3">
            {/* Note list sidebar — stays dark */}
            <div className="w-[110px] shrink-0 overflow-y-auto rounded-md border border-white/[0.06] bg-black/30">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setActiveId(note.id)}
                  className="block w-full truncate border-b border-white/[0.03] px-2.5 py-2 text-left text-[10px] transition-colors"
                  style={{
                    background: activeId === note.id ? 'rgba(192,145,30,0.12)' : 'transparent',
                    color: activeId === note.id ? '#f5e6b0' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {note.title || 'Untitled'}
                </button>
              ))}
            </div>

            {/* Paper sheet */}
            {activeNote ? (
              <PaperSheet
                title={activeNote.title}
                body={activeNote.body}
                onTitleChange={(title) => updateNote(activeNote.id, { title })}
                onBodyChange={(body) => updateNote(activeNote.id, { body })}
                onDelete={() => deleteNote(activeNote.id)}
              />
            ) : (
              <PaperSheet
                title=""
                body=""
                onTitleChange={() => {}}
                onBodyChange={() => {}}
                empty
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PaperSheetProps {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onDelete?: () => void;
  empty?: boolean;
}

function PaperSheet({ title, body, onTitleChange, onBodyChange, onDelete, empty }: PaperSheetProps) {
  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg"
      style={{
        background: PAPER_BG,
        backgroundImage: `repeating-linear-gradient(0deg, ${PAPER_LINE} 0px, ${PAPER_LINE} 1px, transparent 1px, transparent 28px)`,
        boxShadow: '0 4px 24px -6px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.5) inset, 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {/* Paper top bar — title + delete */}
      <div className="flex shrink-0 items-center gap-2 px-5 pt-4 pb-2">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent font-serif text-[13px] font-semibold outline-none"
          style={{ color: PAPER_TEXT }}
        />
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded p-1 transition-colors hover:bg-black/5"
            style={{ color: PAPER_MUTED }}
            title="Delete note"
            aria-label="Delete note"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Writing surface */}
      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder={empty ? "Start writing..." : "Start writing..."}
        className="min-h-0 flex-1 resize-none px-5 pb-5 pt-1 font-serif text-[12px] leading-[28px] outline-none"
        style={{
          color: PAPER_TEXT,
          background: 'transparent',
          lineHeight: '28px',
        }}
      />
    </div>
  );
}
