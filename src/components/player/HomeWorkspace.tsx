import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Check, Mail, Star, Video } from 'lucide-react';
import type { MediaItem } from '@/data/mediaLibrary';
import type { SpotVaultAccount } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MediaWidget } from '@/components/player/widgets/MediaWidget';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { setPlayHandler } from '@/lib/mediaPlayerStore';
import { useMessagingUnread } from '@/lib/messagingCenterStore';
import { QuickMessagesPanel } from '@/components/messaging/QuickMessagesPanel';
import { dispatchOpenMessaging } from '@/lib/profileEvents';

const GOLD = 'var(--portal-accent, #d4a52c)';
const GOLD_SOFT = 'var(--portal-accent-soft, #f5e6b0)';
const BORDER = 'rgba(var(--portal-accent-rgb, 192,145,30), 0.32)';
const BRONZE_BG = 'rgba(8, 7, 6, 0.55)';

type WidgetId = 'media' | 'communication';
type HomeSelection = WidgetId | null;

interface HomeWorkspaceProps {
  onOpenAnalytics?: () => void;
  onOpenMySpots?: () => void;
  onPlayOnTv?: (item: MediaItem) => void;
  portalKey?: string;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateRight?: () => void;
  userId?: string;
  account?: SpotVaultAccount | null;
  autoSelectYouTubeId?: string;
  autoSelectStartAt?: number;
  autoExpandMedia?: boolean;
}

const WIDGETS: { id: WidgetId; label: string; icon: typeof Video }[] = [
  { id: 'media', label: 'Media Player', icon: Video },
  { id: 'communication', label: 'Communication', icon: Mail },
];

function isWidgetId(value: string | null): value is WidgetId {
  return value === 'media' || value === 'communication';
}

export function HomeWorkspace({
  onOpenMySpots,
  portalKey = 'player',
  userId,
  account,
  autoSelectYouTubeId,
  autoSelectStartAt,
  autoExpandMedia,
}: HomeWorkspaceProps) {
  const userPrefs = useUserPreferences(userId, portalKey);
  const [activeWidget, setActiveWidget] = useState<HomeSelection>('media');
  const [defaultMenuOpen, setDefaultMenuOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const defaultMenuRef = useRef<HTMLDivElement>(null);
  const { chats: msgChatsUnread, inbox: msgInboxUnread, groups: msgGroupsUnread, activity: msgActivityUnread } = useMessagingUnread(userId ?? undefined);
  const commUnread = msgChatsUnread + msgInboxUnread + msgGroupsUnread + msgActivityUnread;

  useEffect(() => {
    setInitialized(false);
    setActiveWidget('media');
  }, [portalKey, userId]);

  useEffect(() => {
    if (initialized || userPrefs.loading) return;
    const preferred = isWidgetId(userPrefs.prefs.defaultHomeWidget)
      ? userPrefs.prefs.defaultHomeWidget
      : 'media';
    setActiveWidget(preferred);
    setInitialized(true);
  }, [initialized, userPrefs.loading, userPrefs.prefs.defaultHomeWidget]);

  // Track whether the user has explicitly selected a widget. This prevents
  // auto-play (intro video, auto-select) from overriding an explicit Messages
  // selection. Only user-initiated plays switch to the Media tab.
  const userSelectedRef = useRef(false);

  const selectWidget = useCallback((widget: WidgetId) => {
    userSelectedRef.current = true;
    setActiveWidget(widget);
  }, []);

  useEffect(() => {
    setPlayHandler(() => {
      // Only auto-switch to Media if the user hasn't explicitly chosen Messages.
      // This lets auto-play work on initial load while respecting user navigation.
      if (!userSelectedRef.current) {
        setActiveWidget('media');
      }
    });
    return () => setPlayHandler(null);
  }, []);

  useEffect(() => {
    if (!defaultMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (defaultMenuRef.current && !defaultMenuRef.current.contains(e.target as Node)) {
        setDefaultMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDefaultMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [defaultMenuOpen]);

  const setDefault = useCallback(async (widget: HomeSelection) => {
    const ok = await userPrefs.setDefaultHomeWidget(widget);
    if (!ok) {
      console.error('[HomeWorkspace] Failed to save default widget preference');
    }
    setDefaultMenuOpen(false);
  }, [userPrefs]);

  const renderWidget = (widget: WidgetId) => {
    const visible = activeWidget === widget;
    const visibilityClass = visible ? 'flex' : 'hidden';

    if (widget === 'media') {
      return (
        <div className={`${visibilityClass} h-full min-h-0 flex-col`} aria-hidden={!visible}>
          <MediaWidget
            isVisible={visible}
            onViewAll={onOpenMySpots}
            autoSelectYouTubeId={autoSelectYouTubeId}
            autoSelectStartAt={autoSelectStartAt}
            autoStartPaused={autoExpandMedia}
            userId={userId}
          />
        </div>
      );
    }

    return (
      <div className={`${visibilityClass} h-full min-h-0 flex-col`} aria-hidden={!visible}>
        <QuickMessagesPanel
          account={account}
          isActive={visible}
          onActivate={() => {}}
          onOpenFullMessaging={() => dispatchOpenMessaging('chats')}
        />
      </div>
    );
  };

  const defaultLabel = WIDGETS.find((widget) => widget.id === userPrefs.prefs.defaultHomeWidget)?.label ?? 'Media Player';

  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden pb-20">
      <section
        className="pointer-events-auto absolute left-1/2 top-1/2 flex h-[min(72vh,680px)] min-h-[340px] w-[calc(100%-16px)] max-w-[988px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-[0_24px_80px_-28px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-200 sm:w-[calc(100%-24px)] lg:w-[68%] lg:max-w-[920px] xl:w-[62%] 2xl:w-[58%]"
        style={{ borderColor: BORDER, background: 'rgba(6, 8, 10, 0.55)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 80px -28px rgba(0,0,0,0.95)' }}
        aria-label="Home hub"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/20 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg border sm:h-7 sm:w-7" style={{ borderColor: BORDER, background: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.1)' }}>
              <BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-white sm:text-[11px]">SpotVault Hub</p>
              <p className="text-[7px] tracking-[0.16em] text-white/35 uppercase sm:text-[8px]">Home</p>
            </div>
          </div>
          <div className="relative" ref={defaultMenuRef}>
            <button
              onClick={() => setDefaultMenuOpen((open) => !open)}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold tracking-widest uppercase transition-colors hover:bg-white/10"
              style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.08)' }}
              aria-expanded={defaultMenuOpen}
            >
              <Star className="h-3 w-3" fill="currentColor" strokeWidth={1.5} />
              Default: {defaultLabel}
            </button>
            {defaultMenuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border p-1.5 shadow-2xl backdrop-blur-md" style={{ borderColor: BORDER, background: 'rgba(6, 8, 10, 0.92)' }}>
                {WIDGETS.map((widget) => ({ id: widget.id as HomeSelection, label: widget.label, icon: widget.icon })).map(({ id, label, icon: Icon }) => {
                  const selected = userPrefs.prefs.defaultHomeWidget === id;
                  return (
                    <button
                      key={id ?? 'none'}
                      onClick={() => void setDefault(id)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Icon className="h-3 w-3" style={{ color: selected ? GOLD : 'rgba(255,255,255,0.35)' }} strokeWidth={1.5} />
                      <span className="flex-1">{label}</span>
                      {selected && <Check className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ErrorBoundary variant="widget">
            {WIDGETS.map((widget) => (
              <div key={widget.id} className={activeWidget === widget.id ? 'h-full' : 'hidden'}>
                {renderWidget(widget.id)}
              </div>
            ))}
          </ErrorBoundary>
        </div>
      </section>

      <nav className="pointer-events-auto absolute bottom-2 left-1/2 z-10 flex max-w-[calc(100%-12px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border p-1 shadow-2xl backdrop-blur-md sm:bottom-3 sm:max-w-[calc(100%-16px)] sm:gap-1 sm:p-1.5" style={{ borderColor: 'rgba(var(--portal-accent-rgb, 192,145,30), 0.42)', background: 'rgba(6, 8, 10, 0.75)' }} aria-label="Home widgets">
        {WIDGETS.map(({ id, label, icon: Icon }) => {
          const active = activeWidget === id;
          const badge = id === 'communication' ? commUnread : 0;
          return (
            <button
              key={id}
              onClick={() => selectWidget(id)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-semibold tracking-wide uppercase transition-all duration-200 sm:px-3 sm:py-2"
              style={{
                background: active ? 'rgba(var(--portal-accent-rgb, 74,52,19), 0.42)' : BRONZE_BG,
                borderColor: active ? 'var(--portal-accent, #c0911e)' : BORDER,
                color: active ? GOLD_SOFT : 'rgba(232,220,196,0.62)',
                boxShadow: active ? '0 0 12px rgba(212,165,44,0.18), inset 0 1px 0 rgba(245,230,176,0.08)' : 'none',
              }}
              aria-pressed={active}
            >
              <Icon className="h-3 w-3" strokeWidth={1.7} />
              <span>{label}</span>
              {badge > 0 && <span className="rounded-full border px-1.5 text-[8px] font-bold" style={{ borderColor: 'rgba(var(--portal-accent-rgb, 192,145,30), 0.5)', background: 'rgba(var(--portal-accent-rgb, 192,145,30), 0.15)', color: GOLD_SOFT }}>{badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
