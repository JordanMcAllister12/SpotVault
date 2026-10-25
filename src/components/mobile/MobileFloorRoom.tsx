import { useState, useMemo } from 'react';
import { ArrowLeft, Users, MessageCircle, Send, Heart, Bookmark, X, Trophy, BookOpen, DollarSign, type LucideIcon } from 'lucide-react';
import {
  STAKES_COMMUNITIES,
  POKER_FORMATS,
  PLAYER_NETWORK_BACKGROUND,
  getStakesCommunity,
  getNetworkPosts,
  getNetworkContacts,
  getNetworkMembers,
  getNetworkOffers,
  type StakesLevel,
  type PokerFormat,
} from '@/data/playerNetworkCommunities';
import { CommunityFeed } from '@/components/CommunityFeed';
import { FeedFlipCard } from '@/components/shared/FeedFlipCard';
import { dispatchMessageUser } from '@/lib/profileEvents';

const GOLD = '#d4a52c';
const GOLD_BRIGHT = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  onBack: () => void;
  onOpenCommunity: () => void;
}

export function MobileFloorRoom({ onBack, onOpenCommunity }: Props) {
  const [stakes, setStakes] = useState<StakesLevel>('low');
  const [format, setFormat] = useState<PokerFormat>('mtt');
  const [communityOpen, setCommunityOpen] = useState(false);

  const community = useMemo(() => getStakesCommunity(stakes), [stakes]);
  const posts = useMemo(() => getNetworkPosts(stakes, format), [stakes, format]);
  const members = useMemo(() => getNetworkMembers(stakes, format), [stakes, format]);
  const offers = useMemo(() => getNetworkOffers(stakes, format), [stakes, format]);
  const contacts = useMemo(() => getNetworkContacts(stakes, format), [stakes, format]);

  if (communityOpen) {
    return (
      <div className="flex h-full flex-col">
        <div
          className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(8,7,6,0.85)', backdropFilter: 'blur(16px)' }}
        >
          <button onClick={() => setCommunityOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: community.accentColor + '80' }}>
              {community.shortName} · {POKER_FORMATS.find((f) => f.id === format)?.shortName} Community
            </span>
            <h2 className="text-sm font-bold text-white">{community.name}</h2>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FeedFlipCard
            currentUserId=""
            onMessage={(uid) => dispatchMessageUser(uid)}
            onBack={() => {}}
          >
            <CommunityFeed account={null} />
          </FeedFlipCard>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-full"
      style={{
        backgroundImage: `url("${PLAYER_NETWORK_BACKGROUND}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Environment overlay */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(5,3,2,0.3) 0%, rgba(5,3,2,0.75) 100%)` }} />

      <div className="relative z-10">
        {/* Header with stakes + format filters */}
        <div className="px-5 pt-6 pb-3">
          <div>
            <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-white/40">Player Network</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: community.accentColor, textShadow: `0 0 12px ${community.accentColor}40` }}>
                {community.name}
              </span>
              <span className="text-lg font-bold text-white/80">· {POKER_FORMATS.find((f) => f.id === format)?.name}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-white/50">{community.tagline} · {community.usersOnline} here</p>
          </div>

          {/* Stakes filter pills */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Stakes</span>
            <div className="inline-flex items-center rounded-lg border p-0.5" style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(5,6,7,0.93)' }}>
              {STAKES_COMMUNITIES.map((s) => {
                const active = stakes === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStakes(s.id)}
                    className="flex items-center justify-center rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all"
                    style={{
                      background: active ? `linear-gradient(135deg, ${GOLD_BRIGHT}, #b78318)` : 'transparent',
                      color: active ? '#1a1304' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {s.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format filter pills */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Format</span>
            <div className="inline-flex items-center rounded-lg border p-0.5" style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(5,6,7,0.93)' }}>
              {POKER_FORMATS.map((f) => {
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className="flex items-center justify-center rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all"
                    style={{
                      background: active ? `linear-gradient(135deg, ${GOLD_BRIGHT}, #b78318)` : 'transparent',
                      color: active ? '#1a1304' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {f.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating modules */}
        <div className="space-y-3 px-4 pb-4">
          {/* Community module */}
          <FloorModule icon={MessageCircle} title="Community" accent={community.accentColor}>
            <div className="space-y-2">
              {posts.slice(0, 3).map((post) => (
                <div key={post.id} className="rounded-lg border border-white/5 bg-black/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[8px] font-semibold text-white/60">
                      {post.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-[11px] font-medium text-white/80">{post.author}</span>
                    <span className="text-[9px] text-white/25">{post.timestamp}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">{post.body}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[9px] text-white/30"><Heart className="h-3 w-3" />{post.likes}</span>
                    <span className="flex items-center gap-1 text-[9px] text-white/30"><MessageCircle className="h-3 w-3" />{post.comments}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCommunityOpen(true)}
              className="mt-2.5 w-full rounded-lg border py-2 text-[11px] font-bold tracking-wide uppercase transition-all active:scale-95"
              style={{ borderColor: community.accentColor + '30', color: community.accentColor, background: community.accentColor + '08' }}
            >
              View Community
            </button>
          </FloorModule>

          {/* Who's Here module */}
          <FloorModule icon={Users} title="Who's Here" accent={community.accentColor}>
            <div className="flex items-center gap-2">
              {members.slice(0, 5).map((m) => (
                <div key={m.name} className="relative">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border text-[9px] font-semibold text-white/70"
                    style={{ borderColor: community.accentColor + '30', background: community.accentColor + '08' }}
                  >
                    {m.initials}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black/50"
                    style={{ background: m.status === 'posting' ? '#4ade80' : m.status === 'browsing' ? '#fbbf24' : '#6b7280' }}
                  />
                </div>
              ))}
              <span className="ml-1 text-[11px] font-medium text-white/40">
                +{Math.max(0, community.usersOnline - 5)}
              </span>
            </div>
          </FloorModule>

          {/* Offers module */}
          <FloorModule icon={Trophy} title="Offers" accent={community.accentColor}>
            <div className="space-y-2">
              {offers.map((offer) => (
                <div key={offer.id} className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-black/20 p-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: community.accentColor + '30', background: community.accentColor + '10' }}>
                    {offer.type === 'Coaching' ? (
                      <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: community.accentColor }} />
                    ) : offer.type === 'Course' ? (
                      <Trophy className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: community.accentColor }} />
                    ) : (
                      <DollarSign className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: community.accentColor }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-white/80">{offer.title}</p>
                    <p className="truncate text-[9px] text-white/35">{offer.provider} · {offer.type}</p>
                    <p className="mt-1 text-[10px] font-bold" style={{ color: community.accentColor }}>{offer.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </FloorModule>
        </div>
      </div>
    </div>
  );
}

function FloorModule({ icon: Icon, title, accent, children }: { icon: LucideIcon; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-4 backdrop-blur-md"
      style={{
        borderColor: accent + '15',
        background: 'rgba(8,7,6,0.55)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -16px rgba(0,0,0,0.6)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" strokeWidth={1.5} style={{ color: accent }} />
        <span className="text-[11px] font-mono tracking-[0.15em] uppercase" style={{ color: accent + 'cc' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
