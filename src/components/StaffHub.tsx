import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck, Users, ArrowLeftRight, Handshake,
  Crown, FileText, Calculator, ShoppingBag, CalendarCheck, Award,
  Activity, BarChart3, Image as ImageIcon, Video,
  RefreshCw, MoreHorizontal, ChevronDown, Plus, Ticket,
  Sparkles, Megaphone, Archive, Shield,
} from 'lucide-react';
import { PortalSwitcher } from '@/components/PortalSwitcher';
import { ProfileSettingsHub, type HubTab } from '@/components/player/ProfileSettingsHub';
import { AccountDropdown } from '@/components/AccountDropdown';
import { Bell, Home, Settings as SettingsIcon } from 'lucide-react';
import type { Demo } from '@/useDemo';
import { isFounderUser, type HubId, UniversalView, SpotVaultAccount } from '@/types';
import type { PortalId } from '@/useDemo';

import { UserAccessSection, AssetManagerSection, AccountTrafficSection, BookingProvidersSection } from '@/components/staff/StaffSections';
import { SecurityAccessSection } from '@/components/staff/SecurityAccessSection';
import { IssueManagementSection } from '@/components/staff/IssueManagementSection';
import { CoachApplicationReview } from '@/components/staff/CoachApplicationReview';
import { LiveTransactionHUD, type TransactionHUDHandle } from '@/components/staff/LiveTransactionHUD';
import { AttributionDealsSection } from '@/components/staff/AttributionDealsSection';
import { PortalManagementSection } from '@/components/staff/PortalManagementSection';
import { ListingModerationSection } from '@/components/staff/ListingModerationSection';
import { MediaManagerSection } from '@/components/staff/MediaManagerSection';
import { LegacyActivityTab } from '@/components/staff/LegacyActivityTab';
import { MysteryVaultSection } from '@/components/staff/MysteryVaultSection';
import { AnnouncementsSection } from '@/components/staff/AnnouncementsSection';
import { RecordsBackupsSection } from '@/components/staff/RecordsBackupsSection';
import { ImageVaultSection } from '@/components/staff/ImageVaultSection';
import { STAFF_GLASS_SHELL, STAFF_GLASS_NAV, STAFF_GOLD, STAFF_GOLD_SOFT } from '@/components/staff/staffGlass';

type StaffSectionId =
  | 'users' | 'transactions' | 'access' | 'attribution'
  | 'portals' | 'listing' | 'solver' | 'spots'
  | 'bookings' | 'activity' | 'traffic' | 'assets' | 'media' | 'coaches'
  | 'issues' | 'mystery' | 'announcements' | 'records' | 'security'
  | 'image-vault';

interface ConsoleButton {
  id: StaffSectionId;
  label: string;
  shortLabel: string;
  icon: typeof Users;
  description: string;
}

const PRIMARY_BUTTONS: ConsoleButton[] = [
  { id: 'users', label: 'Users / Login', shortLabel: 'Users', icon: Users, description: 'Who is on SpotVault' },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Transactions', icon: ArrowLeftRight, description: 'Money, credits, payouts' },
  { id: 'issues', label: 'Support / Tickets', shortLabel: 'Support', icon: Ticket, description: 'Support queue and ticket conversations' },
];

// Inline buttons — always visible, placed after primaries
const INLINE_BUTTONS: ConsoleButton[] = [
  { id: 'mystery', label: 'Mystery Vault', shortLabel: 'Vault', icon: Sparkles, description: 'Mystery vault management' },
  { id: 'announcements', label: 'Announcements', shortLabel: 'Posts', icon: Megaphone, description: 'Announcements management' },
  { id: 'records', label: 'Records & Backups', shortLabel: 'Records', icon: Archive, description: 'Automated system records and backups' },
];

const MORE_BUTTONS: ConsoleButton[] = [
  { id: 'security', label: 'Security & Access', shortLabel: 'Security', icon: Shield, description: 'Founder authentication and temporary access' },
  { id: 'attribution', label: 'Attribution & Deals', shortLabel: 'Attribution', icon: Handshake, description: 'Partner attribution' },
  { id: 'portals', label: 'Portals & Codes', shortLabel: 'Portals', icon: Crown, description: 'Portal management' },
  { id: 'coaches', label: 'Coach Applications', shortLabel: 'Coaches', icon: Award, description: 'Review coach applications' },
  { id: 'listing', label: 'Listing Moderation', shortLabel: 'Listings', icon: FileText, description: 'Review listings' },
  { id: 'spots', label: 'Spots', shortLabel: 'Spots', icon: ShoppingBag, description: 'Spot library activity' },
  { id: 'bookings', label: 'Bookings', shortLabel: 'Bookings', icon: CalendarCheck, description: 'Booking providers' },
  { id: 'solver', label: 'Solver', shortLabel: 'Solver', icon: Calculator, description: 'Solver activity' },
  { id: 'activity', label: 'Activity', shortLabel: 'Activity', icon: Activity, description: 'All activity feed' },
  { id: 'traffic', label: 'Traffic', shortLabel: 'Traffic', icon: BarChart3, description: 'Website traffic' },
  { id: 'assets', label: 'Assets', shortLabel: 'Assets', icon: ImageIcon, description: 'Asset manager' },
  { id: 'media', label: 'Media', shortLabel: 'Media', icon: Video, description: 'Media manager' },
  { id: 'image-vault', label: 'Image Vault', shortLabel: 'Images', icon: ImageIcon, description: 'Centralized image inventory and management' },
];

const ALL_MORE_IDS = MORE_BUTTONS.map(b => b.id);
const INLINE_IDS = INLINE_BUTTONS.map(b => b.id);

interface StaffHubProps {
  demo: Demo;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onBack: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  onOpenCustomPortals?: () => void;
}

export function StaffHub({
  demo, onSwitchPortal, portalSwitchOpen,
  onTogglePortalSwitch, onClosePortalSwitch, onBack, onOpenUniversalView, onOpenCustomPortals,
}: StaffHubProps) {
  const [activeSection, setActiveSection] = useState<StaffSectionId>('users');
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');
  const staffAccount = demo.state.currentAccount;
  const txnHudRef = useRef<TransactionHUDHandle>(null);
  const [refreshAllLoading, setRefreshAllLoading] = useState(false);
  const [refreshAllTime, setRefreshAllTime] = useState<Date | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<{ dateFrom: string; dateTo: string; reportId: string; label: string } | null>(null);

  const handleRefreshAll = useCallback(() => {
    setRefreshAllLoading(true);
    txnHudRef.current?.refresh();
    setTimeout(() => {
      setRefreshAllLoading(false);
      setRefreshAllTime(new Date());
    }, 1000);
  }, []);

  if (!staffAccount) return null;

  return (
    <div className="flex w-full flex-col bg-[#050608] md:h-full md:overflow-hidden">
      {/* Unified Staff Console — one glass shell, no sidebar, no separate top bar */}
      <StaffControlConsole
        activeSection={activeSection}
        onSelect={setActiveSection}
        moreOpen={moreOpen}
        onToggleMore={() => setMoreOpen((v) => !v)}
        onRefreshAll={handleRefreshAll}
        refreshAllLoading={refreshAllLoading}
        refreshAllTime={refreshAllTime}
        staffAccount={staffAccount}
        txnHudRef={txnHudRef}
        selectedUserId={selectedUserId}
        onSelectedUserIdChange={setSelectedUserId}
        reportFilter={reportFilter}
        onReportFilterChange={setReportFilter}
        onViewTransactions={(dateFrom, dateTo, reportId, label) => {
          setReportFilter({ dateFrom, dateTo, reportId, label });
          setActiveSection('transactions');
        }}
        // Portal switching embedded directly in the console header
        demo={demo}
        onSwitchPortal={onSwitchPortal}
        portalSwitchOpen={portalSwitchOpen}
        onTogglePortalSwitch={onTogglePortalSwitch}
        onClosePortalSwitch={onClosePortalSwitch}
        onBack={onBack}
        onOpenProfileSettings={(tab) => { setProfileTab(tab); setActiveNav('profile'); }}
      />
    </div>
  );

  function StaffControlConsole(props: {
    activeSection: StaffSectionId;
    onSelect: (id: StaffSectionId) => void;
    moreOpen: boolean;
    onToggleMore: () => void;
    onRefreshAll: () => void;
    refreshAllLoading: boolean;
    refreshAllTime: Date | null;
    staffAccount: SpotVaultAccount;
    txnHudRef: React.RefObject<TransactionHUDHandle>;
    selectedUserId: string | null;
    onSelectedUserIdChange: (userId: string | null) => void;
    reportFilter: { dateFrom: string; dateTo: string; reportId: string; label: string } | null;
    onReportFilterChange: (filter: { dateFrom: string; dateTo: string; reportId: string; label: string } | null) => void;
    onViewTransactions: (dateFrom: string, dateTo: string, reportId: string, label: string) => void;
    demo: Demo;
    onSwitchPortal: (portal: HubId) => void;
    portalSwitchOpen: boolean;
    onTogglePortalSwitch: () => void;
    onClosePortalSwitch: () => void;
    onBack: () => void;
    onOpenProfileSettings: (tab: 'profile' | 'account-security' | 'rewards') => void;
  }) {
    const {
      activeSection, onSelect, moreOpen, onToggleMore, onRefreshAll,
      refreshAllLoading, refreshAllTime, staffAccount, txnHudRef,
      selectedUserId, onSelectedUserIdChange,
      reportFilter, onReportFilterChange, onViewTransactions,
      demo, onSwitchPortal, portalSwitchOpen, onTogglePortalSwitch, onClosePortalSwitch,
      onBack, onOpenProfileSettings,
    } = props;

    const isMoreActive = ALL_MORE_IDS.includes(activeSection);
    const moreBtnRef = useRef<HTMLButtonElement>(null);
    const [morePos, setMorePos] = useState<{ top: number; left: number } | null>(null);

    const handleSelect = (id: StaffSectionId) => {
      onSelect(id);
      if (moreOpen) onToggleMore();
    };

    const updateMorePos = useCallback(() => {
      if (moreOpen && moreBtnRef.current) {
        const rect = moreBtnRef.current.getBoundingClientRect();
        const popupWidth = 240;
        const margin = 8;
        const maxLeft = window.innerWidth - popupWidth - margin;
        const clampedLeft = Math.max(margin, Math.min(rect.left, maxLeft));
        setMorePos({ top: rect.bottom + 4, left: clampedLeft });
      } else {
        setMorePos(null);
      }
    }, [moreOpen]);

    useEffect(() => { updateMorePos(); }, [updateMorePos]);

    useEffect(() => {
      if (!moreOpen) return;
      const handleScroll = () => updateMorePos();
      const handleResize = () => updateMorePos();
      const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggleMore(); };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      window.addEventListener('keydown', handleEscape);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleEscape);
      };
    }, [moreOpen, updateMorePos, onToggleMore]);

    return (
      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3 lg:p-4">
        <div className="flex min-h-0 flex-1 flex-col shadow-2xl md:overflow-hidden"
          style={STAFF_GLASS_SHELL}>

          {/* ── Unified header: console label + nav tabs + portal switcher + actions ── */}
          <div className="flex shrink-0 flex-col border-b border-[#c0911e]/15"
            style={STAFF_GLASS_NAV}>
            {/* Top row: brand label + portal switcher + account controls */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] px-2 py-1.5 sm:px-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] text-white uppercase">Staff Control Console</div>
                  <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Administrative Operations</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Portal switcher — founder only (superuser/developer_admin) */}
                {isFounderUser(staffAccount) && (
                <PortalSwitcher
                  account={staffAccount}
                  currentPortal={demo.state.selectedPortal as PortalId}
                  onSwitch={(portal) => onSwitchPortal(portal as HubId)}
                  open={portalSwitchOpen}
                  onToggle={onTogglePortalSwitch}
                  onClose={onClosePortalSwitch}
                  accent={STAFF_GOLD}
                  align="right"
                  onOpenCustomPortals={onOpenCustomPortals}
                />
                )}
                {/* Notifications */}
                <button type="button" className="hdr-white-btn group relative flex h-7 items-center justify-center overflow-hidden rounded-lg px-2 transition-all" title="Notifications">
                  <Bell className="hdr-white-icon h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                {/* Account dropdown */}
                <div className="hidden sm:flex">
                  <AccountDropdown
                    account={staffAccount}
                    portalLabel="Staff"
                    onMyProfile={() => onOpenProfileSettings('profile')}
                    onBackToHome={onBack}
                    onAccountSecurity={() => onOpenProfileSettings('account-security')}
                    onRewardsProgress={() => onOpenProfileSettings('rewards')}
                  />
                </div>
                {/* Refresh All */}
                <button
                  type="button"
                  onClick={onRefreshAll}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/20"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshAllLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">Refresh All</span>
                </button>
              </div>
            </div>

            {/* Second row: navigation tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-2 sm:gap-2 sm:px-3">
              {/* Three active primary slots */}
              {PRIMARY_BUTTONS.map((btn) => {
                const Icon = btn.icon;
                const active = activeSection === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => handleSelect(btn.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                      active
                        ? 'border-[#d4a52c]/50 bg-[#d4a52c]/15 text-[#f5e6b0]'
                        : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white/80'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{btn.label}</span>
                    <span className="sm:hidden">{btn.shortLabel}</span>
                  </button>
                );
              })}

              {/* Inline buttons: Mystery Vault, Announcements, Records & Backups */}
              {INLINE_BUTTONS.map((btn) => {
                const Icon = btn.icon;
                const active = activeSection === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => handleSelect(btn.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                      active
                        ? 'border-[#d4a52c]/50 bg-[#d4a52c]/15 text-[#f5e6b0]'
                        : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white/80'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{btn.label}</span>
                    <span className="sm:hidden">{btn.shortLabel}</span>
                  </button>
                );
              })}

              {/* More dropdown — button only; menu is portaled to document.body */}
              <div className="relative">
                <button
                  ref={moreBtnRef}
                  type="button"
                  onClick={onToggleMore}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                    isMoreActive || moreOpen
                      ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white/80'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">More</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Portal-rendered MORE dropdown — escapes all stacking contexts and overflow clipping */}
          {moreOpen && morePos && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={onToggleMore} />
              <div
                className="fixed z-[9999] w-60 max-h-[70vh] overflow-y-auto rounded-lg border border-[#c0911e]/20 p-1.5 shadow-2xl backdrop-blur-md"
                style={{ top: morePos.top, left: morePos.left, background: 'linear-gradient(135deg, rgba(22,17,12,0.92), rgba(10,10,12,0.95))', boxShadow: '0 8px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,224,166,0.06)' }}
              >
                <div className="mb-1 px-2 py-1 text-[8px] font-bold tracking-widest text-white/30 uppercase">
                  All Tools
                </div>
                {MORE_BUTTONS.map((btn) => {
                  const Icon = btn.icon;
                  const active = activeSection === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => handleSelect(btn.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-[#d4a52c]/15 text-[#f5e6b0]'
                          : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )}

          {/* ── Active module content — dark glass surface ── */}
          <div className="min-h-0 flex-1 md:overflow-hidden"
            style={{ background: 'rgba(8,7,6,0.40)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <StaffContent
              section={activeSection}
              staffAccount={staffAccount}
              txnHudRef={txnHudRef}
              selectedUserId={selectedUserId}
              onSelectedUserIdChange={onSelectedUserIdChange}
              reportFilter={reportFilter}
              onReportFilterChange={onReportFilterChange}
              onViewTransactions={onViewTransactions}
            />
          </div>
        </div>
      </div>
    );
  }
}

function formatPeriodLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', hour12: false });
  return `${fmt.format(s)}–${fmt.format(e)}`;
}

function StaffContent({
  section,
  staffAccount,
  txnHudRef,
  selectedUserId,
  onSelectedUserIdChange,
  reportFilter,
  onReportFilterChange,
  onViewTransactions,
}: {
  section: StaffSectionId;
  staffAccount: SpotVaultAccount;
  txnHudRef: React.RefObject<TransactionHUDHandle>;
  selectedUserId: string | null;
  onSelectedUserIdChange: (userId: string | null) => void;
  reportFilter: { dateFrom: string; dateTo: string; reportId: string; label: string } | null;
  onReportFilterChange: (filter: { dateFrom: string; dateTo: string; reportId: string; label: string } | null) => void;
  onViewTransactions: (dateFrom: string, dateTo: string, reportId: string, label: string) => void;
}) {
  switch (section) {
    case 'users':
      return (
        <div className="min-h-0 flex-1 md:overflow-hidden">
          <UserAccessSection onSelectedUserIdChange={onSelectedUserIdChange} />
        </div>
      );
    case 'transactions':
      return (
        <div className="md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden">
          <LiveTransactionHUD
            ref={txnHudRef}
            reportDateFrom={reportFilter?.dateFrom}
            reportDateTo={reportFilter?.dateTo}
            reportId={reportFilter?.reportId}
            reportLabel={reportFilter?.label}
            onClearReportFilter={() => onReportFilterChange(null)}
          />
        </div>
      );
    case 'attribution':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <AttributionDealsSection />
        </div>
      );
    case 'portals':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <PortalManagementSection />
        </div>
      );
    case 'listing':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <ListingModerationSection staffAccount={staffAccount} />
        </div>
      );
    case 'solver':
      return (
        <div className="md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden">
          <LegacyActivityTab filter="solver" />
        </div>
      );
    case 'spots':
      return (
        <div className="md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden">
          <LegacyActivityTab filter="spot_library" />
        </div>
      );
    case 'bookings':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <BookingProvidersSection staffAccount={staffAccount} />
        </div>
      );
    case 'activity':
      return (
        <div className="md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden">
          <LegacyActivityTab filter="all" />
        </div>
      );
    case 'traffic':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <AccountTrafficSection />
        </div>
      );
    case 'assets':
      return <AssetManagerSection staffAccount={staffAccount} />;
    case 'media':
      return <MediaManagerSection staffAccountId={staffAccount.id} />;
    case 'coaches':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
          <CoachApplicationReview />
        </div>
      );
    case 'issues':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <IssueManagementSection staffAccount={staffAccount} />
        </div>
      );
    case 'mystery':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <MysteryVaultSection />
        </div>
      );
    case 'announcements':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <AnnouncementsSection />
        </div>
      );
    case 'records':
      return <RecordsBackupsSection onViewTransactions={(dateFrom, dateTo, reportId) => onViewTransactions(dateFrom, dateTo, reportId, formatPeriodLabel(dateFrom, dateTo))} />;
    case 'security':
      return (
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <SecurityAccessSection staffAccount={staffAccount} />
        </div>
      );
    case 'image-vault':
      return <ImageVaultSection staffAccountId={staffAccount.id} />;
    default:
      return null;
  }
}
