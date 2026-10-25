import { useState } from 'react';
import {
  Video,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Newspaper,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import { MediaWidget } from '@/components/player/widgets/MediaWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { CommunityFeed } from '@/components/CommunityFeed';
import { OfficialMainFeed } from '@/components/community/OfficialMainFeed';
import { QuickMessagesPanel } from '@/components/messaging/QuickMessagesPanel';
import { SweatRail } from '@/components/SweatRail';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = 'rgba(212,165,44,0.55)';
const BORDER = 'rgba(212,165,44,0.18)';

interface MobilePortalHomeProps {
  portalKey: string;
  portalLabel: string;
  userId?: string;
  account?: SpotVaultAccount | null;
  onOpenFullMessaging?: () => void;
}

type WidgetId = 'social' | 'mainfeed' | 'communication' | 'media' | 'sweatrail';

const WIDGET_META: Record<WidgetId, { title: string; subtitle: string; icon: LucideIcon }> = {
  social: { title: 'Social Feed', subtitle: 'Community Posts', icon: MessageSquare },
  mainfeed: { title: 'Info', subtitle: 'Latest Articles', icon: Newspaper },
  communication: { title: 'Communication', subtitle: 'Messages & Chat', icon: MessageSquare },
  media: { title: 'Media Player', subtitle: 'Watch & Learn', icon: Video },
  sweatrail: { title: 'Sweat Rail', subtitle: 'Live Sweats', icon: Flame },
};

const DEFAULT_ORDER: WidgetId[] = ['social', 'mainfeed', 'communication', 'media', 'sweatrail'];

const ALL_WIDGETS: WidgetId[] = ['social', 'mainfeed', 'communication', 'media', 'sweatrail'];

export function MobilePortalHome({
  portalKey,
  portalLabel,
  userId,
  account,
  onOpenFullMessaging,
}: MobilePortalHomeProps) {
  const userPrefs = useUserPreferences(userId, portalKey);
  const enabledWidgets = userPrefs.prefs.homeWidgets.enabled;
  const [collapsed, setCollapsed] = useState<Record<WidgetId, boolean>>({
    social: false,
    mainfeed: true,
    communication: false,
    media: false,
    sweatrail: true,
  });
  const [sweatActive, setSweatActive] = useState(false);

  const order = userPrefs.prefs.homeWidgets.order.length > 0
    ? (userPrefs.prefs.homeWidgets.order.filter((id): id is WidgetId => ALL_WIDGETS.includes(id as WidgetId)))
    : DEFAULT_ORDER;

  const visibleWidgets = order.filter(
    (id) => enabledWidgets.length === 0 || enabledWidgets.includes(id),
  );

  const toggleCollapse = (id: WidgetId) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderWidgetContent = (id: WidgetId) => {
    switch (id) {
      case 'social':
        return <CommunityFeed account={account ?? null} />;
      case 'mainfeed':
        return <OfficialMainFeed />;
      case 'communication':
        return (
          <QuickMessagesPanel
            account={account ?? null}
            isActive
            onActivate={() => {}}
            onOpenFullMessaging={onOpenFullMessaging ?? (() => {})}
          />
        );
      case 'media':
        return <MediaWidget onViewAll={() => {}} />;
      case 'sweatrail':
        return (
          <SweatRail isActive={sweatActive} onActivate={() => setSweatActive(true)} />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="flex h-full flex-col overflow-y-auto px-3 py-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="text-[11px] font-bold tracking-[0.2em] uppercase"
          style={{ color: GOLD_SOFT }}
        >
          {portalLabel}
        </span>
        <span className="text-[9px] text-white/30">Home</span>
      </div>

      <div className="space-y-2.5">
        {visibleWidgets.map((id) => {
          const meta = WIDGET_META[id];
          const Icon = meta.icon;
          const isCollapsed = collapsed[id];

          return (
            <div
              key={id}
              className="overflow-hidden rounded-xl border bg-black/40 backdrop-blur-md"
              style={{ borderColor: BORDER }}
            >
              <button
                onClick={() => toggleCollapse(id)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.5}
                  style={{ color: GOLD }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-white/80">
                    {meta.title}
                  </div>
                  <div className="text-[9px] text-white/30">{meta.subtitle}</div>
                </div>
                {isCollapsed ? (
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-white/30"
                    strokeWidth={1.5}
                  />
                ) : (
                  <ChevronUp
                    className="h-4 w-4 shrink-0 text-white/30"
                    strokeWidth={1.5}
                  />
                )}
              </button>

              {!isCollapsed && (
                <div className="border-t border-white/[0.04] p-2">
                  <ErrorBoundary variant="widget">
                    {renderWidgetContent(id)}
                  </ErrorBoundary>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visibleWidgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[11px] text-white/30">
            No widgets enabled. Visit Settings to enable widgets for this portal.
          </p>
        </div>
      )}
    </div>
  );
}
