import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Target, BookOpen, Youtube, FileText, Clock, Tag, Loader2, AlertCircle, PlayCircle, X, Images, Pencil, ChevronDown, ChevronRight, MonitorPlay } from 'lucide-react';
import { PokerSiteLogo } from '@/components/shared/PokerSiteLogo';
import { DifficultyTag, ReadingTimeBadge, ComprehensionTag, StakesTag } from '@/components/shared/DifficultyTag';
import { getContentDepthStyle, normalizeContentDepth, normalizeComprehension, normalizeStakes } from '@/lib/difficultyColors';
import { supabase } from '@/lib/supabase';
import { getYouTubeVideoId } from '@/components/player/widgets/YouTubePlayer';
import { GOLD, BORDER_GOLD, BG_CARD } from '@/components/ui/industry';
import type { MySpotsItem } from '@/lib/mySpotsStore';
import type { ContentBlock, WorkPackStage } from '@/lib/contentLab';
import { type SpotEvidence, fetchEvidence } from '@/lib/evidenceStore';
import { fetchRecordingsBySpotId, getRecordingUrlAsync, type PresentationRecording } from '@/lib/presentationRecordingStore';
import { renderFreeformBlocks } from './FreeformBlockEditor';
import { renderWorkPackStages } from './WorkPackEditor';
import { DocumentRenderer } from '@/components/contentLab/DocumentEditor';
import { SpotDiscussion } from './SpotDiscussion';
import { useDemo } from '@/useDemo';
import { EmbeddedHandReplayer, loadNormalizedHandById } from './EmbeddedHandReplayer';
import { HandDetailsSection } from './HandDetailsSection';
import { InlineRichText, renderInlineCardText } from './InlinePlayingCard';
import { GuidedPresentationEditor } from './GuidedPresentationEditor';
import { CompactAudioPlayer } from './MediaPlayer';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { Mic } from 'lucide-react';

interface VisualDetail {
  id: string;
  url: string;
  caption: string | null;
  type: string | null;
}

interface SpotData {
  id: string;
  title: string;
  subtitle: string | null;
  introduction: string | null;
  hand_details: string | null;
  content_html: string | null;
  creator_name: string | null;
  image_urls: string[] | null;
  visual_details: VisualDetail[] | null;
  tags: Record<string, unknown> | null;
  published_at: string | null;
  video_url: string | null;
  spot_type: string | null;
  content_blocks: ContentBlock[] | null;
  work_pack_stages: WorkPackStage[] | null;
  document_json: Record<string, unknown> | null;
  hand_id: string | null;
  account_id: string | null;
  poker_site: string | null;
  difficulty: string | null;
  comprehension_difficulty: string | null;
  tournament_stakes: string | null;
  audio_url: string | null;
}

interface Props {
  item?: MySpotsItem;
  spotId?: string;
  onBack: () => void;
  onEditSpotId?: (spotId: string) => void;
}

export function SpotViewer({ item, spotId: directSpotId, onBack, onEditSpotId }: Props) {
  const demo = useDemo();
  const { state } = demo;
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [evidence, setEvidence] = useState<SpotEvidence[]>([]);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; caption: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationHand, setPresentationHand] = useState<NormalizedHand | null>(null);
  const [presentationLoading, setPresentationLoading] = useState(false);
  const [attachedRecordings, setAttachedRecordings] = useState<Array<PresentationRecording & { attachment_id: string; is_intro: boolean }>>([]);

  const openPresentation = useCallback(async () => {
    if (!spot?.hand_id) return;
    setPresentationLoading(true);
    const hand = await loadNormalizedHandById(spot.hand_id);
    setPresentationLoading(false);
    if (hand) {
      setPresentationHand(hand);
      setPresentationOpen(true);
    }
  }, [spot?.hand_id]);

  const resolvedSpotId = directSpotId ?? item?.spotId ?? item?.contentId;
  const creatorName = item?.creator ?? 'Unknown';
  const grantedAt = item?.grantedAt ?? new Date().toISOString();
  const itemSource = item?.source;
  const itemSyncsharedBy = item?.syncsharedBy;

  useEffect(() => {
    if (!resolvedSpotId) {
      setError('Missing spot ID');
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      const { data, error: queryError } = await supabase
        .from('content_spots')
        .select('id, title, subtitle, introduction, hand_details, content_html, creator_name, image_urls, visual_details, tags, published_at, video_url, spot_type, content_blocks, work_pack_stages, document_json, hand_id, account_id, poker_site, difficulty, comprehension_difficulty, tournament_stakes, audio_url')
        .eq('id', resolvedSpotId)
        .maybeSingle();
      if (!mounted) return;
      if (queryError || !data) {
        setError('Could not load this spot');
        setLoading(false);
        return;
      }
      setSpot(data as SpotData);
      const evidenceItems = await fetchEvidence(resolvedSpotId);
      if (mounted) setEvidence(evidenceItems);
      const recordings = await fetchRecordingsBySpotId(resolvedSpotId);
      if (mounted) setAttachedRecordings(recordings);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [resolvedSpotId]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        <BackButton onBack={onBack} />
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-white/30" strokeWidth={1.5} />
          <p className="text-sm text-white/50">{error ?? 'Spot not found'}</p>
        </div>
      </div>
    );
  }

  const difficultyLevel = normalizeContentDepth(spot.difficulty, (spot.tags as Record<string, unknown> | null)?.difficulty as string | undefined);
  const difficultyStyle = difficultyLevel ? getContentDepthStyle(difficultyLevel) : null;

  const HIDDEN_TAG_VALUES = ['mtt', 'chipev', 'icm', 'pko', 'middle', 'early', 'bubble', 'final table', 'heads up'];
  const tagList = spot.tags && typeof spot.tags === 'object' && !Array.isArray(spot.tags)
    ? Object.values(spot.tags).filter((v): v is string =>
        typeof v === 'string' && v.length > 0 && !HIDDEN_TAG_VALUES.includes(v.toLowerCase())
      )
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-5 sm:py-5">
      <BackButton onBack={onBack} />

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: difficultyStyle?.border ?? BORDER_GOLD, background: BG_CARD, boxShadow: difficultyStyle?.glow }}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <Target className="h-4 w-4" style={{ color: GOLD }} />
          <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Content Spot</span>
          {onEditSpotId && resolvedSpotId && (
            <button
              onClick={() => onEditSpotId(resolvedSpotId)}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold tracking-wide text-white/60 uppercase transition hover:bg-white/10 hover:text-white"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {/* Title */}
          <h1 className="text-xl font-bold text-white sm:text-2xl">{spot.title}</h1>
          {spot.subtitle && (
            <p className="mt-1 text-sm text-white/50">{spot.subtitle}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {spot.poker_site && (
              <PokerSiteLogo site={spot.poker_site} size={24} />
            )}
            {(() => {
              const diffLevel = normalizeContentDepth(spot.difficulty, (spot.tags as Record<string, unknown> | null)?.difficulty as string | undefined);
              return diffLevel ? <DifficultyTag level={diffLevel} size="small" /> : null;
            })()}
            {(() => {
              const comp = normalizeComprehension(spot.comprehension_difficulty);
              return comp ? <ComprehensionTag level={comp} size="small" /> : null;
            })()}
            {(() => {
              const stakes = normalizeStakes(spot.tournament_stakes);
              return stakes ? <StakesTag level={stakes} size="small" /> : null;
            })()}
            <ReadingTimeBadge spot={spot} size="small" />
          </div>

          <p className="mt-1.5 text-[11px] text-white/35">
            by {spot.creator_name ?? creatorName}
            {spot.published_at && (
              <span className="ml-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(spot.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </p>

          {/* Tags */}
          {tagList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagList.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-medium text-white/50" style={{ borderColor: BORDER_GOLD, background: 'rgba(192,145,30,0.06)' }}>
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Introduction */}
          {spot.introduction && (
            <div className="mt-5 border-l-2 pl-4" style={{ borderColor: BORDER_GOLD }}>
              <p className="text-[13px] leading-relaxed text-white/70">{renderInlineCardText(spot.introduction)}</p>
            </div>
          )}

          {/* Embedded HH Replayer */}
          {spot.hand_id && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Hand Replayer</span>
                <button
                  onClick={() => { void openPresentation(); }}
                  disabled={presentationLoading}
                  className="ml-auto flex items-center gap-1 rounded-md border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2 py-1 text-[8px] font-bold uppercase text-[#f5e6b0] transition hover:bg-[#c0911e]/20 disabled:opacity-50"
                  title="Enter Presentation Mode"
                >
                  <MonitorPlay className="h-3 w-3" /> {presentationLoading ? 'Loading…' : 'Present'}
                </button>
              </div>
              <EmbeddedHandReplayer handId={spot.hand_id} />
            </div>
          )}

          {/* Hand details — collapsible, defaults to collapsed */}
          {spot.hand_details && (
            <HandDetailsSection handDetails={spot.hand_details} />
          )}

          {/* Visual Evidence — collapsible, closed by default */}
          {(() => {
            const visuals = spot.visual_details && spot.visual_details.length > 0
              ? spot.visual_details
              : (spot.image_urls ?? []).map((url, i) => ({ id: `img-${i}`, url, caption: null as string | null, type: null as string | null }));
            const evidenceVisuals = evidence.map((ev) => ({ id: ev.id, url: ev.asset_url, caption: (ev.caption || ev.title || null) as string | null, type: 'evidence' as string | null }));
            const allVisuals = [...visuals, ...evidenceVisuals];
            if (allVisuals.length === 0) return null;
            return (
              <div className="mt-5">
                <button
                  onClick={() => setEvidenceOpen((v) => !v)}
                  className="flex w-full items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:bg-white/[0.04]"
                >
                  {evidenceOpen
                    ? <ChevronDown className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    : <ChevronRight className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  }
                  <Images className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Visual Evidence</span>
                  <span className="ml-auto text-[9px] text-white/25">{allVisuals.length} item{allVisuals.length !== 1 ? 's' : ''}</span>
                </button>
                {evidenceOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {allVisuals.map((vd) => (
                      <figure key={vd.id} className={vd.type === 'evidence' ? 'sm:col-span-2' : ''}>
                        <img
                          src={vd.url}
                          alt={vd.caption || 'Spot illustration'}
                          onClick={() => setLightboxImage({ url: vd.url, title: '', caption: vd.caption || '' })}
                          className="cursor-zoom-in rounded-lg border border-white/[0.06] transition hover:opacity-90"
                        />
                        {vd.caption && (
                          <figcaption className="mt-1.5 text-center text-[10px] text-white/35">{vd.caption}</figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Attached presentation recordings */}
          {attachedRecordings.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Presentation Recordings</span>
              </div>
              <div className="space-y-2">
                {attachedRecordings.map((rec) => (
                  <AttachedRecordingPlayer key={rec.attachment_id} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Audio voice note */}
          {spot.audio_url && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Audio Voice Note</span>
              </div>
              <CompactAudioPlayer url={spot.audio_url} label="Creator voice note" />
            </div>
          )}

          {/* Written analysis */}
          {spot.content_html && (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Written Analysis</span>
              </div>
              <InlineRichText
                html={spot.content_html}
                className="prose-invert max-w-none text-[13px] leading-relaxed text-white/70"
              />
            </div>
          )}

          {/* Supplementary video — small embedded player, NOT the Media Center */}
          {spot.video_url && (() => {
            const ytId = getYouTubeVideoId(spot.video_url);
            if (ytId) {
              return (
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Youtube className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">Video Explanation</span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                    <div className="relative aspect-video w-full bg-black">
                      <iframe
                        key={ytId}
                        className="absolute inset-0 h-full w-full"
                        src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                        title={`${spot.title} — video explanation`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Freeform content blocks */}
          {spot.content_blocks && spot.content_blocks.length > 0 && (
            <div className="mt-5">
              {renderFreeformBlocks(spot.content_blocks)}
            </div>
          )}

          {/* Work Pack stages */}
          {spot.work_pack_stages && spot.work_pack_stages.length > 0 && (
            <div className="mt-5">
              {renderWorkPackStages(spot.work_pack_stages)}
            </div>
          )}

          {/* Document Studio content */}
          {spot.document_json && (
            <div className="mt-5">
              <DocumentRenderer documentJson={spot.document_json} />
            </div>
          )}

          {/* No content fallback */}
          {!spot.introduction && !spot.content_html && !spot.hand_details && !spot.video_url && !(spot.content_blocks && spot.content_blocks.length > 0) && !(spot.work_pack_stages && spot.work_pack_stages.length > 0) && !spot.document_json && (
            <div className="mt-6 rounded-lg border border-dashed p-6 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <FileText className="mx-auto h-8 w-8 text-white/20" strokeWidth={1.5} />
              <p className="mt-2 text-[11px] text-white/30">No written analysis available for this spot yet.</p>
            </div>
          )}
        </div>

        {/* Footer metadata */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(grantedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {itemSource === 'syncshare' && itemSyncsharedBy && (
              <span className="flex items-center gap-1" style={{ color: GOLD + '99' }}>
                SyncShared by {itemSyncsharedBy}
              </span>
            )}
          </div>
        </div>

        {/* Discussion section */}
        {spot.account_id && (
          <SpotDiscussion
            spotId={spot.id}
            spotCreatorId={spot.account_id}
            currentUser={state.currentAccount}
            sessionRestored={state.sessionRestored}
          />
        )}
      </div>

      {/* Image lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[92vw] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title || 'Image'}
              className="max-h-[78vh] max-w-[92vw] rounded-lg object-contain"
            />
            {lightboxImage.caption && (
              <div className="mt-3 rounded-lg bg-black/70 px-4 py-3 text-center">
                {lightboxImage.title && <p className="text-[12px] font-bold text-white/80">{lightboxImage.title}</p>}
                <p className="mt-1 text-[11px] text-white/55">{lightboxImage.caption}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Presentation Mode overlay */}
      {presentationOpen && presentationHand && (
        <GuidedPresentationEditor
          hand={presentationHand}
          onClose={() => { setPresentationOpen(false); setPresentationHand(null); }}
        />
      )}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="mb-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80"
      style={{ borderColor: BORDER_GOLD, background: BG_CARD }}
    >
      <ArrowLeft className="h-4 w-4" />
      My Spots
    </button>
  );
}

function AttachedRecordingPlayer({ rec }: { rec: PresentationRecording & { attachment_id: string; is_intro: boolean } }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUrl = async () => {
    if (url || !rec.storage_path) return;
    setLoading(true);
    setError(null);
    const signed = await getRecordingUrlAsync(rec.storage_path);
    if (signed) {
      setUrl(signed);
    } else {
      setError('Unable to load recording');
    }
    setLoading(false);
  };

  useEffect(() => { void loadUrl(); }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: BORDER_GOLD, background: 'rgba(192,145,30,0.04)' }}>
      <div className="flex items-center gap-2">
        {rec.media_type === 'video' ? (
          <Youtube className="h-3.5 w-3.5" style={{ color: GOLD }} />
        ) : (
          <Mic className="h-3.5 w-3.5" style={{ color: GOLD }} />
        )}
        <span className="text-[11px] font-semibold text-white/80">{rec.title}</span>
        {rec.is_intro && (
          <span className="rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ borderColor: BORDER_GOLD, color: GOLD }}>
            Intro
          </span>
        )}
        <span className="ml-auto text-[9px] text-white/35">{formatDuration(rec.duration_seconds)}</span>
      </div>
      {loading && <p className="mt-2 text-[10px] text-white/30">Loading recording…</p>}
      {error && <p className="mt-2 text-[10px] text-red-300/70">{error}</p>}
      {url && rec.media_type === 'video' && (
        <video src={url} controls className="mt-2 w-full rounded-lg" style={{ maxHeight: 320 }} />
      )}
      {url && rec.media_type === 'audio' && (
        <audio src={url} controls className="mt-2 w-full" />
      )}
    </div>
  );
}
