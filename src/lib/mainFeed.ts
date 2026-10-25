import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notificationStore';

export type MainFeedStatus = 'draft' | 'scheduled' | 'published';
export type MainFeedPostType = 'news' | 'announcement' | 'platform_update' | 'feature' | 'education' | 'promotion' | 'community';
export type MainFeedPublisher = 'spotvault' | 'spotvault_news' | 'staff';

export interface MainFeedPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  post_type: MainFeedPostType;
  label: string | null;
  publish_as: MainFeedPublisher;
  feature_image_url: string | null;
  body_html: string;
  cta_label: string | null;
  cta_url: string | null;
  status: MainFeedStatus;
  published_at: string | null;
  scheduled_for: string | null;
  pin_until: string | null;
  is_pinned: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

const allowedTags = new Set(['P', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'A', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'BR', 'IMG', 'FIGURE', 'FIGCAPTION']);

export function sanitizeArticleHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  const nodes = template.content.querySelectorAll('*');
  nodes.forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || name === 'style' || (name !== 'href' && name !== 'src' && name !== 'alt' && name !== 'title' && name !== 'class')) {
        node.removeAttribute(attribute.name);
      } else if (name === 'href' && !/^(https?:|mailto:|#)/i.test(value)) {
        node.removeAttribute(attribute.name);
      } else if (name === 'src' && !/^(https?:|\/)/i.test(value)) {
        node.removeAttribute(attribute.name);
      }
    });
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return template.innerHTML;
}

export async function fetchPublishedMainFeed(): Promise<MainFeedPost[]> {
  const { data, error } = await supabase
    .from('main_feed_posts')
    .select('*')
    .in('status', ['published', 'scheduled'])
    .or(`published_at.lte.${new Date().toISOString()},scheduled_for.lte.${new Date().toISOString()}`)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false });
  if (error) throw error;
  const posts = (data ?? []) as MainFeedPost[];
  const now = Date.now();
  return posts.sort((a, b) => {
    const aPinned = a.is_pinned && (!a.pin_until || new Date(a.pin_until).getTime() > now);
    const bPinned = b.is_pinned && (!b.pin_until || new Date(b.pin_until).getTime() > now);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime();
  });
}

export async function fetchStaffMainFeed(): Promise<MainFeedPost[]> {
  const { data, error } = await supabase
    .from('main_feed_posts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MainFeedPost[];
}

export async function saveMainFeedPost(values: Partial<MainFeedPost> & Pick<MainFeedPost, 'title' | 'body_html' | 'post_type' | 'publish_as'>, id?: string): Promise<MainFeedPost> {
  const { data: userData } = await supabase.auth.getUser();
  const payload = {
    slug: values.slug ?? `${values.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`,
    title: values.title,
    subtitle: values.subtitle ?? null,
    post_type: values.post_type,
    label: values.label ?? null,
    publish_as: values.publish_as,
    feature_image_url: values.feature_image_url ?? null,
    body_html: sanitizeArticleHtml(values.body_html),
    cta_label: values.cta_label ?? null,
    cta_url: values.cta_url ?? null,
    status: values.status ?? 'draft',
    published_at: values.published_at ?? null,
    scheduled_for: values.scheduled_for ?? null,
    pin_until: values.pin_until ?? null,
    is_pinned: values.is_pinned ?? false,
    sort_order: values.sort_order ?? 0,
    ...(id ? {} : { author_id: userData.user?.id ?? null }),
  };
  const query = id
    ? supabase.from('main_feed_posts').update(payload).eq('id', id).select().maybeSingle()
    : supabase.from('main_feed_posts').insert(payload).select().maybeSingle();
  const { data, error } = await query;
  if (error || !data) throw error ?? new Error('Article was not saved');
  return data as MainFeedPost;
}

export async function updateMainFeedStatus(id: string, status: MainFeedStatus): Promise<void> {
  const { error } = await supabase.from('main_feed_posts').update({
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    scheduled_for: status === 'scheduled' ? undefined : null,
  }).eq('id', id);
  if (error) throw error;

  if (status === 'published') {
    const { data: post } = await supabase
      .from('main_feed_posts')
      .select('title, slug')
      .eq('id', id)
      .maybeSingle();
    if (post) {
      void createNotification({
        type: 'info_post',
        title: 'New Info Post',
        body: post.title,
        icon: 'Newspaper',
        sourceId: id,
        sourceType: 'main_feed_post',
        destination: 'wire',
        isBroadcast: true,
      });
    }
  }
}

export async function updateMainFeedOrder(id: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('main_feed_posts').update({ sort_order: sortOrder }).eq('id', id);
  if (error) throw error;
}

export async function deleteMainFeedPost(id: string): Promise<void> {
  const { error } = await supabase.from('main_feed_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadMainFeedImage(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('Invalid image');
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('main-feed').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from('main-feed').getPublicUrl(path).data.publicUrl;
}
