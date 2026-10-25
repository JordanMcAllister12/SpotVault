import { supabase } from '@/lib/supabase';

export interface WorkspaceHandQueueItem {
  id: string;
  user_id: string;
  hand_id: string;
  sort_order: number;
  consumed: boolean;
  created_at: string;
}

export async function sendHandToWorkspace(handId: string): Promise<{ ok: boolean; duplicate: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, duplicate: false };

  const { error } = await supabase
    .from('sv_workspace_hand_queue')
    .insert({ user_id: user.id, hand_id: handId });

  if (error) {
    if (error.code === '23505') return { ok: true, duplicate: true };
    return { ok: false, duplicate: false };
  }
  return { ok: true, duplicate: false };
}

export async function fetchWorkspaceHandQueue(): Promise<WorkspaceHandQueueItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('sv_workspace_hand_queue')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as WorkspaceHandQueueItem[];
}

export async function markQueueItemConsumed(id: string): Promise<void> {
  await supabase
    .from('sv_workspace_hand_queue')
    .update({ consumed: true })
    .eq('id', id);
}

export async function removeFromWorkspaceQueue(id: string): Promise<void> {
  await supabase
    .from('sv_workspace_hand_queue')
    .delete()
    .eq('id', id);
}

export async function clearConsumedFromQueue(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('sv_workspace_hand_queue')
    .delete()
    .eq('user_id', user.id)
    .eq('consumed', true);
}
