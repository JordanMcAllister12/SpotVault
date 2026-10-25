import { Bookmark, Trash2 } from 'lucide-react';
import type { SolverLibraryEntry } from '@/lib/solver/types';

interface SolverLibraryProps {
  entries: SolverLibraryEntry[];
}

export function SolverLibrary({ entries }: SolverLibraryProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-bold text-white">Saved Solves</h1>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-[13px] text-white/30">No saved solves yet. Complete a solve and click "Save to Vault".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-white">{entry.title}</h3>
                  {entry.notes && <p className="mt-1 text-[11px] text-white/40">{entry.notes}</p>}
                  {entry.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.tags.map((tag, i) => (
                        <span key={i} className="rounded-full border border-[#c0911e]/15 bg-[#c0911e]/5 px-2 py-0.5 text-[9px] text-[#c0911e]/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {entry.category && (
                  <span className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-mono tracking-widest text-white/30 uppercase">
                    {entry.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
