import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowUp, ArrowDown, X, Loader2, Save, Globe, Package,
  Upload, Trash2, PlayCircle, ChevronDown, ChevronUp, FileText,
  Image as ImageIcon, Plus, BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchMultiSpotAnalysis, fetchMsaEntries, setMsaEntries, updateMsaEntry,
  updateMultiSpotAnalysisDetails, publishMultiSpotAnalysis, unpublishMultiSpotAnalysis,
  uploadMsaCoverImage, uploadMsaEvidenceImage,
  type MsaEntry, type MsaEntryInput,
} from '@/lib/msaStore';
import type { ContentSpot } from '@/lib/contentLab';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import type { NormalizedHand } from '@/features/hh-replayer/types';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212,165,44,0.12)';
const DARK_PANEL = 'rgba(10,9,8,0.92)';
const DARKER_PANEL = 'rgba(5,4,3,0.92)';

export interface MsaHandCandidate {
  hand_id: string;
  hand_user_id: string;
  hero_cards: string | null;
  board: string | null;
  blinds: string | null;
  net_result: number | null;
  pot_amount: number | null;
  position: string | null;
  played_at: string | null;
  tournament_id: string | null;
}

export function MultiSpotBuilder({
  spotId,
  accountId,
  creatorName,
  initialHands,
  onBack,
}: {
  spotId: string;
  accountId: string;
  creatorName: string;
  initialHands?: MsaHandCandidate[];
  onBack: () => void;
}) {
  const [spot, setSpot] = useState<ContentSpot | null>(null);
  const [entries, setEntries] = useState<MsaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [normalized, setNormalized] = useState<NormalizedHand | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [isMonetized, setIsMonetized] = useState(false);
  const [priceCredits, setPriceCredits] = useState(10);
  const [publishing, setPublishing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Load MSA
  useEffect(() => {
    void (async () => {
      setLoading(true);
      const pkg = await fetchMultiSpotAnalysis(spotId);
      if (pkg) {
        setSpot(pkg.spot);
        setTitle(pkg.spot.title);
        setDescription(pkg.spot.subtitle ?? '');
        setCoverUrl(pkg.spot.image_urls[0] ?? null);
        setIsMonetized(pkg.spot.is_monetized);
        setPriceCredits(pkg.spot.price_credits || 10);
        setEntries(pkg.entries);
        if (pkg.entries.length === 0 && initialHands && initialHands.length > 0) {
          const inputs: MsaEntryInput[] = initialHands.map(h => ({
            hand_id: h.hand_id,
            hand_user_id: h.hand_user_id,
            hero_cards: h.hero_cards,
            board: h.board,
            blinds: h.blinds,
            net_result: h.net_result,
            pot_amount: h.pot_amount,
            position: h.position,
            played_at: h.played_at,
            tournament_id: h.tournament_id,
          }));
          const ok = await setMsaEntries(spotId, inputs);
          if (ok) {
            const refreshed = await fetchMsaEntries(spotId);
            setEntries(refreshed);
          }
        }
      }
      setLoading(false);
    })();
  }, [spotId]);

  // Load replay for selected hand
  useEffect(() => {
    if (entries.length === 0) return;
    const entry = entries[selectedIdx];
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
  }, [entries, selectedIdx]);

  const handleSaveDetails = useCallback(async () => {
    setSaving(true);
    await updateMultiSpotAnalysisDetails(spotId, { title, description, coverImageUrl: coverUrl });
    setSaving(false);
  }, [spotId, title, description, coverUrl]);

  const handleCoverUpload = useCallback(async (file: File) => {
    setUploadingCover(true);
    const url = await uploadMsaCoverImage(file);
    if (url) {
      setCoverUrl(url);
      await updateMultiSpotAnalysisDetails(spotId, { coverImageUrl: url });
    }
    setUploadingCover(false);
  }, [spotId]);

  const handleEntryUpdate = useCallback(async (entryId: string, patch: Parameters<typeof updateMsaEntry>[1]) => {
    await updateMsaEntry(entryId, patch);
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...patch } : e));
  }, []);

  const handleReorder = useCallback((idx: number, dir: 'up' | 'down') => {
    setEntries(prev => {
      const next = [...prev];
      const swapWith = dir === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      void setMsaEntries(spotId, next.map((e, i) => ({
        hand_id: e.hand_id, hand_user_id: e.hand_user_id,
        hand_title: e.hand_title, creator_analysis: e.creator_analysis,
        key_takeaway: e.key_takeaway, evidence_url: e.evidence_url,
        evidence_caption: e.evidence_caption, hero_cards: e.hero_cards,
        board: e.board, blinds: e.blinds, net_result: e.net_result,
        pot_amount: e.pot_amount, position: e.position, played_at: e.played_at,
        tournament_id: e.tournament_id, sort_order: i,
      })));
      return next;
    });
  }, [spotId]);

  const handleRemoveEntry = useCallback((idx: number) => {
    setEntries(prev => {
      const next = prev.filter((_, i) => i !== idx);
      void setMsaEntries(spotId, next.map((e, i) => ({
        hand_id: e.hand_id, hand_user_id: e.hand_user_id,
        hand_title: e.hand_title, creator_analysis: e.creator_analysis,
        key_takeaway: e.key_takeaway, evidence_url: e.evidence_url,
        evidence_caption: e.evidence_caption, hero_cards: e.hero_cards,
        board: e.board, blinds: e.blinds, net_result: e.net_result,
        pot_amount: e.pot_amount, position: e.position, played_at: e.played_at,
        tournament_id: e.tournament_id, sort_order: i,
      })));
      if (selectedIdx >= next.length) setSelectedIdx(Math.max(0, next.length - 1));
      return next;
    });
  }, [spotId, selectedIdx]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    const ok = await publishMultiSpotAnalysis(spotId, isMonetized, priceCredits);
    setPublishing(false);
    if (ok) {
      setSpot(prev => prev ? { ...prev, status: 'published', is_monetized: isMonetized, price_credits: isMonetized ? priceCredits : 0 } : prev);
      setPublishOpen(false);
    }
  }, [spotId, isMonetized, priceCredits]);

  const handleUnpublish = useCallback(async () => {
    setPublishing(true);
    const ok = await unpublishMultiSpotAnalysis(spotId);
    setPublishing(false);
    if (ok) {
      setSpot(prev => prev ? { ...prev, status: 'draft', is_monetized: false, price_credits: 0 } : prev);
    }
  }, [spotId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  const isPublished = spot?.status === 'published';

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-5">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Spots
      </button>

      <div className="rounded-xl border" style={{ borderColor: 'rgba(190, 145, 65, 0.22)', background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {/* Header */}
        <div className="border-b px-4 py-4 sm:px-6 sm:py-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Multi-Spot Analysis</span>
                {isPublished && (
                  <span className="flex items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase">
                    <Globe className="h-2.5 w-2.5" strokeWidth={2} /> Published
                  </span>
                )}
              </div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter analysis title..."
                className="mt-1.5 w-full bg-transparent text-xl font-bold text-white outline-none placeholder:text-white/20 sm:text-2xl"
              />
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Short description..."
                className="mt-1 w-full bg-transparent text-sm text-white/50 outline-none placeholder:text-white/20"
              />
              <p className="mt-1 text-[11px] text-white/30">by {creatorName} · {entries.length} hands</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleSaveDetails}
                disabled={saving}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 hover:bg-white/10 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
              </button>
              <button
                onClick={() => setPublishOpen(true)}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase transition"
                style={{ borderColor: isPublished ? 'rgba(248,113,113,0.3)' : 'rgba(212,165,44,0.4)', color: isPublished ? '#f87171' : GOLD, background: isPublished ? 'transparent' : 'rgba(212,165,44,0.1)' }}
              >
                <Globe className="h-3 w-3" /> {isPublished ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>

          {/* Cover image upload */}
          <div className="mt-4">
            {coverUrl ? (
              <div className="relative group">
                <img src={coverUrl} alt="Cover" className="h-32 w-full rounded-lg object-cover sm:h-40" style={{ border: `1px solid ${BORDER}` }} />
                <button
                  onClick={() => { setCoverUrl(null); void updateMultiSpotAnalysisDetails(spotId, { coverImageUrl: null }); }}
                  className="absolute right-2 top-2 rounded-md border border-white/20 bg-black/60 p-1.5 text-white/60 opacity-0 transition group-hover:opacity-100 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer items-center justify-center rounded-lg border border-dashed transition hover:border-[#c0911e]/40 sm:h-40" style={{ borderColor: 'rgba(255,255,255,0.1)', background: DARKER_PANEL }}>
                {uploadingCover ? (
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/30">
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Upload cover image</span>
                  </div>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleCoverUpload(f); }} />
              </label>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-white/15" strokeWidth={1.5} />
            <p className="text-[12px] text-white/40">No hands selected yet.</p>
            <p className="mt-1 text-[10px] text-white/25">Add hands from a batch or workspace to build your analysis.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_260px]">
            {/* Left: Replayer + per-hand analysis */}
            <div className="flex flex-col gap-3">
              {/* Replayer */}
              <div className="rounded-xl border p-2 sm:p-3" style={{ borderColor: BORDER, background: DARKER_PANEL }}>
                {loadingReplay ? (
                  <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                  </div>
                ) : normalized ? (
                  <HHReplayer hand={normalized} variant="embedded" visualSize="main" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <PlayCircle className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
                    <p className="text-[12px] text-white/40">Unable to replay this hand.</p>
                  </div>
                )}
              </div>

              {/* Per-hand analysis editor */}
              {entries[selectedIdx] && (
                <HandAnalysisEditor
                  key={entries[selectedIdx].id}
                  entry={entries[selectedIdx]}
                  onUpdate={(patch) => handleEntryUpdate(entries[selectedIdx].id, patch)}
                />
              )}
            </div>

            {/* Right: Hand list */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Hands ({entries.length})</span>
              <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-1.5" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.6)', maxHeight: '60vh' }}>
                {entries.map((e, i) => (
                  <div
                    key={e.id}
                    className="rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer"
                    onClick={() => setSelectedIdx(i)}
                    style={{
                      background: i === selectedIdx ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${i === selectedIdx ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[9px] font-mono text-white/50">{e.hand_title || e.hand_id}</span>
                      <span className="shrink-0 text-[10px] font-bold font-mono" style={{ color: (e.net_result ?? 0) > 0 ? '#4ade80' : (e.net_result ?? 0) < 0 ? '#f87171' : '#6b7280' }}>
                        {e.net_result != null ? (e.net_result > 0 ? '+' : '') + Number(e.net_result).toFixed(1) : '—'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <button onClick={(ev) => { ev.stopPropagation(); handleReorder(i, 'up'); }} disabled={i === 0} className="text-white/30 hover:text-white/60 disabled:opacity-20">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={(ev) => { ev.stopPropagation(); handleReorder(i, 'down'); }} disabled={i === entries.length - 1} className="text-white/30 hover:text-white/60 disabled:opacity-20">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button onClick={(ev) => { ev.stopPropagation(); handleRemoveEntry(i); }} className="ml-auto text-red-400/40 hover:text-red-400">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Publish modal */}
      {publishOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPublishOpen(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[#0d0f12] p-5 shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Publish Multi-Spot Analysis</h3>
              <button onClick={() => setPublishOpen(false)} className="text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-white/45">Distribution</label>
                <div className="mt-1.5 flex gap-2">
                  <button onClick={() => setIsMonetized(false)} className="flex-1 rounded-lg border px-3 py-2 text-[11px] font-semibold transition" style={{ borderColor: !isMonetized ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)', background: !isMonetized ? 'rgba(212,165,44,0.1)' : 'transparent', color: !isMonetized ? GOLD : '#6b7280' }}>Free</button>
                  <button onClick={() => setIsMonetized(true)} className="flex-1 rounded-lg border px-3 py-2 text-[11px] font-semibold transition" style={{ borderColor: isMonetized ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)', background: isMonetized ? 'rgba(212,165,44,0.1)' : 'transparent', color: isMonetized ? GOLD : '#6b7280' }}>Paid</button>
                </div>
              </div>
              {isMonetized && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-white/45">Price (credits)</label>
                  <input type="number" value={priceCredits} onChange={e => setPriceCredits(Number(e.target.value))} min={1} className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#d4a52c]/40" />
                </div>
              )}
              <button
                onClick={isPublished ? handleUnpublish : handlePublish}
                disabled={publishing || entries.length === 0}
                className="w-full rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/20 px-4 py-2.5 text-[11px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/30"
              >
                {publishing ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : isPublished ? 'Unpublish' : 'Publish Analysis'}
              </button>
              {entries.length === 0 && <p className="text-center text-[10px] text-red-400/60">Add at least one hand before publishing.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-hand analysis editor ──────────────────────────────────

function HandAnalysisEditor({
  entry,
  onUpdate,
}: {
  entry: MsaEntry;
  onUpdate: (patch: Parameters<typeof updateMsaEntry>[1]) => void;
}) {
  const [title, setTitle] = useState(entry.hand_title ?? '');
  const [analysis, setAnalysis] = useState(entry.creator_analysis);
  const [takeaway, setTakeaway] = useState(entry.key_takeaway ?? '');
  const [evidenceUrl, setEvidenceUrl] = useState(entry.evidence_url);
  const [evidenceCaption, setEvidenceCaption] = useState(entry.evidence_caption ?? '');
  const [uploading, setUploading] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    setTitle(entry.hand_title ?? '');
    setAnalysis(entry.creator_analysis);
    setTakeaway(entry.key_takeaway ?? '');
    setEvidenceUrl(entry.evidence_url);
    setEvidenceCaption(entry.evidence_caption ?? '');
  }, [entry.id]);

  const save = (patch: Partial<{ hand_title: string; creator_analysis: string; key_takeaway: string; evidence_url: string | null; evidence_caption: string }>) => {
    onUpdate(patch);
  };

  const handleEvidenceUpload = async (file: File) => {
    setUploading(true);
    const url = await uploadMsaEvidenceImage(file);
    if (url) {
      setEvidenceUrl(url);
      save({ evidence_url: url });
    }
    setUploading(false);
  };

  return (
    <div className="rounded-lg border p-3 sm:p-4" style={{ borderColor: BORDER, background: DARKER_PANEL }}>
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
        <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Hand Analysis</span>
      </div>

      {/* Hand title */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={() => save({ hand_title: title || null })}
        placeholder="Hand title (e.g. BB Defense vs BTN — 22BB)"
        className="mb-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-semibold text-white/80 outline-none placeholder:text-white/20 focus:border-[#d4a52c]/30"
      />

      {/* Creator analysis */}
      <textarea
        value={analysis}
        onChange={e => setAnalysis(e.target.value)}
        onBlur={() => save({ creator_analysis: analysis })}
        placeholder="Write your analysis of this hand..."
        className="h-28 w-full resize-y rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[12px] leading-relaxed text-white/70 outline-none placeholder:text-white/20 focus:border-[#d4a52c]/30"
      />

      {/* Key takeaway */}
      <input
        value={takeaway}
        onChange={e => setTakeaway(e.target.value)}
        onBlur={() => save({ key_takeaway: takeaway || null })}
        placeholder="Key takeaway (optional)..."
        className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/60 outline-none placeholder:text-white/20 focus:border-[#d4a52c]/30"
      />

      {/* Evidence image */}
      <div className="mt-3">
        <button
          onClick={() => setShowEvidence(s => !s)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-white/40 hover:text-white/60"
        >
          {showEvidence ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Evidence / Supporting Image
        </button>
        {showEvidence && (
          <div className="mt-2">
            {evidenceUrl ? (
              <div className="relative group">
                <img src={evidenceUrl} alt="Evidence" className="w-full rounded-lg border border-white/[0.08]" />
                <button
                  onClick={() => { setEvidenceUrl(null); save({ evidence_url: null }); }}
                  className="absolute right-2 top-2 rounded-md border border-white/20 bg-black/60 p-1.5 text-white/60 opacity-0 transition group-hover:opacity-100 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <input
                  value={evidenceCaption}
                  onChange={e => setEvidenceCaption(e.target.value)}
                  onBlur={() => save({ evidence_caption: evidenceCaption || null })}
                  placeholder="Caption (optional)..."
                  className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] text-white/50 outline-none placeholder:text-white/20"
                />
              </div>
            ) : (
              <label className="flex h-20 cursor-pointer items-center justify-center rounded-lg border border-dashed transition hover:border-[#c0911e]/40" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
                ) : (
                  <div className="flex items-center gap-1.5 text-white/30">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-[10px]">Upload evidence image</span>
                  </div>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleEvidenceUpload(f); }} />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
