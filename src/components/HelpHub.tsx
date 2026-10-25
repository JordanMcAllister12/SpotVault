import { useState } from 'react';
import {
  ArrowLeft, HeartPulse, Shield, Calendar, Bookmark, Bell,
  Star, Zap, Clock, ChevronRight, CheckCircle2, AlertTriangle,
  Info, ShieldCheck, HandHeart, Lock, Stethoscope, Dumbbell,
  Phone, FileText, Ban, MessageSquare,
  Target, PlayCircle, BookOpen, Sparkles, LifeBuoy,
} from 'lucide-react';
import {
  type HelpSection,
  THERAPY_PROVIDERS, PERFORMANCE_COACHES, DEMO_APPOINTMENTS,
  PERFORMANCE_CONTENT, AWARENESS_SECTIONS, SAVED_RESOURCES,
  MEMBER_BENEFITS,
  type TherapyProvider, type PerformanceCoach,
} from '@/data/helpHubData';
import { HelpHubCommunitySupport } from '@/components/SpotVaultGives';
import { SupportCenter } from '@/components/player/SupportCenter';

interface Props {
  onBack?: () => void;
}

// ===== HELP HUB =====
// Multi-environment wellness center. Each section has its own
// photorealistic environment. Smoked-glass panels float over them.
// Section changes crossfade cinematically.

export function HelpHub({ onBack }: Props) {
  const [section, setSection] = useState<HelpSection>('lobby');
  const [selectedProvider, setSelectedProvider] = useState<TherapyProvider | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<PerformanceCoach | null>(null);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Persistent navigation */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/35 px-4 py-3 backdrop-blur-md lg:px-5">
        <div className="flex items-center gap-2.5 lg:gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-[#a8c4b8]" strokeWidth={1.5} />
            <span className="text-sm font-bold tracking-tight text-white">Help Hub</span>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <NavTab label="Support" active={section === 'lobby'} onClick={() => setSection('lobby')} />
          <NavTab label="Therapy & Wellness" active={section === 'therapy'} onClick={() => setSection('therapy')} />
          <NavTab label="Performance Center" active={section === 'performance'} onClick={() => setSection('performance')} />
          <NavTab label="Gambling Support" active={section === 'gambling'} onClick={() => setSection('gambling')} />
          <NavTab label="My Support" active={section === 'my-support'} onClick={() => setSection('my-support')} />
        </nav>

        {/* Mobile nav */}
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as HelpSection)}
          className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/70 md:hidden"
        >
          <option value="lobby">Support</option>
          <option value="therapy">Therapy & Wellness</option>
          <option value="performance">Performance Center</option>
          <option value="gambling">Gambling Support</option>
          <option value="my-support">My Support</option>
        </select>
      </header>

      {/* Content area */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {section === 'lobby' && <SupportCenter />}
        {section === 'therapy' && (
          <TherapySection
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
          />
        )}
        {section === 'performance' && (
          <PerformanceSection
            selectedCoach={selectedCoach}
            onSelectCoach={setSelectedCoach}
          />
        )}
        {section === 'gambling' && <GamblingSection />}
        {section === 'my-support' && <MySupportSection onNavigate={setSection} />}
      </div>
    </div>
  );
}

// ===== NAV TAB =====

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
        active
          ? 'bg-[#a8c4b8]/15 text-[#a8c4b8]'
          : 'text-white/40 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  );
}

// ===== GLASS PANEL (shared) =====

function GlassPanel({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md ${className}`}
      style={{
        background: 'rgba(8,10,9,0.72)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ===== THERAPY & WELLNESS =====

function TherapySection({
  selectedProvider, onSelectProvider,
}: {
  selectedProvider: TherapyProvider | null;
  onSelectProvider: (p: TherapyProvider | null) => void;
}) {
  if (selectedProvider) {
    return <ProviderDetail provider={selectedProvider} onBack={() => onSelectProvider(null)} />;
  }

  const upcoming = DEMO_APPOINTMENTS.filter((a) => a.type === 'therapy' && a.status === 'upcoming');

  return (
    <div className="network-page-content py-6 lg:py-8">
      {/* Section header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-[#c9a44c]" strokeWidth={1.5} />
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#c9a44c]/70 uppercase">Therapy & Wellness</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-white drop-shadow-lg">Private Professional Support</h2>
        <p className="mt-1 text-xs text-white/45">Licensed therapists and counselors. All sessions are confidential.</p>
      </div>

      {/* Upcoming appointment + benefit */}
      {upcoming.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassPanel className="p-4" style={{ borderColor: 'rgba(201,164,76,0.12)', background: 'rgba(20,16,8,0.72)' }}>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#c9a44c]" strokeWidth={1.5} />
              <span className="text-[9px] font-mono tracking-widest text-[#c9a44c]/70 uppercase">Next Appointment</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-col items-center rounded-lg bg-black/30 px-3 py-2">
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{upcoming[0].dayLabel}</span>
                <span className="text-sm font-bold text-white">{upcoming[0].timeLabel}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{upcoming[0].providerName}</p>
                <p className="text-[10px] text-white/40">{upcoming[0].durationMinutes} min · {upcoming[0].modality}</p>
              </div>
            </div>
          </GlassPanel>

          <BenefitCard
            label="SpotVault Benefit"
            description={`Your membership saved you $${upcoming[0].standardRate - upcoming[0].memberRate} on this session.`}
            savings={`$${upcoming[0].standardRate - upcoming[0].memberRate}`}
          />
        </div>
      )}

      {/* Find a Professional */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Find a Professional</h3>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold tracking-widest text-white/40 uppercase">
          {THERAPY_PROVIDERS.length} Providers
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {THERAPY_PROVIDERS.map((provider) => (
          <TherapistCard key={provider.id} provider={provider} onClick={() => onSelectProvider(provider)} />
        ))}
      </div>

      <HelpHubCommunitySupport />

      <DemoDisclaimer />
    </div>
  );
}

function TherapistCard({ provider, onClick }: { provider: TherapyProvider; onClick: () => void }) {
  const savings = provider.standardRate - provider.memberRate;
  return (
    <GlassPanel className="p-5 transition-all hover:border-[#c9a44c]/20">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#c9a44c]/10 text-sm font-bold text-[#c9a44c]">
          {provider.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white">{provider.name}</h4>
          <p className="text-[10px] text-white/40">{provider.credentials}</p>
        </div>
        {provider.demo && <DemoBadge />}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {provider.specialties.map((s) => (
          <span key={s} className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-mono tracking-wide text-white/50">{s}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-white/40">
        <Clock className="h-3 w-3" strokeWidth={1.5} />
        <span>Next available: <span className="text-white/60">{provider.nextAvailable}</span></span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30 line-through">${provider.standardRate}</span>
            <span className="text-sm font-bold text-[#c9a44c]">${provider.memberRate}</span>
            <span className="text-[9px] text-white/30">/ session</span>
          </div>
          <span className="text-[9px] font-semibold text-[#a8c4b8]">You save ${savings}</span>
        </div>
        <button
          onClick={onClick}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-bold tracking-widest text-white/60 uppercase transition-all hover:border-[#c9a44c]/30 hover:text-[#c9a44c]"
        >
          View Profile <ChevronRight className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </GlassPanel>
  );
}

function ProviderDetail({ provider, onBack }: { provider: TherapyProvider; onBack: () => void }) {
  const savings = provider.standardRate - provider.memberRate;
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-white/40 uppercase transition-all hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Directory
      </button>

      <GlassPanel className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#c9a44c]/10 text-lg font-bold text-[#c9a44c]">
            {provider.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{provider.name}</h2>
              {provider.demo && <DemoBadge />}
            </div>
            <p className="text-xs text-white/40">{provider.credentials}</p>
            <p className="mt-1 text-[10px] text-white/30">{provider.modality} · {provider.sessionLength} min sessions</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-white/55">{provider.bio}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {provider.specialties.map((s) => (
            <span key={s} className="rounded border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-mono tracking-wide text-white/50">{s}</span>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Next Available</span>
            <p className="mt-1 text-sm font-bold text-white">{provider.nextAvailable}</p>
          </div>
          <div className="rounded-xl border border-[#a8c4b8]/10 bg-[#a8c4b8]/[0.04] p-4">
            <span className="text-[9px] font-mono tracking-widest text-[#a8c4b8]/70 uppercase">SpotVault Member Rate</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-white/30 line-through">${provider.standardRate}</span>
              <span className="text-lg font-bold text-[#a8c4b8]">${provider.memberRate}</span>
            </div>
            <p className="text-[10px] text-[#a8c4b8]/70">You save ${savings} per session</p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c9a44c]/15 py-3 text-[11px] font-bold tracking-widest text-[#c9a44c] uppercase transition-all hover:bg-[#c9a44c]/25" style={{ minHeight: 44 }}>
            <Calendar className="h-4 w-4" strokeWidth={1.5} /> Book Session
          </button>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-bold tracking-widest text-white/50 uppercase transition-all hover:text-white/80" style={{ minHeight: 44 }}>
            <MessageSquare className="h-4 w-4" strokeWidth={1.5} /> Message
          </button>
        </div>
      </GlassPanel>

      <DemoDisclaimer />
    </div>
  );
}

// ===== PERFORMANCE CENTER =====

function PerformanceSection({
  selectedCoach, onSelectCoach,
}: {
  selectedCoach: PerformanceCoach | null;
  onSelectCoach: (c: PerformanceCoach | null) => void;
}) {
  if (selectedCoach) {
    return <CoachDetail coach={selectedCoach} onBack={() => onSelectCoach(null)} />;
  }

  const upcoming = DEMO_APPOINTMENTS.filter((a) => a.type === 'performance' && a.status === 'upcoming');

  return (
    <div className="network-page-content py-6 lg:py-8">
      {/* Section header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-[#7a9b8e]" strokeWidth={1.5} />
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#7a9b8e]/70 uppercase">Performance Center</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-white drop-shadow-lg">Mindset · Focus · Resilience</h2>
        <p className="mt-1 text-xs text-white/45">
          Non-clinical performance coaching for poker players. Tilt management, preparation routines, and mental game.
        </p>
      </div>

      {/* Upcoming session */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <GlassPanel className="p-4" style={{ borderColor: 'rgba(122,155,142,0.12)', background: 'rgba(8,16,12,0.72)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#7a9b8e]" strokeWidth={1.5} />
                <span className="text-[9px] font-mono tracking-widest text-[#7a9b8e]/70 uppercase">Next Session</span>
              </div>
              <span className="text-[9px] font-semibold text-[#a8c4b8]">Member rate: ${upcoming[0].memberRate}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-col items-center rounded-lg bg-black/30 px-3 py-2">
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{upcoming[0].dayLabel}</span>
                <span className="text-sm font-bold text-white">{upcoming[0].timeLabel}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{upcoming[0].providerName}</p>
                <p className="text-[10px] text-white/40">{upcoming[0].durationMinutes} min · {upcoming[0].modality}</p>
              </div>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Performance Coaches */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Performance Coaches</h3>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold tracking-widest text-white/40 uppercase">
          {PERFORMANCE_COACHES.length} Available
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PERFORMANCE_COACHES.map((coach) => (
          <CoachCard key={coach.id} coach={coach} onClick={() => onSelectCoach(coach)} />
        ))}
      </div>

      {/* Performance Content */}
      <div className="mb-4 mt-8 flex items-center gap-2">
        <PlayCircle className="h-4 w-4 text-[#7a9b8e]" strokeWidth={1.5} />
        <h3 className="text-sm font-bold text-white">Performance Content</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PERFORMANCE_CONTENT.map((content) => (
          <ContentCard key={content.id} content={content} />
        ))}
      </div>

      <DemoDisclaimer />
    </div>
  );
}

function CoachCard({ coach, onClick }: { coach: PerformanceCoach; onClick: () => void }) {
  const savings = coach.standardRate - coach.memberRate;
  return (
    <GlassPanel className="p-5 transition-all hover:border-[#7a9b8e]/20">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7a9b8e]/10 text-sm font-bold text-[#7a9b8e]">
          {coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">{coach.name}</h4>
            {coach.demo && <DemoBadge />}
          </div>
          <p className="text-[10px] text-white/40">{coach.title}</p>
          <div className="mt-1 flex items-center gap-1">
            {[1,2,3,4,5].map((i) => (
              <Star key={i} className={`h-2.5 w-2.5 ${i <= Math.round(coach.rating) ? 'text-[#d4a52c]' : 'text-white/10'}`} fill="currentColor" />
            ))}
            <span className="ml-1 text-[9px] text-white/30">{coach.rating} ({coach.reviewCount})</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {coach.specialties.map((s) => (
          <span key={s} className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-mono tracking-wide text-white/50">{s}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-white/40">
        <Clock className="h-3 w-3" strokeWidth={1.5} />
        <span>Next available: <span className="text-white/60">{coach.nextAvailable}</span></span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30 line-through">${coach.standardRate}/hr</span>
            <span className="text-sm font-bold text-[#7a9b8e]">${coach.memberRate}/hr</span>
          </div>
          <span className="text-[9px] font-semibold text-[#a8c4b8]">You save ${savings}/hr</span>
        </div>
        <button
          onClick={onClick}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/60 uppercase transition-all hover:border-[#7a9b8e]/30 hover:text-[#7a9b8e]"
          style={{ minHeight: 44 }}
        >
          Book Session <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </GlassPanel>
  );
}

function CoachDetail({ coach, onBack }: { coach: PerformanceCoach; onBack: () => void }) {
  const savings = coach.standardRate - coach.memberRate;
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-white/40 uppercase transition-all hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Coaches
      </button>

      <GlassPanel className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#7a9b8e]/10 text-lg font-bold text-[#7a9b8e]">
            {coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{coach.name}</h2>
              {coach.demo && <DemoBadge />}
            </div>
            <p className="text-xs text-white/40">{coach.title}</p>
            <div className="mt-1 flex items-center gap-1">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className={`h-3 w-3 ${i <= Math.round(coach.rating) ? 'text-[#d4a52c]' : 'text-white/10'}`} fill="currentColor" />
              ))}
              <span className="ml-1.5 text-[10px] text-white/30">{coach.rating} · {coach.reviewCount} reviews</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-white/55">{coach.bio}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {coach.specialties.map((s) => (
            <span key={s} className="rounded border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-mono tracking-wide text-white/50">{s}</span>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Next Available</span>
            <p className="mt-1 text-sm font-bold text-white">{coach.nextAvailable}</p>
            <p className="text-[10px] text-white/30">{coach.sessionLength} min sessions</p>
          </div>
          <div className="rounded-xl border border-[#a8c4b8]/10 bg-[#a8c4b8]/[0.04] p-4">
            <span className="text-[9px] font-mono tracking-widest text-[#a8c4b8]/70 uppercase">SpotVault Rate</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-white/30 line-through">${coach.standardRate}/hr</span>
              <span className="text-lg font-bold text-[#a8c4b8]">${coach.memberRate}/hr</span>
            </div>
            <p className="text-[10px] text-[#a8c4b8]/70">You save ${savings}/hr</p>
          </div>
        </div>

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7a9b8e]/15 py-3 text-[11px] font-bold tracking-widest text-[#7a9b8e] uppercase transition-all hover:bg-[#7a9b8e]/25" style={{ minHeight: 44 }}>
          <Calendar className="h-4 w-4" strokeWidth={1.5} /> Book Session
        </button>
      </GlassPanel>

      <DemoDisclaimer />
    </div>
  );
}

function ContentCard({ content }: { content: import('@/data/helpHubData').PerformanceContent }) {
  const icons: Record<string, React.ReactNode> = {
    routine: <Sparkles className="h-4 w-4" strokeWidth={1.5} />,
    video: <PlayCircle className="h-4 w-4" strokeWidth={1.5} />,
    series: <PlayCircle className="h-4 w-4" strokeWidth={1.5} />,
    article: <BookOpen className="h-4 w-4" strokeWidth={1.5} />,
    exercise: <Target className="h-4 w-4" strokeWidth={1.5} />,
  };

  const accessColors: Record<string, string> = {
    free: '#a8c4b8',
    member: '#d4a52c',
    paid: '#c9a44c',
  };
  const accessLabels: Record<string, string> = {
    free: 'Free',
    member: 'Member Benefit',
    paid: 'Paid',
  };

  return (
    <GlassPanel className="p-4 transition-all hover:border-white/15">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${accessColors[content.access]}15`, color: accessColors[content.access] }}
        >
          {icons[content.category]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white">{content.title}</h4>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-white/40">{content.description}</p>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30">{content.duration}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                style={{ background: `${accessColors[content.access]}15`, color: accessColors[content.access] }}
              >
                {accessLabels[content.access]}
              </span>
            </div>
            <button className="flex items-center gap-0.5 text-[9px] font-bold tracking-widest uppercase transition-all group-hover:gap-1" style={{ color: accessColors[content.access] }}>
              {content.ctaLabel} <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

// ===== GAMBLING SUPPORT =====

function GamblingSection() {
  const iconMap: Record<string, React.ReactNode> = {
    info: <Info className="h-5 w-5" strokeWidth={1.5} />,
    alert: <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />,
    check: <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />,
    limits: <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />,
    break: <Ban className="h-5 w-5" strokeWidth={1.5} />,
    talk: <MessageSquare className="h-5 w-5" strokeWidth={1.5} />,
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header — neutral, no gambling imagery */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#8a9ab5]" strokeWidth={1.5} />
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#8a9ab5]/70 uppercase">Gambling Support</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-white drop-shadow-lg">Tools, Information & Professional Resources</h2>
        <p className="mt-1 text-xs text-white/45">
          For anyone concerned about their gambling. Confidential, non-judgmental, and always available.
        </p>
      </div>

      {/* Need Help Now */}
      <GlassPanel className="mb-8 p-6" style={{ borderColor: 'rgba(138,154,181,0.15)', background: 'rgba(10,14,20,0.72)' }}>
        <div className="flex items-center gap-2">
          <HandHeart className="h-5 w-5 text-[#8a9ab5]" strokeWidth={1.5} />
          <h3 className="text-sm font-bold text-white">Need Help Now?</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          If you or someone you know is struggling with gambling, professional support is available. Regional resources will be connected based on your location.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <HelpButton icon={<Phone className="h-4 w-4" strokeWidth={1.5} />} label="Find Support" />
          <HelpButton icon={<FileText className="h-4 w-4" strokeWidth={1.5} />} label="Professional Resources" />
          <HelpButton icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.5} />} label="Self-Exclusion Information" />
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-black/20 px-3 py-2">
          <Lock className="h-3 w-3 text-white/25" strokeWidth={1.5} />
          <p className="text-[9px] text-white/30">
            Your activity in this section is completely private. It is never shared, tracked for advertising, or used for floor qualification.
          </p>
        </div>
      </GlassPanel>

      {/* Awareness Board */}
      <h3 className="mb-4 text-sm font-bold text-white">Awareness Board</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AWARENESS_SECTIONS.map((item) => (
          <GlassPanel key={item.id} className="p-4 transition-all hover:border-[#8a9ab5]/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#8a9ab5]/10 text-[#8a9ab5]">
                {iconMap[item.icon]}
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white">{item.title}</h4>
                <p className="mt-1 text-[10px] leading-relaxed text-white/40">{item.description}</p>
                <button className="mt-2 flex items-center gap-0.5 text-[9px] font-bold tracking-widest text-[#8a9ab5] uppercase transition-all group-hover:gap-1">
                  Learn More <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* No gambling ads notice */}
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/35 px-4 py-3 backdrop-blur-sm">
        <Shield className="h-3.5 w-3.5 text-white/25" strokeWidth={1.5} />
        <p className="text-[10px] leading-relaxed text-white/35">
          This section contains no gambling advertising, casino promotions, or affiliate offers. Commercial content is kept separate from support resources.
        </p>
      </div>
    </div>
  );
}

function HelpButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold tracking-widest text-white/60 uppercase transition-all hover:border-[#8a9ab5]/30 hover:text-[#8a9ab5]">
      {icon}
      {label}
    </button>
  );
}

// ===== MY SUPPORT =====

function MySupportSection({ onNavigate }: { onNavigate: (s: HelpSection) => void }) {
  const upcoming = DEMO_APPOINTMENTS.filter((a) => a.status === 'upcoming');
  const completed = DEMO_APPOINTMENTS.filter((a) => a.status === 'completed');

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#a8c4b8]" strokeWidth={1.5} />
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#a8c4b8]/70 uppercase">My Support</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-white drop-shadow-lg">Your Support Activity</h2>
      </div>

      {/* Upcoming Appointments */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-white">Upcoming Appointments</h3>
        <div className="flex flex-col gap-2">
          {upcoming.map((apt) => (
            <AppointmentCard key={apt.id} apt={apt} />
          ))}
        </div>
      </div>

      {/* Member Benefits */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-white">Available Benefits</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MEMBER_BENEFITS.map((benefit) => (
            <BenefitCard key={benefit.id} label={benefit.label} description={benefit.description} savings={benefit.savings} />
          ))}
        </div>
      </div>

      {/* Saved Resources */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-white">Saved Resources</h3>
        <div className="flex flex-col gap-2">
          {SAVED_RESOURCES.map((res) => (
            <div key={res.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-black/40 px-4 py-3 backdrop-blur-md transition-all hover:border-white/15">
              <Bookmark className="h-3.5 w-3.5 text-white/30" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-xs font-medium text-white">{res.title}</p>
                <p className="text-[9px] text-white/30">{res.source} · {res.type}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-white/20" strokeWidth={1.5} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-white">Recent Sessions</h3>
        <div className="flex flex-col gap-2">
          {completed.map((apt) => (
            <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/35 px-4 py-3 backdrop-blur-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#a8c4b8]/60" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-xs font-medium text-white/70">{apt.providerName}</p>
                <p className="text-[9px] text-white/30">{apt.dayLabel} · {apt.timeLabel} · {apt.durationMinutes} min</p>
              </div>
              <span className="text-[9px] font-semibold text-[#a8c4b8]/60 uppercase">Completed</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-white">Notifications</h3>
        <div className="flex items-start gap-3 rounded-lg border border-[#a8c4b8]/10 bg-[#a8c4b8]/[0.03] px-4 py-3 backdrop-blur-sm">
          <Bell className="h-3.5 w-3.5 text-[#a8c4b8]" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-medium text-white">SpotVault Benefit</p>
            <p className="text-[10px] text-white/40">Your membership saved you $40 on your upcoming therapy session with Dr. Sarah Whitfield.</p>
          </div>
        </div>
      </div>

      {/* Support Requests */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Support Requests</h3>
            <p className="text-[10px] text-white/40">View and submit support tickets</p>
          </div>
          <button
            onClick={() => onNavigate('lobby')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[9px] font-bold tracking-widest uppercase transition-all"
            style={{ borderColor: 'rgba(212,165,44,0.35)', background: 'rgba(212,165,44,0.1)', color: '#f5e6b0' }}
          >
            <LifeBuoy className="h-3.5 w-3.5" /> Go to Support
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ apt }: { apt: import('@/data/helpHubData').HelpAppointment }) {
  const accent = apt.type === 'therapy' ? '#c9a44c' : '#7a9b8e';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 backdrop-blur-md transition-all hover:border-white/15">
      <div className="flex flex-col items-center rounded-lg bg-black/30 px-3 py-2" style={{ borderColor: `${accent}20` }}>
        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{apt.dayLabel}</span>
        <span className="text-sm font-bold text-white">{apt.timeLabel}</span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-white">{apt.providerName}</p>
        <p className="text-[10px] text-white/40">{apt.durationMinutes} min · {apt.modality}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <Zap className="h-2.5 w-2.5" strokeWidth={1.5} style={{ color: accent }} />
          <span className="text-[9px] font-semibold" style={{ color: accent }}>
            {apt.type === 'therapy' ? 'Therapy' : 'Performance'} · ${apt.memberRate}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/50 uppercase transition-all hover:text-white/80">
          View
        </button>
        <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/50 uppercase transition-all hover:text-white/80">
          Reschedule
        </button>
      </div>
    </div>
  );
}

function BenefitCard({ label, description, savings }: { label: string; description: string; savings: string }) {
  return (
    <div className="rounded-xl border border-[#a8c4b8]/10 bg-[#a8c4b8]/[0.04] p-4 backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-[#a8c4b8]" strokeWidth={1.5} />
        <span className="text-[9px] font-mono tracking-widest text-[#a8c4b8]/70 uppercase">{label}</span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/50">{description}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-lg font-bold text-[#a8c4b8]">{savings}</span>
        <span className="text-[9px] text-white/30">saved</span>
      </div>
    </div>
  );
}

// ===== SHARED =====

function DemoBadge() {
  return (
    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-white/30 uppercase">
      Demo
    </span>
  );
}

function DemoDisclaimer() {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/35 px-4 py-3 backdrop-blur-sm">
      <Info className="h-3.5 w-3.5 text-white/25" strokeWidth={1.5} />
      <p className="text-[10px] leading-relaxed text-white/35">
        Demo providers and appointments are shown for illustration. Real licensed professionals will be integrated soon.
      </p>
    </div>
  );
}
