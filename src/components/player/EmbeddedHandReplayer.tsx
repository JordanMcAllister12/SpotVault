import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { findManualHand } from '@/lib/manualHandStore';
import { phase2HandToNormalized as adapterNormalize } from '@/features/hh-replayer/adapter';
import type { Phase2HandRecord } from '@/features/hh-replayer/adapter';

const GOLD = '#d4a52c';

interface Props {
  handId: string;
}

export async function loadNormalizedHandById(handId: string): Promise<NormalizedHand | null> {
  try {
    const { data, error: queryError } = await supabase
      .from('poker_hand_records')
      .select('*, raw_hand_text')
      .eq('hand_id', handId)
      .limit(1)
      .maybeSingle();

    if (data) {
      const normalized = adapterNormalize(data as unknown as Phase2HandRecord);
      if (normalized.actions.length === 0) {
        console.error('[loadNormalizedHandById] No actions parsed for hand:', handId);
        return null;
      }
      return normalized;
    }

    const manual = await findManualHand(handId);
    if (manual) return manual.normalized_hand;

    if (queryError) {
      console.error('[loadNormalizedHandById] query error:', queryError);
    } else {
      console.error('[loadNormalizedHandById] Hand not found for id:', handId);
    }
    return null;
  } catch (err) {
    console.error('[loadNormalizedHandById] Unexpected error:', err);
    return null;
  }
}

export function EmbeddedHandReplayer({ handId }: Props) {
  const [hand, setHand] = useState<NormalizedHand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadNormalizedHandById(handId);
      if (!mounted) return;
      if (loaded) {
        setHand(loaded);
        setLoading(false);
        return;
      }
      setError('HAND_NOT_FOUND');
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [handId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-black/20 py-12">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>
    );
  }

  if (error || !hand) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.03] px-4 py-6 text-center">
        <AlertCircle className="h-5 w-5 text-red-400/50" strokeWidth={1.5} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-red-300/70">Hand Replay Unavailable</span>
        <span className="font-mono text-[9px] text-red-300/40">{error ?? 'HAND_REFERENCE_MISSING'}</span>
      </div>
    );
  }

  return (
    <div className="overflow-visible rounded-lg border border-white/[0.06] bg-black/30">
      <div style={{ maxWidth: 640, margin: '0 auto', overflow: 'hidden' }}>
        <HHReplayer hand={hand} variant="embedded" standaloneLayout fitToContainer cardScale={1.0} />
      </div>
    </div>
  );
}


