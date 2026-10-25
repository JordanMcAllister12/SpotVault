import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { supabase } from '@/lib/supabase';
import type { HandShareRef } from '@/lib/handShareStore';

export function SharedHandReplayerModal() {
  const [open, setOpen] = useState(false);
  const [handRef, setHandRef] = useState<HandShareRef | null>(null);
  const [hand, setHand] = useState<NormalizedHand | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HandShareRef>).detail;
      if (!detail?.hand_id || !detail?.hand_user_id) return;
      setHandRef(detail);
      setOpen(true);
    };
    window.addEventListener('sv-play-shared-hand', handler);
    return () => window.removeEventListener('sv-play-shared-hand', handler);
  }, []);

  const fetchCanonicalHand = useCallback(async (ref: HandShareRef) => {
    setLoading(true);
    setError(null);
    setHand(null);

    const { data, error: dbError } = await supabase
      .from('poker_hand_records')
      .select('*, raw_hand_text')
      .eq('hand_id', ref.hand_id)
      .eq('user_id', ref.hand_user_id)
      .maybeSingle();

    setLoading(false);
    if (dbError || !data) {
      setError('This hand is no longer available.');
      return;
    }

    try {
      const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
      if (!normalized.actions || normalized.actions.length === 0) {
        setError('Unable to replay this hand — action data is incomplete.');
        return;
      }
      setHand(normalized);
    } catch {
      setError('Failed to parse hand data.');
    }
  }, []);

  useEffect(() => {
    if (open && handRef) fetchCanonicalHand(handRef);
  }, [open, handRef, fetchCanonicalHand]);

  const handleClose = () => {
    setOpen(false);
    setHand(null);
    setError(null);
    setHandRef(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl border p-4"
        style={{ background: 'rgba(8,7,6,0.96)', border: '1px solid rgba(192,145,30,0.2)', boxShadow: '0 20px 60px -20px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <X size={18} />
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
            <span className="mt-3 text-[12px] text-white/40">Loading hand...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-[14px] font-bold text-white">{error}</span>
            <button onClick={handleClose} className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-[11px] text-white/60 hover:text-white/80">
              Close
            </button>
          </div>
        )}

        {hand && !loading && !error && (
          <div className="overflow-visible">
            <HHReplayer hand={hand} variant="embedded" visualSize="main" />
          </div>
        )}
      </div>
    </div>
  );
}
