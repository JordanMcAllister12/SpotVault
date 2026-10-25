import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, X, CheckCircle2, AlertTriangle, Loader2,
  Bug, History, BarChart3, Calculator, ShoppingBag, CreditCard,
  UserCircle, MoreHorizontal, Clock, ChevronRight, MessageSquare,
  Activity, Paperclip, UserCheck, Flag, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchAllIssues, fetchIssueDetails, fetchIssueComments,
  fetchIssueActivity, fetchIssueAttachments, addComment,
  updateIssueStatus, updateIssuePriority, assignIssue,
  logActivity, getAttachmentUrl, getCategoryLabel,
  getPriorityLabel, getStatusLabel, isActiveStatus,
  type IssueRecord, type IssueComment, type IssueActivity,
  type IssueAttachment, type IssueStatus, type IssuePriority,
} from '@/lib/issueStore';
import { createNotification } from '@/lib/notificationStore';
import { STAFF_GLASS_CARD } from '@/components/staff/staffGlass';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const PANEL_BG = 'rgba(10,10,12,0.50)';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';

const CATEGORY_ICONS: Record<string, typeof Bug> = {
  bug_technical: Bug,
  hand_history: History,
  analytics_spr: BarChart3,
  solver: Calculator,
  spots_marketplace: ShoppingBag,
  payments_membership: CreditCard,
  account_login: UserCircle,
  other: MoreHorizontal,
};

type FilterTab = 'new' | 'in_progress' | 'resolved' | 'all';

interface StaffProps {
  staffAccount: { id: string; name: string };
}

export function IssueManagementSection({ staffAccount }: StaffProps) {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterTab>('new');
  const [search, setSearch] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, count] = await Promise.all([
        fetchAllIssues(),
        fetchActiveIssueCountSafe(),
      ]);
      setIssues(data);
      setActiveCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issues.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    channelRef.current = supabase
      .channel('issues-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_comments' }, () => {
        if (selectedIssue) loadIssueDetails(selectedIssue.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_activity' }, () => {
        if (selectedIssue) loadIssueDetails(selectedIssue.id);
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const loadIssueDetails = useCallback(async (issueId: string) => {
    setSelectedIssue((prev) => {
      void loadFullDetails(issueId);
      return prev;
    });
  }, []);

  const loadFullDetails = useCallback(async (issueId: string) => {
    const issue = await fetchIssueDetails(issueId);
    if (issue) setSelectedIssue(issue);
  }, []);

  const filtered = filterIssues(issues, filter, search);

  const handleOpenIssue = (issue: IssueRecord) => {
    setSelectedIssue(issue);
  };

  const handleCloseDetail = () => {
    setSelectedIssue(null);
    load();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Issue Management</h2>
            {activeCount > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ background: GOLD + '20', color: GOLD_SOFT }}>
                {activeCount} Active
              </span>
            )}
          </div>
        </div>

        {/* Filters + Search */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {([
              { id: 'new', label: 'New' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'all', label: 'All' },
            ] as const).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all ${
                    active ? 'border-[#d4a52c]/50 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket ID, title, category..."
              className="w-full rounded-lg border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-[11px] text-white/80 placeholder:text-white/25 focus:border-[#d4a52c]/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-[11px] text-red-300">{error}</p>
            <button onClick={load} className="mt-2 text-[10px] text-red-400 underline">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-white/15" strokeWidth={1.5} />
            <p className="mt-2 text-[12px] font-semibold text-white/50">
              {filter === 'new' ? 'No new issues' : filter === 'all' ? 'No issues found' : `No ${filter.replace('_', ' ')} issues`}
            </p>
            {search && <p className="mt-1 text-[10px] text-white/30">Try adjusting your search.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((issue) => (
              <IssueQueueCard
                key={issue.id}
                issue={issue}
                onOpen={() => handleOpenIssue(issue)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          staffAccount={staffAccount}
          onClose={handleCloseDetail}
          onUpdate={() => load()}
        />
      )}
    </div>
  );
}

// ── Queue card ──

function IssueQueueCard({ issue, onOpen }: { issue: IssueRecord; onOpen: () => void }) {
  const Icon = CATEGORY_ICONS[issue.category] ?? MoreHorizontal;
  const statusColor = isActiveStatus(issue.status)
    ? issue.status === 'new' ? '#60a5fa' : '#fbbf24'
    : issue.status === 'closed' ? '#6b7280' : '#4ade80';
  const priorityColor: Record<string, string> = {
    low: '#6b7280', normal: GOLD, high: '#f59e0b', urgent: '#ef4444',
  };

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all hover:border-white/15"
      style={{ borderColor: PANEL_BORDER, background: 'linear-gradient(135deg, rgba(40,31,21,0.30), rgba(10,10,12,0.45))', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(212,165,44,0.08)' }}>
        <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono font-bold" style={{ color: GOLD_SOFT }}>{issue.ticket_id}</code>
          <span className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ background: statusColor + '20', color: statusColor }}>
            {getStatusLabel(issue.status)}
          </span>
          {issue.priority !== 'normal' && issue.priority !== 'low' && (
            <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ background: priorityColor[issue.priority] + '20', color: priorityColor[issue.priority] }}>
              <Flag className="h-2 w-2" /> {getPriorityLabel(issue.priority)}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[12px] font-semibold text-white/90">{issue.title}</p>
        <p className="mt-0.5 truncate text-[10px] text-white/40">{getCategoryLabel(issue.category)}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[9px] text-white/30">{new Date(issue.created_at).toLocaleDateString()}</p>
        {issue.assigned_to && (
          <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[8px] text-white/40">
            <UserCheck className="h-2.5 w-2.5" /> Assigned
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
    </button>
  );
}

// ── Detail modal ──

interface DetailProps {
  issue: IssueRecord;
  staffAccount: { id: string; name: string };
  onClose: () => void;
  onUpdate: () => void;
}

function IssueDetailModal({ issue, staffAccount, onClose, onUpdate }: DetailProps) {
  const [currentIssue, setCurrentIssue] = useState(issue);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [activity, setActivity] = useState<IssueActivity[]>([]);
  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [reporterEmail, setReporterEmail] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, cmts, acts, atts] = await Promise.all([
        fetchIssueDetails(issue.id),
        fetchIssueComments(issue.id),
        fetchIssueActivity(issue.id),
        fetchIssueAttachments(issue.id),
      ]);
      if (detail) setCurrentIssue(detail);
      setComments(cmts);
      setActivity(acts);
      setAttachments(atts);

      // Load attachment URLs
      const urls: Record<string, string> = {};
      for (const att of atts) {
        urls[att.id] = await getAttachmentUrl(att.storage_path);
      }
      setAttachmentUrls(urls);

      // Load reporter email
      if (detail?.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name, username')
          .eq('user_id', detail.user_id)
          .maybeSingle();
        if (profile) {
          setReporterEmail((profile as { display_name?: string; username?: string }).display_name ?? (profile as { username?: string }).username ?? null);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [issue.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setActionLoading(true);
    try {
      await addComment(currentIssue.id, commentText, isInternal);
      if (!isInternal) {
        await createNotification({
          userId: currentIssue.user_id,
          type: 'activity',
          title: 'Support team responded',
          body: `${currentIssue.ticket_id}: ${commentText.slice(0, 80)}`,
          sourceId: currentIssue.id,
          sourceType: 'support_ticket',
        });
      }
      setCommentText('');
      await loadAll();
      onUpdate();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: IssueStatus) => {
    setActionLoading(true);
    try {
      await updateIssueStatus(currentIssue.id, newStatus, currentIssue.status);
      await createNotification({
        userId: currentIssue.user_id,
        type: 'activity',
        title: `Ticket ${getStatusLabel(newStatus)}`,
        body: `${currentIssue.ticket_id}: Status changed to ${getStatusLabel(newStatus)}`,
        sourceId: currentIssue.id,
        sourceType: 'support_ticket',
      });
      await loadAll();
      onUpdate();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handlePriorityChange = async (newPriority: IssuePriority) => {
    setActionLoading(true);
    try {
      await updateIssuePriority(currentIssue.id, newPriority, currentIssue.priority);
      await loadAll();
      onUpdate();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async () => {
    setActionLoading(true);
    try {
      const newAssignee = currentIssue.assigned_to === staffAccount.id ? null : staffAccount.id;
      await assignIssue(currentIssue.id, newAssignee);
      await loadAll();
      onUpdate();
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await updateIssueStatus(currentIssue.id, 'resolved', currentIssue.status);
      await loadAll();
      onUpdate();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    setActionLoading(true);
    try {
      await updateIssueStatus(currentIssue.id, 'in_progress', currentIssue.status);
      await logActivity(currentIssue.id, 'reopened', 'Issue reopened by staff');
      await loadAll();
      onUpdate();
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor = isActiveStatus(currentIssue.status)
    ? currentIssue.status === 'new' ? '#60a5fa' : '#fbbf24'
    : currentIssue.status === 'closed' ? '#6b7280' : '#4ade80';
  const Icon = CATEGORY_ICONS[currentIssue.category] ?? MoreHorizontal;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border"
        style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.96)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0d10] px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(212,165,44,0.08)' }}>
              <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <code className="text-[11px] font-mono font-bold" style={{ color: GOLD_SOFT }}>{currentIssue.ticket_id}</code>
              <span className="ml-2 rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ background: statusColor + '20', color: statusColor }}>
                {getStatusLabel(currentIssue.status)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            {/* Title + description */}
            <div>
              <h3 className="text-sm font-bold text-white">{currentIssue.title}</h3>
              <p className="mt-1 text-[10px] text-white/40">{getCategoryLabel(currentIssue.category)}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap">{currentIssue.description}</p>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetaItem label="Reporter" value={reporterEmail ?? 'User'} />
              <MetaItem label="Priority" value={getPriorityLabel(currentIssue.priority)} />
              <MetaItem label="Assigned" value={currentIssue.assigned_to ? 'Yes' : 'Unassigned'} />
              <MetaItem label="Created" value={new Date(currentIssue.created_at).toLocaleDateString()} />
            </div>

            {currentIssue.page_location && (
              <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                <p className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Page Location</p>
                <p className="mt-1 truncate text-[10px] text-white/50">{currentIssue.page_location}</p>
              </div>
            )}

            {currentIssue.user_agent && (
              <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                <p className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Browser / Device</p>
                <p className="mt-1 text-[10px] text-white/50">{currentIssue.user_agent}</p>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-white/30 uppercase">
                  <Paperclip className="h-3 w-3" /> Attachments
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={attachmentUrls[att.id] ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-video overflow-hidden rounded-lg border border-white/10"
                    >
                      {attachmentUrls[att.id] && att.mime_type?.startsWith('image/') ? (
                        <img src={attachmentUrls[att.id]} alt={att.file_name} className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Paperclip className="h-5 w-5 text-white/30" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                        <span className="truncate text-[8px] text-white/80">{att.file_name}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Staff actions */}
            <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
              <p className="mb-2 text-[9px] font-bold tracking-widest text-white/30 uppercase">Staff Actions</p>
              <div className="flex flex-wrap gap-2">
                {/* Assign / Unassign */}
                <button
                  onClick={handleAssign}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/70 uppercase transition hover:text-white disabled:opacity-50"
                >
                  <UserCheck className="h-3 w-3" />
                  {currentIssue.assigned_to === staffAccount.id ? 'Unassign' : 'Assign to Me'}
                </button>

                {/* Priority selector */}
                <select
                  value={currentIssue.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as IssuePriority)}
                  disabled={actionLoading}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[9px] font-bold tracking-widest text-white/70 uppercase focus:outline-none disabled:opacity-50"
                >
                  {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                    <option key={p} value={p}>{getPriorityLabel(p)}</option>
                  ))}
                </select>

                {/* Status selector */}
                <select
                  value={currentIssue.status}
                  onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                  disabled={actionLoading}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[9px] font-bold tracking-widest text-white/70 uppercase focus:outline-none disabled:opacity-50"
                >
                  {(['new', 'in_progress', 'resolved', 'reopened', 'closed'] as const).map((s) => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>

                {/* Complete button */}
                {isActiveStatus(currentIssue.status) && (
                  <button
                    onClick={handleComplete}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition disabled:opacity-50"
                    style={{ borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Complete
                  </button>
                )}

                {/* Reopen */}
                {(currentIssue.status === 'resolved' || currentIssue.status === 'closed') && (
                  <button
                    onClick={handleReopen}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[9px] font-bold tracking-widest text-amber-400 uppercase transition disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Reopen
                  </button>
                )}
              </div>
            </div>

            {/* Internal notes / comments */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-white/30 uppercase">
                <MessageSquare className="h-3 w-3" /> Comments & Notes
              </p>

              {comments.length > 0 ? (
                <div className="mb-3 space-y-1.5">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border px-3 py-2"
                      style={{
                        borderColor: c.is_internal ? 'rgba(212,165,44,0.15)' : 'rgba(255,255,255,0.06)',
                        background: c.is_internal ? 'rgba(212,165,44,0.04)' : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      {c.is_internal && (
                        <span className="mb-1 inline-block rounded-full bg-[#d4a52c]/15 px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
                          Internal
                        </span>
                      )}
                      <p className="text-[11px] leading-relaxed text-white/70">{c.content}</p>
                      <p className="mt-1 text-[8px] text-white/25">{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-[10px] text-white/30">No comments yet.</p>
              )}

              {/* Add comment */}
              <div className="space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add an internal note or public comment..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/90 placeholder:text-white/25 focus:border-[#d4a52c]/30 focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] text-white/50">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="h-3 w-3 accent-[#d4a52c]"
                    />
                    Internal note (staff only)
                  </label>
                  <button
                    onClick={handleAddComment}
                    disabled={actionLoading || !commentText.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/70 uppercase transition hover:text-white disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                    Post
                  </button>
                </div>
              </div>
            </div>

            {/* Activity history */}
            {activity.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-white/30 uppercase">
                  <Activity className="h-3 w-3" /> Activity History
                </p>
                <div className="space-y-1">
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-[10px]">
                      <Clock className="mt-0.5 h-2.5 w-2.5 shrink-0 text-white/20" />
                      <div>
                        <span className="text-white/50">{a.action.replace(/_/g, ' ')}</span>
                        {a.detail && <span className="text-white/35"> — {a.detail}</span>}
                        <span className="ml-1 text-white/20">{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2">
      <p className="text-[8px] font-bold tracking-widest text-white/30 uppercase">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-white/80">{value}</p>
    </div>
  );
}

// ── Helpers ──

function filterIssues(issues: IssueRecord[], filter: FilterTab, search: string): IssueRecord[] {
  let result = issues;

  if (filter === 'new') {
    result = result.filter((i) => i.status === 'new');
  } else if (filter === 'in_progress') {
    result = result.filter((i) => i.status === 'in_progress' || i.status === 'reopened');
  } else if (filter === 'resolved') {
    result = result.filter((i) => i.status === 'resolved' || i.status === 'closed');
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (i) =>
        i.ticket_id.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        getCategoryLabel(i.category).toLowerCase().includes(q),
    );
  }

  return result;
}

async function fetchActiveIssueCountSafe(): Promise<number> {
  try {
    const { count } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .in('status', ['new', 'in_progress', 'reopened']);
    return count ?? 0;
  } catch {
    return 0;
  }
}
