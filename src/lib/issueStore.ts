import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notificationStore';

export type IssueCategory =
  | 'bug_technical'
  | 'hand_history'
  | 'analytics_spr'
  | 'solver'
  | 'spots_marketplace'
  | 'payments_membership'
  | 'account_login'
  | 'feature_suggestion'
  | 'report_user_safety'
  | 'other';

export type IssuePriority = 'low' | 'normal' | 'high' | 'urgent';
export type IssueStatus = 'new' | 'in_progress' | 'resolved' | 'reopened' | 'closed';

export interface IssueRecord {
  id: string;
  ticket_id: string;
  title: string;
  category: IssueCategory;
  description: string;
  page_location: string | null;
  priority: IssuePriority;
  status: IssueStatus;
  user_id: string;
  user_agent: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  author_id: string;
  is_internal: boolean;
  content: string;
  created_at: string;
}

export interface IssueActivity {
  id: string;
  issue_id: string;
  actor_id: string;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface IssueAttachment {
  id: string;
  issue_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  bug_technical: 'Bug / Technical Issue',
  hand_history: 'Hand History / Replayer',
  analytics_spr: 'Analytics / SPR',
  solver: 'Solver',
  spots_marketplace: 'Content / Marketplace',
  payments_membership: 'Membership / Billing',
  account_login: 'Account / Login',
  feature_suggestion: 'Feature Suggestion',
  report_user_safety: 'Report a User / Safety',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  reopened: 'Reopened',
  closed: 'Closed',
};

export const ACTIVE_STATUSES: IssueStatus[] = ['new', 'in_progress', 'reopened'];

export function getCategoryLabel(c: IssueCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}

export function getPriorityLabel(p: IssuePriority): string {
  return PRIORITY_LABELS[p] ?? p;
}

export function getStatusLabel(s: IssueStatus): string {
  return STATUS_LABELS[s] ?? s;
}

export function isActiveStatus(s: IssueStatus): boolean {
  return ACTIVE_STATUSES.includes(s);
}

interface CreateIssueInput {
  title: string;
  category: IssueCategory;
  description: string;
  pageLocation?: string;
  priority?: IssuePriority;
  userAgent?: string;
}

export async function createIssue(input: CreateIssueInput): Promise<IssueRecord> {
  const { data: ticketData } = await supabase.rpc('generate_ticket_id');
  const ticketId = ticketData as string;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('You must be signed in to report an issue.');

  const { data, error } = await supabase
    .from('issues')
    .insert({
      ticket_id: ticketId,
      title: input.title.trim(),
      category: input.category,
      description: input.description.trim(),
      page_location: input.pageLocation ?? null,
      priority: input.priority ?? 'normal',
      user_agent: input.userAgent ?? null,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('issue_activity').insert({
    issue_id: data.id,
    actor_id: userId,
    action: 'created',
    detail: `Issue reported as ${input.category}`,
  });

  await notifyStaffOfNewTicket(data.id, ticketId, input.title, input.category, input.priority ?? 'normal');

  return data as IssueRecord;
}

export async function uploadIssueAttachment(
  issueId: string,
  file: File,
): Promise<IssueAttachment | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `issues/${issueId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('user-uploads')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from('issue_attachments')
    .insert({
      issue_id: issueId,
      uploaded_by: userId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as IssueAttachment;
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data } = supabase.storage.from('user-uploads').createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? '';
}

export async function fetchUserIssues(): Promise<IssueRecord[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as IssueRecord[];
}

export async function fetchAllIssues(filter?: IssueStatus | 'all'): Promise<IssueRecord[]> {
  let query = supabase.from('issues').select('*');
  if (filter === 'resolved') {
    query = query.in('status', ['resolved', 'closed']);
  } else if (filter && filter !== 'all') {
    query = query.eq('status', filter);
  }
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as IssueRecord[];
}

export async function fetchActiveIssueCount(): Promise<number> {
  const { count, error } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .in('status', ACTIVE_STATUSES);
  if (error) return 0;
  return count ?? 0;
}

export async function fetchIssueDetails(issueId: string): Promise<IssueRecord | null> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', issueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as IssueRecord | null;
}

export async function fetchIssueComments(issueId: string): Promise<IssueComment[]> {
  const { data, error } = await supabase
    .from('issue_comments')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IssueComment[];
}

export async function fetchIssueActivity(issueId: string): Promise<IssueActivity[]> {
  const { data, error } = await supabase
    .from('issue_activity')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IssueActivity[];
}

export async function fetchIssueAttachments(issueId: string): Promise<IssueAttachment[]> {
  const { data, error } = await supabase
    .from('issue_attachments')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IssueAttachment[];
}

export async function addComment(
  issueId: string,
  content: string,
  isInternal: boolean,
): Promise<IssueComment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('issue_comments')
    .insert({
      issue_id: issueId,
      author_id: userId,
      is_internal: isInternal,
      content: content.trim(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IssueComment;
}

export async function logActivity(
  issueId: string,
  action: string,
  detail: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  await supabase.from('issue_activity').insert({
    issue_id: issueId,
    actor_id: userId,
    action,
    detail,
  });
}

export async function updateIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  oldStatus: IssueStatus,
): Promise<void> {
  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'resolved' || newStatus === 'closed') {
    updates.resolved_at = new Date().toISOString();
  } else {
    updates.resolved_at = null;
  }

  const { error } = await supabase.from('issues').update(updates).eq('id', issueId);
  if (error) throw new Error(error.message);

  await logActivity(
    issueId,
    newStatus === 'resolved' ? 'resolved' : 'status_changed',
    `Status changed from ${getStatusLabel(oldStatus)} to ${getStatusLabel(newStatus)}`,
  );
}

export async function updateIssuePriority(
  issueId: string,
  newPriority: IssuePriority,
  oldPriority: IssuePriority,
): Promise<void> {
  const { error } = await supabase
    .from('issues')
    .update({ priority: newPriority })
    .eq('id', issueId);
  if (error) throw new Error(error.message);
  await logActivity(
    issueId,
    'priority_changed',
    `Priority changed from ${getPriorityLabel(oldPriority)} to ${getPriorityLabel(newPriority)}`,
  );
}

export async function assignIssue(
  issueId: string,
  staffId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('issues')
    .update({ assigned_to: staffId })
    .eq('id', issueId);
  if (error) throw new Error(error.message);
  await logActivity(issueId, 'assigned', staffId ? 'Issue assigned to staff' : 'Issue unassigned');
}

export function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';
  const isMobile = /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop';
  return `${browser} / ${os} / ${isMobile}`;
}

async function notifyStaffOfNewTicket(
  issueId: string,
  ticketId: string,
  title: string,
  category: IssueCategory,
  priority: IssuePriority,
): Promise<void> {
  const { data: staffIds } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('primary_role', 'staff')
    .limit(20);

  if (!staffIds || staffIds.length === 0) return;

  const label = CATEGORY_LABELS[category] ?? category;
  await Promise.all(
    staffIds.map((row: { user_id: string }) =>
      createNotification({
        userId: row.user_id,
        type: 'inbox',
        title: `New ticket: ${ticketId}`,
        body: `${label} — ${title.slice(0, 80)}`,
        icon: 'LifeBuoy',
        sourceId: issueId,
        sourceType: 'support_ticket',
        destination: 'messaging:support',
      }),
    ),
  );
}
