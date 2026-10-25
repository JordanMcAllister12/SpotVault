import { useState, useEffect, useCallback } from 'react';
import {
  Check, X, FileText, Mail, Clock, User, Trophy, Target, DollarSign,
  Award, ChevronRight, Send, AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const PANEL_BG = 'rgba(8,10,12,0.82)';

type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested';

interface CoachApplication {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  application_data: Record<string, unknown>;
  staff_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function CoachApplicationReview() {
  const [applications, setApplications] = useState<CoachApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CoachApplication | null>(null);
  const [staffNotes, setStaffNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'invitations'>('list');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [invitations, setInvitations] = useState<{ id: string; invitee_email: string; status: string; created_at: string; message: string }[]>([]);
  const [sending, setSending] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('coach_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchErr) { setError(fetchErr.message); }
    else { setApplications((data ?? []) as CoachApplication[]); }
    setLoading(false);
  }, []);

  const fetchInvitations = useCallback(async () => {
    const { data } = await supabase
      .from('coach_invitations')
      .select('id, invitee_email, status, created_at, message')
      .order('created_at', { ascending: false });
    setInvitations((data ?? []) as { id: string; invitee_email: string; status: string; created_at: string; message: string }[]);
  }, []);

  useEffect(() => { void fetchApplications(); void fetchInvitations(); }, [fetchApplications, fetchInvitations]);

  const updateStatus = async (newStatus: ApplicationStatus) => {
    if (!selected) return;
    setActing(true);
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    const { error: updErr } = await supabase
      .from('coach_applications')
      .update({
        status: newStatus,
        staff_notes: staffNotes,
        reviewed_by: userData.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    if (updErr) { setError(updErr.message); }
    else {
      setSelected(null);
      void fetchApplications();
    }
    setActing(false);
  };

  const generateProfile = async (app: CoachApplication) => {
    setActing(true);
    setError('');
    const data = app.application_data as {
      identity?: Record<string, unknown>;
      poker_results?: Record<string, unknown>;
      experience?: Record<string, unknown>;
      specialties?: Record<string, unknown>;
      pricing?: Record<string, unknown>;
      availability?: Record<string, unknown>;
    };
    const identity = data.identity ?? {};
    const pricing = data.pricing ?? {};
    const specialties = data.specialties ?? {};
    const experience = data.experience ?? {};
    const availability = data.availability ?? {};
    const poker = data.poker_results ?? {};

    const profilePayload = {
      account_id: app.user_id,
      display_name: (identity.display_name as string) ?? '',
      real_name: (identity.real_name as string) ?? '',
      bio: (poker.accomplishments as string) ?? '',
      coaching_description: (specialties.coaching_philosophy as string) ?? '',
      primary_games: (specialties.game_types as string[]) ?? [],
      stakes_coached: (poker.stakes_coached as string[]) ?? [],
      languages: (identity.languages as string[]) ?? [],
      poker_usernames: (identity.poker_usernames as { site: string; username: string }[]) ?? [],
      timezone: (identity.timezone as string) ?? '',
      rate_per_hour: (pricing.rate_per_hour as number) ?? 0,
      currency: (pricing.currency as string) ?? 'USD',
      min_session_length: (pricing.min_session_length as number) ?? 30,
      package_pricing: (pricing.package_pricing as { name: string; sessions: number; price: number }[]) ?? [],
      custom_pricing: (pricing.custom_pricing as boolean) ?? false,
      coaching_includes: (experience.coaching_includes as string[]) ?? [],
      coaching_methods: (experience.coaching_methods as string[]) ?? [],
      available_for_coaching: (availability.available_for_coaching as boolean) ?? true,
      is_published: false,
      profile_completion_pct: 60,
    };

    const { error: insErr } = await supabase
      .from('coach_listings')
      .upsert(profilePayload, { onConflict: 'account_id' });

    if (insErr) { setError(`Profile generation failed: ${insErr.message}`); }
    else { setError(''); }
    setActing(false);
    return !insErr;
  };

  const sendInvitation = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: insErr } = await supabase
      .from('coach_invitations')
      .insert({
        invitee_email: inviteEmail.trim(),
        invited_by: userData.user?.id,
        message: inviteMessage.trim(),
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    if (insErr) { setError(insErr.message); }
    else {
      setInviteEmail('');
      setInviteMessage('');
      void fetchInvitations();
    }
    setSending(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[11px] text-white/40">Loading coach applications...</div>;
  }

  if (selected) {
    return (
      <ApplicationDetail
        app={selected}
        staffNotes={staffNotes}
        setStaffNotes={setStaffNotes}
        acting={acting}
        error={error}
        onBack={() => { setSelected(null); void fetchApplications(); }}
        onApprove={async () => { const ok = await generateProfile(selected); if (ok) { await updateStatus('approved'); } }}
        onReject={() => void updateStatus('rejected')}
        onRequestChanges={() => void updateStatus('changes_requested')}
        onMarkReviewing={() => void updateStatus('under_review')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <h3 className="text-sm font-bold text-white">Coach Applications</h3>
      </div>

      {/* Toggle between applications and invitations */}
      <div className="flex gap-2">
        <button onClick={() => setView('list')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${view === 'list' ? 'text-[#080706]' : 'text-white/50'}`} style={{ background: view === 'list' ? GOLD : 'transparent', border: `1px solid ${view === 'list' ? GOLD : BORDER}` }}>
          Applications ({applications.length})
        </button>
        <button onClick={() => setView('invitations')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${view === 'invitations' ? 'text-[#080706]' : 'text-white/50'}`} style={{ background: view === 'invitations' ? GOLD : 'transparent', border: `1px solid ${view === 'invitations' ? GOLD : BORDER}` }}>
          Invitations ({invitations.length})
        </button>
      </div>

      {view === 'list' && (
        <div className="space-y-2">
          {applications.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-white/30">No coach applications yet.</div>
          ) : applications.map((app) => {
            const data = app.application_data as { identity?: { display_name?: string } };
            const name = data?.identity?.display_name ?? app.user_id.slice(0, 8);
            const statusColors: Record<string, string> = { draft: '#5f6e7c', submitted: '#60a5fa', under_review: '#fbbf24', approved: '#4ade80', rejected: '#f87171', changes_requested: '#fbbf24' };
            return (
              <button key={app.id} onClick={() => { setSelected(app); setStaffNotes(app.staff_notes ?? ''); }} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[#c0911e]/40" style={{ borderColor: BORDER, background: PANEL_BG }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#161b21]">
                  <User className="h-4 w-4 text-white/40" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-white">{name}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest" style={{ color: statusColors[app.status] ?? '#5f6e7c' }}>{app.status.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/30">{new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20" />
              </button>
            );
          })}
        </div>
      )}

      {view === 'invitations' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: PANEL_BG }}>
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <h4 className="text-xs font-bold text-white">Send Coach Invitation</h4>
            </div>
            {error && <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300">{error}</div>}
            <div className="space-y-2">
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full rounded-lg border border-[#232a32] bg-[#11151a] px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/40" placeholder="Coach email address" />
              <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} className="h-20 w-full resize-none rounded-lg border border-[#232a32] bg-[#11151a] px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/40" placeholder="Optional personal message..." />
              <button onClick={() => void sendInvitation()} disabled={sending || !inviteEmail.trim()} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition hover:scale-105 disabled:opacity-50" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
                <Send className="h-3.5 w-3.5" /> {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: BORDER, background: PANEL_BG }}>
                <Mail className="h-4 w-4 text-white/40" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">{inv.invitee_email}</div>
                  <div className="text-[10px] text-white/30">{new Date(inv.created_at).toLocaleDateString()}</div>
                </div>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#5f6e7c]">{inv.status}</span>
              </div>
            ))}
            {invitations.length === 0 && <div className="py-8 text-center text-[12px] text-white/30">No invitations sent yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationDetail({ app, staffNotes, setStaffNotes, acting, error, onBack, onApprove, onReject, onRequestChanges, onMarkReviewing }: {
  app: CoachApplication;
  staffNotes: string;
  setStaffNotes: (v: string) => void;
  acting: boolean;
  error: string;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onMarkReviewing: () => void;
}) {
  const d = app.application_data as {
    identity?: Record<string, unknown>;
    poker_results?: Record<string, unknown>;
    experience?: Record<string, unknown>;
    specialties?: Record<string, unknown>;
    pricing?: Record<string, unknown>;
    availability?: Record<string, unknown>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#84929f] hover:text-[#d4a52c]">Back</button>
        <h3 className="text-sm font-bold text-white">Application Review</h3>
        <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#fbbf24]">{app.status.replace('_', ' ')}</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: BORDER, background: PANEL_BG }}>
        <ReviewSection icon={User} title="Identity">
          <ReviewField label="Display Name" value={d.identity?.display_name as string} />
          <ReviewField label="Real Name" value={d.identity?.real_name as string} />
          <ReviewField label="Location" value={d.identity?.location as string} />
          <ReviewField label="Timezone" value={d.identity?.timezone as string} />
          <ReviewField label="Languages" value={(d.identity?.languages as string[])?.join(', ')} />
          <ReviewField label="Poker Usernames" value={(d.identity?.poker_usernames as { site: string; username: string }[])?.map((u) => `${u.site}: ${u.username}`).join(', ')} />
        </ReviewSection>

        <ReviewSection icon={Trophy} title="Poker Results">
          <ReviewField label="Primary Format" value={d.poker_results?.primary_format as string} />
          <ReviewField label="Years Playing" value={String(d.poker_results?.years_playing ?? '')} />
          <ReviewField label="Total Cashes" value={d.poker_results?.total_cashes as string} />
          <ReviewField label="Estimated Profit" value={d.poker_results?.estimated_profit as string} />
          <ReviewField label="ROI" value={d.poker_results?.roi as string} />
          <ReviewField label="Largest Score" value={d.poker_results?.largest_score as string} />
          <ReviewField label="Stakes Coached" value={(d.poker_results?.stakes_coached as string[])?.join(', ')} />
          <ReviewField label="Accomplishments" value={d.poker_results?.accomplishments as string} multiline />
          <ReviewField label="Evidence Links" value={(d.poker_results?.evidence_links as string[])?.join('\n')} multiline />
        </ReviewSection>

        <ReviewSection icon={Award} title="Coaching Experience">
          <ReviewField label="Years Coaching" value={String(d.experience?.years_coaching ?? '')} />
          <ReviewField label="Previous Students" value={String(d.experience?.previous_students ?? '')} />
          <ReviewField label="Coaching Methods" value={(d.experience?.coaching_methods as string[])?.join(', ')} />
          <ReviewField label="Coaching Includes" value={(d.experience?.coaching_includes as string[])?.join(', ')} />
          <ReviewField label="Student Success Stories" value={d.experience?.student_success_stories as string} multiline />
        </ReviewSection>

        <ReviewSection icon={Target} title="Specialties & Philosophy">
          <ReviewField label="Game Types" value={(d.specialties?.game_types as string[])?.join(', ')} />
          <ReviewField label="Coaching Specialties" value={(d.specialties?.coaching_specialties as string[])?.join(', ')} />
          <ReviewField label="Coaching Philosophy" value={d.specialties?.coaching_philosophy as string} multiline />
        </ReviewSection>

        <ReviewSection icon={DollarSign} title="Pricing">
          <ReviewField label="Rate / Hour" value={`${d.pricing?.currency ?? 'USD'} ${d.pricing?.rate_per_hour ?? 0}`} />
          <ReviewField label="Min Session Length" value={`${d.pricing?.min_session_length ?? 30} min`} />
          <ReviewField label="Custom Pricing" value={d.pricing?.custom_pricing ? 'Yes' : 'No'} />
          <ReviewField label="Packages" value={(d.pricing?.package_pricing as { name: string; sessions: number; price: number }[])?.map((p) => `${p.name} (${p.sessions}x $${p.price})`).join(', ')} />
        </ReviewSection>

        <ReviewSection icon={Clock} title="Availability">
          <ReviewField label="Available for Coaching" value={d.availability?.available_for_coaching ? 'Yes' : 'No'} />
          <ReviewField label="Hours / Week" value={String(d.availability?.hours_per_week ?? '')} />
          <ReviewField label="Preferred Days" value={(d.availability?.preferred_days as string[])?.join(', ')} />
          <ReviewField label="Notes" value={d.availability?.availability_notes as string} multiline />
        </ReviewSection>
      </div>

      {/* Staff Notes & Actions */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: BORDER, background: PANEL_BG }}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Staff Notes</div>
        <textarea value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} className="h-20 w-full resize-none rounded-lg border border-[#232a32] bg-[#11151a] px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/40" placeholder="Internal notes about this application..." />

        <div className="flex flex-wrap gap-2">
          {app.status === 'submitted' && (
            <button onClick={onMarkReviewing} disabled={acting} className="flex items-center gap-1.5 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#fbbf24] hover:bg-[#fbbf24]/20 disabled:opacity-50">
              <Clock className="h-3.5 w-3.5" /> Mark as Reviewing
            </button>
          )}
          <button onClick={onRequestChanges} disabled={acting} className="flex items-center gap-1.5 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#fbbf24] hover:bg-[#fbbf24]/20 disabled:opacity-50">
            <AlertCircle className="h-3.5 w-3.5" /> Request Changes
          </button>
          <button onClick={onApprove} disabled={acting} className="flex items-center gap-1.5 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#4ade80] hover:bg-[#4ade80]/20 disabled:opacity-50">
            <CheckCircle2 className="h-3.5 w-3.5" /> {acting ? 'Approving...' : 'Approve & Generate Profile'}
          </button>
          <button onClick={onReject} disabled={acting} className="flex items-center gap-1.5 rounded-lg border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#f87171] hover:bg-[#f87171]/20 disabled:opacity-50">
            <XCircle className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.04] pt-3 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" style={{ color: GOLD }} />
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/60">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <div className={multiline ? 'col-span-2' : ''}>
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</div>
      <div className={`mt-0.5 text-[11px] text-white/70 ${multiline ? 'whitespace-pre-wrap leading-relaxed' : ''}`}>{value || '—'}</div>
    </div>
  );
}
