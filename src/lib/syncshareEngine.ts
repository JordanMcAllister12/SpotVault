import { supabase } from '@/lib/supabase';
import { ENTITLEMENTS, canPerformAction, type MembershipTier } from '@/lib/entitlements';

export type SyncShareContentType = 'content_spot' | 'jukebox_product';
export type ShareScope = 'off' | 'all_connections' | 'selected_connections';

export interface IncomingSyncShare {
  id: string;
  content_type: SyncShareContentType;
  content_id: string;
  owner_id: string;
  owner_name: string;
  message: string | null;
  created_at: string;
}

export interface OutgoingSyncShare {
  id: string;
  content_type: SyncShareContentType;
  content_id: string;
  recipient_id: string;
  recipient_name: string;
  status: string;
  created_at: string;
}

export async function getMonthlySyncShareCount(userId: string): Promise<number> {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('sv_syncshares')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('created_at', oneMonthAgo);
  if (error) return 0;
  return count ?? 0;
}

export async function canSyncShare(userId: string, tier: MembershipTier): Promise<{ allowed: boolean; used: number; limit: number | null; message: string | null }> {
  const entitlements = ENTITLEMENTS[tier];
  const used = await getMonthlySyncShareCount(userId);
  const limit = entitlements.syncSharesMonthly;
  const allowed = canPerformAction(limit, used);
  const message = limit === 0
    ? 'Sync Shares are available with Core, Elite and Pro.'
    : !allowed
      ? "You've reached your monthly Sync Share limit."
      : null;
  return { allowed, used, limit, message };
}

export async function shareWithConnection(
  contentType: SyncShareContentType,
  contentId: string,
  recipientId: string,
  message?: string
): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { error } = await supabase
    .from('sv_syncshares')
    .upsert(
      {
        content_type: contentType,
        content_id: contentId,
        owner_id: userData.user.id,
        recipient_id: recipientId,
        status: 'active',
        share_scope: 'selected_connections',
        message: message ?? null,
      },
      { onConflict: 'content_type,content_id,recipient_id' }
    );

  if (error) {
    console.error('shareWithConnection error:', error);
    return false;
  }
  return true;
}

export async function shareWithAllConnections(
  contentType: SyncShareContentType,
  contentId: string,
  message?: string
): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  const connections = await supabase.rpc('sv_list_connections');
  if (connections.error || !connections.data) return 0;

  const recipientIds = (connections.data as Array<{ user_id: string }>).map((c) => c.user_id);
  if (recipientIds.length === 0) return 0;

  const rows = recipientIds.map((recipientId) => ({
    content_type: contentType,
    content_id: contentId,
    owner_id: userData.user.id,
    recipient_id: recipientId,
    status: 'active' as const,
    share_scope: 'all_connections' as const,
    message: message ?? null,
  }));

  const { error } = await supabase
    .from('sv_syncshares')
    .upsert(rows, { onConflict: 'content_type,content_id,recipient_id' });

  if (error) {
    console.error('shareWithAllConnections error:', error);
    return 0;
  }
  return recipientIds.length;
}

export async function listIncomingSyncShares(): Promise<IncomingSyncShare[]> {
  const { data, error } = await supabase.rpc('sv_list_my_syncshares');
  if (error || !data) return [];
  return data as IncomingSyncShare[];
}

export async function listOutgoingSyncShares(): Promise<OutgoingSyncShare[]> {
  const { data, error } = await supabase.rpc('sv_list_shared_by_me');
  if (error || !data) return [];
  return data as OutgoingSyncShare[];
}

export async function revokeSyncShare(syncshareId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_revoke_syncshare', {
    p_syncshare_id: syncshareId,
  });
  if (error) {
    console.error('revokeSyncShare error:', error);
    return false;
  }
  return true;
}

export interface SharedSpot extends IncomingSyncShare {
  title: string;
  subtitle: string | null;
  status: string;
  creator_name: string;
}

export async function listSharedSpots(): Promise<SharedSpot[]> {
  const { data, error } = await supabase.rpc('sv_list_shared_spots');
  if (error || !data) return [];
  return data as SharedSpot[];
}

export interface SpotShareRecipient {
  syncshare_id: string;
  recipient_id: string;
  recipient_name: string;
  status: string;
  created_at: string;
}

export async function listSpotShareRecipients(contentId: string): Promise<SpotShareRecipient[]> {
  const { data, error } = await supabase.rpc('sv_list_spot_share_recipients', {
    p_content_id: contentId,
  });
  if (error || !data) return [];
  return data as SpotShareRecipient[];
}

export async function isSyncSharedToMe(contentType: SyncShareContentType, contentId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data } = await supabase
    .from('sv_syncshares')
    .select('id')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .eq('recipient_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  return !!data;
}
