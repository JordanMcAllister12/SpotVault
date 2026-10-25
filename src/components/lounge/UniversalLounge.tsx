import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Home, Palette, MessageSquare, Search, X, Newspaper, Sparkles, Shield, ArrowRight, Info } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import {
  fetchLoungeConfig,
  fetchBackgroundPreference,
  saveBackgroundPreference,
} from '@/lib/loungeStore';
import {
  OVERLAY_OPACITY,
  DEFAULT_BG_PREFERENCE,
  type LoungeConfig,
  type BackgroundPreference,
  type TournamentEvent,
  type CashGameSession,
  type LoungePost,
} from '@/lib/loungeFramework';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { resolveLoungeAccent } from '@/lib/portalTheme';
import { SocialFeedModule } from '@/components/lounge/SocialFeedModule';
import { LoungeView } from '@/components/player/LoungeView';
import { OfficialMainFeed } from '@/components/community/OfficialMainFeed';
import { sanitizeArticleHtml, type MainFeedPost } from '@/lib/mainFeed';
import { GroupChatModule, type GroupMsg } from '@/components/lounge/GroupChatModule';
import { TournamentModule } from '@/components/lounge/TournamentModule';
import { CashGameModule } from '@/components/lounge/CashGameModule';
import { DestinationSelector } from '@/components/lounge/DestinationSelector';
import { TournamentDetailModal } from '@/components/lounge/TournamentDetailModal';
import { BackgroundCustomizer } from '@/components/lounge/BackgroundCustomizer';
import type { SpotVaultAccount, HubId } from '@/types';
import { isFounderUser } from '@/types';
import type { PortalId } from '@/useDemo';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import { PortalSwitcher } from '@/components/PortalSwitcher';

export interface LoungeDirectContact {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  online: boolean;
  lastSeen: string;
  previewMessage?: string;
  previewTimestamp?: string;
  messages: GroupMsg[];
}

export interface LoungeData {
  liveTournaments?: TournamentEvent[];
  cashGames?: CashGameSession[];
  upcomingEvents?: TournamentEvent[];
  seedPosts?: LoungePost[];
  seedGroupMessages?: GroupMsg[];
  seedDirectMessages?: GroupMsg[];
  seedDirectContacts?: LoungeDirectContact[];
  seedGroupPresence?: { name: string; online: boolean }[];
  region?: string;
}

interface Props {
  slug: string;
  account: SpotVaultAccount | null;
  onBack?: () => void;
  originPortalName?: string;
  onReturnToPortal?: () => void;
  data?: LoungeData;
  configOverride?: Partial<LoungeConfig>;
  currentPortal?: PortalId;
  onSwitchPortal?: (portal: HubId) => void;
  portalSwitchOpen?: boolean;
  onTogglePortalSwitch?: () => void;
  onClosePortalSwitch?: () => void;
  customPortals?: CustomPortalMembership[];
  activePortalId?: string | null;
  customPortalLabel?: string | null;
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
}

const STABLE_CONFIG_OVERRIDE = { name: 'SpotVault Lounge' };

export function UniversalLounge({
  slug,
  account,
  onBack,
  originPortalName,
  onReturnToPortal,
  data = {},
  configOverride,
  currentPortal = 'PLAYER',
  onSwitchPortal,
  portalSwitchOpen = false,
  onTogglePortalSwitch,
  onClosePortalSwitch,
  customPortals = [],
  activePortalId,
  customPortalLabel,
  onEnterCustomPortal,
  onReturnToDefault,
}: Props) {
  const configOverrideRef = useRef(configOverride);
  configOverrideRef.current = configOverride;

  const [config, setConfig] = useState<LoungeConfig | null>(null);
  const [bgPref, setBgPref] = useState<BackgroundPreference>(DEFAULT_BG_PREFERENCE);
  const [showBgCustomizer, setShowBgCustomizer] = useState(false);
  const [inspectBg, setInspectBg] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<TournamentEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState<{ city: string; region: string; label: string } | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<MainFeedPost | null>(null);
  const [mobileTab, setMobileTab] = useState<'forum' | 'news' | 'welcome'>('forum');
  const userPrefs = useUserPreferences(account?.id);
  const loungeAccentPalette = resolveLoungeAccent(userPrefs.prefs.loungeAccent);
  const la = loungeAccentPalette;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cfg = await fetchLoungeConfig(slug);
      const override = configOverrideRef.current;
      if (!cfg) {
        const isCustomPortal = !!override?.name;
        if (isCustomPortal) {
          console.error('[LOUNGE ERROR] Config not found for slug:', slug, 'Using override:', override);
        }
        cfg = {
          slug,
          name: override?.name ?? STABLE_CONFIG_OVERRIDE.name,
          type: override?.type ?? 'default',
          modules: override?.modules ?? [
            { id: 'left-tournaments', type: 'liveTournaments', position: 'left', priority: 1 },
            { id: 'left-cash', type: 'cashGames', position: 'left', priority: 2 },
            { id: 'center-feed', type: 'socialFeed', position: 'center', priority: 1 },
            { id: 'right-group', type: 'groupChat', position: 'right', priority: 1 },
            { id: 'right-direct', type: 'directMessages', position: 'right', priority: 2 },
          ],
          feedSettings: override?.feedSettings ?? { placeholder: "What's happening?", showComposer: true },
          chatSettings: override?.chatSettings ?? { groupChannels: ['general'], enableDirect: true },
          allowUserBackgroundCustomization: true,
          ...override,
        };
      } else if (override) {
        cfg = { ...cfg, ...override };
      }
      if (cancelled) return;
      setConfig(cfg);

      if (account) {
        const pref = await fetchBackgroundPreference(account.id, slug);
        if (pref && !cancelled) setBgPref(pref);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug, account?.id]);

  const handleApplyBg = useCallback((pref: BackgroundPreference) => {
    setBgPref(pref);
  }, []);

  if (loading || !config) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050608]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c0911e]/30 border-t-[#d4a52c]" />
      </div>
    );
  }

  const isSpotVault = config.slug === 'spotvault';
  const bgUrl =
    bgPref.backgroundType === 'custom' || bgPref.backgroundType === 'spotvault-preset'
      ? bgPref.backgroundValue
      : config.defaultBackground ?? (isSpotVault ? '/assets/lounge/image copy 5.webp' : '/assets/lounge/image.webp');

  const overlayOpacity = OVERLAY_OPACITY[bgPref.overlay] ?? OVERLAY_OPACITY.medium;
  const region = data.region ?? destination?.label;
  const hasConfiguredContext = !!(data.liveTournaments?.length || data.cashGames?.length);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608]" style={{ ['--lounge-accent' as string]: la.accent } as React.CSSProperties}>
      {/* Background layer */}
      {bgUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: bgPref.fit,
            backgroundPosition: bgPref.position,
          }}
        />
      )}
      {/* Subtle gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30" />
      {bgPref.overlay !== 'none' && <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity * 0.5 }} />}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] font-bold text-white/90 backdrop-blur-md transition-colors hover:border-[#d4a52c]/40 hover:text-[#d4a52c]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> BACK
              </button>
            )}
            <div className="flex items-center gap-2">
              {config.logo ? (
                <img src={config.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 backdrop-blur-md">
                  <span className="text-[9px] font-bold tracking-widest text-[#d4a52c]">SV</span>
                </div>
              )}
              <div>
                <span className="block text-sm font-bold text-white drop-shadow-lg">{config.name}</span>
                <span className="hidden text-[9px] text-white/60 drop-shadow sm:block">Connect. Learn. Play.</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onSwitchPortal && onTogglePortalSwitch && onClosePortalSwitch && isFounderUser(account) && (
              <PortalSwitcher
                account={account}
                currentPortal={currentPortal}
                onSwitch={onSwitchPortal}
                open={portalSwitchOpen}
                onToggle={onTogglePortalSwitch}
                onClose={onClosePortalSwitch}
                align="right"
                customPortals={customPortals}
                activePortalId={activePortalId}
                customPortalLabel={customPortalLabel}
                onEnterCustomPortal={onEnterCustomPortal}
                onReturnToDefault={onReturnToDefault}
              />
            )}
            {onReturnToPortal && (
              <button
                onClick={onReturnToPortal}
                className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1.5 text-[10px] font-bold text-[#d4a52c] backdrop-blur-md transition-colors hover:bg-[#c0911e]/20"
              >
                <Home className="h-3.5 w-3.5" /> HOME
              </button>
            )}
            {config.allowUserBackgroundCustomization && account && (
              <button
                onClick={() => setShowBgCustomizer(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 backdrop-blur-md transition-colors hover:text-white/80"
              >
                <Palette className="h-3 w-3" /> Background
              </button>
            )}
            <button
              onClick={() => setInspectBg((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold backdrop-blur-md transition-colors ${inspectBg ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#d4a52c]' : 'border-white/10 bg-black/30 text-white/50 hover:text-white/80'}`}
            >
              <Search className="h-3 w-3" /> {inspectBg ? 'Return to Lounge' : 'Inspect'}
            </button>
            {account && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1 backdrop-blur-md">
                <Avatar name={account.name} size={26} />
                <span className="hidden text-[11px] font-medium text-white/70 sm:inline">{account.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Mobile tab switcher */}
        <div className="flex shrink-0 items-center gap-1 px-6 py-1.5 lg:hidden">
          {([
            { key: 'forum' as const, label: 'Discussion', icon: MessageSquare },
            { key: 'news' as const, label: 'News', icon: Newspaper },
            { key: 'welcome' as const, label: 'Welcome', icon: Sparkles },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md transition ${
                mobileTab === tab.key ? 'bg-[#c0911e]/15 text-[#d4a52c] border border-[#c0911e]/20' : 'text-white/50 border border-transparent'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Three-column layout — floating panels */}
        <div className={`flex min-h-0 flex-1 gap-5 px-6 pb-6 pt-3 transition-opacity duration-500 lg:flex-row ${inspectBg ? 'opacity-5' : 'opacity-100'}`}>
          {/* LEFT COLUMN — News & Feed (23%) — expands when article selected */}
          <aside
            className={`min-w-0 flex-col lg:flex lg:flex-[0_0_23%] ${mobileTab === 'news' ? 'flex' : 'hidden'} lg:flex`}
          >
            <FloatingPanel>
              <PanelHeader icon={Newspaper} title={isSpotVault ? 'SpotVault News & Feed' : `${config.name} News`} subtitle="Updates • Education • Announcements" />
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {expandedArticle ? (
                  <ExpandedArticleView article={expandedArticle} onBack={() => setExpandedArticle(null)} />
                ) : isSpotVault ? (
                  <OfficialMainFeed onArticleOpen={setExpandedArticle} />
                ) : (
                  <SocialFeedModule
                    loungeSlug={config.slug}
                    account={account ?? null}
                    placeholder={config.feedSettings?.placeholder}
                    seedPosts={data.seedPosts}
                  />
                )}
              </div>
            </FloatingPanel>
          </aside>

          {/* CENTER COLUMN — Community Discussion (54%) */}
          <div
            className={`min-w-0 flex-col lg:flex lg:flex-[0_0_54%] ${mobileTab === 'forum' ? 'flex' : 'hidden'} lg:flex`}
          >
            <FloatingPanel>
              <PanelHeader icon={MessageSquare} title={config.name} subtitle="Connect. Learn. Play." />
              <LoungeView account={account} fixedScope={config.slug.startsWith('stakekings') ? 'stakekings' : 'spotvault'} />
            </FloatingPanel>
          </div>

          {/* RIGHT COLUMN — Welcome & Info (23%) */}
          <aside
            className={`min-w-0 flex-col lg:flex lg:flex-[0_0_23%] ${mobileTab === 'welcome' ? 'flex' : 'hidden'} lg:flex`}
          >
            <FloatingPanel>
              <PanelHeader icon={Sparkles} title={`Welcome to ${config.name}`} />
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="text-[11px] leading-relaxed text-white/65">
                  Welcome to the {config.name} — a space to connect, learn, and keep the conversation moving beyond the table.
                </p>
                <div className="mb-4 mt-4">
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#d4a52c]/80">What You Can Do Here</h3>
                  <ul className="space-y-1.5">
                    {[
                      'Discuss hands and poker strategy',
                      'Connect with players at similar stakes',
                      'Discuss online and live poker',
                      'Discover educational content',
                      'Find coaches and community members',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white/55">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[#d4a52c]/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#d4a52c]/80">
                    <MessageSquare className="h-3 w-3" /> Member Activity
                  </h3>
                  <p className="text-[10px] leading-relaxed text-white/50">Live conversations and new community posts appear here as members participate.</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#d4a52c]/80">
                    <Shield className="h-3 w-3" /> Community Guidelines
                  </h3>
                  <ul className="space-y-1">
                    {['Respectful discussion', 'Constructive feedback', 'Protect private information', 'Keep discussions on-topic'].map((g) => (
                      <li key={g} className="flex items-center gap-1.5 text-[10px] text-white/50">
                        <span className="h-1 w-1 rounded-full bg-[#d4a52c]/40" /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </FloatingPanel>
          </aside>
        </div>
      </div>

      {/* Modals */}
      {selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
      )}
      {showBgCustomizer && account && (
        <BackgroundCustomizer
          userId={account.id}
          loungeSlug={slug}
          communityDefaultBg={config.defaultBackground}
          preference={bgPref}
          onApply={handleApplyBg}
          onClose={() => setShowBgCustomizer(false)}
        />
      )}
    </div>
  );
}

function FloatingPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#d4a52c]/15 shadow-2xl backdrop-blur-md"
      style={{
        background: 'rgba(10, 12, 14, 0.88)',
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7), 0 8px 32px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ icon: Icon, title, subtitle }: { icon: typeof Newspaper; title: string; subtitle?: string }) {
  return (
    <div className="shrink-0 border-b border-[#d4a52c]/10 bg-black/20 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#d4a52c]/70" strokeWidth={1.5} />
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-white/80">{title}</h2>
          {subtitle && <p className="text-[9px] italic text-white/40">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function ExpandedArticleView({ article, onBack }: { article: MainFeedPost; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d4a52c] transition hover:text-[#f5e6b0]"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Feed
      </button>
      {article.feature_image_url && <img src={article.feature_image_url} alt="" className="mb-3 max-h-40 w-full rounded-lg object-cover" />}
      <h2 className="text-[16px] font-bold leading-tight text-white">{article.title}</h2>
      {article.subtitle && <p className="mt-1 text-[12px] leading-relaxed text-white/55">{article.subtitle}</p>}
      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#d4a52c]">{article.label ?? article.post_type}</div>
      <div className="article-body mt-4 text-[12px] leading-[1.8] text-white/75" dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body_html) }} />
      {article.cta_label && article.cta_url && (
        <a href={article.cta_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0]">
          {article.cta_label} <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
