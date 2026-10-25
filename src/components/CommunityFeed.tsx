import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Send, ImagePlus, ArrowRight, BadgeCheck, ChevronDown, MessageSquare, Bookmark, X, Rocket, MoreHorizontal, Search, Zap, Gift, Trash2,
  type LucideIcon,
} from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';
import type { SpotVaultAccount } from '@/types';
import { EmojiPicker } from '@/components/shared/EmojiPicker';
import { getMyFollowing } from '@/lib/followEngine';
import { DEMO_ACCOUNTS } from '@/types';
import { MemberCheckmark, HoverProfileCard, useHoverCard } from '@/features/community/IdentityBadges';
import { dispatchOpenProfile } from '@/lib/profileEvents';
import { dispatchOpenGiftModal } from '@/lib/giftEvents';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { StaffBadge, isStaff, isModerator } from '@/components/community/StaffIdentity';
import { FounderBadgeForUser, useIsFounder } from '@/components/community/FounderBadgeForUser';
import { ModeratorBadgeForUser } from '@/components/community/ModeratorBadgeForUser';
import { ConfigurableStaffBadge } from '@/components/community/ConfigurableStaffBadge';
import { SviTitleBadge } from '@/components/community/SviTitleBadge';
import { ProfileBottomSheet } from '@/components/mobile/ProfileBottomSheet';
import { getDemoProfileByName, type DemoProfile } from '@/data/mobileDemoData';
import { canPostSocialFeed } from '@/lib/authEngine';
import { fetchSavedPostIds, savePost, unsavePost } from '@/lib/profileStore';
import { fetchAllBoosts, toggleMessageBoost, type ChatBoost } from '@/lib/boostStore';
import { Avatar } from '@/components/shared/Avatar';
import { SharedHandCard } from '@/components/player/SharedHandCard';
import type { HandShareRef } from '@/lib/handShareStore';
import { supabase } from '@/lib/supabase';
import { hubGlassCard } from '@/components/shared/hubGlass';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const ROLE_LABELS: Record<string, string> = {
  PLAYER: 'PLAYER', PRO: 'PRO', COACH: 'COACH', MEDIA: 'MEDIA',
  CREATOR: 'CREATOR', BUSINESS: 'BUSINESS', INVESTOR: 'INVESTOR',
};

interface ChatMessage {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  body: string | null;
  is_sponsored: boolean;
  sponsor_name: string | null;
  sponsor_title: string | null;
  sponsor_cta_label: string | null;
  sponsor_cta_url: string | null;
  attachment_type: string | null;
  attachment_url: string | null;
  attachment_label: string | null;
  reply_to: string | null;
  created_at: string;
}

interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Props {
  account: SpotVaultAccount | null;
}

function getRoleLabel(account: SpotVaultAccount): string {
  const portalToRole: Record<string, string> = {
    PLAYER: 'PLAYER', PRO: 'PRO', COACH: 'COACH', MEDIA: 'MEDIA',
    CREATOR: 'CREATOR', BUSINESS: 'BUSINESS', INVESTOR: 'INVESTOR',
    STABLE: 'BUSINESS', JOBS: 'BUSINESS', PARTNERSHIPS: 'BUSINESS',
    MARKETPLACE: 'PLAYER', EXPO: 'BUSINESS', TOURNAMENTS: 'PLAYER',
  };
  return portalToRole[account.homePortal] ?? 'PLAYER';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const accountForId = (userId: string): SpotVaultAccount | null => {
  return DEMO_ACCOUNTS.find(a => a.id === userId) ?? null;
};

export function CommunityFeed({ account }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ChatReaction[]>([]);
  const [boosts, setBoosts] = useState<ChatBoost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<{ url: string; name: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [postingStatusChecked, setPostingStatusChecked] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [feedFilter, setFeedFilter] = useState<'for-you' | 'following'>('for-you');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const lastSeenTimestampRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const hasInitiallyScrolledRef = useRef(false);

  const loadMessages = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('network_chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const sorted = (data ?? []) as ChatMessage[];
    messageIdsRef.current = new Set(sorted.map((m) => m.id));
    if (sorted.length > 0) {
      lastSeenTimestampRef.current = sorted[sorted.length - 1].created_at;
    }
    setMessages(sorted);
    setLoading(false);
  }, []);

  const loadReactions = useCallback(async () => {
    const { data } = await supabase
      .from('network_chat_reactions')
      .select('*');
    if (data) setReactions(data as ChatReaction[]);
  }, []);

  const loadBoosts = useCallback(async () => {
    const data = await fetchAllBoosts();
    setBoosts(data);
  }, []);

  useEffect(() => {
    loadMessages();
    loadReactions();
    loadBoosts();
  }, [loadMessages, loadReactions, loadBoosts]);

  useEffect(() => {
    if (!account) return;
    fetchSavedPostIds(account.id).then(setSavedPostIds);
  }, [account]);

  useEffect(() => {
    getMyFollowing().then(ids => setFollowingIds(new Set(ids)));
  }, []);

  const toggleSave = useCallback(async (postId: string) => {
    if (!account) return;
    if (savedPostIds.has(postId)) {
      await unsavePost(account.id, postId);
      setSavedPostIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    } else {
      await savePost(account.id, postId);
      setSavedPostIds((prev) => new Set(prev).add(postId));
    }
  }, [account, savedPostIds]);

  useEffect(() => {
    (async () => {
      const permitted = await canPostSocialFeed(account?.id);
      setCanPost(permitted);
      setPostingStatusChecked(true);
    })();
  }, [account?.id]);

  const backfillMissed = useCallback(async () => {
    const since = lastSeenTimestampRef.current;
    if (!since) return;
    const { data } = await supabase
      .from('network_chat_messages')
      .select('*')
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50);
    if (!data || data.length === 0) return;
    const newOnes = (data as ChatMessage[]).filter((m) => !messageIdsRef.current.has(m.id));
    if (newOnes.length === 0) return;
    newOnes.forEach((m) => messageIdsRef.current.add(m.id));
    lastSeenTimestampRef.current = newOnes[newOnes.length - 1].created_at;
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const deduped = newOnes.filter((m) => !existingIds.has(m.id));
      return [...prev, ...deduped];
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('community-feed')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'network_chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (messageIdsRef.current.has(newMsg.id)) return;
          messageIdsRef.current.add(newMsg.id);
          lastSeenTimestampRef.current = newMsg.created_at;
          setMessages((prev) => [...prev, newMsg]);
        },
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'network_chat_reactions' },
        () => { loadReactions(); },
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'network_chat_reactions' },
        () => { loadReactions(); },
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'network_chat_boosts' },
        () => { loadBoosts(); },
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'network_chat_boosts' },
        () => { loadBoosts(); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          backfillMissed();
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [loadReactions, loadBoosts, backfillMissed]);

  useEffect(() => {
    if (!hasInitiallyScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      hasInitiallyScrolledRef.current = true;
    }
  }, [messages]);

  useEffect(() => {
    if (!hasInitiallyScrolledRef.current || !scrollRef.current) return;
    if (isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom < 100;
  }, []);

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPendingImage({ url, name: file.name });
  }, []);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 72) + 'px';
  };
  useEffect(() => {
    if (!input && inputRef.current) inputRef.current.style.height = 'auto';
  }, [input]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !account) return;
    const body = input.trim();

    const role = getRoleLabel(account);
    const attachment = pendingImage
      ? { attachment_type: 'image', attachment_url: pendingImage.url, attachment_label: pendingImage.name }
      : { attachment_type: null, attachment_url: null, attachment_label: null };
    const { error: err } = await supabase
      .from('network_chat_messages')
      .insert({
        author_id: account.id,
        author_name: account.name,
        author_role: role,
        body,
        is_sponsored: false,
        reply_to: replyTarget?.id ?? null,
        ...attachment,
      });
    if (err) {
      console.error('[CommunityFeed] message send error:', err);
      setError("Message couldn't be sent. Please try again.");
      return;
    }
    setError(null);
    setInput('');
    setReplyTarget(null);
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.url);
      setPendingImage(null);
    }
    await loadMessages();
  }, [input, account, replyTarget, pendingImage, loadMessages]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!account) return;
    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === account.id && r.emoji === emoji,
    );
    if (existing) {
      await supabase.from('network_chat_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('network_chat_reactions').insert({
        message_id: messageId,
        user_id: account.id,
        emoji,
      });
    }
  }, [account, reactions]);

  const handleBoost = useCallback(async (messageId: string) => {
    if (!account) return;
    await toggleMessageBoost(messageId, account.id);
  }, [account]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase.from('network_chat_messages').delete().eq('id', messageId);
    if (error) {
      console.error('Delete message error:', error);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId && m.reply_to !== messageId));
  }, []);

  const toggleThread = useCallback((msgId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const toggleComments = useCallback((msgId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const allTopLevel = messages.filter((m) => !m.is_sponsored && !m.reply_to);

  const searchFiltered = searchQuery.trim()
    ? allTopLevel.filter(m => {
        const q = searchQuery.toLowerCase();
        return m.body?.toLowerCase().includes(q) || m.author_name?.toLowerCase().includes(q);
      })
    : allTopLevel;

  const topLevelMessages = (() => {
    if (feedFilter === 'following') {
      return searchFiltered.filter(m => followingIds.has(m.author_id));
    }
    return [...searchFiltered].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  })();

  const repliesByParent = messages.reduce<Record<string, ChatMessage[]>>((acc, m) => {
    if (m.reply_to) {
      if (!acc[m.reply_to]) acc[m.reply_to] = [];
      acc[m.reply_to].push(m);
    }
    return acc;
  }, {});

  const { hoverUserId, hoverAccount, anchorRect, openCard, closeCard } = useHoverCard();
  const [sheetProfile, setSheetProfile] = useState<DemoProfile | null>(null);

  const handleAuthorClick = (e: React.MouseEvent, msg: ChatMessage) => {
    e.stopPropagation();
    dispatchOpenProfile(msg.author_id);
  };

  const [commentError, setCommentError] = useState<string | null>(null);
  const submitComment = useCallback(async (postId: string, text: string): Promise<boolean> => {
    if (!text.trim() || !account) return false;
    const role = getRoleLabel(account);
    const { error: err } = await supabase.from('network_chat_messages').insert({
      author_id: account.id,
      author_name: account.name,
      author_role: role,
      body: text.trim(),
      is_sponsored: false,
      reply_to: postId,
    });
    if (err) {
      console.error('[CommunityFeed] comment send error:', err);
      setCommentError('Comment couldn\'t be sent. Please try again.');
      setTimeout(() => setCommentError(null), 4000);
      return false;
    }
    setCommentError(null);
    await loadMessages();
    return true;
  }, [account, loadMessages]);

  return (
    <div className="flex h-full flex-col">
      {sheetProfile && (
        <ProfileBottomSheet profile={sheetProfile} onClose={() => setSheetProfile(null)} />
      )}
      {hoverUserId && (
        <HoverProfileCard
          userId={hoverUserId}
          account={hoverAccount}
          onClose={closeCard}
          anchorRect={anchorRect}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.04] px-2 py-1">
          <button onClick={() => setSearchOpen(v => !v)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-white/70">
            <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          {searchOpen && (
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts..."
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 placeholder:text-white/30 focus:border-[#c0911e]/30 focus:outline-none"
            />
          )}
          {!searchOpen && (
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
              {(['for-you', 'following'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFeedFilter(tab)}
                  className="rounded-md px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-all"
                  style={feedFilter === tab
                    ? { background: 'rgba(212,165,44,0.18)', color: GOLD_SOFT, boxShadow: '0 0 8px -2px rgba(212,165,44,0.3)' }
                    : { color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  {tab === 'for-you' ? 'For You' : 'Following'}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-white/70"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-white/10 bg-[#0d1115] p-1 shadow-2xl">
                  <button onClick={() => { setFeedFilter('for-you'); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5">
                    <MessageSquare className="h-3 w-3" /> For You feed
                  </button>
                  <button onClick={() => { setFeedFilter('following'); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5">
                    <BadgeCheck className="h-3 w-3" /> Following only
                  </button>
                  <button onClick={() => { setSearchOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5">
                    <Search className="h-3 w-3" /> Search posts
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {searchOpen && (
          <div className="shrink-0 border-b border-white/[0.04] px-2 py-1">
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
              {(['for-you', 'following'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFeedFilter(tab)}
                  className="rounded-md px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-all"
                  style={feedFilter === tab ? { background: 'rgba(212,165,44,0.18)', color: GOLD_SOFT } : { color: 'rgba(255,255,255,0.45)' }}
                >
                  {tab === 'for-you' ? 'For You' : 'Following'}
                </button>
              ))}
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="ml-auto text-[9px] text-white/30 hover:text-white/60">clear</button>
            </div>
          </div>
        )}

        <>
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[11px] text-white/30">Loading community feed…</p>
            </div>
          )}
          {error && (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-red-400/70">{error}</p>
            </div>
          )}
          {!loading && topLevelMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[11px] text-white/30">No messages yet.</p>
              <p className="text-[10px] text-white/20">Be the first to start the conversation.</p>
            </div>
          )}
          {topLevelMessages.map((msg) => (
            <CommunityMessageRow
              key={msg.id}
              msg={msg}
              reactions={reactions.filter((r) => r.message_id === msg.id)}
              replies={repliesByParent[msg.id] ?? []}
              allReactions={reactions}
              allBoosts={boosts}
              currentUserId={account?.id ?? ''}
              isExpanded={expandedThreads.has(msg.id)}
              isCommentsExpanded={expandedComments.has(msg.id)}
              isSaved={savedPostIds.has(msg.id)}
              onToggleThread={toggleThread}
              onToggleComments={toggleComments}
              onReact={toggleReaction}
              onReply={(m) => setReplyTarget(m)}
              onBoost={handleBoost}
              onToggleSave={toggleSave}
              onAuthorClick={handleAuthorClick}
              onSubmitComment={submitComment}
              onDeleteMessage={handleDeleteMessage}
              account={account}
              commentError={commentError}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {replyTarget && (
          <div className={"shrink-0 border-t border-white/[0.06] px-3 py-1.5"}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">
                Replying to <span className="text-white/70">{replyTarget.author_name}</span>
              </span>
              <button
                onClick={() => setReplyTarget(null)}
                className="text-[10px] text-white/30 hover:text-white/60"
              >
                cancel
              </button>
            </div>
          </div>
        )}

        {postingStatusChecked && canPost ? (
          <div className="shrink-0 border-t border-white/[0.06] px-2 py-1">
          {pendingImage && (
            <div className="mb-1 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/40 p-1">
              <img src={pendingImage.url} alt="preview" className="h-8 w-8 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate text-[9px] text-white/40">{pendingImage.name}</span>
              <button
                onClick={() => { URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }}
                className="flex h-5 w-5 items-center justify-center rounded border border-white/10 text-white/40 hover:text-white/80"
              >
                <X className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/50 px-1.5 py-1">
            <button
              onClick={() => imageInputRef.current?.click()}
              title="Attach image"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors active:scale-95"
              style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.06)', color: GOLD }}
            >
              <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <EmojiPicker onInsert={(emoji) => {
              const el = inputRef.current;
              if (el) {
                const start = el.selectionStart ?? el.value.length;
                const end = el.selectionEnd ?? el.value.length;
                setInput(input.slice(0, start) + emoji + input.slice(end));
                requestAnimationFrame(() => {
                  el.focus();
                  el.setSelectionRange(start + emoji.length, start + emoji.length);
                });
              } else {
                setInput((prev) => prev + emoji);
              }
            }} />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="What's happening in poker?"
              className="min-w-0 flex-1 bg-transparent px-1.5 text-[12px] text-white outline-none placeholder:text-white/25"
              style={{ height: '1.75rem' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-30"
              style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              <Send className="h-3 w-3" strokeWidth={1.5} />
              Post
            </button>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); e.target.value = ''; }}
          />
        </div>
        ) : null}
        </>
        </div>
    </div>
  );
}

function CommunityMessageRow({
  msg,
  reactions,
  replies,
  allReactions,
  allBoosts,
  currentUserId,
  isExpanded,
  isCommentsExpanded,
  isSaved,
  onToggleThread,
  onToggleComments,
  onReact,
  onReply,
  onBoost,
  onToggleSave,
  onAuthorClick,
  onSubmitComment,
  onDeleteMessage,
  account,
  commentError,
}: {
  msg: ChatMessage;
  reactions: ChatReaction[];
  replies: ChatMessage[];
  allReactions: ChatReaction[];
  allBoosts: ChatBoost[];
  currentUserId: string;
  isExpanded: boolean;
  isCommentsExpanded: boolean;
  isSaved: boolean;
  onToggleThread: (id: string) => void;
  onToggleComments: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  onBoost: (messageId: string) => void;
  onToggleSave: (postId: string) => void;
  onAuthorClick: (e: React.MouseEvent, msg: ChatMessage) => void;
  onSubmitComment: (postId: string, text: string) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => void;
  account: SpotVaultAccount | null;
  commentError: string | null;
}) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const contextMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const roleLabel = ROLE_LABELS[msg.author_role] ?? msg.author_role;
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const msgBoosts = allBoosts.filter((b) => b.message_id === msg.id);
  const boostCount = msgBoosts.length;
  const hasBoosted = msgBoosts.some((b) => b.user_id === currentUserId);
  const commentCount = replies.length;
  const isFounderAuthor = useIsFounder(msg.author_id);
  const hasSpecialBadge = isFounderAuthor || isStaff(accountForId(msg.author_id)) || isModerator(accountForId(msg.author_id));

  const [commentSending, setCommentSending] = useState(false);
  const handleSendComment = async () => {
    if (!commentText.trim() || commentSending) return;
    setCommentSending(true);
    const ok = await onSubmitComment(msg.id, commentText);
    setCommentSending(false);
    if (ok) setCommentText('');
  };

  return (
    <div className="group mx-0.5 my-2.5 sm:mx-1 sm:my-3">
      <div
        className="rounded-lg border p-2.5 sm:rounded-xl sm:p-3.5"
        style={hubGlassCard}>
        <div className="flex gap-2 sm:gap-2.5">
          <button onClick={(e) => onAuthorClick(e, msg)} className="shrink-0 transition-all active:scale-105">
            <Avatar userId={msg.author_id} name={msg.author_name} avatarUrl={msg.author_avatar} size={32} className="h-7 w-7 sm:h-8 sm:w-8" ringClass="border-white/[0.08]" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={(e) => onAuthorClick(e, msg)}
                className="truncate text-[11px] font-semibold hover:text-[#d4a52c]"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                {msg.author_name}
              </button>
              <FounderBadgeForUser userId={msg.author_id} />
              {isStaff(accountForId(msg.author_id)) && <StaffBadge size="xs" />}
              <ModeratorBadgeForUser userId={msg.author_id} />
              <ConfigurableStaffBadge userId={msg.author_id} size="xs" />
              <SviTitleBadge userId={msg.author_id} size="xs" />
              <MemberCheckmark size={13} isMember={true} />
              {!hasSpecialBadge && <UserIdentityFlag userId={msg.author_id} fallbackRole={roleLabel} size="sm" />}
              <span className="shrink-0 text-[9px] text-white/25">{timeAgo(msg.created_at)}</span>

              {/* Context menu (3-dot) */}
              <div className="relative ml-auto">
                <button
                  ref={contextMenuBtnRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const menuWidth = 160; // w-40 = 10rem = 160px
                    const left = Math.max(8, rect.right - menuWidth);
                    const top = rect.bottom + 4;
                    // If menu would go off bottom of viewport, flip upward
                    const menuHeight = 200;
                    const finalTop = (top + menuHeight > window.innerHeight) ? Math.max(8, rect.top - menuHeight - 4) : top;
                    setContextMenuPos({ top: finalTop, left });
                    setContextMenuOpen(v => !v);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded text-white/25 transition-colors hover:text-white/60"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                {contextMenuOpen && contextMenuPos && createPortal(
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenuOpen(false)} />
                    <div className="fixed z-50 w-40 rounded-lg border border-white/10 bg-[#0d1115] p-1 shadow-2xl" style={{ top: contextMenuPos.top, left: contextMenuPos.left }}>
                      <button
                        onClick={() => { onToggleSave(msg.id); setContextMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5"
                      >
                        <Bookmark className="h-3 w-3" fill={isSaved ? GOLD : 'none'} style={{ color: isSaved ? GOLD : undefined }} />
                        {isSaved ? 'Remove bookmark' : 'Save'}
                      </button>
                      <button
                        disabled
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/30"
                      >
                        <Zap className="h-3 w-3" /> Boost Visibility
                        <span className="ml-auto rounded bg-white/5 px-1 text-[8px] font-bold text-white/30 uppercase">Soon</span>
                      </button>
                      <button
                        onClick={() => { dispatchOpenGiftModal({ recipientId: msg.author_id, recipientName: msg.author_name }); setContextMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-white/70 hover:bg-white/5"
                      >
                        <Gift className="h-3 w-3" /> Gift Spot
                      </button>
                      {msg.author_id === currentUserId && (
                        <button
                          onClick={() => {
                            if (confirm('Delete this post?\nThis cannot be undone.')) {
                              onDeleteMessage(msg.id);
                            }
                            setContextMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </div>
            {msg.body && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/80 sm:text-[12px]">{msg.body}</p>
            )}
            {msg.attachment_type === 'image' && msg.attachment_url && (
              <div className="mt-1.5 overflow-hidden rounded-lg border border-white/[0.06]">
                <img src={msg.attachment_url} alt={msg.attachment_label || 'attachment'} className="max-h-64 w-full object-cover" loading="lazy" />
              </div>
            )}
            {msg.attachment_type === 'hh' && msg.attachment_url && (
              <SharedHandCard
                attachmentUrl={msg.attachment_url}
                attachmentLabel={msg.attachment_label}
                onPlayHand={(ref: HandShareRef) => {
                  const event = new CustomEvent('sv-play-shared-hand', { detail: ref });
                  window.dispatchEvent(event);
                }}
              />
            )}
            {msg.attachment_type && msg.attachment_type !== 'image' && msg.attachment_type !== 'hh' && msg.attachment_label && (
              <button className={"mt-1.5 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-left transition-colors hover:border-[#c0911e]/25"}>
                <span className="text-[10px] font-medium text-white/70">{msg.attachment_label}</span>
                <ArrowRight className="h-3 w-3 text-white/30" strokeWidth={1.5} />
              </button>
            )}

            {/* Reactions row (existing emoji reactions) */}
            {Object.entries(groupedReactions).length > 0 && (
              <div className="mt-1 flex items-center gap-1.5">
                {Object.entries(groupedReactions).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(msg.id, emoji)}
                    className={"flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 text-[9px] transition-colors hover:bg-white/10"}
                  >
                    <span>{emoji}</span>
                    <span className="text-white/40">{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Engagement bar: Comment + Boost */}
            <div className="mt-1.5 flex items-center gap-3 border-t border-white/[0.04] pt-1.5">
              {/* Comment */}
              <button
                onClick={() => onToggleComments(msg.id)}
                className="flex items-center gap-1 text-[10px] transition-colors hover:text-white/60"
                style={{ color: isCommentsExpanded ? GOLD_SOFT : 'rgba(255,255,255,0.3)' }}
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{commentCount > 0 ? commentCount : ''} Comments</span>
              </button>

              {/* Boost (social) */}
              <button
                onClick={() => onBoost(msg.id)}
                title="Boost this post to signal it's valuable"
                className="flex items-center gap-1 text-[10px] transition-colors"
                style={{ color: hasBoosted ? GOLD : 'rgba(255,255,255,0.3)' }}
              >
                <Rocket className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: hasBoosted ? GOLD : 'rgba(212,165,44,0.4)' }} />
                <span style={{ color: hasBoosted ? GOLD : 'rgba(212,165,44,0.4)' }}>{boostCount > 0 ? `${boostCount} ` : ''}Boost</span>
              </button>

              {/* Gift Spot */}
              <button
                onClick={() => dispatchOpenGiftModal({ recipientId: msg.author_id, recipientName: msg.author_name })}
                title="Gift a Spot to this user"
                className="flex items-center gap-1 text-[10px] transition-colors"
                style={{ color: 'rgba(212,165,44,0.4)' }}
              >
                <Gift className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span style={{ color: 'rgba(212,165,44,0.4)' }}>Gift</span>
              </button>

              {/* Reply (kept for quick reply, hover-only) */}
              <button
                onClick={() => onReply(msg)}
                className="ml-auto text-[9px] text-white/25 opacity-0 transition-opacity hover:text-white/50 group-hover:opacity-100"
              >
                Reply
              </button>
            </div>

            {/* Inline comments expansion */}
            {isCommentsExpanded && (
              <div className="mt-2 space-y-1.5 border-l border-white/[0.06] pl-3">
                {replies.length > 0 ? (
                  replies.map((reply) => (
                    <CommentRow
                      key={reply.id}
                      msg={reply}
                      currentUserId={currentUserId}
                      onAuthorClick={onAuthorClick}
                      isSaved={isSaved}
                      onToggleSave={onToggleSave}
                      onDeleteMessage={onDeleteMessage}
                    />
                  ))
                ) : (
                  <p className="py-1 text-[10px] text-white/25">No comments yet.</p>
                )}

                {/* Comment input */}
                {commentError && (
                  <p className="pt-1 text-[10px] text-red-400/80">{commentError}</p>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  {account && (
                    <Avatar userId={account.id} name={account.name} size={20} className="h-5 w-5 shrink-0" ringClass="border-white/[0.08]" />
                  )}
                  <input
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendComment(); } }}
                    placeholder="Write a comment..."
                    disabled={commentSending}
                    className="min-w-0 flex-1 rounded-md border border-white/[0.06] bg-black/40 px-2 py-1 text-[11px] text-white/80 placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() => void handleSendComment()}
                    disabled={!commentText.trim() || commentSending}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all active:scale-95 disabled:opacity-30"
                    style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
                  >
                    <Send className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}

            {/* Thread toggle (legacy replies view) */}
            {replies.length > 0 && !isCommentsExpanded && (
              <button
                onClick={() => onToggleThread(msg.id)}
                className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-[#c0911e]/70 transition-colors hover:text-[#c0911e]"
              >
                <ChevronDown
                  className="h-3 w-3 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                  strokeWidth={1.5}
                />
                View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}

            {/* Expanded legacy thread view */}
            {isExpanded && replies.length > 0 && (
              <div className={"mt-2 space-y-1.5 border-l border-white/[0.06] pl-3"}>
                {replies.map((reply) => (
                  <ReplyRow
                    key={reply.id}
                    msg={reply}
                    reactions={allReactions.filter((r) => r.message_id === reply.id)}
                    currentUserId={currentUserId}
                    onReact={onReact}
                    onAuthorClick={onAuthorClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  msg,
  currentUserId,
  onAuthorClick,
  isSaved,
  onToggleSave,
  onDeleteMessage,
}: {
  msg: ChatMessage;
  currentUserId: string;
  onAuthorClick: (e: React.MouseEvent, msg: ChatMessage) => void;
  isSaved: boolean;
  onToggleSave: (postId: string) => void;
  onDeleteMessage: (messageId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const commentMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [commentMenuPos, setCommentMenuPos] = useState<{ top: number; left: number } | null>(null);
  const roleLabel = ROLE_LABELS[msg.author_role] ?? msg.author_role;
  const isFounderComment = useIsFounder(msg.author_id);
  const hasSpecialBadgeComment = isFounderComment || isStaff(accountForId(msg.author_id)) || isModerator(accountForId(msg.author_id));

  return (
    <div className={"group flex gap-2 rounded-lg border border-white/[0.04] bg-black/40 px-2 py-1.5"}>
      <button onClick={(e) => onAuthorClick(e, msg)} className="shrink-0 transition-all hover:scale-105">
        <Avatar userId={msg.author_id} name={msg.author_name} avatarUrl={msg.author_avatar} size={24} className="h-6 w-6" ringClass="border-white/[0.08]" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => onAuthorClick(e, msg)}
            className="truncate text-[10px] font-semibold hover:text-[#d4a52c]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {msg.author_name}
          </button>
          <FounderBadgeForUser userId={msg.author_id} />
          {isStaff(accountForId(msg.author_id)) && <StaffBadge size="xs" />}
          <ModeratorBadgeForUser userId={msg.author_id} />
          <ConfigurableStaffBadge userId={msg.author_id} size="xs" />
          <SviTitleBadge userId={msg.author_id} size="xs" />
          <MemberCheckmark size={11} isMember={true} />
          {!hasSpecialBadgeComment && <UserIdentityFlag userId={msg.author_id} fallbackRole={roleLabel} size="sm" />}
          <span className="shrink-0 text-[8px] text-white/20">{timeAgo(msg.created_at)}</span>
          <div className="relative ml-auto">
            <button
              ref={commentMenuBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const menuWidth = 128;
                const left = Math.max(8, rect.right - menuWidth);
                const top = rect.bottom + 4;
                const menuHeight = 160;
                const finalTop = (top + menuHeight > window.innerHeight) ? Math.max(8, rect.top - menuHeight - 4) : top;
                setCommentMenuPos({ top: finalTop, left });
                setMenuOpen(v => !v);
              }}
              className="flex h-4 w-4 items-center justify-center rounded text-white/20 transition-colors hover:text-white/50"
            >
              <MoreHorizontal className="h-3 w-3" strokeWidth={1.5} />
            </button>
            {menuOpen && commentMenuPos && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="fixed z-50 w-32 rounded-lg border border-white/10 bg-[#0d1115] p-1 shadow-2xl" style={{ top: commentMenuPos.top, left: commentMenuPos.left }}>
                  <button
                    onClick={() => { onToggleSave(msg.id); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] text-white/70 hover:bg-white/5"
                  >
                    <Bookmark className="h-3 w-3" fill={isSaved ? GOLD : 'none'} style={{ color: isSaved ? GOLD : undefined }} />
                    {isSaved ? 'Unsave' : 'Save'}
                  </button>
                  <button
                    onClick={() => { dispatchOpenGiftModal({ recipientId: msg.author_id, recipientName: msg.author_name }); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] text-white/70 hover:bg-white/5"
                  >
                    <Gift className="h-3 w-3" /> Gift Spot
                  </button>
                  {msg.author_id === currentUserId && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this comment?\nThis cannot be undone.')) {
                          onDeleteMessage(msg.id);
                        }
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10px] text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
        {msg.body && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/70">{msg.body}</p>
        )}
      </div>
    </div>
  );
}

function ReplyRow({
  msg,
  reactions,
  currentUserId,
  onReact,
  onAuthorClick,
}: {
  msg: ChatMessage;
  reactions: ChatReaction[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onAuthorClick: (e: React.MouseEvent, msg: ChatMessage) => void;
}) {
  const roleLabel = ROLE_LABELS[msg.author_role] ?? msg.author_role;
  const isFounderReply = useIsFounder(msg.author_id);
  const hasSpecialBadgeReply = isFounderReply || isStaff(accountForId(msg.author_id)) || isModerator(accountForId(msg.author_id));
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={"group flex gap-2 rounded-lg border border-white/[0.04] bg-black/40 px-2 py-1.5"}>
      <button onClick={(e) => onAuthorClick(e, msg)} className="shrink-0 transition-all hover:scale-105">
        <Avatar userId={msg.author_id} name={msg.author_name} avatarUrl={msg.author_avatar} size={24} className="h-6 w-6" ringClass="border-white/[0.08]" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => onAuthorClick(e, msg)}
            className="truncate text-[10px] font-semibold hover:text-[#d4a52c]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {msg.author_name}
          </button>
          {isStaff(accountForId(msg.author_id)) && <StaffBadge size="xs" />}
          <ModeratorBadgeForUser userId={msg.author_id} />
          <ConfigurableStaffBadge userId={msg.author_id} size="xs" />
          <SviTitleBadge userId={msg.author_id} size="xs" />
          <MemberCheckmark size={11} isMember={true} />
          {!hasSpecialBadgeReply && <UserIdentityFlag userId={msg.author_id} fallbackRole={roleLabel} size="sm" />}
          <span className="shrink-0 text-[8px] text-white/20">{timeAgo(msg.created_at)}</span>
        </div>
        {msg.body && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/70">{msg.body}</p>
        )}
        {Object.entries(groupedReactions).length > 0 && (
          <div className="mt-0.5 flex items-center gap-1">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className={"flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 text-[8px]"}
              >
                <span>{emoji}</span>
                <span className="text-white/40">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { LucideIcon };
