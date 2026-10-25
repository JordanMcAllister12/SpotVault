import { useState, useEffect, useRef } from 'react';
import { Plus, Check, Loader2, FolderPlus, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchBatches, createBatch, addSingleHandToBatch,
  type HandBatch,
} from '@/lib/batchStore';

const GOLD = '#d4a52c';

interface AddToBatchButtonProps {
  handId: string;
  handFingerprint?: string | null;
  rawHandText?: string;
  position?: string | null;
  heroCards?: string | null;
  board?: string | null;
  netResult?: number | null;
  site?: string | null;
  gameMode?: string | null;
  variant?: 'compact' | 'inline';
  activeBatch?: HandBatch | null;
  onBatchChanged?: () => void;
}

export function AddToBatchButton({
  handId, handFingerprint, rawHandText, position, heroCards, board, netResult,
  site, gameMode, variant = 'compact', activeBatch, onBatchChanged,
}: AddToBatchButtonProps) {
  const [batches, setBatches] = useState<HandBatch[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      userIdRef.current = data.user?.id ?? null;
      if (data.user) {
        const bs = await fetchBatches(data.user.id);
        setBatches(bs);
      }
    })();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const addToBatch = async (batch: HandBatch) => {
    setAdding(true);
    const result = await addSingleHandToBatch(batch.id, {
      hand_id: handId,
      hand_fingerprint: handFingerprint ?? handId,
      raw_hand_text: rawHandText,
      position,
      hero_cards: heroCards,
      board,
      net_result: netResult,
      site,
      game_mode: gameMode,
    });
    setAdding(false);
    setShowDropdown(false);

    if (result.ok) {
      showToast(`Added to ${batch.title}`);
      onBatchChanged?.();
    } else if (result.error === 'duplicate') {
      showToast(`Already in ${batch.title}`);
    } else {
      showToast('Failed to add');
    }
  };

  const handleCreateAndAdd = async () => {
    if (!userIdRef.current || !newBatchName.trim()) return;
    setAdding(true);
    const batch = await createBatch(userIdRef.current, newBatchName.trim(), 'custom', null, 'personal');
    if (batch) {
      setBatches((prev) => [batch, ...prev]);
      await addToBatch(batch);
    } else {
      showToast('Failed to create batch');
    }
    setAdding(false);
    setShowCreate(false);
    setNewBatchName('');
  };

  if (toast) {
    return (
      <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300 whitespace-nowrap">
        <Check className="h-3 w-3" /> {toast}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="relative inline-flex">
        <button
          onClick={() => {
            if (activeBatch) {
              void addToBatch(activeBatch);
            } else {
              setShowDropdown((v) => !v);
            }
          }}
          disabled={adding}
          className="flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2 py-1 text-[9px] font-semibold text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/20 disabled:opacity-40 whitespace-nowrap"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          {activeBatch ? `Add to ${activeBatch.title.slice(0, 12)}` : '+ Batch'}
        </button>
        {showDropdown && !activeBatch && (
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => { setShowDropdown(false); setShowCreate(false); }} />
            <div className="absolute left-0 top-full z-[201] mt-1 w-56 rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
              <div className="max-h-48 overflow-y-auto p-1.5">
                {batches.length === 0 && (
                  <div className="px-2 py-2 text-center text-[10px] text-white/30">No batches yet</div>
                )}
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => void addToBatch(b)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 transition hover:bg-white/5"
                  >
                    <span className="truncate">{b.title}</span>
                    <span className="ml-2 shrink-0 text-white/30">{b.hand_count}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-white/[0.06] p-1.5">
                {showCreate ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={newBatchName}
                      onChange={(e) => setNewBatchName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateAndAdd(); if (e.key === 'Escape') setShowCreate(false); }}
                      autoFocus
                      placeholder="Batch name..."
                      className="flex-1 rounded-md border border-[#d4a52c]/40 bg-black/40 px-2 py-1.5 text-[10px] text-white/80 focus:outline-none"
                    />
                    <button onClick={() => void handleCreateAndAdd()} className="rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 p-1.5 text-[#f5e6b0]">
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-semibold text-[#d4a52c] hover:bg-[#c0911e]/10"
                  >
                    <FolderPlus className="h-3 w-3" /> New Batch
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // compact variant — small icon button
  return (
    <div className="relative inline-flex">
      <button
        onClick={() => {
          if (activeBatch) {
            void addToBatch(activeBatch);
          } else {
            setShowDropdown((v) => !v);
          }
        }}
        disabled={adding}
        className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[8px] font-semibold text-white/50 uppercase transition hover:bg-white/10 hover:text-white/70 disabled:opacity-30"
        title="Add to batch"
      >
        {adding ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
        {variant === 'compact' ? '' : 'Batch'}
      </button>
      {showDropdown && !activeBatch && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => { setShowDropdown(false); setShowCreate(false); }} />
          <div className="absolute right-0 top-full z-[201] mt-1 w-56 rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="max-h-48 overflow-y-auto p-1.5">
              {batches.length === 0 && (
                <div className="px-2 py-2 text-center text-[10px] text-white/30">No batches yet</div>
              )}
              {batches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => void addToBatch(b)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 transition hover:bg-white/5"
                >
                  <span className="truncate">{b.title}</span>
                  <span className="ml-2 shrink-0 text-white/30">{b.hand_count}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-white/[0.06] p-1.5">
              {showCreate ? (
                <div className="flex items-center gap-1">
                  <input
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateAndAdd(); if (e.key === 'Escape') setShowCreate(false); }}
                    autoFocus
                    placeholder="Batch name..."
                    className="flex-1 rounded-md border border-[#d4a52c]/40 bg-black/40 px-2 py-1.5 text-[10px] text-white/80 focus:outline-none"
                  />
                  <button onClick={() => void handleCreateAndAdd()} className="rounded-md border border-[#d4a52c]/40 bg-[#c0911e]/15 p-1.5 text-[#f5e6b0]">
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-semibold text-[#d4a52c] hover:bg-[#c0911e]/10"
                >
                  <FolderPlus className="h-3 w-3" /> New Batch
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
