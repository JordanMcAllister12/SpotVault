import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Lock, Loader2, AlertCircle,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GOLD, BORDER_GOLD, BG_CARD } from '@/components/ui/industry';
import type { MySpotsItem } from '@/lib/mySpotsStore';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface PackHand {
  hand_id: string;
  hand_order: number;
}

interface HandAnalysis {
  analysis_text: string | null;
  preflop_notes: string | null;
  flop_notes: string | null;
  turn_notes: string | null;
  river_notes: string | null;
}

interface HandRecord {
  id: string;
  hero_name: string | null;
  hero_cards: string | null;
  board: string | null;
  blinds: string | null;
  position: string | null;
  pot_amount: number | null;
  net_result: number | null;
  action_sequence: Record<string, unknown> | null;
  played_at: string | null;
  site: string | null;
  game_mode: string | null;
  raw_hand_text: string | null;
  stack_size: number | null;
  tournament_id: string | null;
  showdown: boolean | null;
  saw_flop: boolean | null;
  saw_turn: boolean | null;
  saw_river: boolean | null;
}

interface Props {
  item: MySpotsItem;
  onBack: () => void;
}

export function HHPackViewer({ item, onBack }: Props) {
  const productId = item.productId ?? item.contentId;
  const [hands, setHands] = useState<PackHand[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [handRecord, setHandRecord] = useState<HandRecord | null>(null);
  const [normalizedHand, setNormalizedHand] = useState<NormalizedHand | null>(null);
  const [analysis, setAnalysis] = useState<HandAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [handLoading, setHandLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (!productId) {
      setError('Missing pack ID');
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      const { data, error: queryError } = await supabase
        .from('jukebox_product_hands')
        .select('hand_id, hand_order')
        .eq('product_id', productId)
        .order('hand_order', { ascending: true });
      if (!mounted) return;
      if (queryError || !data || data.length === 0) {
        setError('No hands found in this pack');
        setLoading(false);
        return;
      }
      setHands(data as PackHand[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [productId]);

  const currentHand = hands[currentIndex];

  useEffect(() => {
    if (!currentHand) return;
    let mounted = true;
    setHandLoading(true);
    (async () => {
      const [handResult, analysisResult] = await Promise.all([
        supabase
          .from('poker_hand_records')
          .select('id, hero_name, hero_cards, board, blinds, position, pot_amount, net_result, action_sequence, played_at, site, game_mode, raw_hand_text, stack_size, tournament_id, showdown, saw_flop, saw_turn, saw_river')
          .eq('id', currentHand.hand_id)
          .maybeSingle(),
        supabase
          .from('jukebox_hand_analysis')
          .select('analysis_text, preflop_notes, flop_notes, turn_notes, river_notes')
          .eq('product_id', productId)
          .eq('hand_id', currentHand.hand_id)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      const record = (handResult.data as HandRecord | null) ?? null;
      setHandRecord(record);
      setAnalysis((analysisResult.data as HandAnalysis | null) ?? null);

      if (record) {
        const phase2Record: Phase2HandRecord = {
          hand_id: record.id,
          site: record.site,
          game_mode: record.game_mode,
          hero_name: record.hero_name,
          hero_cards: record.hero_cards,
          position: record.position,
          board: record.board,
          raw_hand_text: record.raw_hand_text,
          net_result: record.net_result,
          stack_size: record.stack_size,
          blinds: record.blinds,
          pot_amount: record.pot_amount,
          tournament_id: record.tournament_id,
          played_at: record.played_at,
          showdown: record.showdown,
          saw_flop: record.saw_flop,
          saw_turn: record.saw_turn,
          saw_river: record.saw_river,
          action_sequence: [],
        };
        try {
          const normalized = phase2HandToNormalized(phase2Record);
          setNormalizedHand(normalized);
        } catch {
          setNormalizedHand(null);
        }
      } else {
        setNormalizedHand(null);
      }
      setHandLoading(false);
    })();
    return () => { mounted = false; };
  }, [currentHand, productId]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(hands.length - 1, i + 1));
  }, [hands.length]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (error || hands.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-5">
        <BackButton onBack={onBack} />
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-white/30" strokeWidth={1.5} />
          <p className="text-sm text-white/50">{error ?? 'Pack not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-3 sm:px-5 sm:py-5 max-md:h-auto">
      <BackButton onBack={onBack} />

      {/* Pack header */}
      <div className="shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
        <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <BookOpen className="h-4 w-4" style={{ color: GOLD }} />
          <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Hand History Pack</span>
          <span className="ml-auto flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase" style={{ borderColor: BORDER_GOLD, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
            <Lock className="h-2.5 w-2.5" />
            Read Only
          </span>
        </div>
        <div className="px-4 py-2.5">
          <h1 className="text-base font-bold text-white">{item.title}</h1>
          <p className="mt-0.5 text-[11px] text-white/40">by {item.creator} · {hands.length} hands</p>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex shrink-0 items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="text-[11px] font-semibold text-white/70">
          Hand {currentIndex + 1} of {hands.length}
        </span>
        <button
          onClick={goNext}
          disabled={currentIndex === hands.length - 1}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main content: Replayer + Creator Notes */}
      {handLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row max-md:flex-none">
          {/* Left: HH Replayer (same component as Hand Workspace) */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col max-md:flex-none max-md:w-full">
            <div className="mb-2 flex shrink-0 items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Hand Replay</span>
              {handRecord?.position && (
                <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] text-white/50">
                  {handRecord.position}
                </span>
              )}
              {handRecord?.hero_cards && (
                <span className="font-mono text-[10px] text-white/60">{handRecord.hero_cards}</span>
              )}
              {handRecord?.net_result != null && (
                <span className={`text-[10px] font-semibold ${handRecord.net_result >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                  {handRecord.net_result >= 0 ? '+' : ''}{handRecord.net_result}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden max-md:flex-none max-md:w-full">
              {normalizedHand ? (
                <HHReplayer hand={normalizedHand} variant="embedded" visualSize="main" />
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-white/20" strokeWidth={1.5} />
                    <p className="mt-2 text-[11px] text-white/30">Hand replay not available for this hand.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Creator Notes (read-only) */}
          <div className="flex w-full shrink-0 flex-col md:w-[280px]">
            <div className="flex items-center justify-between rounded-t-xl border border-b-0 px-2.5 py-1.5" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3" style={{ color: GOLD }} />
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Creator Notes</span>
              </div>
              <Lock className="h-3 w-3 text-white/20" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-b-xl border border-t-0 p-3" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
              {analysis ? (
                <AnalysisDisplay analysis={analysis} />
              ) : (
                <p className="text-[11px] text-white/30">No creator notes for this hand.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-3 text-[10px] text-white/30">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Pack content is read-only. Creator's original material is immutable.
        </span>
      </div>
    </div>
  );
}

function AnalysisDisplay({ analysis }: { analysis: HandAnalysis }) {
  const sections: { label: string; content: string | null }[] = [
    { label: 'Overview', content: analysis.analysis_text },
    { label: 'Preflop', content: analysis.preflop_notes },
    { label: 'Flop', content: analysis.flop_notes },
    { label: 'Turn', content: analysis.turn_notes },
    { label: 'River', content: analysis.river_notes },
  ];
  const visible = sections.filter((s) => s.content);
  if (visible.length === 0) return <p className="text-[11px] text-white/30">No analysis content.</p>;
  return (
    <div className="space-y-3">
      {visible.map((section) => (
        <div key={section.label}>
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[9px] font-bold tracking-wider text-white/30 uppercase">{section.label}</span>
          </div>
          <p className="text-[12px] leading-relaxed text-white/65">{section.content}</p>
        </div>
      ))}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80"
      style={{ borderColor: BORDER_GOLD, background: BG_CARD }}
    >
      <ArrowLeft className="h-4 w-4" />
      My Spots
    </button>
  );
}
