import { supabase } from '@/lib/supabase';
import { sanitizeArticleHtml } from '@/lib/mainFeed';

export interface StaffAnnouncement {
  id: string;
  title: string;
  body_html: string | null;
  image_url: string | null;
  status: 'draft' | 'scheduled' | 'published';
  is_pinned: boolean;
  author_id: string | null;
  author_name: string | null;
  published_at: string | null;
  scheduled_for: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InfoFeedRotationSettings {
  enabled: boolean;
  interval_seconds: number;
}

const ROTATION_KEY = 'info_feed_rotation';
const DEFAULT_ROTATION: InfoFeedRotationSettings = { enabled: false, interval_seconds: 30 };

export async function fetchPublishedAnnouncements(): Promise<StaffAnnouncement[]> {
  const { data, error } = await supabase
    .from('staff_announcements')
    .select('*')
    .eq('status', 'published')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllAnnouncements(): Promise<StaffAnnouncement[]> {
  const { data, error } = await supabase
    .from('staff_announcements')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveAnnouncement(
  ann: Partial<StaffAnnouncement>,
): Promise<StaffAnnouncement> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const userName = userData.user?.email?.split('@')[0] ?? 'Staff';

  const bodyHtml = ann.body_html ? sanitizeArticleHtml(ann.body_html) : null;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: ann.title,
    body_html: bodyHtml,
    image_url: ann.image_url,
    status: ann.status,
    is_pinned: ann.is_pinned,
    updated_at: now,
  };

  if (ann.status === 'published' && !ann.published_at) {
    payload.published_at = now;
    payload.scheduled_for = null;
  } else if (ann.status === 'scheduled' && ann.scheduled_for) {
    payload.scheduled_for = ann.scheduled_for;
  }

  if (ann.expires_at !== undefined) {
    payload.expires_at = ann.expires_at;
  }

  if (ann.id) {
    const { data, error } = await supabase
      .from('staff_announcements')
      .update(payload)
      .eq('id', ann.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    payload.author_id = userId;
    payload.author_name = userName;
    const { data, error } = await supabase
      .from('staff_announcements')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('staff_announcements')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('staff_announcements')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchRotationSettings(): Promise<InfoFeedRotationSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', ROTATION_KEY)
    .maybeSingle();
  if (error) return DEFAULT_ROTATION;
  if (!data) return DEFAULT_ROTATION;
  const val = data.value as Record<string, unknown>;
  return {
    enabled: typeof val.enabled === 'boolean' ? val.enabled : DEFAULT_ROTATION.enabled,
    interval_seconds: typeof val.interval_seconds === 'number' ? val.interval_seconds : DEFAULT_ROTATION.interval_seconds,
  };
}

export async function saveRotationSettings(settings: InfoFeedRotationSettings): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: ROTATION_KEY, value: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw error;
}
