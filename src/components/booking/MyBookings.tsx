import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Calendar, Check, X, AlertCircle, ChevronRight,
  DollarSign, MessageSquare, RotateCcw, Video, Mic,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import {
  type Booking, type BookingStatus,
  fetchBookingsForUser, updateBookingStatus,
  BOOKING_STATUS_LABELS, formatPrice, formatDateTime, getUserTimezone,
} from '@/lib/booking';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CoachingRoom } from '@/components/booking/CoachingRoom';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'requests', label: 'Requests' },
  { value: 'awaiting', label: 'Awaiting Response' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type TabValue = typeof TABS[number]['value'];

interface Props {
  account: SpotVaultAccount;
}

export function MyBookings({ account }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>('upcoming');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Booking | null>(null);
  const userTz = getUserTimezone();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBookingsForUser(account.id);
    setBookings(data);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();

  const filtered = bookings.filter((b) => {
    const isProvider = b.provider_account_id === account.id;
    const isRequester = b.requester_account_id === account.id;
    const isPast = new Date(b.start_time) < now;

    switch (tab) {
      case 'upcoming':
        return !isPast && (b.booking_status === 'confirmed' || b.booking_status === 'pending');
      case 'requests':
        return isProvider && b.booking_status === 'requested';
      case 'awaiting':
        return isRequester && (b.booking_status === 'requested' || b.booking_status === 'reschedule_requested');
      case 'completed':
        return b.booking_status === 'completed' || (isPast && b.booking_status === 'confirmed');
      case 'cancelled':
        return b.booking_status === 'declined' || b.booking_status === 'cancelled' || b.booking_status === 'expired';
      default:
        return false;
    }
  });

  const handleAction = async (bookingId: string, action: BookingStatus, suggestedTime?: string) => {
    setActionLoading(bookingId);
    await updateBookingStatus(bookingId, action, suggestedTime);
    setActionLoading(null);
    load();
  };

  if (activeSession) {
    const isProvider = activeSession.provider_account_id === account.id;
    const otherName = isProvider ? activeSession.requester_account_id : activeSession.provider_account_id;
    return (
      <CoachingRoom
        bookingId={activeSession.id}
        userId={account.id}
        userRole={isProvider ? 'coach' : 'student'}
        coachName={isProvider ? account.name : otherName}
        studentName={isProvider ? otherName : account.name}
        serviceName={activeSession.service_name || 'Coaching Session'}
        onExit={() => { setActiveSession(null); load(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-white/30">Loading bookings…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[#1a1f25] px-4 py-3">
        <h2 className="text-sm font-bold tracking-tight text-white">My Bookings</h2>
        <p className="text-[9px] font-mono tracking-[0.2em] text-[#d4a52c]/60 uppercase">
          SpotVault Booking Marketplace
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 border-b border-[#1a1f25] px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${
              tab === t.value
                ? 'bg-[#c0911e]/15 text-[#f5e6b0]'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Calendar className="h-8 w-8 text-white/10" strokeWidth={1} />
            <p className="text-xs text-white/30">No bookings in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => {
              const isProvider = b.provider_account_id === account.id;
              const isRequester = b.requester_account_id === account.id;
              const isPaid = b.request_type === 'paid';
              const isPast = new Date(b.start_time) < now;

              return (
                <div
                  key={b.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.4)' }}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg border"
                        style={{
                          borderColor: isPaid ? 'rgba(212,165,44,0.3)' : 'rgba(59,130,246,0.3)',
                          background: isPaid ? 'rgba(212,165,44,0.1)' : 'rgba(59,130,246,0.1)',
                        }}
                      >
                        {isPaid ? <DollarSign className="h-4 w-4 text-[#d4a52c]" /> : <MessageSquare className="h-4 w-4 text-blue-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {b.service_name || 'Meeting Request'}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase ${
                            b.booking_status === 'confirmed' ? 'border-green-500/20 bg-green-500/10 text-green-300' :
                            b.booking_status === 'requested' ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300' :
                            b.booking_status === 'declined' || b.booking_status === 'cancelled' ? 'border-red-500/20 bg-red-500/10 text-red-300' :
                            'border-white/10 bg-white/5 text-white/40'
                          }`}>
                            {BOOKING_STATUS_LABELS[b.booking_status] || b.booking_status}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/30">
                          {isProvider ? 'You are the provider' : isRequester ? 'You are the requester' : ''}
                          {isPaid ? ' · Paid booking' : ' · Meeting request'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {isPaid && b.price_credits > 0 && (
                        <div className="flex items-center gap-1 text-sm font-bold text-[#d4a52c]">
                          {formatPrice(b.price_credits)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 flex items-center gap-4 border-t border-[#1a1f25] pt-3 text-xs text-white/50">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(b.start_time)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.duration_minutes} min</span>
                  </div>

                  {/* Message for requests */}
                  {b.message && (
                    <div className="mt-2 rounded-md border border-[#1a1f25] bg-[#0a0c0e] p-2.5 text-xs text-white/50">
                      <span className="font-semibold text-white/60">Message: </span>
                      {b.message}
                      {b.company && <span className="ml-2 text-white/30">({b.company})</span>}
                    </div>
                  )}

                  {/* Reschedule suggestion */}
                  {b.suggested_new_time && (
                    <div className="mt-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2.5 text-xs text-yellow-300/70">
                      <RotateCcw className="mr-1 inline h-3 w-3" />
                      Suggested new time: {formatDateTime(b.suggested_new_time)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Join Session for confirmed bookings */}
                    {b.booking_status === 'confirmed' && !isPast && (
                      <ActionButton
                        icon={Mic} label="Join Session" color="green"
                        loading={false}
                        onClick={() => setActiveSession(b)}
                      />
                    )}
                    {/* Provider actions for requests */}
                    {isProvider && b.booking_status === 'requested' && (
                      <>
                        <ActionButton
                          icon={Check} label="Accept" color="green"
                          loading={actionLoading === b.id}
                          onClick={() => handleAction(b.id, 'confirmed')}
                        />
                        <ActionButton
                          icon={X} label="Decline" color="red"
                          loading={actionLoading === b.id}
                          onClick={() => handleAction(b.id, 'declined')}
                        />
                      </>
                    )}
                    {/* Provider can mark completed */}
                    {isProvider && b.booking_status === 'confirmed' && !isPast && (
                      <ActionButton
                        icon={Check} label="Mark Completed" color="green"
                        loading={actionLoading === b.id}
                        onClick={() => handleAction(b.id, 'completed')}
                      />
                    )}
                    {/* Either party can cancel confirmed */}
                    {(isProvider || isRequester) && (b.booking_status === 'confirmed' || b.booking_status === 'pending') && !isPast && (
                      <ActionButton
                        icon={X} label="Cancel" color="red"
                        loading={actionLoading === b.id}
                        onClick={() => handleAction(b.id, 'cancelled')}
                      />
                    )}
                    {/* Requester can cancel request */}
                    {isRequester && b.booking_status === 'requested' && (
                      <ActionButton
                        icon={X} label="Cancel Request" color="red"
                        loading={actionLoading === b.id}
                        onClick={() => handleAction(b.id, 'cancelled')}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon, label, color, loading, onClick,
}: {
  icon: typeof Check; label: string; color: 'green' | 'red'; loading: boolean; onClick: () => void;
}) {
  const colorClasses = {
    green: 'border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20',
    red: 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-50 ${colorClasses[color]}`}
    >
      <Icon className="h-3 w-3" /> {loading ? '…' : label}
    </button>
  );
}

export function MyBookingsWithErrorBoundary(props: Props) {
  return (
    <ErrorBoundary variant="widget">
      <MyBookings {...props} />
    </ErrorBoundary>
  );
}
