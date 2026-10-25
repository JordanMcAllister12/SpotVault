import { useState, useEffect } from 'react';
import { Calendar, Briefcase, LayoutDashboard, Clock, ShieldCheck, Lock } from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import { type BookingProvider, type Booking, checkProviderApproval } from '@/lib/booking';
import { CommunityAvailability } from '@/components/booking/CommunityAvailability';
import { UniversalBookingFlow } from '@/components/booking/UniversalBookingFlow';
import { MyBookings } from '@/components/booking/MyBookings';
import { ProviderAvailabilityPanel } from '@/components/booking/ProviderAvailabilityPanel';
import { ProviderDashboard } from '@/components/booking/ProviderDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type View = 'marketplace' | 'my-bookings' | 'my-availability' | 'provider-dashboard';

interface Props {
  account: SpotVaultAccount;
}

export function BookingMarketplace({ account }: Props) {
  const [view, setView] = useState<View>('marketplace');
  const [bookingProvider, setBookingProvider] = useState<BookingProvider | null>(null);
  const [bookingFlowOpen, setBookingFlowOpen] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);

  useEffect(() => {
    checkProviderApproval(account.id).then((approved) => {
      setIsApproved(approved);
      setApprovalChecked(true);
    });
  }, [account.id]);

  const navItems: { value: View; label: string; icon: typeof Calendar; requiresApproval: boolean }[] = [
    { value: 'marketplace', label: 'Marketplace', icon: Calendar, requiresApproval: false },
    { value: 'my-bookings', label: 'My Bookings', icon: Clock, requiresApproval: false },
    { value: 'my-availability', label: 'My Availability', icon: Briefcase, requiresApproval: true },
    { value: 'provider-dashboard', label: 'Provider Dashboard', icon: LayoutDashboard, requiresApproval: true },
  ];

  const handleBookProvider = (provider: BookingProvider) => {
    setBookingProvider(provider);
    setBookingFlowOpen(true);
  };

  const handleBookingConfirmed = (_booking: Booking) => {
    // Stay on done screen; user clicks Done to close
  };

  const handleCloseBookingFlow = () => {
    setBookingFlowOpen(false);
    setBookingProvider(null);
  };

  if (bookingFlowOpen && bookingProvider) {
    return (
      <ErrorBoundary variant="widget">
        <UniversalBookingFlow
          provider={bookingProvider}
          account={account}
          onConfirmed={handleBookingConfirmed}
          onCancel={handleCloseBookingFlow}
        />
      </ErrorBoundary>
    );
  }

  return (
    <PortalWorkspaceShell maxWidth="max-w-5xl">
    <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-6">
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#c0911e]/15 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] md:w-[90%] md:h-[88vh] lg:w-[78%] lg:max-w-[1200px] lg:h-[78vh] lg:max-h-[760px]">
      {/* Nav bar */}
      <div className="shrink-0 flex items-center gap-1.5 border-b border-[#1a1f25] px-4 py-2.5 rounded-t-xl" style={{ background: 'rgba(8,10,12,0.92)', backdropFilter: 'blur(12px)' }}>
        {navItems.map((item) => {
          const locked = item.requiresApproval && !isApproved;
          return (
            <button
              key={item.value}
              onClick={() => !locked && setView(item.value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${
                view === item.value
                  ? 'bg-[#c0911e]/15 text-[#f5e6b0]'
                  : locked
                  ? 'cursor-not-allowed text-white/25'
                  : 'text-white/55 hover:text-white/80 hover:bg-white/5'
              }`}
              title={locked ? 'Staff approval required' : undefined}
            >
              {locked ? <Lock className="h-3 w-3" strokeWidth={1.5} /> : <item.icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
              {item.label}
            </button>
          );
        })}
        {isApproved && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 py-1">
            <ShieldCheck className="h-3 w-3 text-[#d4a52c]" strokeWidth={1.5} />
            <span className="text-[9px] font-bold tracking-wider text-[#d4a52c] uppercase">Approved Provider</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary variant="widget">
          {view === 'marketplace' && (
            <CommunityAvailability account={account} onBookProvider={handleBookProvider} />
          )}
          {view === 'my-bookings' && <MyBookings account={account} />}
          {view === 'my-availability' && isApproved && <ProviderAvailabilityPanel account={account} />}
          {view === 'provider-dashboard' && isApproved && <ProviderDashboard account={account} />}
          {/* If user somehow lands on a gated view without approval, show locked message */}
          {(view === 'my-availability' || view === 'provider-dashboard') && !isApproved && approvalChecked && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Lock className="h-8 w-8 text-white/10" strokeWidth={1} />
              <div>
                <h3 className="text-sm font-bold text-white">Staff Approval Required</h3>
                <p className="mt-1 text-xs text-white/40">
                  You need staff approval to offer your time as a booking provider.
                  Contact SpotVault staff to get enabled.
                </p>
              </div>
            </div>
          )}
          {!approvalChecked && (
            <div className="flex h-full items-center justify-center">
              <div className="text-xs text-white/30">Loading...</div>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
    </div>
    </PortalWorkspaceShell>
  );
}
