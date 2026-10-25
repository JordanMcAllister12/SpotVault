import { useState } from 'react';
import { X } from 'lucide-react';
import type { SolverConfig } from '@/lib/solver/types';
import { boardLabel } from '@/lib/solver/types';

interface SaveToVaultModalProps {
  config: SolverConfig;
  onClose: () => void;
  onSave: (title: string, notes: string, tags: string[], category: string) => void;
}

export function SaveToVaultModal({ config, onClose, onSave }: SaveToVaultModalProps) {
  const suggestedTitle = `${config.hero_position} vs ${config.villain_position} — ${config.board.length > 0 ? config.board.map((c) => c.rank).join('') : 'Preflop'} — ${config.effective_stack_bb}BB`;
  const suggestedTags = [
    `${config.hero_position} vs ${config.villain_position}`,
    config.format === 'tournament' ? 'MTT' : 'Cash',
    `${config.effective_stack_bb}BB`,
    config.board.length > 0 ? (config.board.length === 3 ? 'Flop' : config.board.length === 4 ? 'Turn' : 'River') : 'Preflop',
  ];

  const [title, setTitle] = useState(suggestedTitle);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState(suggestedTags.join(', '));
  const [category, setCategory] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
    onSave(title.trim(), notes.trim(), tagArray, category.trim());
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-base font-bold text-white">Save to Vault</h2>
        <p className="mb-4 text-[11px] text-white/40">{boardLabel(config.board)} — {config.hero_position} vs {config.villain_position} — {config.effective_stack_bb}BB</p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[9px] font-mono tracking-widest text-white/30 uppercase">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#050608] px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-mono tracking-widest text-white/30 uppercase">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add your notes about this spot..."
              className="w-full rounded-lg border border-white/10 bg-[#050608] px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-mono tracking-widest text-white/30 uppercase">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#050608] px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-mono tracking-widest text-white/30 uppercase">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Preflop, Flop C-Bet, Turn Barreling"
              className="w-full rounded-lg border border-white/10 bg-[#050608] px-3 py-2 text-[12px] text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#d4a52c] to-[#c0911e] py-2.5 text-[12px] font-bold text-[#0a0c0e] transition-all hover:from-[#f5e6b0] hover:to-[#d4a52c] disabled:opacity-50"
          >
            Save to Vault
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/50 hover:text-white/80"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
