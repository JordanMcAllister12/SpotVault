import { useState } from 'react';
import {
  Trophy, LayoutDashboard, Calendar, MessageSquare, DollarSign,
  Star, Settings, ArrowLeft, ShieldCheck, Zap, Clock, TrendingUp,
  ChevronRight, Plus, Lock, Video, Users,
} from 'lucide-react';
import { PortalSwitcher } from '@/components/PortalSwitcher';
import { BookAPro } from '@/components/booking/BookAPro';
import { TalentProfileView } from '@/components/booking/TalentProfileView';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { SessionRoom } from '@/components/booking/SessionRoom';
import {
  TALENT_PROFILES, DEMO_BOOKINGS, TALENT_SERVICES, TALENT_REVIEWS,
  calculateEarnings, SERVICE_TYPE_LABELS,
  type TalentProfile, type TalentService, type Booking,
} from '@/data/talent';
import type { SpotVaultAccount, HubId } from '@/types';
import { isFounderUser } from '@/types';
import type { PortalId } from '@/useDemo';
import { UniversalNavSection } from '@/components/UniversalNavSection';
import type { UniversalView } from '@/components/UniversalRail';

type View = 'marketplace' | 'profile' | 'booking' | 'confirmation' | 'session';
type DashboardTab = 'overview' | 'bookings' | 'calendar' | 'messages' | 'services' | 'earnings' | 'reviews' | 'profile' | 'settings';

interface Props {
  onBack: () => void;
  onOpenCredits: () => void;
  account: SpotVaultAccount | null;
  currentPortal: PortalId;
  onSwitchPortal: (portal: PortalId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
}

export function ProTalentHub({
  onBack, onOpenCredits, account, currentPortal, onSwitchPortal,
  portalSwitchOpen, onTogglePortalSwitch, onClosePortalSwitch,
  onOpenUniversalView,
}: Props) {
  const [view, setView] = useState<View>('marketplace');
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [selectedService, setSelectedService] = useState<TalentService | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [showDashboard, setShowDashboard] = useState(false);

  const handleSelectTalent = (talent: TalentProfile) => {
    setSelectedTalent(talent);
    setView('profile');
  };

  const handleBook = (service: TalentService) => {
    setSelectedService(service);
    setView('booking');
  };

  const handleConfirmBooking = (details: { date: string; timeStart: string; timeEnd: string }) => {
    if (!selectedTalent || !selectedService) return;
    const earnings = calculateEarnings(selectedService.priceCredits);
    const booking: Booking = {
      id: `b${Date.now()}`,
      talentId: selectedTalent.id,
      talentName: selectedTalent.name,
      buyerName: account?.username ?? 'You',
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      serviceDuration: selectedService.durationMinutes,
      priceCredits: selectedService.priceCredits,
      platformFeeCredits: earnings.fee,
      talentEarningsCredits: earnings.earnings,
      date: details.date,
      timeStart: details.timeStart,
      timeEnd: details.timeEnd,
      status: 'BOOKED',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setConfirmedBooking(booking);
    setView('confirmation');
  };

  const handleOpenRoom = () => {
    if (confirmedBooking && selectedTalent) setView('session');
  };

  const handleBackToMarketplace = () => {
    setView('marketplace');
    setSelectedTalent(null);
    setSelectedService(null);
    setConfirmedBooking(null);
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#050608]">
      {/* Header — only on marketplace view */}
      {view === 'marketplace' && !showDashboard && (
        <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Network
            </button>
            <div className="flex items-center gap-2.5">
              <Trophy className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">Pro / Talent Portal</h1>
                <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">VIP Access to the Poker World</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDashboard(true)}
              className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Talent Dashboard
            </button>
            {isFounderUser(account) && (
            <PortalSwitcher
              account={account}
              currentPortal={currentPortal}
              onSwitch={onSwitchPortal}
              open={portalSwitchOpen}
              onToggle={onTogglePortalSwitch}
              onClose={onClosePortalSwitch}
              accent="#d4a52c"
              align="right"
            />
            )}
          </div>
        </header>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {view === 'marketplace' && !showDashboard && (
          <BookAPro onSelectTalent={handleSelectTalent} onBack={onBack} />
        )}

        {view === 'profile' && selectedTalent && (
          <TalentProfileView
            talent={selectedTalent}
            onBook={handleBook}
            onMessage={() => {}}
            onBack={() => setView('marketplace')}
          />
        )}

        {view === 'booking' && selectedTalent && selectedService && (
          <BookingFlow
            talent={selectedTalent}
            service={selectedService}
            onConfirm={handleConfirmBooking}
            onCancel={() => setView('profile')}
          />
        )}

        {view === 'confirmation' && confirmedBooking && selectedTalent && (
          <BookingConfirmation
            booking={confirmedBooking}
            talent={selectedTalent}
            onOpenRoom={handleOpenRoom}
            onBackToMarketplace={handleBackToMarketplace}
          />
        )}

        {view === 'session' && confirmedBooking && selectedTalent && (
          <SessionRoom
            booking={confirmedBooking}
            talent={selectedTalent}
            onBack={handleBackToMarketplace}
          />
        )}

        {showDashboard && (
          <TalentDashboard
            tab={dashboardTab}
            onTab={setDashboardTab}
            onExit={() => setShowDashboard(false)}
            onOpenCredits={onOpenCredits}
            account={account}
            currentPortal={currentPortal}
            onSwitchPortal={onSwitchPortal}
            portalSwitchOpen={portalSwitchOpen}
            onTogglePortalSwitch={onTogglePortalSwitch}
            onClosePortalSwitch={onClosePortalSwitch}
            onOpenUniversalView={onOpenUniversalView}
          />
        )}
      </div>
    </div>
  );
}

// ===== TALENT DASHBOARD =====

const DASHBOARD_TABS: { id: DashboardTab; label: string; icon: typeof Trophy }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'calendar', label: 'Calendar', icon: Clock },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'services', label: 'Services', icon: DollarSign },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'profile', label: 'Profile', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function TalentDashboard({
  tab, onTab, onExit, onOpenCredits, account, currentPortal, onSwitchPortal,
  portalSwitchOpen, onTogglePortalSwitch, onClosePortalSwitch, onOpenUniversalView,
}: {
  tab: DashboardTab;
  onTab: (t: DashboardTab) => void;
  onExit: () => void;
  onOpenCredits: () => void;
  account: SpotVaultAccount | null;
  currentPortal: PortalId;
  onSwitchPortal: (p: PortalId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
}) {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#1a1f25] bg-[#0a0c0e]/60">
        <div className="flex shrink-0 items-center gap-2 border-b border-[#1a1f25] px-4 py-4">
          <Trophy className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <div className="text-[10px] font-mono tracking-widest text-[#d4a52c]/70 uppercase">Talent Dashboard</div>
            <div className="text-xs font-bold text-white">{TALENT_PROFILES[0].name}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {DASHBOARD_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold tracking-wide transition-all ${
                tab === t.id
                  ? 'border-l-2 border-[#d4a52c] bg-[#c0911e]/10 text-[#d4a52c]'
                  : 'border-l-2 border-transparent text-[#5f6e7c] hover:bg-[#11151a]/50 hover:text-[#aab6c2]'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {t.label}
            </button>
          ))}
        </nav>
        <UniversalNavSection onNavigate={onOpenUniversalView} />
        <div className="shrink-0 border-t border-[#1a1f25] p-3">
          <button
            onClick={onExit}
            className="flex w-full items-center gap-2 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Marketplace
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-6 py-3">
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">{DASHBOARD_TABS.find((t) => t.id === tab)?.label}</h2>
          {isFounderUser(account) && (
          <PortalSwitcher
            account={account}
            currentPortal={currentPortal}
            onSwitch={onSwitchPortal}
            open={portalSwitchOpen}
            onToggle={onTogglePortalSwitch}
            onClose={onClosePortalSwitch}
            accent="#d4a52c"
            align="right"
          />
          )}
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            {tab === 'overview' && <OverviewTab onOpenCredits={onOpenCredits} />}
            {tab === 'bookings' && <BookingsTab />}
            {tab === 'calendar' && <CalendarTab />}
            {tab === 'messages' && <MessagesTab />}
            {tab === 'services' && <ServicesTab />}
            {tab === 'earnings' && <EarningsTab />}
            {tab === 'reviews' && <ReviewsTab />}
            {tab === 'profile' && <ProfileTab />}
            {tab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ onOpenCredits }: { onOpenCredits: () => void }) {
  return (
    <div className="space-y-5">
      {/* This month stats */}
      <div>
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">This Month</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Sessions" value="12" sub="this month" />
          <MetricCard label="Gross Bookings" value="$8,450" sub="credits" />
          <MetricCard label="Talent Earnings" value="$6,760" sub="after 20% fee" gold />
          <MetricCard label="Rating" value="4.9★" sub="94% response" />
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Upcoming</h3>
        <div className="space-y-2">
          {DEMO_BOOKINGS.filter((b) => b.status === 'BOOKED').map((booking) => (
            <div key={booking.id} className="metal-panel flex items-center justify-between rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-xs font-bold text-[#d4a52c]">
                  {TALENT_PROFILES.find((t) => t.id === booking.talentId)?.photoInitials ?? '?'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{booking.serviceName}</div>
                  <div className="text-xs text-[#5f6e7c]">{booking.date} · {booking.timeStart} · {booking.buyerName}</div>
                </div>
              </div>
              <button className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow">
                <Video className="h-3 w-3" /> Open Room
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
          <div className="flex items-center gap-2 text-[#5f6e7c]">
            <Clock className="h-3.5 w-3.5" /> <span className="text-[10px] font-mono tracking-widest uppercase">Response Rate</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-white">94%</div>
        </div>
        <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
          <div className="flex items-center gap-2 text-[#5f6e7c]">
            <Users className="h-3.5 w-3.5" /> <span className="text-[10px] font-mono tracking-widest uppercase">Total Clients</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-white">87</div>
        </div>
        <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
          <div className="flex items-center gap-2 text-[#5f6e7c]">
            <Star className="h-3.5 w-3.5" /> <span className="text-[10px] font-mono tracking-widest uppercase">Avg Rating</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#d4a52c]">4.9</div>
        </div>
      </div>
    </div>
  );
}

function BookingsTab() {
  return (
    <div className="space-y-3">
      {DEMO_BOOKINGS.map((b) => (
        <div key={b.id} className="metal-panel flex items-center justify-between rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#232a32] bg-[#161b21] text-xs font-bold text-[#aab6c2]">
              {b.buyerName.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{b.serviceName}</div>
              <div className="text-xs text-[#5f6e7c]">{b.buyerName} · {b.date} · {b.timeStart}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#d4a52c]">{b.priceCredits} cr</span>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase ${
              b.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-300' :
              b.status === 'BOOKED' ? 'bg-[#d4a52c]/15 text-[#d4a52c]' :
              'bg-[#232a32] text-[#5f6e7c]'
            }`}>{b.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarTab() {
  const talent = TALENT_PROFILES[0];
  return (
    <div className="space-y-5">
      <div className="metal-panel rounded-xl p-5">
        <h3 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Availability Settings</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <SettingField label="Timezone" value={talent.timezone} />
          <SettingField label="Available Days" value={talent.availableDays.join(', ')} />
          <SettingField label="Hours" value={`${talent.availableHours.start}–${talent.availableHours.end}`} />
          <SettingField label="Min Notice" value={`${talent.minNoticeHours}h`} />
          <SettingField label="Buffer" value={`${talent.bufferMinutes} min`} />
          <SettingField label="Max Daily" value={`${talent.maxDailyBookings} bookings`} />
        </div>
      </div>
      <div className="metal-panel rounded-xl p-5">
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Vacation / Unavailable Dates</h3>
        <p className="text-xs text-[#5f6e7c]">No vacation dates set. External calendar integrations can be added later.</p>
      </div>
    </div>
  );
}

function MessagesTab() {
  return (
    <div className="space-y-2">
      {[
        { name: 'Jordan M.', preview: 'Looking forward to our session!', time: '10:32 AM', unread: true },
        { name: 'Alex K.', preview: 'Thanks for the HH review', time: 'Yesterday', unread: false },
        { name: 'Sam R.', preview: 'Can we reschedule?', time: '2 days ago', unread: false },
      ].map((msg) => (
        <div key={msg.name} className="metal-panel flex items-center justify-between rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-xs font-bold text-[#aab6c2]">{msg.name.charAt(0)}</div>
            <div>
              <div className="text-sm font-semibold text-white">{msg.name}</div>
              <div className="text-xs text-[#5f6e7c]">{msg.preview}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {msg.unread && <span className="h-2 w-2 rounded-full bg-[#d4a52c]" />}
            <span className="text-[10px] text-[#5f6e7c]">{msg.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ServicesTab() {
  const services = TALENT_SERVICES.filter((s) => s.talentId === TALENT_PROFILES[0].id);
  return (
    <div className="space-y-3">
      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow">
        <Plus className="h-4 w-4" /> Create New Service
      </button>
      {services.map((s) => (
        <div key={s.id} className="metal-panel flex items-center justify-between rounded-xl p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{s.name}</span>
              <span className="rounded border border-[#232a32] bg-[#11151a] px-2 py-0.5 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{SERVICE_TYPE_LABELS[s.type]}</span>
            </div>
            <div className="mt-0.5 text-xs text-[#5f6e7c]">{s.durationMinutes > 0 ? `${s.durationMinutes} min` : 'Async'} · Max {s.maxPerDay}/day</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm font-bold text-[#d4a52c]"><Zap className="h-3 w-3" /> {s.priceCredits}</span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${s.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-[#232a32] text-[#5f6e7c]'}`}>
              {s.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EarningsTab() {
  const completed = DEMO_BOOKINGS.filter((b) => b.status === 'COMPLETED');
  const gross = completed.reduce((sum, b) => sum + b.priceCredits, 0);
  const fees = completed.reduce((sum, b) => sum + b.platformFeeCredits, 0);
  const net = completed.reduce((sum, b) => sum + b.talentEarningsCredits, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Gross Bookings" value={`${gross}`} sub="credits" />
        <MetricCard label="SpotVault Fee (20%)" value={`${fees}`} sub="credits" />
        <MetricCard label="Your Earnings" value={`${net}`} sub="credits" gold />
      </div>
      <div className="metal-panel rounded-xl p-5">
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Transaction History</h3>
        <div className="space-y-2">
          {completed.map((b) => (
            <div key={b.id} className="flex items-center justify-between border-b border-[#1a1f25] pb-2 last:border-0">
              <div>
                <div className="text-sm text-white">{b.serviceName}</div>
                <div className="text-xs text-[#5f6e7c]">{b.buyerName} · {b.date}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm font-bold text-[#d4a52c]"><Zap className="h-3 w-3" /> {b.talentEarningsCredits}</div>
                <div className="text-[10px] text-[#5f6e7c]">of {b.priceCredits} (fee: {b.platformFeeCredits})</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[#c0911e]/20 bg-gradient-to-r from-[#c0911e]/8 to-transparent p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#d4a52c]" />
          <span className="text-xs font-semibold tracking-widest text-[#f5e6b0] uppercase">Payout Eligible</span>
        </div>
        <p className="mt-1 text-xs text-[#5f6e7c]">Completed sessions become payout eligible after 48 hours. Payouts processed via existing marketplace ledger.</p>
      </div>
    </div>
  );
}

function ReviewsTab() {
  const reviews = TALENT_REVIEWS.filter((r) => r.talentId === TALENT_PROFILES[0].id);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-xl border border-[#232a32] bg-[#11151a]/50 p-4">
        <div className="text-3xl font-bold text-[#d4a52c]">4.9</div>
        <div>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map((i) => <Star key={i} className="h-4 w-4 text-[#d4a52c]" fill="currentColor" />)}
          </div>
          <p className="mt-0.5 text-xs text-[#5f6e7c]">127 verified sessions</p>
        </div>
      </div>
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-xs font-bold text-[#aab6c2]">{r.authorName.charAt(0)}</div>
              <div>
                <div className="text-sm font-semibold text-white">{r.authorName}</div>
                <div className="text-[10px] text-[#5f6e7c]">{r.date}</div>
              </div>
            </div>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? 'text-[#d4a52c]' : 'text-[#2a323b]'}`} fill="currentColor" />)}
            </div>
          </div>
          <p className="mt-2 text-sm text-[#c7cfd8]">{r.comment}</p>
        </div>
      ))}
    </div>
  );
}

function ProfileTab() {
  const talent = TALENT_PROFILES[0];
  return (
    <div className="space-y-5">
      <div className="metal-panel rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-xl font-bold text-[#d4a52c]">{talent.photoInitials}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{talent.name}</h3>
              <ShieldCheck className="h-4 w-4 text-[#d4a52c]" />
            </div>
            <p className="text-sm text-[#5f6e7c]">{talent.title}</p>
          </div>
        </div>
      </div>
      <div className="metal-panel rounded-xl p-5">
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Profile Settings</h3>
        <div className="space-y-3">
          <SettingField label="Bio" value={talent.bio} />
          <SettingField label="Specialties" value={talent.specialties.join(', ')} />
          <SettingField label="Game Types" value={talent.gameTypes.join(', ')} />
          <SettingField label="Response Time" value={`${talent.responseTimeHours} hours`} />
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-5">
      <div className="metal-panel rounded-xl p-5">
        <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Talent Settings</h3>
        <div className="space-y-3">
          <SettingField label="Post-Session Chat" value="7 days after completion" />
          <SettingField label="Cancellation Policy" value="24 hours notice required" />
          <SettingField label="Booking Lead Time" value="12 hours minimum" />
          <SettingField label="Payout Method" value="SpotVault Credits Ledger" />
        </div>
      </div>
      <div className="rounded-xl border border-[#c0911e]/20 bg-gradient-to-r from-[#c0911e]/8 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#d4a52c]" />
          <span className="text-xs font-semibold tracking-widest text-[#f5e6b0] uppercase">Verified Talent</span>
        </div>
        <p className="mt-1 text-xs text-[#5f6e7c]">Your account has been approved for Pro / Talent Portal. Admin controls are available to SpotVault superusers.</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, gold }: { label: string; value: string; sub: string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
      <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${gold ? 'text-[#d4a52c]' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-[#5f6e7c]">{sub}</div>
    </div>
  );
}

function SettingField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#1a1f25] bg-[#11151a]/40 px-3 py-2.5">
      <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</span>
      <span className="text-sm text-[#aab6c2]">{value}</span>
    </div>
  );
}
