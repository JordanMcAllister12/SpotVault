import { useState, useCallback, useEffect } from 'react';
import {
  LifeBuoy, Send, Paperclip, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, Clock, X,
} from 'lucide-react';
import {
  createIssue, uploadIssueAttachment, fetchUserIssues,
  getBrowserInfo, getCategoryLabel, getStatusLabel,
  isActiveStatus, type IssueCategory, type IssueRecord,
} from '@/lib/issueStore';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const PANEL_BG = '#0a0d10';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';

const CATEGORIES: { id: IssueCategory; label: string }[] = [
  { id: 'bug_technical', label: 'Bug / Technical' },
  { id: 'hand_history', label: 'Hand History / Replayer' },
  { id: 'analytics_spr', label: 'Analytics / SPR' },
  { id: 'solver', label: 'Solver' },
  { id: 'spots_marketplace', label: 'Content / Marketplace' },
  { id: 'payments_membership', label: 'Membership / Billing' },
  { id: 'account_login', label: 'Account / Login' },
  { id: 'feature_suggestion', label: 'Feature Suggestion' },
  { id: 'report_user_safety', label: 'Report a User / Safety' },
  { id: 'other', label: 'Other' },
];

export function SupportCenter() {
  return (
    <div className="network-page-content py-4 md:py-6 lg:py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: support form */}
        <div className="lg:col-span-3">
          <SupportForm />
        </div>
        {/* Right: ticket history */}
        <div className="lg:col-span-2">
          <TicketHistory />
        </div>
      </div>
    </div>
  );
}

function SupportForm() {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<IssueCategory>('bug_technical');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<IssueRecord | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!subject.trim()) { setError('Please enter a subject.'); return; }
    if (!description.trim()) { setError('Please describe your issue.'); return; }
    if (description.trim().length < 10) { setError('Please provide at least a brief description.'); return; }

    setSubmitting(true);
    try {
      const issue = await createIssue({
        title: subject,
        category,
        description,
        pageLocation: typeof window !== 'undefined' ? window.location.href : undefined,
        priority,
        userAgent: getBrowserInfo(),
      });

      if (attachment) {
        try {
          await uploadIssueAttachment(issue.id, attachment);
        } catch {
          // Non-fatal — issue is created, attachment failed
        }
      }

      setSuccess(issue);
      setSubject('');
      setDescription('');
      setPriority('normal');
      setAttachment(null);
      setCategory('bug_technical');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Attachment must be under 5MB.');
      return;
    }
    setAttachment(file);
    setError('');
  };

  if (success) {
    return (
      <div className="rounded-2xl border p-6" style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.96)' }}>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <CheckCircle2 className="h-7 w-7" style={{ color: '#4ade80' }} strokeWidth={1.5} />
          </div>
          <h3 className="mt-4 text-sm font-bold tracking-wide text-white">Support Request Submitted</h3>
          <p className="mt-1 text-[11px] text-white/50">Your ticket ID is</p>
          <code className="mt-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-mono font-bold" style={{ color: GOLD_SOFT }}>
            {success.ticket_id}
          </code>
          <p className="mt-3 max-w-xs text-[10px] leading-relaxed text-white/40">
            Our team has been notified. You can track the status of this request in your ticket history.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-5 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-[10px] font-bold tracking-widest text-white/80 uppercase transition hover:text-white"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.96)' }}>
      {/* Header */}
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(212,165,44,0.1)' }}>
          <LifeBuoy className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Support Center</h2>
          <p className="text-[10px] text-white/40">Submit a request and our team will get back to you</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Subject */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your request"
            maxLength={120}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-white/90 placeholder:text-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
          />
        </div>

        {/* Category dropdown */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Category</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-white/90 focus:border-[#d4a52c]/40 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-[#0a0d10] text-white">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened, what you expected, and any steps to reproduce..."
            rows={5}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] leading-relaxed text-white/90 placeholder:text-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
          />
          <p className="mt-1 text-right text-[9px] text-white/25">{description.length}/2000</p>
        </div>

        {/* Priority */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Priority</label>
          <div className="flex gap-1.5">
            {(['low', 'normal', 'high', 'urgent'] as const).map((p) => {
              const active = priority === p;
              const colors: Record<string, string> = {
                low: active ? '#6b7280' : '',
                normal: active ? GOLD : '',
                high: active ? '#f59e0b' : '',
                urgent: active ? '#ef4444' : '',
              };
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-all"
                  style={{
                    borderColor: active ? colors[p] + '60' : 'rgba(255,255,255,0.06)',
                    background: active ? colors[p] + '15' : 'transparent',
                    color: active ? colors[p] : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Attachment */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Attachment (optional)</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[11px] text-white/50 transition hover:border-white/20 hover:text-white/70">
            <Paperclip className="h-3.5 w-3.5" />
            {attachment ? attachment.name : 'Attach a screenshot (max 5MB)'}
            <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </label>
          {attachment && (
            <button
              onClick={() => setAttachment(null)}
              className="mt-1 text-[10px] text-red-400/70 hover:text-red-400"
            >
              Remove attachment
            </button>
          )}
        </div>

        {/* Auto-captured info */}
        <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
          <p className="text-[9px] text-white/30">
            Your page URL, timestamp, and browser info will be automatically included.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <p className="text-[11px] text-red-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-50"
          style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </div>
  );
}

function TicketHistory() {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ id: string; content: string; created_at: string }[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUserIssues();
      setIssues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (issueId: string) => {
    if (expandedId === issueId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(issueId);
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('issue_comments')
        .select('id, content, created_at')
        .eq('issue_id', issueId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });
      setComments(data ?? []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.96)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">My Support Requests</h2>
          <p className="text-[10px] text-white/40">Track the status of your tickets</p>
        </div>
        <button
          onClick={load}
          className="text-[9px] font-bold tracking-widest text-white/40 uppercase transition hover:text-white/70"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-[11px] text-red-300">{error}</p>
          <button onClick={load} className="mt-2 text-[10px] text-red-400 underline">Try again</button>
        </div>
      ) : issues.length === 0 ? (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <LifeBuoy className="mx-auto h-6 w-6 text-white/15" strokeWidth={1.5} />
          <p className="mt-2 text-[12px] font-semibold text-white/50">No tickets yet</p>
          <p className="mt-1 text-[10px] text-white/30">Submit a support request and it will appear here.</p>
        </div>
      ) : (
        <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
          {issues.map((issue) => {
            const expanded = expandedId === issue.id;
            const statusColor = isActiveStatus(issue.status)
              ? issue.status === 'new' ? '#60a5fa' : '#fbbf24'
              : '#4ade80';
            return (
              <div key={issue.id} className="rounded-xl border overflow-hidden" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                <button
                  onClick={() => handleExpand(issue.id)}
                  className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/[0.02]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono font-bold" style={{ color: GOLD_SOFT }}>{issue.ticket_id}</code>
                      <span className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ background: statusColor + '20', color: statusColor }}>
                        {getStatusLabel(issue.status)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12px] font-semibold text-white/90">{issue.title}</p>
                    <p className="mt-0.5 text-[10px] text-white/40">{getCategoryLabel(issue.category)}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                {expanded && (
                  <div className="border-t border-white/[0.04] p-3">
                    <p className="text-[11px] leading-relaxed text-white/70">{issue.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-white/35">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {loadingComments ? (
                      <div className="mt-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" /></div>
                    ) : comments.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Updates</p>
                        {comments.map((c) => (
                          <div key={c.id} className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                            <p className="text-[10px] text-white/60">{c.content}</p>
                            <p className="mt-1 text-[8px] text-white/25">{new Date(c.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
