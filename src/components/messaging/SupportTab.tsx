import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LifeBuoy, Bug, Wrench, Lightbulb, ArrowLeft, Send, Paperclip,
  Loader2, CheckCircle2, AlertCircle, MessageCircle, Clock, X,
  ChevronRight, FileText, Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type IssueCategory, type IssuePriority, type IssueRecord, type IssueComment,
  CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, isActiveStatus,
  createIssue, uploadIssueAttachment, fetchUserIssues, fetchIssueComments,
  fetchIssueAttachments, getAttachmentUrl, addComment, getBrowserInfo,
} from '@/lib/issueStore';
import { createNotification } from '@/lib/notificationStore';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const PANEL_BG = '#0a0d10';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';

interface Props {
  account: SpotVaultAccount | null;
  listOnly?: boolean;
}

type View = 'landing' | 'form' | 'detail';

const CATEGORY_CARDS: {
  category: IssueCategory;
  title: string;
  desc: string;
  icon: typeof Bug;
}[] = [
  { category: 'bug_technical', title: 'Report an Issue', desc: 'Bugs, broken functionality, incorrect statistics, display problems', icon: Bug },
  { category: 'payments_membership', title: 'Request Support', desc: 'Account problems, memberships, purchases, payments, general assistance', icon: Wrench },
  { category: 'other', title: 'Suggest a Feature', desc: 'Improvements, new features, user feedback', icon: Lightbulb },
];

const STATUS_COLORS: Record<string, string> = {
  new: '#60a5fa',
  in_progress: '#fbbf24',
  resolved: '#34d399',
  reopened: '#fbbf24',
  closed: '#94a3b8',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  normal: '#60a5fa',
  high: '#fbbf24',
  urgent: '#f87171',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];

export function SupportTab({ account, listOnly }: Props) {
  const [view, setView] = useState<View>('landing');
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('bug_technical');
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserIssues();
      setIssues(data);
    } catch {
      setIssues([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const handleCategorySelect = (cat: IssueCategory) => {
    setSelectedCategory(cat);
    setView('form');
  };

  const handleIssueCreated = () => {
    void loadIssues();
    setView('landing');
  };

  const handleOpenIssue = (issue: IssueRecord) => {
    setSelectedIssue(issue);
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedIssue(null);
    setView('landing');
    void loadIssues();
  };

  if (listOnly) {
    return <SupportList issues={issues} loading={loading} onOpenIssue={handleOpenIssue} onNewIssue={() => setView('form')} />;
  }

  if (view === 'form') {
    return (
      <SupportForm
        category={selectedCategory}
        onBack={() => setView('landing')}
        onSubmitted={handleIssueCreated}
      />
    );
  }

  if (view === 'detail' && selectedIssue) {
    return (
      <SupportDetail
        issue={selectedIssue}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
      <div className="p-4 sm:p-5 space-y-5">
        <div>
          <h2 className="text-[15px] font-bold text-white">How can we help?</h2>
          <p className="mt-1 text-[11px] text-white/45">Choose a category below to get started</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {CATEGORY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.category}
                onClick={() => handleCategorySelect(card.category)}
                className="group rounded-xl border p-4 text-left transition-all hover:scale-[1.01]"
                style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(212,165,44,0.12), rgba(212,165,44,0.04))', border: `1px solid ${BORDER}` }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
                </div>
                <h3 className="mt-3 text-[13px] font-bold text-white">{card.title}</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-white/45">{card.desc}</p>
              </button>
            );
          })}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
            <h3 className="text-[11px] font-bold tracking-widest text-white/50 uppercase">My Support Requests</h3>
          </div>
          <SupportList issues={issues} loading={loading} onOpenIssue={handleOpenIssue} onNewIssue={() => setView('form')} />
        </div>
      </div>
    </div>
  );
}

function SupportList({ issues, loading, onOpenIssue, onNewIssue }: {
  issues: IssueRecord[];
  loading: boolean;
  onOpenIssue: (issue: IssueRecord) => void;
  onNewIssue: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/30 p-6 text-center">
        <LifeBuoy className="mx-auto h-6 w-6 text-white/20" strokeWidth={1.5} />
        <p className="mt-2 text-[11px] text-white/40">No support requests yet</p>
        <button
          onClick={onNewIssue}
          className="mt-3 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all"
          style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(212,165,44,0.08)' }}
        >
          New Request
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <button
          key={issue.id}
          onClick={() => onOpenIssue(issue)}
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:border-white/20"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(212,165,44,0.06)', border: `1px solid ${BORDER}` }}>
            {issue.category === 'bug_technical' ? <Bug className="h-3.5 w-3.5" style={{ color: GOLD }} /> :
              issue.category === 'other' ? <Lightbulb className="h-3.5 w-3.5" style={{ color: GOLD }} /> :
              <Wrench className="h-3.5 w-3.5" style={{ color: GOLD }} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white/85">{issue.title}</p>
            <p className="text-[9px] text-white/35">{CATEGORY_LABELS[issue.category]} · {issue.ticket_id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wide uppercase"
              style={{ borderColor: STATUS_COLORS[issue.status] + '40', background: STATUS_COLORS[issue.status] + '10', color: STATUS_COLORS[issue.status] }}
            >
              {STATUS_LABELS[issue.status]}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-white/20" />
          </div>
        </button>
      ))}
    </div>
  );
}

function SupportForm({ category, onBack, onSubmitted }: {
  category: IssueCategory;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [cat, setCat] = useState<IssueCategory>(category);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('normal');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter(f => f.size <= MAX_FILE_SIZE && ACCEPTED_TYPES.includes(f.type));
    if (valid.length < selected.length) {
      setError('Some files were skipped (max 10MB, images/PDF/text only)');
    }
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in the subject and description.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const issue = await createIssue({
        title: subject,
        category: cat,
        description,
        priority,
        pageLocation: typeof window !== 'undefined' ? window.location.pathname : null,
        userAgent: getBrowserInfo(),
      });

      for (const file of files) {
        try {
          await uploadIssueAttachment(issue.id, file);
        } catch {
          // Continue even if one attachment fails
        }
      }

      const { data: staffData } = await supabase
        .from('staff_accounts')
        .select('user_id')
        .in('role', ['staff', 'superuser', 'developer_admin']);

      if (staffData && staffData.length > 0) {
        for (const staff of staffData.slice(0, 10)) {
          await createNotification({
            userId: staff.user_id,
            type: 'activity',
            title: 'New support ticket',
            body: `${issue.ticket_id}: ${issue.title}`,
            sourceId: issue.id,
            sourceType: 'support_ticket',
          });
        }
      }

      setSuccess(true);
      setTimeout(() => onSubmitted(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket. Please try again.');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <CheckCircle2 className="h-10 w-10" strokeWidth={1.5} style={{ color: '#34d399' }} />
        <h3 className="mt-3 text-[14px] font-bold text-white">Ticket Submitted</h3>
        <p className="mt-1 text-[11px] text-white/45">Your support request has been received</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
      <div className="p-4 sm:p-5 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-white/40 hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back
        </button>

        <h2 className="text-[15px] font-bold text-white">Submit a Support Request</h2>

        <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase text-white/40">Category</label>
            <select
              value={cat}
              onChange={e => setCat(e.target.value as IssueCategory)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none focus:border-[#d4a52c]/40"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val} className="bg-[#0a0d10]">{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase text-white/40">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief summary of your request"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase text-white/40">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide details about your issue or request..."
              rows={5}
              maxLength={3000}
              className="mt-1 w-full resize-none rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase text-white/40">Priority</label>
            <div className="mt-1 flex gap-2">
              {(['low', 'normal', 'high'] as IssuePriority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all"
                  style={{
                    borderColor: priority === p ? PRIORITY_COLORS[p] + '50' : 'rgba(255,255,255,0.06)',
                    background: priority === p ? PRIORITY_COLORS[p] + '12' : 'transparent',
                    color: priority === p ? PRIORITY_COLORS[p] : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase text-white/40">Attachments (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="mt-1 space-y-2">
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                      {file.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5 text-white/40" /> : <FileText className="h-3.5 w-3.5 text-white/40" />}
                      <span className="flex-1 truncate text-[10px] text-white/60">{file.name}</span>
                      <span className="text-[9px] text-white/30">{(file.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(idx)} className="text-white/30 hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.12] px-3 py-2 text-[10px] font-semibold text-white/40 transition-all hover:border-white/25 hover:text-white/60"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {files.length === 0 ? 'Add screenshot or file' : 'Add more'}
              </button>
              <p className="text-[9px] text-white/25">Max 10MB per file. Images, PDF, text. Up to 5 files.</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
              <p className="text-[10px] leading-relaxed text-red-300/80">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !subject.trim() || !description.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all disabled:opacity-40"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupportDetail({ issue, onBack }: {
  issue: IssueRecord;
  onBack: () => void;
}) {
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const [cmts] = await Promise.all([fetchIssueComments(issue.id)]);
      setComments(cmts);
    } catch {
      setComments([]);
    }
    setLoading(false);
  }, [issue.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addComment(issue.id, reply, false);
      setReply('');
      await loadComments();
    } catch {
      // ignore
    }
    setSending(false);
  };

  const isActive = isActiveStatus(issue.status);

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
      <div className="p-4 sm:p-5 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-white/40 hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back to Support
        </button>

        <div className="rounded-xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wide uppercase" style={{ borderColor: STATUS_COLORS[issue.status] + '40', background: STATUS_COLORS[issue.status] + '10', color: STATUS_COLORS[issue.status] }}>
              {STATUS_LABELS[issue.status]}
            </span>
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[8px] font-bold tracking-wide uppercase text-white/40">
              {issue.ticket_id}
            </span>
          </div>
          <h2 className="mt-2 text-[14px] font-bold text-white">{issue.title}</h2>
          <p className="mt-1 text-[10px] text-white/35">
            {CATEGORY_LABELS[issue.category]} · {new Date(issue.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          <div className="mt-3 rounded-lg border border-white/[0.04] bg-black/30 p-3">
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/65">{issue.description}</p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-widest text-white/50 uppercase">Conversation</h3>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4 text-center">
              <MessageCircle className="mx-auto h-5 w-5 text-white/15" strokeWidth={1.5} />
              <p className="mt-1.5 text-[10px] text-white/35">No responses yet. We'll get back to you soon.</p>
            </div>
          ) : (
            <div ref={scrollRef} className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {comments.map((c) => {
                const isStaff = c.author_id !== issue.user_id;
                return (
                  <div key={c.id} className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className="max-w-[80%] rounded-xl border px-3 py-2"
                      style={{
                        borderColor: isStaff ? BORDER : 'rgba(255,255,255,0.06)',
                        background: isStaff ? 'rgba(212,165,44,0.06)' : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <p className="text-[9px] font-bold tracking-wide uppercase" style={{ color: isStaff ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}>
                        {isStaff ? 'Support Team' : 'You'}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-white/75">{c.content}</p>
                      <p className="mt-1 text-[8px] text-white/25">{new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isActive && (
          <div className="rounded-xl border p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write a reply..."
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white/85 outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40"
            />
            <button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all disabled:opacity-40"
              style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Reply
            </button>
          </div>
        )}

        {!isActive && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#34d399' }} />
            <p className="text-[10px] text-emerald-300/80">This ticket has been resolved. If you need further help, please submit a new request.</p>
          </div>
        )}
      </div>
    </div>
  );
}
