import { useState, useEffect, useCallback } from 'react';
import { Star, Send, ShieldCheck, MessageSquare, Pin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  account: { id: string; name: string };
}

interface Review {
  id: string;
  coach_account_id: string;
  student_account_id: string;
  overall_rating: number;
  strategy_knowledge: number | null;
  communication: number | null;
  preparation: number | null;
  value: number | null;
  professionalism: number | null;
  written_review: string;
  coach_response: string;
  is_verified_student: boolean;
  created_at: string;
  coach_response_at: string | null;
  is_showcased: boolean;
  showcase_order: number;
}

export function CoachReviewsView({ account }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const MAX_SHOWCASED = 2;

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const accountId = userData.user?.id ?? account.id;
    const { data } = await supabase
      .from('coach_reviews')
      .select('*')
      .eq('coach_account_id', accountId)
      .order('created_at', { ascending: false });
    const dbReviews = (data ?? []) as Review[];
    setReviews(dbReviews);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const submitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return;
    setSubmitting(true);
    await supabase
      .from('coach_reviews')
      .update({ coach_response: responseText.trim(), coach_response_at: new Date().toISOString() })
      .eq('id', reviewId);
    setSubmitting(false);
    setResponseText('');
    setRespondingTo(null);
    void loadReviews();
  };

  const toggleShowcase = async (review: Review) => {
    setShowcaseError(null);
    if (review.is_showcased) {
      await supabase.from('coach_reviews').update({ is_showcased: false, showcase_order: 0 }).eq('id', review.id);
      void loadReviews();
    } else {
      const currentShowcased = reviews.filter((r) => r.is_showcased);
      if (currentShowcased.length >= MAX_SHOWCASED) {
        setShowcaseError(`You can only showcase ${MAX_SHOWCASED} reviews. Remove one first.`);
        window.setTimeout(() => setShowcaseError(null), 4000);
        return;
      }
      await supabase.from('coach_reviews').update({ is_showcased: true, showcase_order: currentShowcased.length }).eq('id', review.id);
      void loadReviews();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[11px] text-white/40">Loading reviews...</div>;
  }

  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length).toFixed(1) : '—';
  const totalReviews = reviews.length;
  const verifiedCount = reviews.filter((r) => r.is_verified_student).length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Reviews</h2>
            <p className="text-[10px] text-[#5f6e7c]">Reviews from your coaching students</p>
          </div>
        </div>

        {/* Showcase info */}
        <div className="flex items-center gap-2 rounded-lg border border-[#c091e]/20 bg-[#c091e]/5 px-4 py-2.5">
          <Pin className="h-3.5 w-3.5 shrink-0 text-[#d4a52c]" />
          <span className="text-[10px] text-[#aab6c2]">Select up to {MAX_SHOWCASED} reviews to showcase on your public coaching profile. Currently featured: <span className="font-bold text-[#d4a52c]">{reviews.filter((r) => r.is_showcased).length}</span> / {MAX_SHOWCASED}</span>
        </div>
        {showcaseError && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-[10px] font-semibold text-red-300">{showcaseError}</div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 rounded-xl border border-white/[0.08] bg-[rgba(8,11,14,0.93)] shadow-lg">
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="text-[10px] font-mono tracking-widest text-white/45 uppercase">Average Rating</div>
            <div className="mt-1 text-3xl font-bold text-[#d4a52c]">{avgRating}★</div>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-white/[0.06] p-4 text-center">
            <div className="text-[10px] font-mono tracking-widest text-white/45 uppercase">Total Reviews</div>
            <div className="mt-1 text-3xl font-bold text-white">{totalReviews}</div>
          </div>
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="text-[10px] font-mono tracking-widest text-white/45 uppercase">Verified Students</div>
            <div className="mt-1 text-3xl font-bold text-emerald-400">{verifiedCount}</div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#232a32] p-8 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-[#38424e]" strokeWidth={1.5} />
              <p className="text-sm text-[#5f6e7c]">No verified reviews yet.</p>
              <p className="mt-1 text-[11px] text-[#475565]">Verified reviews appear automatically after students complete coaching sessions with you.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className={`metal-panel rounded-xl p-5 space-y-3 ${review.is_showcased ? 'ring-1 ring-[#d4a52c]/40' : ''}`}>
                {/* Rating header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < review.overall_rating ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-[#232a32]'}`} />)}</div>
                    {review.is_verified_student && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                        <ShieldCheck className="h-3 w-3" /> Verified Student
                      </span>
                    )}
                    {review.is_showcased && (
                      <span className="flex items-center gap-1 rounded-full bg-[#d4a52c]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#d4a52c]">
                        <Pin className="h-3 w-3" /> Showcased
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#5f6e7c]">{new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>

                {/* Written review */}
                <p className="text-sm text-[#c7cfd8]">{review.written_review}</p>

                {/* Sub-ratings */}
                {(review.strategy_knowledge || review.communication || review.preparation || review.value || review.professionalism) && (
                  <div className="flex flex-wrap gap-3">
                    {review.strategy_knowledge && <SubRating label="Strategy" rating={review.strategy_knowledge} />}
                    {review.communication && <SubRating label="Communication" rating={review.communication} />}
                    {review.preparation && <SubRating label="Preparation" rating={review.preparation} />}
                    {review.value && <SubRating label="Value" rating={review.value} />}
                    {review.professionalism && <SubRating label="Professionalism" rating={review.professionalism} />}
                  </div>
                )}

                {/* Coach response */}
                {review.coach_response ? (
                  <div className="rounded-lg border border-[#c0911e]/15 bg-[#c0911e]/5 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-[#d4a52c]" />
                      <span className="text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">Your Response</span>
                    </div>
                    <p className="text-xs text-[#aab6c2]">{review.coach_response}</p>
                  </div>
                ) : respondingTo === review.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write a response to this review..."
                      className="h-20 w-full resize-none rounded-lg border border-[#232a32] bg-[#11151a] p-3 text-xs text-white placeholder-[#475565] focus:border-[#c0911e]/40 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void submitResponse(review.id)}
                        disabled={!responseText.trim() || submitting}
                        className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase disabled:opacity-40"
                      >
                        <Send className="h-3 w-3" /> {submitting ? 'Sending...' : 'Submit Response'}
                      </button>
                      <button onClick={() => { setRespondingTo(null); setResponseText(''); }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#5f6e7c] uppercase">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRespondingTo(review.id)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-[#5f6e7c] uppercase transition-colors hover:text-[#d4a52c]"
                  >
                    <MessageSquare className="h-3 w-3" /> Respond to Review
                  </button>
                )}

                {/* Showcase toggle */}
                <button
                  onClick={() => void toggleShowcase(review)}
                  className={`flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase transition-colors ${review.is_showcased ? 'text-[#d4a52c]' : 'text-[#5f6e7c] hover:text-[#d4a52c]'}`}
                >
                  <Pin className={`h-3 w-3 ${review.is_showcased ? 'fill-[#d4a52c]' : ''}`} /> {review.is_showcased ? 'Remove from Showcase' : 'Showcase in Coaching Profile'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SubRating({ label, rating }: { label: string; rating: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</span>
      <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-2.5 w-2.5 ${i < rating ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-[#232a32]'}`} />)}</div>
    </div>
  );
}
