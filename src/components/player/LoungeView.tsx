import { useState, useMemo, useEffect, useCallback } from 'react';
import { Send, ChevronDown, X, Heart, Bookmark, Loader2 } from 'lucide-react';
import {
  STAKES_COMMUNITIES,
  POKER_FORMATS,
  getStakesCommunity,
  type StakesLevel,
  type PokerFormat,
} from '@/data/playerNetworkCommunities';
import { fetchLoungeMessages, postLoungeMessage, subscribeLoungeMessages, type LoungeMessage, type CommunityScope } from '@/lib/loungeStore';
import { usePersistentState } from '@/hooks/usePersistentState';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

type LoungeDestination =
  | { type: 'spotvault' }
  | { type: 'custom'; scope: string; name: string };

interface Props {
  account: SpotVaultAccount | null;
  fixedScope?: CommunityScope;
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

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function LoungeView({ account, fixedScope = 'spotvault' }: Props) {
  const isFixedScope = fixedScope !== 'spotvault';
  const [destination, setDestination] = useState<LoungeDestination>(
    fixedScope === 'spotvault' ? { type: 'spotvault' } : { type: 'custom', scope: fixedScope, name: 'StakeKings' },
  );
  const [stakes, setStakes] = usePersistentState<StakesLevel>('lounge-stakes', 'low');
  const [format, setFormat] = usePersistentState<PokerFormat | 'all' | 'online'>('lounge-format', 'online');
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [showSelector, setShowSelector] = useState(false);

  const scope: CommunityScope = isFixedScope ? fixedScope : (destination.type === 'spotvault' ? 'spotvault' : (destination.scope as CommunityScope));
  const community = useMemo(() => getStakesCommunity(stakes), [stakes]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const data = await fetchLoungeMessages(stakes, format === 'live' ? 'live' : undefined, scope);
    setMessages(format === 'live' ? data : format === 'online' ? data.filter((message) => message.poker_format !== 'live') : data);
    setLoading(false);
  }, [stakes, format, scope]);

  useEffect(() => {
    loadMessages();
    const unsub = subscribeLoungeMessages(stakes, format === 'live' ? 'live' : undefined, scope, (msg) => {
      if (format === 'online' && msg.poker_format === 'live') return;
      setMessages((prev) => [msg, ...prev]);
    });
    return unsub;
  }, [loadMessages, stakes, format, scope]);

  const submitPost = async () => {
    if (!composer.trim() || posting) return;
    setPosting(true);
    const authorId = account?.id ?? 'anonymous';
    const authorName = account?.name ?? 'Anonymous';
    const authorAvatar = null;
    const authorRole = account?.primaryRole ?? null;
    await postLoungeMessage(composer.trim(), stakes, format === 'live' ? 'live' : 'mtt', scope, {
      authorId,
      authorName,
      authorAvatar,
      authorRole,
    });
    setComposer('');
    setPosting(false);
  };

  const toggleLike = (id: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSave = (id: string) => {
    setSavedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const destLabel = isFixedScope ? 'StakeKings Lounge' : destination.type === 'spotvault' ? 'SpotVault Lounges' : destination.name;

  const destShortLabel = isFixedScope || destination.type === 'spotvault'
    ? `${community.shortName} · ${format === 'all' ? 'All' : format === 'online' ? 'Online' : 'Live'}`
    : '';

  const composerPlaceholder = destination.type === 'spotvault'
    ? `Post to ${community.name} · ${format === 'all' ? 'all environments' : format === 'online' ? 'online poker' : 'live poker'}...`
    : `Share something with ${destination.name}...`;

  return (
    <div className="flex h-full flex-col">
      {/* Compact control bar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.04] px-3 py-2">
        {/* Community selector */}
        <button
          onClick={() => { if (!isFixedScope) setShowSelector(!showSelector); }}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-wide transition-all"
          style={{
            borderColor: (isFixedScope || destination.type === 'spotvault') ? BORDER : 'rgba(74,222,128,0.25)',
            background: (isFixedScope || destination.type === 'spotvault') ? 'rgba(212,165,44,0.08)' : 'rgba(74,222,128,0.08)',
            color: (isFixedScope || destination.type === 'spotvault') ? GOLD_SOFT : '#86efac',
          }}
        >
          {destLabel}
          {destShortLabel && <span className="text-white/30">· {destShortLabel}</span>}
          {!isFixedScope && <ChevronDown className="h-3 w-3" strokeWidth={1.5} />}
        </button>

        <span className="hidden sm:block text-[9px] font-mono tracking-widest text-white/25 uppercase">Lounge filters</span>
      </div>

      {(isFixedScope || destination.type === 'spotvault') && (
        <div className="shrink-0 overflow-x-auto border-b border-white/[0.04] px-3 py-1.5" style={{ background: 'rgba(8,7,6,0.82)' }}>
          <div className="flex min-w-max items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Stakes</span>
              <div className="inline-flex items-center rounded-lg border p-0.5" style={{ borderColor: BORDER, background: 'rgba(5,6,7,0.93)' }}>
                {STAKES_COMMUNITIES.map((s) => {
                  const active = stakes === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStakes(s.id)}
                      className="rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all"
                      style={{
                        background: active ? `linear-gradient(135deg, ${GOLD}, #b78318)` : 'transparent',
                        color: active ? '#1a1304' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {s.shortName}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Environment</span>
              <div className="inline-flex items-center rounded-lg border p-0.5" style={{ borderColor: BORDER, background: 'rgba(5,6,7,0.93)' }}>
                {(['all', 'online', 'live'] as const).map((environment) => {
                  const active = format === environment;
                  return (
                    <button
                      key={environment}
                      onClick={() => setFormat(environment)}
                      className="rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all"
                      style={{
                        background: active ? `linear-gradient(135deg, ${GOLD}, #b78318)` : 'transparent',
                        color: active ? '#1a1304' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {environment === 'all' ? 'All' : environment === 'online' ? 'Online' : 'Live'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community selector dropdown */}
      {showSelector && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSelector(false)} />
          <div
            className="absolute left-3 top-12 z-50 w-64 rounded-xl border p-2 backdrop-blur-xl"
            style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.95)', boxShadow: '0 12px 40px -8px rgba(0,0,0,0.8)' }}
          >
            {/* Your Communities */}
            <div className="mb-1 px-2 py-1 text-[8px] font-mono tracking-widest text-white/30 uppercase">Your Communities</div>
            <button
              onClick={() => { setDestination({ type: 'custom', scope: 'stakekings', name: 'StakeKings' }); setShowSelector(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/70 transition-colors hover:bg-white/5"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: '#4ade80' }} />
              StakeKings
            </button>

            {/* Discover */}
            <div className="mb-1 mt-2 px-2 py-1 text-[8px] font-mono tracking-widest text-white/30 uppercase">Discover Communities</div>
            <button
              onClick={() => { setDestination({ type: 'spotvault' }); setShowSelector(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-white/70 transition-colors hover:bg-white/5"
              style={{ color: destination.type === 'spotvault' ? GOLD_SOFT : 'rgba(255,255,255,0.7)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />
              SpotVault Lounges
            </button>
          </div>
        </>
      )}

      {/* Compact description line (SpotVault only) */}
      {(isFixedScope || destination.type === 'spotvault') && (
        <div className="shrink-0 px-3 py-1 text-[10px] text-white/30">
          {community.tagline}
        </div>
      )}

      {/* Feed — same density as Social feed */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-[11px] text-white/30">No posts in this lounge yet.</p>
            <p className="text-[10px] text-white/20">Be the first to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <LoungeCard
              key={msg.id}
              msg={msg}
              accent={(isFixedScope || destination.type === 'spotvault') ? community.accentColor : '#4ade80'}
              isLiked={likedPosts.has(msg.id)}
              isSaved={savedPosts.has(msg.id)}
              onLike={() => toggleLike(msg.id)}
              onSave={() => toggleSave(msg.id)}
            />
          ))
        )}
      </div>

      {/* Compact composer */}
      <div className="shrink-0 border-t border-white/[0.06] p-2.5">
        <div className="flex items-end gap-2">
          <input
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPost(); } }}
            placeholder={composerPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
          />
          <button
            onClick={submitPost}
            disabled={!composer.trim() || posting}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-30"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Send className="h-3.5 w-3.5" strokeWidth={1.5} />}
            <span className="hidden sm:inline">Post</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function LoungeCard({
  msg,
  accent,
  isLiked,
  isSaved,
  onLike,
  onSave,
}: {
  msg: LoungeMessage;
  accent: string;
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onSave: () => void;
}) {
  return (
    <div className="group mx-0.5 my-1 sm:mx-1 sm:my-1.5">
      <div
        className="rounded-lg border p-2 sm:rounded-xl sm:p-3"
        style={{
          borderColor: 'rgba(212,165,44,0.12)',
          background: 'rgba(12,10,10,0.92)',
          boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex gap-2 sm:gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[9px] font-semibold text-white/70 sm:h-8 sm:w-8">
            {initials(msg.author_name || '?')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="truncate text-[11px] font-semibold text-white/90">{msg.author_name}</span>
              {msg.author_role && (
                <span
                  className="shrink-0 rounded px-1 py-0.5 text-[7px] font-bold tracking-wide"
                  style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
                >
                  {msg.author_role}
                </span>
              )}
              <span className="shrink-0 text-[9px] text-white/25">{timeAgo(msg.created_at)}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/80 sm:text-[12px]">{msg.body}</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={onLike}
                className="flex items-center gap-0.5 text-[9px] text-white/25 transition-colors hover:text-white/50"
                style={{ color: isLiked ? accent : undefined }}
              >
                <Heart className="h-3 w-3" strokeWidth={1.5} fill={isLiked ? accent : 'none'} />
                {isLiked ? 1 : 0}
              </button>
              <button
                onClick={onSave}
                className="flex items-center gap-0.5 text-[9px] text-white/25 transition-colors hover:text-white/50"
                style={{ color: isSaved ? accent : undefined }}
              >
                <Bookmark className="h-3 w-3" strokeWidth={1.5} fill={isSaved ? accent : 'none'} />
                {isSaved ? 1 : 0}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
