import { useState, useEffect, useCallback } from 'react';
import { Bookmark, Search, X, Plus, ArrowRight } from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import {
  fetchSavedPosts, fetchSavedPostTags, addSavedPostTag, removeSavedPostTag,
  unsavePost, SUGGESTED_TAGS,
} from '@/lib/profileStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const ROLE_COLORS: Record<string, string> = {
  PLAYER: '#8db6c8', PRO: '#d4a52c', COACH: '#a78bfa', MEDIA: '#f59e0b',
  CREATOR: '#ec4899', BUSINESS: '#60a5fa', INVESTOR: '#34d399',
};

const ROLE_LABELS: Record<string, string> = {
  PLAYER: 'PLAYER', PRO: 'PRO', COACH: 'COACH', MEDIA: 'MEDIA',
  CREATOR: 'CREATOR', BUSINESS: 'BUSINESS', INVESTOR: 'INVESTOR',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

interface SavedPost {
  id: string;
  user_id: string;
  post_id: string;
  saved_at: string;
  post_data: any | null;
}

interface Props {
  account: SpotVaultAccount | null;
}

export function SavedPostsView({ account }: Props) {
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [tagsByPost, setTagsByPost] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [taggingPostId, setTaggingPostId] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState('');

  const loadAll = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    const [posts, tags] = await Promise.all([
      fetchSavedPosts(account.id),
      fetchSavedPostTags(account.id),
    ]);
    setSavedPosts(posts);
    setTagsByPost(tags);
    setLoading(false);
  }, [account]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const allTags = Array.from(new Set(Object.values(tagsByPost).flat())).sort();

  const filtered = savedPosts.filter((sp) => {
    if (!sp.post_data) return true;
    const body = sp.post_data.body ?? '';
    const author = sp.post_data.author_name ?? '';
    if (search && !`${author} ${body}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTag) {
      const tags = tagsByPost[sp.id] ?? [];
      if (!tags.includes(activeTag)) return false;
    }
    return true;
  }).sort((a, b) => {
    const cmp = new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
    return sortOrder === 'newest' ? cmp : -cmp;
  });

  const handleRemove = async (postId: string) => {
    if (!account) return;
    await unsavePost(account.id, postId);
    setSavedPosts((prev) => prev.filter((sp) => sp.post_id !== postId));
  };

  const handleAddTag = async (savedPostId: string, tag: string) => {
    if (!account || !tag.trim()) return;
    const upper = tag.toUpperCase().trim();
    await addSavedPostTag(account.id, savedPostId, upper);
    setTagsByPost((prev) => ({
      ...prev,
      [savedPostId]: [...new Set([...(prev[savedPostId] ?? []), upper])],
    }));
    setCustomTag('');
  };

  const handleRemoveTag = async (savedPostId: string, tag: string) => {
    if (!account) return;
    await removeSavedPostTag(account.id, savedPostId, tag);
    setTagsByPost((prev) => ({
      ...prev,
      [savedPostId]: (prev[savedPostId] ?? []).filter((t) => t !== tag),
    }));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}
          >
            <Bookmark className="h-4 w-4" fill={GOLD} style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[12px] font-bold tracking-wide text-white">SAVED POSTS</p>
            <p className="text-[8px] font-mono tracking-[0.25em] text-[#c0911e]/60 uppercase">
              {savedPosts.length} bookmarked
            </p>
          </div>
        </div>
      </div>

      {/* Search + sort */}
      <div className="shrink-0 border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved posts..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 py-1.5 pl-8 pr-3 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
            />
          </div>
          <button
            onClick={() => setSortOrder((s) => s === 'newest' ? 'oldest' : 'newest')}
            className="shrink-0 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-white/50 uppercase transition hover:text-white/70"
          >
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        </div>

        {/* Tag filter pills */}
        {allTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTag(null)}
              className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase transition ${
                !activeTag
                  ? 'border-[#d4a52c]/50 bg-[#c091e]/15 text-[#f5e6b0]'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase transition ${
                  activeTag === tag
                    ? 'border-[#d4a52c]/50 bg-[#c091e]/15 text-[#f5e6b0]'
                    : 'border-white/10 text-white/40 hover:text-white/60'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Posts list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-[#d4a52c]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bookmark className="h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="mt-3 text-[11px] text-white/30">No saved posts yet</p>
            <p className="text-[10px] text-white/20">Bookmark posts from the Community Feed to find them here.</p>
          </div>
        ) : (
          filtered.map((sp) => {
            const post = sp.post_data;
            const tags = tagsByPost[sp.id] ?? [];
            const roleColor = post ? (ROLE_COLORS[post.author_role] ?? '#8db6c8') : '#8db6c8';
            const roleLabel = post ? (ROLE_LABELS[post.author_role] ?? post.author_role) : '';

            return (
              <div key={sp.id} className="group mx-1 my-1.5">
                <div
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: 'rgba(212,165,44,0.12)',
                    background: 'rgba(12,10,10,0.92)',
                    boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
                  }}
                >
                  {post ? (
                    <>
                      <div className="flex gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white/80"
                          style={{ borderColor: `${roleColor}40`, background: `${roleColor}15` }}
                        >
                          {initials(post.author_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[11px] font-semibold text-white/90">
                              {post.author_name}
                            </span>
                            <span
                              className="shrink-0 rounded px-1 py-0.5 text-[7px] font-bold tracking-wide"
                              style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}
                            >
                              {roleLabel}
                            </span>
                            <span className="shrink-0 text-[9px] text-white/25">{timeAgo(post.created_at)}</span>
                          </div>
                          {post.body && (
                            <p className="mt-0.5 text-[12px] leading-relaxed text-white/80">{post.body}</p>
                          )}
                          {post.attachment_type && post.attachment_label && (
                            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5">
                              <span className="text-[10px] font-medium text-white/70">{post.attachment_label}</span>
                              <ArrowRight className="h-3 w-3 text-white/30" strokeWidth={1.5} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="group/tag flex items-center gap-0.5 rounded-full border border-[#c091e]/25 bg-[#c091e]/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-[#f5e6b0] uppercase"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(sp.id, tag)}
                              className="text-white/30 hover:text-white/60"
                            >
                              <X className="h-2.5 w-2.5" strokeWidth={2} />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => setTaggingPostId(taggingPostId === sp.id ? null : sp.id)}
                          className="flex items-center gap-0.5 rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-white/30 uppercase transition hover:text-white/50"
                        >
                          <Plus className="h-2.5 w-2.5" strokeWidth={2} /> Tag
                        </button>
                      </div>

                      {/* Tag editor */}
                      {taggingPostId === sp.id && (
                        <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/30 p-2">
                          <div className="flex flex-wrap gap-1">
                            {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                              <button
                                key={t}
                                onClick={() => handleAddTag(sp.id, t)}
                                className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-white/40 uppercase transition hover:border-[#c091e]/30 hover:text-[#f5e6b0]"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 flex gap-1">
                            <input
                              value={customTag}
                              onChange={(e) => setCustomTag(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTag(sp.id, customTag); } }}
                              placeholder="Custom tag..."
                              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40"
                            />
                            <button
                              onClick={() => handleAddTag(sp.id, customTag)}
                              disabled={!customTag.trim()}
                              className="shrink-0 rounded-lg border border-[#c091e]/30 bg-[#c091e]/15 px-2.5 py-1 text-[9px] font-bold tracking-wider text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/25 disabled:opacity-30"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-white/30">This saved post is no longer available.</span>
                      <button
                        onClick={() => handleRemove(sp.post_id)}
                        className="text-[9px] text-white/30 hover:text-white/50"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Remove bookmark */}
                  {post && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleRemove(sp.post_id)}
                        className="flex items-center gap-1 text-[9px] text-white/25 transition hover:text-white/50"
                      >
                        <Bookmark className="h-3 w-3" fill={GOLD} style={{ color: GOLD }} strokeWidth={1.5} />
                        Remove bookmark
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
