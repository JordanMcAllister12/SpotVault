import { useState, useMemo } from 'react';
import {
  Search,
  BadgeCheck,
  MapPin,
  Users,
  Filter,
  X,
  ArrowLeft,
  MessageSquare,
  DoorOpen,
  Calendar,
  User as UserIcon,
  Zap,
  Clock,
  Check,
  ShieldCheck,
  Building2,
  Lock,
  Send,
  Briefcase,
  Star,
  TrendingUp,
  Presentation,
  Video,
  Radio,
  GraduationCap,
  Users as UsersIcon,
  Store,
  Handshake,
  CalendarDays,
  ShoppingBag,
  ChevronDown,
} from 'lucide-react';
import {
  DIRECTORY_PROFILES,
  FILTER_CHIPS,
  type DirectoryProfile,
  type DirectoryCategory,
  type ContactState,
} from '@/data/directory';

interface Props {
  credits: number;
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

function contactStateLabel(state: ContactState): string {
  switch (state) {
    case 'NOT_CONNECTED': return 'Not Connected';
    case 'CONNECTION_REQUESTED': return 'Connection Requested';
    case 'CONNECTED': return 'Connected';
    case 'INVITE_AVAILABLE': return 'Invite Available';
    case 'PAID_ACCESS': return 'Paid Access';
    case 'DIRECT_MESSAGE_ALLOWED': return 'Direct Message Allowed';
    case 'FILTERED': return 'Filtered';
  }
}

function contactStateColor(state: ContactState): string {
  switch (state) {
    case 'CONNECTED': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    case 'CONNECTION_REQUESTED': return 'text-[#d4a52c] border-[#d4a52c]/30 bg-[#d4a52c]/10';
    case 'NOT_CONNECTED': return 'text-[#9A9D9F] border-[#292C2E] bg-[#151719]';
    case 'PAID_ACCESS': return 'text-[#d4a52c] border-[#c0911e]/30 bg-[#c0911e]/10';
    case 'INVITE_AVAILABLE': return 'text-[#B0B3B1] border-[#3A3D3F] bg-[#1C1E20]';
    case 'DIRECT_MESSAGE_ALLOWED': return 'text-emerald-300 border-emerald-400/25 bg-emerald-400/5';
    case 'FILTERED': return 'text-[#666A6D] border-[#202224] bg-[#111315]/40';
  }
}

export function IndustryDirectory({ credits }: Props) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<DirectoryCategory>('ALL');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableForMeetings, setAvailableForMeetings] = useState(false);
  const [paidAccessOnly, setPaidAccessOnly] = useState(false);
  const [companyFilter, setCompanyFilter] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<DirectoryProfile | null>(null);
  const [connectTarget, setConnectTarget] = useState<DirectoryProfile | null>(null);
  const [inviteTarget, setInviteTarget] = useState<DirectoryProfile | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, ContactState>>({});
  const [connectMessage, setConnectMessage] = useState('');

  const filtered = useMemo(() => {
    return DIRECTORY_PROFILES.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.role.toLowerCase().includes(q) && !p.organization.toLowerCase().includes(q) && !p.bio.toLowerCase().includes(q)) return false;
      }
      if (activeFilter !== 'ALL' && p.category !== activeFilter) return false;
      if (verifiedOnly && !p.verified) return false;
      if (availableForMeetings && !p.availableForMeetings) return false;
      if (paidAccessOnly && !p.paidAccessAvailable) return false;
      if (companyFilter && !p.organization.toLowerCase().includes(companyFilter.toLowerCase())) return false;
      if (hubFilter && !p.homeHub.toLowerCase().includes(hubFilter.toLowerCase())) return false;
      if (locationFilter && !p.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      return true;
    });
  }, [search, activeFilter, verifiedOnly, availableForMeetings, paidAccessOnly, companyFilter, hubFilter, locationFilter]);

  const getContactState = (p: DirectoryProfile): ContactState => connectionStates[p.id] ?? p.contactState;

  const handleSendRequest = () => {
    if (!connectTarget) return;
    setConnectionStates((prev) => ({ ...prev, [connectTarget.id]: 'CONNECTION_REQUESTED' }));
    setConnectTarget(null);
    setConnectMessage('');
  };

  const handleInviteSend = () => {
    if (!inviteTarget) return;
    setInviteTarget(null);
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Industry Directory</h1>
          <p className="mt-1 text-sm text-[#7A7D7F]">Search the people building, playing and powering poker.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10 px-4 py-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase">Private Rolodex</span>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="recessed-field flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Search className="h-4 w-4 shrink-0 text-[#7A7D7F]" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[#666A6D] focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#7A7D7F] hover:text-[#C7C9C7]">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex items-center gap-1.5 sm:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setActiveFilter(chip.value)}
              className={`flex-1 whitespace-nowrap rounded-full border px-2 py-1.5 text-[9px] font-semibold tracking-widest uppercase transition-all sm:px-3 sm:text-[10px] ${
                activeFilter === chip.value
                  ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                  : 'border-[#292C2E] bg-[#151719] text-[#9A9D9F] hover:border-[#3A3D3F] hover:text-[#C7C9C7]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5 text-[9px] font-semibold tracking-widest uppercase transition-all sm:px-3 sm:text-[10px] ${
            showAdvanced
              ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
              : 'border-[#292C2E] bg-[#151719] text-[#9A9D9F] hover:border-[#3A3D3F] hover:text-[#C7C9C7]'
          }`}
        >
          <Filter className="h-3 w-3" strokeWidth={1.5} />
          <span className="hidden sm:inline">Filters</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="metal-panel mb-5 rounded-xl p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Company</label>
              <input
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                placeholder="Filter by company..."
                className="recessed-field w-full rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#666A6D] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Hub</label>
              <input
                value={hubFilter}
                onChange={(e) => setHubFilter(e.target.value)}
                placeholder="Filter by hub..."
                className="recessed-field w-full rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#666A6D] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Location</label>
              <input
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Filter by location..."
                className="recessed-field w-full rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#666A6D] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => setVerifiedOnly((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                verifiedOnly ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-[#292C2E] bg-[#151719] text-[#9A9D9F]'
              }`}
            >
              {verifiedOnly && <Check className="h-3 w-3" strokeWidth={2} />}
              Verified Only
            </button>
            <button
              onClick={() => setAvailableForMeetings((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                availableForMeetings ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-[#292C2E] bg-[#151719] text-[#9A9D9F]'
              }`}
            >
              {availableForMeetings && <Check className="h-3 w-3" strokeWidth={2} />}
              Available for Meetings
            </button>
            <button
              onClick={() => setPaidAccessOnly((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                paidAccessOnly ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-[#292C2E] bg-[#151719] text-[#9A9D9F]'
              }`}
            >
              {paidAccessOnly && <Check className="h-3 w-3" strokeWidth={2} />}
              Paid Access Available
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-[#666A6D] uppercase">{filtered.length} People Found</span>
      </div>

      {/* Profile cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const cs = getContactState(p);
          return (
            <div key={p.id} className="metal-panel group flex flex-col rounded-xl p-5 transition-all hover:border-[#c0911e]/30">
              {/* Top: avatar + name + verified */}
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#333638] bg-gradient-to-b from-[#1C1E20] to-[#111315] text-[12px] font-semibold text-[#C7C9C7]">
                    {initials(p.name)}
                  </div>
                  {p.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0C0D0E] bg-emerald-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{p.name}</span>
                    {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />}
                  </div>
                  <div className="text-[10px] text-[#7A7D7F]">{p.role}</div>
                  <div className="text-[9px] text-[#666A6D]">{p.organization}</div>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#202224] bg-[#111315]/50 px-2 py-0.5 text-[8px] font-mono tracking-widest text-[#7A7D7F] uppercase">{p.homeHub}</span>
                <span className="flex items-center gap-1 text-[9px] text-[#7A7D7F]">
                  <MapPin className="h-2.5 w-2.5" strokeWidth={1.5} />
                  {p.location}
                </span>
              </div>

              {/* Bio */}
              <p className="mt-3 text-[10px] leading-relaxed text-[#9A9D9F]">{p.bio}</p>

              {/* Mutual connections */}
              <div className="mt-3 flex items-center gap-1.5 text-[9px] text-[#666A6D]">
                <Users className="h-3 w-3" strokeWidth={1.5} />
                {p.mutualConnections} mutual connections
              </div>

              {/* Contact state */}
              <div className="mt-3">
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[8px] font-bold tracking-widest uppercase ${contactStateColor(cs)}`}>
                  {contactStateLabel(cs)}
                </span>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2 border-t border-[#202224] pt-3">
                <button
                  onClick={() => setSelectedProfile(p)}
                  className="flex-1 rounded-lg border border-[#292C2E] bg-[#151719] py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F] hover:text-white"
                >
                  View Profile
                </button>
                {cs === 'CONNECTED' ? (
                  <button
                    onClick={() => setSelectedProfile(p)}
                    className="flex-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 py-2 text-[10px] font-semibold tracking-widest text-emerald-300 uppercase transition-all hover:border-emerald-400/50"
                  >
                    Message
                  </button>
                ) : cs === 'CONNECTION_REQUESTED' ? (
                  <button
                    disabled
                    className="flex-1 cursor-default rounded-lg border border-[#202224] bg-[#111315]/40 py-2 text-[10px] font-semibold tracking-widest text-[#7A7D7F] uppercase"
                  >
                    Requested
                  </button>
                ) : (
                  <button
                    onClick={() => setConnectTarget(p)}
                    className="flex-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-8 w-8 text-[#4A4D4F]" strokeWidth={1.5} />
          <p className="mt-4 text-sm text-[#7A7D7F]">No people found matching your filters.</p>
          <button
            onClick={() => { setSearch(''); setActiveFilter('ALL'); setVerifiedOnly(false); setAvailableForMeetings(false); setPaidAccessOnly(false); setCompanyFilter(''); setHubFilter(''); setLocationFilter(''); }}
            className="mt-4 rounded-lg border border-[#292C2E] bg-[#151719] px-4 py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F]"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* ===== Profile Detail Modal ===== */}
      {selectedProfile && (
        <ProfileDetailModal
          profile={selectedProfile}
          contactState={getContactState(selectedProfile)}
          credits={credits}
          onClose={() => setSelectedProfile(null)}
          onConnect={() => { setConnectTarget(selectedProfile); setSelectedProfile(null); }}
          onInvite={() => { setInviteTarget(selectedProfile); setSelectedProfile(null); }}
        />
      )}

      {/* ===== Connect Request Modal ===== */}
      {connectTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setConnectTarget(null); setConnectMessage(''); }}>
          <div className="metal-frame brushed-metal clip-bevel relative w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setConnectTarget(null); setConnectMessage(''); }} className="absolute right-4 top-4 text-[#7A7D7F] hover:text-[#C7C9C7]">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="mb-4 flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <h2 className="text-sm font-bold tracking-[0.2em] text-[#f5e6b0] uppercase">Send Connection Request</h2>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#333638] bg-gradient-to-b from-[#1C1E20] to-[#111315] text-[11px] font-semibold text-[#C7C9C7]">
                {initials(connectTarget.name)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{connectTarget.name}</span>
                  {connectTarget.verified && <BadgeCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />}
                </div>
                <div className="text-[10px] text-[#7A7D7F]">{connectTarget.role} · {connectTarget.homeHub}</div>
              </div>
            </div>
            <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Optional Message</label>
            <textarea
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              placeholder={`Hi ${connectTarget.name.split(' ')[0]} — I'd like to connect regarding...`}
              rows={3}
              className="recessed-field w-full resize-none rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#666A6D] focus:outline-none"
            />
            <p className="mt-2 text-[8px] leading-relaxed text-[#4A4D4F]">
              The recipient must accept your request before standard direct messaging is available.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setConnectTarget(null); setConnectMessage(''); }}
                className="flex-1 rounded-lg border border-[#292C2E] bg-[#151719] py-2.5 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRequest}
                className="flex-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Invite to Room Modal ===== */}
      {inviteTarget && (
        <InviteToRoomModal
          profile={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onSend={handleInviteSend}
        />
      )}
    </div>
  );
}

// ===== Profile Detail Modal =====

function ProfileDetailModal({
  profile,
  contactState,
  credits,
  onClose,
  onConnect,
  onInvite,
}: {
  profile: DirectoryProfile;
  contactState: ContactState;
  credits: number;
  onClose: () => void;
  onConnect: () => void;
  onInvite: () => void;
}) {
  const [activeTab, setActiveTab] = useState('ABOUT');

  const TABS = ['ABOUT', 'EXPERIENCE', 'HUBS', 'CONTENT', 'ACTIVITY', 'CONNECTIONS', 'AVAILABILITY', 'CONTACT'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="metal-frame brushed-metal clip-bevel relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#202224] bg-[#0C0D0E]/60 px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-[#7A7D7F] transition-colors hover:text-[#C7C9C7]">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[12px] font-semibold text-[#d4a52c]">
                  {initials(profile.name)}
                </div>
                {profile.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0C0D0E] bg-emerald-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{profile.name}</span>
                  {profile.verified && <BadgeCheck className="h-4 w-4 text-[#d4a52c]" strokeWidth={2} />}
                </div>
                <div className="text-[11px] text-[#7A7D7F]">{profile.role} · {profile.organization}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[8px] font-bold tracking-widest uppercase ${contactStateColor(contactState)}`}>
              {contactStateLabel(contactState)}
            </span>
            <button onClick={onClose} className="text-[#7A7D7F] hover:text-[#C7C9C7]">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#202224] bg-[#0C0D0E]/40 px-4 py-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                activeTab === tab
                  ? 'border border-[#c0911e]/30 bg-[#c0911e]/10 text-[#f5e6b0]'
                  : 'border border-transparent text-[#7A7D7F] hover:text-[#C7C9C7]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === 'ABOUT' && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-[10px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Bio</h3>
                <p className="text-sm leading-relaxed text-[#C7C9C7]">{profile.bio}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                  <div className="text-[9px] font-mono tracking-widest text-[#666A6D] uppercase">Home Hub</div>
                  <div className="mt-1 text-xs font-semibold text-[#C7C9C7]">{profile.homeHub}</div>
                </div>
                <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                  <div className="text-[9px] font-mono tracking-widest text-[#666A6D] uppercase">Location</div>
                  <div className="mt-1 text-xs font-semibold text-[#C7C9C7]">{profile.location}</div>
                </div>
                <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                  <div className="text-[9px] font-mono tracking-widest text-[#666A6D] uppercase">Organization</div>
                  <div className="mt-1 text-xs font-semibold text-[#C7C9C7]">{profile.organization}</div>
                </div>
                <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                  <div className="text-[9px] font-mono tracking-widest text-[#666A6D] uppercase">Mutual Connections</div>
                  <div className="mt-1 text-xs font-semibold text-[#C7C9C7]">{profile.mutualConnections}</div>
                </div>
              </div>
              {profile.isDemo && (
                <div className="rounded-lg border border-[#202224] bg-[#111315]/30 px-3 py-2 text-[8px] font-mono tracking-widest text-[#4A4D4F] uppercase">
                  Demo Profile · Mock Identity
                </div>
              )}
            </div>
          )}

          {activeTab === 'EXPERIENCE' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#202224] bg-[#111315]/50 p-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                  <span className="text-xs font-bold text-white">{profile.role}</span>
                </div>
                <p className="mt-1 text-[10px] text-[#7A7D7F]">{profile.organization}</p>
              </div>
              {profile.organizations.map((org) => (
                <div key={org} className="rounded-lg border border-[#202224] bg-[#111315]/50 p-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#7A7D7F]" strokeWidth={1.5} />
                    <span className="text-xs font-bold text-[#C7C9C7]">{org}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'HUBS' && (
            <div className="space-y-2">
              {profile.hubMemberships.map((hm) => (
                <div key={hm.hub} className="flex items-center justify-between rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                  <span className="text-xs font-semibold text-[#C7C9C7]">{hm.hub}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[8px] font-bold tracking-widest uppercase ${
                    hm.access === 'Permanent' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                    hm.access === 'Verified' ? 'border-[#c0911e]/30 bg-[#c0911e]/10 text-[#d4a52c]' :
                    hm.access === 'Guest Eligible' ? 'border-[#3A3D3F] bg-[#1C1E20] text-[#B0B3B1]' :
                    'border-[#202224] bg-[#111315]/40 text-[#7A7D7F]'
                  }`}>{hm.access}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'CONTENT' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="h-8 w-8 text-[#4A4D4F]" strokeWidth={1.5} />
              <p className="mt-4 text-xs text-[#7A7D7F]">No public content available.</p>
            </div>
          )}

          {activeTab === 'ACTIVITY' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="h-8 w-8 text-[#4A4D4F]" strokeWidth={1.5} />
              <p className="mt-4 text-xs text-[#7A7D7F]">No recent activity to display.</p>
            </div>
          )}

          {activeTab === 'CONNECTIONS' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-8 w-8 text-[#4A4D4F]" strokeWidth={1.5} />
              <p className="mt-4 text-xs text-[#7A7D7F]">{profile.mutualConnections} mutual connections.</p>
              <p className="text-[10px] text-[#666A6D]">Connection details are private.</p>
            </div>
          )}

          {activeTab === 'AVAILABILITY' && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Professional Availability</h3>
              {profile.availability.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-6 w-6 text-[#4A4D4F]" strokeWidth={1.5} />
                  <p className="mt-3 text-xs text-[#7A7D7F]">No professional availability listed.</p>
                </div>
              ) : (
                profile.availability.map((slot, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-[#7A7D7F]" strokeWidth={1.5} />
                      <span className="text-xs font-semibold text-[#C7C9C7]">{slot.title}</span>
                    </div>
                    {slot.type === 'paid' ? (
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-[#d4a52c]" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-[#d4a52c]">{slot.priceCredits.toLocaleString()}</span>
                        <span className="text-[9px] font-mono tracking-widest text-[#d4a52c]/70 uppercase">Credits</span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-mono tracking-widest text-[#7A7D7F] uppercase">Request</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'CONTACT' && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-[10px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Contact Settings</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(profile.contactSettings).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
                      <span className="text-[10px] font-semibold text-[#C7C9C7] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={`text-[9px] font-mono tracking-widest uppercase ${
                        val === 'ALLOW' ? 'text-emerald-400' :
                        val === 'ALLOW_REQUESTS' ? 'text-[#d4a52c]' :
                        val === 'AVAILABLE' ? 'text-[#d4a52c]' :
                        val === 'FILTER' ? 'text-[#9A9D9F]' :
                        'text-[#7A7D7F]'
                      }`}>{val.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[8px] leading-relaxed text-[#4A4D4F]">
                These settings control who can reach this user and how. Filtered messages do not enter the recipient's primary inbox.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 gap-2 border-t border-[#202224] bg-[#0C0D0E]/60 px-6 py-4">
          {contactState === 'CONNECTED' ? (
            <>
              <button className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[10px] font-semibold tracking-widest text-emerald-300 uppercase transition-all hover:border-emerald-400/50">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                Message
              </button>
              <button
                onClick={onInvite}
                className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50"
              >
                <DoorOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                Invite to Room
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-[#292C2E] bg-[#151719] px-4 py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F]">
                <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
                Book Meeting
              </button>
            </>
          ) : contactState === 'CONNECTION_REQUESTED' ? (
            <button disabled className="flex-1 cursor-default rounded-lg border border-[#202224] bg-[#111315]/40 py-2 text-[10px] font-semibold tracking-widest text-[#7A7D7F] uppercase">
              Connection Requested — Awaiting Acceptance
            </button>
          ) : (
            <>
              <button
                onClick={onConnect}
                className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50"
              >
                <UserIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                Connect
              </button>
              {profile.paidAccessAvailable && (
                <button className="flex items-center gap-1.5 rounded-lg border border-[#292C2E] bg-[#151719] px-4 py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F]">
                  <Zap className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                  Book Time
                </button>
              )}
              {profile.contactSettings.investors !== 'FILTER' && (
                <button
                  onClick={onInvite}
                  className="flex items-center gap-1.5 rounded-lg border border-[#292C2E] bg-[#151719] px-4 py-2 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F]"
                >
                  <DoorOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Invite to Room
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Invite to Room Modal =====

function InviteToRoomModal({
  profile,
  onClose,
  onSend,
}: {
  profile: DirectoryProfile;
  onClose: () => void;
  onSend: () => void;
}) {
  const [reason, setReason] = useState('Investment Discussion');
  const [duration, setDuration] = useState('30 Minutes');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="metal-frame brushed-metal clip-bevel relative w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-[#7A7D7F] hover:text-[#C7C9C7]">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="mb-4 flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
          <h2 className="text-sm font-bold tracking-[0.2em] text-[#f5e6b0] uppercase">Invite to Private Room</h2>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#333638] bg-gradient-to-b from-[#1C1E20] to-[#111315] text-[11px] font-semibold text-[#C7C9C7]">
            {initials(profile.name)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{profile.name}</span>
              {profile.verified && <BadgeCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />}
            </div>
            <div className="text-[10px] text-[#7A7D7F]">From: {profile.homeHub}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Into</label>
            <div className="recessed-field flex items-center gap-2 rounded-lg px-3 py-2.5">
              <Lock className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
              <span className="text-xs text-white">Investor Portal — Private Room</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="recessed-field w-full rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="recessed-field w-full rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none"
            >
              <option>15 Minutes</option>
              <option>30 Minutes</option>
              <option>60 Minutes</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Access Level</label>
            <div className="recessed-field flex items-center gap-2 rounded-lg px-3 py-2.5">
              <Clock className="h-3.5 w-3.5 text-[#7A7D7F]" strokeWidth={1.5} />
              <span className="text-xs text-[#C7C9C7]">Temporary Guest — Room Access Only</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#202224] bg-[#111315]/50 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold text-[#C7C9C7]">Room Access Only</span>
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-[#7A7D7F]">
            The guest can access the invited room, shared files, chat, and the scheduled meeting. They cannot browse the Investor Directory, private deal flow, other rooms, or confidential portal content.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#292C2E] bg-[#151719] py-2.5 text-[10px] font-semibold tracking-widest text-[#C7C9C7] uppercase transition-all hover:border-[#3A3D3F]"
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            className="flex-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:border-[#c0911e]/50"
          >
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}
