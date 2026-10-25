import { supabase } from '@/lib/supabase';

export interface ChatBoost {
  id: string;
  message_id: string | null;
  lounge_message_id: string | null;
  user_id: string;
  created_at: string;
}

/** Fetch all boosts for a set of network_chat message IDs. */
export async function fetchBoostsForMessages(messageIds: string[]): Promise<ChatBoost[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from('network_chat_boosts')
    .select('id, message_id, lounge_message_id, user_id, created_at')
    .in('message_id', messageIds);
  if (error) return [];
  return (data ?? []) as ChatBoost[];
}

/** Fetch all boosts (for loading the full feed at once). */
export async function fetchAllBoosts(): Promise<ChatBoost[]> {
  const { data, error } = await supabase
    .from('network_chat_boosts')
    .select('id, message_id, lounge_message_id, user_id, created_at');
  if (error) return [];
  return (data ?? []) as ChatBoost[];
}

/** Toggle a boost on a network_chat_messages post. Returns true if now boosted. */
export async function toggleMessageBoost(messageId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('network_chat_boosts')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('network_chat_boosts').delete().eq('id', existing.id);
    return false;
  }
  await supabase.from('network_chat_boosts').insert({
    message_id: messageId,
    user_id: userId,
  });
  return true;
}

/** Toggle a boost on a poker_lounge_messages post. Returns true if now boosted. */
export async function toggleLoungeBoost(loungeMessageId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('network_chat_boosts')
    .select('id')
    .eq('lounge_message_id', loungeMessageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('network_chat_boosts').delete().eq('id', existing.id);
    return false;
  }
  await supabase.from('network_chat_boosts').insert({
    lounge_message_id: loungeMessageId,
    user_id: userId,
  });
  return true;
}
