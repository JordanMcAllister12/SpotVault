import { Calendar } from 'lucide-react';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

export function BookingComingSoon() {
  return (
    <PortalWorkspaceShell maxWidth="max-w-5xl">
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl border"
          style={{ borderColor: BORDER, background: `${GOLD}10` }}
        >
          <Calendar className="h-9 w-9" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>

        <div className="mt-6">
          <p
            className="text-[10px] font-mono tracking-[0.3em] uppercase"
            style={{ color: GOLD }}
          >
            Bookings
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Coming Soon</h2>
        </div>

        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/40">
          Book coaching sessions, connect with poker professionals, and manage your appointments — all within SpotVault.
        </p>

        <div
          className="mt-8 rounded-xl border px-6 py-4"
          style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.04)' }}
        >
          <p className="text-[11px] font-semibold text-white/50">
            Booking tools are currently in development and will be available soon.
          </p>
        </div>
      </div>
    </PortalWorkspaceShell>
  );
}
