import { useState, useRef, useEffect } from 'react';
import { Image, Video, Send, MessageSquare, Share2, ChevronDown, ThumbsUp, Flame, Diamond, Target, Bookmark, Zap, Heart } from 'lucide-react';
import type { ManitobaPost, ManitobaComment } from '@/data/manitobaDemoData';
import { MANITOBA_POSTS } from '@/data/manitobaDemoData';
import type { SpotVaultAccount } from '@/types';
import { DEMO_ACCOUNTS } from '@/types';
import { Avatar } from '@/components/shared/Avatar';
import { isStaff, StaffBadge } from '@/components/community/StaffIdentity';
import { FounderBadgeForUser, useIsFounder } from '@/components/community/FounderBadgeForUser';
import { ModeratorBadgeForUser } from '@/components/community/ModeratorBadgeForUser';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { hubGlassCard } from '@/components/shared/hubGlass';

const accountForId = (userId: string): SpotVaultAccount | null => {
  return DEMO_ACCOUNTS.find((a) => a.id === userId) ?? null;
};

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  account: SpotVaultAccount | null;
}

const REACTIONS = [
  { emoji: '👍', icon: ThumbsUp, color: '#60a5fa' },
  { emoji: '🔥', icon: Flame, color: '#f59e0b' },
  { emoji: '💎', icon: Diamond, color: '#ec4899' },
  { emoji: '🎯', icon: Target, color: '#a78bfa' },
];

export function ManitobaCommunityFeed({ account }: Props) {
  const [posts, setPosts] = useState<ManitobaPost[]>(MANITOBA_POSTS);
  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePost = () => {
    if (!input.trim() || !account) return;
    const newPost: ManitobaPost = {
      id: `post-${Date.now()}`,
      authorName: account.name,
      authorAvatar: null,
      authorRole: 'PLAYER',
      timestamp: 'just now',
      text: input.trim(),
      image_url: null,
      video_url: null,
      reactions: [],
      commentCount: 0,
    };
    setPosts((prev) => [newPost, ...prev]);
    setInput('');
    setShowAttach(false);
  };

  const toggleComments = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleReaction = (postId: string, emoji: string) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const existing = p.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        return { ...p, reactions: p.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) };
      }
      return { ...p, reactions: [...p.reactions, { emoji, count: 1 }] };
    }));
    setShowReactions(null);
  };

  const toggleLike = (postId: string) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const liked = p.likedByMe ?? false;
      return { ...p, likedByMe: !liked, likeCount: (p.likeCount ?? 0) + (liked ? -1 : 1) };
    }));
  };

  const toggleBoost = (postId: string) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const boosted = p.boostedByMe ?? false;
      return { ...p, boostedByMe: !boosted, boostCount: (p.boostCount ?? 0) + (boosted ? -1 : 1) };
    }));
  };

  const submitComment = (postId: string, text: string) => {
    if (!text.trim() || !account) return;
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const newComment: ManitobaComment = {
        id: `cmt-${Date.now()}`,
        authorName: account.name,
        authorAvatar: null,
        text: text.trim(),
        timestamp: 'just now',
      };
      return {
        ...p,
        comments: [...(p.comments ?? []), newComment],
        commentCount: p.commentCount + 1,
      };
    }));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Create Post composer */}
      <div className="shrink-0 border-b border-white/[0.06] p-3">
        <div className="flex items-start gap-3">
          <Avatar name={account?.name ?? 'You'} size={36} />
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What's happening in Manitoba poker?"
              rows={2}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-[12px] text-white placeholder:text-white/25 focus:border-[#c0911e]/35 focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAttach(!showAttach)}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-medium text-white/40 transition hover:text-white/70"
                >
                  <Image className="h-3.5 w-3.5" strokeWidth={1.5} /> Photo
                </button>
                <button className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-medium text-white/40 transition hover:text-white/70">
                  <Video className="h-3.5 w-3.5" strokeWidth={1.5} /> Video
                </button>
              </div>
              <button
                onClick={handlePost}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-30"
                style={{ borderColor: GOLD, background: GOLD, color: '#080706' }}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} /> Post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            account={account}
            expanded={expandedComments.has(post.id)}
            onToggleComments={() => toggleComments(post.id)}
            showReactions={showReactions === post.id}
            onToggleReactions={() => setShowReactions(showReactions === post.id ? null : post.id)}
            onReact={(emoji) => toggleReaction(post.id, emoji)}
            onLike={() => toggleLike(post.id)}
            onBoost={() => toggleBoost(post.id)}
            onSubmitComment={(text) => submitComment(post.id, text)}
          />
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}

function PostCard({ post, account, expanded, onToggleComments, showReactions, onToggleReactions, onReact, onLike, onBoost, onSubmitComment }: {
  post: ManitobaPost;
  account: SpotVaultAccount | null;
  expanded: boolean;
  onToggleComments: () => void;
  showReactions: boolean;
  onToggleReactions: () => void;
  onReact: (emoji: string) => void;
  onLike: () => void;
  onBoost: () => void;
  onSubmitComment: (text: string) => void;
}) {
  const [commentDraft, setCommentDraft] = useState('');
  const liked = post.likedByMe ?? false;
  const boosted = post.boostedByMe ?? false;
  const likeCount = post.likeCount ?? 0;
  const boostCount = post.boostCount ?? 0;
  const isFounderPost = useIsFounder(post.authorUserId ?? '');

  return (
    <div className="mb-2 rounded-xl border p-2.5 transition-colors hover:border-[rgba(190,145,65,0.28)]" style={hubGlassCard}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <Avatar userId={post.authorUserId} name={post.authorName} avatarUrl={post.authorAvatar} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[12px] font-bold"
              style={{ color: (isStaff(accountForId(post.authorUserId ?? '')) || isFounderPost) ? '#d4a52c' : '#ffffff' }}
            >
              {post.authorName}
            </span>
            {isStaff(accountForId(post.authorUserId ?? '')) && <StaffBadge size="xs" />}
            <FounderBadgeForUser userId={post.authorUserId ?? ''} />
            <ModeratorBadgeForUser userId={post.authorUserId ?? ''} />
            <ConfigurableStaffBadge userId={post.authorUserId ?? ''} size="xs" />
            <UserIdentityFlag userId={post.authorUserId ?? ''} fallbackRole={post.authorRole} size="sm" />
          </div>
          <span className="text-[10px] text-white/30">{post.timestamp} ago</span>
        </div>
      </div>

      {/* Text */}
      <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-snug text-white/80">{post.text}</p>

      {/* Image */}
      {post.image_url && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-white/[0.06]">
          <img src={post.image_url} alt="" className="max-h-[220px] w-full object-cover" />
        </div>
      )}

      {/* Engagement bar: Like / Comment / Boost */}
      <div className="mt-2 flex items-center gap-4 border-t border-white/[0.04] pt-1.5">
        <button
          onClick={onLike}
          className="flex items-center gap-1 text-[10px] font-medium transition-colors"
          style={{ color: liked ? GOLD : 'rgba(255,255,255,0.4)' }}
        >
          <Heart className="h-3.5 w-3.5" strokeWidth={1.5} style={{ fill: liked ? GOLD : 'transparent' }} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          onClick={onToggleComments}
          className="flex items-center gap-1 text-[10px] font-medium text-white/40 transition hover:text-white/70"
        >
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </button>

        <button
          onClick={onBoost}
          className="flex items-center gap-1 text-[10px] font-medium transition-colors"
          style={{ color: boosted ? GOLD : 'rgba(255,255,255,0.4)' }}
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={1.5} style={{ fill: boosted ? GOLD : 'transparent' }} />
          {boostCount > 0 && <span>{boostCount}</span>}
        </button>

        <div className="relative ml-auto">
          <button onClick={onToggleReactions} className="flex items-center gap-1 text-[10px] text-white/40 transition hover:text-white/70">
            <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          {showReactions && (
            <div className="absolute bottom-7 right-0 z-10 flex gap-1 rounded-xl border p-1.5" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
              {REACTIONS.map((r) => (
                <button key={r.emoji} onClick={() => onReact(r.emoji)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px] transition hover:scale-125" title={r.emoji}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reaction counts */}
      {post.reactions.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          {post.reactions.map((r) => (
            <span key={r.emoji} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-[10px]">{r.emoji}</span>
              <span className="text-white/50">{r.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Comments */}
      {expanded && (
        <div className="mt-2.5 space-y-2 border-t border-white/[0.04] pt-2.5">
          {post.comments && post.comments.length > 0 && post.comments.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Avatar name={account?.name ?? 'You'} size={24} />
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && commentDraft.trim()) {
                  onSubmitComment(commentDraft);
                  setCommentDraft('');
                }
              }}
            />
          </div>
        </div>
      )}

      {post.commentCount > 0 && !expanded && (
        <button onClick={onToggleComments} className="mt-1.5 flex items-center gap-1 text-[10px] text-white/30 transition hover:text-white/50">
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} /> {post.commentCount} comments
        </button>
      )}
    </div>
  );
}

function CommentRow({ comment }: { comment: ManitobaComment }) {
  return (
    <div className="flex items-start gap-2">
      <Avatar name={comment.authorName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <span className="text-[11px] font-bold text-white">{comment.authorName}</span>
          <p className="text-[11px] text-white/70">{comment.text}</p>
        </div>
        <span className="ml-3 text-[9px] text-white/25">{comment.timestamp} ago</span>
      </div>
    </div>
  );
}
