import { supabase } from '@/lib/supabase';

export interface SpotComment {
  id: string;
  spot_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  body: string;
  reply_to: string | null;
  is_pinned: boolean;
  is_creator_answer: boolean;
  edited_at: string | null;
  created_at: string;
  like_count?: number;
  has_liked?: boolean;
  replies?: SpotComment[];
}

export async function fetchSpotComments(spotId: string, currentUserId: string | null): Promise<SpotComment[]> {
  const { data, error } = await supabase
    .from('spot_comments')
    .select('id, spot_id, author_id, author_name, author_avatar, author_role, body, reply_to, is_pinned, is_creator_answer, edited_at, created_at')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('fetchSpotComments error:', error);
    return [];
  }

  const commentIds = (data || []).map((c: Record<string, unknown>) => c.id as string);
  if (commentIds.length === 0) return [];

  const likeCountMap = new Map<string, number>();
  const likedSet = new Set<string>();

  if (currentUserId) {
    const { data: likes } = await supabase
      .from('spot_comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);
    for (const l of (likes || []) as Record<string, unknown>[]) {
      const cid = l.comment_id as string;
      likeCountMap.set(cid, (likeCountMap.get(cid) || 0) + 1);
      if (l.user_id === currentUserId) likedSet.add(cid);
    }
  } else {
    const { count } = await supabase
      .from('spot_comment_likes')
      .select('*', { count: 'exact', head: true });
    void count;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    spot_id: row.spot_id as string,
    author_id: row.author_id as string,
    author_name: row.author_name as string,
    author_avatar: (row.author_avatar as string | null) ?? null,
    author_role: row.author_role as string,
    body: row.body as string,
    reply_to: (row.reply_to as string | null) ?? null,
    is_pinned: row.is_pinned as boolean,
    is_creator_answer: row.is_creator_answer as boolean,
    edited_at: (row.edited_at as string | null) ?? null,
    created_at: row.created_at as string,
    like_count: likeCountMap.get(row.id as string) || 0,
    has_liked: likedSet.has(row.id as string),
  }));
}

export async function fetchSpotCommentCount(spotId: string): Promise<number> {
  const { count, error } = await supabase
    .from('spot_comments')
    .select('*', { count: 'exact', head: true })
    .eq('spot_id', spotId);
  if (error) return 0;
  return count || 0;
}

export async function postSpotComment(
  spotId: string,
  authorId: string,
  authorName: string,
  authorAvatar: string | null,
  authorRole: string,
  body: string,
  replyTo: string | null = null,
): Promise<SpotComment | null> {
  const { data, error } = await supabase
    .from('spot_comments')
    .insert({
      spot_id: spotId,
      author_id: authorId,
      author_name: authorName,
      author_avatar: authorAvatar,
      author_role: authorRole,
      body,
      reply_to: replyTo,
    })
    .select('id, spot_id, author_id, author_name, author_avatar, author_role, body, reply_to, is_pinned, is_creator_answer, edited_at, created_at')
    .maybeSingle();
  if (error) {
    console.error('postSpotComment error:', error);
    return null;
  }
  if (!data) return null;
  return {
    ...data as Record<string, unknown>,
  } as SpotComment;
}

export async function editSpotComment(commentId: string, body: string): Promise<boolean> {
  const { error } = await supabase
    .from('spot_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) {
    console.error('editSpotComment error:', error);
    return false;
  }
  return true;
}

export async function deleteSpotComment(commentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('spot_comments')
    .update({ deleted_at: new Date().toISOString(), body: '[deleted]' })
    .eq('id', commentId);
  if (error) {
    console.error('deleteSpotComment error:', error);
    return false;
  }
  return true;
}

export async function toggleSpotCommentLike(commentId: string, userId: string): Promise<'liked' | 'unliked' | 'error'> {
  const { data: existing } = await supabase
    .from('spot_comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('spot_comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    return error ? 'error' : 'unliked';
  }

  const { error } = await supabase
    .from('spot_comment_likes')
    .insert({ comment_id: commentId, user_id: userId });
  return error ? 'error' : 'liked';
}

export async function moderatorDeleteSpotComment(commentId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sv_delete_spot_comment', { p_comment_id: commentId });
  if (error) {
    console.error('moderatorDeleteSpotComment error:', error);
    return false;
  }
  return data as boolean;
}

export async function toggleCommentPin(commentId: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('sv_toggle_spot_comment_pin', { p_comment_id: commentId });
  if (error) {
    console.error('toggleCommentPin error:', error);
    return null;
  }
  return data as boolean;
}

export async function toggleCreatorAnswer(commentId: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('sv_toggle_spot_comment_creator_answer', { p_comment_id: commentId });
  if (error) {
    console.error('toggleCreatorAnswer error:', error);
    return null;
  }
  return data as boolean;
}
