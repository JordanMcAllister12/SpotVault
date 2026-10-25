import { useState, useCallback } from 'react';
import { ArrowLeft, Palette, MessageSquare, X } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import {
  modulesByPosition,
  OVERLAY_OPACITY,
  DEFAULT_BG_PREFERENCE,
  type LoungeConfig,
  type BackgroundPreference,
  type TournamentEvent,
  type CashGameSession,
  type LoungePost,
} from '@/lib/loungeFramework';
import { SocialFeedModule } from '@/components/lounge/SocialFeedModule';
import { GroupChatModule, type GroupMsg } from '@/components/lounge/GroupChatModule';
import { LiveTournamentsModule } from '@/components/lounge/LiveTournamentsModule';
import { EventsModule } from '@/components/lounge/EventsModule';
import { TournamentDetailModal } from '@/components/lounge/TournamentDetailModal';
import { BackgroundCustomizer } from '@/components/lounge/BackgroundCustomizer';
import type { LoungeData } from '@/components/lounge/UniversalLounge';
import type { SpotVaultAccount } from '@/types';

interface Props {
  slug: string;
  config: LoungeConfig;
  account: SpotVaultAccount | null;
  onBack?: () => void;
  originPortalName?: string;
  onReturnToPortal?: () => void;
  data?: LoungeData;
  bgPref: BackgroundPreference;
  onApplyBg: (pref: BackgroundPreference) => void;
}

export function MobileLounge({
  slug,
  config,
  account,
  onBack,
  originPortalName,
  onReturnToPortal,
  data = {},
  bgPref,
  onApplyBg,
}: Props) {
  const [selectedTournament, setSelectedTournament] = useState<TournamentEvent | null>(null);
  const [showBgCustomizer, setShowBgCustomizer] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const bgUrl =
    bgPref.backgroundType === 'custom' || bgPref.backgroundType === 'spotvault-preset'
      ? bgPref.backgroundValue
      : config.defaultBackground ?? undefined;
  const overlayOpacity = OVERLAY_OPACITY[bgPref.overlay] ?? OVERLAY_OPACITY.medium;

  const leftModules = modulesByPosition(config.modules, 'left');
  const centerModules = modulesByPosition(config.modules, 'center');
  const rightModules = modulesByPosition(config.modules, 'right');
  const chatModule = rightModules.find((m) => m.type === 'groupChat');
  const eventsModule = rightModules.find((m) => m.type === 'events');

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608]">
      {/* Background */}
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
      <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />

      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.04] px-3 py-2.5 bg-[#0a0c0e]/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="text-white/60">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-sm font-bold text-white">{config.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {onReturnToPortal && originPortalName && (
              <button
                onClick={onReturnToPortal}
                className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/5 px-2 py-1 text-[9px] font-semibold text-[#d4a52c]"
              >
                {originPortalName}
              </button>
            )}
            {config.allowUserBackgroundCustomization && account && (
              <button onClick={() => setShowBgCustomizer(true)} className="text-white/50">
                <Palette className="h-4 w-4" />
              </button>
            )}
            {account && <Avatar name={account.name} size={26} />}
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Left modules as horizontal cards */}
          {leftModules.map((m) => {
            if (m.type === 'liveTournaments') {
              return (
                <div key={m.id} className="border-b border-white/[0.04]">
                  <LiveTournamentsModule
                    liveTournaments={data.liveTournaments ?? []}
                    cashGames={data.cashGames ?? []}
                    onTournamentClick={setSelectedTournament}
                    region={m.settings?.region as string | undefined}
                  />
                </div>
              );
            }
            return null;
          })}

          {/* Events as horizontal carousel */}
          {eventsModule && (
            <div className="border-b border-white/[0.04] p-3">
              <EventsModule
                tournaments={data.upcomingEvents ?? []}
                title={config.eventSettings?.title ?? 'Events'}
                onTournamentClick={setSelectedTournament}
              />
            </div>
          )}

          {/* Center feed */}
          {centerModules.map((m) => {
            if (m.type === 'socialFeed') {
              return (
                <div key={m.id} className="min-h-[400px]">
                  <SocialFeedModule
                    loungeSlug={config.slug}
                    account={account}
                    placeholder={config.feedSettings?.placeholder}
                    seedPosts={data.seedPosts}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Floating chat button */}
        {chatModule && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c] shadow-lg"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Chat overlay */}
      {chatOpen && chatModule && (
        <div className="fixed inset-0 z-[100] bg-[#0a0c0e]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <span className="text-sm font-bold text-white">Chat</span>
            <button onClick={() => setChatOpen(false)} className="text-white/60">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-48px)]">
            <GroupChatModule
              loungeSlug={config.slug}
              account={account}
              channels={config.chatSettings?.groupChannels ?? ['general']}
              enableDirect={config.chatSettings?.enableDirect ?? true}
              seedGroupMessages={data.seedGroupMessages}
              seedDirectMessages={data.seedDirectMessages}
              seedDirectContacts={data.seedDirectContacts}
              seedGroupPresence={data.seedGroupPresence}
            />
          </div>
        </div>
      )}

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
          onApply={onApplyBg}
          onClose={() => setShowBgCustomizer(false)}
        />
      )}
    </div>
  );
}
