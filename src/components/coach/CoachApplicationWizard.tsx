import { useState, useEffect, useCallback } from 'react';
import {
  Check, ChevronRight, ChevronLeft, Save, Send, FileText,
  Trophy, Target, DollarSign, Clock, Award, User, Mail, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const PANEL_BG = 'rgba(8,10,12,0.82)';

interface Props {
  account: { id: string; name: string };
  onSubmitted?: () => void;
}

const GAME_TYPES = ['MTT', 'Cash', 'Spin & Go', 'Sit & Go', 'Mixed Games', 'Live Poker'];
const COACHING_SPECIALTIES = [
  'Hand History Review', 'Database Review', 'Leak Finding', 'GTO / Solver Work',
  'Exploitative Strategy', 'Tournament Review', 'Final Table Review', 'ICM',
  'Preflop Strategy', 'Postflop Strategy', 'Mental Game', 'Bankroll Management',
  'Study Planning', 'Live Sessions / Sweats',
];

type ApplicationData = {
  identity: {
    display_name: string;
    real_name: string;
    location: string;
    timezone: string;
    languages: string[];
    poker_usernames: { site: string; username: string }[];
    profile_photo_url: string;
  };
  poker_results: {
    primary_format: string;
    stakes_coached: string[];
    accomplishments: string;
    years_playing: number;
    total_cashes: string;
    estimated_profit: string;
    roi: string;
    largest_score: string;
    evidence_links: string[];
  };
  experience: {
    years_coaching: number;
    previous_students: number;
    student_success_stories: string;
    coaching_methods: string[];
    coaching_includes: string[];
  };
  specialties: {
    game_types: string[];
    coaching_specialties: string[];
    coaching_philosophy: string;
  };
  pricing: {
    rate_per_hour: number;
    currency: string;
    min_session_length: number;
    package_pricing: { name: string; sessions: number; price: number }[];
    custom_pricing: boolean;
  };
  availability: {
    available_for_coaching: boolean;
    hours_per_week: number;
    preferred_days: string[];
    availability_notes: string;
  };
};

const DEFAULT_DATA: ApplicationData = {
  identity: {
    display_name: '', real_name: '', location: '', timezone: '', languages: [],
    poker_usernames: [], profile_photo_url: '',
  },
  poker_results: {
    primary_format: '', stakes_coached: [], accomplishments: '', years_playing: 0,
    total_cashes: '', estimated_profit: '', roi: '', largest_score: '', evidence_links: [],
  },
  experience: {
    years_coaching: 0, previous_students: 0, student_success_stories: '',
    coaching_methods: [], coaching_includes: [],
  },
  specialties: {
    game_types: [], coaching_specialties: [], coaching_philosophy: '',
  },
  pricing: {
    rate_per_hour: 0, currency: 'USD', min_session_length: 30,
    package_pricing: [], custom_pricing: false,
  },
  availability: {
    available_for_coaching: true, hours_per_week: 0, preferred_days: [],
    availability_notes: '',
  },
};

const STEPS = [
  { id: 'identity', label: 'Identity', icon: User },
  { id: 'poker_results', label: 'Poker Results', icon: Trophy },
  { id: 'experience', label: 'Experience', icon: Award },
  { id: 'specialties', label: 'Specialties', icon: Target },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'availability', label: 'Availability', icon: Clock },
] as const;

function toggleArrayItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? '28px' : '14px',
            background: i <= current ? GOLD : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </div>
  );
}

export function CoachApplicationWizard({ account, onSubmitted }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ApplicationData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('draft');
  const [staffNotes, setStaffNotes] = useState('');
  const [error, setError] = useState('');
  const [newStake, setNewStake] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newEvidence, setNewEvidence] = useState('');
  const [newPackage, setNewPackage] = useState({ name: '', sessions: 1, price: 0 });
  const [newUsername, setNewUsername] = useState({ site: '', username: '' });
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const loadApplication = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? account.id;

    const { data: existing } = await supabase
      .from('coach_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setApplicationId(existing.id);
      setStatus(existing.status);
      setStaffNotes(existing.staff_notes ?? '');
      if (existing.application_data) {
        setData({ ...DEFAULT_DATA, ...(existing.application_data as ApplicationData) });
      }
    } else {
      setData((d) => ({ ...d, identity: { ...d.identity, display_name: account.name } }));
    }
    setLoading(false);
  }, [account.id, account.name]);

  useEffect(() => { void loadApplication(); }, [loadApplication]);

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? account.id;
    const payload = { user_id: userId, status: 'draft', application_data: data as unknown as Record<string, unknown> };

    if (applicationId) {
      const { error: updErr } = await supabase
        .from('coach_applications')
        .update({ application_data: payload.application_data })
        .eq('id', applicationId);
      if (updErr) setError(updErr.message);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('coach_applications')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (insErr) setError(insErr.message);
      else if (inserted) setApplicationId(inserted.id);
    }
    setSaving(false);
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? account.id;

    const payload = { user_id: userId, status: 'submitted', application_data: data as unknown as Record<string, unknown> };

    if (applicationId) {
      const { error: updErr } = await supabase
        .from('coach_applications')
        .update({ status: 'submitted', application_data: payload.application_data })
        .eq('id', applicationId);
      if (updErr) setError(updErr.message);
      else { setStatus('submitted'); onSubmitted?.(); }
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('coach_applications')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (insErr) setError(insErr.message);
      else if (inserted) { setStatus('submitted'); setApplicationId(inserted.id); onSubmitted?.(); }
    }
    setSubmitting(false);
  };

  const update = <K extends keyof ApplicationData>(section: K, field: string, value: unknown) => {
    setData((d) => ({ ...d, [section]: { ...d[section], [field]: value } }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[11px] text-white/40">Loading application...</div>;
  }

  if (status === 'submitted' || status === 'under_review' || status === 'approved' || status === 'rejected' || status === 'changes_requested') {
    return <ApplicationStatus status={status} staffNotes={staffNotes} onEdit={status === 'changes_requested' ? () => setStatus('draft') : undefined} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header */}
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: PANEL_BG, backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <h3 className="text-sm font-bold text-white">Coach Application</h3>
            </div>
            <StepIndicator current={step} total={STEPS.length} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/40">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>·</span>
            <span style={{ color: GOLD }}>{STEPS[step].label}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: PANEL_BG, backdropFilter: 'blur(8px)' }}>
          {step === 0 && <IdentityStep data={data} update={update} newLanguage={newLanguage} setNewLanguage={setNewLanguage} newUsername={newUsername} setNewUsername={setNewUsername} />}
          {step === 1 && <PokerResultsStep data={data} update={update} newStake={newStake} setNewStake={setNewStake} newEvidence={newEvidence} setNewEvidence={setNewEvidence} />}
          {step === 2 && <ExperienceStep data={data} update={update} />}
          {step === 3 && <SpecialtiesStep data={data} update={update} />}
          {step === 4 && <PricingStep data={data} update={update} newPackage={newPackage} setNewPackage={setNewPackage} />}
          {step === 5 && <AvailabilityStep data={data} update={update} days={DAYS} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#84929f] transition hover:border-[#c0911e]/40 hover:text-[#d4a52c]">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button onClick={() => void saveDraft()} disabled={saving} className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#84929f] transition hover:border-[#c0911e]/40 hover:text-[#d4a52c] disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition hover:scale-105" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={() => void submit()} disabled={submitting} className="flex items-center gap-1 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition hover:scale-105 disabled:opacity-50" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
              <Send className="h-3.5 w-3.5" /> {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATUS VIEW (post-submission)
// ═══════════════════════════════════════════════════════════════

function ApplicationStatus({ status, staffNotes, onEdit }: { status: string; staffNotes: string; onEdit?: () => void }) {
  const statusConfig: Record<string, { label: string; color: string; desc: string }> = {
    submitted: { label: 'Submitted', color: '#60a5fa', desc: 'Your application has been submitted and is awaiting staff review. You will be notified once a decision is made.' },
    under_review: { label: 'Under Review', color: '#fbbf24', desc: 'Our team is currently reviewing your application. This typically takes 2-3 business days.' },
    approved: { label: 'Approved', color: '#4ade80', desc: 'Congratulations! Your coach application has been approved. You can now build your coaching profile.' },
    rejected: { label: 'Not Approved', color: '#f87171', desc: 'Your application was not approved at this time. You may reapply in the future with additional evidence.' },
    changes_requested: { label: 'Changes Requested', color: '#fbbf24', desc: 'Staff has requested changes to your application. Please review the notes below and update your application.' },
  };
  const cfg = statusConfig[status] ?? statusConfig.submitted;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: BORDER, background: PANEL_BG, backdropFilter: 'blur(8px)' }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${cfg.color}20`, border: `2px solid ${cfg.color}` }}>
            <Check className="h-8 w-8" style={{ color: cfg.color }} strokeWidth={2} />
          </div>
          <h3 className="text-lg font-bold text-white">{cfg.label}</h3>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-white/55">{cfg.desc}</p>
          {staffNotes && (
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/30 p-3 text-left">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#5f6e7c]">Staff Notes</div>
              <p className="text-[11px] leading-relaxed text-white/70">{staffNotes}</p>
            </div>
          )}
          {onEdit && (
            <button onClick={onEdit} className="mt-4 flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition hover:scale-105 mx-auto" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
              Edit Application
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-[#232a32] bg-[#11151a] px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/40';

function IdentityStep({ data, update, newLanguage, setNewLanguage, newUsername, setNewUsername }: {
  data: ApplicationData; update: <K extends keyof ApplicationData>(s: K, f: string, v: unknown) => void;
  newLanguage: string; setNewLanguage: (v: string) => void;
  newUsername: { site: string; username: string }; setNewUsername: (v: { site: string; username: string }) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-white">Identity & Contact</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Display Name"><input value={data.identity.display_name} onChange={(e) => update('identity', 'display_name', e.target.value)} className={inputClass} placeholder="Your coaching name" /></Field>
        <Field label="Real Name"><input value={data.identity.real_name} onChange={(e) => update('identity', 'real_name', e.target.value)} className={inputClass} placeholder="Legal name" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location"><input value={data.identity.location} onChange={(e) => update('identity', 'location', e.target.value)} className={inputClass} placeholder="City, Country" /></Field>
        <Field label="Timezone"><input value={data.identity.timezone} onChange={(e) => update('identity', 'timezone', e.target.value)} className={inputClass} placeholder="e.g. America/Winnipeg" /></Field>
      </div>
      <Field label="Languages">
        <div className="flex flex-wrap gap-2">
          {data.identity.languages.map((l) => (
            <span key={l} className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1 text-xs text-[#aab6c2]">
              {l}
              <button onClick={() => update('identity', 'languages', data.identity.languages.filter((x) => x !== l))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} className={inputClass} placeholder="Add language" onKeyDown={(e) => { if (e.key === 'Enter' && newLanguage) { update('identity', 'languages', [...data.identity.languages, newLanguage]); setNewLanguage(''); } }} />
          <button onClick={() => { if (newLanguage) { update('identity', 'languages', [...data.identity.languages, newLanguage]); setNewLanguage(''); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]">Add</button>
        </div>
      </Field>
      <Field label="Poker Site Usernames">
        <div className="space-y-2">
          {data.identity.poker_usernames.map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-xs text-[#aab6c2]">{u.site}: {u.username}</span>
              <button onClick={() => update('identity', 'poker_usernames', data.identity.poker_usernames.filter((_, j) => j !== i))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newUsername.site} onChange={(e) => setNewUsername({ ...newUsername, site: e.target.value })} className={inputClass} placeholder="Site" />
            <input value={newUsername.username} onChange={(e) => setNewUsername({ ...newUsername, username: e.target.value })} className={inputClass} placeholder="Username" />
            <button onClick={() => { if (newUsername.site && newUsername.username) { update('identity', 'poker_usernames', [...data.identity.poker_usernames, newUsername]); setNewUsername({ site: '', username: '' }); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]">Add</button>
          </div>
        </div>
      </Field>
    </div>
  );
}

function PokerResultsStep({ data, update, newStake, setNewStake, newEvidence, setNewEvidence }: {
  data: ApplicationData; update: <K extends keyof ApplicationData>(s: K, f: string, v: unknown) => void;
  newStake: string; setNewStake: (v: string) => void;
  newEvidence: string; setNewEvidence: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-white">Poker Results & Track Record</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary Format">
          <select value={data.poker_results.primary_format} onChange={(e) => update('poker_results', 'primary_format', e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            <option value="MTT">MTT / Tournaments</option>
            <option value="Cash">Cash Games</option>
            <option value="Mixed">Mixed</option>
          </select>
        </Field>
        <Field label="Years Playing"><input type="number" value={data.poker_results.years_playing} onChange={(e) => update('poker_results', 'years_playing', Number(e.target.value))} className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total Cashes"><input value={data.poker_results.total_cashes} onChange={(e) => update('poker_results', 'total_cashes', e.target.value)} className={inputClass} placeholder="e.g. $2,000,000+" /></Field>
        <Field label="Estimated Profit"><input value={data.poker_results.estimated_profit} onChange={(e) => update('poker_results', 'estimated_profit', e.target.value)} className={inputClass} placeholder="e.g. $500,000+" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ROI"><input value={data.poker_results.roi} onChange={(e) => update('poker_results', 'roi', e.target.value)} className={inputClass} placeholder="e.g. 35%" /></Field>
        <Field label="Largest Score"><input value={data.poker_results.largest_score} onChange={(e) => update('poker_results', 'largest_score', e.target.value)} className={inputClass} placeholder="e.g. $180,000" /></Field>
      </div>
      <Field label="Stakes / Buy-ins Coached">
        <div className="flex flex-wrap gap-2">
          {data.poker_results.stakes_coached.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1 text-xs text-[#aab6c2]">
              {s}
              <button onClick={() => update('poker_results', 'stakes_coached', data.poker_results.stakes_coached.filter((x) => x !== s))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={newStake} onChange={(e) => setNewStake(e.target.value)} className={inputClass} placeholder="e.g. $0-$525 ABI" onKeyDown={(e) => { if (e.key === 'Enter' && newStake) { update('poker_results', 'stakes_coached', [...data.poker_results.stakes_coached, newStake]); setNewStake(''); } }} />
          <button onClick={() => { if (newStake) { update('poker_results', 'stakes_coached', [...data.poker_results.stakes_coached, newStake]); setNewStake(''); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]">Add</button>
        </div>
      </Field>
      <Field label="Accomplishments & Results Summary">
        <textarea value={data.poker_results.accomplishments} onChange={(e) => update('poker_results', 'accomplishments', e.target.value)} className={`${inputClass} h-24 resize-none`} placeholder="Describe your key poker accomplishments, titles, and notable results..." />
      </Field>
      <Field label="Evidence Links (SharkScope, profit graphs, etc.)">
        <div className="space-y-2">
          {data.poker_results.evidence_links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="truncate rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-xs text-[#aab6c2]">{link}</span>
              <button onClick={() => update('poker_results', 'evidence_links', data.poker_results.evidence_links.filter((_, j) => j !== i))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newEvidence} onChange={(e) => setNewEvidence(e.target.value)} className={inputClass} placeholder="https://..." />
            <button onClick={() => { if (newEvidence) { update('poker_results', 'evidence_links', [...data.poker_results.evidence_links, newEvidence]); setNewEvidence(''); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]">Add</button>
          </div>
        </div>
      </Field>
    </div>
  );
}

function ExperienceStep({ data, update }: { data: ApplicationData; update: <K extends keyof ApplicationData>(s: K, f: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-white">Coaching Experience</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Years Coaching"><input type="number" value={data.experience.years_coaching} onChange={(e) => update('experience', 'years_coaching', Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Previous Students"><input type="number" value={data.experience.previous_students} onChange={(e) => update('experience', 'previous_students', Number(e.target.value))} className={inputClass} /></Field>
      </div>
      <Field label="Student Success Stories">
        <textarea value={data.experience.student_success_stories} onChange={(e) => update('experience', 'student_success_stories', e.target.value)} className={`${inputClass} h-28 resize-none`} placeholder="Describe notable student improvements, results, or testimonials..." />
      </Field>
      <Field label="Coaching Methods">
        <div className="flex flex-wrap gap-2">
          {['1-on-1 Sessions', 'Group Sessions', 'Video Review', 'Written Analysis', 'Live Sweat', 'Database Review'].map((m) => (
            <button key={m} onClick={() => update('experience', 'coaching_methods', toggleArrayItem(data.experience.coaching_methods, m))}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${data.experience.coaching_methods.includes(m) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}>{m}</button>
          ))}
        </div>
      </Field>
      <Field label="Coaching Includes">
        <div className="flex flex-wrap gap-2">
          {COACHING_SPECIALTIES.map((s) => (
            <button key={s} onClick={() => update('experience', 'coaching_includes', toggleArrayItem(data.experience.coaching_includes, s))}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${data.experience.coaching_includes.includes(s) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}>{s}</button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function SpecialtiesStep({ data, update }: { data: ApplicationData; update: <K extends keyof ApplicationData>(s: K, f: string, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-white">Specialties & Philosophy</h4>
      <Field label="Game Types">
        <div className="flex flex-wrap gap-2">
          {GAME_TYPES.map((g) => (
            <button key={g} onClick={() => update('specialties', 'game_types', toggleArrayItem(data.specialties.game_types, g))}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${data.specialties.game_types.includes(g) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}>{g}</button>
          ))}
        </div>
      </Field>
      <Field label="Coaching Specialties">
        <div className="flex flex-wrap gap-2">
          {COACHING_SPECIALTIES.map((s) => (
            <button key={s} onClick={() => update('specialties', 'coaching_specialties', toggleArrayItem(data.specialties.coaching_specialties, s))}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${data.specialties.coaching_specialties.includes(s) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}>{s}</button>
          ))}
        </div>
      </Field>
      <Field label="Coaching Philosophy">
        <textarea value={data.specialties.coaching_philosophy} onChange={(e) => update('specialties', 'coaching_philosophy', e.target.value)} className={`${inputClass} h-32 resize-none`} placeholder="Describe your approach to coaching, how you help students improve, and what makes your coaching unique..." />
      </Field>
    </div>
  );
}

function PricingStep({ data, update, newPackage, setNewPackage }: {
  data: ApplicationData; update: <K extends keyof ApplicationData>(s: K, f: string, v: unknown) => void;
  newPackage: { name: string; sessions: number; price: number }; setNewPackage: (v: { name: string; sessions: number; price: number }) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-white">Pricing & Packages</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Rate / Hour">
          <div className="flex items-center gap-1">
            <select value={data.pricing.currency} onChange={(e) => update('pricing', 'currency', e.target.value)} className={`${inputClass} w-20`}>
              <option value="USD">USD</option>
              <option value="CAD">CAD</option>
              <option value="EUR">EUR</option>
            </select>
            <input type="number" value={data.pricing.rate_per_hour} onChange={(e) => update('pricing', 'rate_per_hour', Number(e.target.value))} className={inputClass} placeholder="125" />
          </div>
        </Field>
        <Field label="Min Session (min)"><input type="number" value={data.pricing.min_session_length} onChange={(e) => update('pricing', 'min_session_length', Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Custom Pricing">
          <button onClick={() => update('pricing', 'custom_pricing', !data.pricing.custom_pricing)} className={`relative h-7 w-12 rounded-full transition ${data.pricing.custom_pricing ? 'bg-[#c0911e]/40' : 'bg-[#232a32]'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${data.pricing.custom_pricing ? 'left-6' : 'left-1'}`} />
          </button>
        </Field>
      </div>
      <Field label="Package Pricing">
        <div className="space-y-2">
          {data.pricing.package_pricing.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2">
              <span className="text-xs text-[#aab6c2]">{p.name} — {p.sessions} sessions — ${p.price}</span>
              <button onClick={() => update('pricing', 'package_pricing', data.pricing.package_pricing.filter((_, j) => j !== i))} className="text-[#5f6e7c] hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} className={inputClass} placeholder="Package name" />
            <input type="number" value={newPackage.sessions} onChange={(e) => setNewPackage({ ...newPackage, sessions: Number(e.target.value) })} className={`${inputClass} w-20`} placeholder="Sessions" />
            <input type="number" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: Number(e.target.value) })} className={`${inputClass} w-24`} placeholder="Price" />
            <button onClick={() => { if (newPackage.name) { update('pricing', 'package_pricing', [...data.pricing.package_pricing, newPackage]); setNewPackage({ name: '', sessions: 1, price: 0 }); } }} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[#84929f] hover:text-[#d4a52c]">Add</button>
          </div>
        </div>
      </Field>
    </div>
  );
}

function AvailabilityStep({ data, update, days }: { data: ApplicationData; update: <K extends keyof ApplicationData>(s: K, f: string, v: unknown) => void; days: string[] }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-white">Availability</h4>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#5f6e7c]">Available for Coaching</span>
        <button onClick={() => update('availability', 'available_for_coaching', !data.availability.available_for_coaching)} className={`relative h-6 w-12 rounded-full transition ${data.availability.available_for_coaching ? 'bg-[#c0911e]/40' : 'bg-[#232a32]'}`}>
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${data.availability.available_for_coaching ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      <Field label="Hours Per Week Available"><input type="number" value={data.availability.hours_per_week} onChange={(e) => update('availability', 'hours_per_week', Number(e.target.value))} className={inputClass} /></Field>
      <Field label="Preferred Days">
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button key={d} onClick={() => update('availability', 'preferred_days', toggleArrayItem(data.availability.preferred_days, d))}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${data.availability.preferred_days.includes(d) ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}>{d}</button>
          ))}
        </div>
      </Field>
      <Field label="Availability Notes">
        <textarea value={data.availability.availability_notes} onChange={(e) => update('availability', 'availability_notes', e.target.value)} className={`${inputClass} h-24 resize-none`} placeholder="Any additional notes about your schedule, time zone preferences, etc." />
      </Field>
    </div>
  );
}
