import { supabase } from '@/lib/supabase';

export interface HandShareRef {
  hand_id: string;
  hand_user_id: string;
  hero_name: string | null;
  hero_cards: string | null;
  board: string | null;
  blinds: string | null;
  pot_amount: number | null;
  net_result: number | null;
  tournament_id: string | null;
  site: string | null;
}

export function encodeHandRef(ref: HandShareRef): string {
  return JSON.stringify(ref);
}

export function decodeHandRef(url: string): HandShareRef | null {
  try {
    const parsed = JSON.parse(url) as HandShareRef;
    if (!parsed.hand_id || !parsed.hand_user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchHandShareRef(handId: string, handUserId: string): Promise<HandShareRef | null> {
  const { data, error } = await supabase
    .from('poker_hand_records')
    .select('hand_id, user_id, hero_name, hero_cards, board, blinds, pot_amount, net_result, tournament_id, site')
    .eq('hand_id', handId)
    .eq('user_id', handUserId)
    .maybeSingle();
  if (error || !data) {
    console.error('fetchHandShareRef error:', error?.message ?? 'not found');
    return null;
  }
  return {
    hand_id: data.hand_id,
    hand_user_id: data.user_id,
    hero_name: data.hero_name,
    hero_cards: data.hero_cards,
    board: data.board,
    blinds: data.blinds,
    pot_amount: data.pot_amount != null ? Number(data.pot_amount) : null,
    net_result: data.net_result != null ? Number(data.net_result) : null,
    tournament_id: data.tournament_id,
    site: data.site,
  };
}

export type ShareDestination = 'community' | 'lounge' | 'group-chat' | 'dm';

export async function shareHandToCommunity(
  authorId: string,
  authorName: string,
  authorRole: string,
  handRef: HandShareRef,
  comment: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('network_chat_messages')
    .insert({
      author_id: authorId,
      author_name: authorName,
      author_role: authorRole,
      body: comment || null,
      is_sponsored: false,
      attachment_type: 'hh',
      attachment_url: encodeHandRef(handRef),
      attachment_label: `Hand: ${handRef.hero_cards ?? '?'}`,
    });
  if (error) {
    console.error('shareHandToCommunity error:', error.message);
    return false;
  }
  return true;
}

export async function shareHandToLounge(
  authorId: string,
  authorName: string,
  authorRole: string,
  handRef: HandShareRef,
  comment: string,
  loungeSlug: string,
): Promise<boolean> {
  const { createLoungePost } = await import('@/lib/loungeStore');
  const post = await createLoungePost({
    authorId,
    authorName,
    authorAvatar: null,
    authorRole,
    body: comment || 'Shared a hand',
    loungeSlug,
    attachmentType: 'hh',
    attachmentUrl: encodeHandRef(handRef),
    attachmentLabel: `Hand: ${handRef.hero_cards ?? '?'}`,
  });
  return !!post;
}

export async function shareHandToGroupChat(
  authorId: string,
  authorName: string,
  authorRole: string,
  handRef: HandShareRef,
  comment: string,
): Promise<boolean> {
  // Group chat uses network_chat_messages (the same persisted table as Community feed)
  // with attachment_type: 'hh'. NetworkChat renders SharedHandCard for these.
  return shareHandToCommunity(authorId, authorName, authorRole, handRef, comment);
}

export async function shareHandToDM(
  senderId: string,
  senderName: string,
  recipientId: string,
  handRef: HandShareRef,
  comment: string,
): Promise<boolean> {
  const { data: conv, error: convError } = await supabase
    .from('user_inbox_conversations')
    .select('id')
    .or(`and(participant_a_id.eq.${senderId},participant_b_id.eq.${recipientId}),and(participant_a_id.eq.${recipientId},participant_b_id.eq.${senderId})`)
    .maybeSingle();

  let conversationId: string;

  if (convError || !conv) {
    const { data: newConv, error: createErr } = await supabase
      .from('user_inbox_conversations')
      .insert({
        participant_a_id: senderId,
        participant_b_id: recipientId,
        last_message_preview: comment || 'Shared a hand',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (createErr || !newConv) {
      console.error('shareHandToDM conv create error:', createErr?.message);
      return false;
    }
    conversationId = newConv.id;
  } else {
    conversationId = (conv as { id: string }).id;
  }

  const { error: msgError } = await supabase
    .from('user_inbox_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: comment || 'Shared a hand',
      attachment_type: 'hh',
      attachment_url: encodeHandRef(handRef),
      attachment_label: `Hand: ${handRef.hero_cards ?? '?'}`,
    });
  if (msgError) {
    console.error('shareHandToDM message error:', msgError.message);
    return false;
  }
  return true;
}
