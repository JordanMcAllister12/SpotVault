import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Users, GraduationCap, Search, ChevronRight,
  Plus, X, Check, Loader2, MapPin, Building2, Clock, Star,
  TrendingUp, BarChart3, Link2, Send, AlertCircle,
  CheckCircle2, ShieldCheck, Zap, CalendarCheck,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import { type DemoJobPosting, type DemoCandidate } from '@/data/demoJobs';
import {
  type PokerResume, type StableProfile, type StableOpportunity,
  type CoachListing, type JobPosting, type JobCandidate,
  type Credential, type AnalyticsSnapshot,
  LOOKING_FOR_OPTIONS, COACH_SPECIALTY_OPTIONS, COACH_METHOD_OPTIONS,
  STABLE_FORMAT_OPTIONS,
  fetchMyResume, fetchPublishedResumes, upsertResume,
  fetchMyStableProfile, fetchPublishedStables, upsertStableProfile,
  fetchActiveOpportunities, fetchMyOpportunities, createOpportunity, deleteOpportunity,
  fetchMyCoachListing, fetchPublishedCoaches, upsertCoachListing,
  fetchActiveJobPostings, fetchMyJobPostings, createJobPosting, deleteJobPosting,
  fetchPublishedCandidates, fetchMyCandidateProfile, upsertCandidateProfile,
} from '@/lib/jobsData';
import {
  type BookingProvider, fetchAvailableProviders, fetchServicesByProvider,
  fetchTimeSlotsByProvider, createBooking, calculateFees, getUserTimezone,
  formatPrice, formatDateTime, CATEGORY_LABELS,
} from '@/lib/booking';
import { DEMO_BOOKING_PROVIDERS, DEMO_BOOKING_SERVICES } from '@/data/demoBookingProviders';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type MainTab = 'industry-jobs' | 'stable-marketplace' | 'coaches';
type StableSubTab = 'player-pool' | 'opportunities' | 'my-resume';
type IndustrySubTab = 'jobs' | 'candidates';

interface Props {
  account: SpotVaultAccount;
}

export function JobsPage({ account }: Props) {
  const [tab, setTab] = useState<MainTab>('industry-jobs');

  return (
    <div className="network-page-content py-6 lg:py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Jobs</h1>
        <p className="mt-1 text-[13px] text-white/40">Hiring, recruiting, and coaching opportunities across the poker industry.</p>
      </div>

      {/* Main tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
        <TabButton active={tab === 'industry-jobs'} onClick={() => setTab('industry-jobs')} icon={Briefcase} label="Industry Jobs" />
        <TabButton active={tab === 'stable-marketplace'} onClick={() => setTab('stable-marketplace')} icon={Users} label="Stable Marketplace" />
        <TabButton active={tab === 'coaches'} onClick={() => setTab('coaches')} icon={GraduationCap} label="Coaching Jobs" />
      </div>

      {/* Content */}
      <div>
        {tab === 'industry-jobs' && <IndustryJobs account={account} />}
        {tab === 'stable-marketplace' && <StableMarketplace account={account} />}
        {tab === 'coaches' && <CoachesSection account={account} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Briefcase; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]"
      style={{
        background: active ? 'rgba(212,165,44,0.12)' : 'transparent',
        color: active ? GOLD_SOFT : 'rgba(255,255,255,0.4)',
        border: active ? '1px solid rgba(212,165,44,0.38)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: active ? '0 0 18px -8px rgba(212,165,44,0.55)' : 'none',
      }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  );
}

// ============================================================
// INDUSTRY JOBS
// ============================================================
function IndustryJobs({ account }: { account: SpotVaultAccount }) {
  const [subTab, setSubTab] = useState<IndustrySubTab>('jobs');
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [jobData, candidateData] = await Promise.all([fetchActiveJobPostings(), fetchPublishedCandidates()]);
    setJobs(jobData);
    setCandidates(candidateData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredJobs = jobs.filter((j) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return j.job_title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q);
  });

  const filteredCandidates = candidates.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.location || '').toLowerCase().includes(q) || c.interested_roles.some((r) => r.toLowerCase().includes(q));
  });

  const displayJobs = filteredJobs.map(j => ({
    id: j.id, company: j.company, companyAvatar: j.company.slice(0, 2).toUpperCase(),
    title: j.job_title, location: j.location || 'Remote',
    workType: (j.employment_type || 'Full-time') as DemoJobPosting['workType'],
    compensation: j.salary_range || '', description: j.job_description || '',
    skills: j.skills, postedAgo: 'Recent',
  } as DemoJobPosting));

  const displayCandidates = filteredCandidates.map(c => ({
    id: c.id, avatar: c.avatar_initials || c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
    username: '@' + c.name.toLowerCase().replace(/\s+/g, ''), displayName: c.name,
    primaryRole: c.interested_roles[0] || 'Poker Industry', bio: c.poker_background || '',
    location: c.location || 'Remote', availability: c.open_to_remote ? 'Available' : 'Contact',
    workType: 'Any', expectedComp: '', experience: '', accomplishments: [], skills: c.interested_roles,
  } as DemoCandidate));

  return (
    <div>
      {/* Sub-tabs + Post button */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-1.5 backdrop-blur-md">
        <SubTabButton active={subTab === 'jobs'} onClick={() => setSubTab('jobs')} label="Jobs" />
        <SubTabButton active={subTab === 'candidates'} onClick={() => setSubTab('candidates')} label="Candidates" />
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-bold text-[#d4a52c] transition-colors hover:bg-[#c0911e]/20">
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Post {subTab === 'jobs' ? 'Job' : 'Profile'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" strokeWidth={1.5} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${subTab === 'jobs' ? 'jobs' : 'candidates'}...`}
          className="w-full rounded-lg border border-[#232a32] bg-[#0a0c0e] py-2.5 pl-10 pr-3 text-[12px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      ) : subTab === 'jobs' ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {displayJobs.length === 0 ? (
            <EmptyState message="No job postings yet." />
          ) : (
            displayJobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => setSelectedJob({
                id: job.id, job_title: job.title, company: job.company, location: job.location,
                employment_type: job.workType, salary_range: job.compensation || null,
                job_description: job.description, skills: job.skills, account_id: '',
                status: 'active', created_at: '',
              } as JobPosting)} />
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {displayCandidates.length === 0 ? (
            <EmptyState message="No published candidate profiles yet." />
          ) : (
            displayCandidates.map((c) => (
              <CandidateCard key={c.id} candidate={c} />
            ))
          )}
        </div>
      )}

      {/* Job detail modal */}
      {selectedJob && (
        <DetailModal title={selectedJob.job_title} onClose={() => setSelectedJob(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[12px] font-bold text-white">{selectedJob.company}</span>
            </div>
            {selectedJob.location && <DetailRow icon={MapPin} label="Location" value={selectedJob.location} />}
            {selectedJob.employment_type && <DetailRow icon={Clock} label="Type" value={selectedJob.employment_type} />}
            {selectedJob.salary_range && <DetailRow icon={Zap} label="Salary" value={selectedJob.salary_range} />}
            {selectedJob.job_description && (
              <div>
                <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Description</p>
                <p className="text-[12px] leading-relaxed text-white/60">{selectedJob.job_description}</p>
              </div>
            )}
            {selectedJob.skills.length > 0 && (
              <div>
                <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {selectedJob.skills.map((s) => (
                    <span key={s} className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-medium text-white/50">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DetailModal>
      )}

      {/* Create job modal */}
      {showCreate && (
        <CreateJobModal
          accountId={account.id}
          isCandidate={subTab === 'candidates'}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateJobModal({ accountId, isCandidate, onClose, onCreated }: { accountId: string; isCandidate: boolean; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Job fields
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [employmentType, setEmploymentType] = useState('full-time');

  // Candidate fields
  const [name, setName] = useState('');
  const [pokerBackground, setPokerBackground] = useState('');
  const [interestedRoles, setInterestedRoles] = useState<string[]>([]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    if (isCandidate) {
      if (!name.trim()) { setError('Name is required.'); setSaving(false); return; }
      const result = await upsertCandidateProfile({
        account_id: accountId, name, poker_background: pokerBackground,
        interested_roles: interestedRoles, is_published: true,
      });
      if (!result) setError('Failed to create profile.');
      else onCreated();
    } else {
      if (!company.trim() || !jobTitle.trim()) { setError('Company and job title are required.'); setSaving(false); return; }
      const result = await createJobPosting({
        account_id: accountId, company, job_title: jobTitle,
        location: location || null, job_description: description || null,
        employment_type: employmentType, status: 'active',
      });
      if (!result) setError('Failed to create job posting.');
      else onCreated();
    }
    setSaving(false);
  };

  return (
    <ModalShell title={isCandidate ? 'Create Candidate Profile' : 'Post a Job'} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/40 px-4 py-2.5">
          <p className="text-[11px] leading-relaxed text-white/45">
            <span className="font-bold text-white/65">Jobs</span> are for hiring or recruiting. If you are promoting your own professional services, create a Service listing in <span className="font-semibold text-[#d4a52c]">Advertising</span> instead.
          </p>
        </div>
        {isCandidate ? (
          <>
            <Field label="Name *">
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="Your name" />
            </Field>
            <Field label="Location">
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base" placeholder="City, Country" />
            </Field>
            <Field label="Poker Background">
              <textarea value={pokerBackground} onChange={(e) => setPokerBackground(e.target.value)} rows={3} className="input-base resize-none" placeholder="Your poker experience..." />
            </Field>
            <Field label="Interested Roles">
              <div className="flex flex-wrap gap-1.5">
                {['Operations', 'Marketing', 'Content', 'Technology', 'Media', 'Community', 'Sales', 'Support'].map((r) => (
                  <Chip key={r} label={r} active={interestedRoles.includes(r)} onClick={() => setInterestedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])} />
                ))}
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label="Company *">
              <input value={company} onChange={(e) => setCompany(e.target.value)} className="input-base" placeholder="Company name" />
            </Field>
            <Field label="Job Title *">
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input-base" placeholder="Job title" />
            </Field>
            <Field label="Location">
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base" placeholder="Remote, Las Vegas, etc." />
            </Field>
            <Field label="Employment Type">
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="input-base">
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </Field>
            <Field label="Job Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="input-base resize-none" placeholder="Describe the role..." />
            </Field>
          </>
        )}
        {error && <ErrorBanner message={error} />}
        <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
          {isCandidate ? 'Publish Profile' : 'Post Job'}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// STABLE MARKETPLACE
// ============================================================
function StableMarketplace({ account }: { account: SpotVaultAccount }) {
  const [subTab, setSubTab] = useState<StableSubTab>('player-pool');
  const [resumes, setResumes] = useState<PokerResume[]>([]);
  const [opportunities, setOpportunities] = useState<StableOpportunity[]>([]);
  const [stables, setStables] = useState<StableProfile[]>([]);
  const [myResume, setMyResume] = useState<PokerResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedResume, setSelectedResume] = useState<PokerResume | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<StableOpportunity | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [resumeData, oppData, stableData, myResumeData] = await Promise.all([
      fetchPublishedResumes(),
      fetchActiveOpportunities(),
      fetchPublishedStables(),
      fetchMyResume(account.id),
    ]);
    setResumes(resumeData);
    setOpportunities(oppData);
    setStables(stableData);
    setMyResume(myResumeData);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { load(); }, [load]);

  const filteredResumes = resumes.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.display_name.toLowerCase().includes(q) || (r.bio || '').toLowerCase().includes(q) || r.looking_for.some((l) => l.toLowerCase().includes(q));
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div className="mb-4 flex items-center gap-2">
        <SubTabButton active={subTab === 'player-pool'} onClick={() => setSubTab('player-pool')} label="Player Pool" />
        <SubTabButton active={subTab === 'opportunities'} onClick={() => setSubTab('opportunities')} label="Stable Opportunities" />
        <SubTabButton active={subTab === 'my-resume'} onClick={() => setSubTab('my-resume')} label="My Poker Resume" />
      </div>

      {/* Search for pool + opportunities */}
      {(subTab === 'player-pool' || subTab === 'opportunities') && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${subTab === 'player-pool' ? 'players' : 'opportunities'}...`}
            className="w-full rounded-lg border border-[#232a32] bg-[#0a0c0e] py-2 pl-10 pr-3 text-[12px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      ) : subTab === 'player-pool' ? (
        <div className="flex flex-col gap-2">
          {filteredResumes.length === 0 ? (
            <EmptyState message="No players in the pool yet. Create your Poker Resume and publish it to appear here." />
          ) : (
            filteredResumes.map((r) => (
              <button key={r.id} onClick={() => setSelectedResume(r)} className="group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-white/[0.02]" style={{ borderColor: BORDER, background: 'rgba(12,10,8,0.92)' }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
                  {r.avatar_initials || r.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{r.display_name}</p>
                  <p className="truncate text-[11px] text-white/40">
                    {r.primary_format} Player
                    {r.abi ? ` · ABI: $${r.abi}` : ''}
                    {r.roi ? ` · ROI: ${r.roi}` : ''}
                  </p>
                  {r.analytics_attached && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 px-2 py-0.5 text-[8px] font-bold text-emerald-400/70 uppercase">
                      <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2} /> SpotVault Analytics
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {r.looking_for.length > 0 && (
                    <span className="text-[9px] text-white/30">{r.looking_for.slice(0, 2).join(', ')}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-white/20 transition-colors group-hover:text-white/50" strokeWidth={1.5} />
                </div>
              </button>
            ))
          )}
        </div>
      ) : subTab === 'opportunities' ? (
        <div className="flex flex-col gap-2">
          {opportunities.length === 0 ? (
            <EmptyState message="No stable opportunities posted yet." />
          ) : (
            opportunities.map((opp) => {
              const stable = stables.find((s) => s.id === opp.stable_id);
              return (
                <button key={opp.id} onClick={() => setSelectedOpp(opp)} className="group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-white/[0.02]" style={{ borderColor: BORDER, background: 'rgba(12,10,8,0.92)' }}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.06)' }}>
                    <Users className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-white">{opp.title}</p>
                    <p className="truncate text-[11px] text-white/40">{stable?.stable_name || 'Stable'}{opp.format ? ` · ${opp.format}` : ''}</p>
                    {opp.abi_range && <span className="text-[9px] text-white/30">ABI: {opp.abi_range}</span>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20 transition-colors group-hover:text-white/50" strokeWidth={1.5} />
                </button>
              );
            })
          )}
        </div>
      ) : (
        <PokerResumeEditor account={account} resume={myResume} onSaved={load} />
      )}

      {/* Resume detail modal */}
      {selectedResume && (
        <DetailModal title={selectedResume.display_name} onClose={() => setSelectedResume(null)}>
          <ResumeDetail resume={selectedResume} />
        </DetailModal>
      )}

      {/* Opportunity detail modal */}
      {selectedOpp && (
        <DetailModal title={selectedOpp.title} onClose={() => setSelectedOpp(null)}>
          <div className="space-y-3">
            {selectedOpp.format && <DetailRow icon={Users} label="Format" value={selectedOpp.format} />}
            {selectedOpp.abi_range && <DetailRow icon={TrendingUp} label="ABI Range" value={selectedOpp.abi_range} />}
            {selectedOpp.min_volume && <DetailRow icon={BarChart3} label="Min Volume" value={selectedOpp.min_volume} />}
            {selectedOpp.includes.length > 0 && (
              <div>
                <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Includes</p>
                <div className="flex flex-wrap gap-1">
                  {selectedOpp.includes.map((s) => (
                    <span key={s} className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-2 py-0.5 text-[9px] font-medium text-emerald-400/70">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedOpp.description && (
              <div>
                <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Description</p>
                <p className="text-[12px] leading-relaxed text-white/60">{selectedOpp.description}</p>
              </div>
            )}
          </div>
        </DetailModal>
      )}
    </div>
  );
}

function ResumeDetail({ resume }: { resume: PokerResume }) {
  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
          {resume.avatar_initials || resume.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-[14px] font-bold text-white">{resume.display_name}</p>
          <p className="text-[10px] text-white/40">{resume.primary_format} Player{resume.years_playing ? ` · ${resume.years_playing} yrs` : ''}</p>
          {resume.location && <p className="text-[10px] text-white/30">{resume.location}</p>}
        </div>
      </div>

      {/* Bio */}
      {resume.bio && <p className="text-[12px] leading-relaxed text-white/60">{resume.bio}</p>}

      {/* Analytics snapshot */}
      {resume.analytics_attached && resume.analytics_snapshot && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">SpotVault Analytics Data</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resume.analytics_snapshot.hands && <AnalyticsStat label="Hands" value={resume.analytics_snapshot.hands.toLocaleString()} />}
            {resume.analytics_snapshot.tournaments && <AnalyticsStat label="Tournaments" value={resume.analytics_snapshot.tournaments.toLocaleString()} />}
            {resume.analytics_snapshot.abi && <AnalyticsStat label="ABI" value={`$${resume.analytics_snapshot.abi}`} />}
            {resume.analytics_snapshot.roi && <AnalyticsStat label="ROI" value={`${resume.analytics_snapshot.roi}%`} />}
            {resume.analytics_snapshot.bb100 && <AnalyticsStat label="BB/100" value={resume.analytics_snapshot.bb100} />}
          </div>
          {resume.analytics_snapshot.data_through && (
            <p className="mt-2 text-[9px] text-emerald-400/50">Data through: {resume.analytics_snapshot.data_through}</p>
          )}
        </div>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {resume.abi && <StatBox label="ABI" value={`$${resume.abi}`} />}
        {resume.buy_in_range && <StatBox label="Buy-in Range" value={resume.buy_in_range} />}
        {resume.roi && <StatBox label="ROI" value={resume.roi} />}
        {resume.total_cashes && <StatBox label="Total Cashes" value={resume.total_cashes} />}
        {resume.largest_score && <StatBox label="Largest Score" value={resume.largest_score} />}
        {resume.final_tables != null && <StatBox label="Final Tables" value={String(resume.final_tables)} />}
      </div>

      {/* Looking for */}
      {resume.looking_for.length > 0 && (
        <div>
          <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Looking For</p>
          <div className="flex flex-wrap gap-1.5">
            {resume.looking_for.map((l) => (
              <span key={l} className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/8 px-2.5 py-1 text-[10px] font-medium" style={{ color: GOLD_SOFT }}>{l}</span>
            ))}
          </div>
        </div>
      )}

      {/* Looking description */}
      {resume.looking_description && (
        <div>
          <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Description</p>
          <p className="text-[12px] leading-relaxed text-white/60">{resume.looking_description}</p>
        </div>
      )}

      {/* Accomplishments */}
      {resume.accomplishments && (
        <div>
          <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Accomplishments</p>
          <p className="text-[12px] leading-relaxed text-white/60">{resume.accomplishments}</p>
        </div>
      )}

      {/* Contact button */}
      <button className="btn-primary w-full">
        <Send className="h-4 w-4" strokeWidth={1.5} /> Contact Player
      </button>
      <p className="text-center text-[9px] text-white/25">Sends an in-app inquiry via SpotVault messaging.</p>
    </div>
  );
}

function AnalyticsStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-emerald-500/10 bg-emerald-500/[0.03] px-2 py-1.5">
      <p className="text-[8px] font-semibold tracking-widest text-emerald-400/40 uppercase">{label}</p>
      <p className="text-[12px] font-bold text-emerald-300/80">{value}</p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
      <p className="text-[8px] font-semibold tracking-widest text-white/30 uppercase">{label}</p>
      <p className="text-[12px] font-bold text-white/70">{value}</p>
    </div>
  );
}

// ============================================================
// POKER RESUME EDITOR
// ============================================================
function PokerResumeEditor({ account, resume, onSaved }: { account: SpotVaultAccount; resume: PokerResume | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(resume?.display_name || account.name);
  const [username, setUsername] = useState(resume?.username || account.username);
  const [location, setLocation] = useState(resume?.location || '');
  const [bio, setBio] = useState(resume?.bio || '');
  const [yearsPlaying, setYearsPlaying] = useState(resume?.years_playing || 0);
  const [primaryFormat, setPrimaryFormat] = useState(resume?.primary_format || 'MTT');
  const [playsMtt, setPlaysMtt] = useState(resume?.plays_mtt ?? true);
  const [playsCash, setPlaysCash] = useState(resume?.plays_cash ?? false);
  const [playsLive, setPlaysLive] = useState(resume?.plays_live ?? false);
  const [playsOnline, setPlaysOnline] = useState(resume?.plays_online ?? true);
  const [abi, setAbi] = useState(resume?.abi?.toString() || '');
  const [buyInRange, setBuyInRange] = useState(resume?.buy_in_range || '');
  const [tournamentsPerMonth, setTournamentsPerMonth] = useState(resume?.tournaments_per_month?.toString() || '');
  const [roi, setRoi] = useState(resume?.roi || '');
  const [totalCashes, setTotalCashes] = useState(resume?.total_cashes || '');
  const [largestScore, setLargestScore] = useState(resume?.largest_score || '');
  const [finalTables, setFinalTables] = useState(resume?.final_tables?.toString() || '');
  const [accomplishments, setAccomplishments] = useState(resume?.accomplishments || '');
  const [lookingFor, setLookingFor] = useState<string[]>(resume?.looking_for || []);
  const [lookingDescription, setLookingDescription] = useState(resume?.looking_description || '');
  const [isPublished, setIsPublished] = useState(resume?.is_published ?? false);
  const [isLooking, setIsLooking] = useState(resume?.is_looking ?? false);
  const [analyticsAttached, setAnalyticsAttached] = useState(resume?.analytics_attached ?? false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await upsertResume({
      account_id: account.id,
      display_name: displayName,
      username,
      avatar_initials: displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      location: location || null,
      bio: bio || null,
      years_playing: yearsPlaying,
      primary_format: primaryFormat,
      plays_mtt: playsMtt, plays_cash: playsCash, plays_live: playsLive, plays_online: playsOnline,
      abi: abi ? parseInt(abi) : null,
      buy_in_range: buyInRange || null,
      tournaments_per_month: tournamentsPerMonth ? parseInt(tournamentsPerMonth) : null,
      roi: roi || null,
      total_cashes: totalCashes || null,
      largest_score: largestScore || null,
      final_tables: finalTables ? parseInt(finalTables) : null,
      accomplishments: accomplishments || null,
      looking_for: lookingFor,
      looking_description: lookingDescription || null,
      analytics_attached: analyticsAttached,
      analytics_snapshot: analyticsAttached ? {
        hands: 7028, tournaments: 119, abi: parseInt(abi) || 150,
        roi: roi || '22', data_through: 'August 2026',
      } : null,
      is_published: isPublished,
      is_looking: isLooking,
    });
    if (result) {
      setSavedMsg('Resume saved');
      setTimeout(() => setSavedMsg(null), 2000);
      onSaved();
    } else {
      setError('Failed to save resume.');
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Basic Info */}
      <Section title="Basic Information">
        <Field label="Display Name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-base" /></Field>
        <Field label="SpotVault Username"><input value={username} onChange={(e) => setUsername(e.target.value)} className="input-base" /></Field>
        <Field label="Location (optional)"><input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base" placeholder="City, Country" /></Field>
        <Field label="Short Poker Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="input-base resize-none" placeholder="Brief poker bio..." /></Field>
      </Section>

      {/* Experience */}
      <Section title="Poker Experience">
        <Field label="Years Playing"><input type="number" value={yearsPlaying} onChange={(e) => setYearsPlaying(parseInt(e.target.value) || 0)} className="input-base" /></Field>
        <Field label="Primary Format">
          <select value={primaryFormat} onChange={(e) => setPrimaryFormat(e.target.value)} className="input-base">
            <option value="MTT">MTT</option><option value="Cash">Cash</option><option value="Mixed">Mixed</option>
          </select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Checkbox label="MTT" checked={playsMtt} onChange={setPlaysMtt} />
          <Checkbox label="Cash" checked={playsCash} onChange={setPlaysCash} />
          <Checkbox label="Live" checked={playsLive} onChange={setPlaysLive} />
          <Checkbox label="Online" checked={playsOnline} onChange={setPlaysOnline} />
        </div>
      </Section>

      {/* Tournament Info */}
      <Section title="Tournament Information">
        <Field label="ABI ($)"><input type="number" value={abi} onChange={(e) => setAbi(e.target.value)} className="input-base" /></Field>
        <Field label="Typical Buy-in Range"><input value={buyInRange} onChange={(e) => setBuyInRange(e.target.value)} className="input-base" placeholder="$50-$500" /></Field>
        <Field label="Tournaments/Month"><input type="number" value={tournamentsPerMonth} onChange={(e) => setTournamentsPerMonth(e.target.value)} className="input-base" /></Field>
      </Section>

      {/* Results */}
      <Section title="Results (Self-Reported)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ROI"><input value={roi} onChange={(e) => setRoi(e.target.value)} className="input-base" placeholder="22%" /></Field>
          <Field label="Total Cashes"><input value={totalCashes} onChange={(e) => setTotalCashes(e.target.value)} className="input-base" placeholder="$45,000" /></Field>
          <Field label="Largest Score"><input value={largestScore} onChange={(e) => setLargestScore(e.target.value)} className="input-base" placeholder="$12,000" /></Field>
          <Field label="Final Tables"><input type="number" value={finalTables} onChange={(e) => setFinalTables(e.target.value)} className="input-base" /></Field>
        </div>
        <Field label="Accomplishments"><textarea value={accomplishments} onChange={(e) => setAccomplishments(e.target.value)} rows={3} className="input-base resize-none" placeholder="Tournament wins, major final tables, live titles..." /></Field>
      </Section>

      {/* Analytics */}
      <Section title="SpotVault Analytics">
        <ToggleRow
          label="Attach SpotVault Analytics"
          description="Share verified analytics from your SpotVault data. You choose what to share."
          checked={analyticsAttached}
          onChange={setAnalyticsAttached}
        />
        {analyticsAttached && (
          <div className="ml-4 rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">SpotVault Analytics Data</span>
            </div>
            <p className="mt-1 text-[10px] text-emerald-400/50">Statistics will be labeled as SpotVault Analytics Data on your public resume. Self-entered stats remain labeled as self-reported.</p>
          </div>
        )}
      </Section>

      {/* Looking For */}
      <Section title="What I'm Looking For">
        <Field label="Looking For">
          <div className="flex flex-wrap gap-1.5">
            {LOOKING_FOR_OPTIONS.map((l) => (
              <Chip key={l} label={l} active={lookingFor.includes(l)} onClick={() => setLookingFor((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l])} />
            ))}
          </div>
        </Field>
        <Field label="Description"><textarea value={lookingDescription} onChange={(e) => setLookingDescription(e.target.value)} rows={2} className="input-base resize-none" placeholder="What kind of backing are you looking for?" /></Field>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <ToggleRow label="Available to Stables" description="Publish your resume to the Player Pool for stable discovery" checked={isPublished} onChange={setIsPublished} />
        <ToggleRow label="Currently Looking" description="Show that you are actively seeking backing" checked={isLooking} onChange={setIsLooking} />
      </Section>

      {error && <ErrorBanner message={error} />}
      {savedMsg && <SavedBanner message={savedMsg} />}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
        Save Resume
      </button>
    </div>
  );
}

// ============================================================
// COACHES SECTION
// ============================================================
function CoachesSection({ account }: { account: SpotVaultAccount }) {
  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [bookingProviders, setBookingProviders] = useState<BookingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCoach, setSelectedCoach] = useState<CoachListing | null>(null);
  const [filterSpecialty, setFilterSpecialty] = useState<string>('');
  const [showMyListing, setShowMyListing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [coachData, providerData] = await Promise.all([
      fetchPublishedCoaches(),
      fetchAvailableProviders(),
    ]);
    setCoaches(coachData);
    setBookingProviders(providerData.length > 0 ? providerData : DEMO_BOOKING_PROVIDERS);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCoaches = coaches.filter((c) => {
    if (!search && !filterSpecialty) return true;
    const q = search.toLowerCase();
    const matchesSearch = !search || c.display_name.toLowerCase().includes(q) || (c.bio || '').toLowerCase().includes(q) || c.specialties.some((s) => s.toLowerCase().includes(q));
    const matchesSpecialty = !filterSpecialty || c.specialties.includes(filterSpecialty);
    return matchesSearch && matchesSpecialty;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1" />
        <button onClick={() => setShowMyListing(true)} className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-bold text-[#d4a52c] transition-colors hover:bg-[#c0911e]/20">
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> My Coach Listing
        </button>
      </div>
      <div className="mb-4 rounded-lg border border-[#1a1f25] bg-[#11151a]/40 px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-white/45">
          <span className="font-bold text-white/65">Coaching Jobs</span> lists opportunities <em>for</em> coaches — stables, businesses, and clients seeking to hire. If you are promoting your own coaching services, create a Service listing in <span className="font-semibold text-[#d4a52c]">Advertising</span> instead.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" strokeWidth={1.5} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search coaches..."
          className="w-full rounded-lg border border-[#232a32] bg-[#0a0c0e] py-2 pl-10 pr-3 text-[12px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
        />
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterPill label="All" active={!filterSpecialty} onClick={() => setFilterSpecialty('')} />
        {COACH_SPECIALTY_OPTIONS.slice(0, 8).map((s) => (
          <FilterPill key={s} label={s} active={filterSpecialty === s} onClick={() => setFilterSpecialty(filterSpecialty === s ? '' : s)} />
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
      ) : filteredCoaches.length === 0 ? (
        <EmptyState message="No coach listings yet. Coaches can create a listing to appear in the directory." />
      ) : (
        <div className="flex flex-col gap-2">
          {filteredCoaches.map((c) => (
            <button key={c.id} onClick={() => setSelectedCoach(c)} className="group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-white/[0.02]" style={{ borderColor: BORDER, background: 'rgba(12,10,8,0.92)' }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
                {c.avatar_initials || c.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white">{c.display_name}</p>
                <p className="truncate text-[11px] text-white/40">{c.specialties.slice(0, 3).join(' · ')}</p>
                {c.availability_summary && <p className="truncate text-[9px] text-white/25">Next: {c.availability_summary}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.rate_per_hour > 0 && <span className="text-[12px] font-bold" style={{ color: GOLD }}>${c.rate_per_hour}/hr</span>}
                <ChevronRight className="h-4 w-4 text-white/20 transition-colors group-hover:text-white/50" strokeWidth={1.5} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Coach profile modal */}
      {selectedCoach && (
        <CoachProfileModal coach={selectedCoach} account={account} bookingProviders={bookingProviders} onClose={() => setSelectedCoach(null)} />
      )}

      {/* My coach listing editor */}
      {showMyListing && (
        <CoachListingEditor account={account} onClose={() => setShowMyListing(false)} onSaved={() => { setShowMyListing(false); load(); }} />
      )}
    </div>
  );
}

function CoachProfileModal({ coach, account, bookingProviders, onClose }: { coach: CoachListing; account: SpotVaultAccount; bookingProviders: BookingProvider[]; onClose: () => void }) {
  const [booking, setBooking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const slug = coach.shareable_slug || coach.username || coach.account_id;
    const url = `${window.location.origin}/?coach=${slug}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DetailModal title={coach.display_name} onClose={onClose}>
      <div className="space-y-4">
        {/* Avatar + bio */}
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
            {coach.avatar_initials || coach.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[14px] font-bold text-white">{coach.display_name}</p>
            {coach.username && <p className="text-[10px] text-white/30">@{coach.username}</p>}
          </div>
        </div>
        {coach.bio && <p className="text-[12px] leading-relaxed text-white/60">{coach.bio}</p>}

        {/* Specialties */}
        {coach.specialties.length > 0 && (
          <div>
            <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Specialties</p>
            <div className="flex flex-wrap gap-1.5">
              {coach.specialties.map((s) => (
                <span key={s} className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/8 px-2.5 py-1 text-[10px] font-medium" style={{ color: GOLD_SOFT }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Rate */}
        {coach.rate_per_hour > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 px-3 py-2">
            <Zap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[10px] font-bold tracking-widest text-[#d4a52c]/70 uppercase">Rate</span>
            <span className="text-[14px] font-bold" style={{ color: GOLD }}>${coach.rate_per_hour}/hour</span>
          </div>
        )}

        {/* Availability */}
        {coach.availability_summary && (
          <DetailRow icon={Clock} label="Availability" value={coach.availability_summary} />
        )}

        {/* Methods */}
        {coach.coaching_methods.length > 0 && (
          <div>
            <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Coaching Methods</p>
            <div className="flex flex-wrap gap-1.5">
              {coach.coaching_methods.map((m) => (
                <span key={m} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-white/50">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Accomplishments */}
        {coach.accomplishments && (
          <div>
            <p className="mb-1 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Accomplishments</p>
            <p className="text-[12px] leading-relaxed text-white/60">{coach.accomplishments}</p>
          </div>
        )}

        {/* Share link */}
        <button onClick={handleCopyLink} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold text-white/60 transition-colors hover:bg-white/10">
          {copied ? <Check className="h-4 w-4 text-emerald-400" strokeWidth={1.5} /> : <Link2 className="h-4 w-4" strokeWidth={1.5} />}
          {copied ? 'Copied!' : 'Copy Booking Link'}
        </button>

        {/* Book coach */}
        {!booking ? (
          <button onClick={() => setBooking(true)} className="btn-primary w-full">
            <CalendarCheck className="h-4 w-4" strokeWidth={1.5} /> Book Coach
          </button>
        ) : (
          <CoachBookingForm coach={coach} account={account} bookingProviders={bookingProviders} />
        )}
      </div>
    </DetailModal>
  );
}

function CoachBookingForm({ coach, account, bookingProviders }: { coach: CoachListing; account: SpotVaultAccount; bookingProviders: BookingProvider[] }) {
  const [duration, setDuration] = useState(coach.session_durations[0] || 60);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [sessionType, setSessionType] = useState(coach.coaching_methods[0] || 'Video');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const total = Math.round((coach.rate_per_hour * duration) / 60);

  const handleSubmit = async () => {
    if (!date || !time) { setError('Please select a date and time.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const startIso = new Date(`${date}T${time}:00`).toISOString();
      const endDate = new Date(startIso);
      endDate.setMinutes(endDate.getMinutes() + duration);
      const { booking, error: bookingError } = await createBooking({
        provider_account_id: coach.account_id,
        requester_account_id: account.id,
        provider_id: bookingProviders.find((p) => p.account_id === coach.account_id)?.id || bookingProviders[0]?.id || '',
        service_id: null,
        service_name: `Coaching with ${coach.display_name}`,
        service_type: 'COACHING',
        start_time: startIso,
        end_time: endDate.toISOString(),
        duration_minutes: duration,
        price_credits: total,
        platform_fee_credits: Math.round(total * 0.2),
        provider_payout_credits: Math.round(total * 0.8),
        payment_status: 'pending',
        booking_status: 'requested',
        request_type: 'paid',
        message: message || null,
        company: null,
        suggested_new_time: null,
      });
      if (bookingError || !booking) { setError(bookingError || 'Failed to create booking.'); }
      else { setSuccess(true); }
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" strokeWidth={1.5} />
        <p className="text-[13px] font-bold text-white">Booking Request Sent</p>
        <p className="text-[11px] text-white/40">Your coaching request has been submitted. You'll be notified when the coach responds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-[#0a0c0e] p-4">
      <p className="text-[11px] font-bold text-white">Book a Session</p>
      <Field label="Duration">
        <div className="flex gap-1.5">
          {(coach.session_durations.length > 0 ? coach.session_durations : [60]).map((d) => (
            <button key={d} onClick={() => setDuration(d)} className="flex-1 rounded-md border py-2 text-[11px] font-bold transition-all" style={{ borderColor: duration === d ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)', background: duration === d ? 'rgba(212,165,44,0.12)' : 'transparent', color: duration === d ? GOLD_SOFT : 'rgba(255,255,255,0.5)' }}>
              {d < 60 ? `${d}min` : `${d / 60}h`}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="input-base" style={{ colorScheme: 'dark' }} /></Field>
      <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-base" style={{ colorScheme: 'dark' }} /></Field>
      <Field label="Session Type">
        <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="input-base">
          {(coach.coaching_methods.length > 0 ? coach.coaching_methods : COACH_METHOD_OPTIONS).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="What would you like help with?"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="input-base resize-none" placeholder="Tournament database review..." /></Field>
      <div className="flex items-center justify-between rounded-md border border-[#1a1f25] bg-[#0a0c0e] px-3 py-2">
        <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">Estimated Total</span>
        <span className="text-[16px] font-bold" style={{ color: GOLD }}>${total > 0 ? total.toLocaleString() : 'Free'}</span>
      </div>
      {error && <ErrorBanner message={error} />}
      <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
        Request / Reserve Session
      </button>
      <p className="text-center text-[9px] text-white/25">Booking will be created as pending. No payment until coach accepts.</p>
    </div>
  );
}

function CoachListingEditor({ account, onClose, onSaved }: { account: SpotVaultAccount; onClose: () => void; onSaved: () => void }) {
  const [existing, setExisting] = useState<CoachListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(account.name);
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [ratePerHour, setRatePerHour] = useState('0');
  const [accomplishments, setAccomplishments] = useState('');
  const [availabilitySummary, setAvailabilitySummary] = useState('');
  const [methods, setMethods] = useState<string[]>(['Video']);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchMyCoachListing(account.id);
      setExisting(data);
      if (data) {
        setDisplayName(data.display_name);
        setBio(data.bio || '');
        setSpecialties(data.specialties);
        setRatePerHour(data.rate_per_hour.toString());
        setAccomplishments(data.accomplishments || '');
        setAvailabilitySummary(data.availability_summary || '');
        setMethods(data.coaching_methods.length > 0 ? data.coaching_methods : ['Video']);
        setIsPublished(data.is_published);
      }
      setLoading(false);
    })();
  }, [account.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const slug = account.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const result = await upsertCoachListing({
      account_id: account.id,
      display_name: displayName,
      username: account.username,
      avatar_initials: displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      bio: bio || null,
      specialties,
      rate_per_hour: parseInt(ratePerHour) || 0,
      session_durations: [30, 60, 120],
      coaching_methods: methods,
      accomplishments: accomplishments || null,
      availability_summary: availabilitySummary || null,
      is_published: isPublished,
      shareable_slug: slug,
    });
    if (result) { onSaved(); }
    else { setError('Failed to save coach listing.'); }
    setSaving(false);
  };

  if (loading) return <ModalShell title="My Coach Listing" onClose={onClose}><Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} /></ModalShell>;

  return (
    <ModalShell title="My Coach Listing" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Display Name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-base" /></Field>
        <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input-base resize-none" placeholder="Short coaching bio..." /></Field>
        <Field label="Specialties">
          <div className="flex flex-wrap gap-1.5">
            {COACH_SPECIALTY_OPTIONS.map((s) => (
              <Chip key={s} label={s} active={specialties.includes(s)} onClick={() => setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} />
            ))}
          </div>
        </Field>
        <Field label="Rate per Hour ($)"><input type="number" value={ratePerHour} onChange={(e) => setRatePerHour(e.target.value)} className="input-base" /></Field>
        <Field label="Coaching Methods">
          <div className="flex flex-wrap gap-1.5">
            {COACH_METHOD_OPTIONS.map((m) => (
              <Chip key={m} label={m} active={methods.includes(m)} onClick={() => setMethods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])} />
            ))}
          </div>
        </Field>
        <Field label="Accomplishments"><textarea value={accomplishments} onChange={(e) => setAccomplishments(e.target.value)} rows={3} className="input-base resize-none" placeholder="Poker results, coaching experience, students coached..." /></Field>
        <Field label="Availability Summary"><input value={availabilitySummary} onChange={(e) => setAvailabilitySummary(e.target.value)} className="input-base" placeholder="Tue/Thu 3-7 PM ET" /></Field>
        <ToggleRow label="Published" description="Make your coach listing visible in the directory" checked={isPublished} onChange={setIsPublished} />
        {error && <ErrorBanner message={error} />}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={1.5} />}
          Save Listing
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// PREMIUM JOB CARD
// ============================================================
const COMPANY_COLORS: Record<string, string> = {
  'Apex Poker Academy': '#e0457a',
  'DeepStack Cash Lab': '#3b82f6',
  'StreamForge Media': '#f97316',
  'CardMedia Productions': '#22c55e',
  'SpotVault': '#d4a52c',
  'Northern Lights Stable': '#06b6d4',
  'GTO Edge Analytics': '#8b5cf6',
  'HandHistory Pro': '#ec4899',
  'BluffBox Studio': '#f43f5e',
  'PokerWire News': '#14b8a6',
};

function getCompanyColor(company: string): string {
  return COMPANY_COLORS[company] || '#71717a';
}

function JobCard({ job, onClick }: { job: DemoJobPosting; onClick: () => void }) {
  const color = getCompanyColor(job.company);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:border-[#c0911e]/30 hover:bg-white/[0.02]"
      style={{ borderColor: BORDER, background: 'rgba(10,12,14,0.85)' }}
    >
      <div className="flex items-start gap-3">
        {/* Company thumbnail */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, boxShadow: `0 2px 12px ${color}40` }}
        >
          {job.companyAvatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-white">{job.title}</p>
          <p className="truncate text-[11px] font-medium" style={{ color: color + 'cc' }}>{job.company}</p>
        </div>
        <span className="shrink-0 text-[9px] font-mono text-white/30">{job.postedAgo}</span>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" strokeWidth={1.5} /> {job.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" strokeWidth={1.5} /> {job.workType}
        </span>
        {job.compensation && (
          <span className="flex items-center gap-1 font-medium" style={{ color: GOLD }}>
            <Zap className="h-3 w-3" strokeWidth={1.5} /> {job.compensation}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/45">{job.description}</p>

      {/* Skills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.skills.slice(0, 4).map((s) => (
          <span key={s} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-white/40">{s}</span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-[9px] font-mono tracking-widest text-white/25 uppercase">{job.workType}</span>
        <span className="flex items-center gap-1 text-[10px] font-bold transition-colors" style={{ color: GOLD }}>
          View Job <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
        </span>
      </div>
    </button>
  );
}

// ============================================================
// PREMIUM CANDIDATE CARD
// ============================================================
function CandidateCard({ candidate }: { candidate: DemoCandidate }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="group flex flex-col rounded-xl border p-4 transition-all hover:border-[#c0911e]/30 hover:bg-white/[0.02]"
        style={{ borderColor: BORDER, background: 'rgba(10,12,14,0.85)' }}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
            {candidate.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{candidate.displayName}</p>
            <p className="truncate text-[11px] text-white/40">{candidate.primaryRole}</p>
            <p className="truncate text-[9px] text-white/25">{candidate.username}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.5} /> {candidate.location}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.5} /> {candidate.availability}
          </span>
        </div>

        {/* Bio */}
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/45">{candidate.bio}</p>

        {/* Skills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-white/40">{s}</span>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
          {candidate.expectedComp ? (
            <span className="text-[10px] font-bold" style={{ color: GOLD }}>{candidate.expectedComp}</span>
          ) : (
            <span className="text-[9px] font-mono tracking-widest text-white/25 uppercase">{candidate.workType}</span>
          )}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[10px] font-bold transition-colors"
            style={{ color: GOLD }}
          >
            View Profile <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {open && (
        <DetailModal title={candidate.displayName} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
                {candidate.avatar}
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">{candidate.displayName}</p>
                <p className="text-[10px] text-white/40">{candidate.primaryRole}</p>
                <p className="text-[10px] text-white/30">{candidate.username}</p>
              </div>
            </div>
            {candidate.bio && <p className="text-[12px] leading-relaxed text-white/60">{candidate.bio}</p>}
            <div className="grid grid-cols-2 gap-2">
              {candidate.location && <StatBox label="Location" value={candidate.location} />}
              {candidate.availability && <StatBox label="Availability" value={candidate.availability} />}
              {candidate.workType && <StatBox label="Work Type" value={candidate.workType} />}
              {candidate.expectedComp && <StatBox label="Expected Comp" value={candidate.expectedComp} />}
              {candidate.experience && <StatBox label="Experience" value={candidate.experience} />}
            </div>
            {candidate.accomplishments.length > 0 && (
              <div>
                <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Accomplishments</p>
                <div className="flex flex-col gap-1">
                  {candidate.accomplishments.map((a) => (
                    <div key={a} className="flex items-center gap-2">
                      <Star className="h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                      <span className="text-[11px] text-white/60">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {candidate.skills.length > 0 && (
              <div>
                <p className="mb-1.5 text-[9px] font-semibold tracking-widest text-white/40 uppercase">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((s) => (
                    <span key={s} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/50">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <button className="btn-primary w-full">
              <Send className="h-4 w-4" strokeWidth={1.5} /> Contact Candidate
            </button>
          </div>
        </DetailModal>
      )}
    </>
  );
}

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

function SubTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="rounded-lg border px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]" style={{ background: active ? 'rgba(212,165,44,0.12)' : 'rgba(0,0,0,0.18)', color: active ? GOLD_SOFT : 'rgba(255,255,255,0.58)', border: active ? '1px solid rgba(212,165,44,0.38)' : '1px solid rgba(255,255,255,0.08)', boxShadow: active ? '0 0 18px -8px rgba(212,165,44,0.55)' : 'none' }}>
      {label}
    </button>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all" style={{ borderColor: active ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)', background: active ? 'rgba(212,165,44,0.12)' : 'transparent', color: active ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}>
      {label}
    </button>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all" style={{ borderColor: active ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)', background: active ? 'rgba(212,165,44,0.12)' : 'transparent', color: active ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}>
      {label}
    </button>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center rounded border" style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.15)', background: checked ? 'rgba(212,165,44,0.15)' : 'transparent' }}>
        {checked && <Check className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />}
      </div>
      <span className="text-[11px] text-white/60">{label}</span>
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-[11px] font-bold text-white/80">{label}</p><p className="text-[9px] text-white/30">{description}</p></div>
      <button onClick={() => onChange(!checked)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: checked ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: checked ? '22px' : '2px' }} />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: 'rgba(12,10,8,0.92)' }}>
      <p className="mb-3 text-[11px] font-bold tracking-widest text-white/60 uppercase">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
      <span className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">{label}</span>
      <span className="text-[12px] text-white/60">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="max-w-sm text-[12px] leading-relaxed text-white/35">{message}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
      <p className="text-[10px] text-red-300/70">{message}</p>
    </div>
  );
}

function SavedBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2">
      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={1.5} />
      <p className="text-[10px] text-emerald-300/70">{message}</p>
    </div>
  );
}

function DetailModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[91] max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-[#0b0a08] p-5 shadow-2xl" style={{ borderColor: BORDER }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-white">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white/80">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[91] max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-[#0b0a08] p-5 shadow-2xl" style={{ borderColor: BORDER }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-white">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white/80">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
