import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Heart, Pin, Award, Edit3, Trash2, Reply, Send, Loader2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import {
  fetchSpotComments, postSpotComment, editSpotComment, deleteSpotComment,
  toggleSpotCommentLike, toggleCommentPin, toggleCreatorAnswer, moderatorDeleteSpotComment,
  type SpotComment,
} from '@/lib/spotDiscussionStore';
import { RoleBadge, MemberCheckmark } from '@/features/community/IdentityBadges';
import { StaffBadge, isStaff, FounderBadge, isFounderTitle } from '@/components/community/StaffIdentity';
import { ModeratorBadgeForUser } from '@/components/community/ModeratorBadgeForUser';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { SviTitleBadge } from '@/components/community/SviTitleBadge';
import { resolveDemoProfile } from '@/data/demoCommunityProfiles';
import { useUserTitles } from '@/hooks/useUserTitles';
import type { SpotVaultAccount } from '@/types';
import { isStaffOrAdmin } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.15)';

interface Props {
  spotId: string;
  spotCreatorId: string;
  currentUser: SpotVaultAccount | null;
  sessionRestored?: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SpotDiscussion({ spotId, spotCreatorId, currentUser, sessionRestored }: Props) {
  const [comments, setComments] = useState<SpotComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const currentUserId = currentUser?.id ?? null;
  const isCreator = currentUserId === spotCreatorId;
  const isModerator = currentUser ? isStaffOrAdmin(currentUser) : false;

  const loadComments = useCallback(async () => {
    const data = await fetchSpotComments(spotId, currentUserId);
    setComments(data);
    setLoading(false);
  }, [spotId, currentUserId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const topLevel = comments.filter((c) => !c.reply_to);
  const repliesByParent = new Map<string, SpotComment[]>();
  for (const c of comments) {
    if (c.reply_to) {
      const arr = repliesByParent.get(c.reply_to) || [];
      arr.push(c);
      repliesByParent.set(c.reply_to, arr);
    }
  }
  const pinnedComments = topLevel.filter((c) => c.is_pinned);
  const regularComments = topLevel.filter((c) => !c.is_pinned);

  const allAuthorIds = [...new Set(comments.map((c) => c.author_id).filter(Boolean))];
  const userTitles = useUserTitles(allAuthorIds);

  const handleSubmit = useCallback(async () => {
    if (!commentText.trim() || submitting || !currentUser) return;
    setSubmitting(true);
    const role = currentUser.homePortal || 'PLAYER';
    const c = await postSpotComment(spotId, currentUser.id, currentUser.name, null, role, commentText.trim());
    if (c) {
      setComments((prev) => [...prev, c]);
      setCommentText('');
    }
    setSubmitting(false);
  }, [commentText, submitting, spotId, currentUser]);

  const handleReply = useCallback(async (parentId: string) => {
    if (!replyText.trim() || submitting || !currentUser) return;
    setSubmitting(true);
    const role = currentUser.homePortal || 'PLAYER';
    const c = await postSpotComment(spotId, currentUser.id, currentUser.name, null, role, replyText.trim(), parentId);
    if (c) {
      setComments((prev) => [...prev, c]);
      setReplyText('');
      setReplyingTo(null);
      setExpandedThreads((prev) => new Set(prev).add(parentId));
    }
    setSubmitting(false);
  }, [replyText, submitting, spotId, currentUser]);

  const handleLike = useCallback(async (commentId: string) => {
    if (!currentUser) return;
    const result = await toggleSpotCommentLike(commentId, currentUser.id);
    if (result !== 'error') {
      setComments((prev) => prev.map((c) =>
        c.id === commentId
          ? { ...c, has_liked: result === 'liked', like_count: (c.like_count || 0) + (result === 'liked' ? 1 : -1) }
          : c
      ));
    }
  }, [currentUser]);

  const handleEdit = useCallback(async (commentId: string) => {
    if (!editText.trim()) return;
    const ok = await editSpotComment(commentId, editText.trim());
    if (ok) {
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, body: editText.trim(), edited_at: new Date().toISOString() } : c));
      setEditingId(null);
      setEditText('');
    }
  }, [editText]);

  const handleDelete = useCallback(async (commentId: string) => {
    const ok = await deleteSpotComment(commentId);
    if (ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.reply_to !== commentId));
    }
  }, []);

  const handleModDelete = useCallback(async (commentId: string) => {
    const ok = await moderatorDeleteSpotComment(commentId);
    if (ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.reply_to !== commentId));
    }
  }, []);

  const handlePin = useCallback(async (commentId: string) => {
    const result = await toggleCommentPin(commentId);
    if (result !== null) {
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, is_pinned: result } : c));
    }
  }, []);

  const handleCreatorAnswer = useCallback(async (commentId: string) => {
    const result = await toggleCreatorAnswer(commentId);
    if (result !== null) {
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, is_creator_answer: result } : c));
    }
  }, []);

  const toggleThread = (id: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-4 py-3 sm:px-5">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[11px] font-bold tracking-widest text-white/50 uppercase">
            Discussion · {topLevel.length}
          </span>
        </div>

        {/* New comment input */}
        {currentUser ? (
        <div className="mb-5">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Share your thoughts on this spot..."
            rows={2}
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-[#0a0c0e] px-3 py-2.5 text-[13px] text-white outline-none focus:border-[#c0911e]/30 placeholder:text-white/25"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!commentText.trim() || submitting}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-30"
              style={{ borderColor: 'rgba(212,165,44,0.35)', background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Post
            </button>
          </div>
        </div>
        ) : !sessionRestored ? (
        <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-white/30" />
        </div>
        ) : (
        <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
          <p className="text-[11px] text-white/35">Sign in to join the discussion.</p>
        </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : topLevel.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-7 w-7 text-white/15" strokeWidth={1.5} />
            <p className="mt-2 text-[11px] text-white/30">No discussion yet. Start the conversation.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {pinnedComments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                replies={repliesByParent.get(c.id) || []}
                isCreator={isCreator}
                isModerator={isModerator}
                currentUserId={currentUserId ?? ''}
                userTitles={userTitles}
                expandedThreads={expandedThreads}
                onToggleThread={toggleThread}
                onLike={handleLike}
                onReply={(id) => { setReplyingTo(id); setReplyText(''); }}
                onStartEdit={(id, text) => { setEditingId(id); setEditText(text); }}
                onDelete={handleDelete}
                onModDelete={handleModDelete}
                onPin={handlePin}
                onCreatorAnswer={handleCreatorAnswer}
              />
            ))}
            {regularComments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                replies={repliesByParent.get(c.id) || []}
                isCreator={isCreator}
                isModerator={isModerator}
                currentUserId={currentUserId ?? ''}
                userTitles={userTitles}
                expandedThreads={expandedThreads}
                onToggleThread={toggleThread}
                onLike={handleLike}
                onReply={(id) => { setReplyingTo(id); setReplyText(''); }}
                onStartEdit={(id, text) => { setEditingId(id); setEditText(text); }}
                onDelete={handleDelete}
                onModDelete={handleModDelete}
                onPin={handlePin}
                onCreatorAnswer={handleCreatorAnswer}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply input modal-ish */}
      {replyingTo && (
        <div className="fixed bottom-4 left-1/2 z-[90] w-full max-w-md -translate-x-1/2 rounded-xl border p-3 shadow-2xl" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.98)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Replying</span>
            <button onClick={() => setReplyingTo(null)} className="text-white/30 hover:text-white">Cancel</button>
          </div>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            autoFocus
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/30 placeholder:text-white/25"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => handleReply(replyingTo)}
              disabled={!replyText.trim() || submitting}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase disabled:opacity-30"
              style={{ borderColor: 'rgba(212,165,44,0.35)', background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Reply
            </button>
          </div>
        </div>
      )}

      {/* Edit input */}
      {editingId && (
        <div className="fixed bottom-4 left-1/2 z-[90] w-full max-w-md -translate-x-1/2 rounded-xl border p-3 shadow-2xl" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.98)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Editing</span>
            <button onClick={() => setEditingId(null)} className="text-white/30 hover:text-white">Cancel</button>
          </div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/30"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => handleEdit(editingId)}
              disabled={!editText.trim()}
              className="rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase disabled:opacity-30"
              style={{ borderColor: 'rgba(212,165,44,0.35)', background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment, replies, isCreator, isModerator, currentUserId, userTitles, expandedThreads,
  onToggleThread, onLike, onReply, onStartEdit, onDelete, onModDelete, onPin, onCreatorAnswer,
}: {
  comment: SpotComment;
  replies: SpotComment[];
  isCreator: boolean;
  isModerator: boolean;
  currentUserId: string;
  userTitles: Record<string, { title: string | null; is_verified: boolean }>;
  expandedThreads: Set<string>;
  onToggleThread: (id: string) => void;
  onLike: (id: string) => void;
  onReply: (id: string) => void;
  onStartEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onModDelete: (id: string) => void;
  onPin: (id: string) => void;
  onCreatorAnswer: (id: string) => void;
}) {
  const isOwn = comment.author_id === currentUserId;
  const isExpanded = expandedThreads.has(comment.id);
  const demoProfile = resolveDemoProfile(comment.author_id);
  const authorAccount = demoProfile ? { role: '', homePortal: demoProfile.role || 'PLAYER', name: comment.author_name } : null;
  const showStaff = authorAccount && isStaff(authorAccount as never);
  const roleLabel = comment.author_role || (demoProfile?.role) || 'PLAYER';
  const founderTitle = userTitles[comment.author_id]?.title;
  const isFounder = isFounderTitle(founderTitle);

  return (
    <div className={`rounded-lg p-3 transition-colors ${comment.is_pinned ? 'border border-[#c0911e]/20 bg-[#c0911e]/[0.04]' : 'border border-transparent hover:bg-white/[0.02]'}`}>
      {/* Pinned / Creator answer badges */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {comment.is_pinned && (
          <span className="flex items-center gap-0.5 rounded border border-[#c0911e]/30 bg-[#c0911e]/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
            <Pin className="h-2.5 w-2.5" /> Pinned
          </span>
        )}
        {comment.is_creator_answer && (
          <span className="flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase text-emerald-300">
            <Award className="h-2.5 w-2.5" /> Creator Answer
          </span>
        )}
      </div>

      {/* Author line */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[12px] font-bold" style={{ color: isFounder ? '#d4a52c' : '#ffffff' }}>{comment.author_name}</span>
        {isFounder && <FounderBadge size="xs" title={founderTitle!.toUpperCase()} />}
        {showStaff && !isFounder && <StaffBadge size="xs" />}
        <ModeratorBadgeForUser userId={comment.author_id} />
        <ConfigurableStaffBadge userId={comment.author_id} size="xs" />
        <SviTitleBadge userId={comment.author_id} size="xs" />
        {demoProfile?.isSpotVaultMember && <MemberCheckmark isMember={true} />}
        {demoProfile && <RoleBadge role={roleLabel} size="sm" />}
        <span className="text-[10px] text-white/30">{timeAgo(comment.created_at)}</span>
        {comment.edited_at && <span className="text-[9px] text-white/20">(edited)</span>}
      </div>

      {/* Body */}
      <p className="text-[13px] leading-relaxed text-white/70">{comment.body}</p>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => onLike(comment.id)}
          className="flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: comment.has_liked ? GOLD : 'rgba(255,255,255,0.35)' }}
        >
          <Heart className={`h-3.5 w-3.5 ${comment.has_liked ? 'fill-current' : ''}`} strokeWidth={1.5} />
          {comment.like_count || 0}
        </button>
        <button onClick={() => onReply(comment.id)} className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/70">
          <Reply className="h-3.5 w-3.5" strokeWidth={1.5} /> Reply
        </button>
        {isOwn && (
          <>
            <button onClick={() => onStartEdit(comment.id, comment.body)} className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/70">
              <Edit3 className="h-3 w-3" strokeWidth={1.5} /> Edit
            </button>
            <button onClick={() => onDelete(comment.id)} className="flex items-center gap-1 text-[10px] text-white/35 hover:text-red-400">
              <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Delete
            </button>
          </>
        )}
        {isModerator && !isOwn && (
          <button onClick={() => onModDelete(comment.id)} className="flex items-center gap-1 text-[10px] text-white/35 hover:text-red-400" title="Remove comment (moderator)">
            <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Remove
          </button>
        )}
        {isCreator && !isOwn && (
          <>
            <button onClick={() => onPin(comment.id)} className="flex items-center gap-1 text-[10px] text-white/35 hover:text-[#f5e6b0]">
              <Pin className="h-3 w-3" strokeWidth={1.5} /> {comment.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={() => onCreatorAnswer(comment.id)} className="flex items-center gap-1 text-[10px] text-white/35 hover:text-emerald-300">
              <Lightbulb className="h-3 w-3" strokeWidth={1.5} /> {comment.is_creator_answer ? 'Unmark' : 'Key Insight'}
            </button>
          </>
        )}
      </div>

      {/* Threaded replies */}
      {replies.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => onToggleThread(comment.id)}
            className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60"
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {isExpanded && (
            <div className="mt-2 space-y-2 border-l-2 pl-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {replies.map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  isCreator={isCreator}
                  isModerator={isModerator}
                  isOwn={reply.author_id === currentUserId}
                  userTitles={userTitles}
                  onLike={onLike}
                  onStartEdit={onStartEdit}
                  onDelete={onDelete}
                  onModDelete={onModDelete}
                  onPin={onPin}
                  onCreatorAnswer={onCreatorAnswer}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReplyItem({
  reply, isCreator, isModerator, isOwn, userTitles, onLike, onStartEdit, onDelete, onModDelete, onPin, onCreatorAnswer,
}: {
  reply: SpotComment;
  isCreator: boolean;
  isModerator: boolean;
  isOwn: boolean;
  userTitles: Record<string, { title: string | null; is_verified: boolean }>;
  onLike: (id: string) => void;
  onStartEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onModDelete: (id: string) => void;
  onPin: (id: string) => void;
  onCreatorAnswer: (id: string) => void;
}) {
  const demoProfile = resolveDemoProfile(reply.author_id);
  const authorAccount = demoProfile ? { role: '', homePortal: demoProfile.role || 'PLAYER', name: reply.author_name } : null;
  const showStaff = authorAccount && isStaff(authorAccount as never);
  const roleLabel = reply.author_role || (demoProfile?.role) || 'PLAYER';
  const founderTitle = userTitles[reply.author_id]?.title;
  const isFounder = isFounderTitle(founderTitle);

  return (
    <div className="rounded-md p-2 hover:bg-white/[0.02]">
      {reply.is_creator_answer && (
        <span className="mb-1 inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase text-emerald-300">
          <Award className="h-2.5 w-2.5" /> Key Insight
        </span>
      )}
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="text-[11px] font-bold" style={{ color: isFounder ? '#d4a52c' : '#ffffff' }}>{reply.author_name}</span>
        {isFounder && <FounderBadge size="xs" title={founderTitle!.toUpperCase()} />}
        {showStaff && !isFounder && <StaffBadge size="xs" />}
        <ModeratorBadgeForUser userId={reply.author_id} />
        <ConfigurableStaffBadge userId={reply.author_id} size="xs" />
        <SviTitleBadge userId={reply.author_id} size="xs" />
        {demoProfile?.isSpotVaultMember && <MemberCheckmark isMember={true} />}
        {demoProfile && <RoleBadge role={roleLabel} size="sm" />}
        <span className="text-[9px] text-white/30">{timeAgo(reply.created_at)}</span>
        {reply.edited_at && <span className="text-[8px] text-white/20">(edited)</span>}
      </div>
      <p className="text-[12px] leading-relaxed text-white/65">{reply.body}</p>
      <div className="mt-1.5 flex items-center gap-3">
        <button
          onClick={() => onLike(reply.id)}
          className="flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: reply.has_liked ? GOLD : 'rgba(255,255,255,0.3)' }}
        >
          <Heart className={`h-3 w-3 ${reply.has_liked ? 'fill-current' : ''}`} strokeWidth={1.5} />
          {reply.like_count || 0}
        </button>
        {isOwn && (
          <>
            <button onClick={() => onStartEdit(reply.id, reply.body)} className="text-[10px] text-white/30 hover:text-white/70">
              <Edit3 className="h-3 w-3" strokeWidth={1.5} /> Edit
            </button>
            <button onClick={() => onDelete(reply.id)} className="text-[10px] text-white/30 hover:text-red-400">
              <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Delete
            </button>
          </>
        )}
        {isModerator && !isOwn && (
          <button onClick={() => onModDelete(reply.id)} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-red-400" title="Remove reply (moderator)">
            <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Remove
          </button>
        )}
        {isCreator && !isOwn && (
          <button onClick={() => onCreatorAnswer(reply.id)} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-emerald-300">
            <Lightbulb className="h-3 w-3" strokeWidth={1.5} /> {reply.is_creator_answer ? 'Unmark' : 'Key Insight'}
          </button>
        )}
      </div>
    </div>
  );
}
