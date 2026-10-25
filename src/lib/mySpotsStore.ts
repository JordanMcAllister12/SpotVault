import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type MySpotsCategory = 'all' | 'spots' | 'hh-jukebox' | 'courses' | 'media' | 'bundles';

export type MySpotsContentType = 'spot' | 'hh-jukebox' | 'course' | 'media' | 'bundle' | 'msa';

export type EntitlementSource =
  | 'purchase'
  | 'free_claim'
  | 'gift'
  | 'creator_grant'
  | 'coach_grant'
  | 'promotion'
  | 'subscription'
  | 'syncshare';

export interface MySpotsItem {
  id: string;
  entitlementId: string;
  contentType: MySpotsContentType;
  contentId: string;
  title: string;
  creator: string;
  thumbnail: string | null;
  source: EntitlementSource;
  grantedAt: string;
  progress?: {
    percent: number;
    currentLabel?: string;
  };
  youtubeVideoId?: string;
  videoUrl?: string;
  productId?: string;
  handCount?: number;
  studiedHandIds?: string[];
  spotId?: string;
  pokerSite?: string;
  syncsharedBy?: string;
  gifterName?: string;
  courseLessonCount?: number;
  courseCompletedLessons?: number;
}

interface RawEntitlement {
  id: string;
  user_id: string;
  resource_type: string;
  resource_id: string;
  entitlement_type: string;
  source: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  metadata: Record<string, unknown> | null;
}

const MEDIA_BUCKET = 'media-manager';

export async function loadEntitlementItems(userId: string): Promise<MySpotsItem[]> {
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return [];
  }

  const { data: entitlements, error: entError } = await supabase
    .from('sv_entitlements')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });

  if (entError) {
    console.error('[MySpotsStore] Entitlement query error:', entError);
    return [];
  }

  if (!entitlements || entitlements.length === 0) return [];

  const items = await Promise.all(
    (entitlements as RawEntitlement[]).map((ent) => buildMySpotsItem(ent))
  );
  return items.filter((item): item is MySpotsItem => item !== null);
}

export async function loadSharedItems(): Promise<MySpotsItem[]> {
  return loadSyncShareMySpotsItems();
}

export async function loadSyncShareMySpotsItems(): Promise<MySpotsItem[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data: syncshares, error } = await supabase.rpc('sv_list_my_syncshares');
  if (error || !syncshares) return [];

  const items: MySpotsItem[] = [];
  for (const share of syncshares as Array<{ id: string; content_type: string; content_id: string; owner_name: string; created_at: string }>) {
    const contentType = share.content_type === 'content_spot' ? 'spot' : 'hh-jukebox';
    const base = {
      id: `syncshare-${share.id}`,
      entitlementId: share.id,
      contentType: contentType as MySpotsContentType,
      contentId: share.content_id,
      source: 'syncshare' as EntitlementSource,
      grantedAt: share.created_at,
      syncsharedBy: share.owner_name,
    };

    try {
      if (contentType === 'spot') {
        const { data: spot } = await supabase
          .from('content_spots')
          .select('id, title, creator_name, poker_site')
          .eq('id', share.content_id)
          .maybeSingle();
        items.push({
          ...base,
          title: spot?.title ?? 'SyncShared Spot',
          creator: spot?.creator_name ?? share.owner_name,
          thumbnail: null,
          spotId: share.content_id,
          pokerSite: (spot?.poker_site as string) ?? undefined,
        });
      } else if (contentType === 'hh-jukebox') {
        const { data: product } = await supabase
          .from('jukebox_products')
          .select('id, title, creator_name, hand_count, thumbnail_color')
          .eq('id', share.content_id)
          .maybeSingle();
        items.push({
          ...base,
          title: product?.title ?? 'SyncShared Analysis',
          creator: product?.creator_name ?? share.owner_name,
          thumbnail: null,
          productId: share.content_id,
          handCount: product?.hand_count ?? 0,
        });
      }
    } catch (err) {
      console.error('[MySpotsStore] Failed to resolve syncshare item:', share.id, err);
    }
  }
  return items;
}

function mapResourceType(resourceType: string): MySpotsContentType | null {
  const map: Record<string, MySpotsContentType> = {
    'jukebox_product': 'hh-jukebox',
    'content_spot': 'spot',
    'course': 'course',
    'media_asset': 'media',
    'bundle': 'bundle',
  };
  return map[resourceType] ?? null;
}

function categoryFromContentType(ct: MySpotsContentType): MySpotsCategory {
  const map: Record<MySpotsContentType, MySpotsCategory> = {
    'spot': 'spots',
    'hh-jukebox': 'hh-jukebox',
    'course': 'courses',
    'media': 'media',
    'bundle': 'bundles',
    'msa': 'hh-jukebox',
  };
  return map[ct];
}

export function categoryOf(item: MySpotsItem): MySpotsCategory {
  return categoryFromContentType(item.contentType);
}

export function useMySpotsItems(userId: string | undefined) {
  const [items, setItems] = useState<MySpotsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [entitlementResult, syncshareResult] = await Promise.allSettled([
      loadEntitlementItems(userId),
      loadSyncShareMySpotsItems(),
    ]);

    const allItems: MySpotsItem[] = [];

    if (entitlementResult.status === 'fulfilled') {
      allItems.push(...entitlementResult.value);
    } else {
      console.error('[MySpotsStore] Entitlements failed:', entitlementResult.reason);
    }

    if (syncshareResult.status === 'fulfilled') {
      allItems.push(...syncshareResult.value);
    } else {
      console.error('[MySpotsStore] SyncShares failed:', syncshareResult.reason);
    }

    setItems(allItems);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}

async function buildMySpotsItem(ent: RawEntitlement): Promise<MySpotsItem | null> {
  const contentType = mapResourceType(ent.resource_type);
  if (!contentType) return null;

  const base = {
    id: `${ent.resource_type}-${ent.resource_id}`,
    entitlementId: ent.id,
    contentType,
    contentId: String(ent.resource_id),
    source: (ent.source as EntitlementSource) || 'purchase',
    grantedAt: ent.granted_at,
    gifterName: (ent.source === 'gift' && ent.metadata)
      ? ((ent.metadata.gifter_name as string) || (ent.metadata.from_name as string) || undefined)
      : undefined,
  };

  try {
    if (contentType === 'hh-jukebox') {
      const { data: product } = await supabase
        .from('jukebox_products')
        .select('id, title, creator_name, hand_count, thumbnail_color')
        .eq('id', ent.resource_id)
        .maybeSingle();

      const { data: progress } = await supabase
        .from('jukebox_progress')
        .select('studied_hand_ids, current_hand_index, is_completed')
        .eq('user_id', ent.user_id)
        .eq('product_id', ent.resource_id)
        .maybeSingle();

      const studied = (progress?.studied_hand_ids as string[]) ?? [];
      const total = product?.hand_count ?? 0;
      const percent = total > 0 ? Math.round((studied.length / total) * 100) : 0;

      return {
        ...base,
        title: product?.title ?? 'Multi-Spot Analysis Product',
        creator: product?.creator_name ?? 'Unknown',
        thumbnail: null,
        productId: String(ent.resource_id),
        handCount: total,
        studiedHandIds: studied,
        progress: {
          percent,
          currentLabel: progress?.is_completed ? 'Completed' : `${studied.length}/${total} hands`,
        },
      };
    }

    if (contentType === 'media') {
      const { data: media } = await supabase
        .from('media_assets')
        .select('id, title, source_type, storage_path, youtube_video_id, youtube_url, thumbnail_url')
        .eq('id', ent.resource_id)
        .maybeSingle();

      if (!media) return null;

      const videoUrl = media.storage_path
        ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(media.storage_path).data.publicUrl
        : '';

      return {
        ...base,
        title: media.title ?? 'Media',
        creator: 'SpotVault',
        thumbnail: media.thumbnail_url,
        youtubeVideoId: media.youtube_video_id ?? undefined,
        videoUrl: videoUrl || undefined,
      };
    }

    if (contentType === 'spot') {
      const { data: spot } = await supabase
        .from('content_spots')
        .select('id, title, creator_name, account_id, spot_type, image_urls, poker_site')
        .eq('id', ent.resource_id)
        .maybeSingle();

      const isMsa = spot?.spot_type === 'multi_spot_analysis';
      return {
        ...base,
        contentType: isMsa ? 'msa' : 'spot',
        title: spot?.title ?? 'Spot',
        creator: spot?.creator_name ?? 'Unknown',
        thumbnail: (spot?.image_urls as string[])?.[0] ?? null,
        spotId: String(ent.resource_id),
        pokerSite: (spot?.poker_site as string) ?? undefined,
      };
    }

    if (contentType === 'course') {
      const meta = ent.metadata ?? {};
      return {
        ...base,
        title: (meta.title as string) ?? 'Course',
        creator: (meta.creator as string) ?? 'Unknown',
        thumbnail: (meta.thumbnail as string) ?? null,
        courseLessonCount: (meta.lessonCount as number) ?? undefined,
        courseCompletedLessons: (meta.completedLessons as number) ?? undefined,
        progress: meta.lessonCount
          ? {
              percent: Math.round((((meta.completedLessons as number) ?? 0) / (meta.lessonCount as number)) * 100),
              currentLabel: `${(meta.completedLessons as number) ?? 0}/${meta.lessonCount as number} lessons`,
            }
          : undefined,
      };
    }

    if (contentType === 'bundle') {
      const meta = ent.metadata ?? {};
      return {
        ...base,
        title: (meta.title as string) ?? 'Bundle',
        creator: (meta.creator as string) ?? 'Unknown',
        thumbnail: (meta.thumbnail as string) ?? null,
      };
    }

    return null;
  } catch (err) {
    console.error('[MySpotsStore] Failed to build item for entitlement:', ent.id, err);
    return null;
  }
}

export async function grantEntitlement(
  userId: string,
  resourceType: string,
  resourceId: string,
  source: EntitlementSource = 'purchase',
  entitlementType: string = 'access',
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_entitlements')
    .insert({
      user_id: userId,
      resource_type: resourceType,
      resource_id: resourceId,
      entitlement_type: entitlementType,
      source,
      metadata: metadata ?? null,
    });
  if (error) {
    console.error('[MySpotsStore] Failed to grant entitlement:', error);
    return false;
  }
  return true;
}

export async function checkEntitlement(
  userId: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('sv_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .is('revoked_at', null)
    .maybeSingle();
  return !!data;
}
