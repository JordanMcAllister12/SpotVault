import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Book, FileText, FlaskConical, Globe, Share2, Users, X, Send, Plus, Pencil,
  Check, Clock, Loader2, Search, SlidersHorizontal, ChevronDown, CheckSquare,
  Square, Trash2, ExternalLink, ArrowLeft, BookOpen, MoreHorizontal, ImageIcon,
  FileDown, UserCog, DollarSign, Settings2, Trophy, Package, Upload,
} from 'lucide-react';
import { fetchMySpots, publishWithPrice, updatePublishSettings, unpublishSpot, deleteSpot, createNewSpot, updateExistingSpot, type ContentSpot, type ContentTags } from '@/lib/contentLab';
import { listConnections, type Connection } from '@/lib/connectionsEngine';
import { shareWithConnection, shareWithAllConnections, listSpotShareRecipients, revokeSyncShare, type SpotShareRecipient } from '@/lib/syncshareEngine';
import { exportSpotsToPdf } from '@/lib/spotPdfExport';
import { useDemo } from '@/useDemo';
import { supabase } from '@/lib/supabase';
import { fetchHandPackEntries, type HandPackEntry } from '@/lib/handPackStore';
import { MultiSpotBuilder } from '@/components/player/MultiSpotBuilder';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { renderFreeformBlocks } from '@/components/player/FreeformBlockEditor';
import { renderWorkPackStages } from '@/components/player/WorkPackEditor';
import { ChevronLeft, ChevronRight, Play as PlayIcon, PlayCircle } from 'lucide-react';
import { EmbeddedHandReplayer } from '@/components/player/EmbeddedHandReplayer';
import { HandDetailsSection } from '@/components/player/HandDetailsSection';
import { PokerCardGroup } from '@/components/player/MiniPlayingCard';
import { updateMultiSpotCoverImage, fetchMultiSpotBatchBySpotId } from '@/lib/batchStore';
import { SpotDiscussion } from '@/components/player/SpotDiscussion';
import { PokerSiteLogo } from '@/components/shared/PokerSiteLogo';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212,165,44,0.12)';

type TabId = 'all' | 'published' | 'drafts';
type SortId = 'newest' | 'oldest' | 'az' | 'za' | 'updated';
type FilterId = 'all' | 'text' | 'video' | 'hand_pack' | 'multi_spot' | 'published' | 'draft';

const TABS: { id: TabId; label: string }[] = [
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'az', label: 'Alphabetical A-Z' },
  { id: 'za', label: 'Alphabetical Z-A' },
  { id: 'updated', label: 'Recently Updated' },
];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'text', label: 'Text Spots' },
  { id: 'video', label: 'Video Spots' },
  { id: 'hand_pack', label: 'HH / Bundles' },
  { id: 'multi_spot', label: 'Multi-Spots' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

// ── Hand Pack Detail Page with HH Replayer ──────────────────────────
function HandPackDetailPage({
  spot,
  onBack,
  onEdit,
}: {
  spot: ContentSpot;
  onBack: () => void;
  onEdit?: (spot: ContentSpot) => void;
}) {
  const [entries, setEntries] = useState<HandPackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [normalized, setNormalized] = useState<NormalizedHand | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const isPublished = spot.status === 'published';

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const e = await fetchHandPackEntries(spot.id);
      setEntries(e);
      setLoading(false);
    })();
  }, [spot.id]);

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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <button onClick={onBack} className="mb-5 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Spots
      </button>

      <div className="rounded-xl border" style={{ borderColor: 'rgba(212,165,44,0.14)', background: 'rgba(10,9,8,0.92)' }}>
        <div className="border-b px-6 py-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Hand Pack</span>
                {isPublished && (
                  <span className="flex items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase">
                    <Globe className="h-2.5 w-2.5" strokeWidth={2} /> Published
                  </span>
                )}
              </div>
              <h1 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{spot.title}</h1>
              {spot.subtitle && <p className="mt-1 text-sm text-white/50">{spot.subtitle}</p>}
              <p className="mt-1 text-[11px] text-white/30">by {spot.creator_name} · {entries.length} hands</p>
            </div>
            {onEdit && (
              <button onClick={() => onEdit(spot)} className="shrink-0 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 hover:bg-white/10">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-white/15" strokeWidth={1.5} />
            <p className="text-[12px] text-white/40">No hands in this pack yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[1fr_240px]">
            {/* Replayer */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))} disabled={selectedIdx <= 0} className="text-white/40 disabled:opacity-20">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-[11px] font-medium text-white/60">Hand {selectedIdx + 1} of {entries.length}</span>
                <button onClick={() => setSelectedIdx(i => Math.min(entries.length - 1, i + 1))} disabled={selectedIdx >= entries.length - 1} className="text-white/40 disabled:opacity-20">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="rounded-xl border p-2 sm:p-3" style={{ borderColor: 'rgba(192,145,30,0.12)', background: 'rgba(5,4,3,0.92)' }}>
                {loadingReplay ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                  </div>
                ) : normalized ? (
                  <HHReplayer hand={normalized} variant="embedded" visualSize="main" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <PlayIcon className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
                    <p className="text-[12px] text-white/40">Unable to replay this hand.</p>
                  </div>
                )}
              </div>
              {entries[selectedIdx]?.creator_note && (
                <div className="mt-2 rounded-lg border p-3" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(10,9,8,0.8)' }}>
                  <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Creator Note</span>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/70">{entries[selectedIdx].creator_note}</p>
                </div>
              )}
            </div>

            {/* Hand list */}
            <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.6)', maxHeight: '50vh' }}>
              {entries.map((e, i) => (
                <button
                  key={e.hand_id}
                  onClick={() => setSelectedIdx(i)}
                  className="rounded-lg border px-2.5 py-2 text-left transition-all"
                  style={{
                    background: i === selectedIdx ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${i === selectedIdx ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[9px] font-mono text-white/50">{e.hand_id}</span>
                    <span className="shrink-0 text-[10px] font-bold font-mono" style={{ color: (e.net_result ?? 0) > 0 ? '#4ade80' : (e.net_result ?? 0) < 0 ? '#f87171' : '#6b7280' }}>
                      {e.net_result != null ? (e.net_result > 0 ? '+' : '') + Number(e.net_result).toFixed(1) : '—'}
                    </span>
                  </div>
                  {e.hero_cards && <span className="text-[8px] text-white/30">{e.hero_cards}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Multi-Spot Detail Page (HH Batch workflow) ───────────────────────
function MultiSpotDetailPage({
  spot,
  onBack,
  onOpenBatch,
}: {
  spot: ContentSpot;
  onBack: () => void;
  onOpenBatch?: (reviewSetId: string) => void;
}) {
  const isPublished = spot.status === 'published';
  const isDraft = spot.status === 'draft';
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(spot.title || '');
  const [coverUrl, setCoverUrl] = useState(spot.cover_image_url ?? (spot.image_urls?.[0] ?? null));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchInfo, setBatchInfo] = useState<{ handCount: number; description: string | null; tournamentName: string | null; tournamentDate: string | null; tournamentBuyIn: string | null; isTournament: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!spot.review_set_id) return;
    void (async () => {
      const batch = await fetchMultiSpotBatchBySpotId(spot.id);
      if (batch) {
        setBatchInfo({
          handCount: batch.hand_count ?? 0,
          description: batch.description ?? null,
          tournamentName: batch.tournament_name ?? null,
          tournamentDate: batch.tournament_date ?? null,
          tournamentBuyIn: batch.tournament_buy_in ?? null,
          isTournament: batch.is_tournament ?? false,
        });
      }
    })();
  }, [spot.id, spot.review_set_id]);

  const handleUploadCover = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `multi-spot-covers/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, { upsert: false });
      if (uploadError) {
        console.error('Cover upload error:', uploadError);
        return;
      }
      const { data } = supabase.storage.from('user-uploads').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setCoverUrl(data.publicUrl);
        await updateMultiSpotCoverImage(spot.id, data.publicUrl);
      }
    } catch (err) {
      console.error('Failed to upload cover:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateExistingSpot({ id: spot.id, account_id: spot.account_id, title });
      setEditing(false);
    } catch (err) {
      console.error('Failed to save title:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setTitle(spot.title || '');
    setCoverUrl(spot.cover_image_url ?? (spot.image_urls?.[0] ?? null));
    setEditing(false);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
      <button onClick={onBack} className="mb-5 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 transition hover:text-white/70">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Spots
      </button>

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(212,165,44,0.14)', background: 'rgba(10,9,8,0.92)' }}>
        {/* Cover image */}
        {coverImage && !editing && (
          <div className="relative aspect-[3/1] w-full overflow-hidden border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <img src={coverImage} alt={spot.title} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Edit mode cover upload */}
        {editing && (
          <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) void handleUploadCover(e.target.files[0]); e.target.value = ''; }}
            />
            {coverUrl ? (
              <div className="relative aspect-[3/1] w-full overflow-hidden">
                <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-2.5 py-1.5 text-[9px] font-semibold uppercase text-white/80 backdrop-blur-sm transition hover:bg-black/90"
                >
                  <Upload className="h-3 w-3" /> Replace
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 border-b transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-white/20" strokeWidth={1.5} />
                    <span className="text-[10px] text-white/30">Upload cover image</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="border-b px-6 py-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Multi-Spot</span>
                {isPublished ? (
                  <span className="flex items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase">
                    <Globe className="h-2.5 w-2.5" strokeWidth={2} /> Published
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-white/40 uppercase">
                    <FileText className="h-2.5 w-2.5" strokeWidth={2} /> Draft
                  </span>
                )}
              </div>
              {editing ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Batch title"
                  className="mt-1.5 w-full rounded-md border border-[#c0911e]/30 bg-black/40 px-3 py-2 text-lg font-bold text-white outline-none focus:border-[#c0911e]/60 sm:text-xl"
                />
              ) : (
                <h1 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{spot.title || 'Untitled Batch'}</h1>
              )}
              {spot.subtitle && <p className="mt-1 text-sm text-white/50">{spot.subtitle}</p>}
              <p className="mt-1 text-[11px] text-white/30">by {spot.creator_name || 'You'}</p>
              {/* Metadata row: hand count, source, date */}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {batchInfo && batchInfo.handCount > 0 && (
                  <span className="flex items-center gap-1 rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 px-2 py-1 text-[9px] font-bold tracking-wide text-[#f5e6b0] uppercase">
                    <Package className="h-3 w-3" /> {batchInfo.handCount} hands
                  </span>
                )}
                {batchInfo?.isTournament && batchInfo.tournamentName && (
                  <span className="flex items-center gap-1 text-[10px] text-white/40">
                    <Trophy className="h-3 w-3 text-[#d4a52c]/60" /> {batchInfo.tournamentName}
                  </span>
                )}
                {batchInfo?.tournamentDate && (
                  <span className="text-[10px] text-white/30">{new Date(batchInfo.tournamentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
                {batchInfo?.tournamentBuyIn && (
                  <span className="text-[10px] text-white/30">Buy-in: {batchInfo.tournamentBuyIn}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {editing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 transition hover:bg-white/10"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving || uploading}
                    className="flex items-center gap-1 rounded-md border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/25"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 transition hover:bg-white/10"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Batch notes */}
          {batchInfo?.description && (
            <div className="mb-4 rounded-lg border p-4" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(10,9,8,0.8)' }}>
              <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Batch Notes</span>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">{batchInfo.description}</p>
            </div>
          )}

          {/* Prominent Play action */}
          {onOpenBatch && spot.review_set_id && (
            <button
              onClick={() => onOpenBatch(spot.review_set_id!)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-6 py-3.5 text-[12px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25"
            >
              <PlayCircle className="h-5 w-5" /> Play in Workspace
            </button>
          )}
          {!onOpenBatch || !spot.review_set_id ? (
            <p className="text-[13px] leading-relaxed text-white/60">
              This multi-spot contains a curated batch of hand histories. Open it in the Workspace to review all hands, order, and notes.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] text-white/25">
            {isPublished && spot.published_at
              ? `Published ${new Date(spot.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Draft'}
          </span>
          <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30 transition hover:text-white/60">
            <ArrowLeft className="h-3 w-3" /> Back to My Spots
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline Spot Detail Page (no modal/overlay) ──────────────────────
function SpotDetailPage({
  spot,
  onBack,
  onEdit,
  onOpenBatch,
}: {
  spot: ContentSpot;
  onBack: () => void;
  onEdit?: (spot: ContentSpot) => void;
  onOpenBatch?: (reviewSetId: string) => void;
}) {
  const { state: demoState } = useDemo();
  const isHandPack = spot.spot_type === 'hand_pack';
  const isMsa = spot.spot_type === 'multi_spot_analysis';
  const isMultiSpot = spot.spot_type === 'multi_spot';
  if (isMultiSpot) {
    return <MultiSpotDetailPage spot={spot} onBack={onBack} onOpenBatch={onOpenBatch} />;
  }
  if (isHandPack) {
    return <HandPackDetailPage spot={spot} onBack={onBack} onEdit={onEdit} />;
  }
  if (isMsa) {
    return <MultiSpotBuilder spotId={spot.id} accountId={spot.account_id} creatorName={spot.creator_name} onBack={onBack} />;
  }
  const tagList = Object.values(spot.tags).filter((v): v is string => typeof v === 'string' && v.length > 0);
  const isPublished = spot.status === 'published';
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="mb-5 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 transition hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to My Spots
      </button>

      {/* Content surface */}
      <div className="rounded-xl border" style={{ borderColor: 'rgba(212,165,44,0.14)', background: 'rgba(10,9,8,0.92)' }}>
        {/* Header */}
        <div className="border-b px-6 py-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[8px] font-bold tracking-widest text-white/40 uppercase" style={{ color: GOLD }}>
                  {spot.source || 'Solver Tree Spot'}
                </span>
                {isPublished && (
                  <span className="flex items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase">
                    <Globe className="h-2.5 w-2.5" strokeWidth={2} /> Published
                  </span>
                )}
              </div>
              <h1 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{spot.title}</h1>
              {spot.subtitle && <p className="mt-1 text-sm text-white/50">{spot.subtitle}</p>}
              <p className="mt-1 text-[11px] text-white/30">by {spot.creator_name || 'Jordan McAllister'}</p>
            </div>
            {onEdit && (
              <button
                onClick={() => onEdit(spot)}
                className="shrink-0 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 transition hover:bg-white/10"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
          {tagList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagList.map((tag) => (
                <span key={tag} className="rounded border border-[#232a32] bg-[#161b21] px-2 py-0.5 text-[8px] font-medium text-white/40 uppercase">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5 p-6">
          {/* Introduction */}
          {spot.introduction && (
            <div className="border-l-2 pl-4" style={{ borderColor: 'rgba(212,165,44,0.4)' }}>
              <p className="text-[13px] leading-relaxed text-white/70">{spot.introduction}</p>
            </div>
          )}

          {/* Embedded HH Replayer — between intro and hand details */}
          {spot.hand_id && (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Hand Replayer</span>
              </div>
              <EmbeddedHandReplayer handId={spot.hand_id} />
            </div>
          )}

          {/* Hand details — collapsible */}
          {spot.hand_details && (
            <HandDetailsSection handDetails={spot.hand_details} />
          )}

          {/* Visual Details */}
          {spot.visual_details && spot.visual_details.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Visual Details</span>
              </div>
              <div className="space-y-4">
                {spot.visual_details.map((item, i) => (
                  <div key={i}>
                    <img
                      src={item.url}
                      alt={item.caption || `Visual ${i + 1}`}
                      className="w-full cursor-zoom-in rounded-lg border border-white/[0.08]"
                      onClick={() => window.open(item.url, '_blank')}
                    />
                    {item.caption && (
                      <p className="mt-1.5 text-[11px] text-white/40">{item.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {spot.image_urls && spot.image_urls.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {spot.image_urls.map((url, i) => (
                <img key={i} src={url} alt={`Solver output ${i + 1}`} className="w-full rounded-lg border border-white/[0.08]" />
              ))}
            </div>
          )}

          {/* Written analysis */}
          {spot.content_html && (
            <div>
              <div className="mb-3 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Written Analysis</span>
              </div>
              <div
                className="space-y-3 text-[13px] leading-relaxed text-white/70 [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-[11px] [&_h3]:font-bold [&_h3]:tracking-widest [&_h3]:text-white/40 [&_h3]:uppercase"
                dangerouslySetInnerHTML={{ __html: spot.content_html }}
              />
            </div>
          )}

          {/* Content blocks */}
          {spot.content_blocks && spot.content_blocks.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Analysis</span>
              </div>
              {renderFreeformBlocks(spot.content_blocks)}
            </div>
          )}

          {/* Work Pack stages (includes legacy V1 solver images) */}
          {spot.work_pack_stages && spot.work_pack_stages.length > 0 && (
            <div>
              {renderWorkPackStages(spot.work_pack_stages)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] text-white/25">
            {isPublished && spot.published_at
              ? `Published ${new Date(spot.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : isDraft
                ? `Created ${new Date(spot.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : spot.status}
          </span>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30 transition hover:text-white/60"
          >
            <ArrowLeft className="h-3 w-3" /> Back to My Spots
          </button>
        </div>
        {spot.account_id && (
          <SpotDiscussion
            spotId={spot.id}
            spotCreatorId={spot.account_id}
            currentUser={demoState.currentAccount}
            sessionRestored={demoState.sessionRestored}
          />
        )}
      </div>
    </div>
  );
}

// ── Reusable Spot Row (compact horizontal strip) ───────────────────

function TypeIcon({ isHandPack, isVideo, isMsa, isMultiSpot }: { isHandPack: boolean; isVideo: boolean; isMsa?: boolean; isMultiSpot?: boolean }) {
  if (isMultiSpot) return <Package className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />;
  if (isMsa) return <BookOpen className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />;
  if (isHandPack) return <Package className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />;
  if (isVideo) return <FileText className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />;
  return <FlaskConical className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />;
}

function StatusBadge({ isPublished, isSubmitted, onTogglePublish, canToggle }: { isPublished: boolean; isSubmitted: boolean; onTogglePublish?: () => void; canToggle?: boolean }) {
  if (isPublished) return (
    <button
      onClick={canToggle && onTogglePublish ? (e) => { e.stopPropagation(); onTogglePublish(); } : undefined}
      className={canToggle ? 'flex cursor-pointer items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase transition hover:border-emerald-500/40 hover:bg-emerald-500/20' : 'flex items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase'}
      title={canToggle ? 'Click to unpublish' : undefined}
    >
      <Globe className="h-2.5 w-2.5" strokeWidth={2} /> Published
    </button>
  );
  if (isSubmitted) return (
    <button
      onClick={canToggle && onTogglePublish ? (e) => { e.stopPropagation(); onTogglePublish(); } : undefined}
      className={canToggle ? 'flex cursor-pointer items-center gap-0.5 rounded-sm border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-amber-400/80 uppercase transition hover:border-amber-500/40 hover:bg-amber-500/20' : 'flex items-center gap-0.5 rounded-sm border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-amber-400/80 uppercase'}
      title={canToggle ? 'Click to publish' : undefined}
    >
      <Clock className="h-2.5 w-2.5" strokeWidth={2} /> Submitted
    </button>
  );
  return (
    <button
      onClick={canToggle && onTogglePublish ? (e) => { e.stopPropagation(); onTogglePublish(); } : undefined}
      className={canToggle ? 'flex cursor-pointer items-center gap-0.5 rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-white/40 uppercase transition hover:border-[#c0911e]/30 hover:bg-[#c0911e]/10 hover:text-[#f5e6b0]' : 'flex items-center gap-0.5 rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-white/40 uppercase'}
      title={canToggle ? 'Click to publish' : undefined}
    >
      <FileText className="h-2.5 w-2.5" strokeWidth={2} /> Draft
    </button>
  );
}

function StatusConfirmMenu({ isPublished, onConfirm, onClose }: { isPublished: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        className="absolute right-0 top-full z-[201] mt-1 w-44 rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 pb-2">
          <div className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Current Status</div>
          <div className="mt-0.5 text-[11px] font-bold text-white/70">{isPublished ? 'Published' : 'Draft'}</div>
          <p className="mt-0.5 text-[9px] leading-relaxed text-white/40">
            {isPublished
              ? 'This Spot is currently publicly available.'
              : 'This Spot is not yet published.'}
          </p>
        </div>
        <div className="border-t border-white/[0.06] pt-1.5">
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold transition hover:bg-[#151719]"
            style={{ color: isPublished ? '#fbbf24' : '#4ade80' }}
          >
            {isPublished ? (
              <><FileText className="h-3 w-3" /> Unpublish</>
            ) : (
              <><Globe className="h-3 w-3" /> Publish</>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/40 transition hover:bg-[#151719] hover:text-white/60"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function SpotRow({
  spot,
  tab,
  isSelected,
  accountName,
  moreMenuOpen,
  statusMenuOpen,
  exportingPdf,
  rowNumber,
  onView,
  onToggleSelect,
  onEdit,
  onPublish,
  onShare,
  onExportPdf,
  onManageSharing,
  onManagePublishing,
  onUnpublish,
  onDelete,
  onToggleMoreMenu,
  onToggleStatusMenu,
}: {
  spot: ContentSpot;
  tab: TabId;
  isSelected: boolean;
  accountName?: string;
  moreMenuOpen: boolean;
  statusMenuOpen: boolean;
  exportingPdf: boolean;
  rowNumber: number;
  onView: () => void;
  onToggleSelect: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onShare: () => void;
  onExportPdf: () => void;
  onManageSharing: () => void;
  onManagePublishing: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onToggleMoreMenu: () => void;
  onToggleStatusMenu: () => void;
}) {
  const isPublished = spot.status === 'published';
  const isSubmitted = spot.status === 'submitted';
  const isVideo = spot.source === 'Video';
  const isHandPack = spot.spot_type === 'hand_pack';
  const isMsa = spot.spot_type === 'multi_spot_analysis';
  const isMultiSpot = spot.spot_type === 'multi_spot';
  const spotTypeLabel = isMultiSpot ? 'Multi-Spot' : isMsa ? 'Multi-Spot Analysis' : isHandPack ? 'Hand Pack' : isVideo ? 'Video Spot' : (spot.source || 'Text Spot');
  const updatedDate = new Date(spot.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const handLines = (spot.hand_details ?? '').split('\n');
  const cardHeroHand = handLines.find((l) => l.startsWith('Hero Hand:'))?.replace('Hero Hand:', '').trim() ?? null;
  const cardBoard = handLines.find((l) => l.startsWith('Board:'))?.replace('Board:', '').trim() ?? null;
  const cardPositions = handLines.find((l) => l.startsWith('Positions:'))?.replace('Positions:', '').trim() ?? null;
  const hasHandMeta = cardHeroHand || cardBoard;

  return (
    <div
      className={`group flex cursor-pointer items-center gap-3 border-b border-white/[0.04] px-3 py-2.5 transition-all hover:bg-white/[0.03] ${
        isSelected ? 'bg-[#c0911e]/[0.06]' : ''
      }`}
      onClick={onView}
    >
      {/* Row number */}
      <span className="w-5 shrink-0 text-right text-[10px] font-mono font-semibold text-white/20" style={{ tabSize: 1 }}>{rowNumber}</span>

      {/* LEFT: checkbox + type icon + label */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className="shrink-0"
      >
        {isSelected
          ? <CheckSquare className="h-4 w-4" style={{ color: GOLD }} />
          : <Square className="h-4 w-4 text-white/15 transition group-hover:text-white/30" />}
      </button>

      <div className="hidden shrink-0 items-center justify-center overflow-hidden rounded-md sm:flex" style={{ width: 32, height: 32, background: `${GOLD}0e`, border: `1px solid ${GOLD}20` }}>
        {(spot.spot_type === 'structured' || spot.spot_type === 'freeform' || spot.spot_type === 'work_pack' || isHandPack || isMsa || isMultiSpot) ? (
          <PokerSiteLogo site={spot.poker_site} size={28} />
        ) : spot.cover_image_url ? (
          <img src={spot.cover_image_url} alt={spot.title} className="h-full w-full object-cover" />
        ) : (
          <TypeIcon isHandPack={isHandPack} isVideo={isVideo} isMsa={isMsa} isMultiSpot={isMultiSpot} />
        )}
      </div>

      <div className="hidden shrink-0 flex-col items-start gap-0.5 md:flex">
        <span className="text-[7px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>{spotTypeLabel}</span>
      </div>

      {/* CENTER: title + metadata */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className={`truncate text-[13px] font-bold ${isSelected ? 'text-white' : 'text-white'}`}>{spot.title || 'Untitled Draft'}</h3>
          <span className={`hidden text-[9px] sm:inline ${isSelected ? 'text-white/40' : 'text-white/25'}`}>by {spot.creator_name || accountName || 'You'}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={`truncate text-[10px] ${isSelected ? 'text-white/55' : 'text-white/40'}`}>{spot.subtitle || 'No description yet'}</p>
        </div>
        {/* Inline poker metadata */}
        {hasHandMeta && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {cardPositions && <span className="text-[8px] text-white/35">{cardPositions}</span>}
            {cardHeroHand && (
              <span className="flex items-center gap-1">
                <span className="text-[7px] font-bold tracking-widest text-white/25 uppercase">Hero</span>
                <PokerCardGroup cards={cardHeroHand.split(' ').filter(Boolean)} size="small" />
              </span>
            )}
            {cardBoard && (
              <span className="flex items-center gap-1">
                <span className="text-[7px] font-bold tracking-widest text-white/25 uppercase">Board</span>
                <PokerCardGroup cards={cardBoard.split(' ').filter(Boolean)} size="small" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: status + date + actions */}
      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="relative hidden flex-col items-end gap-0.5 sm:flex">
          <StatusBadge isPublished={isPublished} isSubmitted={isSubmitted} canToggle onTogglePublish={onToggleStatusMenu} />
          <span className="text-[8px] text-white/25">{updatedDate}</span>
          {statusMenuOpen && (
            <StatusConfirmMenu
              isPublished={isPublished}
              onConfirm={isPublished ? onUnpublish : onPublish}
              onClose={onToggleStatusMenu}
            />
          )}
        </div>
        {/* Mobile: just status badge */}
        <div className="relative flex sm:hidden">
          <StatusBadge isPublished={isPublished} isSubmitted={isSubmitted} canToggle onTogglePublish={onToggleStatusMenu} />
          {statusMenuOpen && (
            <StatusConfirmMenu
              isPublished={isPublished}
              onConfirm={isPublished ? onUnpublish : onPublish}
              onClose={onToggleStatusMenu}
            />
          )}
        </div>

        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-semibold uppercase text-white/50 transition hover:bg-white/[0.08]"
        >
          <Pencil className="h-3 w-3" />
          <span className="hidden lg:inline">Edit</span>
        </button>
        {!isPublished && (
          <button
            onClick={(e) => { e.stopPropagation(); onPublish(); }}
            className="flex items-center gap-1 rounded border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-1 text-[9px] font-semibold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/20"
          >
            <Globe className="h-3 w-3" />
            <span className="hidden lg:inline">Publish</span>
          </button>
        )}

        {/* More menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMoreMenu(); }}
            className="relative rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-white/35 transition hover:bg-white/[0.08] hover:text-white/60"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-1 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { onShare(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/50 transition hover:bg-[#151719] hover:text-white/70"
              >
                <Share2 className="h-3 w-3" /> Sync Share
              </button>
              <button
                onClick={() => { onExportPdf(); }}
                disabled={exportingPdf}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/50 transition hover:bg-[#151719] hover:text-white/70 disabled:opacity-50"
              >
                <FileDown className="h-3 w-3" /> Export PDF
              </button>
              <button
                onClick={() => { onManageSharing(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/50 transition hover:bg-[#151719] hover:text-white/70"
              >
                <UserCog className="h-3 w-3" /> Manage Sharing
              </button>
              {isPublished ? (
                <>
                  <button
                    onClick={() => { onManagePublishing(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/50 transition hover:bg-[#151719] hover:text-white/70"
                  >
                    <Settings2 className="h-3 w-3" /> Manage Publishing
                  </button>
                  <button
                    onClick={() => { onUnpublish(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-amber-400/70 transition hover:bg-[#151719] hover:text-amber-400"
                  >
                    <FileText className="h-3 w-3" /> Unpublish
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { onPublish(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-[#d4a52c] transition hover:bg-[#151719] hover:text-[#f5e6b0]"
                >
                  <Globe className="h-3 w-3" /> Publish Spot
                </button>
              )}
              <button
                onClick={() => { if (confirm('Delete this spot?')) { onDelete(); } }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-red-400/60 transition hover:bg-[#151719] hover:text-red-400/80"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  onEditSpot?: (spot: ContentSpot) => void;
  userId?: string;
  onOpenTournamentWorkspace?: () => void;
  onOpenBatch?: (reviewSetId: string) => void;
  portalSlug?: string | null;
  hideHeaderAndTabs?: boolean;
  hideChrome?: boolean;
  controlledTab?: TabId;
  controlledSearch?: string;
  controlledSort?: SortId;
  controlledFilter?: FilterId;
}

export function MyLibraryView({ onEditSpot, userId, onOpenTournamentWorkspace, onOpenBatch, portalSlug, hideHeaderAndTabs, hideChrome, controlledTab, controlledSearch, controlledSort, controlledFilter }: Props) {
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortId>('newest');
  const [filter, setFilter] = useState<FilterId>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [mySpots, setMySpots] = useState<ContentSpot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [viewingSpot, setViewingSpot] = useState<ContentSpot | null>(null);
  const [shareModalSpot, setShareModalSpot] = useState<ContentSpot | null>(null);
  const [shareModalSpots, setShareModalSpots] = useState<ContentSpot[] | null>(null);
  const [manageSharingSpot, setManageSharingSpot] = useState<ContentSpot | null>(null);
  const [publishModalSpot, setPublishModalSpot] = useState<ContentSpot | null>(null);
  const [managePublishingSpot, setManagePublishingSpot] = useState<ContentSpot | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { state } = useDemo();
  const account = state.currentAccount;

  const loadSpots = useCallback(async () => {
    const aid = userId ?? account?.id;
    if (!aid) {
      setLoadingSpots(false);
      return;
    }
    setLoadError(null);
    if (mySpots.length === 0) setLoadingSpots(true);
    const spots = await fetchMySpots(aid);
    setMySpots(spots);
    setLoadingSpots(false);
  }, [userId, account?.id, mySpots.length]);

  useEffect(() => { loadSpots(); }, [loadSpots]);

  // Close more-menu on outside click, ESC, or tab change
  useEffect(() => {
    if (!moreMenuId && !statusMenuId) return;
    const handleClick = () => { setMoreMenuId(null); setStatusMenuId(null); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoreMenuId(null); setStatusMenuId(null); } };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [moreMenuId, statusMenuId]);

  // Reset more-menu when tab changes
  useEffect(() => { setMoreMenuId(null); setStatusMenuId(null); }, [tab]);

  const handleExportPdf = useCallback(async (spots: ContentSpot[]) => {
    if (spots.length === 0) return;
    setExportingPdf(true);
    try {
      await exportSpotsToPdf(spots, account?.name);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
    setExportingPdf(false);
  }, [account?.name]);

  const handleBulkSyncShare = useCallback(() => {
    const spots = mySpots.filter((s) => selectedIds.has(s.id));
    if (spots.length > 0) setShareModalSpots(spots);
  }, [mySpots, selectedIds]);

  const handleBulkExportPdf = useCallback(() => {
    const spots = mySpots.filter((s) => selectedIds.has(s.id));
    if (spots.length > 0) void handleExportPdf(spots);
  }, [mySpots, selectedIds, handleExportPdf]);

  const handlePublish = useCallback((spot: ContentSpot) => {
    if (spot.id.startsWith('demo-')) return;
    setPublishError(null);
    setPublishModalSpot(spot);
  }, []);

  const handleConfirmPublish = useCallback(async (isMonetized: boolean, priceCredits: number) => {
    if (!publishModalSpot) return;
    if (isMonetized && (!priceCredits || priceCredits <= 0)) {
      setPublishError('Enter a valid price (1 or more credits).');
      return;
    }
    const updated = await publishWithPrice(publishModalSpot.id, isMonetized, priceCredits);
    if (!updated) {
      setPublishError('Failed to publish. Please try again.');
      return;
    }
    setMySpots((prev) => prev.map((s) => (s.id === publishModalSpot.id ? updated : s)));
    setPublishModalSpot(null);
    setPublishError(null);
  }, [publishModalSpot]);

  const handleManagePublishing = useCallback((spot: ContentSpot) => {
    if (spot.id.startsWith('demo-')) return;
    setManagePublishingSpot(spot);
  }, []);

  const handleUpdatePublishing = useCallback(async (isMonetized: boolean, priceCredits: number) => {
    if (!managePublishingSpot) return false;
    const updated = await updatePublishSettings(managePublishingSpot.id, isMonetized, priceCredits);
    if (!updated) return false;
    setMySpots((prev) => prev.map((s) => (s.id === managePublishingSpot.id ? updated : s)));
    setManagePublishingSpot(updated);
    return true;
  }, [managePublishingSpot]);

  const handleUnpublish = useCallback(async (spot: ContentSpot) => {
    if (spot.id.startsWith('demo-')) return;
    const updated = await unpublishSpot(spot.id);
    if (updated) {
      setMySpots((prev) => prev.map((s) => (s.id === spot.id ? updated : s)));
    }
  }, []);

  const handleDelete = useCallback(async (spot: ContentSpot) => {
    if (spot.id.startsWith('demo-')) {
      setMySpots((prev) => prev.filter((s) => s.id !== spot.id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(spot.id); return n; });
      return;
    }
    const ok = await deleteSpot(spot.id);
    if (ok) {
      setMySpots((prev) => prev.filter((s) => s.id !== spot.id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(spot.id); return n; });
    }
  }, []);

  const handleCreateSpot = useCallback(async () => {
    if (!account) return;
    setCreating(true);
    const spot = await createNewSpot(account.id, account.name, portalSlug);
    setCreating(false);
    if (spot && onEditSpot) {
      onEditSpot(spot);
    } else if (spot) {
      setMySpots((prev) => [spot, ...prev]);
    }
  }, [account, onEditSpot, portalSlug]);

  const handleEdit = useCallback((spot: ContentSpot) => {
    if (onEditSpot) onEditSpot(spot);
  }, [onEditSpot]);

  // ── Filtering / search / sort ────────────────────────────────────

  const effectiveTab = controlledTab ?? tab;
  const effectiveSearch = controlledSearch ?? search;
  const effectiveSort = controlledSort ?? sort;
  const effectiveFilter = controlledFilter ?? filter;

  const filtered = useMemo(() => {
    let result = mySpots;

    // Tab filter
    if (effectiveTab === 'published') result = result.filter((s) => s.status === 'published');
    else if (effectiveTab === 'drafts') result = result.filter((s) => s.status === 'draft' || s.status === 'submitted');

    // Type filter
    if (effectiveFilter === 'text') result = result.filter((s) => s.source !== 'Video' && s.spot_type !== 'hand_pack' && s.spot_type !== 'multi_spot');
    else if (effectiveFilter === 'video') result = result.filter((s) => s.source === 'Video');
    else if (effectiveFilter === 'hand_pack') result = result.filter((s) => s.spot_type === 'hand_pack' || s.spot_type === 'multi_spot');
    else if (effectiveFilter === 'published') result = result.filter((s) => s.status === 'published');
    else if (effectiveFilter === 'draft') result = result.filter((s) => s.status === 'draft' || s.status === 'submitted');

    // Search
    if (effectiveSearch.trim()) {
      const q = effectiveSearch.toLowerCase();
      result = result.filter((s) => {
        const tagStr = Object.values(s.tags).filter((v): v is string => typeof v === 'string').join(' ').toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          (s.subtitle ?? '').toLowerCase().includes(q) ||
          (s.introduction ?? '').toLowerCase().includes(q) ||
          (s.content_html ?? '').toLowerCase().includes(q) ||
          tagStr.includes(q) ||
          s.source.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    const sorted = [...result];
    if (effectiveSort === 'newest') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (effectiveSort === 'oldest') sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (effectiveSort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (effectiveSort === 'za') sorted.sort((a, b) => b.title.localeCompare(a.title));
    else if (effectiveSort === 'updated') sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return sorted;
  }, [mySpots, effectiveTab, effectiveFilter, effectiveSearch, effectiveSort]);

  // ── Selection ────────────────────────────────────────────────────

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const someSelected = filtered.some((s) => selectedIds.has(s.id)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const publishedCount = mySpots.filter((s) => s.status === 'published').length;
  const draftCount = mySpots.filter((s) => s.status === 'draft' || s.status === 'submitted').length;

  if (viewingSpot) {
    return (
      <SpotDetailPage
        spot={viewingSpot}
        onBack={() => setViewingSpot(null)}
        onEdit={onEditSpot}
        onOpenBatch={onOpenBatch}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      {!hideHeaderAndTabs && (
      <div className="mb-0 rounded-t-xl px-3 py-2 sm:px-4" style={{ background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(190, 145, 65, 0.22)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)' }}>
        {/* Row 1: icon + title + count + create/tournaments */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
            <Book className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <span className="text-[12px] font-bold tracking-tight text-white sm:text-[13px]">My Spots</span>
          <span className="rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 px-1.5 py-0.5 text-[8px] font-mono tracking-wider text-[#d4a52c]/80 uppercase sm:px-2 sm:py-1 sm:text-[9px]">
            {mySpots.length} Spots
          </span>
          <button
            onClick={handleCreateSpot}
            disabled={creating}
            className="ml-auto flex items-center gap-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-2 py-1 text-[9px] font-bold tracking-wider uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25 disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-[10px]"
          >
            {creating ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" /> : <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            <span className="hidden sm:inline">Create</span>
          </button>
          {onOpenTournamentWorkspace && (
            <button
              onClick={onOpenTournamentWorkspace}
              className="flex items-center gap-1 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 px-2 py-1 text-[9px] font-bold tracking-wider uppercase text-[#d4a52c] transition-all hover:bg-[#c0911e]/15 sm:px-3 sm:py-1.5 sm:text-[10px]"
            >
              <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Tournaments</span>
            </button>
          )}
        </div>
        {/* Row 2: tabs — always on their own row to prevent overflow */}
        {!hideHeaderAndTabs && (
        <div className="mt-1.5 flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const count = t.id === 'all' ? mySpots.length : t.id === 'published' ? publishedCount : draftCount;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[8px] font-semibold tracking-widest uppercase transition-all sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[9px] ${
                  effectiveTab === t.id
                    ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                    : 'border-[#232a32] bg-[#161b21] text-[#84929f] hover:border-[#38424e]'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1 text-[7px] sm:px-1.5 sm:text-[8px] ${effectiveTab === t.id ? 'bg-[#c0911e]/20' : 'bg-white/5'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        )}
      </div>
      )}

      {!hideChrome && (
      <>
      {/* Search + Filter + Sort row — single row on all screens */}
      {mySpots.length > 0 && (
        <div className="mb-0 flex items-center gap-1.5 rounded-none border-x px-3 py-2 sm:gap-2 sm:px-4" style={{ borderColor: 'rgba(190,145,65,0.22)', background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30 sm:left-3 sm:h-3.5 sm:w-3.5" strokeWidth={1.5} />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-white/[0.06] bg-black/30 py-1.5 pl-8 pr-2 text-[10px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/30 sm:py-2 sm:pl-9 sm:pr-3 sm:text-[11px]"
            />
          </div>

          {/* Filter dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setFilterMenuOpen(!filterMenuOpen); setSortMenuOpen(false); }}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-semibold tracking-wide uppercase transition-all sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[10px] ${
                effectiveFilter !== 'all'
                  ? 'border-[#c0911e]/30 bg-[#c0911e]/10 text-[#f5e6b0]'
                  : 'border-white/[0.06] bg-black/20 text-white/50 hover:text-white/70'
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" strokeWidth={1.5} />
              <span className="hidden sm:inline">{FILTERS.find((f) => f.id === effectiveFilter)?.label ?? 'Filter'}</span>
              <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </button>
            {filterMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-1 shadow-2xl">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setFilter(f.id); setFilterMenuOpen(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-medium transition-colors hover:bg-[#151719] ${
                      effectiveFilter === f.id ? 'text-[#d4a52c]' : 'text-white/60'
                    }`}
                  >
                    {f.label}
                    {effectiveFilter === f.id && <Check className="h-3 w-3" strokeWidth={2} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setSortMenuOpen(!sortMenuOpen); setFilterMenuOpen(false); }}
              className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/50 transition-all hover:text-white/70 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[10px]"
            >
              <span className="hidden sm:inline">{SORTS.find((s) => s.id === effectiveSort)?.label ?? 'Newest'}</span>
              <span className="sm:hidden">Sort</span>
              <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-1 shadow-2xl">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSort(s.id); setSortMenuOpen(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-medium transition-colors hover:bg-[#151719] ${
                      effectiveSort === s.id ? 'text-[#d4a52c]' : 'text-white/60'
                    }`}
                  >
                    {s.label}
                    {effectiveSort === s.id && <Check className="h-3 w-3" strokeWidth={2} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection bar */}
      {mySpots.length > 0 && !loadingSpots && (
        <div className="flex items-center gap-3 rounded-b-xl border-x border-b px-3 py-2 sm:px-4" style={{ borderColor: 'rgba(190,145,65,0.22)', background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wide uppercase text-white/40 transition hover:text-white/60">
            {allSelected ? <CheckSquare className="h-3.5 w-3.5" style={{ color: GOLD }} /> : someSelected ? <CheckSquare className="h-3.5 w-3.5 text-white/40" /> : <Square className="h-3.5 w-3.5" />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          {selectedIds.size > 0 && <span className="text-[9px] text-[#d4a52c]/60">{selectedIds.size} selected</span>}
        </div>
      )}
      </>
      )}

      {/* Content area */}
      <div className="mt-1.5 space-y-1.5 sm:space-y-2">
        {/* Loading */}
        {loadingSpots && (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          </div>
        )}

        {/* Error */}
        {loadError && !loadingSpots && (
          <div className="flex flex-col items-center justify-center py-6 text-center sm:py-8">
            <p className="text-sm text-red-400/70">{loadError}</p>
            <button onClick={() => loadSpots()} className="mt-3 text-[10px] text-[#d4a52c] hover:underline">Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loadingSpots && mySpots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center sm:py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
              <Book className="h-7 w-7 text-white/20" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-white/50">Your private created content lives here.</p>
            <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-white/30">
              Create Spots, keep them private, SyncShare them with Connections, or publish them to Spot Library.
            </p>
            <button
              onClick={handleCreateSpot}
              disabled={creating}
              className="mt-5 flex items-center gap-2 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-5 py-2.5 text-[11px] font-bold tracking-wider uppercase text-[#f5e6b0] transition-all hover:bg-[#c0911e]/25 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Spot
            </button>
          </div>
        )}

        {/* Spot rows — unified glass container with internal scrolling */}
        {filtered.length > 0 && !loadingSpots && (
          <div
            className="sv-glass-scroll overflow-y-auto overscroll-contain rounded-xl border"
            style={{
              borderColor: 'rgba(190, 145, 65, 0.18)',
              background: 'rgba(8, 7, 6, 0.55)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 32px -12px rgba(0,0,0,0.6)',
              maxHeight: 'clamp(400px, 70vh, 760px)',
              scrollbarColor: 'rgba(212,165,44,0.3) transparent',
              scrollbarWidth: 'thin',
            }}
          >
            {filtered.map((spot, idx) => (
              <SpotRow
                key={spot.id}
                spot={spot}
                tab={effectiveTab}
                isSelected={selectedIds.has(spot.id)}
                accountName={account?.name}
                moreMenuOpen={moreMenuId === spot.id}
                statusMenuOpen={statusMenuId === spot.id}
                exportingPdf={exportingPdf}
                rowNumber={idx + 1}
                onView={() => setViewingSpot(spot)}
                onToggleSelect={() => toggleSelect(spot.id)}
                onEdit={() => handleEdit(spot)}
                onPublish={() => handlePublish(spot)}
                onShare={() => setShareModalSpot(spot)}
                onExportPdf={() => void handleExportPdf([spot])}
                onManageSharing={() => setManageSharingSpot(spot)}
                onManagePublishing={() => setManagePublishingSpot(spot)}
                onUnpublish={() => void handleUnpublish(spot)}
                onDelete={() => handleDelete(spot)}
                onToggleMoreMenu={() => { setMoreMenuId(moreMenuId === spot.id ? null : spot.id); setStatusMenuId(null); }}
                onToggleStatusMenu={() => setStatusMenuId(statusMenuId === spot.id ? null : spot.id)}
              />
            ))}
          </div>
        )}

        {/* No results after filtering */}
        {filtered.length === 0 && mySpots.length > 0 && !loadingSpots && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="mt-2 text-[11px] text-white/40">No spots match your search.</p>
            <button
              onClick={() => { setSearch(''); setFilter('all'); setTab('all'); }}
              className="mt-2 text-[10px] text-[#d4a52c] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Publish Spot Modal */}
      {publishModalSpot && (
        <PublishSpotModal
          spot={publishModalSpot}
          error={publishError}
          onConfirm={handleConfirmPublish}
          onCancel={() => { setPublishModalSpot(null); setPublishError(null); }}
        />
      )}
      {/* Manage Publishing Modal */}
      {managePublishingSpot && (
        <ManagePublishingModal
          spot={managePublishingSpot}
          onUpdate={handleUpdatePublishing}
          onUnpublish={async (spot) => { await handleUnpublish(spot); setManagePublishingSpot(null); }}
          onClose={() => setManagePublishingSpot(null)}
        />
      )}
      {/* SyncShare Modal — single spot */}
      {shareModalSpot && (
        <SyncShareModal spots={[shareModalSpot]} onClose={() => setShareModalSpot(null)} />
      )}
      {/* SyncShare Modal — multi spot */}
      {shareModalSpots && (
        <SyncShareModal spots={shareModalSpots} onClose={() => setShareModalSpots(null)} />
      )}
      {/* Manage Sharing Modal */}
      {manageSharingSpot && (
        <ManageSharingModal spot={manageSharingSpot} onClose={() => setManageSharingSpot(null)} />
      )}
    </div>
  );
}

// ── SyncShare Modal ─────────────────────────────────────────────────

function SyncShareModal({ spots, onClose }: { spots: ContentSpot[]; onClose: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnIds, setSelectedConnIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isMulti = spots.length > 1;

  useEffect(() => {
    listConnections().then((conns) => {
      setConnections(conns);
      setLoading(false);
    });
  }, []);

  const toggleConnection = (id: string) => {
    setSelectedConnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShare = async () => {
    setSharing(true);
    setMsg(null);
    if (selectedConnIds.size === 0) {
      setMsg('Select at least one connection to share with.');
      setSharing(false);
      return;
    }
    let success = 0;
    for (const recipientId of selectedConnIds) {
      for (const spot of spots) {
        const ok = await shareWithConnection('content_spot', spot.id, recipientId);
        if (ok) success++;
      }
    }
    setSharing(false);
    setMsg(`SyncShared ${spots.length} spot${spots.length !== 1 ? 's' : ''} with ${selectedConnIds.size} connection${selectedConnIds.size !== 1 ? 's' : ''}!`);
    setTimeout(() => onClose(), 2000);
  };

  const handleShareAll = async () => {
    setSharing(true);
    setMsg(null);
    let totalSuccess = 0;
    for (const spot of spots) {
      const count = await shareWithAllConnections('content_spot', spot.id);
      totalSuccess += count;
    }
    setSharing(false);
    setMsg(totalSuccess > 0 ? `SyncShared with all connections (${totalSuccess} shares)!` : 'No connections to share with.');
    if (totalSuccess > 0) setTimeout(() => onClose(), 2000);
  };

  const headerLabel = isMulti ? `${spots.length} Spots` : `"${spots[0]?.title ?? ''}"`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-white">Sync Share {headerLabel}</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sharing summary */}
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
          <div className="text-[10px] text-white/40">
            <span className="font-semibold text-white/60">Sharing:</span> {isMulti ? `${spots.length} Spots` : spots[0]?.title ?? ''}
          </div>
          {selectedConnIds.size > 0 && (
            <div className="mt-1 text-[10px] text-white/40">
              <span className="font-semibold text-white/60">With:</span> {selectedConnIds.size} connection{selectedConnIds.size !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : connections.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-white/20" strokeWidth={1.5} />
            <p className="text-[11px] text-white/40">You have no Connections yet.</p>
            <p className="mt-1 text-[10px] text-white/25">Connections are required to SyncShare content privately.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
              {connections.map((conn) => (
                <button
                  key={conn.user_id}
                  onClick={() => toggleConnection(conn.user_id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 transition-all ${
                    selectedConnIds.has(conn.user_id)
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                      : 'border-white/[0.06] bg-black/20 hover:border-white/10'
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#c0911e]/20 bg-[#c0911e]/5 text-[10px] font-bold text-[#d4a52c]">
                    {conn.display_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[11px] font-semibold text-white/80">{conn.display_name}</p>
                    <p className="truncate text-[9px] text-white/30">@{conn.username ?? 'user'}</p>
                  </div>
                  {selectedConnIds.has(conn.user_id) && <Check className="h-4 w-4 text-[#d4a52c]" strokeWidth={2} />}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/25 disabled:opacity-50"
              >
                <Send className="h-3 w-3" /> {sharing ? 'Sharing...' : `Share${selectedConnIds.size > 0 ? ` (${selectedConnIds.size})` : ''}`}
              </button>
              <button
                onClick={handleShareAll}
                disabled={sharing}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 hover:bg-white/10 disabled:opacity-50"
              >
                <Users className="h-3 w-3" /> All
              </button>
            </div>
          </>
        )}

        {msg && (
          <div className="mt-3 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/10 px-3 py-2 text-[11px] font-medium text-[#d4a52c]">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manage Sharing Modal ────────────────────────────────────────────

function ManageSharingModal({ spot, onClose }: { spot: ContentSpot; onClose: () => void }) {
  const [recipients, setRecipients] = useState<SpotShareRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    listSpotShareRecipients(spot.id).then((recs) => {
      setRecipients(recs);
      setLoading(false);
    });
  }, [spot.id]);

  const handleRevoke = async (syncshareId: string) => {
    setRevoking(syncshareId);
    const ok = await revokeSyncShare(syncshareId);
    if (ok) {
      setRecipients((prev) => prev.filter((r) => r.syncshare_id !== syncshareId));
    }
    setRevoking(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-white">Manage Sharing</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 text-[10px] text-white/40">
          <span className="font-semibold text-white/60">Spot:</span> {spot.title || 'Untitled'}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : recipients.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-white/20" strokeWidth={1.5} />
            <p className="text-[11px] text-white/40">This spot has not been shared with anyone yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Shared with</div>
            {recipients.map((rec) => (
              <div key={rec.syncshare_id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#c0911e]/20 bg-[#c0911e]/5 text-[10px] font-bold text-[#d4a52c]">
                  {rec.recipient_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-white/80">{rec.recipient_name}</p>
                  <p className="text-[9px] text-white/30">{rec.status === 'active' ? 'View access' : rec.status}</p>
                </div>
                {rec.status === 'active' && (
                  <button
                    onClick={() => handleRevoke(rec.syncshare_id)}
                    disabled={revoking === rec.syncshare_id}
                    className="rounded border border-red-500/20 px-2 py-1 text-[9px] font-semibold text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    {revoking === rec.syncshare_id ? 'Revoking...' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-white/50 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Publish Spot Modal ──────────────────────────────────────────────

function PublishSpotModal({ spot, error, onConfirm, onCancel }: {
  spot: ContentSpot;
  error: string | null;
  onConfirm: (isMonetized: boolean, priceCredits: number) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'free' | 'paid'>('free');
  const [price, setPrice] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-white">Publish Your Spot</h3>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 text-[10px] text-white/40">
          <span className="font-semibold text-white/60">Spot:</span> {spot.title || 'Untitled'}
        </div>

        <div className="mb-4 text-[9px] font-bold tracking-widest text-white/30 uppercase">Visibility / Pricing</div>

        <div className="space-y-2">
          <button
            onClick={() => setMode('free')}
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
              mode === 'free'
                ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                : 'border-white/[0.06] bg-black/20 hover:border-white/10'
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${mode === 'free' ? 'border-[#d4a52c] bg-[#d4a52c]' : 'border-white/20'}`}>
              {mode === 'free' && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/80">Publish for Free</p>
              <p className="text-[10px] text-white/40">Anyone can access this Spot for $0.</p>
            </div>
          </button>

          <button
            onClick={() => setMode('paid')}
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
              mode === 'paid'
                ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                : 'border-white/[0.06] bg-black/20 hover:border-white/10'
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${mode === 'paid' ? 'border-[#d4a52c] bg-[#d4a52c]' : 'border-white/20'}`}>
              {mode === 'paid' && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-white/80">Sell This Spot</p>
              <p className="text-[10px] text-white/40">Set a purchase price in credits.</p>
              {mode === 'paid' && (
                <div className="mt-2 flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                  <input
                    type="number"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Enter price"
                    autoFocus
                    className="w-32 rounded-lg border border-[#c0911e]/30 bg-black/40 px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#c0911e]/50"
                  />
                  <span className="text-[10px] text-white/40">credits</span>
                </div>
              )}
            </div>
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mode === 'paid', mode === 'paid' ? parseInt(price, 10) || 0 : 0)}
            className="flex-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#c0911e]/25"
          >
            Publish Spot
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage Publishing Modal ─────────────────────────────────────────

function ManagePublishingModal({ spot, onUpdate, onUnpublish, onClose }: {
  spot: ContentSpot;
  onUpdate: (isMonetized: boolean, priceCredits: number) => Promise<boolean>;
  onUnpublish: (spot: ContentSpot) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'free' | 'paid'>(spot.is_monetized && spot.price_credits > 0 ? 'paid' : 'free');
  const [price, setPrice] = useState<string>(spot.price_credits > 0 ? String(spot.price_credits) : '');
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    if (mode === 'paid' && (!price || parseInt(price, 10) <= 0)) {
      setMsg('Enter a valid price (1 or more credits).');
      setSaving(false);
      return;
    }
    const ok = await onUpdate(mode === 'paid', mode === 'paid' ? parseInt(price, 10) || 0 : 0);
    setSaving(false);
    if (ok) {
      setMsg('Publishing settings updated.');
    } else {
      setMsg('Failed to update. Please try again.');
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    await onUnpublish(spot);
    setUnpublishing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-white">Manage Publishing</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 text-[10px] text-white/40">
          <span className="font-semibold text-white/60">Spot:</span> {spot.title || 'Untitled'}
        </div>

        <div className="mb-3 flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400/80 uppercase">
            <Globe className="h-2.5 w-2.5" strokeWidth={2} /> Published
          </span>
          {spot.is_monetized && spot.price_credits > 0 ? (
            <span className="text-[9px] text-[#d4a52c]">{spot.price_credits} credits</span>
          ) : (
            <span className="text-[9px] text-emerald-400/60">Free</span>
          )}
        </div>

        <div className="mb-3 text-[9px] font-bold tracking-widest text-white/30 uppercase">Change Visibility / Pricing</div>

        <div className="space-y-2">
          <button
            onClick={() => setMode('free')}
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
              mode === 'free'
                ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                : 'border-white/[0.06] bg-black/20 hover:border-white/10'
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${mode === 'free' ? 'border-[#d4a52c] bg-[#d4a52c]' : 'border-white/20'}`}>
              {mode === 'free' && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/80">Free</p>
              <p className="text-[10px] text-white/40">Anyone can access for $0.</p>
            </div>
          </button>

          <button
            onClick={() => setMode('paid')}
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
              mode === 'paid'
                ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                : 'border-white/[0.06] bg-black/20 hover:border-white/10'
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${mode === 'paid' ? 'border-[#d4a52c] bg-[#d4a52c]' : 'border-white/20'}`}>
              {mode === 'paid' && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-white/80">Paid</p>
              <p className="text-[10px] text-white/40">Set a purchase price in credits.</p>
              {mode === 'paid' && (
                <div className="mt-2 flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                  <input
                    type="number"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Enter price"
                    className="w-32 rounded-lg border border-[#c0911e]/30 bg-black/40 px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#c0911e]/50"
                  />
                  <span className="text-[10px] text-white/40">credits</span>
                </div>
              )}
            </div>
          </button>
        </div>

        {msg && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] font-medium ${msg.includes('Failed') ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-[#c0911e]/20 bg-[#c0911e]/10 text-[#d4a52c]'}`}>
            {msg}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleUnpublish}
            disabled={unpublishing}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            {unpublishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Unpublish
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#c0911e]/25 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
