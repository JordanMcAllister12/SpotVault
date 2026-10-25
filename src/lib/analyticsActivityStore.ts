import { supabase } from '@/lib/supabase';

export type AnalyticsEventType =
  | 'upload_started'
  | 'upload_completed'
  | 'upload_failed'
  | 'duplicates_skipped'
  | 'calculation_started'
  | 'calculation_completed'
  | 'calculation_failed'
  | 'data_cleared'
  | 'analytics_recalculated'
  | 'rebuild_from_raw';

export type AnalyticsEventStatus = 'started' | 'completed' | 'failed';

export interface AnalyticsActivityEvent {
  id: string;
  user_id: string;
  event_type: AnalyticsEventType;
  created_at: string;
  batch_id: string | null;
  job_id: string | null;
  mode: string | null;
  hands_submitted: number | null;
  hands_inserted: number | null;
  hands_duplicates: number | null;
  hands_deleted: number | null;
  status: AnalyticsEventStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface AnalyticsActivityFilter {
  type: 'all' | 'uploads' | 'calculations' | 'data_clears';
  dateRange: 'today' | '7d' | '30d' | 'all';
}

/**
 * Log an analytics activity event. This is fire-and-forget — errors are
 * swallowed so they never block the primary operation.
 */
export async function logAnalyticsActivity(
  userId: string,
  eventType: AnalyticsEventType,
  params: {
    status?: AnalyticsEventStatus;
    batchId?: string | null;
    jobId?: string | null;
    mode?: string | null;
    handsSubmitted?: number | null;
    handsInserted?: number | null;
    handsDuplicates?: number | null;
    handsDeleted?: number | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await supabase.from('poker_analytics_activity_events').insert({
      user_id: userId,
      event_type: eventType,
      status: params.status ?? 'completed',
      batch_id: params.batchId ?? null,
      job_id: params.jobId ?? null,
      mode: params.mode ?? null,
      hands_submitted: params.handsSubmitted ?? null,
      hands_inserted: params.handsInserted ?? null,
      hands_duplicates: params.handsDuplicates ?? null,
      hands_deleted: params.handsDeleted ?? null,
      error_message: params.errorMessage ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Silent — activity logging must never break the primary operation
  }
}

/**
 * Fetch analytics activity events for a user, with optional filtering.
 * Limited to 100 most recent events for performance.
 */
export async function fetchAnalyticsActivity(
  userId: string,
  filter: AnalyticsActivityFilter,
): Promise<AnalyticsActivityEvent[]> {
  let query = supabase
    .from('poker_analytics_activity_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (filter.type === 'uploads') {
    query = query.in('event_type', ['upload_started', 'upload_completed', 'upload_failed', 'duplicates_skipped']);
  } else if (filter.type === 'calculations') {
    query = query.in('event_type', ['calculation_started', 'calculation_completed', 'calculation_failed', 'analytics_recalculated', 'rebuild_from_raw']);
  } else if (filter.type === 'data_clears') {
    query = query.in('event_type', ['data_cleared']);
  }

  if (filter.dateRange !== 'all') {
    const now = Date.now();
    let cutoff: number;
    if (filter.dateRange === 'today') {
      cutoff = new Date(now).setHours(0, 0, 0, 0);
    } else if (filter.dateRange === '7d') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }
    query = query.gte('created_at', new Date(cutoff).toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as AnalyticsActivityEvent[];
}

const EVENT_LABELS: Record<AnalyticsEventType, string> = {
  upload_started: 'Upload Started',
  upload_completed: 'Upload Completed',
  upload_failed: 'Upload Failed',
  duplicates_skipped: 'Duplicates Skipped',
  calculation_started: 'Calculation Started',
  calculation_completed: 'Calculation Completed',
  calculation_failed: 'Calculation Failed',
  data_cleared: 'Data Cleared',
  analytics_recalculated: 'Analytics Recalculated',
  rebuild_from_raw: 'Rebuild from Raw',
};

const EVENT_ICONS: Record<AnalyticsEventType, string> = {
  upload_started: 'Upload',
  upload_completed: 'CheckCircle2',
  upload_failed: 'AlertTriangle',
  duplicates_skipped: 'Copy',
  calculation_started: 'Calculator',
  calculation_completed: 'CheckCircle2',
  calculation_failed: 'AlertTriangle',
  data_cleared: 'Trash2',
  analytics_recalculated: 'RefreshCw',
  rebuild_from_raw: 'Hammer',
};

export function getEventLabel(type: AnalyticsEventType): string {
  return EVENT_LABELS[type] ?? type;
}

export function getEventIconName(type: AnalyticsEventType): string {
  return EVENT_ICONS[type] ?? 'Activity';
}
