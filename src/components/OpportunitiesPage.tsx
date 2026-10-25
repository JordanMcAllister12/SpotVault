import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Users,
  Megaphone,
  Newspaper,
  Plus,
  X,
  Search,
  ChevronRight,
  Star,
  MessageSquare,
  ShoppingBag,
  MapPin,
  Building2,
  Clock,
  Loader2,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import { MARKETPLACE_ITEMS } from '@/types';
import { SERVICE_LISTINGS, type ServiceListing } from '@/data/universalData';
import {
  fetchActiveJobPostings,
  fetchPublishedCandidates,
  type JobPosting,
  type JobCandidate,
} from '@/lib/jobsData';
import {
  PageHeader,
  SearchInput,
  TabButton,
  ContentCard,
  CardActionButton,
  Tag,
  GOLD,
  BORDER_GOLD,
} from '@/components/ui/industry';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

type Tab = 'jobs' | 'candidates' | 'services' | 'bulletins';
type PostType = 'job' | 'candidate' | 'service' | 'bulletin' | null;

interface Props {
  account: SpotVaultAccount;
  onNavigateToMarketplace?: (providerId?: string) => void;
}

export function OpportunitiesPage({ account, onNavigateToMarketplace }: Props) {
  const [tab, setTab] = useState<Tab>('jobs');
  const [postType, setPostType] = useState<PostType>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);

  return (
    <PortalWorkspaceShell maxWidth="max-w-6xl">
    <div className="mx-auto px-4 py-4 sm:px-6">
      <PageHeader
        title="Opportunities"
        subtitle="Jobs, candidates, professional services, and industry bulletins."
        action={
          <div className="relative">
            <button
              onClick={() => setShowPostMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all"
              style={{ borderColor: BORDER_GOLD, background: GOLD + '15', color: GOLD }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Post
            </button>
          {showPostMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPostMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-white/[0.08] bg-[#0a0c0e] p-2 shadow-2xl backdrop-blur-md">
                <div className="mb-1 px-2 py-1 text-[8px] font-mono tracking-[0.25em] text-white/45 uppercase">What would you like to post?</div>
                {([
                  { id: 'job', label: 'Job', icon: Briefcase },
                  { id: 'candidate', label: 'Candidate Profile', icon: Users },
                  { id: 'service', label: 'Service', icon: Megaphone },
                  { id: 'bulletin', label: 'Bulletin', icon: Newspaper },
                ] as { id: PostType; label: string; icon: typeof Briefcase }[]).map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { setPostType(opt.id); setShowPostMenu(false); setTab(opt.id === 'job' ? 'jobs' : opt.id === 'candidate' ? 'candidates' : opt.id === 'service' ? 'services' : 'bulletins'); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-white/70 transition hover:bg-white/[0.04] hover:text-white"
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      }
      />

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {([
          { id: 'jobs', label: 'Jobs', icon: Briefcase },
          { id: 'candidates', label: 'Candidates', icon: Users },
          { id: 'services', label: 'Services', icon: Megaphone },
          { id: 'bulletins', label: 'Bulletins', icon: Newspaper },
        ] as { id: Tab; label: string; icon: typeof Briefcase }[]).map((t) => (
          <TabButton
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            icon={t.icon}
            label={t.label}
          />
        ))}
      </div>

      {/* Post form overlay */}
      {postType && (
        <PostForm postType={postType} onClose={() => setPostType(null)} />
      )}

      {/* Content */}
      {tab === 'jobs' && <JobsTab account={account} />}
      {tab === 'candidates' && <CandidatesTab account={account} />}
      {tab === 'services' && <ServicesTab onNavigateToMarketplace={onNavigateToMarketplace} />}
      {tab === 'bulletins' && <BulletinsTab />}
    </div>
    </PortalWorkspaceShell>
  );
}

// ── Jobs Tab ──────────────────────────────────────────────────────

function JobsTab({ account }: { account: SpotVaultAccount }) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dbJobs = await fetchActiveJobPostings();
      setJobs(dbJobs);
    } catch {
      setJobs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = jobs.filter((j) =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.company.toLowerCase().includes(search.toLowerCase()) ||
    j.location?.toLowerCase().includes(search.toLowerCase())
  );

  const displayJobs = filtered;

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} placeholder="Search jobs by title, company, or location..." className="mb-4" />
      {loading && <LoadingState />}
      {!loading && displayJobs.length === 0 && <EmptyState icon={Briefcase} label="No job postings yet" />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayJobs.map((job) => <JobCard key={job.id} job={job} />)}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: JobPosting }) {
  const company = job.company;
  const title = job.job_title;
  const location = job.location ?? 'Remote';
  const workType = job.employment_type ?? 'Full-time';
  const compensation = job.salary_range;
  const description = job.job_description ?? '';
  const posted = 'Recently';

  return (
    <ContentCard>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#c091e]/10 text-xs font-bold text-[#d4a52c]/70">
          <Building2 className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white/90">{title}</h3>
          <div className="truncate text-[10px] text-white/55">{company}</div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/60">{description}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Chip icon={MapPin}>{location}</Chip>
        <Chip icon={Clock}>{workType}</Chip>
        {compensation && <Chip>{compensation}</Chip>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-[9px] text-white/40">{posted}</span>
        <CardActionButton icon={ChevronRight} label="View" />
      </div>
    </ContentCard>
  );
}

// ── Candidates Tab ────────────────────────────────────────────────

function CandidatesTab({ account }: { account: SpotVaultAccount }) {
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dbCandidates = await fetchPublishedCandidates();
      setCandidates(dbCandidates);
    } catch {
      setCandidates([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = candidates.filter((c) =>
    !search || c.display_name.toLowerCase().includes(search.toLowerCase()) ||
    c.interested_roles?.some((r) => r.toLowerCase().includes(search.toLowerCase()))
  );

  const displayCandidates = filtered;

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} placeholder="Search candidates by name or role..." className="mb-4" />
      {loading && <LoadingState />}
      {!loading && displayCandidates.length === 0 && <EmptyState icon={Users} label="No candidate profiles yet" />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayCandidates.map((c) => <CandidateCard key={c.id} candidate={c} />)}
      </div>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: JobCandidate }) {
  const name = candidate.name;
  const role = candidate.interested_roles?.[0] ?? 'Poker Professional';
  const bio = candidate.introduction ?? '';
  const location = candidate.location ?? '';
  const availability = candidate.availability ?? 'Open';

  return (
    <ContentCard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#c091e]/10 text-sm font-bold text-[#d4a52c]/60">
          {name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white/90">{name}</h3>
          <p className="mt-0.5 truncate text-[10px] font-medium text-[#d4a52c]/60">{role}</p>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-white/60">{bio}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {location && <Chip icon={MapPin}>{location}</Chip>}
        <Chip icon={Clock}>{availability}</Chip>
      </div>
      <div className="mt-3 flex gap-1.5 border-t border-white/[0.06] pt-3">
        <CardActionButton icon={ChevronRight} label="View Profile" />
        <CardActionButton icon={MessageSquare} label="Message" />
      </div>
    </ContentCard>
  );
}

// ── Services Tab ──────────────────────────────────────────────────

function ServicesTab({ onNavigateToMarketplace }: { onNavigateToMarketplace?: (providerId?: string) => void }) {
  return (
    <div>
      <div className="mb-4 rounded-lg border border-white/[0.08] bg-[rgba(8,11,14,0.90)] px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-white/60">
          <span className="font-bold text-white/65">Services</span> lists professionals promoting their general services. Looking to buy a specific product or package? Browse <span className="font-semibold text-[#d4a52c]">Marketplace</span>.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_LISTINGS.map((s) => <ServiceCard key={s.id} service={s} onViewProducts={onNavigateToMarketplace} />)}
      </div>
    </div>
  );
}

function ServiceCard({ service, onViewProducts }: { service: ServiceListing; onViewProducts?: (providerId?: string) => void }) {
  const hasProducts = MARKETPLACE_ITEMS.some((m) => m.providerId === service.id);
  return (
    <ContentCard>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono tracking-widest text-white/45 uppercase">{service.category}</span>
        {service.featured && (
          <span className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ borderColor: BORDER_GOLD, background: GOLD + '15', color: GOLD }}>
            <Star className="h-2 w-2" strokeWidth={1.5} /> Featured
          </span>
        )}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-white/90">{service.title}</h3>
      <div className="mt-0.5 text-xs text-white/55">by {service.provider}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/60">{service.description}</p>
      {service.price && <div className="mt-2 text-xs font-bold" style={{ color: GOLD }}>{service.price}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {service.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
        <CardActionButton icon={ChevronRight} label="View Service" />
        <CardActionButton icon={MessageSquare} label="Message" />
        {hasProducts && (
          <CardActionButton onClick={() => onViewProducts?.(service.id)} variant="primary" icon={ShoppingBag} label="Products" />
        )}
      </div>
    </ContentCard>
  );
}

// ── Bulletins Tab ────────────────────────────────────────────────

interface Bulletin {
  id: string;
  author: string;
  title: string;
  body: string;
  posted: string;
}

const BULLETINS: Bulletin[] = [
  { id: 'b1', author: 'MTT Stable', title: 'Looking for 3 profitable MTT players for Q4 staking', body: 'Verified results required. Coaching and bankroll management included. DM for application details.', posted: '3h ago' },
  { id: 'b2', author: 'StreamForge', title: 'Poker stream overlay pack — 50% off launch week', body: 'Professional overlay templates for Twitch and YouTube. Animated alerts, labels, and transitions included.', posted: '6h ago' },
  { id: 'b3', author: 'CardMedia Productions', title: 'Available for WSOP 2027 coverage — booking now', body: 'Full tournament photography and content production. Book early for series rates. Limited availability.', posted: '1d ago' },
  { id: 'b4', author: 'BluffBox Studio', title: 'Custom poker training app development — accepting Q4 projects', body: 'Build your own training tool with GTO integration, hand replayer, and progress tracking. React + Node stack.', posted: '2d ago' },
  { id: 'b5', author: 'Apex Poker Academy', title: 'Seeking brand ambassadors for 2027 tournament season', body: 'Looking for verified tournament players with strong social presence. Compensation includes staking + sponsorship.', posted: '3d ago' },
  { id: 'b6', author: 'PokerWire News', title: 'Partnership opportunity — poker content network launch', body: 'Established media outlet seeking content partners for a new poker-focused network. Revenue share model.', posted: '4d ago' },
];

function BulletinsTab() {
  return (
    <div className="space-y-3">
      {BULLETINS.map((b) => (
        <ContentCard key={b.id}>
          <div className="text-[9px] font-mono tracking-widest text-white/45 uppercase">{b.author} · {b.posted}</div>
          <h3 className="mt-1 text-sm font-semibold text-white/90">{b.title}</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-white/60">{b.body}</p>
          <div className="mt-3 flex gap-1.5">
            <CardActionButton label="View Bulletin" />
            <CardActionButton icon={MessageSquare} label="Contact" />
          </div>
        </ContentCard>
      ))}
    </div>
  );
}

// ── Unified Post Form ──────────────────────────────────────────────

function PostForm({ postType, onClose }: { postType: PostType; onClose: () => void }) {
  if (!postType) return null;
  const titles: Record<NonNullable<PostType>, string> = {
    job: 'Post a Job',
    candidate: 'Post Candidate Profile',
    service: 'Post a Service',
    bulletin: 'Post a Bulletin',
  };

  return (
    <div className="mb-4 rounded-xl border border-white/[0.08] bg-[rgba(8,11,14,0.95)] p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-white">{titles[postType]}</span>
        <button onClick={onClose} className="text-white/55 hover:text-white"><X className="h-4 w-4" strokeWidth={1.5} /></button>
      </div>
      {postType === 'service' && (
        <div className="mb-3 rounded-lg border border-white/[0.08] bg-[rgba(8,11,14,0.90)] px-3 py-2">
          <p className="text-[11px] leading-relaxed text-white/60">
            <span className="font-bold text-white/65">Services</span> are for promoting your general professional services. Selling a specific product or package? Post it in <span className="font-semibold text-[#d4a52c]">Marketplace</span>.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {postType === 'job' && (
          <>
            <FormField label="Company" placeholder="Company name" />
            <FormField label="Job Title" placeholder="e.g. MTT Coach" />
            <FormField label="Location" placeholder="Remote, Las Vegas, etc." />
            <FormField label="Compensation" placeholder="e.g. $80K-$120K" />
          </>
        )}
        {postType === 'candidate' && (
          <>
            <FormField label="Display Name" placeholder="Your name" />
            <FormField label="Primary Role" placeholder="e.g. MTT Coach" />
            <FormField label="Location" placeholder="Your city" />
            <FormField label="Expected Compensation" placeholder="e.g. $50/hr" />
          </>
        )}
        {postType === 'service' && (
          <>
            <FormField label="Title" placeholder="e.g. Video Editing for Streamers" />
            <FormField label="Category" placeholder="e.g. Video Editing" />
            <FormField label="Provider / Company" placeholder="Your name or company" />
            <FormField label="Price (optional)" placeholder="e.g. Starting at $350" />
          </>
        )}
        {postType === 'bulletin' && (
          <>
            <FormField label="Title" placeholder="Bulletin headline" />
            <FormField label="Author / Organization" placeholder="Your name or org" />
          </>
        )}
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/55 uppercase">Description</label>
        <textarea className="h-20 w-full rounded-lg border border-white/[0.08] bg-[rgba(8,11,14,0.90)] px-3 py-2 text-xs text-white/70 placeholder:text-white/40 focus:border-[#c091e]/30 focus:outline-none" placeholder="Describe it..." />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-white/[0.06] px-4 py-2 text-[10px] font-semibold tracking-widest text-white/50 uppercase hover:text-white">Cancel</button>
        <button className="rounded-lg border border-[#c091e]/30 bg-[#c091e]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#d4a52c] uppercase hover:bg-[#c091e]/25">Publish</button>
      </div>
    </div>
  );
}

function FormField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/55 uppercase">{label}</label>
      <input className="w-full rounded-lg border border-white/[0.08] bg-[rgba(8,11,14,0.90)] px-3 py-2 text-xs text-white/70 placeholder:text-white/40 focus:border-[#c091e]/30 focus:outline-none" placeholder={placeholder} />
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────

function Chip({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof MapPin }) {
  return (
    <span className="flex items-center gap-1 rounded border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium tracking-wide text-white/55">
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={1.5} />}
      {children}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-white/45" strokeWidth={1.5} />
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: typeof Briefcase; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-8 w-8 text-white/15" strokeWidth={1.5} />
      <p className="mt-3 text-sm text-white/55">{label}</p>
      <p className="mt-1 text-[11px] text-white/40">Check back soon or post one yourself.</p>
    </div>
  );
}
