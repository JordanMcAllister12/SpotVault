import { useState, useEffect } from 'react';
import {
  ShieldCheck, Star, Clock, MapPin, Award, MessageSquare, Calendar,
  ChevronRight, Zap, TrendingUp, Loader2, Pin, Trophy,
} from 'lucide-react';
import {
  type TalentProfile, type TalentService, type TalentReview,
  getServicesByTalent, getReviewsByTalent, CATEGORY_LABELS, SERVICE_TYPE_LABELS,
} from '@/data/talent';
import { supabase } from '@/lib/supabase';
import { computeNextAvailable } from '@/lib/booking';

interface Props {
  talent: TalentProfile;
  onBook: (service: TalentService) => void;
  onMessage: () => void;
  onBack: () => void;
}

interface FeaturedReview {
  id: string;
  overall_rating: number;
  written_review: string;
  is_verified_student: boolean;
  created_at: string;
  coach_response: string;
}

interface FeaturedResult {
  id: string;
  image_url: string;
  caption: string;
  image_type: string;
}

export function TalentProfileView({ talent, onBook, onMessage, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'about' | 'services' | 'reviews'>('about');
  const services = getServicesByTalent(talent.id);
  const reviews = getReviewsByTalent(talent.id);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [nextAvailableLoading, setNextAvailableLoading] = useState(false);
  const [featuredReviews, setFeaturedReviews] = useState<FeaturedReview[]>([]);
  const [featuredResults, setFeaturedResults] = useState<FeaturedResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadNextAvailable() {
      setNextAvailableLoading(true);
      try {
        const { data: provider } = await supabase
          .from('booking_providers')
          .select('id, account_id, timezone')
          .eq('display_name', talent.name)
          .maybeSingle();
        if (provider && !cancelled) {
          const next = await computeNextAvailable(provider.id, provider.timezone ?? undefined);
          if (!cancelled) setNextAvailable(next);
        }
      } catch {
        // Silently fail — nextAvailable is optional
      } finally {
        if (!cancelled) setNextAvailableLoading(false);
      }
    }
    loadNextAvailable();
    return () => { cancelled = true; };
  }, [talent.name]);

  useEffect(() => {
    let cancelled = false;
    async function loadFeatured() {
      try {
        const { data: provider } = await supabase
          .from('booking_providers')
          .select('account_id')
          .eq('display_name', talent.name)
          .maybeSingle();
        if (!provider?.account_id || cancelled) return;
        const [revRes, imgRes] = await Promise.all([
          supabase.from('coach_reviews')
            .select('id, overall_rating, written_review, is_verified_student, created_at, coach_response')
            .eq('coach_account_id', provider.account_id)
            .eq('is_showcased', true)
            .order('showcase_order', { ascending: true }),
          supabase.from('coach_result_images')
            .select('id, image_url, caption, image_type')
            .eq('coach_account_id', provider.account_id)
            .eq('is_featured', true)
            .order('showcase_order', { ascending: true }),
        ]);
        if (!cancelled) {
          setFeaturedReviews((revRes.data ?? []) as FeaturedReview[]);
          setFeaturedResults((imgRes.data ?? []) as FeaturedResult[]);
        }
      } catch {
        // optional enrichment
      }
    }
    loadFeatured();
    return () => { cancelled = true; };
  }, [talent.name]);

  return (
    <div className="flex h-full flex-col">
      {/* Cover */}
      <div className="relative h-32 shrink-0 overflow-hidden" style={{ background: talent.coverGradient }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(212,165,44,0.08) 0%, transparent 60%)' }} />
        <button
          onClick={onBack}
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#0a0c0e]/80 px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase backdrop-blur transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6">
          {/* Header */}
          <div className="-mt-12 flex items-end gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-[#c0911e]/50 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-2xl font-bold text-[#d4a52c] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              {talent.photoInitials}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">{talent.name}</h1>
                {talent.verified && (
                  <ShieldCheck className="h-5 w-5 text-[#d4a52c]" strokeWidth={2} />
                )}
              </div>
              <p className="mt-0.5 text-sm text-[#aab6c2]">{talent.title}</p>
              <p className="text-xs text-[#5f6e7c]">{talent.subtitle}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Star} label="Rating" value={`${talent.rating}★`} sub={`${talent.reviewCount} reviews`} />
            <Stat icon={Clock} label="Response" value={`${talent.responseTimeHours}h`} sub="avg response" />
            <Stat icon={Calendar} label="Sessions" value={`${talent.completedSessions}`} sub="completed" />
            <Stat icon={Zap} label="From" value={`${talent.fromPriceCredits}`} sub="credits" />
          </div>

          {/* Next Available banner */}
          {(nextAvailable || nextAvailableLoading) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#c0911e]/25 bg-[#1a1408]/40 px-4 py-2.5">
              <Calendar className="h-4 w-4 shrink-0" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#5f6e7c]">Next Available:</span>
              {nextAvailableLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5f6e7c]" />
              ) : (
                <span className="text-[12px] font-semibold text-[#d4a52c]">{nextAvailable}</span>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setActiveTab('services')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
            >
              <Calendar className="h-4 w-4" strokeWidth={1.5} /> Book a Session
            </button>
            <button
              onClick={onMessage}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#232a32] bg-[#161b21] px-6 py-3 text-sm font-bold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.5} /> Message
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-[#1a1f25]">
            {(['about', 'services', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase transition-all ${
                  activeTab === tab
                    ? 'border-b-2 border-[#d4a52c] text-[#d4a52c]'
                    : 'text-[#5f6e7c] hover:text-[#aab6c2]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="py-5">
            {activeTab === 'about' && (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Biography</h3>
                  <p className="text-sm leading-relaxed text-[#c7cfd8]">{talent.bio}</p>
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Credentials</h3>
                  <div className="space-y-1.5">
                    {talent.credentials.map((c) => (
                      <div key={c} className="flex items-center gap-2 text-sm text-[#c7cfd8]">
                        <Award className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} /> {c}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Accomplishments</h3>
                  <div className="flex flex-wrap gap-2">
                    {talent.accomplishments.map((a) => (
                      <span key={a} className="rounded-lg border border-[#232a32] bg-[#11151a] px-3 py-1.5 text-xs text-[#aab6c2]">{a}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {talent.specialties.map((s) => (
                      <span key={s} className="rounded-lg border border-[#c0911e]/30 bg-[#1a1408]/50 px-3 py-1.5 text-xs font-medium text-[#d4a52c]">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <InfoRow label="Category" value={CATEGORY_LABELS[talent.category]} />
                  <InfoRow label="Game Types" value={talent.gameTypes.join(', ')} />
                  <InfoRow label="Timezone" value={talent.timezone} />
                  <InfoRow label="Availability" value={`${talent.availabilityHoursPerWeek}h/week`} />
                  <InfoRow label="Available Days" value={talent.availableDays.join(', ')} />
                  <InfoRow label="Hours" value={`${talent.availableHours.start}–${talent.availableHours.end}`} />
                </div>

                {/* Featured Student Results */}
                {featuredResults.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">
                      <Trophy className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} /> Student Results
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {featuredResults.map((r) => (
                        <div key={r.id} className="overflow-hidden rounded-lg border border-[#232a32] bg-[#11151a]/50">
                          <div className="aspect-video overflow-hidden bg-[#0a0c0e]">
                            <img src={r.image_url} alt={r.caption} className="h-full w-full object-cover" />
                          </div>
                          {r.caption && <div className="truncate p-2 text-[10px] text-[#aab6c2]">{r.caption}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Featured Student Reviews */}
                {featuredReviews.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">
                      <Pin className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} /> Featured Student Reviews
                    </h3>
                    <div className="space-y-3">
                      {featuredReviews.map((review) => (
                        <div key={review.id} className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map((i) => (
                                  <Star key={i} className={`h-3.5 w-3.5 ${i <= review.overall_rating ? 'text-[#d4a52c]' : 'text-[#2a323b]'}`} fill="currentColor" />
                                ))}
                              </div>
                              {review.is_verified_student && (
                                <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#5f6e7c]">{new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#c7cfd8]">
                            {review.written_review.length > 220
                              ? `${review.written_review.slice(0, 220)}…`
                              : review.written_review}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-3">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} onBook={() => onBook(service)} />
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 rounded-xl border border-[#232a32] bg-[#11151a]/50 p-4">
                  <div className="text-3xl font-bold text-[#d4a52c]">{talent.rating}</div>
                  <div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((i) => (
                        <Star key={i} className={`h-4 w-4 ${i <= Math.round(talent.rating) ? 'text-[#d4a52c]' : 'text-[#2a323b]'}`} fill="currentColor" />
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-[#5f6e7c]">{talent.reviewCount} verified sessions</p>
                  </div>
                </div>
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Star; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-3">
      <div className="flex items-center gap-1.5 text-[#5f6e7c]">
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        <span className="text-[9px] font-mono tracking-widest uppercase">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-[#5f6e7c]">{sub}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/40 px-3 py-2">
      <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</div>
      <div className="mt-0.5 text-xs text-[#aab6c2]">{value}</div>
    </div>
  );
}

function ServiceCard({ service, onBook }: { service: TalentService; onBook: () => void }) {
  return (
    <div className="metal-panel rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">{service.name}</h4>
            <span className="rounded border border-[#232a32] bg-[#11151a] px-2 py-0.5 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">
              {SERVICE_TYPE_LABELS[service.type]}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#5f6e7c]">{service.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#5f6e7c]">
            {service.durationMinutes > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {service.durationMinutes} min</span>}
            {service.includesMessaging && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Messaging</span>}
            {service.allowsFileUpload && <span className="flex items-center gap-1">📎 Files</span>}
            {service.sharesSpotVaultTools && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> SV Tools</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <Zap className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
            <span className="text-lg font-bold text-[#d4a52c]">{service.priceCredits.toLocaleString()}</span>
          </div>
          <button
            onClick={onBook}
            className="mt-2 flex items-center gap-1 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
          >
            Book <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: TalentReview }) {
  return (
    <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-xs font-bold text-[#aab6c2]">
            {review.authorName.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{review.authorName}</div>
            <div className="text-[10px] text-[#5f6e7c]">{review.date}</div>
          </div>
        </div>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i <= review.rating ? 'text-[#d4a52c]' : 'text-[#2a323b]'}`} fill="currentColor" />
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#c7cfd8]">{review.comment}</p>
    </div>
  );
}
