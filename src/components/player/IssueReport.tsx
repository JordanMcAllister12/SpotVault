import { useState, useEffect, useCallback } from 'react';
import {
  X, Send, Paperclip, CheckCircle2, AlertTriangle, Loader2,
  Bug, History, BarChart3, Calculator, ShoppingBag, CreditCard,
  UserCircle, MoreHorizontal, ChevronRight, Clock,
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

const CATEGORIES: { id: IssueCategory; label: string; icon: typeof Bug }[] = [
  { id: 'bug_technical', label: 'Bug / Technical', icon: Bug },
  { id: 'hand_history', label: 'Hand History / Replayer', icon: History },
  { id: 'analytics_spr', label: 'Analytics / SPR', icon: BarChart3 },
  { id: 'solver', label: 'Solver', icon: Calculator },
  { id: 'spots_marketplace', label: 'Spots / Marketplace', icon: ShoppingBag },
  { id: 'payments_membership', label: 'Payments / Membership', icon: CreditCard },
  { id: 'account_login', label: 'Account / Login', icon: UserCircle },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  pageLocation?: string;
}

export function ReportIssueModal({ open, onClose, pageLocation }: ReportModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IssueCategory>('bug_technical');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<IssueRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setCategory('bug_technical');
      setDescription('');
      setPriority('normal');
      setScreenshot(null);
      setSuccess(null);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!description.trim()) { setError('Please describe the issue.'); return; }
    if (description.trim().length < 10) { setError('Please provide at least a brief description.'); return; }

    setSubmitting(true);
    try {
      const issue = await createIssue({
        title,
        category,
        description,
        pageLocation: pageLocation ?? (typeof window !== 'undefined' ? window.location.href : undefined),
        priority,
        userAgent: getBrowserInfo(),
      });

      if (screenshot) {
        try {
          await uploadIssueAttachment(issue.id, screenshot);
        } catch {
          // Non-fatal — issue is created, attachment failed
        }
      }

      setSuccess(issue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot must be under 5MB.');
      return;
    }
    setScreenshot(file);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border p-5"
        style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.96)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#4ade80' }} strokeWidth={1.5} />
            </div>
            <h3 className="mt-4 text-sm font-bold tracking-wide text-white">Report Submitted</h3>
            <p className="mt-1 text-[11px] text-white/50">Your ticket ID is</p>
            <code className="mt-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-mono font-bold" style={{ color: GOLD_SOFT }}>
              {success.ticket_id}
            </code>
            <p className="mt-3 max-w-xs text-[10px] leading-relaxed text-white/40">
              Our team has been notified. You can track the status of this report from your Issue Reports list.
            </p>
            <button onClick={onClose} className="mt-5 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-[10px] font-bold tracking-widest text-white/80 uppercase transition hover:text-white">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
                <h3 className="text-sm font-bold tracking-wide text-white uppercase">Report an Issue</h3>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue"
                  maxLength={120}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-white/90 placeholder:text-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Category</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {CATEGORIES.map(({ id, label, icon: Icon }) => {
                    const active = category === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setCategory(id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-semibold tracking-wide transition-all ${
                          active ? 'border-[#d4a52c]/50 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70'
                        }`}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{label.split(' / ')[0].split(' /')[0]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-white/30">{getCategoryLabel(category)}</p>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, what you expected, and any steps to reproduce..."
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] leading-relaxed text-white/90 placeholder:text-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                />
                <p className="mt-1 text-right text-[9px] text-white/25">{description.length}/2000</p>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Priority (optional)</label>
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

              {/* Screenshot */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/50 uppercase">Screenshot (optional)</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[11px] text-white/50 transition hover:border-white/20 hover:text-white/70">
                  <Paperclip className="h-3.5 w-3.5" />
                  {screenshot ? screenshot.name : 'Attach a screenshot (max 5MB)'}
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
                {screenshot && (
                  <button
                    onClick={() => setScreenshot(null)}
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
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── My Reports list (user-facing) ──

interface MyReportsProps {
  onOpenReport: () => void;
}

export function MyReportsList({ onOpenReport }: MyReportsProps) {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUserIssues();
      setIssues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">My Issue Reports</h2>
          <p className="mt-0.5 text-[10px] text-white/40">Track the status of issues you've reported</p>
        </div>
        <button
          onClick={onOpenReport}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[9px] font-bold tracking-widest uppercase transition-all"
          style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Report Issue
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
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <AlertTriangle className="mx-auto h-6 w-6 text-white/15" strokeWidth={1.5} />
          <p className="mt-2 text-[12px] font-semibold text-white/50">No reports yet</p>
          <p className="mt-1 text-[10px] text-white/30">If you encounter a problem, click "Report Issue" to let our team know.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: IssueRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<{ id: string; content: string; created_at: string; is_internal: boolean }[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleExpand = async () => {
    if (!expanded) {
      setExpanded(true);
      setLoadingDetails(true);
      try {
        const { data } = await supabase
          .from('issue_comments')
          .select('id, content, created_at, is_internal')
          .eq('issue_id', issue.id)
          .eq('is_internal', false)
          .order('created_at', { ascending: true });
        setComments(data ?? []);
      } catch {
        // ignore
      } finally {
        setLoadingDetails(false);
      }
    } else {
      setExpanded(false);
    }
  };

  const statusColor = isActiveStatus(issue.status)
    ? issue.status === 'new' ? '#60a5fa' : '#fbbf24'
    : '#4ade80';

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
      <button
        onClick={handleExpand}
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
            {issue.page_location && (
              <span className="truncate max-w-[200px]">Page: {issue.page_location.split('/').slice(-2).join('/')}</span>
            )}
          </div>

          {loadingDetails ? (
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
}
