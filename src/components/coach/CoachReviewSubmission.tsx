import { useState, useEffect } from 'react';
import { Star, Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Booking } from '@/lib/booking';

interface Props {
  booking: Booking;
  coachName: string;
  onSubmitted: () => void;
  onCancel: () => void;
}

interface ExistingReview {
  id: string;
  overall_rating: number;
  written_review: string;
}

export function CoachReviewSubmission({ booking, coachName, onSubmitted, onCancel }: Props) {
  const [overallRating, setOverallRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [strategyKnowledge, setStrategyKnowledge] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [preparation, setPreparation] = useState(0);
  const [value, setValue] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [writtenReview, setWrittenReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingReview, setExistingReview] = useState<ExistingReview | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    void (async () => {
      setCheckingExisting(true);
      const { data } = await supabase
        .from('coach_reviews')
        .select('id, overall_rating, written_review')
        .eq('booking_id', booking.id)
        .maybeSingle();
      setExistingReview(data as ExistingReview | null);
      setCheckingExisting(false);
    })();
  }, [booking.id]);

  const handleSubmit = async () => {
    if (overallRating === 0) {
      setError('Please select an overall rating.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const studentId = userData.user?.id ?? booking.requester_account_id;

    const { error: insertError } = await supabase
      .from('coach_reviews')
      .insert({
        coach_account_id: booking.provider_account_id,
        student_account_id: studentId,
        booking_id: booking.id,
        overall_rating: overallRating,
        strategy_knowledge: strategyKnowledge || null,
        communication: communication || null,
        preparation: preparation || null,
        value: value || null,
        professionalism: professionalism || null,
        written_review: writtenReview.trim(),
        coach_response: '',
        is_verified_student: true,
      });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSubmitted();
  };

  if (checkingExisting) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-xs text-white/30">Checking…</div>
      </div>
    );
  }

  if (existingReview) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
          <CheckCircle2 className="h-6 w-6 text-green-400" strokeWidth={2} />
        </div>
        <p className="text-sm font-semibold text-white">You've already reviewed this session</p>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < existingReview.overall_rating ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-white/15'}`}
            />
          ))}
        </div>
        {existingReview.written_review && (
          <p className="max-w-md text-[11px] leading-relaxed text-white/50">"{existingReview.written_review}"</p>
        )}
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/50 transition hover:text-white/70"
        >
          Close
        </button>
      </div>
    );
  }

  const subRatings: { label: string; value: number; setter: (v: number) => void }[] = [
    { label: 'Strategy Knowledge', value: strategyKnowledge, setter: setStrategyKnowledge },
    { label: 'Communication', value: communication, setter: setCommunication },
    { label: 'Preparation', value: preparation, setter: setPreparation },
    { label: 'Value', value: value, setter: setValue },
    { label: 'Professionalism', value: professionalism, setter: setProfessionalism },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-white">Review Your Coaching Session</h3>
        <p className="mt-0.5 text-[10px] text-white/40">
          {coachName} · {booking.service_name || 'Coaching Session'}
        </p>
      </div>

      {/* Verified badge */}
      <div className="flex items-center gap-2 rounded-lg border border-green-500/15 bg-green-500/5 px-3 py-2">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-400" />
        <span className="text-[10px] text-green-300">
          This review will be marked as a verified student review and will appear on {coachName}'s public profile.
        </span>
      </div>

      {/* Overall rating */}
      <div>
        <label className="mb-2 block text-[11px] font-semibold tracking-wide text-white/60 uppercase">Overall Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setOverallRating(i)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 ${(hoverRating || overallRating) >= i ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-white/15'}`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Sub-ratings */}
      <div className="space-y-3">
        <label className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">Detailed Ratings <span className="text-white/30 normal-case">(optional)</span></label>
        {subRatings.map(({ label, value, setter }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[11px] text-white/50">{label}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setter(i)}>
                  <Star
                    className={`h-4 w-4 ${value >= i ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-white/15'}`}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Written review */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-white/60 uppercase">
          Written Review <span className="text-white/30 normal-case">(optional)</span>
        </label>
        <textarea
          value={writtenReview}
          onChange={(e) => setWrittenReview(e.target.value)}
          placeholder="Share your experience working with this coach…"
          rows={4}
          className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs leading-relaxed text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="text-[11px] text-red-300">{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t border-white/[0.06] pt-4">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-xs font-semibold text-white/50 transition hover:text-white/70"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={overallRating === 0 || submitting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/20 px-4 py-2.5 text-xs font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}
