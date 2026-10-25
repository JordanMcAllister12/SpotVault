import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Send, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createBooking, makeIsoFromLocal, getUserTimezone, formatDateInZone } from '@/lib/booking';
import type { PeopleProfile } from '@/data/peopleDirectory';
import type { SpotVaultAccount } from '@/types';

interface Props {
  coach: PeopleProfile;
  account: SpotVaultAccount;
  onClose: () => void;
}

export function CoachBookingRequestModal({ coach, account, onClose }: Props) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [coachUserId, setCoachUserId] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);

  const userTz = getUserTimezone();

  useEffect(() => {
    void (async () => {
      setLoadingCoach(true);
      const { data } = await supabase
        .from('coach_listings')
        .select('account_id, hourly_rate_cents')
        .eq('account_id', coach.id)
        .maybeSingle();
      setCoachUserId(data?.account_id ?? coach.id);
      setLoadingCoach(false);
    })();
  }, [coach.id]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    if (!coachUserId) {
      setError('Unable to identify this coach. Please try again later.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const startIso = makeIsoFromLocal(selectedDate, selectedTime);
    const endIso = new Date(new Date(startIso).getTime() + duration * 60000).toISOString();
    const { booking, error: bErr } = await createBooking({
      provider_account_id: coachUserId,
      requester_account_id: account.id,
      provider_id: null,
      service_id: null,
      service_name: 'Coaching Session',
      service_type: 'COACHING',
      start_time: startIso,
      end_time: endIso,
      duration_minutes: duration,
      price_credits: 0,
      platform_fee_credits: 0,
      provider_payout_credits: 0,
      payment_status: 'n/a',
      booking_status: 'requested',
      request_type: 'meeting_request',
      message: message.trim() || null,
      company: null,
    });
    setSubmitting(false);
    if (bErr) {
      setError(bErr);
      return;
    }
    if (booking) {
      setSuccess(true);
    }
  };

  if (loadingCoach) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="text-sm text-white/40">Loading…</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-400" strokeWidth={2} />
          </div>
          <h3 className="mt-4 text-base font-bold text-white">Request Sent</h3>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Your coaching session request has been sent to {coach.displayName}. You'll be notified when they respond.
          </p>
          <button
            onClick={onClose}
            className="mt-5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-6 py-2 text-xs font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-white/[0.08] bg-[#c0911e]/10">
              {coach.avatarUrl ? (
                <img src={coach.avatarUrl} alt={coach.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-[#d4a52c]/60">
                  {coach.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{coach.displayName}</h3>
              <p className="text-[10px] text-[#d4a52c]/60">{coach.tagline}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 transition hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Coach rating */}
        {coach.coachRatingCount !== undefined && coach.coachRatingCount > 0 && (
          <div className="flex items-center gap-1.5 px-5 py-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i <= Math.round(coach.coachRatingAverage ?? 0) ? 'fill-[#d4a52c] text-[#d4a52c]' : 'text-white/15'}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-white/70">{(coach.coachRatingAverage ?? 0).toFixed(1)}</span>
            <span className="text-[9px] text-white/35">({coach.coachRatingCount} reviews)</span>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 px-5 py-4">
          {/* Date */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
              <Calendar className="h-3 w-3" /> Preferred Date
            </label>
            <input
              type="date"
              value={selectedDate}
              min={todayStr}
              max={maxDateStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
            />
          </div>

          {/* Time */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
              <Clock className="h-3 w-3" /> Preferred Time
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-white/60 uppercase">Duration</label>
            <div className="flex gap-2">
              {[30, 60, 90, 120].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    duration === d
                      ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                      : 'border-white/10 bg-black/30 text-white/50 hover:border-white/20'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-white/60 uppercase">
              Message to Coach <span className="text-white/30 normal-case">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the coach what you'd like to focus on…"
              rows={3}
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

          {/* Timezone note */}
          <p className="text-[9px] text-white/30">
            Times shown in your local timezone ({userTz}). The coach may propose an alternative time.
          </p>

          {/* Actions */}
          <div className="flex gap-2 border-t border-white/[0.06] pt-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-xs font-semibold text-white/50 transition hover:text-white/70"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedDate || !selectedTime || submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/20 px-4 py-2.5 text-xs font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
