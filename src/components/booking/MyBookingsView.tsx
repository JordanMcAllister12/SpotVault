import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, CheckCircle2, X, Star, AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import {
  type Booking,
  fetchBookingsForUser,
  formatDateTime,
  BOOKING_STATUS_LABELS,
} from '@/lib/booking';
import { CoachReviewSubmission } from '@/components/coach/CoachReviewSubmission';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';

interface Props {
  account: SpotVaultAccount;
}

const STATUS_STYLES: Record<string, string> = {
  requested: 'border-blue-500/20 bg-blue-500/5 text-blue-300',
  pending: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
  confirmed: 'border-green-500/20 bg-green-500/5 text-green-300',
  declined: 'border-red-500/20 bg-red-500/5 text-red-300',
  cancelled: 'border-white/10 bg-white/5 text-white/40',
  completed: 'border-[#d4a52c]/20 bg-[#c0911e]/5 text-[#d4a52c]',
  reschedule_requested: 'border-purple-500/20 bg-purple-500/5 text-purple-300',
  expired: 'border-white/10 bg-white/5 text-white/40',
};

export function MyBookingsView({ account }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'all'>('upcoming');
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [coachNames, setCoachNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBookingsForUser(account.id);
    setBookings(data);

    const providerIds = [...new Set(data.map((b) => b.provider_account_id))];
    if (providerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('coach_listings')
        .select('account_id, display_name')
        .in('account_id', providerIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: { account_id: string; display_name: string }) => {
        nameMap[p.account_id] = p.display_name;
      });
      setCoachNames(nameMap);
    }
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => ['confirmed', 'pending', 'requested', 'reschedule_requested'].includes(b.booking_status) && new Date(b.start_time) >= now
  );
  const completed = bookings.filter(
    (b) => b.booking_status === 'completed' || (['confirmed', 'pending'].includes(b.booking_status) && new Date(b.start_time) < now)
  );

  const filtered = filter === 'upcoming' ? upcoming : filter === 'completed' ? completed : bookings;
  const sortedFiltered = [...filtered].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[#d4a52c]" />
      </div>
    );
  }

  if (reviewBooking) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6">
        <CoachReviewSubmission
          booking={reviewBooking}
          coachName={coachNames[reviewBooking.provider_account_id] || 'Coach'}
          onSubmitted={() => { setReviewBooking(null); void load(); }}
          onCancel={() => setReviewBooking(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
        <div>
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">My Bookings</h2>
          <p className="text-[10px] text-[#5f6e7c]">Your coaching session requests and bookings</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'completed', label: 'Completed', count: completed.length },
          { id: 'all', label: 'All', count: bookings.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as 'upcoming' | 'completed' | 'all')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase transition ${
              filter === t.id
                ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                : 'border-white/10 bg-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                filter === t.id ? 'bg-[#d4a52c]/30 text-[#f5e6b0]' : 'bg-white/10 text-white/50'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-white/50">No bookings yet</p>
          <p className="mt-1 text-[11px] text-white/30">Browse the People directory to find and book coaches.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map((b) => {
            const coachName = coachNames[b.provider_account_id] || 'Coach';
            const canReview = b.booking_status === 'completed' ||
              (['confirmed', 'pending'].includes(b.booking_status) && new Date(b.start_time) < now);
            return (
              <div key={b.id} className="rounded-xl border border-white/[0.06] bg-[#11151a]/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase ${STATUS_STYLES[b.booking_status] || 'border-white/10 text-white/40'}`}>
                    {BOOKING_STATUS_LABELS[b.booking_status] || b.booking_status}
                  </span>
                  <span className="text-[10px] text-white/40">{formatDateTime(b.start_time)}</span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c0911e]/20 bg-gradient-to-b from-[#2a2010] to-[#1a1408]">
                    <Clock className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-white">{b.service_name || 'Coaching Session'}</span>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-white/40">
                      <span>Coach: {coachName}</span>
                      <span>{b.duration_minutes} min</span>
                    </div>
                  </div>
                </div>

                {b.message && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-white/30" />
                    <p className="text-[11px] leading-relaxed text-white/60">{b.message}</p>
                  </div>
                )}

                {b.suggested_new_time && (
                  <div className="mt-3 rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2">
                    <span className="text-[11px] text-purple-300">
                      Coach proposed: {formatDateTime(b.suggested_new_time)}
                    </span>
                  </div>
                )}

                {canReview && (
                  <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                    <button
                      onClick={() => setReviewBooking(b)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25"
                    >
                      <Star className="h-3.5 w-3.5" /> Leave a Review
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
