import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Check, X, RefreshCw, MessageSquare, User, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Booking,
  type BookingStatus,
  fetchBookingsForUser,
  updateBookingStatus,
  formatDateTime,
  getUserTimezone,
} from '@/lib/booking';

interface Props {
  account: { id: string; name: string };
}

const STATUS_STYLES: Record<string, string> = {
  requested: 'border-blue-500/20 bg-blue-500/5 text-blue-300',
  pending: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
  confirmed: 'border-green-500/20 bg-green-500/5 text-green-300',
  declined: 'border-red-500/20 bg-red-500/5 text-red-300',
  cancelled: 'border-white/10 bg-white/5 text-white/40',
  completed: 'border-[#d4a52c]/20 bg-[#c0911e]/5 text-[#d4a52c]',
  reschedule_requested: 'border-purple-500/20 bg-purple-500/5 text-purple-300',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
  reschedule_requested: 'Reschedule Proposed',
  expired: 'Expired',
};

export function CoachBookingRequests({ account }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'incoming' | 'upcoming' | 'past'>('incoming');
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const userTz = getUserTimezone();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBookingsForUser(account.id);
    setBookings(data);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const now = new Date();

  const incomingRequests = bookings.filter(
    (b) => b.provider_account_id === account.id && (b.booking_status === 'requested' || b.booking_status === 'reschedule_requested')
  );

  const upcomingSessions = bookings.filter(
    (b) =>
      b.provider_account_id === account.id &&
      ['confirmed', 'pending'].includes(b.booking_status) &&
      new Date(b.start_time) >= now
  );

  const pastSessions = bookings.filter(
    (b) => b.provider_account_id === account.id &&
      ['completed', 'declined', 'cancelled', 'expired'].includes(b.booking_status)
  );

  const filtered = filter === 'incoming' ? incomingRequests : filter === 'upcoming' ? upcomingSessions : pastSessions;
  const sortedFiltered = [...filtered].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  const handleAccept = async (bookingId: string) => {
    setActionError(null);
    const result = await updateBookingStatus(bookingId, 'confirmed');
    if (!result) {
      setActionError('Failed to accept request. Please try again.');
      return;
    }
    void load();
  };

  const handleDecline = async (bookingId: string) => {
    setActionError(null);
    const result = await updateBookingStatus(bookingId, 'declined');
    if (!result) {
      setActionError('Failed to decline request. Please try again.');
      return;
    }
    void load();
  };

  const handleProposeAlternative = async (bookingId: string) => {
    if (!rescheduleDate || !rescheduleTime) return;
    setActionError(null);
    const suggestedIso = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
    const result = await updateBookingStatus(bookingId, 'reschedule_requested', suggestedIso);
    if (!result) {
      setActionError('Failed to propose alternative time. Please try again.');
      return;
    }
    setRescheduleBookingId(null);
    setRescheduleDate('');
    setRescheduleTime('');
    void load();
  };

  const handleMarkCompleted = async (bookingId: string) => {
    setActionError(null);
    const result = await updateBookingStatus(bookingId, 'completed');
    if (!result) {
      setActionError('Failed to mark session as completed.');
      return;
    }
    void load();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Booking Requests</h2>
            <p className="text-[10px] text-[#5f6e7c]">Manage incoming coaching session requests</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'incoming', label: 'Requests', count: incomingRequests.length },
            { id: 'upcoming', label: 'Upcoming', count: upcomingSessions.length },
            { id: 'past', label: 'Past', count: pastSessions.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as 'incoming' | 'upcoming' | 'past')}
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

        {/* Error */}
        {actionError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-[11px] text-red-300">{actionError}</span>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#d4a52c]" />
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-white/50">
              {filter === 'incoming' ? 'No pending requests' : filter === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
            </p>
            <p className="mt-1 text-[11px] text-white/30">
              {filter === 'incoming' && 'New coaching requests will appear here.'}
              {filter === 'upcoming' && 'Confirmed and pending sessions show here.'}
              {filter === 'past' && 'Completed, declined, and cancelled sessions show here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFiltered.map((b) => {
              const isRequester = b.requester_account_id === account.id;
              const otherPartyLabel = isRequester ? 'Coach' : 'Student';
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-white/[0.06] bg-[#11151a]/40 p-4"
                >
                  {/* Status badge + date */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase ${STATUS_STYLES[b.booking_status] || 'border-white/10 text-white/40'}`}>
                      {STATUS_LABELS[b.booking_status] || b.booking_status}
                    </span>
                    <span className="text-[10px] text-white/40">{formatDateTime(b.start_time)}</span>
                  </div>

                  {/* Session details */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c0911e]/20 bg-gradient-to-b from-[#2a2010] to-[#1a1408]">
                      <Clock className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{b.service_name || 'Coaching Session'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-white/40">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {otherPartyLabel}: {isRequester ? b.provider_account_id.slice(0, 8) : b.requester_account_id.slice(0, 8)}…
                        </span>
                        <span>{b.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Student message */}
                  {b.message && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-white/30" />
                      <p className="text-[11px] leading-relaxed text-white/60">{b.message}</p>
                    </div>
                  )}

                  {/* Suggested new time */}
                  {b.suggested_new_time && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2">
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                      <span className="text-[11px] text-purple-300">
                        Proposed alternative: {formatDateTime(b.suggested_new_time)}
                      </span>
                    </div>
                  )}

                  {/* Reschedule form */}
                  {rescheduleBookingId === b.id && (
                    <div className="mt-3 space-y-2 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 p-3">
                      <p className="text-[10px] font-semibold tracking-wide text-[#d4a52c]/70 uppercase">Propose Alternative Time</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
                        />
                        <input
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setRescheduleBookingId(null); setRescheduleDate(''); setRescheduleTime(''); }}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/40 transition hover:text-white/60"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleProposeAlternative(b.id)}
                          disabled={!rescheduleDate || !rescheduleTime}
                          className="rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25 disabled:opacity-40"
                        >
                          Send Proposal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions for incoming requests */}
                  {filter === 'incoming' && !rescheduleBookingId && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                      <button
                        onClick={() => handleAccept(b.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[10px] font-bold tracking-wide text-green-300 uppercase transition hover:bg-green-500/20"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => handleDecline(b.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold tracking-wide text-red-300 uppercase transition hover:bg-red-500/20"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                      <button
                        onClick={() => setRescheduleBookingId(b.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Propose Alternative
                      </button>
                    </div>
                  )}

                  {/* Mark completed for confirmed sessions */}
                  {filter === 'upcoming' && b.booking_status === 'confirmed' && (
                    <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                      <button
                        onClick={() => handleMarkCompleted(b.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25"
                      >
                        <Check className="h-3.5 w-3.5" /> Mark Completed
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
