import { supabase } from '@/lib/supabase';
import type { LoungeConfig, BackgroundPreference, LoungePost } from '@/lib/loungeFramework';
import { DEFAULT_BG_PREFERENCE } from '@/lib/loungeFramework';
import { createNotification } from '@/lib/notificationStore';

// ── Lounge Config ────────────────────────────────────────────────

export async function fetchLoungeConfig(slug: string): Promise<LoungeConfig | null> {
  const { data, error } = await supabase
    .from('lounge_configs')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    type: data.type,
    description: data.description,
    logo: data.logo,
    defaultBackground: data.default_background,
    defaultBackgroundFit: data.default_background_fit,
    defaultBackgroundPosition: data.default_background_position,
    defaultOverlay: data.default_overlay,
    theme: data.theme,
    modules: data.modules ?? [],
    feedSettings: data.feed_settings,
    chatSettings: data.chat_settings,
    eventSettings: data.event_settings,
    permissions: data.permissions,
    allowUserBackgroundCustomization: data.allow_user_background_customization ?? true,
    ownerAccent: data.owner_accent ?? null,
    ownerLogo: data.owner_logo ?? null,
    ownerCover: data.owner_cover ?? null,
    memberPersonalization: data.member_personalization ?? true,
  };
}

export async function updateLoungeConfig(
  slug: string,
  updates: {
    owner_accent?: string | null;
    owner_logo?: string | null;
    owner_cover?: string | null;
    member_personalization?: boolean;
    default_background?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from('lounge_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  return !error;
}

// ── Background Preferences ───────────────────────────────────────

export async function fetchBackgroundPreference(
  userId: string,
  loungeSlug: string,
): Promise<BackgroundPreference | null> {
  const { data, error } = await supabase
    .from('lounge_background_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('lounge_slug', loungeSlug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    backgroundType: data.background_type,
    backgroundValue: data.background_value,
    fit: data.fit,
    position: data.position,
    overlay: data.overlay,
  };
}

export async function saveBackgroundPreference(
  userId: string,
  loungeSlug: string,
  pref: BackgroundPreference,
): Promise<void> {
  const { error } = await supabase
    .from('lounge_background_preferences')
    .upsert(
      {
        user_id: userId,
        lounge_slug: loungeSlug,
        background_type: pref.backgroundType,
        background_value: pref.backgroundValue,
        fit: pref.fit,
        position: pref.position,
        overlay: pref.overlay,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lounge_slug' },
    );
  if (error) throw error;
}

// ── Lounge Feed Posts ────────────────────────────────────────────

export async function fetchLoungePosts(loungeSlug: string, limit = 50): Promise<LoungePost[]> {
  const { data, error } = await supabase
    .from('poker_lounge_messages')
    .select('*')
    .eq('lounge_id', loungeSlug)
    .is('reply_to', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    author_id: r.author_id as string,
    author_name: r.author_name as string,
    author_avatar: (r.author_avatar as string) ?? null,
    author_role: (r.author_role as string) ?? null,
    body: (r.body as string) ?? null,
    attachment_type: (r.attachment_type as string) ?? null,
    attachment_url: (r.attachment_url as string) ?? null,
    attachment_label: (r.attachment_label as string) ?? null,
    reply_to: (r.reply_to as string) ?? null,
    created_at: r.created_at as string,
    lounge_id: (r.lounge_id as string) ?? loungeSlug,
  }));
}

export async function fetchReplies(parentId: string): Promise<LoungePost[]> {
  const { data, error } = await supabase
    .from('poker_lounge_messages')
    .select('*')
    .eq('reply_to', parentId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    author_id: r.author_id as string,
    author_name: r.author_name as string,
    author_avatar: (r.author_avatar as string) ?? null,
    author_role: (r.author_role as string) ?? null,
    body: (r.body as string) ?? null,
    attachment_type: (r.attachment_type as string) ?? null,
    attachment_url: (r.attachment_url as string) ?? null,
    attachment_label: (r.attachment_label as string) ?? null,
    reply_to: (r.reply_to as string) ?? null,
    created_at: r.created_at as string,
  }));
}

export async function createLoungePost(params: {
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string | null;
  body: string;
  loungeSlug: string;
  replyTo?: string | null;
  attachmentType?: string | null;
  attachmentUrl?: string | null;
  attachmentLabel?: string | null;
}): Promise<LoungePost | null> {
  const { data, error } = await supabase
    .from('poker_lounge_messages')
    .insert({
      author_id: params.authorId,
      author_name: params.authorName,
      author_avatar: params.authorAvatar,
      author_role: params.authorRole,
      body: params.body,
      stakes_level: 'medium',
      poker_format: 'mtt',
      lounge_id: params.loungeSlug,
      reply_to: params.replyTo ?? null,
      attachment_type: params.attachmentType ?? null,
      attachment_url: params.attachmentUrl ?? null,
      attachment_label: params.attachmentLabel ?? null,
    })
    .select('*')
    .single();
  if (error) return null;

  const { data: members } = await supabase
    .from('lounge_memberships')
    .select('user_id')
    .eq('lounge_slug', params.loungeSlug)
    .eq('status', 'active')
    .neq('user_id', params.authorId);

  if (members && members.length > 0) {
    const messagePreview = params.body.slice(0, 120);
    await Promise.all(
      members.map((m: { user_id: string }) =>
        createNotification({
          userId: m.user_id,
          type: 'group_message',
          title: `${params.authorName} posted in ${params.loungeSlug}`,
          body: messagePreview,
          icon: 'Users',
          sourceId: data.id,
          sourceType: 'lounge_message',
          destination: `messaging:groups`,
        }),
      ),
    );
  }

  return {
    id: data.id,
    author_id: data.author_id,
    author_name: data.author_name,
    author_avatar: data.author_avatar ?? null,
    author_role: data.author_role ?? null,
    body: data.body ?? null,
    attachment_type: data.attachment_type ?? null,
    attachment_url: data.attachment_url ?? null,
    attachment_label: data.attachment_label ?? null,
    reply_to: data.reply_to ?? null,
    created_at: data.created_at,
    lounge_id: data.lounge_id,
  };
}

export async function fetchReactions(messageId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('network_chat_reactions')
    .select('emoji')
    .eq('message_id', messageId);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const r of data) {
    const e = r.emoji as string;
    counts[e] = (counts[e] ?? 0) + 1;
  }
  return counts;
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('network_chat_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from('network_chat_reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('network_chat_reactions').insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    });
  }
}

export { DEFAULT_BG_PREFERENCE };

// ── Legacy Lounge API (used by FloorRoom + LoungeView) ───────────

export type CommunityScope = 'spotvault' | 'stakekings';

export interface LoungeMessage {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string | null;
  body: string;
  stakes_level: string;
  poker_format: string;
  community_scope: CommunityScope;
  reply_to: string | null;
  created_at: string;
}

export async function fetchLoungeMessages(
  stakes: string,
  format?: string,
  scope?: CommunityScope,
): Promise<LoungeMessage[]> {
  let query = supabase
    .from('poker_lounge_messages')
    .select('*')
    .eq('stakes_level', stakes)
    .is('reply_to', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (format) query = query.eq('poker_format', format);
  if (scope) query = query.eq('community_scope', scope);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as LoungeMessage[];
}

export async function postLoungeMessage(
  body: string,
  stakes: string,
  format: string,
  scope: CommunityScope | undefined,
  meta: { authorId: string; authorName: string; authorAvatar?: string | null; authorRole?: string | null },
): Promise<LoungeMessage | null> {
  const { data, error } = await supabase
    .from('poker_lounge_messages')
    .insert({
      body,
      stakes_level: stakes,
      poker_format: format,
      community_scope: scope ?? 'spotvault',
      author_id: meta.authorId,
      author_name: meta.authorName,
      author_avatar: meta.authorAvatar ?? null,
      author_role: meta.authorRole ?? null,
    })
    .select('*')
    .single();
  if (error) return null;
  return data as unknown as LoungeMessage;
}

export function subscribeLoungeMessages(
  stakes: string,
  format: string | undefined,
  scope: CommunityScope | undefined,
  onMessage: (msg: LoungeMessage) => void,
): () => void {
  const channel = supabase
    .channel(`lounge-${stakes}-${format}-${scope ?? 'default'}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'poker_lounge_messages',
        filter: `stakes_level=eq.${stakes}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (format && row.poker_format !== format) return;
        if (scope && row.community_scope !== scope) return;
        onMessage(row as unknown as LoungeMessage);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
