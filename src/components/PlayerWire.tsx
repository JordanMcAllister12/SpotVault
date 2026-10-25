import { useState } from 'react';
import { Lock, Heart, MessageSquare, Bookmark, Share2, X, Globe, Send } from 'lucide-react';
import { GlassPanel, PrivacyBadge } from '@/components/PortalShell';
import { PLAYER_WIRE_SEED, type WirePost } from '@/types';

interface PlayerWireProps {
  accent: string;
}

export function PlayerWire({ accent }: PlayerWireProps) {
  const [posts, setPosts] = useState<WirePost[]>(PLAYER_WIRE_SEED);
  const [composer, setComposer] = useState('');
  const [shareTarget, setShareTarget] = useState<WirePost | null>(null);

  const toggleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const toggleSave = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, saved: !p.saved, saves: p.saved ? p.saves - 1 : p.saves + 1 }
          : p
      )
    );
  };

  const publishToCommunity = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, publishedToCommunity: true } : p))
    );
    setShareTarget(null);
  };

  const submitPost = () => {
    if (!composer.trim()) return;
    const newPost: WirePost = {
      id: `pw-${Date.now()}`,
      author: 'Randy Kasper',
      handle: '@rkasper',
      portal: 'PLAYER',
      body: composer.trim(),
      timestamp: 'just now',
      likes: 0,
      comments: 0,
      saves: 0,
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposer('');
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4 lg:p-5">
      {/* Privacy header */}
      <div className="mb-1 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-[0.15em] text-white uppercase">Player Wire</h2>
            <span
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
              style={{ borderColor: accent + '40', background: accent + '10' }}
            >
              <Lock className="h-3 w-3" strokeWidth={1.5} style={{ color: accent }} />
              <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: accent }}>
                Players Only
              </span>
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            Private player-only feed. Not visible to Media, Business, Investor, Community Hub, or the public.
          </p>
        </div>
      </div>

      {/* Composer */}
      <GlassPanel className="p-4">
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder="Post to the Player Wire..."
          className="w-full resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none"
          rows={2}
        />
        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-emerald-400/60" strokeWidth={1.5} />
            <span className="text-[10px] font-mono tracking-widest text-emerald-400/50 uppercase">Player Wire — Private</span>
          </div>
          <button
            onClick={submitPost}
            disabled={!composer.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/70 uppercase transition-all hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="h-3 w-3" strokeWidth={1.5} />
            Post
          </button>
        </div>
      </GlassPanel>

      {/* Feed */}
      <div className="flex flex-col gap-2.5">
        {posts.map((post) => (
          <GlassPanel key={post.id} className="p-4">
            {/* Author */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white/70">
                {post.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{post.author}</span>
                  <span className="text-[10px] text-white/30">{post.handle}</span>
                </div>
                <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: accent + '80' }}>
                  {post.portal} Portal · {post.timestamp}
                </span>
              </div>
              {post.publishedToCommunity && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-emerald-300 uppercase">
                  <Globe className="h-2.5 w-2.5" strokeWidth={2} />
                  Published
                </span>
              )}
            </div>

            {/* Body */}
            <p className="mt-2.5 text-sm leading-relaxed text-white/80">{post.body}</p>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-2.5">
              <button
                onClick={() => toggleLike(post.id)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5"
                style={{ color: post.liked ? accent : 'rgba(255,255,255,0.4)' }}
              >
                <Heart className="h-3.5 w-3.5" strokeWidth={1.5} fill={post.liked ? accent : 'none'} />
                {post.likes}
              </button>
              <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                {post.comments}
              </button>
              <button
                onClick={() => toggleSave(post.id)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5"
                style={{ color: post.saved ? accent : 'rgba(255,255,255,0.4)' }}
              >
                <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} fill={post.saved ? accent : 'none'} />
                {post.saves}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setShareTarget(post)}
                  disabled={post.publishedToCommunity}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/60 transition-all hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Share2 className="h-3 w-3" strokeWidth={1.5} />
                  {post.publishedToCommunity ? 'Shared' : 'Share to Community'}
                </button>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Share to Community Hub confirmation modal */}
      {shareTarget && (
        <ShareConfirmModal
          post={shareTarget}
          accent={accent}
          onCancel={() => setShareTarget(null)}
          onConfirm={() => publishToCommunity(shareTarget.id)}
        />
      )}
    </div>
  );
}

function ShareConfirmModal({
  post,
  accent,
  onCancel,
  onConfirm,
}: {
  post: WirePost;
  accent: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl border border-white/10 bg-[#0a0c0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: accent }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold tracking-wide text-white">Share to Community Hub</h3>
          </div>
          <button onClick={onCancel} className="text-white/30 transition-colors hover:text-white">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-white/60">
          This post will become visible to the wider SpotVault network. It will appear in the Community Hub and become accessible to all members.
        </p>

        <div className="mt-4 rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="text-[10px] font-mono tracking-widest text-white/30 uppercase">{post.author}</div>
          <p className="mt-1 text-xs text-white/70">{post.body}</p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:border-white/20 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg border py-2.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
            style={{
              borderColor: accent + '60',
              background: accent + '15',
              color: accent,
            }}
          >
            Publish Publicly
          </button>
        </div>
      </div>
    </div>
  );
}
