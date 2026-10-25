import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, BadgeCheck, Star, Calendar, Users, Globe, Clock,
  DollarSign, Loader2, AlertCircle, Pencil, ImageIcon, X,
} from 'lucide-react';
import { GOLD, BORDER_GOLD, BG_CARD } from '@/components/ui/industry';
import { fetchMyCoachListing, type CoachListing } from '@/lib/jobsData';
import { supabase } from '@/lib/supabase';
import { useDemo } from '@/useDemo';
import { CoachBusinessPage } from './CoachBusinessPage';
import type { SpotVaultAccount } from '@/types';

interface CoachResultImage {
  id: string;
  image_url: string;
  caption: string | null;
  image_type: string | null;
  sort_order: number;
  is_featured: boolean;
}

interface CoachReview {
  id: string;
  student_account_id: string;
  overall_rating: number;
  strategy_knowledge: number;
  communication: number;
  preparation: number;
  value: number;
  professionalism: number;
  written_review: string | null;
  coach_response: string | null;
  is_verified_student: boolean;
  is_showcased: boolean;
  created_at: string;
}

interface Props {
  coachAccountId: string;
  onBack: () => void;
}

const SECTION_STYLE: React.CSSProperties = {
  background: 'rgba(8,7,6,0.82)',
  border: '1px solid rgba(212,165,44,0.12)',
  borderRadius: '0.75rem',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
};

export function CoachProfileView({ coachAccountId, onBack }: Props) {
  const demo = useDemo();
  const { state } = demo;
  const currentUser = state.currentAccount as SpotVaultAccount | null;

  const [listing, setListing] = useState<CoachListing | null>(null);
  const [resultImages, setResultImages] = useState<CoachResultImage[]>([]);
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<CoachResultImage | null>(null);
  const [editing, setEditing] = useState(false);

  const isOwner = !!currentUser && currentUser.id === coachAccountId;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coachListing = await fetchMyCoachListing(coachAccountId);
      if (!coachListing) {
        setError('This coach profile is not available.');
        setLoading(false);
        return;
      }
      setListing(coachListing);

      const [imgResult, revResult] = await Promise.all([
        supabase
          .from('coach_result_images')
          .select('id, image_url, caption, image_type, sort_order, is_featured')
          .eq('coach_account_id', coachAccountId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('coach_reviews')
          .select('id, student_account_id, overall_rating, strategy_knowledge, communication, preparation, value, professionalism, written_review, coach_response, is_verified_student, is_showcased, created_at')
          .eq('coach_account_id', coachAccountId)
          .order('created_at', { ascending: false }),
      ]);

      if (imgResult.data) setResultImages(imgResult.data as CoachResultImage[]);
      if (revResult.data) setReviews(revResult.data as CoachReview[]);
    } catch {
      setError('Could not load this coach profile.');
    } finally {
      setLoading(false);
    }
  }, [coachAccountId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  if (editing && isOwner) {
    return <CoachBusinessPage account={currentUser!} initialTab="profile" />;
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        <button onClick={onBack} className="mb-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/5" style={{ borderColor: BORDER_GOLD, background: BG_CARD }}>
          <ArrowLeft className="h-4 w-4" /> Back to Directory
        </button>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-white/30" strokeWidth={1.5} />
          <p className="text-sm text-white/50">{error ?? 'Coach profile not found.'}</p>
        </div>
      </div>
    );
  }

  const ratingAvg = listing.coach_rating_average ?? 0;
  const ratingCount = listing.coach_rating_count ?? 0;
  const photoUrl = listing.profile_photo_url || undefined;
  const hasAbout = !!(listing.bio || listing.coaching_description);
  const hasAccomplishments = !!listing.accomplishments;
  const hasServices = listing.coaching_methods.length > 0 || listing.formats_coached.length > 0 || listing.stakes_coached.length > 0 || listing.languages.length > 0 || listing.rate_per_hour > 0 || !!listing.availability_summary;
  const hasResults = resultImages.length > 0;
  const hasReviews = reviews.length > 0;
  const isEmpty = !hasAbout && !hasAccomplishments && !hasServices && !hasResults && !hasReviews;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-5 sm:py-5">
      {/* Back button — floats independently */}
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/80" style={{ borderColor: BORDER_GOLD, background: 'rgba(8,7,6,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
        <ArrowLeft className="h-4 w-4" /> Back to Directory
      </button>

      {/* Floating profile header — independent card */}
      <div className="mb-4 p-5 sm:p-6" style={SECTION_STYLE}>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 sm:h-20 sm:w-20">
            {photoUrl ? (
              <img src={photoUrl} alt={listing.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xl font-bold text-[#d4a52c]/60 sm:text-2xl">
                {listing.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white sm:text-xl">{listing.display_name}</h1>
              {listing.is_featured && <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a52c]" />}
            </div>
            {listing.username && (
              <p className="mt-0.5 text-[11px] text-white/40">@{listing.username}</p>
            )}
            {listing.specialties.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {listing.specialties.slice(0, 6).map((s) => (
                  <span key={s} className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 px-2 py-0.5 text-[9px] font-medium text-[#f5e6b0]">{s}</span>
                ))}
              </div>
            )}
            {ratingCount > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(ratingAvg) ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-white/15'}`} />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-white/70">{ratingAvg.toFixed(1)}</span>
                <span className="text-[10px] text-white/35">({ratingCount} review{ratingCount !== 1 ? 's' : ''})</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isOwner && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/25"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Profile
            </button>
          )}
          {listing.available_for_coaching && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-[10px] font-bold tracking-widest text-emerald-300 uppercase">
              <Calendar className="h-3.5 w-3.5" /> Available for Coaching
            </div>
          )}
          {listing.rate_per_hour > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold tracking-widest text-white/60 uppercase">
              <DollarSign className="h-3.5 w-3.5" /> {listing.rate_per_hour}/hr
            </div>
          )}
        </div>
      </div>

      {/* Independent floating sections — wallpaper visible between them */}
      {hasAbout && (
        <div className="mb-4 p-5 sm:p-6" style={SECTION_STYLE}>
          <SectionHeader icon={Pencil} title="About" />
          {listing.coaching_description && (
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/70">{listing.coaching_description}</div>
          )}
          {listing.bio && listing.coaching_description && <div className="mt-3 border-t border-white/[0.06] pt-3" />}
          {listing.bio && (
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/60">{listing.bio}</div>
          )}
        </div>
      )}

      {hasAccomplishments && (
        <div className="mb-4 p-5 sm:p-6" style={SECTION_STYLE}>
          <SectionHeader icon={BadgeCheck} title="Accomplishments" />
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/70">{listing.accomplishments}</div>
        </div>
      )}

      {hasResults && (
        <div className="mb-4 p-5 sm:p-6" style={SECTION_STYLE}>
          <SectionHeader icon={ImageIcon} title="Poker Results & Evidence" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {resultImages.map((img) => (
              <figure key={img.id} className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/20">
                <img
                  src={img.image_url}
                  alt={img.caption || img.image_type || 'Result image'}
                  onClick={() => setLightbox(img)}
                  className="w-full cursor-zoom-in transition hover:opacity-90"
                />
                {img.caption && (
                  <figcaption className="px-3 py-2 text-[10px] text-white/45">{img.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}

      {hasServices && (
        <div className="mb-4 p-5 sm:p-6" style={SECTION_STYLE}>
          <SectionHeader icon={Calendar} title="Coaching Services" />
          <div className="space-y-3">
            {listing.formats_coached.length > 0 && (
              <DetailRow label="Formats" value={listing.formats_coached.join(', ')} />
            )}
            {listing.coaching_methods.length > 0 && (
              <DetailRow label="Methods" value={listing.coaching_methods.join(', ')} />
            )}
            {listing.stakes_coached.length > 0 && (
              <DetailRow label="Stakes" value={listing.stakes_coached.join(', ')} />
            )}
            {listing.languages.length > 0 && (
              <DetailRow label="Languages" value={listing.languages.join(', ')} />
            )}
            {listing.rate_per_hour > 0 && (
              <DetailRow label="Rate" value={`$${listing.rate_per_hour}/hour`} />
            )}
            {listing.session_durations.length > 0 && (
              <DetailRow label="Session Lengths" value={listing.session_durations.map((d) => `${d}min`).join(', ')} />
            )}
            {listing.availability_summary && (
              <DetailRow label="Availability" value={listing.availability_summary} />
            )}
          </div>
        </div>
      )}

      {hasReviews && (
        <div className="mb-4 p-5 sm:p-6" style={SECTION_STYLE}>
          <SectionHeader icon={Star} title={`Reviews (${reviews.length})`} />
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div key={rev.id} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`h-3 w-3 ${i <= rev.overall_rating ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-white/15'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-white/60">{rev.overall_rating}.0</span>
                  {rev.is_verified_student && (
                    <span className="rounded border border-emerald-400/20 bg-emerald-400/8 px-1.5 py-0 text-[7px] font-bold tracking-widest text-emerald-300 uppercase">Verified</span>
                  )}
                  <span className="ml-auto text-[9px] text-white/30">
                    {new Date(rev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {rev.written_review && (
                  <p className="mt-2 text-[12px] leading-relaxed text-white/60">{rev.written_review}</p>
                )}
                {rev.coach_response && (
                  <div className="mt-2 border-t border-white/[0.06] pt-2">
                    <p className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Coach Response</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/50">{rev.coach_response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="mb-4 p-6 text-center" style={SECTION_STYLE}>
          <p className="text-[11px] text-white/30">This coach has not completed their profile yet.</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <div className="relative max-h-[90vh] max-w-[92vw] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.image_url} alt={lightbox.caption || 'Result'} className="max-h-[78vh] max-w-[92vw] rounded-lg object-contain" />
            {lightbox.caption && (
              <div className="mt-3 rounded-lg bg-black/70 px-4 py-3 text-center">
                <p className="text-[12px] text-white/55">{lightbox.caption}</p>
              </div>
            )}
          </div>
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Pencil; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" style={{ color: GOLD }} />
      <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">{title}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-[10px] font-bold tracking-widest text-white/30 uppercase">{label}</span>
      <span className="text-[12px] text-white/70">{value}</span>
    </div>
  );
}
