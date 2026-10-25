import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingUp,
  Users,
  Calendar,
  Bookmark,
  MessageSquare,
  BookOpen,
  Bell,
  ShieldCheck,
  Zap,
  Building2,
  Presentation,
  MapPin,
  Clock,
  Inbox,
  UserCheck,
  Filter,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import { ProfileSettingsHub, type HubTab } from '@/components/player/ProfileSettingsHub';
import { PortalChat, type PortalMember, type ChannelDef } from '@/components/PortalChat';
import { INVESTOR_NAV } from '@/data/portalConfigs';
import type { Demo, PortalId } from '@/useDemo';
import type { HubId } from '@/types';
import type { UniversalView } from '@/components/UniversalRail';
import { OpportunitiesPage } from '@/components/OpportunitiesPage';
import { Store } from '@/components/Store';
import { PeopleDirectory } from '@/components/people/PeopleDirectory';
import { PrivacyPolicyPage } from '@/components/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/TermsOfServicePage';

interface Props {
  demo: Demo;
  onInnerCircle: () => void;
  onExitHub: () => void;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onPortalChatActiveChange?: (active: boolean) => void;
  portalChatActive: boolean;
  onOpenUniversalView: (view: UniversalView) => void;
}

const SUMMARY_CARDS = [
  { label: 'Active Opportunities', value: 12, icon: TrendingUp },
  { label: 'New This Week', value: 4, icon: Zap },
  { label: 'Pitches to Review', value: 3, icon: Presentation },
  { label: 'Upcoming Meetings', value: 2, icon: Calendar },
];

const FEATURED_DEALS = [
  { name: 'SpotVault', category: 'Poker Infrastructure / Technology', stage: 'Seed', seeking: '$500K', status: 'OPEN' },
  { name: 'Poker Analytics Startup', category: 'Data / Analytics', stage: 'Pre-Seed', seeking: '$250K', status: 'OPEN' },
  { name: 'Live Poker Technology', category: 'Events / Software', stage: 'Seed', seeking: '$750K', status: 'OPEN' },
];

const PITCHES = [
  { founder: 'Alex Turner', company: 'StackFlow', category: 'Poker SaaS', type: '5-Minute Review', status: 'NEW' },
  { founder: 'Sarah Kim', company: 'TableTech', category: 'Live Poker Hardware', type: 'Full Pitch', status: 'SCREENED' },
];

const STARTUPS = [
  { name: 'SpotVault', category: 'Poker Software', stage: 'Seed', location: 'Toronto, CA', funding: 'Seeking $500K' },
  { name: 'StackFlow', category: 'SaaS', stage: 'Pre-Seed', location: 'Austin, TX', funding: 'Seeking $250K' },
  { name: 'TableTech', category: 'Live Events', stage: 'Pre-Seed', location: 'Las Vegas, NV', funding: 'Seeking $300K' },
  { name: 'PokerDataPro', category: 'Data', stage: 'Seed', location: 'Remote', funding: 'Seeking $750K' },
  { name: 'StreamForge', category: 'Media', stage: 'Pre-Seed', location: 'Los Angeles, CA', funding: 'Seeking $150K' },
  { name: 'ChipChain', category: 'Payments', stage: 'Seed', location: 'Dublin, IE', funding: 'Seeking $600K' },
  { name: 'GTO Insights', category: 'Training', stage: 'Pre-Seed', location: 'Remote', funding: 'Seeking $200K' },
  { name: 'PokerMarket', category: 'Marketplace', stage: 'Seed', location: 'London, UK', funding: 'Seeking $400K' },
];

const INVESTORS = [
  { name: 'M. Chen', role: 'Angel Investor', focus: 'Gaming & Poker' },
  { name: 'R. Kasper', role: 'Industry Advisor', focus: 'Poker Operations' },
  { name: 'J. Whitman', role: 'Poker Industry Executive', focus: 'Live Events' },
  { name: 'D. Alvarado', role: 'Strategic Operator', focus: 'Platform & Media' },
  { name: 'L. Bergstrom', role: 'VC / Gaming', focus: 'Early Stage' },
];

const ACTIVE_ROOMS = [
  { name: 'SpotVault — Seed Discussion', type: 'PRIVATE', participants: 4 },
  { name: 'StackFlow — Founder Q&A', type: 'SCREENING ROOM', participants: 6 },
];

const MESSAGE_INBOXES = [
  { key: 'PRIMARY', label: 'Primary', icon: Inbox, count: 5 },
  { key: 'CONNECTIONS', label: 'Connections', icon: UserCheck, count: 2 },
  { key: 'INDUSTRY_REQUESTS', label: 'Industry Requests', icon: MessageSquare, count: 3 },
  { key: 'PAID_BOOKED', label: 'Paid / Booked', icon: Zap, count: 1 },
  { key: 'FILTERED', label: 'Filtered', icon: Filter, count: 12 },
];

const MOCK_MESSAGES: Record<string, { sender: string; subject: string; preview: string; time: string }[]> = {
  PRIMARY: [
    { sender: 'Jeff Platt', subject: 'Re: Media Partnership', preview: 'Following up on our discussion about...', time: '2h' },
    { sender: 'M. Chen', subject: 'SpotVault Introduction', preview: 'I would like to introduce you to...', time: '5h' },
    { sender: 'Randy Kasper', subject: 'Pitch Review Complete', preview: 'I have reviewed the StackFlow deck...', time: '1d' },
  ],
  CONNECTIONS: [
    { sender: 'Maria Ho', subject: 'Connection Accepted', preview: 'Thanks for reaching out. Let us...', time: '3h' },
    { sender: 'Spraggy', subject: 'Re: Collaboration', preview: 'Sounds interesting. Let me know...', time: '1d' },
  ],
  INDUSTRY_REQUESTS: [
    { sender: 'D. Alvarado', subject: 'Meeting Request', preview: 'Would like to discuss a potential...', time: '4h' },
    { sender: 'J. Whitman', subject: 'Industry Introduction', preview: 'Looking to connect regarding...', time: '8h' },
    { sender: 'L. Bergstrom', subject: 'Deal Flow Inquiry', preview: 'Interested in reviewing your...', time: '2d' },
  ],
  PAID_BOOKED: [
    { sender: 'Randy Kasper', subject: 'Consultation Confirmed', preview: 'Your 30-minute consultation is...', time: '6h' },
  ],
  FILTERED: [
    { sender: 'Unknown User', subject: 'Hey', preview: 'Can you check out my...', time: '1h' },
    { sender: 'Generic Sender', subject: 'Opportunity', preview: 'I have a great deal for...', time: '2h' },
  ],
};

const INVESTOR_CHAT_MEMBERS: PortalMember[] = [
  { id: 'mem-randy', name: 'Randy Kasper', role: 'Investor / Advisor', online: true },
  { id: 'mem-casey', name: 'Casey', role: 'Investor', online: true },
  { id: 'mem-kevin', name: 'Kevin Martin', role: 'Investor', online: false },
  { id: 'mem-bryan', name: 'Bryan Paris', role: 'COO', online: true },
];

const INVESTOR_CHAT_CHANNELS: ChannelDef[] = [
  { id: 'general', name: 'General', description: 'General investor discussion' },
  { id: 'deal-flow', name: 'Deal Flow', description: 'Active opportunities and deal discussion' },
  { id: 'introductions', name: 'Introductions', description: 'Introduce yourself to the community' },
  { id: 'poker-industry', name: 'Poker Industry', description: 'Industry trends and news' },
  { id: 'announcements', name: 'Announcements', description: 'Portal-wide announcements' },
];

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

export function InvestorHub({
  demo,
  onExitHub,
  onSwitchPortal,
  portalSwitchOpen,
  onTogglePortalSwitch,
  onClosePortalSwitch,
  onPortalChatActiveChange,
  portalChatActive,
  onOpenUniversalView,
}: Props) {
  const { state } = demo;
  const [activeNav, setActiveNavRaw] = useState('home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');

  // Sync portalContentView from global state into local nav state.
  useEffect(() => {
    if (demo.state.portalContentView) {
      setActiveNavRaw(demo.state.portalContentView);
    }
  }, [demo.state.portalContentView]);

  const setActiveNav = (label: string) => {
    setActiveNavRaw(label);
    if (onPortalChatActiveChange) onPortalChatActiveChange(label === 'Portal Chat');
  };

  const navItems = portalChatActive
    ? [...INVESTOR_NAV, { id: 'portal-chat', label: 'Portal Chat', icon: MessageSquare }]
    : INVESTOR_NAV;

  const renderContent = () => {
    if (portalChatActive) return null;
    if (activeNav === 'profile' && state.currentAccount) return (
      <ProfileSettingsHub
        account={state.currentAccount}
        onBack={() => setActiveNavRaw('home')}
        initialTab={profileTab}
      />
    );
    if (activeNav === 'messages') return <MessagesView />;
    if (activeNav === 'opportunities') return state.currentAccount ? <OpportunitiesPage account={state.currentAccount} /> : null;
    if (activeNav === 'marketplace') return <Store account={state.currentAccount} />;
    if (activeNav === 'people') return <PeopleDirectory />;
    if (activeNav === 'privacy') return <PrivacyPolicyPage embedded onBack={() => setActiveNavRaw('home')} />;
    if (activeNav === 'terms') return <TermsOfServicePage embedded onBack={() => setActiveNavRaw('home')} />;
    return <InvestorHome />;
  };

  return (
    <PortalRoomShell
      demo={demo}
      icon={Building2}
      portalLabel="Investor"
      roomLabel="Investor Room"
      navItems={navItems}
      activeNav={portalChatActive ? 'portal-chat' : activeNav}
      onNavigate={(v) => {
        if (v === 'solver') { demo.actions.openNetworkDirectory(); demo.actions.openHubView('solver'); return; }
        setActiveNav(v);
      }}
      onSwitchPortal={onSwitchPortal}
      portalSwitchOpen={portalSwitchOpen}
      onTogglePortalSwitch={onTogglePortalSwitch}
      onClosePortalSwitch={onClosePortalSwitch}
      onOpenProfileSettings={(tab) => { setProfileTab(tab); setActiveNavRaw('profile'); }}
      onBack={onExitHub}
      onOpenUniversalView={onOpenUniversalView}
    >
      <div className="h-full overflow-auto p-6 lg:p-8">{renderContent()}</div>
    </PortalRoomShell>
  );
}

function InvestorHome() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Investor Portal</h1>
          <p className="mt-1 text-sm text-[#7A7D7F]">Private deal flow across the poker industry.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10 px-4 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase">Verified Access</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.label} className="metal-panel rounded-xl p-5">
            <div className="flex items-center justify-between">
              <card.icon className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <span className="text-[8px] font-mono tracking-widest text-[#4A4D4F] uppercase">Demo</span>
            </div>
            <div className="mt-3 text-3xl font-bold text-white">{card.value}</div>
            <div className="mt-1 text-[10px] font-mono tracking-[0.15em] text-[#7A7D7F] uppercase">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Featured Opportunities</h2>
          <span className="rounded-full border border-[#202224] bg-[#111315]/50 px-2.5 py-0.5 text-[8px] font-mono tracking-widest text-[#4A4D4F] uppercase">Demo Data</span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FEATURED_DEALS.map((deal) => (
            <div key={deal.name} className="metal-panel group rounded-xl p-5 transition-all hover:border-[#c0911e]/30">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#292C2E] bg-[#151719]">
                  <Building2 className="h-4 w-4 text-[#7A7D7F]" strokeWidth={1.5} />
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[8px] font-bold tracking-widest text-emerald-300 uppercase">{deal.status}</span>
              </div>
              <h3 className="text-sm font-bold text-white">{deal.name}</h3>
              <p className="mt-1 text-[10px] text-[#7A7D7F]">{deal.category}</p>
              <div className="mt-4 flex items-center justify-between border-t border-[#202224] pt-3">
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono tracking-widest text-[#666A6D] uppercase">Stage</span>
                  <span className="text-[11px] font-semibold text-[#C7C9C7]">{deal.stage}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono tracking-widest text-[#666A6D] uppercase">Seeking</span>
                  <span className="text-[11px] font-semibold text-[#d4a52c]">{deal.seeking}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-lg border border-[#292C2E] bg-[#151719] py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F] hover:text-white">
                  View Company
                </button>
                <button className="flex-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50">
                  Request Intro
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-12 gap-4">
        <div className="metal-panel col-span-12 rounded-xl p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Pitches to Review</h2>
            <span className="text-[10px] font-mono text-[#666A6D]">{PITCHES.length} pending</span>
          </div>
          <div className="space-y-3">
            {PITCHES.map((pitch) => (
              <div key={pitch.company} className="flex items-center justify-between rounded-lg border border-[#202224] bg-[#111315]/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#333638] bg-gradient-to-b from-[#1C1E20] to-[#111315] text-[11px] font-semibold text-[#C7C9C7]">
                    {initials(pitch.founder)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{pitch.founder}</div>
                    <div className="text-[10px] text-[#7A7D7F]">{pitch.company} · {pitch.category}</div>
                    <div className="mt-0.5 text-[9px] font-mono tracking-widest text-[#666A6D] uppercase">{pitch.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pitch.status === 'NEW' && (
                    <span className="rounded-full border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest text-[#d4a52c] uppercase">New</span>
                  )}
                  {pitch.status === 'SCREENED' && (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[8px] font-bold tracking-widest text-emerald-300 uppercase">Screened</span>
                  )}
                  {pitch.status === 'NEW' ? (
                    <>
                      <button className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[9px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50">
                        Review
                      </button>
                      <button className="rounded-lg border border-[#292C2E] bg-[#151719] px-3 py-1.5 text-[9px] font-semibold tracking-widest text-[#7A7D7F] uppercase transition-all hover:border-[#3A3D3F] hover:text-[#C7C9C7]">
                        Decline
                      </button>
                    </>
                  ) : (
                    <button className="rounded-lg border border-[#292C2E] bg-[#151719] px-3 py-1.5 text-[9px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F] hover:text-white">
                      Open Pitch
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="metal-panel col-span-12 rounded-xl p-5 lg:col-span-5">
          <div className="mb-4">
            <h2 className="text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Pitch Access</h2>
            <p className="mt-1 text-[10px] text-[#7A7D7F]">Founders submit pitches through approved screening.</p>
          </div>
          <div className="rounded-lg border border-[#c0911e]/25 bg-[#c0911e]/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Presentation className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                <span className="text-xs font-bold tracking-wide text-[#f5e6b0] uppercase">Submit a Pitch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                <span className="text-xs font-bold text-[#d4a52c]">500</span>
                <span className="text-[9px] font-mono tracking-widest text-[#d4a52c]/70 uppercase">Credits</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {['Structured submission', 'Deck upload', 'Founder profile', 'Screening review'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-[#d4a52c]" strokeWidth={2} />
                  <span className="text-[10px] text-[#9A9D9F]">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[8px] leading-relaxed text-[#4A4D4F]">
              Payment guarantees review consideration only. It does not guarantee investment, introduction or approval.
            </p>
            <button className="mt-3 w-full rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50">
              Submit a Pitch
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Available Industry Access</h2>
        <div className="metal-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[11px] font-semibold text-[#d4a52c]">
                RK
              </div>
              <div>
                <div className="text-sm font-bold text-white">Randy Kasper</div>
                <div className="text-[10px] text-[#7A7D7F]">Industry Advisor</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-[#292C2E] bg-[#151719] px-4 py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F] hover:text-white">
                View Profile
              </button>
              <button className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50">
                Book Time
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-[#7A7D7F]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-[#C7C9C7]">15-Min Founder Review</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-[#d4a52c]" strokeWidth={1.5} />
                <span className="text-[11px] font-bold text-[#d4a52c]">500 Credits</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-[#7A7D7F]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-[#C7C9C7]">30-Min Strategy Call</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                <span className="text-[11px] font-bold text-[#d4a52c]">1,000 Credits</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-[#7A7D7F]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-[#C7C9C7]">Request Introduction</span>
              </div>
              <div className="mt-2 text-[10px] text-[#7A7D7F]">Application Required</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Startups</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STARTUPS.slice(0, 4).map((s) => (
              <div key={s.name} className="metal-panel rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#292C2E] bg-[#151719]">
                    <Building2 className="h-4 w-4 text-[#7A7D7F]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{s.name}</div>
                    <div className="text-[9px] text-[#7A7D7F]">{s.category}</div>
                  </div>
                  <span className="rounded-full border border-[#c0911e]/25 bg-[#c0911e]/5 px-2 py-0.5 text-[8px] font-mono tracking-widest text-[#d4a52c] uppercase">{s.stage}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#202224] pt-2.5">
                  <span className="flex items-center gap-1 text-[9px] text-[#7A7D7F]">
                    <MapPin className="h-3 w-3" strokeWidth={1.5} />
                    {s.location}
                  </span>
                  <span className="text-[9px] font-semibold text-[#d4a52c]">{s.funding}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Investor Network</h2>
          <div className="metal-panel rounded-xl p-4">
            <div className="space-y-2.5">
              {INVESTORS.map((inv) => (
                <div key={inv.name} className="flex items-center justify-between rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#333638] bg-gradient-to-b from-[#1C1E20] to-[#111315] text-[10px] font-semibold text-[#C7C9C7]">
                      {initials(inv.name)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#C7C9C7]">{inv.name}</div>
                      <div className="text-[9px] text-[#7A7D7F]">{inv.role}</div>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono tracking-widest text-[#666A6D] uppercase">{inv.focus}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#B0B3B1] uppercase">Active Rooms</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACTIVE_ROOMS.map((room) => (
            <div key={room.name} className="metal-panel flex items-center justify-between rounded-xl p-4">
              <div>
                <div className="text-xs font-bold text-white">{room.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full border border-[#202224] bg-[#111315]/50 px-2 py-0.5 text-[8px] font-mono tracking-widest text-[#7A7D7F] uppercase">{room.type}</span>
                  <span className="text-[9px] text-[#666A6D]">{room.participants} participants</span>
                </div>
              </div>
              <button className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50">
                Enter Room
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 border-t border-[#202224] pt-4">
        <span className="rounded-full border border-[#202224] bg-[#111315]/50 px-3 py-1 text-[8px] font-mono tracking-widest text-[#4A4D4F] uppercase">All Data Is Demo · Mock Environment</span>
      </div>
    </>
  );
}

export function InvestorChatFloor({ demo, onReturn }: { demo: Demo; onReturn: () => void }) {
  const account = demo.state.currentAccount;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608] text-[#c7cfd8]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,145,30,0.12),transparent_42%)]" />
      <div className="relative z-10 flex h-full w-full flex-col p-4 pt-16 lg:p-8 lg:pt-20">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
          <div className="mb-4 shrink-0">
            <div className="text-[10px] font-semibold tracking-[0.3em] text-[#d4a52c] uppercase">Investor Chat</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Investor network</h1>
            <p className="mt-1 text-sm text-[#84929f]">Private conversation space for authorized Investor Portal members.</p>
          </div>
          <div className="min-h-0 flex-1">
            <PortalChat
              portalType="INVESTOR"
              portalLabel="Investor"
              members={INVESTOR_CHAT_MEMBERS}
              channels={INVESTOR_CHAT_CHANNELS}
              currentUserId={account?.id ?? 'current-user'}
              currentUserName={account?.name ?? 'Authenticated User'}
              currentUserRole={account?.role === 'superuser' ? 'Superuser' : 'Investor / Advisor'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalChatEdgeTab({
  active,
  onEnter,
  onReturn,
}: {
  active: boolean;
  onEnter: () => void;
  onReturn: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = active ? ChevronDown : ChevronUp;
  const TOP_TAB_W = 96;
  const TOP_TAB_H = 48;
  const BASE_BG = 'linear-gradient(180deg, rgba(185,135,30,0.75), rgba(115,78,12,0.75))';
  const HOVER_BG = 'linear-gradient(180deg, rgba(205,150,40,0.85), rgba(135,92,16,0.85))';
  const BASE_SHADOW = 'inset 0 1px 0 rgba(255,240,170,0.18), 0 0 12px rgba(212,165,55,0.15)';
  const HOVER_SHADOW = 'inset 0 1px 0 rgba(255,240,170,0.28), 0 0 18px rgba(212,165,55,0.28)';
  const BORDER = '1px solid rgba(212,165,55,0.75)';
  const HOVER_BORDER = '1px solid rgba(212,165,55,0.95)';
  const ICON_COLOR = '#D6A72E';
  const ICON_HOVER = '#E8B84A';

  return createPortal(
    <button
      onClick={active ? onReturn : onEnter}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group fixed left-1/2 top-0 z-[9999] -translate-x-1/2 cursor-pointer transition-all duration-200"
      style={{ width: TOP_TAB_W, height: TOP_TAB_H }}
    >
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-b-xl transition-all duration-200 ${hovered ? 'translate-y-0.5' : ''}`}
        style={{
          background: hovered ? HOVER_BG : BASE_BG,
          boxShadow: hovered ? HOVER_SHADOW : BASE_SHADOW,
          border: hovered ? HOVER_BORDER : BORDER,
          borderTopWidth: 0,
        }}
      >
        <Icon
          className="relative z-10 h-6 w-6 transition-colors duration-200"
          strokeWidth={1.5}
          style={{ color: hovered ? ICON_HOVER : ICON_COLOR }}
        />
      </div>
    </button>,
    document.body,
  );
}

function MessagesView() {
  const [activeInbox, setActiveInbox] = useState('PRIMARY');
  const messages = MOCK_MESSAGES[activeInbox] ?? [];

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Messages</h1>
          <p className="mt-1 text-sm text-[#7A7D7F]">Permissioned inbox with filtering controls.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10 px-4 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase">Filtered Inbox</span>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {MESSAGE_INBOXES.map((inbox) => (
          <button
            key={inbox.key}
            onClick={() => setActiveInbox(inbox.key)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
              activeInbox === inbox.key
                ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                : 'border-[#292C2E] bg-[#151719] text-[#9A9D9F] hover:border-[#3A3D3F] hover:text-[#C7C9C7]'
            }`}
          >
            <inbox.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {inbox.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
              activeInbox === inbox.key ? 'bg-[#c0911e]/20 text-[#d4a52c]' : 'bg-[#292C2E] text-[#7A7D7F]'
            }`}>{inbox.count}</span>
          </button>
        ))}
      </div>

      {activeInbox === 'FILTERED' && (
        <div className="mb-4 rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
          <p className="text-[10px] leading-relaxed text-[#7A7D7F]">
            Filtered messages do not enter your primary inbox. These are messages from senders whose contact settings or relationship do not qualify for direct delivery. You can safely ignore this inbox.
          </p>
        </div>
      )}

      <div className="metal-panel rounded-xl p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-8 w-8 text-[#4A4D4F]" strokeWidth={1.5} />
            <p className="mt-4 text-xs text-[#7A7D7F]">No messages in this inbox.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-[#202224] bg-[#111315]/50 p-4 transition-all hover:border-[#292C2E]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#333638] bg-gradient-to-b from-[#1C1E20] to-[#111315] text-[10px] font-semibold text-[#C7C9C7]">
                  {initials(msg.sender)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{msg.sender}</span>
                    <span className="text-[9px] font-mono text-[#666A6D]">{msg.time}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-[#C7C9C7]">{msg.subject}</div>
                  <div className="mt-0.5 text-[10px] text-[#7A7D7F] truncate">{msg.preview}</div>
                </div>
                {activeInbox === 'FILTERED' && (
                  <span className="shrink-0 rounded-full border border-[#202224] bg-[#111315]/40 px-2 py-0.5 text-[7px] font-mono tracking-widest text-[#666A6D] uppercase">Filtered</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 border-t border-[#202224] pt-4">
        <span className="rounded-full border border-[#202224] bg-[#111315]/50 px-3 py-1 text-[8px] font-mono tracking-widest text-[#4A4D4F] uppercase">All Data Is Demo · Mock Environment</span>
      </div>
    </>
  );
}
