import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Clock, DollarSign, TrendingUp, Check, X,
  Video, MessageSquare, BarChart3, Star,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import {
  type Booking, type BookingProvider, type BookingService,
  fetchBookingsForUser, fetchProviderByAccountId,
  fetchServicesByProvider, fetchTimeSlotsByProvider,
  updateBookingStatus,
  BOOKING_STATUS_LABELS, formatPrice, formatDateTime,
} from '@/lib/booking';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  account: SpotVaultAccount;
}

export function ProviderDashboard({ account }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [provider, setProvider] = useState<BookingProvider | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [bks, prov] = await Promise.all([
      fetchBookingsForUser(account.id),
      fetchProviderByAccountId(account.id),
    ]);
    setBookings(bks);
    setProvider(prov);
    if (prov) {
      const [svcs] = await Promise.all([fetchServicesByProvider(prov.id)]);
      setServices(svcs);
    }
    setLoading(false);
  }, [account.id]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const providerBookings = bookings.filter((b) => b.provider_account_id === account.id);

  const upcoming = providerBookings
    .filter((b) => new Date(b.start_time) >= now && (b.booking_status === 'confirmed' || b.booking_status === 'pending'))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pendingRequests = providerBookings.filter((b) => b.booking_status === 'requested');
  const completed = providerBookings.filter((b) => b.booking_status === 'completed');
  const cancelled = providerBookings.filter((b) => b.booking_status === 'cancelled' || b.booking_status === 'declined');

  const earnings = useMemo(() => {
    const total = completed.reduce((sum, b) => sum + b.provider_payout_credits, 0);
    const pending = upcoming.filter((b) => b.request_type === 'paid').reduce((sum, b) => sum + b.provider_payout_credits, 0);
    return { total, pending };
  }, [completed, upcoming]);

  const handleAction = async (bookingId: string, status: Booking['booking_status']) => {
    setActionLoading(bookingId);
    await updateBookingStatus(bookingId, status as any);
    setActionLoading(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-white/30">Loading dashboard…</div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <BarChart3 className="h-10 w-10 text-white/10" strokeWidth={1} />
        <div>
          <h3 className="text-sm font-bold text-white">No Provider Profile</h3>
          <p className="mt-1 text-xs text-white/40">
            You need to set up your availability first to access the booking dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Booking Dashboard</h2>
          <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/60 uppercase">
            Provider Overview · {provider.display_name}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} color="#d4a52c" />
          <StatCard icon={MessageSquare} label="Pending Requests" value={pendingRequests.length} color="#facc15" />
          <StatCard icon={Check} label="Completed" value={completed.length} color="#34d399" />
          <StatCard icon={DollarSign} label="Earnings" value={earnings.total} color="#d4a52c" suffix=" credits" />
        </div>

        {/* Pending Requests */}
        <div>
          <h3 className="mb-3 text-xs font-bold tracking-widest text-white/50 uppercase">Pending Requests</h3>
          {pendingRequests.length === 0 ? (
            <EmptyRow text="No pending requests." />
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((b) => (
                <BookingRow key={b.id} booking={b} isProvider loading={actionLoading === b.id}
                  onAccept={() => handleAction(b.id, 'confirmed')}
                  onDecline={() => handleAction(b.id, 'declined')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Sessions */}
        <div>
          <h3 className="mb-3 text-xs font-bold tracking-widest text-white/50 uppercase">Upcoming Sessions</h3>
          {upcoming.length === 0 ? (
            <EmptyRow text="No upcoming sessions." />
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => (
                <BookingRow key={b.id} booking={b} isProvider loading={actionLoading === b.id}
                  onComplete={() => handleAction(b.id, 'completed')}
                  onCancel={() => handleAction(b.id, 'cancelled')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Completed */}
        <div>
          <h3 className="mb-3 text-xs font-bold tracking-widest text-white/50 uppercase">Completed Sessions</h3>
          {completed.length === 0 ? (
            <EmptyRow text="No completed sessions yet." />
          ) : (
            <div className="space-y-2">
              {completed.slice(0, 10).map((b) => (
                <BookingRow key={b.id} booking={b} isProvider loading={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, suffix }: { icon: typeof Calendar; label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.4)' }}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color }} strokeWidth={1.5} />
        <span className="text-[10px] font-bold tracking-wider text-white/40 uppercase">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold" style={{ color }}>
        {value.toLocaleString()}{suffix || ''}
      </div>
    </div>
  );
}

function BookingRow({
  booking, isProvider, loading, onAccept, onDecline, onComplete, onCancel,
}: {
  booking: Booking; isProvider: boolean; loading: boolean;
  onAccept?: () => void; onDecline?: () => void; onComplete?: () => void; onCancel?: () => void;
}) {
  const isPaid = booking.request_type === 'paid';
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.3)' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{
            borderColor: isPaid ? 'rgba(212,165,44,0.3)' : 'rgba(59,130,246,0.3)',
            background: isPaid ? 'rgba(212,165,44,0.1)' : 'rgba(59,130,246,0.1)',
          }}>
            {isPaid ? <DollarSign className="h-3.5 w-3.5 text-[#d4a52c]" /> : <MessageSquare className="h-3.5 w-3.5 text-blue-400" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{booking.service_name || 'Meeting Request'}</div>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] text-white/40">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(booking.start_time)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.duration_minutes}m</span>
            </div>
            {booking.message && <p className="mt-1 text-[10px] text-white/30">{booking.message}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPaid && booking.price_credits > 0 && (
            <span className="text-xs font-bold text-[#d4a52c]">{formatPrice(booking.price_credits)}</span>
          )}
        </div>
      </div>
      {(onAccept || onDecline || onComplete || onCancel) && (
        <div className="mt-2.5 flex flex-wrap gap-2 border-t border-[#1a1f25] pt-2.5">
          {onAccept && (
            <button onClick={onAccept} disabled={loading}
              className="flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-green-300 uppercase transition-all hover:bg-green-500/20 disabled:opacity-50">
              <Check className="h-3 w-3" /> Accept
            </button>
          )}
          {onDecline && (
            <button onClick={onDecline} disabled={loading}
              className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-red-300 uppercase transition-all hover:bg-red-500/20 disabled:opacity-50">
              <X className="h-3 w-3" /> Decline
            </button>
          )}
          {onComplete && (
            <button onClick={onComplete} disabled={loading}
              className="flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-green-300 uppercase transition-all hover:bg-green-500/20 disabled:opacity-50">
              <Check className="h-3 w-3" /> Complete
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} disabled={loading}
              className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-red-300 uppercase transition-all hover:bg-red-500/20 disabled:opacity-50">
              <X className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="py-4 text-center text-xs text-white/20">{text}</div>;
}

export function ProviderDashboardWithErrorBoundary(props: Props) {
  return (
    <ErrorBoundary variant="widget">
      <ProviderDashboard {...props} />
    </ErrorBoundary>
  );
}
