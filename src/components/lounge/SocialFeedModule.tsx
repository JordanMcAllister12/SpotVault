import { useState, useEffect, useCallback, useRef } from 'react';
import { ImagePlus, Send, MessageCircle } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { EmojiPicker } from '@/components/shared/EmojiPicker';
import { createLoungePost, fetchLoungePosts, fetchReplies, toggleReaction, fetchReactions } from '@/lib/loungeStore';
import { formatTimeAgo, type LoungePost } from '@/lib/loungeFramework';
import type { SpotVaultAccount } from '@/types';
import { DEMO_ACCOUNTS } from '@/types';
import { isStaff, StaffBadge } from '@/components/community/StaffIdentity';
import { FounderBadgeForUser, useIsFounder } from '@/components/community/FounderBadgeForUser';
import { ModeratorBadgeForUser } from '@/components/community/ModeratorBadgeForUser';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { SharedHandCard } from '@/components/player/SharedHandCard';
import type { HandShareRef } from '@/lib/handShareStore';
import { hubGlassCard, hubGlassNav } from '@/components/shared/hubGlass';

const accountForId = (userId: string): SpotVaultAccount | null => {
  return DEMO_ACCOUNTS.find((a) => a.id === userId) ?? null;
};

interface Props {
  loungeSlug: string;
  account: SpotVaultAccount | null;
  placeholder?: string;
  seedPosts?: LoungePost[];
}



export function SocialFeedModule({ loungeSlug, account, placeholder, seedPosts }: Props) {
  const [posts, setPosts] = useState<LoungePost[]>(seedPosts ?? []);
  const [draft, setDraft] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replyMap, setReplyMap] = useState<Record<string, LoungePost[]>>({});
  const [reactionMap, setReactionMap] = useState<Record<string, Record<string, number>>>({});
  const [posting, setPosting] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || seedPosts?.length) {
      loadedRef.current = true;
      return;
    }
    loadedRef.current = true;
    (async () => {
      const remote = await fetchLoungePosts(loungeSlug);
      if (remote.length) setPosts(remote);
    })();
  }, [loungeSlug, seedPosts]);

  const handlePost = useCallback(async () => {
    if (!draft.trim() || !account) return;
    setPosting(true);
    const newPost = await createLoungePost({
      authorId: account.id,
      authorName: account.name,
      authorAvatar: null,
      authorRole: account.role ?? null,
      body: draft.trim(),
      loungeSlug,
    });
    if (newPost) {
      setPosts((p) => [newPost, ...p]);
      setDraft('');
    }
    setPosting(false);
  }, [draft, account, loungeSlug]);

  const handleExpandReplies = useCallback(async (postId: string) => {
    if (expandedReplies.has(postId)) {
      setExpandedReplies((s) => { const n = new Set(s); n.delete(postId); return n; });
      return;
    }
    if (!replyMap[postId]) {
      const replies = await fetchReplies(postId);
      setReplyMap((m) => ({ ...m, [postId]: replies }));
    }
    setExpandedReplies((s) => new Set(s).add(postId));
  }, [expandedReplies, replyMap]);

  const handleReact = useCallback(async (postId: string, emoji: string) => {
    if (!account) return;
    await toggleReaction(postId, account.id, emoji);
    setReactionMap((m) => {
      const current = m[postId] ?? {};
      const updated = { ...current };
      updated[emoji] = (updated[emoji] ?? 0) + (updated[emoji] ? -1 : 1);
      if (updated[emoji] <= 0) delete updated[emoji];
      return { ...m, [postId]: updated };
    });
  }, [account]);

  return (
    <div className="flex h-full flex-col">
      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="text-sm text-white/30">No posts yet. Be the first to share!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                expanded={expandedReplies.has(post.id)}
                onToggleReplies={() => handleExpandReplies(post.id)}
                replies={replyMap[post.id] ?? []}
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer — at bottom of feed column */}
      {account && (
        <div className="shrink-0 border-t border-white/[0.04] px-2 py-1.5" style={hubGlassNav}>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder ?? "What's happening?"}
              rows={1}
              className="w-full resize-none bg-transparent px-2.5 py-1.5 text-[12px] text-white/90 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none"
              style={{ maxHeight: '4.5rem' }}
            />
            <div className="flex items-center justify-between px-1.5 pb-1">
              <div className="flex items-center gap-1">
                <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 text-[#d4a52c] transition-colors active:scale-95">
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
                <EmojiPicker onInsert={(emoji) => setDraft((d) => d + emoji)} />
              </div>
              <button
                onClick={handlePost}
                disabled={!draft.trim() || posting}
                className="flex h-7 items-center gap-1 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 px-2.5 text-[10px] font-semibold text-[#f5e6b0] transition-all active:scale-95 disabled:opacity-40"
              >
                <Send className="h-3 w-3" /> Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  expanded,
  onToggleReplies,
  replies,
}: {
  post: LoungePost;
  expanded: boolean;
  onToggleReplies: () => void;
  replies: LoungePost[];
}) {
  const isFounderPost = useIsFounder(post.author_id);
  const hasSpecialBadge = isFounderPost || isStaff(accountForId(post.author_id));
  return (
    <div className="mx-3 my-2 rounded-xl border p-3.5 transition-colors hover:border-[rgba(190,145,65,0.28)]" style={hubGlassCard}>
      <div className="flex gap-3">
        <Avatar userId={post.author_id} name={post.author_name} avatarUrl={post.author_avatar} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-semibold"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {post.author_name}
            </span>
            {isStaff(accountForId(post.author_id)) && <StaffBadge size="xs" />}
            <FounderBadgeForUser userId={post.author_id} />
            <ModeratorBadgeForUser userId={post.author_id} />
            <ConfigurableStaffBadge userId={post.author_id} size="xs" />
            {!hasSpecialBadge && <UserIdentityFlag userId={post.author_id} fallbackRole={post.author_role ?? undefined} size="sm" />}
            <span className="text-[11px] text-white/30">{formatTimeAgo(post.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">{post.body}</p>

          {post.attachment_type === 'image' && post.attachment_url && (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-white/[0.06]">
              <img
                src={post.attachment_url}
                alt=""
                className="max-h-[320px] w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {post.attachment_type === 'hh' && post.attachment_url && (
            <SharedHandCard
              attachmentUrl={post.attachment_url}
              attachmentLabel={post.attachment_label}
              onPlayHand={(ref: HandShareRef) => {
                window.dispatchEvent(new CustomEvent('sv-play-shared-hand', { detail: ref }));
              }}
            />
          )}

          {/* Reply toggle */}
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={onToggleReplies}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <MessageCircle className="h-3 w-3" />
              {replies.length > 0 && <span>{replies.length}</span>}
            </button>
          </div>

          {/* Expanded replies */}
          {expanded && (
            <div className="mt-3 space-y-2 border-l border-white/[0.06] pl-3">
              {replies.length === 0 ? (
                <p className="text-[11px] text-white/25">No replies yet</p>
              ) : (
                replies.map((r) => (
                  <div key={r.id} className="flex gap-2">
                    <Avatar userId={r.author_id} name={r.author_name} avatarUrl={r.author_avatar} size={24} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <ReplyName authorId={r.author_id} name={r.author_name} />
                        {isStaff(accountForId(r.author_id)) && <StaffBadge size="xs" />}
                        <FounderBadgeForUser userId={r.author_id} />
                        <ModeratorBadgeForUser userId={r.author_id} />
                        <ConfigurableStaffBadge userId={r.author_id} size="xs" />
                        <span className="text-[10px] text-white/25">{formatTimeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-[12px] text-white/70">{r.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyName({ authorId, name }: { authorId: string; name: string }) {
  const isFounder = useIsFounder(authorId);
  return (
    <span
      className="text-[12px] font-medium"
      style={{ color: 'rgba(255,255,255,0.8)' }}
    >
      {name}
    </span>
  );
}