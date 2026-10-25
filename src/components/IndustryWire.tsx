import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BadgeCheck, ArrowRight, Circle, Pause, Play, Pin, BriefcaseBusiness, type LucideIcon,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { DEMO_WIRE_POSTS, type DemoWirePost } from '@/data/mobileDemoData';
import { useAutoScroll } from '@/hooks/useAutoDisplay';
import { Avatar } from '@/components/shared/Avatar';
import { hubAnnouncementCard } from '@/components/shared/hubGlass';
import { fetchPublicListings, trackAnalyticsEvent, PORTAL_TYPE_LABELS, type ProfessionalListing, type PortalType } from '@/lib/professionalListingStore';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface WirePost {
  id: string;
  source_name: string;
  source_handle: string | null;
  source_avatar: string | null;
  source_verified: boolean;
  content_type: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_promoted: boolean;
  is_pinned: boolean | null;
  author_role: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  NEWS: { label: 'NEWS', color: '#60a5fa', icon: BadgeCheck },
  MEDIA: { label: 'MEDIA', color: '#f59e0b', icon: BadgeCheck },
  TOURNAMENT: { label: 'TOURNAMENT', color: '#a78bfa', icon: BadgeCheck },
  RESULT: { label: 'RESULT', color: '#34d399', icon: BadgeCheck },
  JOB: { label: 'JOB', color: '#60a5fa', icon: BadgeCheck },
  HH: { label: 'HH', color: '#ec4899', icon: BadgeCheck },
  VIDEO: { label: 'VIDEO', color: '#f59e0b', icon: BadgeCheck },
  SPOT: { label: 'SPOT', color: '#ec4899', icon: BadgeCheck },
  COURSE: { label: 'COURSE', color: '#a78bfa', icon: BadgeCheck },
  EVENT: { label: 'EVENT', color: '#60a5fa', icon: BadgeCheck },
  ANNOUNCEMENT: { label: 'ANNOUNCEMENT', color: '#34d399', icon: BadgeCheck },
  PROMOTED: { label: 'PROMOTED', color: '#d97757', icon: BadgeCheck },
  PROFESSIONAL: { label: 'PROFESSIONAL', color: '#d4a52c', icon: BriefcaseBusiness },
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

export function IndustryWire() {
  const [posts, setPosts] = useState<WirePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { autoEnabled, setAutoEnabled, registerScrollContainer } = useAutoScroll(true);

  const demoPosts: WirePost[] = DEMO_WIRE_POSTS.map((d: DemoWirePost) => ({
    id: d.id,
    source_name: d.source_name,
    source_handle: d.source_handle,
    source_avatar: null,
    source_verified: d.source_verified,
    content_type: d.content_type,
    title: d.title,
    body: d.body,
    cta_label: d.cta_label,
    cta_url: null,
    is_promoted: d.is_promoted,
    is_pinned: false,
    author_role: null,
    metadata: d.metadata ?? null,
    created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
  }));

  const loadPosts = useCallback(async () => {
    const [wireResult, profListings] = await Promise.all([
      supabase.from('industry_wire_posts').select('*').order('created_at', { ascending: false }).limit(50),
      fetchPublicListings({}).catch(() => [] as ProfessionalListing[]),
    ]);
    const { data, error: err } = wireResult;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const realPosts = (data ?? []) as WirePost[];

    // Inject passive professional discovery cards every ~8 posts
    const discoveryCards: WirePost[] = profListings.slice(0, 5).map((listing, i) => ({
      id: `prof-discovery-${listing.id}`,
      source_name: listing.display_name,
      source_handle: listing.portal_type,
      source_avatar: listing.profile_image_url,
      source_verified: false,
      content_type: 'PROFESSIONAL',
      title: listing.professional_title,
      body: listing.short_bio,
      cta_label: 'View Profile',
      cta_url: null,
      is_promoted: false,
      is_pinned: false,
      author_role: null,
      metadata: { listing_id: listing.id, portal_type: listing.portal_type, is_discovery: true },
      created_at: new Date(Date.now() - (i + 1) * 3600000 * 8).toISOString(),
    }));

    // Interleave discovery cards: one every 8 organic posts
    const allPosts = [...realPosts, ...demoPosts];
    const sorted = [...allPosts].sort((a, b) => {
      const aPinned = a.is_pinned ? 1 : 0;
      const bPinned = b.is_pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Insert discovery cards at positions 5, 13, 21, 29, 37
    const withDiscovery: WirePost[] = [];
    let discoveryIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      withDiscovery.push(sorted[i]);
      if (discoveryIdx < discoveryCards.length && (i + 1) % 8 === 0) {
        withDiscovery.push(discoveryCards[discoveryIdx]);
        discoveryIdx++;
      }
    }
    // Append any remaining discovery cards at the end
    while (discoveryIdx < discoveryCards.length) {
      withDiscovery.push(discoveryCards[discoveryIdx]);
      discoveryIdx++;
    }

    setPosts(withDiscovery);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('industry-wire')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'industry_wire_posts' },
        (payload) => {
          setPosts((prev) => [payload.new as WirePost, ...prev].slice(0, 50));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header — hidden on mobile to save vertical space */}
      <div className="hidden shrink-0 border-b border-white/[0.06] px-4 py-3 sm:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}
            >
              <BadgeCheck className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-wide text-white">MAIN FEED</p>
              <p className="text-[8px] font-mono tracking-[0.25em] text-[#c0911e]/60 uppercase">
                Curated &amp; Industry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAutoEnabled(!autoEnabled)}
              className="flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-semibold tracking-widest uppercase transition-colors"
              style={{
                borderColor: autoEnabled ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)',
                background: autoEnabled ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
                color: autoEnabled ? '#4ade80' : 'rgba(255,255,255,0.35)',
              }}
              title={autoEnabled ? 'Auto-scroll running — tap to pause' : 'Auto-scroll paused — tap to resume'}
            >
              {autoEnabled ? <Pause className="h-2.5 w-2.5" strokeWidth={1.5} /> : <Play className="h-2.5 w-2.5" strokeWidth={1.5} />}
            </button>
            <Circle
              className="h-2 w-2 animate-pulse"
              style={{ color: '#4ade80', fill: '#4ade80' }}
              strokeWidth={0}
            />
            <span className="text-[9px] font-medium text-white/40">LIVE</span>
          </div>
        </div>
      </div>

      {/* Mobile compact live indicator */}
      <div className="flex shrink-0 items-center justify-end gap-1.5 px-3 py-1.5 sm:hidden">
        <button
          onClick={() => setAutoEnabled(!autoEnabled)}
          className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold tracking-widest uppercase transition-colors"
          style={{
            borderColor: autoEnabled ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)',
            background: autoEnabled ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
            color: autoEnabled ? '#4ade80' : 'rgba(255,255,255,0.35)',
          }}
        >
          {autoEnabled ? <Pause className="h-2.5 w-2.5" strokeWidth={1.5} /> : <Play className="h-2.5 w-2.5" strokeWidth={1.5} />}
        </button>
        <Circle className="h-2 w-2 animate-pulse" style={{ color: '#4ade80', fill: '#4ade80' }} strokeWidth={0} />
        <span className="text-[9px] font-medium text-white/40">LIVE</span>
      </div>

      {/* Scrollable feed */}
      <div
        ref={registerScrollContainer}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-[11px] text-white/30">Loading main feed…</p>
          </div>
        )}
        {error && (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-red-400/70">{error}</p>
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-[11px] text-white/30">No posts yet.</p>
          </div>
        )}
        {posts.map((post) => (
          <WireCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function DiscoveryCard({ post }: { post: WirePost }) {
  const listingId = post.metadata?.listing_id as string | undefined;
  const portalType = post.metadata?.portal_type as string | undefined;
  const portalLabel = portalType ? (PORTAL_TYPE_LABELS[portalType as PortalType] ?? 'Professional') : 'Professional';

  useEffect(() => {
    if (listingId) void trackAnalyticsEvent(listingId, 'feed_promotion_impression');
  }, [listingId]);

  return (
    <div className="my-1.5 mx-2">
      <div
        className="rounded-lg border p-3"
        style={hubAnnouncementCard}
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>
            Featured {portalLabel}
          </span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
            style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.08)' }}
          >
            {post.source_avatar ? (
              <img src={post.source_avatar} alt={post.source_name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <BriefcaseBusiness className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-white/85">{post.source_name}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/55">{post.title}</p>
            {post.body && <p className="mt-0.5 text-[9px] leading-relaxed text-white/40">{post.body}</p>}
          </div>
        </div>
        {post.cta_label && listingId && (
          <button
            onClick={() => { void trackAnalyticsEvent(listingId, 'feed_promotion_click'); }}
            className="mt-2.5 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-95"
            style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
          >
            {post.cta_label}
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

function WireCard({ post }: { post: WirePost }) {
  const typeInfo = TYPE_CONFIG[post.content_type] ?? TYPE_CONFIG.NEWS;
  const TypeIcon = typeInfo.icon;

  // Passive professional discovery card
  if (post.content_type === 'PROFESSIONAL' && post.metadata?.is_discovery) {
    return <DiscoveryCard post={post} />;
  }

  if (post.is_promoted) {
    return (
      <div className="my-1.5 mx-2">
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: 'rgba(217,119,87,0.15)',
            background: 'rgba(14,10,8,0.85)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color: '#d97757' }}>
              Promoted
            </span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: 'rgba(217,119,87,0.2)', background: 'rgba(217,119,87,0.08)' }}
            >
              <TypeIcon className="h-4 w-4" style={{ color: '#d97757' }} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-white/85">{post.source_name}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/60">{post.title}</p>
            </div>
          </div>
          {post.cta_label && (
            <button
              className="mt-2.5 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-95"
              style={{ borderColor: 'rgba(217,119,87,0.2)', background: 'rgba(217,119,87,0.08)', color: '#e8a080' }}
            >
              {post.cta_label}
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group mx-1 my-1.5 rounded-lg border p-3 transition-colors hover:border-white/[0.08]" style={hubAnnouncementCard}>
      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="mb-1.5 flex items-center gap-1">
          <Pin className="h-2.5 w-2.5" style={{ color: GOLD }} strokeWidth={2} />
          <span className="text-[7px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Pinned</span>
        </div>
      )}
      {/* Source line */}
      <div className="flex items-center gap-2">
        <Avatar name={post.source_name} avatarUrl={post.source_avatar} size={28} ringClass="border-white/[0.08]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[11px] font-semibold text-white/90">{post.source_name}</span>
            {post.source_verified && (
              <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={2} />
            )}
            {post.author_role === 'FOUNDER' && (
              <span className="shrink-0 rounded border px-1 py-0.5 text-[6px] font-bold tracking-widest uppercase" style={{ color: GOLD, borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)' }}>Founder</span>
            )}
          </div>
          <span className="text-[9px] text-white/30">{timeAgo(post.created_at)}</span>
        </div>
        {post.id.startsWith('demo-wire-') && (
          <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[6px] font-bold tracking-widest uppercase text-white/30">
            Demo
          </span>
        )}
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[7px] font-bold tracking-wide"
          style={{ background: `${typeInfo.color}12`, color: typeInfo.color, border: `1px solid ${typeInfo.color}25` }}
        >
          {typeInfo.label}
        </span>
      </div>

      {/* Content */}
      <p className="mt-2 text-[12px] font-semibold leading-snug text-white/90">{post.title}</p>
      {post.body && (
        <p className="mt-1 text-[10px] leading-relaxed text-white/50">{post.body}</p>
      )}

      {/* CTA */}
      {post.cta_label && (
        <button
          className="mt-2 flex items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-white/60 transition-colors hover:border-[#c0911e]/25 hover:text-white/90"
        >
          {post.cta_label}
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

// Re-export LucideProps for type usage elsewhere if needed
export type { LucideProps };
