import { supabase } from '@/lib/supabase';

export interface Connection {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  connected_at: string;
}

export interface PendingRequest {
  requester_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type ConnectionRequestResult = 'sent' | 'already_pending' | 'already_connected' | 'self' | 'error';

export async function sendConnectionRequest(targetUserId: string): Promise<ConnectionRequestResult> {
  const { data, error } = await supabase.rpc('sv_send_connection_request', {
    p_target_id: targetUserId,
  });
  if (error) {
    console.error('sendConnectionRequest error:', error);
    return 'error';
  }
  return data as ConnectionRequestResult;
}

export async function acceptConnectionRequest(requesterId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_accept_connection_request', {
    p_requester_id: requesterId,
  });
  if (error) {
    console.error('acceptConnectionRequest error:', error);
    return false;
  }
  return true;
}

export async function declineConnectionRequest(requesterId: string): Promise<boolean> {
  const { error } = await supabase.rpc('sv_decline_connection_request', {
    p_requester_id: requesterId,
  });
  if (error) {
    console.error('declineConnectionRequest error:', error);
    return false;
  }
  return true;
}

export async function listConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.rpc('sv_list_connections');
  if (error || !data) return [];
  return data as Connection[];
}

export async function listPendingRequests(): Promise<PendingRequest[]> {
  const { data, error } = await supabase.rpc('sv_list_pending_connection_requests');
  if (error || !data) return [];
  return data as PendingRequest[];
}

export async function areConnected(otherUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_are_connected', {
    p_other_user_id: otherUserId,
  });
  if (error) return false;
  return data as boolean;
}

export async function removeConnection(otherUserId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_connections')
    .delete()
    .or(`requester_id.eq.${otherUserId},target_id.eq.${otherUserId}`)
    .or(`requester_id.eq.${(await supabase.auth.getUser()).data.user?.id},target_id.eq.${otherUserId}`);
  return !error;
}
