import { useState } from 'react';
import { Mic2, LayoutDashboard } from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import { buildNavForPortal } from '@/data/portalConfigs';
import { IndustryRolodex } from '@/components/professional/IndustryRolodex';
import { PaidRequestsPanel } from '@/components/monetization/PaidRequestsPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { renderSharedPlayerView } from '@/components/player/SharedPlayerViews';
import type { HubTab } from '@/components/player/ProfileSettingsHub';
import type { Demo } from '@/useDemo';
import type { HubId } from '@/types';
import type { UniversalView } from '@/components/UniversalRail';
import type { SpotVaultAccount } from '@/types';
import type { ChannelDef } from '@/components/player/ChatPanel';

type MediaView =
  | 'home'
  | 'media-business'
  | 'rolodex'
  | 'paid-requests'
  | 'my-spots'
  | 'my-library'
  | 'public-library'
  | 'hand-analysis'
  | 'hh-workspace'
  | 'analytics'
  | 'content-lab'
  | 'solver'
  | 'market-store'
  | 'spot-store'
  | 'multispot-store'
  | 'stakekings-action'
  | 'marketplace'
  | 'profile'
  | 'settings'
  | 'privacy'
  | 'terms';

interface MediaRoomProps {
  demo: Demo;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onBack: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
}

const MEDIA_CHANNELS: ChannelDef[] = [
  { id: 'general', label: 'General' },
  { id: 'network', label: 'Media Network' },
];

const MEDIA_CHAT_CONFIG = {
  widgetId: 'media-chat',
  portalLabel: 'Media Hub',
  channels: MEDIA_CHANNELS,
  defaultPos: { x: 24, y: 60 },
  defaultSize: { width: 520, height: 460 },
};

export function MediaRoom(props: MediaRoomProps) {
  const { state } = props.demo;
  const account = state.currentAccount as SpotVaultAccount | null;
  const [view, setView] = useState<MediaView>('home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');

  const handleNavigate = (v: string) => {
    if (v === 'settings') { props.onOpenUniversalView('settings'); return; }
    setView(v as MediaView);
  };

  const navItems = buildNavForPortal('media', account);
  const sharedView = renderSharedPlayerView({ view, account, onNavigate: (v) => setView(v as MediaView), profileInitialTab: profileTab });

  return (
    <PortalRoomShell
      demo={props.demo}
      icon={Mic2}
      portalLabel="Media"
      roomLabel="Media Room"
      navItems={navItems}
      activeNav={view}
      onNavigate={handleNavigate}
      onSwitchPortal={props.onSwitchPortal}
      portalSwitchOpen={props.portalSwitchOpen}
      onTogglePortalSwitch={props.onTogglePortalSwitch}
      onClosePortalSwitch={props.onClosePortalSwitch}
      onOpenProfileSettings={(tab) => { setProfileTab(tab); setView('profile' as MediaView); }}
      onBack={props.onBack}
      onOpenUniversalView={props.onOpenUniversalView}
      portalKey="media"
      widgetUserId={account?.id}
    >
      {view === 'home' && <MediaHome />}
      {view === 'media-business' && account && (
        <ErrorBoundary variant="widget">
          <div className="flex h-full items-center justify-center p-6">
            <div className="text-center">
              <LayoutDashboard className="mx-auto mb-3 h-8 w-8 text-white/30" strokeWidth={1.5} />
              <p className="text-[12px] text-white/50">Media Business dashboard coming soon.</p>
            </div>
          </div>
        </ErrorBoundary>
      )}
      {view === 'paid-requests' && account && (
        <ErrorBoundary variant="widget">
          <PaidRequestsPanel userId={account.id} portalType="media" />
        </ErrorBoundary>
      )}
      {view === 'rolodex' && (
        <ErrorBoundary variant="widget">
          <IndustryRolodex viewerRole="media-portal" />
        </ErrorBoundary>
      )}
      {view === 'privacy' && <div className="p-6 text-white/50">Privacy Policy</div>}
      {view === 'terms' && <div className="p-6 text-white/50">Terms of Service</div>}
      {sharedView}
    </PortalRoomShell>
  );
}

function MediaHome() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 px-3 pt-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(10,12,14,0.62)', border: '1px solid rgba(192,145,30,0.18)', borderRadius: '12px', backdropFilter: 'blur(6px)' }}>
          <LayoutDashboard className="h-4 w-4" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#f5e6b0' }}>Media Room</span>
        </div>
      </div>
    </div>
  );
}

export function MediaSecondFloor({ demo }: { demo: Demo }) {
  return (
    <PortalRoomShell
      demo={demo}
      icon={Mic2}
      portalLabel="Media"
      roomLabel="Media Second Floor"
      navItems={[]}
      activeNav="home"
      onNavigate={() => {}}
      onSwitchPortal={() => {}}
      portalSwitchOpen={false}
      onTogglePortalSwitch={() => {}}
      onClosePortalSwitch={() => {}}
      onBack={() => {}}
      onOpenUniversalView={() => {}}
    >
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-[12px] text-white/50">Media Second Floor</div>
      </div>
    </PortalRoomShell>
  );
}
