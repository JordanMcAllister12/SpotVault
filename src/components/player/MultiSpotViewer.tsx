import { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, CheckCircle2,
  Loader2, Image as ImageIcon, Lightbulb, FileText, BookOpen,
  RotateCcw, List, X, ChevronDown, ChevronRight as ChevronR,
  Mic, Video as VideoIcon, MonitorPlay,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchMultiSpotAnalysis,
  type MsaEntry,
} from '@/lib/msaStore';
import type { ContentSpot } from '@/lib/contentLab';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { SpotDiscussion } from '@/components/player/SpotDiscussion';
import { CompactAudioPlayer, CompactVideoPlayer } from './MediaPlayer';
import { GuidedPresentationEditor } from './GuidedPresentationEditor';
import { useDemo } from '@/useDemo';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212,165,44,0.12)';
const DARK_PANEL = 'rgba(10,9,8,0.92)';
const DARKER_PANEL = 'rgba(5,4,3,0.92)';

export function MultiSpotViewer({
  spotId,
  onBack,
}: {
  spotId: string;
  onBack: () => void;
}) {
  const { state: demoState } = useDemo();
  const [spot, setSpot] = useState<ContentSpot | null>(null);
  const [entries, setEntries] = useState<MsaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'cover' | 'analysis' | 'complete'>('cover');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [normalized, setNormalized] = useState<NormalizedHand | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [showHandList, setShowHandList] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const pkg = await fetchMultiSpotAnalysis(spotId);
      if (pkg) {
        setSpot(pkg.spot);
        setEntries(pkg.entries);
      }
      setLoading(false);
    })();
  }, [spotId]);

  useEffect(() => {
    if (phase !== 'analysis' || entries.length === 0) return;
    const entry = entries[currentIdx];
    if (!entry) return;
    void (async () => {
      setLoadingReplay(true);
      setNormalized(null);
      const { data, error } = await supabase
        .from('poker_hand_records')
        .select('*, raw_hand_text')
        .eq('hand_id', entry.hand_id)
        .eq('user_id', entry.hand_user_id)
        .maybeSingle();
      if (!error && data) {
        try {
          const n = phase2HandToNormalized(data as unknown as Phase2HandRecord);
          if (n.actions?.length > 0) setNormalized(n);
        } catch { /* parse error */ }
      }
      setLoadingReplay(false);
    })();
  }, [phase, entries, currentIdx]);

  const goNext = () => {
    if (currentIdx < entries.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setPhase('complete');
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-white/40">Multi-Spot Analysis not found.</p>
        <button onClick={onBack} className="mt-3 text-[11px] text-[#d4a52c] hover:underline">Go back</button>
      </div>
    );
  }

  // ── COVER SCREEN ─────────────────────────────────
  if (phase === 'cover') {
    const coverUrl = spot.image_urls[0] ?? null;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Spots
        </button>

        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          {/* Cover image */}
          <div className="relative aspect-[16/9] w-full" style={{ background: DARKER_PANEL }}>
            {coverUrl ? (
              <img src={coverUrl} alt={spot.title} className="h-full w-full object-cover" />
            ) : (
              <DefaultMsaCover title={spot.title} />
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(5,4,3,0.95))' }} />
          </div>

          {/* Title + details */}
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Multi-Spot Analysis</span>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{spot.title}</h1>
            {spot.subtitle && <p className="mt-2 text-sm leading-relaxed text-white/50">{spot.subtitle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/40">
              <span>by {spot.creator_name}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <span>{entries.length} hands</span>
              {spot.tags.format && (<><span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span><span>{spot.tags.format}</span></>)}
              {spot.tags.stage && (<><span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span><span>{spot.tags.stage}</span></>)}
            </div>

            <button
              onClick={() => { setPhase('analysis'); setCurrentIdx(0); }}
              disabled={entries.length === 0}
              className="mt-6 flex items-center gap-2 rounded-xl border border-[#d4a52c]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-8 py-3 text-[12px] font-bold tracking-wider uppercase text-[#f5e6b0] transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30 disabled:opacity-40"
            >
              <Play className="h-4 w-4" /> Start Analysis
            </button>
            {entries.length === 0 && <p className="mt-2 text-[10px] text-white/30">No hands in this analysis yet.</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETION SCREEN ────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-12 text-center sm:py-20">
        <CheckCircle2 className="mb-4 h-16 w-16" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[9px] font-bold tracking-widest uppercase text-white/40">Analysis Complete</span>
        <h2 className="mt-2 text-2xl font-bold text-white">{spot.title}</h2>
        <p className="mt-2 text-sm text-white/50">{entries.length} / {entries.length} hands reviewed</p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => { setPhase('cover'); setCurrentIdx(0); }}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-6 py-2.5 text-[11px] font-bold tracking-wider uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Review Again
          </button>
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-2.5 text-[11px] font-bold tracking-wider uppercase text-white/50 transition hover:bg-white/10"
          >
            <BookOpen className="h-3.5 w-3.5" /> Back to My Spots
          </button>
        </div>

        {spot.account_id && (
          <div className="mt-8 w-full max-w-2xl text-left">
            <SpotDiscussion
              spotId={spot.id}
              spotCreatorId={spot.account_id}
              currentUser={demoState.currentAccount}
              sessionRestored={demoState.sessionRestored}
            />
          </div>
        )}
      </div>
    );
  }

  // ── ANALYSIS PHASE ───────────────────────────────
  const entry = entries[currentIdx];
  const isLast = currentIdx === entries.length - 1;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6">
      {/* Top bar: MSA title + hand list toggle */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(190, 145, 65, 0.22)', background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button onClick={onBack} className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back</span>
        </button>
        <span className="truncate text-[11px] font-medium text-white/40">{spot.title}</span>
        <button onClick={() => setShowHandList(true)} className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-white/40 hover:text-white/60">
          <List className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Hand List</span>
        </button>
        <button
          onClick={() => setPresentationOpen(true)}
          disabled={!normalized}
          className="flex shrink-0 items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2 py-1 text-[8px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/20 disabled:opacity-50"
          title="Enter Presentation Mode"
        >
          <MonitorPlay className="h-3 w-3" /> Present
        </button>
      </div>

      {/* Replayer */}
      <div className="rounded-xl border p-2 sm:p-3" style={{ borderColor: BORDER, background: DARKER_PANEL }}>
        {loadingReplay ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
            <span className="mt-2 text-[11px] text-white/40">Loading hand...</span>
          </div>
        ) : normalized ? (
          <HHReplayer hand={normalized} variant="embedded" visualSize="main" />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[12px] text-white/40">Unable to replay this hand.</p>
          </div>
        )}
      </div>

      {/* Analysis panel */}
      {entry && (
        <AnalysisPanel entry={entry} />
      )}

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[11px] font-semibold text-white/50 transition hover:bg-white/5 disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="text-[11px] font-medium text-white/50">
          Hand {currentIdx + 1} of {entries.length}
        </span>
        {isLast ? (
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-4 py-2 text-[11px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25"
          >
            Finish Analysis <CheckCircle2 className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[11px] font-semibold text-white/50 transition hover:bg-white/5"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hand list drawer */}
      {showHandList && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowHandList(false)}>
          <div className="w-full max-w-sm rounded-xl border bg-[#0d0f12] p-4 shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Hands in this Analysis</h3>
              <button onClick={() => setShowHandList(false)} className="text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
              {entries.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => { setCurrentIdx(i); setShowHandList(false); }}
                  className="rounded-lg border px-3 py-2 text-left transition"
                  style={{
                    background: i === currentIdx ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${i === currentIdx ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-white/70">{e.hand_title || `Hand ${i + 1}`}</span>
                    <span className="shrink-0 text-[10px] font-bold font-mono" style={{ color: (e.net_result ?? 0) > 0 ? '#4ade80' : (e.net_result ?? 0) < 0 ? '#f87171' : '#6b7280' }}>
                      {e.net_result != null ? (e.net_result > 0 ? '+' : '') + Number(e.net_result).toFixed(1) : '—'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Presentation Mode overlay */}
      {presentationOpen && normalized && (
        <div className="fixed inset-0 z-[400] overflow-auto bg-[#07090b] p-4">
          <GuidedPresentationEditor
            hand={normalized}
            onClose={() => setPresentationOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Analysis Panel (shown below replayer) ────────

function AnalysisPanel({ entry }: { entry: MsaEntry }) {
  const hasAnalysis = entry.creator_analysis.trim().length > 0;
  const hasTakeaway = entry.key_takeaway?.trim().length > 0;
  const hasEvidence = entry.evidence_url;
  const hasAudio = entry.audio_url;
  const hasVideo = entry.video_url;
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  if (!hasAnalysis && !hasTakeaway && !hasEvidence && !hasAudio && !hasVideo) return null;

  return (
    <div className="mt-3 rounded-lg border p-4 sm:p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      {entry.hand_title && (
        <h3 className="mb-3 text-base font-bold text-white">{entry.hand_title}</h3>
      )}

      {hasAnalysis && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Creator Analysis</span>
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/70">{entry.creator_analysis}</p>
        </div>
      )}

      {hasTakeaway && (
        <div className="mb-3 rounded-md border-l-2 pl-3" style={{ borderColor: 'rgba(212,165,44,0.4)' }}>
          <div className="mb-0.5 flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3" style={{ color: GOLD }} />
            <span className="text-[9px] font-bold tracking-wider text-white/40 uppercase">Key Takeaway</span>
          </div>
          <p className="text-[12px] leading-relaxed text-white/60">{entry.key_takeaway}</p>
        </div>
      )}

      {hasAudio && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Audio Commentary</span>
          </div>
          <CompactAudioPlayer url={entry.audio_url!} label={entry.hand_title || 'Audio commentary'} />
        </div>
      )}

      {hasVideo && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <VideoIcon className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Video Commentary</span>
          </div>
          <CompactVideoPlayer url={entry.video_url!} label={entry.hand_title || 'Video commentary'} />
        </div>
      )}

      {hasEvidence && (
        <div>
          <button
            onClick={() => setEvidenceOpen(v => !v)}
            className="flex w-full items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.04]"
          >
            {evidenceOpen
              ? <ChevronDown className="h-3.5 w-3.5" style={{ color: GOLD }} />
              : <ChevronR className="h-3.5 w-3.5" style={{ color: GOLD }} />
            }
            <ImageIcon className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Visual Evidence</span>
          </button>
          {evidenceOpen && (
            <div className="mt-2">
              <img src={entry.evidence_url!} alt="Evidence" className="w-full rounded-lg border border-white/[0.08]" />
              {entry.evidence_caption && <p className="mt-1.5 text-[11px] text-white/40">{entry.evidence_caption}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Default cover (when no custom cover uploaded) ──

function DefaultMsaCover({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0908 0%, #14110c 50%, #0a0908 100%)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.05)' }}>
          <BookOpen className="h-8 w-8" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/30">SpotVault Multi-Spot Analysis</span>
      </div>
    </div>
  );
}
